#!/usr/bin/env python3
"""Read the last pages of supplied scans, preserving two-column index OCR locally."""
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

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT.parent / 'staints-life-sources'


def read_columns(book, page):
    number, source, _, _ = book
    with tempfile.TemporaryDirectory(prefix=f'index-{number}-{page}-', dir=ARCHIVE / 'ocr-work') as temporary:
        prefix = str(Path(temporary) / 'page')
        subprocess.run(['pdftoppm', '-f', str(page), '-l', str(page), '-scale-to', '2400', '-jpeg', '-singlefile', source, prefix], check=True, capture_output=True, timeout=90)
        env = dict(os.environ, OMP_THREAD_LIMIT='1')
        columns = []
        with Image.open(prefix + '.jpg') as image:
            width, height = image.size
            for index in range(2):
                column = str(Path(temporary) / f'column-{index}.png')
                image.crop((width * index // 2, 0, width * (index + 1) // 2, height)).save(column)
                result = subprocess.run(['tesseract', column, 'stdout', '-l', 'rus', '--psm', '6'], check=True, capture_output=True, text=True, timeout=180, env=env)
                columns.append(result.stdout)
        text = '\n'.join(columns)
        # Dotted leaders occur throughout the alphabetic index and rarely in prose.
        leaders = sum(1 for line in text.splitlines() if re.search(r'\.{3,}', line) and re.search(r'\d', line))
        return number, page, columns[0], columns[1], int(leaders >= 5), leaders


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--workers', type=int, default=2, choices=range(1, 5))
    parser.add_argument('--tail', type=int, default=12)
    args = parser.parse_args()
    if not 1 <= args.tail <= 30:
        parser.error('tail must be between 1 and 30')
    (ARCHIVE / 'ocr-work').mkdir(parents=True, exist_ok=True)
    with (ARCHIVE / 'index-ocr.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('An index OCR import is already running.')
        with sqlite3.connect(ARCHIVE / 'rostovskij-ocr.sqlite3') as source_db:
            books = source_db.execute('SELECT number,source_path,pages,sha256 FROM books WHERE number BETWEEN 1 AND 12 ORDER BY number').fetchall()
        if len(books) != 12:
            raise RuntimeError('Expected all 12 source volumes in the OCR database.')
        for number, source, _, digest in books:
            checksum = hashlib.sha256()
            with open(source, 'rb') as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    checksum.update(block)
            if checksum.hexdigest() != digest:
                raise RuntimeError(f'Source volume {number} no longer matches its archived checksum.')
        with sqlite3.connect(ARCHIVE / 'book-indexes.sqlite3', timeout=30) as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('''CREATE TABLE IF NOT EXISTS index_pages (
                book_number INTEGER NOT NULL, page INTEGER NOT NULL, left_text TEXT NOT NULL,
                right_text TEXT NOT NULL, is_index INTEGER NOT NULL, leaders INTEGER NOT NULL,
                source_sha256 TEXT NOT NULL, PRIMARY KEY(book_number,page))''')
            existing = {(number, page): sha for number, page, sha in db.execute('SELECT book_number,page,source_sha256 FROM index_pages')}
            for number, _, _, sha in books:
                if any(previous != sha for (book, _), previous in existing.items() if book == number):
                    raise RuntimeError(f'Index OCR for book {number} belongs to another edition.')
            queue = [(book, page) for book in books for page in range(max(1, book[2] - args.tail + 1), book[2] + 1) if (book[0], page) not in existing]
            print(f'Index candidates remaining: {len(queue)}', flush=True)
            with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
                # Keep a small number of subprocesses in flight.
                iterator = iter(queue)
                pending = {}
                for _ in range(args.workers):
                    task = next(iterator, None)
                    if task:
                        pending[pool.submit(read_columns, *task)] = task
                while pending:
                    done, _ = concurrent.futures.wait(pending, return_when=concurrent.futures.FIRST_COMPLETED)
                    for future in done:
                        book, page = pending.pop(future)
                        try:
                            number, page, left, right, is_index, leaders = future.result()
                            db.execute('INSERT INTO index_pages VALUES(?,?,?,?,?,?,?)', (number, page, left, right, is_index, leaders, book[3]))
                            db.commit()
                            print(f'book={number} page={page} index={is_index} leaders={leaders}', flush=True)
                        except (OSError, subprocess.SubprocessError) as error:
                            print(f'book={book[0]} page={page} failed: {error}', flush=True)
                        task = next(iterator, None)
                        if task:
                            pending[pool.submit(read_columns, *task)] = task


if __name__ == '__main__':
    main()
