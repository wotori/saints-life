import { createHash } from 'node:crypto';
import data from '../data/reviewed-narrative-occurrences.json';

export type NarrativeReview = {
  book: number;
  page: number;
  sourceSha256: string;
  pageTextSha256: string;
  anchor: string;
  note: string;
};

export const narrativeReviews: readonly NarrativeReview[] = data.records;

// A narrative classification is not a review of every person mentioned in it.
export function narrativeReviewMatches(record: NarrativeReview, page: {
  book: number; page: number; sourceSha256: string; body: string;
}): boolean {
  if (record.book !== page.book || record.page !== page.page || record.sourceSha256 !== page.sourceSha256) return false;
  if (!record.anchor || !record.note.trim()) return false;
  const offset = page.body.indexOf(record.anchor);
  return offset >= 0 && (offset === 0 || page.body[offset - 1] === '\n')
    && page.body.indexOf(record.anchor, offset + 1) === -1
    && createHash('sha256').update(page.body).digest('hex') === record.pageTextSha256;
}
