import links from '@/data/reviewed-book-work-links.json';
import { sectionHeadings } from '@/lib/book-sections';

export type ReviewedBookWork = { book: number; page: number; section: number };

/** Re-check both the edition and OCR heading before serving a reviewed link. */
export function reviewedWorkForPage(saintId: string, book: number, page: number, sourceSha: string, body: string): ReviewedBookWork | undefined {
  const work = links.works.find(item => item.book === book && item.page === page && item.sourceSha256 === sourceSha && item.saintIds.includes(saintId));
  if (!work) return undefined;
  const matches = sectionHeadings(body).map((heading, section) => ({ heading, section })).filter(item => item.heading.title === work.expectedHeading);
  return matches.length === 1 ? { book, page, section: matches[0].section } : undefined;
}

export function reviewedWorkLocations(saintId: string): { book: number; page: number }[] {
  return links.works.filter(item => item.saintIds.includes(saintId)).map(item => ({ book: item.book, page: item.page }));
}
