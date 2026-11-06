import { createHash } from 'node:crypto';
import records from '../data/reviewed-work-person-coverage.json';
import { sectionHeadings } from './book-sections';

export { records as reviewedWorkPersonCoverage };

/** Validates an explicit editorial review; never infers completeness from a link. */
export function reviewedWorkPersons(book: number, page: number, heading: string, sha: string,
  readPage: (page: number) => string | undefined, linkedIds: readonly string[], knownIds: ReadonlySet<string>, reviews = records) {
  const matches = reviews.filter(r => r.book === book && r.page === page && r.heading === heading);
  if (matches.length !== 1) return undefined;
  const r = matches[0];
  if (r.sourceSha256 !== sha || !r.note.trim() || !r.pages.length || !r.saintIds.length) return undefined;
  if (new Set(r.saintIds).size !== r.saintIds.length || r.saintIds.some(id => !knownIds.has(id) || !linkedIds.includes(id))) return undefined;
  if (linkedIds.some(id => !r.saintIds.includes(id))) return undefined;
  if (sectionHeadings(readPage(page) ?? '').filter(h => h.title === heading).length !== 1) return undefined;
  if (!r.pages.every((p, i) => p.page === page + i && readPage(p.page) !== undefined &&
    createHash('sha256').update(readPage(p.page)!).digest('hex') === p.sha256)) return undefined;
  return r;
}
