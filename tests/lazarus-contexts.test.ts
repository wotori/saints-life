import test from 'node:test';
import assert from 'node:assert/strict';
import reviews from '../src/data/reviewed-person-candidates.json';
import { reviewedMentionLocations } from '../src/lib/reviewed-book-mentions';

test('Lazarus mentions keep the three distinct lives and their continuations separate', () => {
  const pages = [
    [1, 195, 'lazar-chetverodnevnyj'], [2, 401, 'lazar-chetverodnevnyj'],
    [2, 402, 'lazar-chetverodnevnyj'], [3, 133, 'lazar-galisijskij'],
    [3, 134, 'lazar-galisijskij'], [3, 454, 'lazar-ikonopisec'],
    [3, 455, 'lazar-ikonopisec'], [5, 157, 'lazar-chetverodnevnyj'],
    [11, 364, 'lazar-galisijskij'],
  ] as const;
  for (const [book, page, id] of pages) {
    const matches = reviews.filter(r => r.book === book && r.page === page && /^Ла(?:-\n)?зар(?:ь|я|ю|е|ем)$/iu.test(r.text));
    assert.ok(matches.length > 0, `${book}/${page}`);
    for (const match of matches) assert.deepEqual(match.saintIds, [id]);
  }
  assert.ok(reviews.some(r => r.book === 2 && r.page === 402 && r.text === 'Ла-\nзаря'));
  for (const [id, book, page] of [
    ['lazar-chetverodnevnyj', 1, 195], ['lazar-chetverodnevnyj', 2, 402],
    ['lazar-galisijskij', 3, 134], ['lazar-ikonopisec', 3, 455],
  ] as const) {
    assert.ok(reviewedMentionLocations(id).some(r => r.book === book && r.page === page));
  }
});

test('unresolved monastery dedications do not inherit the identity of a namesake', () => {
  for (const id of ['lazar-chetverodnevnyj', 'lazar-galisijskij', 'lazar-ikonopisec', 'lazar-s-ionoj-persidskim']) {
    for (const [book, page] of [[5, 367], [5, 372], [11, 512]]) {
      assert.ok(!reviewedMentionLocations(id).some(r => r.book === book && r.page === page));
    }
  }
});
