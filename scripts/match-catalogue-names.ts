import { createHash } from 'node:crypto';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { saints } from '../src/lib/repository';
import { literalPersonMatcher } from '../src/lib/literal-person-candidates';
import type { NameCandidate } from '../src/lib/person-review-queue';

const argument = process.argv[2] ?? '13';
if (!/^(?:[1-9]|1[0-3])$/.test(argument) || process.argv.length > 3) throw new Error('Usage: match-catalogue-names.ts <book 1-13>');
const book = Number(argument);
const archive = resolve(process.cwd(), '../staints-life-sources');
const db = new DatabaseSync(resolve(archive, 'rostovskij-ocr.sqlite3'), { readOnly: true });
try {
  const source = db.prepare('SELECT sha256,pages FROM books WHERE number=?').get(book) as { sha256: string; pages: number } | undefined;
  if (!source) throw new Error('Book not found');
  const pages = db.prepare("SELECT page,body FROM pages WHERE book_number=? AND status='ok' ORDER BY page").all(book) as { page: number; body: string }[];
  const matcher = literalPersonMatcher(saints);
  const candidates: NameCandidate[] = [];
  for (const page of pages) {
    const pageTextSha256 = createHash('sha256').update(page.body).digest('hex');
    for (const found of matcher.find(page.body)) candidates.push({ ...found, book, page: page.page,
      sourceSha256: source.sha256, pageTextSha256,
      chunkId: `literal-v1:${book}:${page.page}:${source.sha256}:${pageTextSha256}` });
  }
  const present = new Set(pages.map(page => page.page));
  const missing = Array.from({ length: source.pages }, (_, index) => index + 1).filter(page => !present.has(page));
  const report = {
    generatedAt: new Date().toISOString(), method: 'literal-catalogue-v1',
    scope: 'Multiword catalogue spellings only, with case, whitespace and е/ё equivalence. Includes indexes and quotations. Not identity, sainthood or exhaustive person coverage. Inflections, line hyphenation and OCR spelling errors can be missed.',
    catalogueSha256: createHash('sha256').update(JSON.stringify(saints.map(({ id, name, aliases }) => ({ id, name, aliases })))).digest('hex'),
    book, sourceSha256: source.sha256, spellings: matcher.spellings,
    inputChunks: source.pages, completedChunks: pages.length, missingChunks: missing.length,
    acceptedCandidates: candidates.length, occurrences: candidates.reduce((sum, row) => sum + row.offsets.length, 0),
    missing, candidates,
  };
  const directory = resolve(archive, 'reports/name-mining');
  mkdirSync(directory, { recursive: true });
  const target = resolve(directory, `literal-book-${book}-checked.json`);
  writeFileSync(`${target}.tmp`, JSON.stringify(report, null, 2) + '\n');
  renameSync(`${target}.tmp`, target);
  console.log(JSON.stringify({ book, pages: pages.length, missing: missing.length, spellings: matcher.spellings, candidates: candidates.length, occurrences: report.occurrences, target }));
} finally { db.close(); }
