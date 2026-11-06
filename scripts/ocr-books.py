#!/usr/bin/env python3
"""Resumable, page-addressed local OCR for the supplied scanned books.

Uses Poppler and local Tesseract, never sends book contents to a network service.
The source image and the uncorrected OCR are not silently presented as verified text.
"""
import argparse
import concurrent.futures
import fcntl
import hashlib
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT.parent / 'staints-life-sources'
BOOKS = Path('/Users/wotori/git/books/raw_books/Жития')
JOHN_BOOK = Path('/Users/wotori/Downloads/Святитель Иоанн Шанхайский и Сан-Францисский')
ROMAN = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10, 'XI': 11, 'XII': 12}


def source_books():
    candidates = {}
    for file in BOOKS.glob('*.pdf'):
        match = re.search(r'Книга\s+([IVX]+)\s+-', file.name)
        if not match or match.group(1) not in ROMAN:
            continue
        number = ROMAN[match.group(1)]
        if number in candidates:
            raise RuntimeError(f'More than one source PDF for book {number}; choose the edition explicitly.')
        candidates[number] = file
    for number in range(1, 13):
        archived = ARCHIVE / 'originals' / 'user-books' / f'rostovskij-{number:02}.pdf'
        if archived.is_file():
            candidates[number] = archived
    if sorted(candidates) != list(range(1, 13)):
        raise RuntimeError('Expected exactly books I through XII; source inventory differs.')
    result = []
    for number, file in sorted(candidates.items()):
        info = subprocess.run(['pdfinfo', str(file)], text=True, capture_output=True, check=True).stdout
        pages = re.search(r'^Pages:\s+(\d+)', info, re.MULTILINE)
        if not pages:
            raise RuntimeError(f'Cannot read PDF page count: {file}')
        checksum = hashlib.sha256()
        with file.open('rb') as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b''):
                checksum.update(block)
        digest = checksum.hexdigest()
        result.append((number, file.resolve(), int(pages.group(1)), digest))
    archived_john = ARCHIVE / 'originals' / 'user-books' / 'ioann-shanghai-2014.pdf'
    if archived_john.is_file() or JOHN_BOOK.exists():
        john_files = [archived_john] if archived_john.is_file() else list(JOHN_BOOK.glob('*.pdf'))
        if len(john_files) != 1:
            raise RuntimeError('Expected exactly one PDF in the John of Shanghai source folder.')
        john = john_files[0]
        info = subprocess.run(['pdfinfo', str(john)], text=True, capture_output=True, check=True).stdout
        pages = re.search(r'^Pages:\s+(\d+)', info, re.MULTILINE)
        if not pages:
            raise RuntimeError(f'Cannot read PDF page count: {john}')
        checksum = hashlib.sha256()
        with john.open('rb') as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b''):
                checksum.update(block)
        result.append((13, john.resolve(), int(pages.group(1)), checksum.hexdigest()))
    return result


def search_body(body):
    """Index the original and a joined-word variant, without changing the source OCR."""
    joined = re.sub(r'(?<=[А-Яа-яЁё])-[ \t]*\n[ \t]*(?=[а-яё])', '', body)
    return body if joined == body else body + '\n' + joined


