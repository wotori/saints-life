import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSaints, saintCommemorations, saintVenerations, getSaint } from '../src/lib/repository';
import { matchesCommemoration } from '../src/lib/calendar';
import { reviewedMentionLocations } from '../src/lib/reviewed-book-mentions';

test('Sava III and Eustathius II retain their own Serbian memories and book references', () => {
  const cases = [
    { id: 'savva-iii-serbskij', first: 'savva-serbskij', query: 'Сава III', day: 8, pages: [544, 545] },
    { id: 'evstafij-ii-serbskij', first: 'evstafij-serbskij', query: 'Евстатије II', day: 29, pages: [539, 540] },
  ];
  for (const item of cases) {
    assert.ok(getSaint(item.first));
    assert.ok(searchSaints({ q: item.query, tradition: 'serbian-orthodox' }).some(s => s.id === item.id));
    assert.deepEqual(saintVenerations(item.id).map(v => v.traditionId), ['serbian-orthodox']);
    const dates = saintCommemorations(item.id);
    assert.equal(dates.length, 1);
    assert.equal(dates[0].traditionId, 'serbian-orthodox');
    for (const year of [2025, 2026]) {
      for (const delta of [-1, 0, 1]) {
        assert.equal(matchesCommemoration(dates[0], { year, month: 8, day: item.day + delta }), delta === 0);
      }
      assert.equal(matchesCommemoration(dates[0], { year, month: 1, day: 2 }), false);
    }
    assert.deepEqual(reviewedMentionLocations(item.id), item.pages.map(page => ({ book: 4, page })));
    for (const tradition of ['russian-orthodox', 'old-believer', 'armenian-apostolic']) {
      assert.ok(!searchSaints({ q: item.query, tradition }).some(s => s.id === item.id));
    }
  }
});
