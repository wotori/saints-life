import Link from 'next/link';
import { ocrHeadings, searchOcrSections } from '@/lib/ocr-db';
import { printedIndexHits } from '@/lib/book-index-db';
import { scannedBookMetadata } from '@/lib/book-metadata';
import { printedIndexReference, printedIndexTextHref } from '@/lib/printed-index-display';

export const dynamic = 'force-dynamic';
const pageSize = 50;

export default async function HeadingsPage({ searchParams }: { searchParams: Promise<{ q?: string; book?: string; page?: string; sectionPage?: string }> }) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.slice(0, 200).trim() : '';
  const book = /^([1-9]|1[0-2])$/.test(params.book ?? '') ? Number(params.book) : 0;
  const allHits = printedIndexHits(query, { allowEmpty: true, limit: 10000 }).filter(hit => !book || hit.book === book);
  const totalPages = Math.max(1, Math.ceil(allHits.length / pageSize));
  const page = Math.max(1, Math.min(totalPages, Number.parseInt(params.page ?? '1', 10) || 1));
  const indexHits = allHits.slice((page - 1) * pageSize, page * pageSize);
  const headings = query ? ocrHeadings(query).filter(heading => !book || heading.book_number === book) : [];
  const sections = query ? searchOcrSections(query, book || undefined) : [];
  const sectionPages = Math.max(1, Math.ceil(sections.length / pageSize));
  const sectionPage = Math.max(1, Math.min(sectionPages, Number.parseInt(params.sectionPage ?? '1', 10) || 1));
  const sectionHref = (target: number) => `/library/index?${new URLSearchParams({ q: query, ...(book ? { book: String(book) } : {}), ...(page > 1 ? { page: String(page) } : {}), sectionPage: String(target) })}#book-sections`;
  const pageHref = (target: number) => `/library/index?${new URLSearchParams({ q: query, ...(book ? { book: String(book) } : {}), ...(sectionPage > 1 ? { sectionPage: String(sectionPage) } : {}), page: String(target) })}`;
  return <div className="shell sources-page">
    <Link className="back-link" href="/library">‹ Все книги</Link>
    <div className="page-intro"><div className="eyebrow">ПО ПЕЧАТНЫМ УКАЗАТЕЛЯМ</div><h1>Имена в книгах</h1><p>Просмотрите указатели томов или найдите имя.</p></div>
    <form className="catalog-filters" action="/library/index"><div className="search-box"><input name="q" aria-label="Поиск в названиях разделов" placeholder="Имя святого или название" defaultValue={query}/><button type="submit" aria-label="Найти">→</button></div><label>Том <select name="book" defaultValue={book ? String(book) : ''}><option value="">Все тома</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>Книга {i + 1}</option>)}</select></label><button type="submit">Применить</button></form>
    {query && <section id="book-sections"><h2>Заголовки разделов: {sections.length}</h2><p className="coverage-note">Заголовки найдены автоматически в распознанном тексте. Они могут содержать ошибки или пропуски и не устанавливают личность святого. Откройте раздел и сверьте его со сканом.</p>
      <div className="sources-list">{sections.slice((sectionPage - 1) * pageSize, sectionPage * pageSize).map(entry => <article className="source-row" key={`${entry.book_number}-${entry.page}-${entry.section}`}><span className="source-number">{entry.book_number}</span><div><h2><Link href={`/library/book/${entry.book_number}/${entry.page}/work/${entry.section}`}>{entry.title} ↗</Link></h2><p>Книга {entry.book_number} · страница PDF {entry.page} · <a href={`/api/library/book/${entry.book_number}/${entry.page}`} target="_blank" rel="noreferrer">скан страницы ↗</a></p></div></article>)}</div>
      {sections.length === 0 && <p>В распознанных заголовках совпадений нет. Попробуйте другие формы имени или поиск по тексту.</p>}
      {sectionPages > 1 && <nav className="pagination" aria-label="Страницы заголовков">{sectionPage > 1 && <Link href={sectionHref(sectionPage - 1)}>← Назад</Link>}<span>Страница {sectionPage} из {sectionPages}</span>{sectionPage < sectionPages && <Link href={sectionHref(sectionPage + 1)}>Далее →</Link>}</nav>}
    </section>}
    <section><h2>Строки печатных указателей: {allHits.length}</h2><p className="coverage-note">У каждой записи указан статус сверки. Автоматическое распознавание может содержать ошибки; ссылка на страницу книги приблизительная. Сверка строки не означает, что одинаковые имена относятся к одному человеку.</p>
      <div className="sources-list">{indexHits.map(hit => <article className="source-row" key={`${hit.book}-${hit.indexPage}-${hit.line}`}><span className="source-number">{hit.book}</span><div><h2><Link href={`/library/entry/${hit.book}/${hit.indexPage}/${hit.line}`}>{hit.title} ↗</Link></h2><p>Книга {hit.book} · {printedIndexReference(hit)}{printedIndexTextHref(hit) && <> · <Link href={printedIndexTextHref(hit)!}>открыть текст ↗</Link></>} · <a href={`/api/library/book/${hit.book}/${hit.indexPage}`} target="_blank" rel="noreferrer">скан указателя ↗</a></p></div></article>)}</div>
      {allHits.length === 0 && <p>В распознанных указателях совпадений пока нет.</p>}
      {totalPages > 1 && <nav className="pagination" aria-label="Страницы указателя">{page > 1 && <Link href={pageHref(page - 1)}>← Назад</Link>}<span>Страница {page} из {totalPages}</span>{page < totalPages && <Link href={pageHref(page + 1)}>Далее →</Link>}</nav>}
    </section>
    {query && <section><p className="coverage-note">Названий в колонтитулах: {headings.length}. Названия получены автоматически; начало жития может быть раньше.</p><div className="sources-list">{headings.map(h => <article className="source-row" key={`${h.book_number}-${h.page}`}><span className="source-number">{h.page}</span><div><h2><Link href={`/library/book/${h.book_number}/${h.page}`}>{h.title} ↗</Link></h2><p className="source-publisher">{h.book_number === 13 ? 'Владыка Иоанн' : `Книга ${h.book_number}`} · страница PDF {h.page} · {scannedBookMetadata(h.book_number).publisher}</p></div></article>)}</div></section>}
  </div>;
}
