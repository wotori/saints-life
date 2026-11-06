import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { rebuildPrintedEntries } from '../src/lib/printed-index-import';

const indexPath = process.env.SAINTS_INDEX_DB ?? path.resolve(process.cwd(), '../staints-life-sources/book-indexes.sqlite3');
const ocrPath = process.env.SAINTS_OCR_DB ?? path.resolve(process.cwd(), '../staints-life-sources/rostovskij-ocr.sqlite3');
if (!existsSync(indexPath) || !existsSync(ocrPath)) throw new Error('Source index or OCR database does not exist.');
const index = new DatabaseSync(indexPath, { timeout: 5000 });
const ocr = new DatabaseSync(ocrPath, { readOnly: true, timeout: 5000 });
try {
  const result = rebuildPrintedEntries(index, ocr);
  console.log(`Materialized ${result.entries} source entries from ${result.pages} index pages.`);
} finally { index.close(); ocr.close(); }
