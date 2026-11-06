import test from 'node:test';
import assert from 'node:assert/strict';
import { saints } from '../src/lib/repository';
import { reviewedMentionRecords } from '../src/lib/reviewed-book-mentions';
import works from '../src/data/reviewed-book-work-links.json';
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
