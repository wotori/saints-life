import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { reviewedSectionType } from '../src/lib/reviewed-book-section-types';

const heading = 'ПОВЕСТЬ О ТАКСИОТЕ ВОИНЕ';
const pages = new Map([[10, `${heading}\n\nНачало рассказа.`], [11, 'Продолжение рассказа.']]);
const review = { book: 7, page: 10, heading, sourceSha256: 'edition-a', kind: 'edifying-narrative', label: 'Назидательное повествование', note: 'Имя не устанавливает дату памяти.', personCoverage: 'unresolved', pages: [...pages].map(([page, body]) => ({ page, sha256: createHash('sha256').update(body).digest('hex') })) };

test('section classification requires its edition and every reviewed page, not only its heading', () => {
  const lookup = (page: number) => pages.get(page);
  assert.equal(reviewedSectionType(7, 10, heading, 'edition-a', lookup, [review]), review);
  assert.equal(reviewedSectionType(7, 10, heading, 'edition-b', lookup, [review]), undefined);
  assert.equal(reviewedSectionType(7, 10, heading, 'edition-a', p => p === 11 ? undefined : lookup(p), [review]), undefined);
  assert.equal(reviewedSectionType(7, 10, heading, 'edition-a', p => p === 11 ? 'Изменённый текст.' : lookup(p), [review]), undefined);
  assert.equal(reviewedSectionType(7, 10, heading, 'edition-a', lookup, [review, review]), undefined);
});
