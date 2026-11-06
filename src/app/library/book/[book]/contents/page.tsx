import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ocrBooks, ocrSections } from '@/lib/ocr-db';
import { scannedBookMetadata } from '@/lib/book-metadata';

export const dynamic = 'force-dynamic';
const pageSize = 50;

export default async function BookContents({ params, searchParams }: { params: Promise<{ book: string }>; searchParams: Promise<{ q?: string; p?: string }> }) {
  const { book: raw } = await params;
  if (!/^(?:[1-9]|1[0-2])$/.test(raw)) notFound();
  const book = Number(raw), item = ocrBooks().find(row => row.number === book);
  if (!item) notFound();
  const search = await searchParams;
  const q = typeof search.q === 'string' ? search.q.trim().slice(0, 200) : '';
  const sections = ocrSections(book, q);
  const totalPages = Math.max(1, Math.ceil(sections.length / pageSize));
  const requested = typeof search.p === 'string' && /^\d{1,6}$/.test(search.p) ? Number(search.p) : 1;
  const current = Math.min(totalPages, Math.max(1, requested));
  const href = (page: number) => `/library/book/${book}/contents?${new URLSearchParams({ ...(q ? { q } : {}), p: String(page) })}`;
  const meta = scannedBookMetadata(book);
  return <div className="shell sources-page">
    <Link className="back-link" href="/library">‹ Все книги</Link>
    <div className="page-intro"><div className="eyebrow">{meta.group}</div><h1>Книга {book}: содержание</h1><p>{meta.publisher} · страниц PDF: {item.pages}</p></div>
    <p className="coverage-note">Заголовки найдены автоматически в тексте страниц. Список может содержать ошибки и пропуски и не заменяет печатное оглавление. Каждый раздел можно сверить со сканом.</p>
    <p><Link href={`/library/book/${book}/1`}>Открыть книгу с первой страницы →</Link> · <Link href={`/library/index?book=${book}`}>Именной указатель книги →</Link></p>
    <form className="search-box" action={`/library/book/${book}/contents`}><input name="q" aria-label="Поиск по содержанию книги" placeholder="Имя или слово в заголовке" defaultValue={q}/><button type="submit" aria-label="Найти">→</button></form>
    <p className="coverage-note">Найдено заголовков: {sections.length}. Страница {current} из {totalPages}.</p>
    <div className="sources-list">{sections.slice((current - 1) * pageSize, current * pageSize).map(entry => <article className="source-row" key={`${entry.page}-${entry.section}`}><span className="source-number">{entry.page}</span><div><h2><Link href={`/library/book/${book}/${entry.page}/work/${entry.section}`}>{entry.title} ↗</Link></h2><p className="source-publisher">Страница PDF {entry.page} · <a href={`/api/library/book/${book}/${entry.page}`} target="_blank" rel="noreferrer">скан страницы ↗</a></p></div></article>)}</div>
    {sections.length === 0 && <p>Заголовков не найдено. Попробуйте поиск по тексту или откройте страницы книги.</p>}
    <nav className="reader-toolbar" aria-label="Страницы содержания">{current > 1 ? <Link href={href(current - 1)}>← Назад</Link> : <span/>}{current < totalPages ? <Link href={href(current + 1)}>Далее →</Link> : <span/>}</nav>
    <p className="coverage-note">Источник: {meta.citation} {meta.rights}</p>
  </div>;
}
