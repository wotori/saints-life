import 'server-only';
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { archiveRoot } from '@/lib/source-archive';
import { estimatePrintedPageOffset, extractRunningHeading, matchesSearch, searchVariants } from '@/lib/search-terms';
import { sectionHeadings } from '@/lib/book-sections';
import { reviewedPageType, type ReviewedPageType } from '@/lib/reviewed-page-types';
import { reviewedWorkForPage, reviewedWorkLocations } from '@/lib/reviewed-book-works';
import { reviewedMentionForPage, reviewedMentionLocations } from '@/lib/reviewed-book-mentions';
import { dayHeadingOffsets, dayRanges, dayStarts, type DayRange } from '@/lib/book-days';
import { reviewedBookDayEnding } from '@/lib/reviewed-book-day-endings';
import { collectiveMemories, collectiveReading } from '@/lib/collective-memories';

export function collectiveBookReadings() {
  return collectiveMemories.flatMap(record => {
    const page = ocrPage(record.book, record.page);
    const reading = page?.status === 'ok' ? collectiveReading(record, page.source_sha256, page.body ?? '') : undefined;
    return reading ? [reading] : [];
  });
}

const dbPath = process.env.SAINTS_OCR_DB ?? path.join(archiveRoot(), 'rostovskij-ocr.sqlite3');
export type OcrBook = { number: number; title: string; pages: number; completed: number };
export type OcrPage = { book_number: number; page: number | null; body: string | null; status: string | null; error: string | null; title: string; pages: number; source_path: string; source_sha256: string };
export type OcrHit = { book_number: number; page: number; excerpt: string };
export type OcrHeading = { book_number: number; page: number; title: string };
export type OcrSection = { page: number; section: number; title: string };
export type OcrSectionHit = OcrSection & { book_number: number };
export type OcrBookDay = { book: number; month: number; day: number; page: number; hasRange: boolean };

function withDb<T>(fallback: T, query: (db: DatabaseSync) => T): T {
  if (!existsSync(/*turbopackIgnore: true*/ dbPath)) return fallback;
  const db = new DatabaseSync(dbPath, { readOnly: true, timeout: 5000 });
  try { return query(db); } finally { db.close(); }
}

export function ocrBooks(): OcrBook[] {
  return withDb([], db => db.prepare("SELECT b.number,b.title,b.pages,COUNT(CASE WHEN p.status='ok' THEN 1 END) AS completed FROM books b LEFT JOIN pages p ON p.book_number=b.number GROUP BY b.number ORDER BY b.number").all() as OcrBook[]);
}

/** Book-day links are provisional navigation, not independent commemoration claims. */
export function ocrBookDays(): OcrBookDay[] {
  return withDb([], db => {
    const rows = db.prepare("SELECT book_number,page,substr(body,1,4000) AS body FROM pages WHERE status='ok' AND book_number BETWEEN 1 AND 12 ORDER BY book_number,page").all() as { book_number: number; page: number; body: string }[];
    const hashes = new Map((db.prepare('SELECT number,sha256 FROM books WHERE number BETWEEN 1 AND 12').all() as { number: number; sha256: string }[]).map(item => [item.number, item.sha256]));
    const byBook = new Map<number, { page: number; body: string }[]>();
    for (const row of rows) {
      const pages = byBook.get(row.book_number) ?? [];
      pages.push({ page: row.page, body: row.body });
      byBook.set(row.book_number, pages);
    }
    return [...byBook].flatMap(([book, pages]) => {
      const month = (book + 7) % 12 + 1;
      const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
      const ranges = dayRanges(pages);
      return dayStarts(pages).filter(start => start.day <= maxDay)
        .map(start => ({ book, month, day: start.day, page: start.page, hasRange: ranges.some(range => range.day === start.day && range.firstPage === start.page && range.firstOffset === start.offset) || Boolean(reviewedBookDayEnding(book, start.page, hashes.get(book) ?? '', pages)) }));
    });
  });
}

