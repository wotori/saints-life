import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('bounded', Path(__file__).resolve().parents[1] / 'scripts/run-person-candidates.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class BoundedRunnerTests(unittest.TestCase):
    def test_truncated_valid_json_is_not_accepted(self):
        with self.assertRaises(ValueError):
            runner.parse_response(dict(done=True, done_reason='length', message={'content': '{"names":[]}'}))

    def test_literal_whitespace_and_deduplication(self):
        raw = dict(done=True, done_reason='stop', message={'content': json.dumps({'names': ['John\nSmith', 'John\nSmith']})})
        self.assertEqual(runner.parse_response(raw), 'John\nSmith')
        raw['message']['content'] = '{"names":[]}'
        self.assertEqual(runner.parse_response(raw), 'NONE')

    def test_invalid_shapes(self):
        for data in [{'names': 'John'}, {'names': [2]}, {'names': ['a|b']}, {'names': [], 'extra': 1}]:
            with self.assertRaises(ValueError):
                runner.parse_response(dict(done=True, done_reason='stop', message={'content': json.dumps(data)}))

    def test_resume_preserves_source_ids_and_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            original = [{'id': 'a', 'text': 'one'}, {'id': 'b', 'text': 'two'}]
            runner.save(root / 'old-input.json', original)
            runner.save(root / 'old-output.json', {'a': 'NONE', '_failed': ['b']})
            self.assertEqual(runner.prepare(root, 'new', 'old', 'model'), original[1:])
            runner.save(root / 'old-output.json', {'a': 'NONE', 'b': 'NONE'})
            self.assertEqual(runner.prepare(root, 'new', 'old', 'model'), original[1:])
            with self.assertRaises(ValueError):
                runner.prepare(root, 'new', 'old', 'other-model')

    def test_request_is_bounded_and_contains_only_text(self):
        request = runner.payload('fragment', 'model')
        self.assertEqual(request['options']['num_predict'], 1024)
        self.assertEqual(request['messages'][1]['content'], 'fragment')


if __name__ == '__main__':
    unittest.main()
