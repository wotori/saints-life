import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { reviewPrintedEntries, type PrintedIndexReview } from '../src/lib/printed-index-review';

const plan = process.argv[2];
if (!plan) throw new Error('Supply a JSON file containing scan-checked review entries.');
const reviews = JSON.parse(readFileSync(plan, 'utf8')) as PrintedIndexReview[];
const index = new DatabaseSync(process.env.SAINTS_INDEX_DB ?? path.resolve('../staints-life-sources/book-indexes.sqlite3'), { timeout: 5000 });
const ocr = new DatabaseSync(process.env.SAINTS_OCR_DB ?? path.resolve('../staints-life-sources/rostovskij-ocr.sqlite3'), { readOnly: true, timeout: 5000 });
try { console.log(`Reviewed ${reviewPrintedEntries(index, ocr, reviews)} source lines.`); }
finally { index.close(); ocr.close(); }
