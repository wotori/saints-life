import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { personReviewQueue } from '../src/lib/person-review-queue';
import { applyPersonReviews, type PersonReviewDecision } from '../src/lib/person-review-decisions';

const body = 'Иоанн и Иоанн';
const pageTextSha256 = createHash('sha256').update(body).digest('hex');
const queue = personReviewQueue([{ book: 1, page: 2, candidate: 'Иоанн', offsets: [0, 8], sourceSha256: 'pdf', pageTextSha256, chunkId: 'chunk' }], [], () => ({ body, sourceSha256: 'pdf' })).queue;
const review: PersonReviewDecision = { book: 1, page: 2, offset: 0, text: 'Иоанн', sourceSha256: 'pdf', pageTextSha256, decision: 'identity-linked', saintIds: ['person-a'], note: 'Verified in context.' };
const ids = new Set(['person-a', 'person-b']);

function prefixCase(body: string, text: string, offset: number, fullName: string) {
  const hash = createHash('sha256').update(body).digest('hex');
  const queue = personReviewQueue([{ book: 1, page: 2, candidate: text, offsets: [offset], sourceSha256: 'pdf', pageTextSha256: hash, chunkId: 'chunk' }], [], () => ({ body, sourceSha256: 'pdf' })).queue;
  return { queue, full: { ...review, offset, text: fullName, pageTextSha256: hash } };
}

test('a verified full name resolves its leading name while preserving the original decision', () => {
  const fixture = prefixCase('Иоанн Креститель и Иоанн', 'Иоанн', 0, 'Иоанн Креститель');
  const result = applyPersonReviews(fixture.queue, [fixture.full], ids);
  assert.equal(result.inheritedOccurrences, 1);
  assert.equal(result.appliedReviews, 1);
  assert.equal(result.queue[0].occurrences[0].review, fixture.full);
  assert.equal(result.queue[0].occurrences[0].reviewMatch, 'full-name-prefix');
  assert.equal(result.unusedReviews.length, 0);
  const elsewhere = prefixCase('Иоанн Креститель и Иоанн', 'Иоанн', 19, 'Иоанн Креститель');
  assert.equal(elsewhere.queue[0].occurrences.length, 1);
  assert.equal(applyPersonReviews(elsewhere.queue, [fixture.full], ids).inheritedOccurrences, 0);
});

test('prefix inheritance requires a complete literal name, word boundary and a single identity', () => {
  const fixture = prefixCase('Иоанн Креститель', 'Иоанн', 0, 'Иоанн Креститель');
  for (const changes of [
    { text: 'Иоанн Богослов' }, { sourceSha256: 'changed' }, { pageTextSha256: 'changed' },
    { saintIds: ['person-a', 'person-b'] }, { decision: 'not-person', saintIds: [] },
    { decision: 'identity-rejected', saintIds: [], rejectedSaintIds: ['person-a'] },
  ]) {
    assert.equal(applyPersonReviews(fixture.queue, [{ ...fixture.full, ...changes }], ids).inheritedOccurrences, 0);
  }
  const partial = prefixCase('Иоаннов монастырь', 'Иоанн', 0, 'Иоаннов монастырь');
  assert.equal(applyPersonReviews(partial.queue, [partial.full], ids).inheritedOccurrences, 0);
  const long = prefixCase('Иоанн ' + 'а'.repeat(300), 'Иоанн', 0, 'Иоанн ' + 'а'.repeat(300));
  assert.equal(applyPersonReviews(long.queue, [long.full], ids).inheritedOccurrences, 0);
});

test('exact decisions take precedence and competing full-name decisions remain unresolved', () => {
  const fixture = prefixCase('Иоанн Креститель', 'Иоанн', 0, 'Иоанн Креститель');
  const duplicate = applyPersonReviews(fixture.queue, [fixture.full, { ...fixture.full, saintIds: ['person-b'] }], ids);
  assert.equal(duplicate.inheritedOccurrences, 0);
  assert.equal(duplicate.queue[0].occurrences[0].review, undefined);
  const exact = { ...fixture.full, text: 'Иоанн', saintIds: ['person-b'] };
  const result = applyPersonReviews(fixture.queue, [fixture.full, exact], ids);
  assert.equal(result.queue[0].occurrences[0].review, exact);
  assert.equal(result.inheritedOccurrences, 0);
  const invalid = applyPersonReviews(fixture.queue, [fixture.full, { ...exact, note: '' }], ids);
  assert.equal(invalid.queue[0].occurrences[0].review, undefined);
});

