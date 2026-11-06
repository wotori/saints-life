import test from 'node:test';
import assert from 'node:assert/strict';
import { getSaint } from '../src/lib/repository';
import { reviewedMentionLocations } from '../src/lib/reviewed-book-mentions';
import reviews from '../src/data/reviewed-person-candidates.json';

test('Roman introduction preserves the printed spelling and identifies Clement only in its context', () => {
  const id = 'kliment-rimskij-papa';
  const saint = getSaint(id);
  assert.match(saint?.sourceLocator ?? '', /редакционно/);
  assert.ok(!saint?.aliases.includes('Климеин'));
  assert.deepEqual(reviews.find(r => r.book === 1 && r.page === 9 && r.text === 'Климеин')?.saintIds, [id]);
  assert.ok(reviewedMentionLocations(id).some(r => r.book === 1 && r.page === 9));
  for (const other of ['kliment-ankirskij', 'kliment-sardikijskij-apostol']) {
    assert.ok(!reviewedMentionLocations(other).some(r => r.book === 1 && r.page === 9));
  }
});

test('Aventine Boniface dedication is separate from the bishop and the governor converted by Pancratius', () => {
  const id = 'vonifatij-tarsijskij';
  assert.ok(reviewedMentionLocations(id).some(r => r.book === 7 && r.page === 330));
  assert.match(getSaint(id)?.sourceLocator ?? '', /cathedral.kz/);
  const rejected = reviews.find(r => r.book === 11 && r.page === 178 && r.text === 'Бонифатий');
  assert.equal(rejected?.decision, 'identity-rejected');
  assert.deepEqual(rejected?.rejectedSaintIds, [id, 'vonifatij-ferentijskij']);
  for (const other of [id, 'vonifatij-ferentijskij']) {
    assert.ok(!reviewedMentionLocations(other).some(r => r.book === 11 && r.page === 178));
  }
});
