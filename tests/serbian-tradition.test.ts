import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSaints, saintCommemorations, saintVenerations } from '../src/lib/repository';

test('Jelena and Uros have separate Serbian evidence without inheriting dates or identities', () => {
  const id = 'elena-mat-stefana-urosha';
  for (const q of ['Елена', 'Елисавета', 'Евгения']) {
    assert.ok(searchSaints({ q, tradition: 'serbian-orthodox' }).some(s => s.id === id));
  }
  assert.deepEqual(saintVenerations(id).map(v => v.traditionId), ['serbian-orthodox']);
  assert.equal(saintCommemorations(id).length, 0);
  for (const tradition of ['russian-orthodox', 'old-believer', 'armenian-apostolic']) {
    assert.ok(!searchSaints({ q: 'Елена', tradition }).some(s => s.id === id));
  }
  assert.ok(searchSaints({ q: 'Урош', tradition: 'serbian-orthodox' }).some(s => s.id === 'stefan-urosh-serbskij'));
  assert.ok(saintCommemorations('stefan-urosh-serbskij').some(c => c.traditionId === 'russian-orthodox'));
  assert.ok(!saintCommemorations('stefan-urosh-serbskij').some(c => c.traditionId === 'serbian-orthodox'));
});