test('prefix inheritance uses Unicode offsets and the clipped context origin', () => {
  for (const offset of [1, 181, 250]) {
    const body = '😀'.repeat(offset) + 'Иоанн Креститель';
    const fixture = prefixCase(body, 'Иоанн', offset, 'Иоанн Креститель');
    assert.equal(applyPersonReviews(fixture.queue, [fixture.full], ids).inheritedOccurrences, 1);
  }
});

test('a saved decision resolves only its occurrence, not the homonym elsewhere', () => {
  const result = applyPersonReviews(queue, [review], ids);
  assert.equal(result.appliedReviews, 1);
  assert.equal(result.queue[0].status, 'partially-reviewed');
  assert.equal(result.queue[0].occurrences[0].review?.saintIds[0], 'person-a');
  assert.equal(result.queue[0].occurrences[1].review, undefined);
  assert.equal(queue[0].status, 'unreviewed');
});

test('changed source, unknown identities, malformed decisions and duplicate records stay unresolved', () => {
  for (const changes of [{ sourceSha256: 'changed' }, { pageTextSha256: 'changed' }, { saintIds: ['missing'] }, { saintIds: [] }, { note: '' }, { decision: 'auto-approved' }]) {
    const result = applyPersonReviews(queue, [{ ...review, ...changes }], ids);
    assert.equal(result.appliedReviews, 0);
    assert.equal(result.invalidReviews.length, 1);
    assert.equal(result.queue[0].status, 'unreviewed');
  }
  const conflict = applyPersonReviews(queue, [review, { ...review, saintIds: ['person-b'] }], ids);
  assert.equal(conflict.invalidReviews.length, 2);
  assert.equal(conflict.appliedReviews, 0);
});

test('non-person decisions preserve evidence and missing occurrences remain visible as unused', () => {
  const nonPerson = { ...review, decision: 'not-person', saintIds: [] };
  const result = applyPersonReviews(queue, [nonPerson, { ...review, page: 99 }], ids);
  assert.equal(result.appliedReviews, 1);
  assert.equal(result.unusedReviews.length, 1);
  assert.equal(result.queue[0].occurrences.length, 2);
  assert.equal(result.queue[0].occurrences[0].review?.decision, 'not-person');
});

test('rejecting a homonym preserves the person mention without linking or rejecting other occurrences', () => {
  const rejection = { ...review, decision: 'identity-rejected', saintIds: [], rejectedSaintIds: ['person-a'] };
  const result = applyPersonReviews(queue, [rejection], ids);
  assert.equal(result.appliedReviews, 1);
  assert.equal(result.queue[0].status, 'partially-reviewed');
  assert.deepEqual(result.queue[0].occurrences[0].review?.saintIds, []);
  assert.deepEqual(result.queue[0].occurrences[0].review?.rejectedSaintIds, ['person-a']);
  assert.equal(result.queue[0].occurrences[1].review, undefined);
  for (const changes of [
    { rejectedSaintIds: [] }, { rejectedSaintIds: ['missing'] },
    { rejectedSaintIds: ['person-a', 'person-a'] }, { saintIds: ['person-b'] },
    { sourceSha256: 'changed' }, { pageTextSha256: 'changed' }, { note: '' },
    { decision: 'not-person' }, { decision: 'identity-linked', saintIds: ['person-b'] },
  ]) {
    const invalid = applyPersonReviews(queue, [{ ...rejection, ...changes }], ids);
    assert.equal(invalid.appliedReviews, 0);
    assert.equal(invalid.invalidReviews.length, 1);
  }
});
