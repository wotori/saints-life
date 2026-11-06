import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSaints, saintCommemorations, saintVenerations } from '../src/lib/repository';
import { reviewedWorkLocations } from '../src/lib/reviewed-book-works';

test('Evagrius bishop has a separately sourced Catholic witness without borrowed calendar dates', () => {
  const id = 'evagrij-konstantinopolskij';
  assert.ok(searchSaints({ q: 'Евагрий', tradition: 'roman-catholic' }).some(s => s.id === id));
  for (const tradition of ['russian-orthodox', 'old-believer'] as const) {
    assert.ok(!searchSaints({ q: 'Евагрий', tradition }).some(s => s.id === id));
  }
  assert.deepEqual(saintVenerations(id).map(v => v.traditionId), ['roman-catholic']);
  assert.equal(saintCommemorations(id).length, 0);
  assert.ok(reviewedWorkLocations(id).some(w => w.book === 1 && w.page === 150));
  assert.ok(!reviewedWorkLocations('evagrij-s-feoduliej').some(w => w.book === 1 && w.page === 150));
});
