import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSaints, saintCommemorations, saintVenerations } from '../src/lib/repository';
import { reviewedMentionLocations } from '../src/lib/reviewed-book-mentions';

test('the Serbian archbishop, Palamas teacher and Synaxarion author stay distinct', () => {
  const groups = [
    { id: 'nikodim-i-serbskij', query: 'Хиландарский', pages: [[3, 249], [3, 250], [4, 543], [4, 545], [4, 546]] },
    { id: 'nikodim-vatopedskij-nastavnik-palamy', query: 'Исихаст', pages: [[3, 368]] },
    { id: 'nikodim-svjatogorec', query: 'Синаксаря', pages: [[4, 490]] },
  ];
  for (const group of groups) {
    assert.ok(searchSaints({ q: group.query }).some(s => s.id === group.id));
    assert.equal(saintCommemorations(group.id).length, 0);
    const actual = reviewedMentionLocations(group.id);
    for (const other of groups) {
      for (const [book, page] of other.pages) {
        assert.equal(actual.some(l => l.book === book && l.page === page), group === other);
      }
    }
  }
  assert.deepEqual(saintVenerations(groups[0].id).map(v => v.traditionId), ['serbian-orthodox']);
  for (const group of groups.slice(1)) {
    assert.ok(!searchSaints({ q: 'Никодим', tradition: 'serbian-orthodox' }).some(s => s.id === group.id));
  }
});
