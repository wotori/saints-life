import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { nameInflectionSuggestions } from '../src/lib/name-inflection-suggestions';
import { personReviewQueue } from '../src/lib/person-review-queue';
import { applyPersonReviews } from '../src/lib/person-review-decisions';
import { personReviewBacklog } from '../src/lib/person-review-backlog';

test('regular and irregular first-name hints do not inflect whole names or invent soft-sign forms', () => {
  for (const [name, forms] of [
    ['Григорий Нисский', ['григория', 'григорию', 'григорием']],
    ['Мария', ['марии', 'марию', 'марией']],
    ['Павел', ['павла', 'павлу', 'павлом']],
    ['Лев', ['льва', 'льву', 'львом']],
    ['Пётр', ['петра', 'петру']],
    ['Лука', ['луки', 'луку']],
  ] as const) for (const form of forms) assert.ok(nameInflectionSuggestions(name).includes(form), `${name}: ${form}`);
  assert.ok(!nameInflectionSuggestions('Лука').includes('лукы'));
  assert.ok(!nameInflectionSuggestions('Павел').includes('павела'));
  assert.deepEqual(nameInflectionSuggestions('Игорь'), []);
  assert.deepEqual(nameInflectionSuggestions('John'), []);
});

test('nominative homonyms and declension hints coexist; rejection affects only its occurrence', () => {
  const body = 'Иоанна Иоанна';
  const hash = createHash('sha256').update(body).digest('hex');
  const queue = personReviewQueue([{ book: 1, page: 1, candidate: 'Иоанна', offsets: [0, 7],
    sourceSha256: 'pdf', pageTextSha256: hash, chunkId: 'chunk' }], [
    { id: 'john', name: 'Иоанн', aliases: [] }, { id: 'joanna', name: 'Иоанна', aliases: [] },
  ], () => ({ body, sourceSha256: 'pdf' })).queue;
  assert.deepEqual(queue[0].suggestedSaintIds, ['joanna']);
  assert.deepEqual(queue[0].declensionSuggestedSaintIds, ['john']);
  const reviewed = applyPersonReviews(queue, [{ book: 1, page: 1, offset: 0, text: 'Иоанна',
    sourceSha256: 'pdf', pageTextSha256: hash, decision: 'identity-rejected', saintIds: [],
    rejectedSaintIds: ['john'], note: 'Not this person in the checked context.' }], new Set(['john', 'joanna']));
  const backlog = personReviewBacklog(reviewed.queue);
  assert.equal(backlog.summary.pendingOccurrences, 2);
  assert.deepEqual(backlog.queue[0].occurrences[0].remainingDeclensionSuggestedSaintIds, []);
  assert.deepEqual(backlog.queue[0].occurrences[1].remainingDeclensionSuggestedSaintIds, ['john']);
  assert.deepEqual(backlog.queue[0].occurrences[0].remainingSuggestedSaintIds, ['joanna']);
});
