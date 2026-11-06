import type { applyPersonReviews } from './person-review-decisions';

type ReviewedQueue = ReturnType<typeof applyPersonReviews>['queue'];
type Counts = {
  totalOccurrences: number;
  linkedOccurrences: number;
  notPersonOccurrences: number;
  pendingOccurrences: number;
  pendingWithRejectedIdentities: number;
};

const emptyCounts = (): Counts => ({ totalOccurrences: 0, linkedOccurrences: 0,
  notPersonOccurrences: 0, pendingOccurrences: 0, pendingWithRejectedIdentities: 0 });

/** Use only the hash-validated output of applyPersonReviews. Rejection does not establish identity. */
export function personReviewBacklog(reviewedQueue: ReviewedQueue) {
  const summary = emptyCounts();
  const books = new Map<number, Counts>();
  const queue = reviewedQueue.flatMap(group => {
    const occurrences = group.occurrences.flatMap(occurrence => {
      const book = books.get(occurrence.book) ?? emptyCounts();
      books.set(occurrence.book, book);
      const decision = occurrence.review?.decision;
      for (const counts of [summary, book]) {
        counts.totalOccurrences++;
        if (decision === 'identity-linked') counts.linkedOccurrences++;
        else if (decision === 'not-person') counts.notPersonOccurrences++;
        else {
          counts.pendingOccurrences++;
          if (decision === 'identity-rejected') counts.pendingWithRejectedIdentities++;
        }
      }
      if (decision === 'identity-linked' || decision === 'not-person') return [];
      const rejected = new Set(occurrence.review?.rejectedSaintIds ?? []);
      return [{ ...occurrence, remainingSuggestedSaintIds: group.suggestedSaintIds.filter(id => !rejected.has(id)),
        remainingDeclensionSuggestedSaintIds: group.declensionSuggestedSaintIds.filter(id => !rejected.has(id)) }];
    });
    return occurrences.length ? [{ ...group, status: 'pending' as const, occurrences }] : [];
  }).sort((a, b) => b.occurrences.length - a.occurrences.length || a.spelling.localeCompare(b.spelling, 'ru'));
  return {
    scope: 'Unresolved literal occurrences in processed chunks only, not missing saints or whole-book completeness. Rejected identities stay pending; suggestions never establish identity.',
    summary: { ...summary, pendingGroups: queue.length },
    books: [...books].sort(([a], [b]) => a - b).map(([book, counts]) => ({ book, ...counts })),
    queue,
  };
}
