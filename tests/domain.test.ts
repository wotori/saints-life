import test from 'node:test';
import assert from 'node:assert/strict';
import { commemorations, editions, getSaint, readings, saints, searchSaints, sources, venerations, works } from '../src/lib/repository';
import { convertDate, daysInMonth, fromJdn, isValidDate, matchesCommemoration, monthCells, parseDate, toJdn } from '../src/lib/calendar';

test('Julian feast converts to the civil day without relying on a fixed 13-day offset', () => {
  assert.deepEqual(convertDate({ year: 2026, month: 10, day: 26 }, 'julian', 'gregorian'), { year: 2026, month: 11, day: 8 });
  assert.deepEqual(convertDate({ year: 2100, month: 10, day: 26 }, 'julian', 'gregorian'), { year: 2100, month: 11, day: 9 });
  assert.deepEqual(convertDate({ year: 2026, month: 12, day: 25 }, 'julian', 'gregorian'), { year: 2027, month: 1, day: 7 });
});

test('leap years and weekday placement use each calendar system', () => {
  assert.equal(daysInMonth(2100, 2, 'julian'), 29);
  assert.equal(daysInMonth(2100, 2, 'gregorian'), 28);
  assert.deepEqual(monthCells(2026, 11, 'gregorian')[6].display, { year: 2026, month: 11, day: 1 });
  assert.equal(monthCells(2026, 11, 'gregorian').length, 42);
  for (const calendar of ['gregorian', 'julian'] as const) {
    for (const year of [1601, 1700, 1900, 2000, 2026, 2100, 2198]) {
      for (const month of [1, 2, 3, 12]) {
        const date = { year, month, day: daysInMonth(year, month, calendar) };
        assert.deepEqual(fromJdn(toJdn(date, calendar), calendar), date);
      }
    }
  }
});

test('untrusted calendar dates are validated, not silently normalized', () => {
  assert.equal(parseDate('2026-02-30'), null);
  assert.equal(parseDate('2026-00-10'), null);
  assert.equal(parseDate('oops'), null);
  assert.equal(parseDate('2024-02-29')?.day, 29);
  assert.equal(isValidDate({ year: 2026, month: 2, day: Number.NaN }), false);
});

test('Dmitry and Dimitry aliases and diacritics find the same 68 directory entries', () => {
  assert.equal(searchSaints({ q: 'Дмитрий' }).length, 68);
  assert.equal(searchSaints({ q: 'Дими́трий' }).length, 68);
  assert.equal(searchSaints({ q: 'Дмитрий Солунский' })[0].id, 'dimitrij-solunskij');
  assert.equal(searchSaints({ q: 'неизвестноеимя' }).length, 0);
});

test('veneration filters are explicit, and an orthodox record never implies an Old Believer claim', () => {
  const ids = searchSaints({ tradition: 'old-believer' }).map(s => s.id).sort();
  assert.deepEqual(ids, ['avvakum-petrov', 'dimitrij-solunskij']);
  assert.equal(searchSaints({ q: 'Дмитрий', tradition: 'old-believer' }).length, 1);
  assert.equal(searchSaints({ reading: 'yes' }).length, 7);
  assert.equal(searchSaints({ rank: 'преподобный' }).length, 3);
});

test('same-name records retain independent identities', () => {
  assert.equal(searchSaints({ q: 'Розанов' }).length, 3);
  assert.equal(searchSaints({ q: 'Троицкий' }).length, 2);
  assert.notEqual(getSaint('dimitrij-uglichskij')?.id, getSaint('dimitrij-uglichskij-priluckij')?.id);
});

test('all catalog relationships resolve and external editions never masquerade as local texts', () => {
  for (const collection of [saints, commemorations, sources, works, editions, readings]) assert.equal(new Set(collection.map(item => item.id)).size, collection.length);
  for (const s of saints) assert.ok(sources.some(source => source.id === s.sourceId));
  for (const claim of [...venerations, ...commemorations]) {
    assert.ok(saints.some(s => s.id === claim.saintId));
    assert.ok(sources.some(s => s.id === claim.sourceId));
  }
  for (const r of readings) {
    const edition = editions.find(e => e.id === r.editionId)!;
    assert.ok(edition);
    assert.ok(works.some(w => w.id === edition.workId));
    edition.sourceIds.forEach(id => assert.ok(sources.some(s => s.id === id)));
    if (r.mode === 'external') {
      assert.equal(edition.rights, 'external-only');
      assert.equal(r.sections.length, 0);
    } else assert.ok(r.sections.length > 0);
  }
});

test('calendar matches shared feasts without including unresolved movable dates', () => {
  const hits = commemorations.filter(c => matchesCommemoration(c, { year: 2026, month: 11, day: 8 }));
  assert.equal(hits.filter(c => c.saintId === 'dimitrij-solunskij').length, 2);
  assert.ok(hits.some(c => c.saintId === 'dimitrij-basarbovskij'));
  assert.ok(hits.some(c => c.saintId === 'dimitrij-samopozhertvovatel'));
  const unresolved = commemorations.find(c => c.rule.kind === 'unresolved')!;
  assert.equal(matchesCommemoration(unresolved, { year: 2026, month: 2, day: 8 }), false);
});
