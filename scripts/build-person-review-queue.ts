import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { saints } from '../src/lib/repository';
import { personReviewQueue, type NameCandidate } from '../src/lib/person-review-queue';
import { applyPersonReviews } from '../src/lib/person-review-decisions';
import { personReviewBacklog } from '../src/lib/person-review-backlog';
import decisions from '../src/data/reviewed-person-candidates.json';

const run = process.argv[2] ?? 'corpus-v1';
if (!/^[a-z0-9-]+$/.test(run)) throw new Error('Invalid run name');
const archive = resolve(process.cwd(), '../staints-life-sources');
const input = resolve(archive, 'reports/name-mining', `${run}-checked.json`);
const checked = JSON.parse(readFileSync(input, 'utf8')) as { candidates: NameCandidate[]; completedChunks: number; inputChunks: number; missingChunks: number };
const db = new DatabaseSync(resolve(archive, 'rostovskij-ocr.sqlite3'), { readOnly: true });
try {
  const statement = db.prepare('SELECT p.body, b.sha256 AS sourceSha256 FROM pages p JOIN books b ON b.number=p.book_number WHERE p.book_number=? AND p.page=? AND p.status=\'ok\'');
  const report = personReviewQueue(checked.candidates, saints, (book, page) => statement.get(book, page) as { body: string; sourceSha256: string } | undefined);
  const reviewed = applyPersonReviews(report.queue, decisions, new Set(saints.map(saint => saint.id)));
  const summary = { candidates: checked.candidates.length, groups: report.queue.length,
    occurrences: report.queue.reduce((sum, row) => sum + row.occurrences.length, 0),
    unmatchedSpellings: report.queue.filter(row => row.spellingMatch === 'none').length,
    ambiguousSpellings: report.queue.filter(row => row.spellingMatch === 'ambiguous').length,
    declensionSuggestedSpellings: report.queue.filter(row => row.declensionSuggestedSaintIds.length > 0).length,
    rejected: report.rejected.length, appliedReviews: reviewed.appliedReviews, inheritedOccurrences: reviewed.inheritedOccurrences,
    invalidReviews: reviewed.invalidReviews.length, unusedReviews: reviewed.unusedReviews.length };
  const target = resolve(archive, 'reports/name-mining', `${run}-review-queue.json`);
  writeFileSync(`${target}.tmp`, JSON.stringify({ generatedAt: new Date().toISOString(), input,
    coverage: { inputChunks: checked.inputChunks, completedChunks: checked.completedChunks, missingChunks: checked.missingChunks }, summary, ...report, ...reviewed }, null, 2) + '\n');
  renameSync(`${target}.tmp`, target);
  const backlog = personReviewBacklog(reviewed.queue);
  const backlogTarget = resolve(archive, 'reports/name-mining', `${run}-pending.json`);
  writeFileSync(`${backlogTarget}.tmp`, JSON.stringify({ generatedAt: new Date().toISOString(), input,
    coverage: { inputChunks: checked.inputChunks, completedChunks: checked.completedChunks, missingChunks: checked.missingChunks },
    ...backlog }, null, 2) + '\n');
  renameSync(`${backlogTarget}.tmp`, backlogTarget);
  console.log(JSON.stringify({ ...summary, target }));
  console.log(JSON.stringify({ backlog: backlog.summary, target: backlogTarget }));
} finally { db.close(); }
