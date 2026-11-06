import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { personReviewQueue } from '../src/lib/person-review-queue';
import { applyPersonReviews, type PersonReviewDecision } from '../src/lib/person-review-decisions';
import { personReviewBacklog } from '../src/lib/person-review-backlog';

const body = 'Иоанн Рим Иоанн Иоанн';
const pageTextSha256 = createHash('sha256').update(body).digest('hex');
const sourceSha256 = 'pdf';
const queue = personReviewQueue([
  { book: 1, page: 1, candidate: 'Иоанн', offsets: [0, 10, 16], sourceSha256, pageTextSha256, chunkId: 'one' },
  { book: 1, page: 1, candidate: 'Рим', offsets: [6], sourceSha256, pageTextSha256, chunkId: 'one' },
  { book: 2, page: 1, candidate: 'Иоанн', offsets: [0], sourceSha256, pageTextSha256, chunkId: 'two' },
], [{ id: 'a', name: 'Иоанн А', aliases: [] }, { id: 'b', name: 'Иоанн Б', aliases: [] }],
() => ({ body, sourceSha256 })).queue;
const review: PersonReviewDecision = { book: 1, page: 1, offset: 0, text: 'Иоанн', sourceSha256,
  pageTextSha256, decision: 'identity-linked', saintIds: ['a'], note: 'Verified fixture.' };

test('backlog retains rejected identities and other homonyms while removing resolved occurrences', () => {
  const reviewed = applyPersonReviews(queue, [review,
    { ...review, offset: 6, text: 'Рим', decision: 'not-person', saintIds: [] },
    { ...review, offset: 10, decision: 'identity-rejected', saintIds: [], rejectedSaintIds: ['a'] },
  ], new Set(['a', 'b']));
  const before = JSON.stringify(reviewed);
  const result = personReviewBacklog(reviewed.queue);
  assert.deepEqual(result.summary, { totalOccurrences: 5, linkedOccurrences: 1, notPersonOccurrences: 1,
    pendingOccurrences: 3, pendingWithRejectedIdentities: 1, pendingGroups: 1 });
  assert.deepEqual(result.books.map(b => [b.book, b.pendingOccurrences]), [[1, 2], [2, 1]]);
  const occurrences = result.queue[0].occurrences;
  assert.deepEqual(occurrences.map(o => [o.book, o.offset]), [[1, 10], [1, 16], [2, 0]]);
  assert.deepEqual(occurrences[0].remainingSuggestedSaintIds, ['b']);
  assert.deepEqual(occurrences[1].remainingSuggestedSaintIds, ['a', 'b']);
  assert.equal(result.queue[0].status, 'pending');
  assert.equal(JSON.stringify(reviewed), before);
});

test('a stale review remains pending and an empty queue does not claim book coverage', () => {
  const reviewed = applyPersonReviews(queue, [{ ...review, pageTextSha256: 'outdated' }], new Set(['a', 'b']));
  assert.equal(reviewed.invalidReviews.length, 1);
  assert.equal(personReviewBacklog(reviewed.queue).summary.pendingOccurrences, 5);
  const empty = personReviewBacklog([]);
  assert.equal(empty.summary.pendingOccurrences, 0);
  assert.deepEqual(empty.books, []);
});
