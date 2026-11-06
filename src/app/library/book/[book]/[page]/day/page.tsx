import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookReader, type ReaderPage } from '@/components/book-reader';
import { scannedBookMetadata } from '@/lib/book-metadata';
import { MONTHS_GENITIVE } from '@/lib/calendar';
import { ocrBookDayRange, ocrPage, ocrPages, reviewedPageTypes } from '@/lib/ocr-db';

export const dynamic = 'force-dynamic';
const batchSize = 40;

export default async function BookDayPage({ params, searchParams }: { params: Promise<{ book: string; page: string }>; searchParams: Promise<{ from?: string }> }) {
  const raw = await params;
  if (!/^\d+$/.test(raw.book) || !/^\d+$/.test(raw.page)) notFound();
  const book = Number(raw.book), first = Number(raw.page);
  if (!Number.isSafeInteger(book) || !Number.isSafeInteger(first) || book < 1 || book > 12 || first < 1 || first > 10000) notFound();
  const item = ocrPage(book, first), range = ocrBookDayRange(book, first);
  if (!item || !range || item.status !== 'ok') notFound();
  const rawFrom = (await searchParams).from;
  if (rawFrom !== undefined && (typeof rawFrom !== 'string' || !/^\d{1,5}$/.test(rawFrom))) notFound();
  const from = rawFrom === undefined ? first : Number(rawFrom);
  const end = range.nextOffset === 0 ? range.nextPage - 1 : range.nextPage;
  if (!Number.isSafeInteger(from) || from < first || from > end || (from - first) % batchSize !== 0) notFound();
  const last = Math.min(end, from + batchSize - 1);
  const rows = new Map(ocrPages(book, from, last).map(row => [row.page, row]));
  const reviews = reviewedPageTypes(book, from, last);
  const pages: ReaderPage[] = [];
  for (let page = from; page <= last; page++) {
    const row = rows.get(page);
    if (!row || row.status !== 'ok') notFound();
    const body = row.body ?? '';
    const text = body.slice(page === first ? range.firstOffset : 0, page === range.nextPage ? range.nextOffset : undefined);
    if (text.trim() || !body.trim()) pages.push({ page, status: row.status, scanUrl: `/api/library/book/${book}/${page}`, paragraphs: text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean), reviewedType: reviews[page] });
  }
  const month = (book + 7) % 12 + 1;
  const meta = scannedBookMetadata(book);
  const path = `/library/book/${book}/${first}/day`;
  return <article className="shell about-page">
    <Link className="back-link" href={`/library/book/${book}/${first}`}>‹ Страница {first} книги</Link>
    <div className="page-intro"><div className="eyebrow">ДЕНЬ В КНИГЕ {book}</div><h1>{range.day} {MONTHS_GENITIVE[month - 1]} по старому стилю</h1><p>{item.title} · страницы PDF {from}-{last}</p></div>
    <p className="coverage-note">{range.kind === 'day' ? 'Начало и конец дня определены автоматически по заголовкам издания.' : 'Начало дня найдено автоматически, конец тома перед указателем или приложениями сверен со сканом.'} OCR может содержать ошибки; сверяйте текст со сканами. Книга не устанавливает почитание во всех традициях.</p>
    <BookReader ocrReflow key={`${book}-${first}-${from}`} id={`day-${book}-${first}-${from}`} label="Текст распознан автоматически" pages={pages}/>
    <nav className="reader-toolbar" aria-label="Части книжного дня">{from > first ? <Link href={from - batchSize === first ? path : `${path}?from=${from - batchSize}`}>← Предыдущая часть</Link> : <span/>}{last < end ? <Link href={`${path}?from=${last + 1}`}>Продолжить чтение →</Link> : <span/>}</nav>
    {last === end && <p className="coverage-note">{range.kind === 'day' ? 'Достигнут следующий распознанный день.' : range.kind === 'index' ? 'Достигнут сверенный по скану конец текста перед указателем.' : 'Достигнут сверенный по скану конец текста перед приложениями.'} <Link href={`/library/book/${book}/${range.nextPage}`}>{range.kind === 'day' ? 'Открыть страницу следующего дня →' : 'Открыть следующую страницу →'}</Link></p>}
    <p className="coverage-note">Источник: {meta.citation} {meta.rights}</p>
  </article>;
}
