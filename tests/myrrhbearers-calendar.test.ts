import test from 'node:test';
import assert from 'node:assert/strict';
import { commemorations } from '../src/lib/repository';
import { commemorationDateForDisplayYear, convertDate, fromJdn, matchesCommemoration, toJdn } from '../src/lib/calendar';

const memories = commemorations.filter(c => c.rule.kind === 'myrrhbearers');

test('Myrrhbearers Sunday follows published dates, not a fixed anniversary', () => {
  assert.equal(memories.length, 9);
  // Azbyka calendar 2025-05-04 and Nizhny Novgorod diocese 2026-04-26.
  for (const civil of [{ year: 2025, month: 5, day: 4 }, { year: 2026, month: 4, day: 26 }]) {
    for (const item of memories) {
      assert.deepEqual(convertDate(commemorationDateForDisplayYear(item, civil.year)!, 'julian', 'gregorian'), civil);
      for (const delta of [-1, 0, 1]) assert.equal(matchesCommemoration(item, fromJdn(toJdn(civil) + delta)), delta === 0);
    }
  }
  assert.equal(matchesCommemoration(memories[0], { year: 2026, month: 5, day: 4 }), false);
});

test('Myrrhbearers dates stay Sundays throughout the supported range', () => {
  for (let year = 1600; year <= 2199; year++) {
    const day = commemorationDateForDisplayYear(memories[0], year)!;
    assert.equal(toJdn(day, 'julian') % 7, 6);
    assert.ok(matchesCommemoration(memories[0], convertDate(day, 'julian', 'gregorian')));
  }
  for (const year of [1599, 2200, NaN, 2026.5]) assert.equal(commemorationDateForDisplayYear(memories[0], year), undefined);
});

test('the calendar source supports only the listed people and stated tradition', () => {
  assert.deepEqual(memories.map(c => c.saintId).sort(), ['salomija-mironositsa', 'marija-kleopova', 'marija-magdalina', 'iosif-arimafejskij', 'nikodim-pravednyj-ierusalimskij', 'tamara-tsaritsa-gruzii', 'ioanna-zhena-huzy', 'marfa-sestra-lazarja', 'marija-sestra-lazarja'].sort());
  for (const item of memories) {
    assert.equal(item.sourceId, item.saintId === 'iosif-arimafejskij' ? 'local-rostov' : 'azbyka-myrrhbearers-2025');
    assert.equal(item.traditionId, 'russian-orthodox');
  }
});
