import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { parsePrintedIndexPage } from './search-terms';

type IndexPage = { book_number: number; page: number; left_text: string; right_text: string; source_sha256: string };
type SourceBook = { number: number; sha256: string };
type IndexedRow = { book: number; page: number; line: number; raw: string; title: string; reference: string; day: number | null; printedPage: number | null; sha: string; fingerprint: string };
type ReviewedRow = { book_number: number; index_page: number; line_number: number; fingerprint: string };
const key = (book: number, page: number, line: number) => `${book}:${page}:${line}`;

export type SupplementalIndexLine = { book: number; indexPage: number; line: number; fingerprint: string };

/** Register an omitted OCR line for editorial review, bound to its original book and line. */
export function registerSupplementalIndexLines(index: DatabaseSync, ocr: DatabaseSync, lines: SupplementalIndexLine[]): number {
  if (!Array.isArray(lines) || !lines.length) throw new Error('Empty supplemental batch');
  index.exec('BEGIN IMMEDIATE');
  try {
    index.exec('CREATE TABLE IF NOT EXISTS supplemental_index_lines(book_number INTEGER NOT NULL,index_page INTEGER NOT NULL,line_number INTEGER NOT NULL,fingerprint TEXT NOT NULL,PRIMARY KEY(book_number,index_page,line_number))');
    const page = index.prepare('SELECT left_text,right_text,source_sha256 FROM index_pages WHERE book_number=? AND page=? AND is_index=1');
    const book = ocr.prepare('SELECT sha256 FROM books WHERE number=?');
    const existing = index.prepare('SELECT fingerprint FROM supplemental_index_lines WHERE book_number=? AND index_page=? AND line_number=?');
    const insert = index.prepare('INSERT INTO supplemental_index_lines VALUES(?,?,?,?)');
    let added = 0;
    for (const item of lines) {
      if (![item.book, item.indexPage, item.line].every(Number.isInteger) || item.book < 1 || item.book > 12 || item.indexPage < 1 || item.line < 0 || !/^[a-f0-9]{64}$/.test(item.fingerprint)) throw new Error('Invalid supplemental source line');
      const source = page.get(item.book, item.indexPage) as {left_text: string; right_text: string; source_sha256: string} | undefined;
      const sourceBook = book.get(item.book) as {sha256: string} | undefined;
      const raw = source ? `${source.left_text}\n${source.right_text}`.split('\n')[item.line] : undefined;
      if (!source || !sourceBook || source.source_sha256 !== sourceBook.sha256 || !raw?.trim() || createHash('sha256').update(`${source.source_sha256}\0${raw}`).digest('hex') !== item.fingerprint) throw new Error(`Supplemental source mismatch: ${item.book}:${item.indexPage}:${item.line}`);
      const old = existing.get(item.book, item.indexPage, item.line) as {fingerprint: string} | undefined;
      if (old && old.fingerprint !== item.fingerprint) throw new Error('Supplemental line changed');
      if (!old) { insert.run(item.book, item.indexPage, item.line, item.fingerprint); added++; }
    }
    index.exec('COMMIT');
    return added;
  } catch (error) { index.exec('ROLLBACK'); throw error; }
}

