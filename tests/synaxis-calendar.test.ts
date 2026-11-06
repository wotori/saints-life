import test from 'node:test';
import assert from 'node:assert/strict';
import { commemorations } from '../src/lib/repository';
import { commemorationDateForDisplayYear, convertDate, fromJdn, matchesCommemoration, toJdn } from '../src/lib/calendar';

const lent = commemorations.find(c => c.id === 'evfimij-perejaslavskij-lent')!;
const pentecost = commemorations.find(c => c.id === 'evfimij-perejaslavskij-pentecost')!;

test('synaxis Sundays follow archived OCA calendars in different Paschal years', () => {
  for (const [item, dates] of [
    [lent, [{ year: 2025, month: 3, day: 16 }, { year: 2026, month: 3, day: 8 }]],
    [pentecost, [{ year: 2025, month: 6, day: 22 }, { year: 2026, month: 6, day: 14 }]],
  ] as const) {
    for (const civil of dates) {
      assert.deepEqual(convertDate(commemorationDateForDisplayYear(item, civil.year)!, 'julian', 'gregorian'), civil);
      for (const offset of [-7, -1, 0, 1, 7]) {
        assert.equal(matchesCommemoration(item, fromJdn(toJdn(civil) + offset)), offset === 0);
      }
    }
  }
});

test('synaxis dates remain Sundays over the supported calendar range', () => {
  for (let year = 1600; year <= 2199; year++) {
    const before = commemorationDateForDisplayYear(lent, year)!;
    const after = commemorationDateForDisplayYear(pentecost, year)!;
    assert.equal(toJdn(before, 'julian') % 7, 6);
    assert.equal(toJdn(after, 'julian') % 7, 6);
    assert.equal(toJdn(after, 'julian') - toJdn(before, 'julian'), 98);
    for (const [item, date] of [[lent, before], [pentecost, after]] as const) {
      assert.ok(matchesCommemoration(item, convertDate(date, 'julian', 'gregorian')));
    }
  }
  for (const item of [lent, pentecost]) {
    for (const year of [1599, 2200, NaN, Infinity, 2026.5]) {
      assert.equal(commemorationDateForDisplayYear(item, year), undefined);
    }
  }
});

test('moving a synaxis preserves individual memories and the original veneration source', () => {
  const hilarion = commemorations.filter(c => c.saintId === 'ilarion-pecherskij-shimnik');
  assert.equal(hilarion.length, 3);
  assert.equal(hilarion.filter(c => matchesCommemoration(c, { year: 2026, month: 3, day: 8 })).length, 1);
  assert.equal(hilarion.filter(c => matchesCommemoration(c, { year: 2026, month: 11, day: 3 })).length, 1);
  assert.equal(hilarion.filter(c => matchesCommemoration(c, { year: 2026, month: 9, day: 10 })).length, 1);
  assert.ok(hilarion.every(c => c.sourceId === 'encyclopedia-hilarion-schema' && c.traditionId === 'russian-orthodox'));
  for (const item of [lent, pentecost]) {
    assert.equal(item.sourceId, 'encyclopedia-evfimij-perejaslavskij');
    assert.equal(item.traditionId, 'russian-orthodox');
  }
  assert.ok(!commemorations.some(c => c.saintId === lent.saintId && c.traditionId === 'old-believer'));
});
