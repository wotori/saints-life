import { createHash } from 'node:crypto';
import records from '@/data/reviewed-book-section-types.json';
import { sectionHeadings } from '@/lib/book-sections';

export { records as reviewedSectionTypes };

/** Classification is invalidated by changes anywhere in the reviewed passage. */
export function reviewedSectionType(book: number, page: number, heading: string, sourceSha256: string, readPage: (page: number) => string | undefined, reviews: typeof records = records) {
  const matches = reviews.filter(record => record.book === book && record.page === page && record.heading === heading && record.sourceSha256 === sourceSha256);
  if (matches.length !== 1) return undefined;
  const record = matches[0];
  if (sectionHeadings(readPage(page) ?? '').filter(item => item.title === heading).length !== 1) return undefined;
  if (!record.pages.every(expected => {
    const body = readPage(expected.page);
    return body !== undefined && createHash('sha256').update(body).digest('hex') === expected.sha256;
  })) return undefined;
  return record;
}
