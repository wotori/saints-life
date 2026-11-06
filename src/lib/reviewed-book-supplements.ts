import { createHash } from 'node:crypto';
import records from '@/data/reviewed-book-supplements.json';
import { sectionHeadings } from '@/lib/book-sections';

export { records as reviewedBookSupplements };

/** A continued footnote may sit below the next work on the same printed page. */
export function reviewedBookSupplement(book: number, firstPage: number, heading: string, sourceSha256: string, page: number, body: string, reviews = records) {
  const matches = reviews.filter(record => record.book === book && record.firstPage === firstPage && record.heading === heading && record.sourceSha256 === sourceSha256 && record.page === page);
  if (matches.length !== 1) return undefined;
  const record = matches[0];
  if (createHash('sha256').update(body).digest('hex') !== record.pageTextSha256) return undefined;
  const start = body.indexOf(record.start), end = body.indexOf(record.end);
  if (!record.start || !record.end || start < 0 || end < start || body.indexOf(record.start, start + 1) !== -1 || body.indexOf(record.end, end + 1) !== -1) return undefined;
  return body.slice(start, end + record.end.length);
}

/** Do not repeat the preceding work's continued footnote inside a new work. */
export function withoutPreviousWorkSupplements(book: number, firstPage: number, sourceSha256: string, page: number, body: string, text: string, reviews = records, currentHeading?: string) {
  const headings = currentHeading ? sectionHeadings(body) : [];
  const current = headings.filter(item => item.title === currentHeading);
  for (const record of reviews.filter(record => {
    if (record.book !== book || record.page !== firstPage || record.page !== page) return false;
    if (record.firstPage < firstPage) return true;
    if (record.firstPage !== firstPage || current.length !== 1) return false;
    const preceding = headings.filter(item => item.title === record.heading);
    return preceding.length === 1 && preceding[0].offset < current[0].offset;
  })) {
    const fragment = reviewedBookSupplement(book, record.firstPage, record.heading, sourceSha256, page, body, reviews);
    if (fragment && text.includes(fragment)) text = text.replace(fragment, '');
  }
  return text;
}
