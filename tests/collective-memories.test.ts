import test from 'node:test';
import assert from 'node:assert/strict';
import { collectiveMemories, collectiveReading } from '../src/lib/collective-memories';

test('collective readings require the correct edition and unique text anchor', () => {
  const record = collectiveMemories.find(item => !item.heading)!;
  assert.equal(collectiveReading(record, record.sourceSha256, record.anchor)?.href, '/library/book/8/119');
  assert.equal(collectiveReading(record, 'other-edition', record.anchor), undefined);
  assert.equal(collectiveReading(record, record.sourceSha256, 'Other text'), undefined);
  assert.equal(collectiveReading(record, record.sourceSha256, `${record.anchor}\n${record.anchor}`), undefined);
});

test('a collective with a heading links to its own section, not an adjacent life', () => {
  const record = collectiveMemories.find(item => item.heading)!;
  const body = `ЖИТИЕ СВЯТОЙ ПУЛЬХЕРИИ\n\nПредыдущий текст.\n\n${record.anchor}\n\nобретенных в пустынной горе\n\nРассказ.`;
  assert.equal(collectiveReading(record, record.sourceSha256, body)?.href, '/library/book/1/253/work/1');
});
