import contextlib
import importlib.util
import io
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('ocr_import', ROOT / 'scripts' / 'ocr-books.py')
ocr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ocr)


class OcrImportTest(unittest.TestCase):
    def test_resume_preserves_pages_and_full_text_index(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory)
            books = [(1, archive / 'one.pdf', 2, 'hash-one'), (2, archive / 'two.pdf', 2, 'hash-two')]
            calls = []

            def recognize(book, page):
                calls.append((book[0], page))
                return book[0], page, f'Житие Димитрия книга {book[0]} страница {page}. Пафлаго-\nния', None

            def run(*arguments):
                with patch.object(sys, 'argv', ['ocr', '--workers', '1', *arguments]), contextlib.redirect_stdout(io.StringIO()):
                    ocr.main()

            with patch.object(ocr, 'ARCHIVE', archive), patch.object(ocr, 'source_books', return_value=books), patch.object(ocr, 'recognize', side_effect=recognize):
                run('--limit', '2')
                self.assertEqual(calls, [(1, 1), (2, 1)])
                run()
                self.assertEqual(calls, [(1, 1), (2, 1), (1, 2), (2, 2)])
                run()
                self.assertEqual(len(calls), 4)

                with sqlite3.connect(archive / 'rostovskij-ocr.sqlite3') as db:
                    self.assertEqual(db.execute('SELECT count(*) FROM pages').fetchone()[0], 4)
                    self.assertEqual(db.execute('SELECT count(*) FROM pages_fts WHERE pages_fts MATCH ?', ('"димитри"*',)).fetchone()[0], 4)
                    self.assertEqual(db.execute('SELECT count(*) FROM pages_fts WHERE pages_fts MATCH ?', ('пафлагония',)).fetchone()[0], 4)
                    self.assertTrue(all('Пафлаго-\nния' in body for body, in db.execute('SELECT body FROM pages')))
                    self.assertEqual(db.execute('SELECT count(*) FROM pages WHERE status=?', ('error',)).fetchone()[0], 0)

                changed = [(1, archive / 'one.pdf', 2, 'changed-hash'), books[1]]
                with patch.object(ocr, 'source_books', return_value=changed):
                    with self.assertRaisesRegex(RuntimeError, 'changed'):
                        run()


    def test_search_refresh_preserves_original_and_is_resumable(self):
        refresh_spec = importlib.util.spec_from_file_location('search_refresh', ROOT / 'scripts' / 'refresh-ocr-search.py')
        search_refresh = importlib.util.module_from_spec(refresh_spec)
        refresh_spec.loader.exec_module(search_refresh)
        with sqlite3.connect(':memory:') as db:
            db.executescript("""CREATE TABLE pages (book_number INTEGER, page INTEGER, body TEXT, status TEXT);
                CREATE VIRTUAL TABLE pages_fts USING fts5(body, book_number UNINDEXED, page UNINDEXED);""")
            body = 'Преподобный родился в Пафлаго-\nнии.'
            db.execute('INSERT INTO pages VALUES(1,1,?,?)', (body, 'ok'))
            db.execute('INSERT INTO pages_fts VALUES(?,?,?)', (body, 1, 1))
            db.commit()
            self.assertEqual(search_refresh.refresh(db), 1)
            self.assertEqual(search_refresh.refresh(db), 0)
            self.assertEqual(db.execute('SELECT count(*) FROM pages_fts WHERE pages_fts MATCH ?', ('пафлагонии',)).fetchone()[0], 1)
            self.assertEqual(db.execute('SELECT body FROM pages').fetchone()[0], body)
            db.execute('UPDATE pages SET body=?', ('Слово о Каппа-\nдокии.',))
            db.commit()
            self.assertEqual(search_refresh.refresh(db), 1)
            self.assertEqual(db.execute('SELECT count(*) FROM pages_fts WHERE pages_fts MATCH ?', ('каппадокии',)).fetchone()[0], 1)
            self.assertEqual(db.execute('SELECT count(*) FROM pages_fts WHERE pages_fts MATCH ?', ('пафлагонии',)).fetchone()[0], 0)


if __name__ == '__main__':
    unittest.main()
