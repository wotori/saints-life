import test from 'node:test';
import assert from 'node:assert/strict';
import { commemorations } from '../src/lib/repository';
import { commemorationDateForDisplayYear, convertDate, fromJdn, isoDate, matchesCommemoration, toJdn } from '../src/lib/calendar';

const item = commemorations.find(c => c.id === 'dometian-palestinskij-memory')!;

test('Cheesefare Saturday follows published dates and excludes adjacent days', () => {
  // OCA daily calendars, archived with the source review.
  for (const [year, month, day] of [[2025, 3, 1], [2026, 2, 21]]) {
    const civil = { year, month, day };
    assert.equal(isoDate(convertDate(commemorationDateForDisplayYear(item, year)!, 'julian', 'gregorian')), isoDate(civil));
    for (const offset of [-1, 0, 1]) {
      assert.equal(matchesCommemoration(item, fromJdn(toJdn(civil) + offset)), offset === 0);
    }
  }
});

test('Cheesefare remains Saturday across the supported range and calendar century shifts', () => {
  for (let year = 1600; year <= 2199; year++) {
    const original = commemorationDateForDisplayYear(item, year)!;
    const civil = convertDate(original, 'julian', 'gregorian');
    assert.equal(toJdn(civil) % 7, 5);
    assert.ok(matchesCommemoration(item, civil));
  }
  assert.equal(commemorationDateForDisplayYear(item, 2200), undefined);
  assert.equal(commemorationDateForDisplayYear(item, NaN), undefined);
});

test('the sourced memory does not assign Domitian to another tradition', () => {
  const memories = commemorations.filter(c => c.saintId === item.saintId);
  assert.equal(memories.length, 1);
  assert.equal(item.traditionId, 'russian-orthodox');
  assert.equal(item.sourceId, 'local-rostov');
});

test('book footnotes keep shared Cheesefare and individual Passarion memories separate', () => {
  for (const id of ['palladij-elenopolskij', 'daniil-skitskij-nastavnik-andronika', 'passarion-palestinskij', 'serid-gazskij']) {
    const memories = commemorations.filter(c => c.saintId === id);
    assert.equal(memories.filter(c => matchesCommemoration(c, { year: 2026, month: 2, day: 21 })).length, 1);
    assert.ok(memories.every(c => c.traditionId === 'russian-orthodox' && c.sourceId === 'local-rostov'));
    assert.equal(memories.some(c => matchesCommemoration(c, { year: 2026, month: 8, day: 24 })), id === 'passarion-palestinskij');
  }
});
