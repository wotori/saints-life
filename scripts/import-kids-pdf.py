#!/usr/bin/env python3
"""Import chapter text from the user's searchable children's PDF without OCR."""
import argparse
import bisect
import hashlib
from pathlib import Path
import re
import sqlite3
import subprocess


def extract_chapters(text):
    pages = text.split('\f')
    if len(pages) < 3:
        raise ValueError('The source does not contain the expected table of contents.')
    titles = [line.strip() for line in pages[1].splitlines() if re.match(r'^ {4,}\S', line)]
    if len(titles) < 10 or len(set(titles)) != len(titles):
        raise ValueError('Could not identify a unique table of contents; source requires manual review.')
    starts = []
    for title in titles:
        matches = list(re.finditer(r'(?m)(?:^|(?<=\f))[ \t]*' + re.escape(title) + r'[ \t]*$', text))
        if len(matches) != 2:
            raise ValueError(f'Expected one contents entry and one chapter heading for {title!r}; found {len(matches)}.')
        starts.append(matches[1].start())
    if starts != sorted(starts) or len(set(starts)) != len(starts):
        raise ValueError('The chapters do not follow the order in the contents.')
    boundaries = [0]
    boundaries.extend(i + 1 for i, ch in enumerate(text) if ch == '\f')
    result = []
    for index, title in enumerate(titles):
        start = starts[index]
        end = starts[index + 1] if index + 1 < len(starts) else len(text)
        body = text[start:end].replace('\f', '\n').strip()
        start_page = bisect.bisect_right(boundaries, start)
        end_page = bisect.bisect_right(boundaries, max(start, end - 1))
        if not body or end_page < start_page:
            raise ValueError(f'Invalid chapter boundary: {title}')
        result.append((title, f'страницы PDF {start_page}-{end_page}', body))
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('pdf')
    parser.add_argument('--db', default='../staints-life-sources/library.sqlite3')
    args = parser.parse_args()
    source = Path(args.pdf).resolve()
    text = subprocess.run(['pdftotext', '-layout', str(source), '-'], check=True, capture_output=True).stdout.decode('utf-8')
    chapters = extract_chapters(text)
    checksum = hashlib.sha256()
    with source.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            checksum.update(block)
    book_id = 'kids-saints'
    db_path = Path(args.db)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path, timeout=30) as db:
        db.executescript('''CREATE TABLE IF NOT EXISTS books(id TEXT PRIMARY KEY,title TEXT NOT NULL,publisher TEXT,year TEXT,sha256 TEXT,source_path TEXT,rights TEXT);
CREATE TABLE IF NOT EXISTS chapters(id TEXT PRIMARY KEY,book_id TEXT NOT NULL,title TEXT NOT NULL,locator TEXT NOT NULL,position INTEGER NOT NULL,body TEXT NOT NULL,FOREIGN KEY(book_id) REFERENCES books(id));
CREATE INDEX IF NOT EXISTS chapters_book ON chapters(book_id,position);''')
        existing = db.execute('SELECT sha256 FROM books WHERE id=?', (book_id,)).fetchone()
        if existing and existing[0] != checksum.hexdigest():
            raise ValueError('A different edition is already stored under this ID. Review it before replacing.')
        with db:
            db.execute('INSERT OR REPLACE INTO books VALUES(?,?,?,?,?,?,?)', (book_id, 'Жития святых в изложении для детей', 'издатель в PDF не указан', 'год в PDF не указан; 1994 в имени файла', checksum.hexdigest(), str(source), 'Текст извлечён из предоставленного пользователем PDF. Выходные данные и права на публичное распространение требуют проверки.'))
            db.execute('DELETE FROM chapters WHERE book_id=?', (book_id,))
            for position, (title, locator, body) in enumerate(chapters):
                db.execute('INSERT INTO chapters VALUES(?,?,?,?,?,?)', (f'{book_id}-{position + 1}', book_id, title, locator, position, body))
    print(f'Imported {len(chapters)} chapters from {source.name} into {db_path.resolve()}.')


if __name__ == '__main__':
    main()
