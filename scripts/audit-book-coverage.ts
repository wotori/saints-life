import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import seventyRoster from '../src/data/reviewed-seventy-apostles.json';
import { sectionHeadings } from '../src/lib/book-sections';
import { reviewedMentionRecords } from '../src/lib/reviewed-book-mentions';
import { narrativeReviews, narrativeReviewMatches } from '../src/lib/reviewed-narrative-occurrences';
import { reviewedSectionTypes, reviewedSectionType } from '../src/lib/reviewed-book-section-types';
import { reviewedBookSupplements, reviewedBookSupplement } from '../src/lib/reviewed-book-supplements';
import { collectiveMemories, collectiveReading } from '../src/lib/collective-memories';
import { saints } from '../src/lib/repository';
import { reviewedSaintLinkErrors } from '../src/lib/reviewed-saint-links';

// This is a reproducible editorial queue, not proof that every saint has been identified.
const archive = resolve(process.env.SAINTS_SOURCES_DIR ?? '../staints-life-sources');
const db = new DatabaseSync(resolve(archive, 'rostovskij-ocr.sqlite3'), { readOnly: true });
type Work = { book: number; page: number; sourceSha256: string; expectedHeading: string; saintIds: string[] };
const works: Work[] = JSON.parse(readFileSync('src/data/reviewed-book-work-links.json', 'utf8')).works;
const key = (book: number, page: number, heading: string) => JSON.stringify([book, page, heading]);
const linked = new Map(works.map(work => [key(work.book, work.page, work.expectedHeading), work]));
if (linked.size !== works.length) throw new Error('Duplicate reviewed work keys');
const verified = new Set<string>();
const items: Record<string, unknown>[] = [];
const personCoverageItems: Record<string, unknown>[] = [];
const books: Record<string, unknown>[] = [];
const shortMemories: Record<string, unknown>[] = [];
const errors: string[] = [];
const verifiedNarratives = new Set<number>();
const verifiedSectionTypes = new Set<string>();
const narrativeKeys = narrativeReviews.map(record => key(record.book, record.page, record.anchor));
if (new Set(narrativeKeys).size !== narrativeKeys.length) throw new Error('Duplicate narrative review keys');
function suggestedKind(heading: string) {
  if (/ВСЕЛЕНСК/u.test(heading)) return 'council';
  if (/АРХАНГЕЛА|АРХИСТРАТИГА/u.test(heading)) return 'angelic-synaxis';
  if (/СЕМИДЕСЯТИ АПОСТОЛОВ/u.test(heading)) return 'named-collective';
  if (/МУЧЕНИКОВ|ТРЕХ ЖЕН|МЛАДЕНЦЕВ/u.test(heading)) return 'collective-memory';
  if (/ПОВЕСТЬ|ОТШЕЛЬНИКЕ/u.test(heading)) return 'edifying-narrative';
  if (/СЛОВО|СИНАКСАРЬ/u.test(heading)) return 'sermon';
  return 'feast-or-event';
}
try {
  const knownSaintIds = new Set(saints.map(saint => saint.id));
  errors.push(...reviewedSaintLinkErrors(works, knownSaintIds, 'work'));
  errors.push(...reviewedSaintLinkErrors(reviewedMentionRecords(), knownSaintIds, 'mention'));
  errors.push(...reviewedSaintLinkErrors(
    [...seventyRoster.records, ...seventyRoster.appendixRecords].map(record => ({ ...record, book: seventyRoster.book })),
    knownSaintIds, 'seventy apostles roster',
  ));
  for (const record of reviewedBookSupplements) {
    const row = db.prepare('SELECT p.body,b.sha256 FROM pages p JOIN books b ON b.number=p.book_number WHERE p.book_number=? AND p.page=?').get(record.book, record.page) as { body: string; sha256: string } | undefined;
    const first = db.prepare('SELECT body FROM pages WHERE book_number=? AND page=?').get(record.book, record.firstPage) as { body: string } | undefined;
    if (!row || !first || sectionHeadings(first.body).filter(h => h.title === record.heading).length !== 1 || !reviewedBookSupplement(record.book, record.firstPage, record.heading, row.sha256, record.page, row.body)) errors.push(`Unverified continued footnote: ${record.book}/${record.firstPage}/${record.page}`);
  }
  // Mentions outside the short-memory formula also need repeatable validation.
  for (const record of reviewedMentionRecords()) {
    const row = db.prepare('SELECT p.body,b.sha256 FROM pages p JOIN books b ON b.number=p.book_number WHERE p.book_number=? AND p.page=?').get(record.book, record.page) as { body: string; sha256: string } | undefined;
    const offset = row?.body.indexOf(record.anchor) ?? -1;
    if (!row || row.sha256 !== record.sourceSha256 || !record.anchor || offset < 0 || row.body.indexOf(record.anchor, offset + 1) !== -1) errors.push(`Unverified mention: ${record.book}/${record.page}: ${record.anchor}`);
  }
  for (const record of collectiveMemories) {
    const row = db.prepare('SELECT p.body,b.sha256 FROM pages p JOIN books b ON b.number=p.book_number WHERE p.book_number=? AND p.page=?').get(record.book, record.page) as { body: string; sha256: string } | undefined;
    if (!row || !collectiveReading(record, row.sha256, row.body)) errors.push(`Unverified collective memory: ${record.id}`);
  }
  // A shared heading alone cannot verify the identities in a collective work.
  const rosterBook = db.prepare('SELECT sha256 FROM books WHERE number=?').get(seventyRoster.book) as { sha256: string } | undefined;
  const rosterWork = works.find(work => work.book === seventyRoster.book && work.page === seventyRoster.firstPage);
  const rosterIds = seventyRoster.records.flatMap(record => record.saintIds);
  if (rosterBook?.sha256 !== seventyRoster.sourceSha256 || rosterWork?.sourceSha256 !== seventyRoster.sourceSha256) errors.push('Seventy apostles roster edition mismatch');
  if (new Set(rosterIds).size !== rosterIds.length || JSON.stringify([...rosterIds].sort()) !== JSON.stringify([...(rosterWork?.saintIds ?? [])].sort())) errors.push('Seventy apostles roster and work links differ');
  for (const record of [...seventyRoster.records, ...seventyRoster.appendixRecords]) {
    const page = db.prepare('SELECT body FROM pages WHERE book_number=? AND page=?').get(seventyRoster.book, record.page) as { body: string } | undefined;
    if (!page || createHash('sha256').update(page.body).digest('hex') !== record.pageTextSha256) errors.push(`Seventy apostles roster OCR changed: ${seventyRoster.book}/${record.page}`);
  }
  for (const record of seventyRoster.appendixRecords) {
    for (const id of record.saintIds) {
      if (!reviewedMentionRecords().some(mention => mention.book === seventyRoster.book && mention.page === record.page && mention.sourceSha256 === seventyRoster.sourceSha256 && (mention.saintIds as readonly string[]).includes(id))) errors.push(`Missing appendix mention: ${id}`);
    }
  }
  const rows = db.prepare('SELECT number, title, pages, sha256, source_path FROM books WHERE number BETWEEN 1 AND 12 ORDER BY number').all() as { number: number; title: string; pages: number; sha256: string; source_path: string }[];
  if (rows.length !== 12) throw new Error(`Expected 12 Rostovsky books, found ${rows.length}`);
  for (const book of rows) {
    let detected = 0, reviewed = 0;
    const pages = db.prepare('SELECT page, body, status FROM pages WHERE book_number=? ORDER BY page').all(book.number) as { page: number; body: string; status: string }[];
    for (const page of pages) {
      for (const match of (page.body ?? '').matchAll(/(?:^|\n)(В тот же день[^\n]*)/gu)) {
        const offset = match.index! + (match[0].startsWith('\n') ? 1 : 0);
        const saved = reviewedMentionRecords().filter(record => record.book === book.number && record.page === page.page && record.sourceSha256 === book.sha256 && page.body.indexOf(record.anchor) === offset && page.body.indexOf(record.anchor, offset + 1) === -1);
        const narrativeIndex = narrativeReviews.findIndex(record => record.anchor === match[1] && narrativeReviewMatches(record, { book: book.number, page: page.page, sourceSha256: book.sha256, body: page.body }));
        const narrative = narrativeReviews[narrativeIndex];
        const collective = collectiveMemories.find(record => record.book === book.number && record.page === page.page && page.body.indexOf(record.anchor) === offset && collectiveReading(record, book.sha256, page.body));
        if (narrative) verifiedNarratives.add(narrativeIndex);
        shortMemories.push({ linkedSaintIds: [...new Set(saved.flatMap(record => [...record.saintIds]))], book: book.number, page: page.page, sourceSha256: book.sha256,
          anchor: match[1], offset, reviewStatus: saved.length ? 'has-reviewed-links' : collective ? 'reviewed-collective' : narrative ? 'reviewed-narrative' : 'candidate',
          ...(collective ? { collectiveId: collective.id } : {}),
          ...(narrative ? { narrativeReview: { note: narrative.note, pageTextSha256: narrative.pageTextSha256, scope: 'Phrase classification only; named-person coverage remains a separate review.' } } : {}),
          textUrl: `/library/book/${book.number}/${page.page}`,
          scanUrl: `/api/library/book/${book.number}/${page.page}`,
          context: page.body.slice(offset, offset + 800),
        });
      }
      for (const [section, heading] of sectionHeadings(page.body ?? '').entries()) {
        detected++;
        const id = key(book.number, page.page, heading.title);
        const work = linked.get(id);
        const sectionReview = reviewedSectionType(book.number, page.page, heading.title, book.sha256, number => pages.find(row => row.page === number)?.body ?? undefined);
        if (sectionReview) verifiedSectionTypes.add(id);
        // A valid navigation link is not evidence that every person in the text was reviewed.
        personCoverageItems.push({
          book: book.number, page: page.page, heading: heading.title, sourceSha256: book.sha256,
          textUrl: `/library/book/${book.number}/${page.page}/work/${section}`,
          scanUrl: `/api/library/book/${book.number}/${page.page}`, sourcePath: book.source_path,
          linkedSaintIds: work?.sourceSha256 === book.sha256 ? work.saintIds : [],
          coverageStatus: sectionReview?.personCoverage === 'no-named-saints'
            ? 'reviewed-no-named-saints'
            : sectionReview ? 'persons-unresolved' : 'full-person-review-not-recorded',
          ...(sectionReview ? { reviewNote: sectionReview.note, reviewedPages: sectionReview.pages } : {}),
        });
        if (work && work.sourceSha256 === book.sha256) {
          reviewed++;
          verified.add(id);
        } else {
          if (work) errors.push(`Source checksum changed: ${id}`);
          const collective = collectiveMemories.find(record => record.book === book.number && record.page === page.page && record.heading === heading.title && collectiveReading(record, book.sha256, page.body));
          items.push({ book: book.number, page: page.page, heading: heading.title, sourceSha256: book.sha256,
            section, textUrl: `/library/book/${book.number}/${page.page}/work/${section}`,
            scanUrl: `/api/library/book/${book.number}/${page.page}`, sourcePath: book.source_path,
            suggestedKind: suggestedKind(heading.title), reviewStatus: sectionReview?.personCoverage === 'no-named-saints' ? 'type-reviewed-no-named-saints' : sectionReview ? 'type-reviewed-persons-unresolved' : 'pending',
            ...(sectionReview ? { typeReview: sectionReview } : {}),
            ...(collective ? { collectiveId: collective.id, collectiveReadingUrl: collectiveReading(collective, book.sha256, page.body)?.href } : {}),
            nextAction: sectionReview?.personCoverage === 'no-named-saints'
              ? 'Именованные святые для отдельных карточек не обнаружены в проверенном рассказе. Сохранить текст и его источник; не создавать персон из безымянных участников.'
              : 'Сверить полный текст и скан, выделить именованных участников и тип произведения. Тип по заголовку предварительный.',
            headingContext: page.body.slice(heading.offset, heading.offset + 600),
          });
        }
      }
    }
    books.push({ book: book.number, title: book.title, sourceSha256: book.sha256, expectedPages: book.pages,
      storedPages: pages.length, pageStatuses: Object.fromEntries([...new Set(pages.map(p => p.status))].map(status => [status, pages.filter(p => p.status === status).length])),
      detectedHeadings: detected, reviewedPersonLinks: reviewed, pendingHeadings: detected - reviewed });
  }
  for (const work of works) if (!verified.has(key(work.book, work.page, work.expectedHeading))) errors.push(`Unverified reviewed link: ${key(work.book, work.page, work.expectedHeading)}`);
  for (const record of reviewedSectionTypes) if (!verifiedSectionTypes.has(key(record.book, record.page, record.heading))) errors.push(`Unverified section type: ${key(record.book, record.page, record.heading)}`);
  const narrativeErrors = narrativeReviews.flatMap((record, index) => verifiedNarratives.has(index) ? [] : [`Unverified narrative review: ${key(record.book, record.page, record.anchor)}`]);
  const report = {
    generatedAt: new Date().toISOString(),
    scope: 'Automatically detected headings without reviewed person links; not a completeness certificate. Short mentions and missed OCR headings are outside this report.',
    classification: 'Suggested types are inferred from headings. Explicit typeReview records are checked against edition and OCR checksums. Reviewed types do not resolve person coverage or remove entries.',
    totals: { detectedHeadings: books.reduce((n, b) => n + Number(b.detectedHeadings), 0), reviewedPersonLinks: verified.size, pendingHeadings: items.length, reviewedSectionTypes: verifiedSectionTypes.size, collectiveReadingLinks: items.filter(item => item.collectiveId).length, invalidReviewedLinks: errors.length },
    suggestedKinds: Object.fromEntries([...new Set(items.map(i => String(i.suggestedKind)))].sort().map(kind => [kind, items.filter(i => i.suggestedKind === kind).length])),
    books, errors, items,
  };
  const reports = resolve(archive, 'reports');
  mkdirSync(reports, { recursive: true });
  const target = resolve(reports, 'unlinked-headings.json');
  writeFileSync(`${target}.tmp`, JSON.stringify(report, null, 2) + '\n');
  renameSync(`${target}.tmp`, target);
  const coverageTarget = resolve(reports, 'person-coverage.json');
  const coverageStatuses = ['reviewed-no-named-saints', 'persons-unresolved', 'full-person-review-not-recorded'];
  writeFileSync(`${coverageTarget}.tmp`, JSON.stringify({
    generatedAt: report.generatedAt,
    scope: 'All automatically detected Rostovsky headings, including those with person links. This is a review inventory, not proof of complete coverage of saints. Separate roster and individual link reviews remain valid but do not certify every person in a whole work.',
    exclusions: ['Headings missed by OCR', 'Short memories outside headings', 'Children\u2019s book and John of Shanghai collection', 'Names not yet identified within a work'],
    totals: {
      detectedHeadings: personCoverageItems.length,
      byStatus: Object.fromEntries(coverageStatuses.map(status => [status, personCoverageItems.filter(item => item.coverageStatus === status).length])),
      linkedWorksWithUnresolvedPersons: personCoverageItems.filter(item => item.coverageStatus === 'persons-unresolved' && (item.linkedSaintIds as string[]).length > 0).length,
    },
    errors, items: personCoverageItems,
  }, null, 2) + '\n');
  renameSync(`${coverageTarget}.tmp`, coverageTarget);
  const mentionsTarget = resolve(reports, 'short-memory-candidates.json');
  writeFileSync(`${mentionsTarget}.tmp`, JSON.stringify({ generatedAt: report.generatedAt,
    scope: 'Candidates beginning with «В тот же день». Includes previously linked memories and narrative uses of the phrase. Does not detect all named people or certify review.',
    count: shortMemories.length, withReviewedLinks: shortMemories.filter(item => item.reviewStatus === 'has-reviewed-links').length,
    reviewedNarratives: shortMemories.filter(item => item.reviewStatus === 'reviewed-narrative').length,
    reviewedCollectives: shortMemories.filter(item => item.reviewStatus === 'reviewed-collective').length,
    pendingCandidates: shortMemories.filter(item => item.reviewStatus === 'candidate').length,
    errors: narrativeErrors, items: shortMemories }, null, 2) + '\n');
  renameSync(`${mentionsTarget}.tmp`, mentionsTarget);
  console.log(JSON.stringify({ ...report.totals, shortMemoryCandidates: shortMemories.length, suggestedKinds: report.suggestedKinds, report: target, personCoverageReport: coverageTarget }, null, 2));
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  if (narrativeErrors.length) { console.error(narrativeErrors.join('\n')); process.exitCode = 1; }
} finally { db.close(); }
