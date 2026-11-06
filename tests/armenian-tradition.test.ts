import test from 'node:test';
import assert from 'node:assert/strict';
import { commemorations, searchSaints, venerations } from '../src/lib/repository';

test('Abgar has only the documented Armenian veneration and no annual date inferred from 2012', () => {
  const id = 'avgar-v-edesskij';
  assert.ok(searchSaints({ tradition: 'armenian-apostolic', q: 'Абгар' }).some(s => s.id === id));
  for (const tradition of ['russian-orthodox', 'old-believer']) {
    assert.ok(!searchSaints({ tradition, q: 'Авгарь' }).some(s => s.id === id));
  }
  assert.deepEqual(venerations.filter(v => v.saintId === id).map(v => [v.traditionId, v.sourceId]), [['armenian-apostolic', 'armenian-abgar-2012']]);
  assert.equal(commemorations.filter(c => c.saintId === id).length, 0);
});
