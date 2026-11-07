import 'server-only';
import { reviewedIndexDestination } from './reviewed-index-destinations';
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { archiveRoot } from '@/lib/source-archive';
import { dayForNamedPage, dayRanges } from '@/lib/book-days';
import { nearbySectionForIndexedName, sectionForIndexedName, sectionHeadings, type SectionPage } from '@/lib/book-sections';
import { agreesWithIndexDigits, estimatePrintedPageOffset, matchesSearch, parsePrintedIndexPage, recoverMergedIndexReference, searchTerms } from '@/lib/search-terms';
import { reviewedRangeForIndex } from '@/lib/reviewed-book-ranges';

const indexPath = process.env.SAINTS_INDEX_DB ?? path.join(archiveRoot(), 'book-indexes.sqlite3');
const ocrPath = process.env.SAINTS_OCR_DB ?? path.join(archiveRoot(), 'rostovskij-ocr.sqlite3');
export type PrintedIndexHit = { book: number; indexPage: number; title: string; sourceLine: string; printedPage?: number; printedDay?: number; calendarDay?: number; dayHeadingPage?: number; julianMonth?: number; pdfPage?: number; hasText?: boolean; workPage?: number; workSection?: number; contextWorkPage?: number; contextWorkSection?: number; nearbyWorkPage?: number; nearbyWorkSection?: number; recoveredNumbers?: boolean; correctedDestination?: boolean; recoveryMethod?: 'columns' | 'text'; reviewStatus: 'unreviewed' | 'reviewed'; line: number };

type Book = { number: number; pages: number; sha256: string };
type Header = { book_number: number; page: number; body: string };

// Only infer an offset when many independently numbered pages agree. Otherwise keep the index reference without a destination.
function offsets(db: DatabaseSync): Map<number, number> {
  const headers = db.prepare("SELECT book_number,page,substr(body,1,200) AS body FROM pages WHERE status='ok' AND book_number BETWEEN 1 AND 12").all() as Header[];
  const byBook = new Map<number, Header[]>();
  for (const row of headers) {
    const group = byBook.get(row.book_number) ?? [];
    group.push(row);
    byBook.set(row.book_number, group);
  }
  const result = new Map<number, number>();
  for (const [book, rows] of byBook) {
    const offset = estimatePrintedPageOffset(rows);
    if (offset !== undefined) result.set(book, offset);
  }
  return result;
}

