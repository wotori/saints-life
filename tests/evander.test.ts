import test from 'node:test';
import assert from 'node:assert/strict';
import { getSaint, searchSaints, saintCommemorations, saintVenerations } from '../src/lib/repository';
import { reviewedMentionLocations } from '../src/lib/reviewed-book-mentions';

test('Evander church references remain readable without inventing a life or borrowing feast dates', () => {
  const id = 'evandr-svjatoj-konstantinopolskogo-hrama';
  assert.ok(searchSaints({ q: 'Евандр' }).some(s => s.id === id));
  assert.match(getSaint(id)!.sourceLocator!, /жития.*нет/);
  assert.equal(saintCommemorations(id).length, 0);
  assert.deepEqual(saintVenerations(id).map(v => v.traditionId), ['russian-orthodox']);
  assert.deepEqual(reviewedMentionLocations(id), [{ book: 3, page: 455 }, { book: 11, page: 13 }]);
});
