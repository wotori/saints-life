import test from 'node:test';
import assert from 'node:assert/strict';
import { commemorations, saints } from '../src/lib/repository';
import { matchesCommemoration } from '../src/lib/calendar';

test('nine Persian prisoners retain their common feast rather than their death date', () => {
  const group = saints.filter(s => s.id.endsWith('-s-ionoj-persidskim'));
  assert.equal(group.length, 9);
  for (const saint of group) {
    const dates = commemorations.filter(c => c.saintId === saint.id);
    assert.equal(dates.length, 1);
    assert.equal(dates[0].sourceId, 'synaxarion-nine-persian-martyrs');
    assert.equal(matchesCommemoration(dates[0], { year: 2026, month: 4, day: 10 }), true);
    assert.equal(matchesCommemoration(dates[0], { year: 2026, month: 4, day: 9 }), false);
  }
  assert.ok(saints.some(s => s.id === 'maruf-mesopotamskij'));
  assert.ok(saints.some(s => s.id === 'lazar-chetverodnevnyj'));
});
