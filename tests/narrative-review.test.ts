import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { narrativeReviewMatches } from '../src/lib/reviewed-narrative-occurrences';

const anchor = 'В тот же день пришел посетитель.';
const body = `Рассказ.\n${anchor}\nПродолжение.`;
const page = { book: 1, page: 10, sourceSha256: 'edition-a', body };
const record = { ...page, anchor, note: 'Продолжение рассказа.', pageTextSha256: createHash('sha256').update(body).digest('hex') };

test('narrative review is invalidated by edition, location or OCR context changes', () => {
  assert.equal(narrativeReviewMatches(record, page), true);
  for (const changed of [{ sourceSha256: 'edition-b' }, { book: 2 }, { page: 11 }, { body: body + '\nНовый текст.' }, { body: 'Иной текст.' }]) {
    assert.equal(narrativeReviewMatches(record, { ...page, ...changed }), false);
  }
});

test('duplicate or non-line-start anchors cannot validate even with matching text checksum', () => {
  for (const changedBody of [`${body}\n${anchor}`, `Префикс ${anchor}`]) {
    const changedRecord = { ...record, pageTextSha256: createHash('sha256').update(changedBody).digest('hex') };
    assert.equal(narrativeReviewMatches(changedRecord, { ...page, body: changedBody }), false);
  }
  assert.equal(narrativeReviewMatches({ ...record, note: '' }, page), false);
  assert.equal(narrativeReviewMatches({ ...record, anchor: '' }, page), false);
});
