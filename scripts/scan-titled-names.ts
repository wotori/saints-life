import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { scanTitledNameCandidates } from '../src/lib/titled-name-candidates';
import type { NameCandidate } from '../src/lib/person-review-queue';

const archive = resolve(process.cwd(), '../staints-life-sources');
const db = new DatabaseSync(resolve(archive, 'rostovskij-ocr.sqlite3'), { readOnly: true });
try {
  const rows = db.prepare('SELECT p.book_number AS book, p.page, p.body, p.status, b.sha256 AS sourceSha256 FROM pages p JOIN books b ON b.number=p.book_number ORDER BY p.book_number,p.page').all() as {
    book: number; page: number; body: string; status: string; sourceSha256: string;
  }[];
  const candidates: NameCandidate[] = [];
  const excludedTerms: NameCandidate[] = [];
  const unscannedPages: { book: number; page: number; status: string }[] = [];
  for (const row of rows) {
    if (row.status !== 'ok') { unscannedPages.push({ book: row.book, page: row.page, status: row.status }); continue; }
    const pageTextSha256 = createHash('sha256').update(row.body).digest('hex');
    const scan = scanTitledNameCandidates(row.body);
    for (const [matches, target] of [[scan.candidates, candidates], [scan.excludedTerms, excludedTerms]] as const) {
      for (const match of matches) target.push({ ...match, book: row.book, page: row.page,
        sourceSha256: row.sourceSha256, pageTextSha256, chunkId: `titled-prefix-v1:${row.book}:${row.page}:${pageTextSha256}` });
    }
  }
  const folder = resolve(archive, 'reports/name-mining');
  mkdirSync(folder, { recursive: true });
  const target = resolve(folder, 'titled-prefix-v1-checked.json');
  const report = { generatedAt: new Date().toISOString(),
    scope: 'Deterministic literal title-adjacent first-name hints from stored OCR pages. Page scan coverage is not name completeness or verified sainthood. Uppercase headings, split names, other titles and names without these prefixes are not covered. No identity decisions are generated.',
    unit: 'stored OCR page', inputChunks: rows.length, completedChunks: rows.length - unscannedPages.length,
    missingChunks: unscannedPages.length, unscannedPages, candidates, excludedTerms,
    exclusionScope: 'Explicit non-name terms only. Excluded literal spans remain available for audit; no person review decisions are generated.' };
  writeFileSync(`${target}.tmp`, JSON.stringify(report, null, 2) + '\n');
  renameSync(`${target}.tmp`, target);
  console.log(JSON.stringify({ pages: rows.length, scannedPages: report.completedChunks,
    unscannedPages: unscannedPages.length, candidateSpellingsPerPage: candidates.length,
    excludedSpellingsPerPage: excludedTerms.length, target }));
} finally { db.close(); }
