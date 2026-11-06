import importlib.util
from pathlib import Path
import unittest
from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location('index_numbers', Path(__file__).resolve().parents[1] / 'scripts' / 'ocr-index-numbers.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class NumericIndexTests(unittest.TestCase):
    def test_ocr_must_preserve_original_digits(self):
        self.assertTrue(module.candidate_agrees('| 201419', 20, 419))
        self.assertTrue(module.candidate_agrees('| 20419', 20, 419))
        self.assertFalse(module.candidate_agrees('| 201419', 2, 419))
        self.assertFalse(module.candidate_agrees('| 201419', 20, 418))
        self.assertFalse(module.candidate_agrees('| undecipherable', 20, 419))

    def test_alignment_requires_one_number_per_row(self):
        row = {'top': '100', 'height': '20'}
        self.assertIs(module.nearest([row], 110, 8), row)
        self.assertIsNone(module.nearest([row, row], 110, 8))
        self.assertIsNone(module.nearest([row], 130, 8))

    def test_finds_broken_and_slightly_slanted_table_rules(self):
        image = Image.new('L', (1000, 1600), 255)
        draw = ImageDraw.Draw(image)
        for x in [350, 390, 430, 760, 800, 840]:
            draw.line((x, 250, x + 2, 1000), fill=0, width=2)
            draw.line((x + 2, 1010, x + 3, 1400), fill=0, width=2)
        draw.line((510, 250, 510, 1400), fill=0, width=2)
        rules = module.vertical_rules(image)
        self.assertIsNotNone(rules)
        self.assertEqual(len(rules), 6)
        for observed, expected in zip(rules, [350, 390, 430, 760, 800, 840]):
            self.assertLessEqual(abs(observed - expected), 4)
        draw.line((370, 250, 370, 1400), fill=0, width=2)
        self.assertIsNone(module.vertical_rules(image))


if __name__ == '__main__':
    unittest.main()
