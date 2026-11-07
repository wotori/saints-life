import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionHeadings } from '../src/lib/book-sections';

test('missing initial display heading preserves OCR and requires a separate name', () => {
  const body = 'Память святого Авраама 273\n\nАМЯТЬ СВЯТОГО\nАВРААМА,\n\nепископа Каррийского';
  assert.deepEqual(sectionHeadings(body), [{ offset: body.indexOf('АМЯТЬ'), title: 'АМЯТЬ СВЯТОГО АВРААМА,' }]);
  for (const invalid of ['АМЯТЬ СВЯТОГО АВРААМА, 273', 'АМЯТЬ СВЯТОГО\nАвраама,', 'АМЯТЬ СВЯТОГО\nАВРААМА, 273', 'В тексте АМЯТЬ СВЯТОГО\nАВРААМА,']) {
    assert.deepEqual(sectionHeadings(invalid), []);
  }
});
