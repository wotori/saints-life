import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { reviewedWorkPersons } from '../src/lib/reviewed-work-person-coverage';

test('full person review requires an explicit record, intact contiguous pages and the exact linked roster', () => {
  const heading = 'ПАМЯТЬ СВЯТОЙ ФИВЫ';
  const body = heading + '\n\nСвятая Фива. Апостол Павел.';
  const ids = ['fiva', 'pavel'];
  const known = new Set(ids);
  const r = { book: 1, page: 10, heading, sourceSha256: 'edition', saintIds: ids, note: 'Reviewed full passage.', pages: [{ page: 10, sha256: createHash('sha256').update(body).digest('hex') }] };
  const check = (reviews = [r], linked = ids, sha = 'edition', read: (page: number) => string | undefined = () => body, catalogue = known) =>
    reviewedWorkPersons(1, 10, heading, sha, read, linked, catalogue, reviews);
  assert.equal(check(), r);
  assert.equal(check([]), undefined);
  assert.equal(check([r, r]), undefined);
  assert.equal(check([r], ['fiva']), undefined);
  assert.equal(check([r], [...ids, 'other']), undefined);
  assert.equal(check([r], ids, 'another-edition'), undefined);
  assert.equal(check([r], ids, 'edition', () => undefined), undefined);
  assert.equal(check([r], ids, 'edition', () => body + 'changed'), undefined);
  assert.equal(check([r], ids, 'edition', () => body, new Set(['fiva'])), undefined);
  assert.equal(check([{ ...r, saintIds: ['fiva', 'fiva'] }]), undefined);
  assert.equal(check([{ ...r, pages: [] }]), undefined);
  assert.equal(check([{ ...r, pages: [r.pages[0], { ...r.pages[0], page: 12 }] }]), undefined);
});
