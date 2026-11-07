import test from 'node:test';
import assert from 'node:assert/strict';
import { saints } from '../src/lib/repository';
import { reviewedMentionRecords } from '../src/lib/reviewed-book-mentions';
import works from '../src/data/reviewed-book-work-links.json';
import seventy from '../src/data/reviewed-seventy-apostles.json';
import { reviewedSaintLinkErrors } from '../src/lib/reviewed-saint-links';

const knownIds = new Set(saints.map(saint => saint.id));

test('reviewed references reject a plausible but nonexistent saint ID', () => {
  assert.deepEqual(reviewedSaintLinkErrors([
    { book: 7, page: 665, saintIds: ['petr-apostol'] },
  ], knownIds, 'mention'), ['Unknown saint "petr-apostol": mention: 7/665']);
  assert.deepEqual(reviewedSaintLinkErrors([
    { book: 7, page: 665, saintIds: ['petr-apostol-pervoverhovnyj'] },
  ], knownIds, 'mention'), []);
});

test('reviewed references reject empty links and duplicate people within a record', () => {
  assert.deepEqual(reviewedSaintLinkErrors([
    { book: 1, page: 2, saintIds: [] },
    { book: 1, page: 3, saintIds: ['known', 'known'] },
  ], new Set(['known']), 'work'), [
    'Empty saint links: work: 1/2',
    'Duplicate saint "known": work: 1/3',
  ]);
});

test('every stored work and mention resolves to an existing catalogue person', () => {
  assert.deepEqual(reviewedSaintLinkErrors(works.works, knownIds, 'work'), []);
  assert.deepEqual(reviewedSaintLinkErrors(reviewedMentionRecords(), knownIds, 'mention'), []);
});

test('seventy apostles text links include reviewed secondary people without expanding the main roster', () => {
  const main = seventy.records.flatMap(record => record.saintIds);
  const appendix = seventy.appendixRecords.flatMap(record => record.saintIds);
  const mentioned = seventy.mentionedRecords.flatMap(record => record.saintIds);
  assert.equal(new Set(main).size, 72);
  assert.equal(main.includes('petr-apostol-pervoverhovnyj'), false);
  assert.equal(main.includes('presvjataja-bogorodica'), false);
  assert.ok(mentioned.includes('petr-apostol-pervoverhovnyj'));
  assert.ok(appendix.includes('lazar-chetverodnevnyj'));
  const work = works.works.find(record => record.book === seventy.book && record.page === seventy.firstPage)!;
  assert.deepEqual(new Set(work.saintIds), new Set([...main, ...appendix, ...mentioned]));
  assert.deepEqual(reviewedSaintLinkErrors(
    [...seventy.records, ...seventy.appendixRecords, ...seventy.mentionedRecords].map(record => ({ ...record, book: seventy.book })),
    knownIds, 'seventy apostles',
  ), []);
});
