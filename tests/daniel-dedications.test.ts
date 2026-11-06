import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSaints, saintVenerations, saintCommemorations } from '../src/lib/repository';
import { reviewedMentionLocations, reviewedMentionForPage, reviewedMentionRecords } from '../src/lib/reviewed-book-mentions';
import reviews from '../src/data/reviewed-person-candidates.json';

test('church dedications distinguish Daniel the Stylite and Arsenije from their namesakes', () => {
  const id = 'arsenij-i-serbskij';
  assert.ok(searchSaints({ q: 'Арсеније Сремац', tradition: 'serbian-orthodox' }).some(s => s.id === id));
  assert.deepEqual(saintVenerations(id).map(v => v.traditionId).sort(), ['russian-orthodox', 'serbian-orthodox']);
  assert.equal(saintCommemorations(id).length, 0);
  for (const person of [id, 'ioann-predtecha', 'nikolaj-mirlikijskij', 'daniil-stolpnik']) {
    assert.ok(reviewedMentionLocations(person).some(r => r.book === 4 && r.page === 547));
  }
  const stylite = reviews.find(r => r.book === 4 && r.page === 547 && r.text === 'Да-\nниила Столпника');
  assert.deepEqual(stylite?.saintIds, ['daniil-stolpnik']);
  assert.ok(!reviewedMentionLocations('arsenij-velikij').some(r => r.book === 4 && r.page === 547));
});

test('Pec church dedication identifies Demetrius without importing a Serbian calendar date', () => {
  const id = 'dimitrij-solunskij';
  const record = reviewedMentionRecords().find(r => r.book === 4 && r.page === 547 && (r.saintIds as readonly string[]).includes(id));
  assert.ok(record);
  assert.deepEqual(reviewedMentionForPage(id, 4, 547, record.sourceSha256, record.anchor), { book: 4, page: 547 });
  assert.equal(reviewedMentionForPage(id, 4, 547, 'different-edition', record.anchor), undefined);
  assert.equal(reviewedMentionForPage(id, 4, 547, record.sourceSha256, record.anchor.repeat(2)), undefined);
  const review = reviews.find(r => r.book === 4 && r.page === 547 && r.text === 'Димитрия');
  assert.deepEqual(review?.saintIds, [id]);
  assert.ok(saintVenerations(id).some(v => v.traditionId === 'serbian-orthodox' && v.sourceId === 'spc-pec-patriarchate'));
  assert.ok(!saintCommemorations(id).some(c => c.traditionId === 'serbian-orthodox'));
  assert.ok(!reviewedMentionLocations('dimitrij-rostovskij').some(r => r.book === 4 && r.page === 547));
});
