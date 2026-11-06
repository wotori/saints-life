import test from 'node:test';
import assert from 'node:assert/strict';
import { saints, commemorations } from '../src/lib/repository';
import { matchesCommemoration } from '../src/lib/calendar';
import { reviewedMentionRecords } from '../src/lib/reviewed-book-mentions';

test('Gabriel has his two book dates without assigning them to other archangels', () => {
  const dates = commemorations.filter(c => c.saintId === 'gavriil-arhangel');
  assert.equal(dates.length, 2);
  for (const civil of [{ year: 2026, month: 4, day: 8 }, { year: 2026, month: 7, day: 26 }]) {
    assert.equal(dates.filter(c => matchesCommemoration(c, civil)).length, 1);
  }
  for (const id of ['rafail-arhangel', 'uriil-arhangel', 'selafiil-arhangel', 'iegudiil-arhangel', 'varahiil-arhangel']) {
    assert.equal(commemorations.filter(c => c.saintId === id).length, 0);
    assert.equal(saints.filter(s => s.id === id).length, 1);
    assert.ok(reviewedMentionRecords().some(r => (r.saintIds as readonly string[]).includes(id)));
  }
  // The martyr with Manuel remains a distinct person.
  assert.ok(saints.find(s => s.id === 'gavriil-s-manuilom'));
  assert.ok(saints.find(s => s.id === 'gavriil-arhangel'));
});
