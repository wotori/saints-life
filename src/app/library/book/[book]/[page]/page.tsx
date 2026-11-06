import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ocrPage, reviewedPageTypes } from '@/lib/ocr-db';
import { scannedBookMetadata } from '@/lib/book-metadata';
import { BookReader } from '@/components/book-reader';
import { sectionHeadings } from '@/lib/book-sections';

export const dynamic = 'force-dynamic';

export default async function RostovPage({ params, searchParams }: { params: Promise<{ book: string; page: string }>; searchParams: Promise<{ fromPrinted?: string; focus?: string }> }) {
  const raw = await params;
  if (!/^\d+$/.test(raw.book) || !/^\d+$/.test(raw.page)) notFound();
  const book = Number(raw.book), page = Number(raw.page);
  if (!Number.isSafeInteger(book) || !Number.isSafeInteger(page) || book < 1 || book > 13 || page < 1 || page > 10000) notFound();
  const item = ocrPage(book, page);
  if (!item || page > item.pages) notFound();
  const meta = scannedBookMetadata(book);
  const sections = book <= 12 && item.status === 'ok' ? sectionHeadings(item.body ?? '') : [];
  const paragraphs = (item.body ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const query = await searchParams;
  const focus = typeof query.focus === 'string' ? query.focus.slice(0, 60).trim() : '';
  return <article className="shell about-page">
    <Link className="back-link" href="/library">‹ Все книги</Link>
    {book <= 12 && <p><Link href={`/library/book/${book}/contents`}>Содержание книги →</Link></p>}
    <div className="page-intro"><div className="eyebrow">{meta.group}</div><h1>{item.title}</h1><p>Страница PDF {page} из {item.pages} · {meta.publisher}</p></div>
    {query.fromPrinted && <p className="coverage-note">Переход с печатной страницы выполнен автоматически. Сверьте номер и текст со сканом книги.</p>}
    <nav className="reader-toolbar" aria-label="Страницы книги">
      {page > 1 ? <Link href={`/library/book/${book}/${page - 1}`}>← Предыдущая</Link> : <span/>}
      <form action={`/library/book/${book}`} className="page-jump-form"><label>Страница <input type="number" name="page" min="1" max={item.pages} defaultValue={page}/></label><button type="submit">Перейти</button></form>
      {page < item.pages ? <Link href={`/library/book/${book}/${page + 1}`}>Следующая →</Link> : <span/>}
    </nav>
    <p className="coverage-note"><Link href={`/library/book/${book}/${page}/continuous`}>Читать подряд несколько страниц →</Link></p>
    {sections.length > 0 && <section className="month-results"><div className="eyebrow">НАЧАЛА РАЗДЕЛОВ НА СТРАНИЦЕ</div><p className="small-muted">Границы определены автоматически и могут содержать ошибки.</p>{sections.map((section, index) => <Link className="calendar-saint" key={section.offset} href={`/library/book/${book}/${page}/work/${index}`}><div><h3>{section.title}</h3><p>Читать раздел подряд →</p></div></Link>)}</section>}
    <p className="coverage-note">{meta.note} <a href={`/api/library/book/${book}/${page}`} target="_blank" rel="noreferrer">Открыть скан страницы ↗</a></p>
    {item.status === 'ok' ? <BookReader ocrReflow focus={focus} emptyScan={{ url: `/api/library/book/${book}/${page}`, page, reviewedType: reviewedPageTypes(book, page, page)[page] }} key={`${book}-${page}`} id={`scan-${book}-${page}`} label="Автоматически распознанный текст" paragraphs={paragraphs}/> : <div className="empty-state"><h2>Страница ещё не распознана</h2><p>Скан уже доступен. Текст появится после локальной обработки книги.</p><a className="button" href={`/api/library/book/${book}/${page}`} target="_blank" rel="noreferrer">Открыть скан страницы ↗</a></div>}
    <p className="coverage-note">Источник: {meta.citation} Страница PDF {page}. {meta.rights}</p>
  </article>;
}