export function printedIndexHits(query: string, options: { allowEmpty?: boolean; limit?: number; id?: { book: number; indexPage: number; line: number }; includeNearby?: boolean } = {}): PrintedIndexHit[] {
  if ((!options.allowEmpty && !searchTerms(query).some(term => term.length >= 2)) || !existsSync(/*turbopackIgnore: true*/ indexPath) || !existsSync(/*turbopackIgnore: true*/ ocrPath)) return [];
  const index = new DatabaseSync(indexPath, { readOnly: true, timeout: 5000 });
  const ocr = new DatabaseSync(ocrPath, { readOnly: true, timeout: 5000 });
  try {
    const books = new Map((ocr.prepare('SELECT number,pages,sha256 FROM books').all() as Book[]).map(book => [book.number, book]));
    const pageOffsets = offsets(ocr);
    const bodies = ocr.prepare("SELECT book_number,page,substr(body,1,4000) AS body FROM pages WHERE status='ok' AND book_number BETWEEN 1 AND 12 ORDER BY book_number,page").all() as Header[];
    const byBook = new Map<number, Header[]>();
    for (const row of bodies) { const group = byBook.get(row.book_number) ?? []; group.push(row); byBook.set(row.book_number, group); }
    const ranges = new Map([...byBook].map(([number, pages]) => [number, dayRanges(pages)]));
    const bodiesByPage = new Map(bodies.map(row => [`${row.book_number}:${row.page}`, row]));
    const sectionPages = new Map<string, SectionPage>();
    const sectionPage = (book: number, page: number): SectionPage | undefined => {
      const key = `${book}:${page}`;
      if (sectionPages.has(key)) return sectionPages.get(key);
      const row = bodiesByPage.get(key);
      if (!row) return undefined;
      const value = { body: row.body, headings: sectionHeadings(row.body) };
      sectionPages.set(key, value);
      return value;
    };
    type IndexRow = { book: number; indexPage: number; lineNumber: number; title: string; sourceLine: string; printedDay?: number; printedPage?: number; sha: string; fingerprint?: string; reviewStatus: 'unreviewed' | 'reviewed' };
    let rows: IndexRow[];
    const numeric = new Map<string, { fingerprint: string; printed_day: number; printed_page: number }>();
    if (index.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='numeric_reference_evidence'").get()) {
      const evidence = index.prepare('SELECT book_number,index_page,line_number,fingerprint,printed_day,printed_page FROM numeric_reference_evidence').all() as { book_number: number; index_page: number; line_number: number; fingerprint: string; printed_day: number; printed_page: number }[];
      for (const row of evidence) numeric.set(`${row.book_number}:${row.index_page}:${row.line_number}`, row);
    }
    const materialized = index.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='printed_entries'").get();
    if (materialized) {
      const stored = index.prepare("SELECT book_number,index_page,line_number,title,source_line,printed_day,printed_page,source_sha256,fingerprint,review_status FROM printed_entries WHERE active=1 AND review_status!='excluded' ORDER BY book_number,index_page,line_number").all() as { book_number: number; index_page: number; line_number: number; title: string; source_line: string; printed_day: number | null; printed_page: number | null; source_sha256: string; fingerprint: string; review_status: 'unreviewed' | 'reviewed' }[];
      rows = stored.map(row => ({ book: row.book_number, indexPage: row.index_page, lineNumber: row.line_number, title: row.title, sourceLine: row.source_line, ...(row.printed_day !== null ? { printedDay: row.printed_day } : {}), ...(row.printed_page !== null ? { printedPage: row.printed_page } : {}), sha: row.source_sha256, fingerprint: row.fingerprint, reviewStatus: row.review_status }));
    } else {
      const pages = index.prepare('SELECT book_number,page,left_text,right_text,source_sha256 FROM index_pages WHERE is_index=1 ORDER BY book_number,page').all() as { book_number: number; page: number; left_text: string; right_text: string; source_sha256: string }[];
      rows = [];
      for (const page of pages) parsePrintedIndexPage(page.left_text, page.right_text).forEach(({ parsed, lineNumber }) => {
        rows.push({ book: page.book_number, indexPage: page.page, lineNumber, ...parsed, sha: page.source_sha256, reviewStatus: 'unreviewed' });
      });
    }
    const hits: PrintedIndexHit[] = [];
    for (const row of rows) {
      if (options.id && (row.book !== options.id.book || row.indexPage !== options.id.indexPage || row.lineNumber !== options.id.line)) continue;
      const book = books.get(row.book);
      if (!book || book.sha256 !== row.sha || !matchesSearch(row.title, query)) continue;
      const parsed = { title: row.title, sourceLine: row.sourceLine, printedDay: row.printedDay, printedPage: row.printedPage };
      const offset = pageOffsets.get(row.book);
      const julianMonth = (row.book + 7) % 12 + 1;
      const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][julianMonth - 1];
      let printedDay = parsed.printedDay, printedPage = parsed.printedPage;
      let recoveredNumbers = false;
      let recoveryMethod: 'columns' | 'text' | undefined;
      const numericEvidence = numeric.get(`${row.book}:${row.indexPage}:${row.lineNumber}`);
      if (!printedPage && row.reviewStatus === 'unreviewed' && numericEvidence && numericEvidence.fingerprint === row.fingerprint && numericEvidence.printed_day >= 1 && numericEvidence.printed_day <= maxDay && numericEvidence.printed_page >= 1 && numericEvidence.printed_page <= book.pages && agreesWithIndexDigits(row.sourceLine, numericEvidence.printed_day, numericEvidence.printed_page)) {
        printedDay = numericEvidence.printed_day;
        printedPage = numericEvidence.printed_page;
        recoveredNumbers = true;
        recoveryMethod = 'columns';
      }
      if (!printedPage && offset !== undefined) {
        const candidate = recoverMergedIndexReference(parsed.sourceLine, maxDay, book.pages - offset, printed =>
          Boolean(sectionForIndexedName(number => sectionPage(row.book, number), printed + offset, parsed.title)));
        if (candidate) {
          printedDay = candidate.day;
          printedPage = candidate.page;
          recoveredNumbers = true;
          recoveryMethod = 'text';
        }
      }
      const correctedPage = reviewedIndexDestination({ book: row.book, indexPage: row.indexPage, line: row.lineNumber, fingerprint: row.fingerprint, sourceSha256: row.sha, printedPage, reviewed: row.reviewStatus === 'reviewed' }, page => (ocr.prepare('SELECT body FROM pages WHERE book_number=? AND page=? AND status=\'ok\'').get(row.book, page) as { body: string } | undefined)?.body);
      const pdfPage = correctedPage ?? (printedPage && offset !== undefined ? printedPage + offset : undefined);
      const pageBody = pdfPage ? bodiesByPage.get(`${row.book}:${pdfPage}`) : undefined;
      const evidence = dayForNamedPage(ranges.get(row.book) ?? [], pageBody, parsed.title);
      const work = pdfPage ? sectionForIndexedName(page => sectionPage(row.book, page), pdfPage, parsed.title) : undefined;
      const context = reviewedRangeForIndex({ book: row.book, sourceSha256: row.sha, day: printedDay, pdfPage, reviewed: row.reviewStatus === 'reviewed' }, page => sectionPage(row.book, page)?.body);
      const nearby = options.includeNearby && row.reviewStatus === 'reviewed' && printedDay && pdfPage && !work
        ? nearbySectionForIndexedName(page => sectionPage(row.book, page), pdfPage, parsed.title, (page, offset) => {
          const range = (ranges.get(row.book) ?? []).find(item => page >= item.firstPage && page < item.nextPage && (page !== item.firstPage || offset >= item.firstOffset));
          return !range || range.day === printedDay;
        }) : undefined;
      const calendarDay = row.reviewStatus === 'reviewed' ? printedDay : evidence?.day ?? printedDay;
      const validDay = calendarDay && calendarDay >= 1 && calendarDay <= maxDay;
      hits.push({ book: row.book, indexPage: row.indexPage, ...parsed, reviewStatus: row.reviewStatus, ...(correctedPage ? { correctedDestination: true } : {}), ...(recoveredNumbers ? { printedDay, printedPage, recoveredNumbers, recoveryMethod } : {}), ...(validDay ? { julianMonth, calendarDay } : {}), ...(evidence ? { dayHeadingPage: evidence.firstPage } : {}), ...(pdfPage && pdfPage <= book.pages ? { pdfPage, hasText: Boolean(pageBody?.body.trim()) } : {}), ...(work ? { workPage: work.page, workSection: work.section } : {}), ...(context && (!work || context.page !== work.page || context.section !== work.section) ? { contextWorkPage: context.page, contextWorkSection: context.section } : {}), ...(nearby ? { nearbyWorkPage: nearby.page, nearbyWorkSection: nearby.section } : {}), line: row.lineNumber });
    }
    return hits.slice(0, options.limit ?? 100);
  } finally { index.close(); ocr.close(); }
}

/** Contents OCR remains tied to the exact archived John volume. */
export function johnContentsPages(): { page: number; body: string }[] {
  if (!existsSync(/*turbopackIgnore: true*/ indexPath) || !existsSync(/*turbopackIgnore: true*/ ocrPath)) return [];
  const index = new DatabaseSync(indexPath, { readOnly: true, timeout: 5000 });
  const ocr = new DatabaseSync(ocrPath, { readOnly: true, timeout: 5000 });
  try {
    if (!index.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='john_contents_pages'").get()) return [];
    const book = ocr.prepare('SELECT sha256 FROM books WHERE number=13').get() as { sha256: string } | undefined;
    if (!book) return [];
    return index.prepare('SELECT page,body FROM john_contents_pages WHERE source_sha256=? ORDER BY page').all(book.sha256) as { page: number; body: string }[];
  } finally { index.close(); ocr.close(); }
}
