import test from 'node:test';
import assert from 'node:assert/strict';
import { getSaint } from '../src/lib/repository';
import { reviewedMentionLocations } from '../src/lib/reviewed-book-mentions';
import reviews from '../src/data/reviewed-person-candidates.json';

test('Sardica editorial identification preserves the book spelling and separates namesakes', () => {
  const saint = getSaint('osija-korduvijskij')!;
  assert.match(saint.sourceLocator!, /редакционно отождествлено/);
  assert.ok(!saint.aliases.includes('Кудровий'));
  assert.ok(reviewedMentionLocations(saint.id).some(r => r.book === 3 && r.page === 110));
  for (const id of ['osija-prorok', 'protogen-karrijskij']) {
    assert.ok(!reviewedMentionLocations(id).some(r => r.book === 3 && r.page === 110));
  }
  const rejected = reviews.find(r => r.book === 3 && r.page === 110 && r.text === 'Протоген');
  assert.equal(rejected?.decision, 'identity-rejected');
  assert.deepEqual(rejected?.rejectedSaintIds, ['protogen-karrijskij']);
});
