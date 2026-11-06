import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('library_files_audit', Path(__file__).parents[1] / 'scripts/audit-library-files.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class LibraryFilesAuditTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        target = self.root / 'originals/user-books'
        target.mkdir(parents=True)
        self.ocr = sqlite3.connect(self.root / 'rostovskij-ocr.sqlite3')
        self.library = sqlite3.connect(self.root / 'library.sqlite3')
        self.addCleanup(self.ocr.close)
        self.addCleanup(self.library.close)
        self.ocr.executescript('CREATE TABLE books(number,sha256,pages); CREATE TABLE pages(book_number,page,status);')
        self.library.executescript('CREATE TABLE books(id,sha256); CREATE TABLE chapters(book_id,position,locator,body);')
        manifest = []
        for name, book in audit.EXPECTED.items():
            path = target / name
            path.write_bytes(name.encode())
            sha = audit.digest(path)
            manifest.append(dict(localPath=str(path.relative_to(self.root)), sourcePath=str(self.root / 'missing-original' / name), sha256=sha, bytes=path.stat().st_size))
            if isinstance(book, int):
                self.ocr.execute('INSERT INTO books VALUES(?,?,2)', (book, sha))
                self.ocr.executemany('INSERT INTO pages VALUES(?,?,?)', [(book, 1, 'ok'), (book, 2, 'ok')])
            elif book == 'kids-saints':
                self.library.execute('INSERT INTO books VALUES(?,?)', (book, sha))
                self.library.executemany('INSERT INTO chapters VALUES(?,?,?,?)', [(book, n, f'PDF {n}', 'text') for n in range(1, 29)])
        self.ocr.commit()
        self.library.commit()
        (self.root / 'user-books-manifest.json').write_text(json.dumps(manifest))

    def test_restored_archive_does_not_require_old_original_paths(self):
        self.assertTrue(audit.audit(self.root)['passed'])
        self.assertFalse(audit.audit(self.root, verify_originals=True)['passed'])

    def test_detects_page_gap_even_when_row_count_matches(self):
        self.ocr.execute('UPDATE pages SET page=3 WHERE book_number=1 AND page=2')
        self.ocr.commit()
        report = audit.audit(self.root)
        self.assertFalse(report['passed'])
        self.assertIn('page sequence', report['errors'][0])

    def test_detects_corrupted_copy_and_wrong_database_edition(self):
        (self.root / 'originals/user-books/rostovskij-01.pdf').write_bytes(b'corrupted')
        self.ocr.execute("UPDATE books SET sha256='another edition' WHERE number=2")
        self.ocr.commit()
        report = audit.audit(self.root)
        self.assertFalse(report['passed'])
        self.assertEqual(len(report['errors']), 2)

    def test_detects_missing_chapter_locator_and_failed_ocr(self):
        self.library.execute("UPDATE chapters SET locator='' WHERE position=1")
        self.library.commit()
        self.ocr.execute("UPDATE pages SET status='error' WHERE book_number=13 AND page=1")
        self.ocr.commit()
        report = audit.audit(self.root)
        self.assertFalse(report['passed'])
        self.assertEqual(len(report['errors']), 2)


if __name__ == '__main__':
    unittest.main()
