import Link from 'next/link';
import { chapters } from '@/lib/book-db';
import { ocrBooks, searchOcr, collectiveBookReadings } from '@/lib/ocr-db';
import { BookmarkList } from '@/components/bookmark-list';
import { readings } from '@/data/library';
import { matchesSearch } from '@/lib/search-terms';
import { getSaint } from '@/lib/repository';
import { scannedBookMetadata } from '@/lib/book-metadata';
export const dynamic = 'force-dynamic';
export default async function Library({ searchParams }: { searchParams: Promise<{ q?: string; book?: string; p?: string }> }) {
  const params = await searchParams;
  const legacyReadings = Object.fromEntries(readings.flatMap(reading => {
    const saint = getSaint(reading.saintId);
    return saint ? [[reading.id, { title: `${saint.name}: ${reading.title}`, href: `/saints/${saint.slug}?${new URLSearchParams({ text: reading.id })}` }]] : [];
  }));
  const q = typeof params.q === 'string' ? params.q.slice(0, 200) : '';
  const book = typeof params.book === 'string' && /^(?:[1-9]|1[0-3])$/.test(params.book) ? Number(params.book) : undefined;
  const collectiveEntries = collectiveBookReadings().filter(item => (!book || item.book === book) && matchesSearch(item.title, q));
  const entries = book ? [] : chapters(q);
  const books = ocrBooks();
  const rostovBooks = books.filter(book => book.number <= 12);
  const john = books.find(book => book.number === 13);
  const textBooks = [...new Map(entries.map(item => [item.book_id, item])).values()];
  const resultPage = typeof params.p === 'string' && /^\d{1,5}$/.test(params.p) ? Math.max(1, Math.min(20001, Number(params.p))) : 1;
  const batch = q ? searchOcr(q, 51, book, (resultPage - 1) * 50) : [];
  const hits = batch.slice(0, 50);
  const searchPageHref = (page: number) => `/library?${new URLSearchParams({ q, ...(book ? { book: String(book) } : {}), p: String(page) })}`;
  return <div className="shell sources-page"><div className="page-intro"><div className="eyebrow">ЛОКАЛЬНАЯ БИБЛИОТЕКА</div><h1>Книги житий</h1><p>Сборники, текст и сведения об источниках.</p></div><form className="search-box" action="/library"><input name="q" aria-label="Поиск по оглавлению и тексту" placeholder="Имя или слова из жития" defaultValue={q}/>{book && <input type="hidden" name="book" value={book}/>}<button type="submit" aria-label="Найти">→</button></form>
    {q && <section><p className="coverage-note">{book ? `Поиск в книге ${book}. ` : ''}Страницы, найденные в распознанном тексте: {hits.length} на странице {resultPage}. OCR может содержать ошибки. {book && <Link href={`/library?${new URLSearchParams({ q })}`}>Искать во всех книгах →</Link>}</p>{book !== 13 && <p className="coverage-note"><Link href={`/library/index?${new URLSearchParams({ q, ...(book ? { book: String(book) } : {}) })}`}>Искать в печатном указателе имён →</Link>. Одинаковые имена могут относиться к разным людям.</p>}{hits.map(hit => <article className="source-row" key={`${hit.book_number}-${hit.page}`}><span className="source-number">{hit.page}</span><div><h2><Link href={`/library/book/${hit.book_number}/${hit.page}`}>{hit.book_number === 13 ? 'Владыка Иоанн' : `Книга ${hit.book_number}`}, страница PDF {hit.page} ↗</Link></h2><p className="source-publisher">{scannedBookMetadata(hit.book_number).publisher}</p><p>{hit.excerpt}</p></div></article>)}{resultPage > 1 && hits.length === 0 && <p>На этой странице результатов нет.</p>}{(resultPage > 1 || batch.length > 50) && <nav className="pagination" aria-label="Страницы результатов поиска">{resultPage > 1 && <Link href={searchPageHref(resultPage - 1)}>← Назад</Link>}<span>Страница {resultPage}</span>{batch.length > 50 && resultPage < 20001 && <Link href={searchPageHref(resultPage + 1)}>Далее →</Link>}</nav>}</section>}
    {collectiveEntries.length > 0 && <section aria-label="Коллективные памяти"><h2>Коллективные памяти</h2><p className="coverage-note">Общие памяти из книги. Число участников не прибавляется к числу отдельных карточек святых.</p>{collectiveEntries.map(entry => <article className="source-row" key={entry.id}><div><h3><Link href={entry.href}>{entry.title} ↗</Link></h3><p>{entry.note}</p><p>Книга {entry.book}, PDF {entry.page} · <Link href={`/api/library/book/${entry.book}/${entry.page}`}>Скан источника ↗</Link></p></div></article>)}</section>}
    {!q && <BookmarkList legacyReadings={legacyReadings}/>}
    {!q && textBooks.length > 0 && <section><div className="section-heading"><div><div className="eyebrow">КНИГИ ДЛЯ ЧТЕНИЯ</div><h2>Истории святых</h2><p>Главы с указанием издания и страниц источника</p></div></div><div className="saint-grid">{textBooks.map(book => <Link className="saint-card" key={book.book_id} href={`/library/collection/${book.book_id}`}><div className="card-top"><span className="card-rank">Книга</span><span>↗</span></div><div className="card-monogram">Ж</div><h3>{book.book_title}</h3><p className="saint-intro">Глав в книге: {entries.filter(item => item.book_id === book.book_id).length}. {book.publisher}; {book.year}.</p><div className="card-bottom"><span>Открыть оглавление</span><span>↗</span></div></Link>)}</div></section>}
    {!q && rostovBooks.length > 0 && <section><div className="section-heading"><div><div className="eyebrow">ПО ЧЕТЬИМ-МИНЕЯМ ДИМИТРИЯ РОСТОВСКОГО</div><h2>Жития святых</h2><p>Издание «Ковчег», 2010 · 12 книг · локальное распознавание</p></div><Link className="text-link" href="/library/index">Указатель имён и заголовков →</Link></div><div className="saint-grid">{rostovBooks.map(book => <Link className="saint-card" key={book.number} href={`/library/book/${book.number}/contents`}><div className="card-top"><span className="card-rank">По Четьим-Минеям</span><span>↗</span></div><div className="card-monogram">{book.number}</div><h3>Книга {book.number}</h3><p className="saint-intro">Обработано страниц: {book.completed} из {book.pages}.</p><div className="card-bottom"><span>Открыть содержание</span><span>↗</span></div></Link>)}</div></section>}
    {!q && john && <section><div className="section-heading"><div><div className="eyebrow">ОТДЕЛЬНОЕ ИЗДАНИЕ</div><h2>Иоанн Шанхайский</h2><p>Составитель протоиерей Пётр Перекрёстов · Москва, 2014</p></div></div><div className="saint-grid"><Link className="saint-card" href="/library/john"><div className="card-top"><span className="card-rank">Житие и свидетельства</span><span>↗</span></div><div className="card-monogram">И</div><h3>{john.title}</h3><p className="saint-intro">Обработано страниц: {john.completed} из {john.pages}.</p><div className="card-bottom"><span>Открыть содержание</span><span>↗</span></div></Link></div></section>}
    {q && !book && <section><p className="coverage-note">Готовые главы книг: {entries.length}. У каждой главы указано издание.</p><div className="sources-list">{entries.map((e,i)=><article className="source-row" key={e.id}><span className="source-number">{String(i+1).padStart(2,'0')}</span><div><h2><Link href={`/library/${e.id}`}>{e.title} ↗</Link></h2><p className="source-publisher">{e.book_title} · {e.publisher}, {e.year} · {e.locator}</p></div></article>)}</div>{!entries.length && <p>Совпадений в оглавлениях текстовых книг нет.</p>}</section>}</div>;
}
