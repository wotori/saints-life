import test from 'node:test';
import assert from 'node:assert/strict';
import { literalPersonMatcher } from '../src/lib/literal-person-candidates';
import { personReviewQueue } from '../src/lib/person-review-queue';
import { createHash } from 'node:crypto';

test('literal search keeps original spans and codepoint offsets without matching name substrings', () => {
  const matcher = literalPersonMatcher([{ name: 'Пётр Могила', aliases: ['Петр Могила', 'Пётр'] }]);
  const body = '🙂 ПЕТР\nМогила; Петр МогилаX; XПетр Могила; Петр Могила.';
  assert.equal(matcher.spellings, 1);
  const found = matcher.find(body);
  assert.equal(found.length, 2);
  for (const row of found) for (const offset of row.offsets) assert.equal(Array.from(body).slice(offset, offset + Array.from(row.candidate).length).join(''), row.candidate);
  assert.deepEqual(found[0], { candidate: 'ПЕТР\nМогила', offsets: [2] });
  assert.deepEqual(matcher.find('Петра Могилы; Пётр'), []);
});

test('punctuation is literal and ambiguous aliases remain unreviewed in the queue', () => {
  const people = [{ id: 'a', name: 'Пётр (Могила)', aliases: ['Пётр Киевский'] }, { id: 'b', name: 'Другой Пётр', aliases: ['Пётр Киевский'] }];
  const body = 'Пётр (Могила). Пётр Киевский. Пётр Киевский.';
  const candidates = literalPersonMatcher(people).find(body).map(found => ({ ...found, book: 13, page: 1, sourceSha256: 'source', pageTextSha256: createHash('sha256').update(body).digest('hex'), chunkId: 'literal-test' }));
  const result = personReviewQueue(candidates, people, () => ({ body, sourceSha256: 'source' }));
  assert.equal(result.rejected.length, 0);
  const ambiguous = result.queue.find(group => group.spelling === 'петр киевский')!;
  assert.deepEqual(ambiguous.suggestedSaintIds, ['a', 'b']);
  assert.equal(ambiguous.status, 'unreviewed');
  assert.equal(ambiguous.occurrences.length, 2);
});