/** Return a bounded OCR range or a scan-checked end of a volume. */
export function ocrBookDayRange(book: number, first: number): (DayRange & { nextOffset: number; kind: 'day' | 'index' | 'appendix' }) | undefined {
  if (!Number.isInteger(book) || book < 1 || book > 12 || !Number.isInteger(first) || first < 1) return undefined;
  return withDb(undefined, db => {
    const rows = db.prepare("SELECT page,substr(body,1,4000) AS body FROM pages WHERE book_number=? AND status='ok' ORDER BY page").all(book) as { page: number; body: string }[];
    const starts = dayStarts(rows).filter(start => start.page === first);
    if (starts.length !== 1) return undefined;
    const start = starts[0];
    const source = db.prepare('SELECT sha256 FROM books WHERE number=?').get(book) as { sha256: string } | undefined;
    const ending = source && reviewedBookDayEnding(book, first, source.sha256, rows);
    if (ending) return ending;
    const ranges = dayRanges(rows).filter(range => range.day === start.day && range.firstPage === first && range.firstOffset === start.offset);
    if (ranges.length !== 1) return undefined;
    const next = rows.find(row => row.page === ranges[0].nextPage);
    const nextOffset = next && dayHeadingOffsets(next.body)[0];
    return nextOffset === undefined ? undefined : { ...ranges[0], nextOffset, kind: 'day' };
  });
}

export function ocrPage(book: number, page: number): OcrPage | undefined {
  return withDb(undefined, db => db.prepare('SELECT b.number AS book_number, b.title,b.pages,b.source_path,b.sha256 AS source_sha256, p.page,p.body,p.status,p.error FROM books b LEFT JOIN pages p ON p.book_number=b.number AND p.page=? WHERE b.number=?').get(page, book) as OcrPage | undefined);
}

export function reviewedBookWorksForSaint(saintId: string) {
  return reviewedWorkLocations(saintId).flatMap(location => {
    const source = ocrPage(location.book, location.page);
    const work = source?.status === 'ok' ? reviewedWorkForPage(saintId, location.book, location.page, source.source_sha256, source.body ?? '') : undefined;
    return work ? [work] : [];
  });
}

export function reviewedBookMentionsForSaint(saintId: string) {
  return reviewedMentionLocations(saintId).flatMap(location => {
    const source = ocrPage(location.book, location.page);
    const mention = source?.status === 'ok' ? reviewedMentionForPage(saintId, location.book, location.page, source.source_sha256, source.body ?? '') : undefined;
    return mention ? [mention] : [];
  });
}

/** The offset is a navigational estimate derived from agreeing printed headers. */
export function printedPageInfo(book: number): { offset: number; maxPrintedPage: number } | undefined {
  if (!Number.isInteger(book) || book < 1 || book > 12) return undefined;
  return withDb(undefined, db => {
    const source = db.prepare('SELECT pages FROM books WHERE number=?').get(book) as { pages: number } | undefined;
    if (!source) return undefined;
    const rows = db.prepare("SELECT page,substr(body,1,200) AS body FROM pages WHERE book_number=? AND status='ok' ORDER BY page").all(book) as { page: number; body: string }[];
    const offset = estimatePrintedPageOffset(rows);
    return offset === undefined || source.pages <= offset ? undefined : { offset, maxPrintedPage: source.pages - offset };
  });
}

export function ocrPages(book: number, first: number, last: number): Pick<OcrPage, 'page' | 'body' | 'status'>[] {
  return withDb([], db => db.prepare('SELECT page,body,status FROM pages WHERE book_number=? AND page BETWEEN ? AND ? ORDER BY page').all(book, first, last) as Pick<OcrPage, 'page' | 'body' | 'status'>[]);
}

export function reviewedPageTypes(book: number, first: number, last: number): Record<number, ReviewedPageType> {
  return withDb({}, db => {
    const source = db.prepare('SELECT sha256 FROM books WHERE number=?').get(book) as { sha256: string } | undefined;
    if (!source) return {};
    const rows = db.prepare('SELECT page,body,status FROM pages WHERE book_number=? AND page BETWEEN ? AND ?').all(book, first, last) as { page: number; body: string | null; status: string | null }[];
    return Object.fromEntries(rows.flatMap(row => {
      const kind = reviewedPageType(book, source.sha256, row.page, row.status, row.body);
      return kind ? [[row.page, kind]] : [];
    }));
  });
}

