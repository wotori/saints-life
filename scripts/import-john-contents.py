#!/usr/bin/env python3
"""Preserve locally recognized contents pages for the supplied 2014 John book."""
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT.parent / 'staints-life-sources'


def main():
    with sqlite3.connect(ARCHIVE / 'rostovskij-ocr.sqlite3') as db:
        book = db.execute('SELECT sha256,pages FROM books WHERE number=13').fetchone()
    if not book or book[1] < 827:
        raise RuntimeError('The expected John book is absent from the OCR database.')
    items = [(page, (ARCHIVE / 'john-contents' / f'page-{page}.txt').read_text(), book[0]) for page in range(821, 828)]
    with sqlite3.connect(ARCHIVE / 'book-indexes.sqlite3', timeout=30) as db:
        db.execute('''CREATE TABLE IF NOT EXISTS john_contents_pages (
            page INTEGER PRIMARY KEY, body TEXT NOT NULL, source_sha256 TEXT NOT NULL)''')
        for item in items:
            db.execute('INSERT INTO john_contents_pages VALUES(?,?,?) ON CONFLICT(page) DO UPDATE SET body=excluded.body, source_sha256=excluded.source_sha256', item)
        db.commit()
    print(f'Imported contents pages: {len(items)}')


if __name__ == '__main__':
    main()
