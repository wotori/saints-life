import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { personReviewQueue, type NameCandidate } from '../src/lib/person-review-queue';

const body = '📖 Иоанн говорил. Иоанна слушали.';
const candidate: NameCandidate = { book: 1, page: 2, candidate: 'Иоанн', offsets: [2], sourceSha256: 'edition', pageTextSha256: createHash('sha256').update(body).digest('hex'), chunkId: 'chunk-a' };
const page = () => ({ body, sourceSha256: 'edition' });
const people = [{ id: 'one', name: 'Иоанн Первый', aliases: ['Иоанн'] }, { id: 'two', name: 'Иоанн Второй', aliases: ['Иоанн'] }];

test('homonyms stay ambiguous; overlapping chunks deduplicate occurrences while preserving evidence', () => {
  const report = personReviewQueue([candidate, { ...candidate, chunkId: 'chunk-b' }], people, page);
  assert.equal(report.rejected.length, 0);
  assert.equal(report.queue.length, 1);
  assert.equal(report.queue[0].status, 'unreviewed');
  assert.equal(report.queue[0].spellingMatch, 'ambiguous');
  assert.deepEqual(report.queue[0].suggestedSaintIds, ['one', 'two']);
  assert.equal(report.queue[0].occurrences.length, 1);
  assert.deepEqual(report.queue[0].occurrences[0].chunkIds, ['chunk-a', 'chunk-b']);
  assert.ok(report.queue[0].occurrences[0].context.startsWith('📖'));
});

test('source drift and invalid offsets cannot enter the review queue', () => {
  for (const changed of [{ sourceSha256: 'other' }, { pageTextSha256: 'other' }, { offsets: [-1] }, { offsets: [3] }, { offsets: [] }]) {
    const report = personReviewQueue([{ ...candidate, ...changed }], people, page);
    assert.equal(report.queue.length, 0);
    assert.equal(report.rejected.length, 1);
  }
});

test('declension hints remain separate from spelling matches and never approve identity', () => {
  const one = personReviewQueue([candidate], people.slice(0, 1), page).queue[0];
  assert.equal(one.spellingMatch, 'single');
  assert.equal(one.status, 'unreviewed');
  const inflected = { ...candidate, candidate: 'Иоанна', offsets: [17] };
  const result = personReviewQueue([inflected], people, page);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.queue[0].spellingMatch, 'none');
  assert.deepEqual(result.queue[0].suggestedSaintIds, []);
  assert.deepEqual(result.queue[0].declensionSuggestedSaintIds, ['one', 'two']);
  assert.equal(result.queue[0].status, 'unreviewed');
});

test('bare names can suggest homonyms without pretending to match a full name', () => {
  const report = personReviewQueue([candidate], people.map(person => ({ ...person, aliases: [] })), page);
  assert.deepEqual(report.queue[0].suggestedSaintIds, ['one', 'two']);
  assert.equal(report.queue[0].suggestionBasis, 'first-name-only');
  assert.equal(report.queue[0].spellingMatch, 'ambiguous');
  assert.equal(report.queue[0].status, 'unreviewed');
  const mixedAliases = personReviewQueue([candidate], [people[0], { ...people[1], aliases: [] }], page);
  assert.deepEqual(mixedAliases.queue[0].suggestedSaintIds, ['one', 'two']);
});

test('alias first names and their inflections remain unreviewed hints and retain homonyms', () => {
  const text = '😀 Кельсий и Кельсием.';
  const hash = createHash('sha256').update(text).digest('hex');
  const input = ['Кельсий', 'Кельсием'].map(value => ({ ...candidate, candidate: value,
    pageTextSha256: hash, offsets: [Array.from(text.slice(0, text.indexOf(value))).length] }));
  const catalogue = [
    { id: 'one', name: 'Келсий Медиоланский', aliases: ['Кельсий Медиоланский', 'Кельсий Медиоланский'] },
    { id: 'two', name: 'Кельсий Другой', aliases: [] },
  ];
  const report = personReviewQueue(input, catalogue, () => ({ body: text, sourceSha256: 'edition' }));
  assert.equal(report.rejected.length, 0);
  const nominative = report.queue.find(row => row.spelling === 'кельсий')!;
  assert.deepEqual(nominative.suggestedSaintIds, ['one', 'two']);
  assert.equal(nominative.suggestionBasis, 'first-name-only');
  assert.equal(nominative.spellingMatch, 'ambiguous');
  const inflected = report.queue.find(row => row.spelling === 'кельсием')!;
  assert.deepEqual(inflected.suggestedSaintIds, []);
  assert.deepEqual(inflected.declensionSuggestedSaintIds, ['one', 'two']);
  assert.equal(inflected.spellingMatch, 'none');
  for (const row of report.queue) assert.equal(row.status, 'unreviewed');
});

test('alias inflections do not turn a partial multiword spelling into an exact alias match', () => {
  const text = 'Руффины, матери';
  const input = { ...candidate, candidate: text, offsets: [0], pageTextSha256: createHash('sha256').update(text).digest('hex') };
  const report = personReviewQueue([input], [{ id: 'one', name: 'Руфина, мать Маманта', aliases: ['Руффина, мать Маманта'] }], () => ({ body: text, sourceSha256: 'edition' }));
  assert.deepEqual(report.queue[0].suggestedSaintIds, []);
  assert.deepEqual(report.queue[0].declensionSuggestedSaintIds, []);
  assert.equal(report.queue[0].status, 'unreviewed');
});