/** OCR headings are discovery aids, not a verified table of contents. */
export function ocrSections(book: number, query = ''): OcrSection[] {
  if (!Number.isInteger(book) || book < 1 || book > 12) return [];
  return withDb([], db => {
    const rows = db.prepare("SELECT page,body FROM pages WHERE book_number=? AND status='ok' AND length(body)>0 ORDER BY page").all(book) as { page: number; body: string }[];
    return rows.flatMap(row => sectionHeadings(row.body).map((heading, section) => ({ page: row.page, section, title: heading.title })).filter(heading => matchesSearch(heading.title, query)));
  });
}

/** Search actual section headings across scanned books; matches are not verified identities. */
export function searchOcrSections(input: string, book?: number): OcrSectionHit[] {
  const terms = searchVariants(input);
  if (!terms.length || (book !== undefined && (!Number.isInteger(book) || book < 1 || book > 12))) return [];
  const expression = terms.map(variants => `(${variants.map(t => `"${t.replaceAll('"', '""')}"*`).join(' OR ')})`).join(' AND ');
  return withDb([], db => {
    const sql = "SELECT p.book_number,p.page,p.body FROM pages_fts JOIN pages p ON p.book_number=CAST(pages_fts.book_number AS INTEGER) AND p.page=CAST(pages_fts.page AS INTEGER) WHERE pages_fts MATCH ? AND p.status='ok' AND p.book_number BETWEEN 1 AND 12" + (book === undefined ? '' : ' AND p.book_number=?') + ' ORDER BY p.book_number,p.page';
    const rows = (book === undefined ? db.prepare(sql).all(expression) : db.prepare(sql).all(expression, book)) as { book_number: number; page: number; body: string }[];
    return rows.flatMap(row => sectionHeadings(row.body).map((heading, section) => ({ book_number: row.book_number, page: row.page, section, title: heading.title })).filter(heading => matchesSearch(heading.title, input)));
  });
}

export function searchOcr(input: string, limit = 50, book?: number, offset = 0): OcrHit[] {
  const terms = searchVariants(input);
  if (!terms.length) return [];
  const expression = terms.map(variants => `(${variants.map(t => `"${t.replaceAll('"', '""')}"*`).join(' OR ')})`).join(' AND ');
  if (book !== undefined && (!Number.isInteger(book) || book < 1 || book > 13)) return [];
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 1000000) return [];
  return withDb([], db => {
    const sql = "SELECT CAST(book_number AS INTEGER) AS book_number, CAST(page AS INTEGER) AS page, snippet(pages_fts, 0, '', '', ' … ', 24) AS excerpt FROM pages_fts WHERE pages_fts MATCH ?" + (book === undefined ? '' : ' AND CAST(book_number AS INTEGER)=?') + ' ORDER BY CAST(book_number AS INTEGER), CAST(page AS INTEGER) LIMIT ? OFFSET ?';
    return (book === undefined ? db.prepare(sql).all(expression, limit, offset) : db.prepare(sql).all(expression, book, limit, offset)) as OcrHit[];
  });
}

// Running headers are a navigational aid. They are not proof of separate people or exact chapter boundaries.
export function ocrHeadings(input = ''): OcrHeading[] {
  return withDb([], db => {
    const rows = db.prepare("SELECT book_number,page,substr(body,1,300) AS body FROM pages WHERE status='ok' AND length(body)>0 ORDER BY book_number,page").all() as { book_number: number; page: number; body: string }[];
    const found: OcrHeading[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const line = extractRunningHeading(row.body);
      if (!line) continue;
      const normalized = line.toLocaleLowerCase('ru').replaceAll('ё', 'е');
      const key = `${row.book_number}:${normalized}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (matchesSearch(normalized, input)) found.push({ book_number: row.book_number, page: row.page, title: line });
    }
    return found;
  });
}
