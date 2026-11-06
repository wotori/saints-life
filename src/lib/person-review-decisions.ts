import type { personReviewQueue } from './person-review-queue';

export type PersonReviewDecision = {
  book: number; page: number; offset: number; text: string;
  sourceSha256: string; pageTextSha256: string;
  decision: string; saintIds: string[]; note: string;
  rejectedSaintIds?: string[];
};
type Queue = ReturnType<typeof personReviewQueue>['queue'];

/** Decisions apply to one unchanged occurrence, never to every occurrence of a name. */
export function applyPersonReviews(queue: Queue, reviews: readonly PersonReviewDecision[], saintIds: ReadonlySet<string>) {
  const key = (row: { book: number; page: number; offset: number; text: string }) => JSON.stringify([row.book, row.page, row.offset, row.text]);
  const byKey = new Map<string, PersonReviewDecision[]>();
  const position = (row: { book: number; page: number; offset: number }) => JSON.stringify([row.book, row.page, row.offset]);
  const byPosition = new Map<string, PersonReviewDecision[]>();
  for (const review of reviews) {
    byKey.set(key(review), [...(byKey.get(key(review)) ?? []), review]);
    byPosition.set(position(review), [...(byPosition.get(position(review)) ?? []), review]);
  }
  const applied = new Set<PersonReviewDecision>();
  const invalid = new Set<PersonReviewDecision>();
  let inheritedOccurrences = 0;
  const result = queue.map(group => {
    const occurrences = group.occurrences.map(occurrence => {
      const exact = byKey.get(key(occurrence)) ?? [];
      // Reuse a full-name decision only for its literal leading name at the same position.
      // The context was validated against the page by personReviewQueue; offsets are Unicode code points.
      const prefixes = exact.length ? [] : (byPosition.get(position(occurrence)) ?? []).filter(review => {
        if (review.decision !== 'identity-linked' || review.saintIds.length !== 1 || review.rejectedSaintIds?.length) return false;
        if (review.sourceSha256 !== occurrence.sourceSha256 || review.pageTextSha256 !== occurrence.pageTextSha256) return false;
        if (!review.text.startsWith(occurrence.text) || !/^\s/u.test(review.text.slice(occurrence.text.length))) return false;
        const context = Array.from(occurrence.context);
        const start = Math.min(180, occurrence.offset);
        return context.slice(start, start + Array.from(review.text).length).join('') === review.text;
      });
      // Competing or duplicate full-name decisions need review, even if their IDs agree.
      if (!exact.length && prefixes.length !== 1) return { ...occurrence, review: undefined };
      const matches = exact.length ? exact : prefixes;
      if (!matches.length) return { ...occurrence, review: undefined };
      const review = matches[0];
      const rejectedIds = review.rejectedSaintIds ?? [];
      const validDecision = review.decision === 'identity-rejected'
        ? review.saintIds.length === 0 && rejectedIds.length > 0 && new Set(rejectedIds).size === rejectedIds.length && rejectedIds.every(id => saintIds.has(id))
        : rejectedIds.length > 0 ? false : review.decision === 'identity-linked'
        ? review.saintIds.length > 0 && new Set(review.saintIds).size === review.saintIds.length && review.saintIds.every(id => saintIds.has(id))
        : review.decision === 'not-person' && review.saintIds.length === 0;
      if (matches.length !== 1 || !validDecision || !review.note.trim() || review.sourceSha256 !== occurrence.sourceSha256 || review.pageTextSha256 !== occurrence.pageTextSha256) {
        matches.forEach(item => invalid.add(item));
        return { ...occurrence, review: undefined };
      }
      applied.add(review);
      if (!exact.length) inheritedOccurrences++;
      return { ...occurrence, review, reviewMatch: exact.length ? 'exact' : 'full-name-prefix' };
    });
    const reviewed = occurrences.filter(item => item.review).length;
    return { ...group, occurrences, status: reviewed === 0 ? 'unreviewed' : reviewed === occurrences.length ? 'reviewed' : 'partially-reviewed' };
  });
  return { queue: result, appliedReviews: applied.size, inheritedOccurrences, invalidReviews: [...invalid],
    unusedReviews: reviews.filter(review => !applied.has(review) && !invalid.has(review)) };
}
