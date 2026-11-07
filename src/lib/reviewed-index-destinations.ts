import { createHash } from 'node:crypto';
import corrections from '../data/reviewed-index-destinations.json';

/** Preserve the printed reference; correct only the destination in a scan-checked edition. */
export function reviewedIndexDestination(entry: {
  book: number; indexPage: number; line: number; fingerprint?: string;
  sourceSha256: string; printedPage?: number; reviewed: boolean;
}, bodyForPage: (page: number) => string | undefined): number | undefined {
  if (!entry.reviewed) return undefined;
  const correction = corrections.find(item => item.book === entry.book
    && item.indexPage === entry.indexPage && item.line === entry.line
    && item.fingerprint === entry.fingerprint && item.sourceSha256 === entry.sourceSha256
    && item.printedPage === entry.printedPage);
  if (!correction) return undefined;
  const body = bodyForPage(correction.targetPage);
  if (body === undefined || createHash('sha256').update(body).digest('hex') !== correction.targetSha256) return undefined;
  return correction.targetPage;
}
