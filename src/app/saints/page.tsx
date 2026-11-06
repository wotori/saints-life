import type { Metadata } from 'next';
import Link from 'next/link';
import { Fragment } from 'react';
import { Icon } from '@/components/icon';
import { SaintCard } from '@/components/saint-card';
import { saints, searchSaints, saintReadings, traditions } from '@/lib/repository';
import { ocrBooks, ocrHeadings, reviewedBookMentionsForSaint, reviewedBookWorksForSaint } from '@/lib/ocr-db';
import { printedIndexHits } from '@/lib/book-index-db';
import { printedIndexReference, printedIndexTextHref } from '@/lib/printed-index-display';
import { chapters } from '@/lib/book-db';
import { scannedBookMetadata } from '@/lib/book-metadata';
import { matchesTitle } from '@/lib/search-terms';
import { childrenChapterLinks } from '@/data/kids-saints';

export const metadata: Metadata = { title: 'Каталог святых' };
type Params = { q?: string; tradition?: string; rank?: string; reading?: string; page?: string };
export default async function SaintsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const filters = { q: typeof params.q === 'string' ? params.q.slice(0, 200) : '', tradition: traditions.some(t => t.id === params.tradition) ? params.tradition ?? '' : '', rank: typeof params.rank === 'string' ? params.rank : '', reading: params.reading === 'yes' ? 'yes' : '' };
  const availableChapters = chapters();
  const availableChapterTitles = new Map(availableChapters.map(item => [item.id, item.title]));
  const localBookNumbers = new Set(ocrBooks().map(book => book.number));
  const bookReadingCache = new Map<string, boolean>();
  const hasLocalReading = (id: string) => {
    const link = childrenChapterLinks[id];
    if ((link && availableChapterTitles.get(link.id) === link.title) || (id === 'ioann-shanghai' && localBookNumbers.has(13))) return true;
    if (!bookReadingCache.has(id)) bookReadingCache.set(id, reviewedBookWorksForSaint(id).length > 0 || reviewedBookMentionsForSaint(id).length > 0);
    return bookReadingCache.get(id) ?? false;
  };
  const result = searchSaints({ ...filters, reading: '' }).filter(saint => filters.reading !== 'yes' || saintReadings(saint.id).some(r => r.mode === 'summary') || hasLocalReading(saint.id));
  const bookResults = filters.q && !filters.tradition && !filters.rank && !filters.reading ? ocrHeadings(filters.q) : [];
  const printedHits = !filters.tradition && !filters.rank ? printedIndexHits(filters.q, { allowEmpty: !filters.q.trim(), limit: 10000 }).filter(hit => !filters.reading || hit.hasText) : [];
  const epubResults = filters.q && !filters.tradition && !filters.rank && !filters.reading ? chapters(filters.q) : [];
  const bookTitles = filters.q && !filters.tradition && !filters.rank && !filters.reading ? ocrBooks().filter(book => book.number === 13 && matchesTitle(`${book.title} ${scannedBookMetadata(book.number).aliases}`, filters.q)) : [];
  const pages = Math.max(1, Math.ceil(result.length / 12));
  const page = Math.max(1, Math.min(pages, Number.parseInt(params.page ?? '1', 10) || 1));
  const ranks = [...new Set(saints.map(s => s.rank.split(',')[0]))].sort((a, b) => a.localeCompare(b, 'ru'));
  const pageHref = (number: number) => `/saints?${new URLSearchParams({ ...filters, page: String(number) })}`;
  const pageNumbers = [...new Set([1, pages, page - 1, page, page + 1, ...(page <= 2 ? [2, 3] : []), ...(page >= pages - 1 ? [pages - 2, pages - 1] : [])])].filter(number => number >= 1 && number <= pages).sort((a, b) => a - b);
  return <div className="shell catalog-page"><div className="page-intro"><div className="eyebrow">ЛЮДИ, ИМЕНА, ИСТОРИИ</div><h1>Святые</h1><p>Найдите имя. Познакомьтесь с жизнью. Обратитесь к источнику.</p></div>
    <form action="/saints" key={JSON.stringify(filters)} className="catalog-filters"><div className="search-box"><Icon name="search"/><input type="search" aria-label="Поиск святых" name="q" defaultValue={filters.q} placeholder="Имя, место или слово из наименования"/><button type="submit" aria-label="Искать"><Icon name="arrow"/></button></div><div className="filter-selects"><label>Традиция<select aria-label="Традиция" name="tradition" defaultValue={filters.tradition}><option value="">Все традиции</option>{traditions.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label><label>Лик святости<select aria-label="Лик святости" name="rank" defaultValue={filters.rank}><option value="">Все лики</option>{ranks.map(r => <option key={r}>{r}</option>)}</select></label><label>Тексты<select aria-label="Тексты" name="reading" defaultValue={filters.reading}><option value="">Все записи</option><option value="yes">Есть чтение на сайте</option></select></label><button className="button filter-apply" type="submit">Применить</button></div></form>
    <div className="results-bar"><p aria-live="polite">Найдено карточек: <strong>{result.length}</strong>{filters.q ? <> по запросу «{filters.q}»</> : ''}</p><Link href="/saints" className="text-link">Сбросить фильтры <Icon name="close" size={14}/></Link></div>
    {(filters.tradition || filters.rank) && <p className="coverage-note">Книжные указатели не включены в эту выборку: традиция и лик святости для их строк ещё не проверены. <Link href="/library/index">Просмотреть указатели отдельно →</Link></p>}
    {result.length ? <div className="saint-grid">{result.slice((page - 1) * 12, page * 12).map(s => <SaintCard key={s.id} saint={s} hasLocalReading={hasLocalReading(s.id)}/>)}</div> : !bookResults.length && !printedHits.length && !epubResults.length && !bookTitles.length && <div className="empty-state"><Icon name="search" size={32}/><h2>Пока не нашли это имя</h2><p>Попробуйте изменить запрос или убрать фильтры. Распознавание книг продолжается.</p><Link className="button" href="/saints">Показать все записи</Link></div>}
    {bookTitles.length > 0 && <section className="month-results"><div className="eyebrow">КНИГИ · {bookTitles.length}</div>{bookTitles.map(book => <Link className="calendar-saint" key={book.number} href={`/library/book/${book.number}/1`}><div><h3>{book.title}</h3><p>Составитель протоиерей Пётр Перекрёстов · {scannedBookMetadata(book.number).publisher}</p></div><Icon name="arrow" size={17}/></Link>)}</section>}
    {epubResults.length > 0 && <section className="month-results"><div className="eyebrow">ЖИТИЯ В КНИГАХ · {epubResults.length}</div><p className="small-muted">Текст и сведения об издании доступны в карточке главы.</p>{epubResults.slice(0, 8).map(item => <Link className="calendar-saint" key={item.id} href={`/library/${item.id}`}><div><h3>{item.title}</h3><p>{item.book_title} · {item.publisher}, {item.year} · {item.locator}</p></div><Icon name="arrow" size={17}/></Link>)}{epubResults.length > 8 && <Link className="text-link" href={`/library?${new URLSearchParams({ q: filters.q })}`}>Все найденные главы →</Link>}</section>}
    {printedHits.length > 0 && <section className="month-results"><div className="eyebrow">ИМЕНА В ПЕЧАТНЫХ УКАЗАТЕЛЯХ · {printedHits.length}</div><p className="small-muted">Это отдельные записи источников, а не число людей. Статус сверки указан у каждой записи; одинаковые имена могут относиться к разным людям.{filters.reading && ' Показаны строки со ссылкой на распознанную страницу; её соответствие имени нужно проверить.'}</p>{printedHits.slice(0, 8).map(hit => <div className="calendar-saint" key={`${hit.book}-${hit.indexPage}-${hit.line}`}><div><h3><Link href={`/library/entry/${hit.book}/${hit.indexPage}/${hit.line}`}>{hit.title} ↗</Link></h3><p>Книга {hit.book} · {printedIndexReference(hit)}{printedIndexTextHref(hit) && <> · <Link href={printedIndexTextHref(hit)!}>открыть текст ↗</Link></>} · <a href={`/api/library/book/${hit.book}/${hit.indexPage}`} target="_blank" rel="noreferrer">скан указателя ↗</a></p></div></div>)}<Link className="text-link" href={`/library/index?${new URLSearchParams({ q: filters.q })}`}>{filters.q ? 'Все совпадения в указателях →' : 'Все записи в указателях →'}</Link>{filters.reading && <p className="small-muted">В полном указателе фильтр наличия текста не применяется.</p>}</section>}
    {bookResults.length > 0 && <section className="month-results"><div className="eyebrow">ЗАГОЛОВКИ ЖИТИЙ В КНИГАХ · {bookResults.length}</div><p className="small-muted">Распознаны автоматически; названия могут содержать ошибки, страница с заголовком может отличаться от начала жития.</p>{bookResults.slice(0, 8).map(item => <Link className="calendar-saint" key={`${item.book_number}-${item.page}`} href={`/library/book/${item.book_number}/${item.page}`}><div><h3>{item.title}</h3><p>{item.book_number === 13 ? 'Владыка Иоанн' : `Книга ${item.book_number}`} · страница PDF {item.page} · {scannedBookMetadata(item.book_number).publisher}</p></div><Icon name="arrow" size={17}/></Link>)}{bookResults.length > 8 && <Link className="text-link" href={`/library/index?${new URLSearchParams({ q: filters.q })}`}>Все найденные заголовки →</Link>}</section>}
    {pages > 1 && <nav className="pagination" aria-label="Страницы каталога">{pageNumbers.map((number, index) => <Fragment key={number}>{index > 0 && number - pageNumbers[index - 1] > 1 && <span className="pagination-ellipsis" aria-hidden="true">…</span>}<Link href={pageHref(number)} className={page === number ? 'selected' : ''} aria-current={page === number ? 'page' : undefined}>{number}</Link></Fragment>)}</nav>}
    <p className="coverage-note">В основе подборки 68 записей о Димитриях из месяцеслова «Азбуки веры», отдельные карточки протопопа Аввакума и Иоанна Шанхайского, а также поиск по книгам. Отметка традиции означает наличие указанного свидетельства. Отсутствие отметки означает, что свидетельство ещё не добавлено.</p>
  </div>;
}