def recognize(book, page):
    number, source, _, _ = book
    try:
        with tempfile.TemporaryDirectory(prefix=f'book-{number}-{page}-', dir=ARCHIVE / 'ocr-work') as temp:
            target = str(Path(temp) / 'page')
            subprocess.run(['pdftoppm', '-f', str(page), '-l', str(page), '-scale-to', '1800', '-jpeg', '-singlefile', str(source), target], check=True, capture_output=True, timeout=90)
            env = dict(os.environ, OMP_THREAD_LIMIT='1')
            process = subprocess.run(['tesseract', target + '.jpg', 'stdout', '-l', 'rus', '--psm', '3'], check=True, capture_output=True, text=True, timeout=180, env=env)
            return number, page, process.stdout, None
    except (subprocess.SubprocessError, OSError) as exc:
        return number, page, '', str(exc)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--workers', type=int, default=3)
    parser.add_argument('--limit', type=int, default=0, help='Limit newly processed pages; 0 processes all')
    parser.add_argument('--retry-errors', action='store_true')
    args = parser.parse_args()
    if args.workers < 1 or args.workers > 8 or args.limit < 0:
        parser.error('workers must be between 1 and 8; limit must be nonnegative')
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    (ARCHIVE / 'ocr-work').mkdir(exist_ok=True)
    with (ARCHIVE / 'ocr.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('An OCR import is already running.')
        books = source_books()
        con = sqlite3.connect(ARCHIVE / 'rostovskij-ocr.sqlite3', timeout=30)
        con.execute('PRAGMA journal_mode=WAL')
        con.create_function('ocr_search_body', 1, search_body)
        con.executescript('''CREATE TABLE IF NOT EXISTS books (number INTEGER PRIMARY KEY, title TEXT NOT NULL, source_path TEXT NOT NULL, pages INTEGER NOT NULL, sha256 TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pages (book_number INTEGER NOT NULL, page INTEGER NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL, error TEXT, PRIMARY KEY(book_number, page), FOREIGN KEY(book_number) REFERENCES books(number));
CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(body, book_number UNINDEXED, page UNINDEXED, tokenize='unicode61');''')
        con.execute('INSERT OR REPLACE INTO pages_fts(rowid, body, book_number, page) SELECT rowid, ocr_search_body(body), book_number, page FROM pages WHERE status = ?', ('ok',))
        for number, source, pages, sha in books:
            previous = con.execute('SELECT sha256 FROM books WHERE number=?', (number,)).fetchone()
            if previous and previous[0] != sha:
                raise RuntimeError(f'Source book {number} changed; preserve the old database and review before importing.')
            title = 'Владыка Иоанн - святитель русского зарубежья' if number == 13 else f'Жития святых. Книга {number}'
            con.execute('INSERT OR IGNORE INTO books VALUES(?,?,?,?,?)', (number, title, str(source), pages, sha))
            con.execute('UPDATE books SET source_path=? WHERE number=? AND sha256=?', (str(source), number, sha))
        con.commit()
        done = {(n, p) for n, p, status in con.execute('SELECT book_number,page,status FROM pages') if status == 'ok' or not args.retry_errors}
        # Round-robin ensures each volume becomes available while the long run proceeds.
        queue = ((book, page) for page in range(1, max(b[2] for b in books) + 1) for book in books if page <= book[2] and (book[0], page) not in done)
        total = sum(b[2] for b in books)
        print(f'Books: {len(books)}; pages: {total}; already processed: {len(done)}; workers: {args.workers}', flush=True)
        processed = 0
        start = time.monotonic()
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            pending = set()
            exhausted = False
            while pending or not exhausted:
                while not exhausted and len(pending) < args.workers * 2 and (not args.limit or processed + len(pending) < args.limit):
                    try:
                        book, page = next(queue)
                    except StopIteration:
                        exhausted = True
                        break
                    pending.add(pool.submit(recognize, book, page))
                if not pending:
                    break
                completed, pending = concurrent.futures.wait(pending, return_when=concurrent.futures.FIRST_COMPLETED)
                for future in completed:
                    number, page, body, error = future.result()
                    con.execute('INSERT INTO pages VALUES(?,?,?,?,?) ON CONFLICT(book_number,page) DO UPDATE SET body=excluded.body, status=excluded.status, error=excluded.error', (number, page, body, 'error' if error else 'ok', error))
                    rowid = con.execute('SELECT rowid FROM pages WHERE book_number=? AND page=?', (number, page)).fetchone()[0]
                    con.execute('DELETE FROM pages_fts WHERE rowid=?', (rowid,))
                    if not error:
                        con.execute('INSERT INTO pages_fts(rowid,body,book_number,page) VALUES(?,?,?,?)', (rowid, search_body(body), number, page))
                    con.commit()
                    processed += 1
                    print(f'{len(done)+processed}/{total} book={number} page={page} chars={len(body)} status={"error" if error else "ok"} elapsed={int(time.monotonic()-start)}s', flush=True)
                if args.limit and processed >= args.limit:
                    exhausted = True
        con.close()


if __name__ == '__main__':
    main()
