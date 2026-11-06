import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookReader } from '@/components/book-reader';
import { johnChapters } from '@/data/john-chapters';
import { scannedBookMetadata } from '@/lib/book-metadata';
import { ocrPage, ocrPages } from '@/lib/ocr-db';

export const dynamic = 'force-dynamic';

export default async function JohnChapter({ params }: { params: Promise<{ chapter: string }> }) {
  const raw = (await params).chapter;
  if (!/^\d+$/.test(raw)) notFound();
  const chapter = johnChapters.find(item => item.number === Number(raw));
  const book = ocrPage(13, 1);
  if (!chapter || !book || chapter.last > book.pages) notFound();
  const rows = new Map(ocrPages(13, chapter.first, chapter.last).map(row => [row.page, row]));
  const pages = Array.from({ length: chapter.last - chapter.first + 1 }, (_, index) => {
    const page = chapter.first + index;
    const row = rows.get(page);
    return { page, status: row?.status ?? null, scanUrl: `/api/library/book/13/${page}`, paragraphs: (row?.body ?? '').split(/\n\s*\n/).map(text => text.trim()).filter(Boolean) };
  });
  const previous = johnChapters[chapter.number - 2];
  const next = johnChapters[chapter.number];
  const meta = scannedBookMetadata(13);
  return <article className="shell about-page"><Link className="back-link" href="/library/john">‹ Содержание книги</Link><div className="page-intro"><div className="eyebrow">ЖИЗНЕОПИСАНИЕ · ГЛАВА {chapter.number}</div><h1>{chapter.title}</h1><p>Страницы PDF {chapter.first}-{chapter.last}</p></div>
    <p className="coverage-note">Границы главы сверены с печатным содержанием и страницами книги. Текст распознан автоматически и может содержать ошибки; для каждой страницы доступен скан.</p>
    <BookReader ocrReflow id={`john-chapter-${chapter.number}`} label="Автоматически распознанный текст" pages={pages}/>
    <nav className="reader-toolbar" aria-label="Главы жизнеописания">{previous ? <Link href={`/library/john/${previous.number}`}>← {previous.title}</Link> : <span/>}{next ? <Link href={`/library/john/${next.number}`}>{next.title} →</Link> : <span/>}</nav>
    <p className="coverage-note">Источник: {meta.citation} Страницы PDF {chapter.first}-{chapter.last}. {meta.rights}</p>
  </article>;
}
