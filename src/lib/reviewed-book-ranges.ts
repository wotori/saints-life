import { sectionHeadings } from '@/lib/book-sections';

// The range identifies a passage in this edition, not the identity of an indexed person.
const ranges = [{
  book: 5,
  sourceSha256: 'e62ed1051709261e1b21d03eac3e74d8475e1f77e28c5a56d2faf2b0390e242f',
  day: 4,
  firstPage: 139,
  lastPage: 160,
  heading: 'СОБОР СВЯТЫХ СЕМИДЕСЯТИ АПОСТОЛОВ',
}] as const;

export function reviewedRangeForIndex(entry: { book: number; sourceSha256: string; day?: number; pdfPage?: number; reviewed: boolean }, startBody: (page: number) => string | undefined): { page: number; section: number } | undefined {
  if (!entry.reviewed || !entry.pdfPage) return undefined;
  const range = ranges.find(item => item.book === entry.book && item.sourceSha256 === entry.sourceSha256 && item.day === entry.day && entry.pdfPage! >= item.firstPage && entry.pdfPage! <= item.lastPage);
  if (!range) return undefined;
  const body = startBody(range.firstPage);
  if (body === undefined) return undefined;
  const matches = sectionHeadings(body).map((heading, section) => ({ heading, section })).filter(item => item.heading.title === range.heading);
  return matches.length === 1 ? { page: range.firstPage, section: matches[0].section } : undefined;
}