/** Materialize source occurrences without overwriting any future reviewed record. */
export function rebuildPrintedEntries(index: DatabaseSync, ocr: DatabaseSync): { entries: number; pages: number } {
  const books = new Map((ocr.prepare('SELECT number,sha256 FROM books').all() as SourceBook[]).map(book => [book.number, book.sha256]));
  index.exec('BEGIN IMMEDIATE');
  try {
    const pages = index.prepare('SELECT book_number,page,left_text,right_text,source_sha256 FROM index_pages WHERE is_index=1 ORDER BY book_number,page').all() as IndexPage[];
    const records: IndexedRow[] = [];
    for (const page of pages) {
      if (books.get(page.book_number) !== page.source_sha256) throw new Error(`Source checksum mismatch for book ${page.book_number}, page ${page.page}`);
      parsePrintedIndexPage(page.left_text, page.right_text).forEach(({ raw, lineNumber: line, parsed }) => {
        const fingerprint = createHash('sha256').update(`${page.source_sha256}\0${raw}`).digest('hex');
        records.push({ book: page.book_number, page: page.page, line, raw, title: parsed.title, reference: parsed.sourceLine, day: parsed.printedDay ?? null, printedPage: parsed.printedPage ?? null, sha: page.source_sha256, fingerprint });
      });
    }
    if (index.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='supplemental_index_lines'").get()) {
      const supplements = index.prepare('SELECT book_number,index_page,line_number,fingerprint FROM supplemental_index_lines').all() as ReviewedRow[];
      const found = new Map(records.map(record => [key(record.book, record.page, record.line), record]));
      const sourcePages = new Map(pages.map(page => [`${page.book_number}:${page.page}`, page]));
      for (const row of supplements) {
        const page = sourcePages.get(`${row.book_number}:${row.index_page}`);
        const raw = page ? `${page.left_text}\n${page.right_text}`.split('\n')[row.line_number] : undefined;
        if (!page || !raw?.trim() || createHash('sha256').update(`${page.source_sha256}\0${raw}`).digest('hex') !== row.fingerprint) throw new Error(`Supplemental source line changed: book ${row.book_number}, page ${row.index_page}, line ${row.line_number}`);
        const existing = found.get(key(row.book_number, row.index_page, row.line_number));
        if (existing) {
          if (existing.fingerprint !== row.fingerprint) throw new Error('Supplemental line conflicts with parsed source');
          continue;
        }
        records.push({ book: row.book_number, page: row.index_page, line: row.line_number, raw, title: raw.trim(), reference: 'не распознано', day: null, printedPage: null, sha: page.source_sha256, fingerprint: row.fingerprint });
      }
    }
    if (!pages.length || !records.length) throw new Error('No printable index entries found; existing records were not changed.');
    index.exec(`CREATE TABLE IF NOT EXISTS printed_entries (
      book_number INTEGER NOT NULL, index_page INTEGER NOT NULL, line_number INTEGER NOT NULL,
      raw_line TEXT NOT NULL, title TEXT NOT NULL, source_line TEXT NOT NULL,
      printed_day INTEGER, printed_page INTEGER, source_sha256 TEXT NOT NULL, fingerprint TEXT NOT NULL,
      review_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK(review_status IN ('unreviewed','reviewed','excluded')),
      review_note TEXT, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      PRIMARY KEY(book_number,index_page,line_number))`);
    const next = new Map(records.map(record => [key(record.book, record.page, record.line), record]));
    const reviewed = index.prepare("SELECT book_number,index_page,line_number,fingerprint FROM printed_entries WHERE review_status!='unreviewed'").all() as ReviewedRow[];
    for (const row of reviewed) {
      const replacement = next.get(key(row.book_number, row.index_page, row.line_number));
      if (!replacement || replacement.fingerprint !== row.fingerprint) throw new Error(`Reviewed source line changed or disappeared: book ${row.book_number}, page ${row.index_page}, line ${row.line_number}`);
    }
    index.exec("UPDATE printed_entries SET active=0 WHERE review_status='unreviewed'");
    const upsert = index.prepare(`INSERT INTO printed_entries(book_number,index_page,line_number,raw_line,title,source_line,printed_day,printed_page,source_sha256,fingerprint,active)
      VALUES(?,?,?,?,?,?,?,?,?,?,1)
      ON CONFLICT(book_number,index_page,line_number) DO UPDATE SET raw_line=excluded.raw_line,title=excluded.title,
      source_line=excluded.source_line,printed_day=excluded.printed_day,printed_page=excluded.printed_page,
      source_sha256=excluded.source_sha256,fingerprint=excluded.fingerprint,active=1
      WHERE printed_entries.review_status='unreviewed'`);
    for (const record of records) upsert.run(record.book, record.page, record.line, record.raw, record.title, record.reference, record.day, record.printedPage, record.sha, record.fingerprint);
    index.exec('COMMIT');
    return { entries: records.length, pages: pages.length };
  } catch (error) {
    index.exec('ROLLBACK');
    throw error;
  }
}
