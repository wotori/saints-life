import { DatabaseSync } from 'node:sqlite';

export type PrintedIndexReview = {
  book: number; indexPage: number; line: number; fingerprint: string;
  title: string; day: number | null; printedPage: number; note: string;
};
type Stored = { fingerprint: string; source_sha256: string; title: string; printed_day: number | null; printed_page: number | null; review_status: string; review_note: string | null; active: number };

/** Apply a batch checked against the original scan, or roll back every change. */
export function reviewPrintedEntries(index: DatabaseSync, ocr: DatabaseSync, reviews: PrintedIndexReview[]): number {
  if (!Array.isArray(reviews) || reviews.length === 0) throw new Error('Empty review batch');
  index.exec('BEGIN IMMEDIATE');
  try {
    index.exec(`CREATE TABLE IF NOT EXISTS printed_entry_reviews (
      id INTEGER PRIMARY KEY, book_number INTEGER NOT NULL, index_page INTEGER NOT NULL,
      line_number INTEGER NOT NULL, fingerprint TEXT NOT NULL, before_json TEXT NOT NULL,
      after_json TEXT NOT NULL, reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    const select = index.prepare('SELECT fingerprint,source_sha256,title,printed_day,printed_page,review_status,review_note,active FROM printed_entries WHERE book_number=? AND index_page=? AND line_number=?');
    const book = ocr.prepare('SELECT sha256,pages FROM books WHERE number=?');
    const update = index.prepare("UPDATE printed_entries SET title=?,printed_day=?,printed_page=?,review_status='reviewed',review_note=? WHERE book_number=? AND index_page=? AND line_number=?");
    const audit = index.prepare('INSERT INTO printed_entry_reviews(book_number,index_page,line_number,fingerprint,before_json,after_json) VALUES(?,?,?,?,?,?)');
    let changed = 0;
    for (const item of reviews) {
      if (![item.book, item.indexPage, item.line, item.printedPage].every(Number.isInteger) || item.book < 1 || item.book > 12 || item.indexPage < 1 || item.line < 0 || (item.day !== null && (!Number.isInteger(item.day) || item.day < 1 || item.day > 31)) || item.printedPage < 1 || typeof item.title !== 'string' || !item.title.trim() || typeof item.note !== 'string' || !item.note.trim() || !/^[a-f0-9]{64}$/.test(item.fingerprint)) throw new Error('Invalid review');
      const current = select.get(item.book, item.indexPage, item.line) as Stored | undefined;
      const source = book.get(item.book) as { sha256: string; pages: number } | undefined;
      if (!current || !source || !current.active || current.fingerprint !== item.fingerprint || current.source_sha256 !== source.sha256 || item.printedPage > source.pages) throw new Error(`Source mismatch for ${item.book}:${item.indexPage}:${item.line}`);
      const after = { title: item.title, printed_day: item.day, printed_page: item.printedPage, review_status: 'reviewed', review_note: item.note };
      const before = { title: current.title, printed_day: current.printed_day, printed_page: current.printed_page, review_status: current.review_status, review_note: current.review_note };
      if (current.review_status === 'reviewed' && JSON.stringify(before) === JSON.stringify(after)) continue;
      if (current.review_status !== 'unreviewed') throw new Error(`Already reviewed or excluded: ${item.book}:${item.indexPage}:${item.line}`);
      update.run(item.title, item.day, item.printedPage, item.note, item.book, item.indexPage, item.line);
      audit.run(item.book, item.indexPage, item.line, item.fingerprint, JSON.stringify(before), JSON.stringify(after));
      changed++;
    }
    index.exec('COMMIT');
    return changed;
  } catch (error) { index.exec('ROLLBACK'); throw error; }
}

export type PrintedIndexExclusion = { book: number; indexPage: number; line: number; fingerprint: string; note: string };

/** Hide an OCR artifact after scan review, preserving both the original line and the audit. */
export function excludePrintedEntries(index: DatabaseSync, ocr: DatabaseSync, entries: PrintedIndexExclusion[]): number {
  if (!Array.isArray(entries) || !entries.length) throw new Error('Empty exclusion batch');
  index.exec('BEGIN IMMEDIATE');
  try {
    index.exec(`CREATE TABLE IF NOT EXISTS printed_entry_reviews (
      id INTEGER PRIMARY KEY, book_number INTEGER NOT NULL, index_page INTEGER NOT NULL,
      line_number INTEGER NOT NULL, fingerprint TEXT NOT NULL, before_json TEXT NOT NULL,
      after_json TEXT NOT NULL, reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    const select = index.prepare('SELECT fingerprint,source_sha256,title,printed_day,printed_page,review_status,review_note,active FROM printed_entries WHERE book_number=? AND index_page=? AND line_number=?');
    const book = ocr.prepare('SELECT sha256 FROM books WHERE number=?');
    const update = index.prepare("UPDATE printed_entries SET review_status='excluded',review_note=? WHERE book_number=? AND index_page=? AND line_number=?");
    const audit = index.prepare('INSERT INTO printed_entry_reviews(book_number,index_page,line_number,fingerprint,before_json,after_json) VALUES(?,?,?,?,?,?)');
    let changed = 0;
    for (const item of entries) {
      if (![item.book, item.indexPage, item.line].every(Number.isInteger) || item.book < 1 || item.book > 12 || item.indexPage < 1 || item.line < 0 || typeof item.note !== 'string' || !item.note.trim() || !/^[a-f0-9]{64}$/.test(item.fingerprint)) throw new Error('Invalid exclusion');
      const current = select.get(item.book, item.indexPage, item.line) as Stored | undefined;
      const source = book.get(item.book) as { sha256: string } | undefined;
      if (!current || !source || !current.active || current.fingerprint !== item.fingerprint || current.source_sha256 !== source.sha256) throw new Error(`Source mismatch for ${item.book}:${item.indexPage}:${item.line}`);
      if (current.review_status === 'excluded' && current.review_note === item.note) continue;
      if (current.review_status !== 'unreviewed') throw new Error(`Already reviewed or excluded: ${item.book}:${item.indexPage}:${item.line}`);
      const before = { title: current.title, printed_day: current.printed_day, printed_page: current.printed_page, review_status: current.review_status, review_note: current.review_note };
      const after = { ...before, review_status: 'excluded', review_note: item.note };
      update.run(item.note, item.book, item.indexPage, item.line);
      audit.run(item.book, item.indexPage, item.line, item.fingerprint, JSON.stringify(before), JSON.stringify(after));
      changed++;
    }
    index.exec('COMMIT');
    return changed;
  } catch (error) { index.exec('ROLLBACK'); throw error; }
}
