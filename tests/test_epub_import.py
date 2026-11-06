import contextlib
import importlib.util
import io
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('epub_import', ROOT / 'scripts' / 'import-epub.py')
epub = importlib.util.module_from_spec(spec)
spec.loader.exec_module(epub)


def make_epub(path, suffix=''):
    opf = '''<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <metadata><dc:title>Жития. Том 1</dc:title><dc:publisher>Издатель</dc:publisher><dc:date>2011</dc:date></metadata>
      <manifest><item id="one" href="one.html"/><item id="trial" href="trial.html"/></manifest>
      <spine><itemref idref="one"/><itemref idref="trial"/></spine></package>'''
    ncx = '''<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap>
      <navPoint><navLabel><text>Первый святой</text></navLabel><content src="one.html#a"/></navPoint>
      <navPoint><navLabel><text>Второй святой</text></navLabel><content src="one.html#b"/></navPoint>
      </navMap></ncx>'''
    body = f'<html><head><title>Служебный текст</title></head><body><h2 id="a">Первый святой</h2><p>Первое житие {suffix}.</p><h2 id="b">Второй святой</h2><p>Второе житие.</p></body></html>'
    with zipfile.ZipFile(path, 'w') as archive:
        archive.writestr('content.opf', opf)
        archive.writestr('toc.ncx', ncx)
        archive.writestr('one.html', body)
        archive.writestr('trial.html', '<html><body><span id="litres_trial_promo"></span>Конец фрагмента</body></html>')


class EpubImportTest(unittest.TestCase):
    def test_boundaries_provenance_and_conflicting_edition(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first, second, db = root / 'one.epub', root / 'two.epub', root / 'library.sqlite3'
            make_epub(first)
            make_epub(second, 'другое издание')

            def run(source):
                with patch.object(sys, 'argv', ['import-epub', str(source), '--db', str(db)]), contextlib.redirect_stdout(io.StringIO()):
                    epub.main()

            run(first)
            with sqlite3.connect(db) as connection:
                chapters = connection.execute('SELECT title,locator,body FROM chapters ORDER BY position').fetchall()
                self.assertEqual(len(chapters), 2)
                self.assertIn('Первое житие', chapters[0][2])
                self.assertNotIn('Второе житие', chapters[0][2])
                self.assertNotIn('Конец фрагмента', chapters[1][2])
                self.assertEqual(chapters[1][1], 'one.html#b')
                self.assertIn('Ознакомительный', connection.execute('SELECT rights FROM books').fetchone()[0])
            with self.assertRaisesRegex(ValueError, 'different SHA-256'):
                run(second)
            with sqlite3.connect(db) as connection:
                self.assertEqual(connection.execute('SELECT count(*) FROM chapters').fetchone()[0], 2)


if __name__ == '__main__':
    unittest.main()
