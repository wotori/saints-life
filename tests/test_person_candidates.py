import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sqlite3
import tempfile
from types import SimpleNamespace
import unittest

spec = importlib.util.spec_from_file_location('person_candidates', Path(__file__).parents[1] / 'scripts/mine-person-candidates.py')
mining = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mining)


class PersonCandidatesTest(unittest.TestCase):
    def test_book_progress_keeps_split_pages_and_invalid_chunks_distinct(self):
        inputs = [dict(id='a', book=1, page=1), dict(id='b', book=1, page=1),
                  dict(id='c', book=1, page=2), dict(id='d', book=2, page=1),
                  dict(id='e', book=2, page=2)]
        first, second = mining.book_progress(inputs, ['a', 'c'], ['b', 'd'])
        self.assertEqual(first, dict(book=1, inputChunks=3, completedChunks=2, missingChunks=1,
            invalidChunks=0, inputPages=2, fullyCheckedInputPages=1, partiallyCheckedInputPages=1, uncheckedInputPages=0))
        self.assertEqual(second, dict(book=2, inputChunks=2, completedChunks=0, missingChunks=1,
            invalidChunks=1, inputPages=2, fullyCheckedInputPages=0, partiallyCheckedInputPages=0, uncheckedInputPages=2))

    def test_book_progress_does_not_invent_unselected_books_or_pages(self):
        self.assertEqual(mining.book_progress([], [], []), [])
        inputs = [dict(id='a', book=9, page=534), dict(id='b', book=9, page=534)]
        result = mining.book_progress(inputs, ['a', 'b'], [])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['inputPages'], 1)
        self.assertEqual(result[0]['fullyCheckedInputPages'], 1)
        self.assertEqual(result[0]['completedChunks'], 2)

    def test_chunks_retain_exact_offsets_and_cover_long_pages(self):
        body = ('A' * 800 + '\n') * 20
        seen = set()
        for start, text in mining.chunks(body):
            self.assertEqual(body[start:start + len(text)], text)
            seen.update(range(start, start + len(text)))
        self.assertEqual(seen, set(range(len(body))))

    def test_checker_rejects_invented_names_and_changed_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            old_root, old_dest = mining.ROOT, mining.DEST
            try:
                mining.ROOT = Path(directory)
                mining.DEST = Path(directory) / 'reports'
                db = sqlite3.connect(mining.ROOT / 'rostovskij-ocr.sqlite3')
                db.executescript('CREATE TABLE books(number INTEGER,sha256 TEXT); CREATE TABLE pages(book_number INTEGER,page INTEGER,body TEXT);')
                body = 'Святой Иоанн встретил Петра.'
                db.execute('INSERT INTO books VALUES(1, ?)', ('edition',))
                db.execute('INSERT INTO pages VALUES(1,1,?)', (body,))
                db.commit()
                item = dict(id='a', book=1, page=1, offset=0, text=body,
                    sourceSha256='edition', pageTextSha256=mining.digest(body), sourcePath='book.pdf')
                mining.save(mining.DEST / 'test-input.json', [item, dict(item, id='pending')])
                mining.save(mining.DEST / 'test-output.json', {'a': 'Иоанн | Павел | Петр |  Иоанн'})
                args = SimpleNamespace(run='test', model='test-model')
                with contextlib.redirect_stdout(io.StringIO()):
                    mining.check(args)
                result = json.loads((mining.DEST / 'test-checked.json').read_text())
                self.assertEqual(result['acceptedCandidates'], 1)
                self.assertEqual(result['rejectedCandidates'], 2)
                self.assertEqual(result['missingChunks'], 1)
                self.assertEqual(result['candidates'][0]['offsets'], [7])
                self.assertEqual(result['candidates'][0]['status'], 'unreviewed-model-candidate')
                db.execute('UPDATE pages SET body=?', ('Changed source',))
                db.commit()
                db.close()
                with contextlib.redirect_stdout(io.StringIO()):
                    mining.check(args)
                result = json.loads((mining.DEST / 'test-checked.json').read_text())
                self.assertEqual(result['acceptedCandidates'], 0)
                self.assertEqual(result['rejected'][0]['reason'], 'source-changed')
            finally:
                mining.ROOT, mining.DEST = old_root, old_dest


if __name__ == '__main__':
    unittest.main()
