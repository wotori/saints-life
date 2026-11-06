#!/usr/bin/env python3
"""Add joined-line search variants without modifying the original OCR pages."""
import argparse
import fcntl
import hashlib
import importlib.util
from pathlib import Path
import sqlite3
import time

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT.parent / 'staints-life-sources'
spec = importlib.util.spec_from_file_location('ocr_books', ROOT / 'scripts' / 'ocr-books.py')
ocr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ocr)


def ocr_running(archive):
    with (archive / 'ocr.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return True
        fcntl.flock(lock, fcntl.LOCK_UN)
        return False


def refresh(db):
    db.execute('''CREATE TABLE IF NOT EXISTS search_index_state (
        page_rowid INTEGER PRIMARY KEY, body_hash TEXT NOT NULL)''')
    db.commit()
    rows = db.execute('''SELECT p.rowid,p.book_number,p.page,p.body,s.body_hash FROM pages p
        LEFT JOIN search_index_state s ON s.page_rowid=p.rowid WHERE p.status='ok' ''').fetchall()
    pending = []
    for rowid, book, page, body, old_hash in rows:
        digest = hashlib.sha256(body.encode('utf-8')).hexdigest()
        if digest != old_hash:
            pending.append((rowid, book, page, body, digest))
    written = 0
    for first in range(0, len(pending), 100):
        db.execute('BEGIN IMMEDIATE')
        try:
            for rowid, book, page, body, digest in pending[first:first + 100]:
                current = db.execute('SELECT body,status FROM pages WHERE rowid=?', (rowid,)).fetchone()
                if current != (body, 'ok'):
                    continue
                db.execute('DELETE FROM pages_fts WHERE rowid=?', (rowid,))
                db.execute('INSERT INTO pages_fts(rowid,body,book_number,page) VALUES(?,?,?,?)', (rowid, ocr.search_body(body), book, page))
                db.execute('INSERT INTO search_index_state VALUES(?,?) ON CONFLICT(page_rowid) DO UPDATE SET body_hash=excluded.body_hash', (rowid, digest))
                written += 1
            db.commit()
        except BaseException:
            db.rollback()
            raise
    return written


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--watch', action='store_true', help='Follow the currently running OCR job until it stops')
    args = parser.parse_args()
    with (ARCHIVE / 'search-refresh.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('A search-index refresh is already running.')
        with sqlite3.connect(ARCHIVE / 'rostovskij-ocr.sqlite3', timeout=30) as db:
            while True:
                count = refresh(db)
                print(f'Updated search entries: {count}', flush=True)
                if not args.watch:
                    break
                if not ocr_running(ARCHIVE):
                    # Catch pages committed between the last snapshot and OCR releasing its lock.
                    print(f'Final search entries updated: {refresh(db)}', flush=True)
                    break
                time.sleep(5)


if __name__ == '__main__':
    main()
