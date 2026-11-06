import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookReader } from '@/components/book-reader';
import { scannedBookMetadata } from '@/lib/book-metadata';
import { ocrPage, ocrPages, reviewedPageTypes } from '@/lib/ocr-db';

export const dynamic = 'force-dynamic';
const batchSize = 10;

export default async function ContinuousBookPage({ params }: { params: Promise<{ book: string; page: string }> }) {
  const raw = await params;
  if (!/^\d+$/.test(raw.book) || !/^\d+$/.test(raw.page)) notFound();
  const book = Number(raw.book), first = Number(raw.page);
  if (!Number.isSafeInteger(book) || !Number.isSafeInteger(first) || book < 1 || book > 13 || first < 1 || first > 10000) notFound();
  const item = ocrPage(book, first);
  if (!item || first > item.pages) notFound();
  const last = Math.min(first + batchSize - 1, item.pages);
  const recognized = new Map(ocrPages(book, first, last).map(page => [page.page, page]));
  const reviews = reviewedPageTypes(book, first, last);
  const pages = Array.from({ length: last - first + 1 }, (_, index) => {
    const page = first + index;
    const result = recognized.get(page);
    return { page, status: result?.status ?? null, scanUrl: `/api/library/book/${book}/${page}`, paragraphs: (result?.body ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean), reviewedType: reviews[page] };
  });
  const meta = scannedBookMetadata(book);
  return <article className="shell about-page">
    <Link className="back-link" href={`/library/book/${book}/${first}`}>‹ К странице {first}</Link>
    <div className="page-intro"><div className="eyebrow">{meta.group}</div><h1>{item.title}</h1><p>Непрерывное чтение · страницы PDF {first}-{last} из {item.pages}</p></div>
    <p className="coverage-note">Текст распознан автоматически и может содержать ошибки. У каждой страницы есть ссылка на скан. Страницы ещё в обработке отмечены отдельно.</p>
    <BookReader ocrReflow key={`${book}-${first}`} id={`scan-range-${book}-${first}`} label="Автоматически распознанный текст" pages={pages}/>
    <nav className="reader-toolbar" aria-label="Следующие и предыдущие страницы">
      {first > 1 ? <Link href={`/library/book/${book}/${Math.max(1, first - batchSize)}/continuous`}>← Предыдущие страницы</Link> : <span/>}
      {last < item.pages ? <Link href={`/library/book/${book}/${last + 1}/continuous`}>Следующие страницы →</Link> : <span/>}
    </nav>
    <p className="coverage-note">Источник: {meta.citation} Страницы PDF {first}-{last}. {meta.rights}</p>
  </article>;
}
