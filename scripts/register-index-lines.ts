import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { rebuildPrintedEntries, registerSupplementalIndexLines, type SupplementalIndexLine } from '../src/lib/printed-index-import';

const plan = process.argv[2];
if (!plan) throw new Error('Supply a JSON file containing source line references.');
const lines = JSON.parse(readFileSync(plan, 'utf8')) as SupplementalIndexLine[];
const index = new DatabaseSync(process.env.SAINTS_INDEX_DB ?? path.resolve('../staints-life-sources/book-indexes.sqlite3'), { timeout: 5000 });
const ocr = new DatabaseSync(process.env.SAINTS_OCR_DB ?? path.resolve('../staints-life-sources/rostovskij-ocr.sqlite3'), { readOnly: true, timeout: 5000 });
try {
  console.log(`Registered ${registerSupplementalIndexLines(index, ocr, lines)} omitted source lines.`);
  const result = rebuildPrintedEntries(index, ocr);
  console.log(`Materialized ${result.entries} source entries from ${result.pages} index pages.`);
} finally { index.close(); ocr.close(); }
