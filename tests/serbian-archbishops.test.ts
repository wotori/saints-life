import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSaints, saintCommemorations, saintVenerations, getSaint } from '../src/lib/repository';
import { matchesCommemoration } from '../src/lib/calendar';
import { reviewedMentionLocations, reviewedMentionRecords, reviewedMentionForPage } from '../src/lib/reviewed-book-mentions';

test('Sava III and Eustathius II retain their own Serbian memories and book references', () => {
  const cases = [
    { id: 'savva-iii-serbskij', first: 'savva-serbskij', query: 'Сава III', day: 8, pages: [544, 545] },
    { id: 'evstafij-ii-serbskij', first: 'evstafij-serbskij', query: 'Евстатије II', day: 29, pages: [539, 540, 541] },
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
    assert.deepEqual(reviewedMentionLocations(item.id).sort((a, b) => a.page - b.page), item.pages.map(page => ({ book: 4, page })));
    for (const tradition of ['russian-orthodox', 'old-believer', 'armenian-apostolic']) {
      assert.ok(!searchSaints({ q: item.query, tradition }).some(s => s.id === item.id));
    }
  }
});

test('Milutin references stop before the later reigns in Daniel life', () => {
  const pages = reviewedMentionLocations('stefan-milutin-serbskij').filter(r => r.book === 4).map(r => r.page).sort((a, b) => a - b);
  assert.deepEqual(pages, [537, 538, 539, 540, 541, 542, 543, 544, 545]);
  assert.ok(!saintCommemorations('stefan-milutin-serbskij').some(c => matchesCommemoration(c, { year: 2026, month: 1, day: 2 })));
});

test('Sava I and Sava III on the same page require their own textual anchors', () => {
  const first = reviewedMentionRecords().find(r => r.book === 4 && r.page === 544 && (r.saintIds as readonly string[]).includes('savva-serbskij'))!;
  const third = reviewedMentionRecords().find(r => r.book === 4 && r.page === 544 && (r.saintIds as readonly string[]).includes('savva-iii-serbskij'))!;
  assert.ok(first);
  assert.ok(third);
  assert.notEqual(first.anchor, third.anchor);
  for (const [id, own, other] of [
    ['savva-serbskij', first, third],
    ['savva-iii-serbskij', third, first],
  ] as const) {
    assert.ok(reviewedMentionForPage(id, 4, 544, own.sourceSha256, own.anchor));
    assert.equal(reviewedMentionForPage(id, 4, 544, other.sourceSha256, other.anchor), undefined);
    assert.equal(reviewedMentionForPage(id, 4, 544, 'changed-edition', own.anchor), undefined);
  }
  for (const page of [540, 543, 544]) {
    assert.ok(reviewedMentionLocations('savva-serbskij').some(r => r.book === 4 && r.page === page));
  }
  assert.ok(!reviewedMentionLocations('savva-serbskij').some(r => r.book === 4 && r.page === 545));
});
