import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookReader } from '@/components/book-reader';
import { scannedBookMetadata } from '@/lib/book-metadata';
import { sectionHeadings } from '@/lib/book-sections';
import { dayHeadingOffsets } from '@/lib/book-days';
import { extractRunningHeading } from '@/lib/search-terms';
import { reviewedBoundary } from '@/lib/reviewed-book-boundaries';
import { reviewedSectionType } from '@/lib/reviewed-book-section-types';
import { reviewedBookSupplement, withoutPreviousWorkSupplements } from '@/lib/reviewed-book-supplements';
import { ocrPage, ocrPages, reviewedPageTypes } from '@/lib/ocr-db';
import type { ReaderPage } from '@/components/book-reader';

export const dynamic = 'force-dynamic';
const maxPages = 40;

export default async function BookWorkPage({ params, searchParams }: { params: Promise<{ book: string; page: string; section: string }>; searchParams: Promise<{ from?: string }> }) {
  const raw = await params;
  if (![raw.book, raw.page, raw.section].every(value => /^\d+$/.test(value))) notFound();
  const book = Number(raw.book), first = Number(raw.page), section = Number(raw.section);
  if (![book, first, section].every(Number.isSafeInteger) || book < 1 || book > 12 || first < 1 || first > 10000 || section > 100) notFound();
  const item = ocrPage(book, first);
  if (!item || first > item.pages || item.status !== 'ok') notFound();
  const selected = sectionHeadings(item.body ?? '')[section];
  if (!selected) notFound();
  const rawFrom = (await searchParams).from;
  if (rawFrom !== undefined && (typeof rawFrom !== 'string' || !/^\d{1,5}$/.test(rawFrom))) notFound();
  const fromPage = rawFrom === undefined ? first : Number(rawFrom);
  if (!Number.isSafeInteger(fromPage) || fromPage < first || fromPage > item.pages || (fromPage - first) % maxPages !== 0) notFound();
  const last = Math.min(item.pages, fromPage + maxPages - 1);
  const rows = new Map(ocrPages(book, first, last).map(row => [row.page, row]));
  const reviews = reviewedPageTypes(book, first, last);
  const sectionReview = reviewedSectionType(book, first, selected.title, item.source_sha256, page => rows.get(page)?.body ?? undefined);
  const pages: ReaderPage[] = [];
  let end: 'heading' | 'day' | 'reviewed' | 'pending' | 'limit' | 'book' = last === item.pages ? 'book' : 'limit';
  let nextPage: number | undefined;
  for (let page = first; page <= last; page++) {
    const row = rows.get(page);
    if (!row || row.status !== 'ok') { if (page < fromPage) notFound(); end = 'pending'; nextPage = page; break; }
    const body = row.body ?? '';
    const from = page === first ? selected.offset : 0;
    const next = sectionHeadings(body).find(heading => heading.offset > from || (page !== first && heading.offset === 0));
    const nextDay = dayHeadingOffsets(body).find(offset => offset > from || (page !== first && offset === 0));
    const reviewed = reviewedBoundary(book, first, selected.title, item.source_sha256, page, body);
    const candidates = [{ kind: 'heading' as const, offset: next?.offset }, { kind: 'day' as const, offset: nextDay }, { kind: 'reviewed' as const, offset: reviewed }].filter((candidate): candidate is { kind: 'heading' | 'day' | 'reviewed'; offset: number } => candidate.offset !== undefined && (candidate.offset > from || (page !== first && candidate.offset === 0))).sort((a, b) => a.offset - b.offset);
    const boundary = candidates[0]?.offset;
    let text = body.slice(from, boundary);
    text = withoutPreviousWorkSupplements(book, first, item.source_sha256, page, body, text, undefined, selected.title);
    // The running header on a boundary page can name the next work, not the preceding one.
    if (boundary !== undefined && page !== first && extractRunningHeading(text)) {
      const newline = text.indexOf('\n');
      text = newline < 0 ? '' : text.slice(newline + 1);
    }
    if (page >= fromPage && (text.trim() || (boundary === undefined && !body.trim()))) pages.push({ page, status: row.status, scanUrl: `/api/library/book/${book}/${page}`, paragraphs: text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean), reviewedType: reviews[page] });
    if (boundary !== undefined) {
      if (page < fromPage) notFound();
      const supplement = reviewedBookSupplement(book, first, selected.title, item.source_sha256, page, body);
      if (supplement) {
        const paragraphs = ['Примечание к этому произведению.', ...supplement.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)];
        const existing = pages.find(item => item.page === page);
        if (existing) existing.paragraphs.push(...paragraphs);
        else pages.push({ page, status: row.status, scanUrl: `/api/library/book/${book}/${page}`, paragraphs, reviewedType: reviews[page] });
      }
      end = candidates[0].kind; nextPage = page; break;
    }
  }
  const meta = scannedBookMetadata(book);
  const workPath = `/library/book/${book}/${first}/work/${section}`;
  const previous = fromPage - maxPages;
  return <article className="shell about-page">
    <Link className="back-link" href={`/library/book/${book}/${first}`}>‹ Страница {first} книги</Link>
    <div className="page-intro"><div className="eyebrow">{meta.group}</div><h1>{selected.title}</h1><p>{item.title} · {fromPage === first ? `начиная со страницы PDF ${first}` : `продолжение со страницы PDF ${fromPage}`}</p></div>
    <p className="coverage-note">Начало и конец раздела определены автоматически по оформлению страниц. OCR может пропустить заголовок, поэтому текст может быть неполным или включать соседнее произведение. Сверяйте каждую страницу со сканом.</p>
    {sectionReview && <aside className="coverage-note" aria-label="Вид произведения"><strong>{sectionReview.label}.</strong> {sectionReview.note}</aside>}
    <BookReader ocrReflow key={`${book}-${first}-${section}-${fromPage}`} id={`work-${book}-${first}-${section}${fromPage === first ? '' : `-${fromPage}`}`} label="Текст распознан автоматически" pages={pages}/>
    <p className="coverage-note">{end === 'heading' ? 'Достигнут следующий распознанный заголовок.' : end === 'day' ? 'Достигнут заголовок следующего дня.' : end === 'reviewed' ? 'Достигнута граница, сверенная со сканом.' : end === 'pending' ? 'Дальнейшие страницы ещё не распознаны.' : end === 'limit' ? `Показаны страницы PDF ${fromPage}-${last}.` : 'Достигнут конец книги.'} {nextPage && <Link href={`/library/book/${book}/${nextPage}`}>Открыть страницу {nextPage} →</Link>}</p>
    {(fromPage > first || end === 'limit') && <nav className="reader-toolbar" aria-label="Части жития">{fromPage > first ? <Link href={previous === first ? workPath : `${workPath}?from=${previous}`}>← Предыдущая часть</Link> : <span/>}{end === 'limit' ? <Link href={`${workPath}?from=${last + 1}`}>Продолжить чтение →</Link> : <span/>}</nav>}
    <p className="coverage-note">Источник: {meta.citation} {meta.rights}</p>
  </article>;
}
