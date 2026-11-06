import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSaints, saintCommemorations, saintVenerations } from '../src/lib/repository';
import { matchesCommemoration } from '../src/lib/calendar';
import { reviewedMentionLocations } from '../src/lib/reviewed-book-mentions';

test('Hermogenes spelling opens the patriarch without importing namesakes or another tradition', () => {
  const id = 'ermogen-moskovskij-patriarh';
  assert.ok(searchSaints({ q: 'Гермоген' }).some(s => s.id === id));
  assert.deepEqual(saintVenerations(id).map(v => v.traditionId), ['russian-orthodox']);
  const dates = saintCommemorations(id);
  for (const year of [2025, 2026]) {
    for (const [month, day] of [[3, 2], [5, 25]]) {
      for (const delta of [-1, 0, 1]) {
        assert.equal(dates.some(c => matchesCommemoration(c, { year, month, day: day + delta })), delta === 0);
      }
    }
  }
  const locations = reviewedMentionLocations(id);
  for (const [book, page] of [[1, 565], [2, 94], [5, 380], [6, 36], [6, 39]]) {
    assert.ok(locations.some(l => l.book === book && l.page === page));
  }
  for (const [book, page] of [[2, 613], [3, 107], [5, 372], [5, 373]]) {
    assert.equal(locations.some(l => l.book === book && l.page === page), false);
  }
});
