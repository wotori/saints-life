import test from 'node:test';
import assert from 'node:assert/strict';
import { commemorations, searchSaints, saintCommemorations } from '../src/lib/repository';
import { commemorationDateForDisplayYear, convertDate, isoDate, matchesCommemoration } from '../src/lib/calendar';

for (const saintId of ['noj-praotec', 'raav-ierihonskaja', 'nafan-prorok', 'aaron-pervosvjashhennik']) {
const item = commemorations.find(c => c.id === `${saintId}-forefathers`)!;

test(`${saintId}: Forefathers follow Sunday rather than a fixed December date`, () => {
  // Known civil Sundays covering all seven positions in December 24-30.
  for (const [year, day] of [[2017, 24], [2018, 30], [2019, 29], [2020, 27], [2021, 26], [2022, 25], [2025, 28]]) {
    const original = commemorationDateForDisplayYear(item, year)!;
    assert.equal(isoDate(convertDate(original, 'julian', 'gregorian')), `${year}-12-${day}`);
    for (let candidate = 24; candidate <= 30; candidate++) {
      assert.equal(matchesCommemoration(item, { year, month: 12, day: candidate }), candidate === day);
    }
  }
});

test(`${saintId}: Forefathers retain Julian rules after the 2100 calendar shift`, () => {
  const original = commemorationDateForDisplayYear(item, 2100)!;
  assert.deepEqual(original, { year: 2100, month: 12, day: 12 });
  const civil = convertDate(original, 'julian', 'gregorian');
  assert.equal(isoDate(civil), '2100-12-26');
  assert.ok(matchesCommemoration(item, civil));
});

}

test('Radonezh parents appear under the sourced tradition without an invented feast', () => {
  for (const id of ['kirill-radonezhskij', 'marija-radonezhskaja']) {
    assert.ok(searchSaints({ tradition: 'russian-orthodox' }).some(saint => saint.id === id));
    assert.ok(!searchSaints({ tradition: 'old-believer' }).some(saint => saint.id === id));
    assert.equal(saintCommemorations(id).length, 0);
  }
});
