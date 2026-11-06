import test from 'node:test';
import assert from 'node:assert/strict';
import { getSaint, searchSaints, saintCommemorations, saintVenerations } from '../src/lib/repository';
import { reviewedMentionLocations } from '../src/lib/reviewed-book-mentions';

test('Eugenia bishop has sourced reading links without merging the Egyptian monk or Hadrian', () => {
  const id = 'elij-iliopolskij-episkop-evgenii';
  assert.ok(searchSaints({ q: 'Елий Илиопольский' }).some(s => s.id === id));
  assert.ok(getSaint('ellij-egipetskij'));
  assert.ok(saintCommemorations('ellij-egipetskij').length > 0);
  assert.equal(saintCommemorations(id).length, 0);
  assert.deepEqual(saintVenerations(id).map(v => v.traditionId), ['russian-orthodox']);
  const locations = reviewedMentionLocations(id);
  assert.deepEqual(locations, [619, 620, 621, 622, 623, 624].map(page => ({ book: 4, page })));
  for (const [book, page] of [[1, 292], [4, 398], [6, 286], [11, 330], [11, 333], [11, 337]]) {
    assert.ok(!locations.some(r => r.book === book && r.page === page));
  }
});
