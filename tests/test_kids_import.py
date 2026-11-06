import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('kids_import', ROOT / 'scripts' / 'import-kids-pdf.py')
kids = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kids)


class KidsImportTest(unittest.TestCase):
    def test_chapter_boundaries_and_page_numbers(self):
        titles = [f'Святой номер {i}' for i in range(10)]
        contents = '\n'.join('     ' + title for title in titles)
        bodies = '\f'.join(title + '\n\nТекст жития ' + str(i) + '.' for i, title in enumerate(titles))
        text = '\fВведение\n' + contents + '\n\f' + bodies + '\f'
        chapters = kids.extract_chapters(text)
        self.assertEqual(len(chapters), 10)
        self.assertEqual(chapters[0][1], 'страницы PDF 3-3')
        self.assertIn('Текст жития 0.', chapters[0][2])
        self.assertNotIn('Текст жития 1.', chapters[0][2])
        self.assertIn('Текст жития 9.', chapters[-1][2])

    def test_duplicate_heading_is_rejected(self):
        titles = [f'Святой номер {i}' for i in range(10)]
        contents = '\n'.join('     ' + title for title in titles)
        bodies = '\f'.join(title + '\nТекст' for title in titles)
        with self.assertRaisesRegex(ValueError, 'Expected one contents entry'):
            kids.extract_chapters('\f' + contents + '\n\f' + bodies + '\n' + titles[0])


if __name__ == '__main__':
    unittest.main()
