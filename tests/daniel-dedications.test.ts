import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSaints, saintVenerations, saintCommemorations } from '../src/lib/repository';
import { reviewedMentionLocations } from '../src/lib/reviewed-book-mentions';
import reviews from '../src/data/reviewed-person-candidates.json';

test('church dedications distinguish Daniel the Stylite and Arsenije from their namesakes', () => {
  const id = 'arsenij-i-serbskij';
  assert.ok(searchSaints({ q: 'Арсеније Сремац', tradition: 'serbian-orthodox' }).some(s => s.id === id));
  assert.deepEqual(saintVenerations(id).map(v => v.traditionId).sort(), ['russian-orthodox', 'serbian-orthodox']);
  assert.equal(saintCommemorations(id).length, 0);
  for (const person of [id, 'ioann-predtecha', 'nikolaj-mirlikijskij', 'daniil-stolpnik']) {
    assert.ok(reviewedMentionLocations(person).some(r => r.book === 4 && r.page === 547));
  }
  const stylite = reviews.find(r => r.book === 4 && r.page === 547 && r.text === 'Да-\nниила Столпника');
  assert.deepEqual(stylite?.saintIds, ['daniil-stolpnik']);
  assert.ok(!reviewedMentionLocations('arsenij-velikij').some(r => r.book === 4 && r.page === 547));
});
