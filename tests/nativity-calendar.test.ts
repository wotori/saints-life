import test from 'node:test';
import assert from 'node:assert/strict';
import { commemorations, primaryFeast } from '../src/lib/repository';
import { commemorationDateForDisplayYear, convertDate, isoDate, matchesCommemoration } from '../src/lib/calendar';

test('Fathers after Nativity cover all seven Christmas weekdays and the Sunday exception', () => {
  const items = commemorations.filter(c => c.rule.kind === 'after-nativity');
  assert.equal(items.length, 6);
  // Independently known civil dates: Monday through Sunday Christmas, respectively.
  for (const [year, day] of [[2019, 13], [2025, 12], [2026, 11], [2021, 10], [2022, 9], [2023, 8], [2024, 8]]) {
    for (const item of items) {
      const original = commemorationDateForDisplayYear(item, year)!;
      assert.equal(original.year, year - 1);
      assert.equal(isoDate(convertDate(original, 'julian', 'gregorian')), `${year}-01-${String(day).padStart(2, '0')}`);
      for (let candidate = 7; candidate <= 14; candidate++) {
        assert.equal(matchesCommemoration(item, { year, month: 1, day: candidate }), candidate === day);
      }
    }
  }
  assert.equal(primaryFeast('david-car-prorok', 2024), '8 января');
  assert.equal(primaryFeast('iosif-obruchnik', 2026), '11 января');
});

test('Fathers use Julian dates across the 2100 calendar difference change', () => {
  const item = commemorations.find(c => c.rule.kind === 'after-nativity')!;
  const original = commemorationDateForDisplayYear(item, 2101)!;
  const civil = convertDate(original, 'julian', 'gregorian');
  assert.equal(civil.year, 2101);
  assert.equal(isoDate(civil), '2101-01-09');
  assert.ok(matchesCommemoration(item, civil));
  assert.deepEqual(convertDate(civil, 'gregorian', 'julian'), original);
});
