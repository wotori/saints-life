import Link from 'next/link';
import { notFound } from 'next/navigation';
import { printedIndexHits } from '@/lib/book-index-db';
import { scannedBookMetadata } from '@/lib/book-metadata';
import { MONTHS_GENITIVE } from '@/lib/calendar';
import { printedPageInfo } from '@/lib/ocr-db';
import { printedIndexTextHref } from '@/lib/printed-index-display';

export const dynamic = 'force-dynamic';

export default async function PrintedEntryPage({ params }: { params: Promise<{ book: string; page: string; line: string }> }) {
  const raw = await params;
  if (![raw.book, raw.page, raw.line].every(value => /^\d+$/.test(value))) notFound();
  const book = Number(raw.book), page = Number(raw.page), line = Number(raw.line);
  if (![book, page, line].every(Number.isSafeInteger) || book < 1 || book > 12 || page < 1 || page > 10000 || line > 1000) notFound();
  const entry = printedIndexHits('', { allowEmpty: true, limit: 1, id: { book, indexPage: page, line }, includeNearby: true })[0];
  if (!entry) notFound();
  const meta = scannedBookMetadata(book);
  const firstName = entry.title.split(/[\s*]+/u)[0];
  const workHref = printedIndexTextHref(entry);
  const printedInfo = printedPageInfo(book);
  return <article className="shell about-page">
    <Link className="back-link" href={`/library/index?${new URLSearchParams({ q: firstName, book: String(book) })}`}>‹ К указателю книги</Link>
    <div className="page-intro"><div className="eyebrow">ЗАПИСЬ ПЕЧАТНОГО УКАЗАТЕЛЯ</div><h1>{entry.title}</h1><p>Книга {book} · страница указателя PDF {page}</p></div>
    <p className="coverage-note">Имя и числовая ссылка распознаны автоматически и могут содержать ошибки. Это отдельная запись источника: совпадение имён ещё не доказывает, что записи относятся к одному человеку. Сверьте её со сканом.</p>
    <section className="reader"><div className="reading-body"><h2>Запись в издании</h2><p>{entry.title}{entry.reviewStatus === 'reviewed' && <> · {entry.printedDay ? `день ${entry.printedDay}, ` : 'день в указателе не указан, '}страница {entry.printedPage}</>}</p><p>Исходное распознавание чисел: {entry.sourceLine}</p><p>Статус строки: {entry.reviewStatus === 'reviewed' ? 'сверена с источником; личность святого требует отдельной проверки' : 'ожидает редакторской проверки'}.</p><p><a href={`/api/library/book/${book}/${page}`} target="_blank" rel="noreferrer">Открыть скан указателя ↗</a></p>
      {entry.recoveredNumbers && <p>День и номер страницы восстановлены автоматически {entry.recoveryMethod === 'columns' ? 'повторным распознаванием числовых колонок указателя' : 'по совпадению с текстом книги'}. Сверьте их со сканом.</p>}
      {entry.calendarDay && entry.julianMonth && <p>{entry.reviewStatus === 'reviewed' ? 'Дата в печатном указателе' : 'Предварительная дата'}: {entry.calendarDay} {MONTHS_GENITIVE[entry.julianMonth - 1]} по старому стилю. {entry.reviewStatus === 'reviewed' ? 'Число сверено со сканом указателя.' : entry.dayHeadingPage ? <>Число сопоставлено с заголовком раздела{entry.printedDay !== entry.calendarDay ? ', распознавание указателя дало другое число' : ''}. <a href={`/api/library/book/${book}/${entry.dayHeadingPage}`} target="_blank" rel="noreferrer">Открыть скан заголовка дня ↗</a></> : 'Число получено из распознанной строки указателя.'}</p>}
      {workHref ? <p><Link className="button" href={workHref}>{entry.workSection !== undefined ? 'Читать найденный раздел →' : 'Открыть предполагаемую страницу книги →'}</Link></p> : <p>Страница жития пока не определена автоматически. Её можно найти в скане указателя.</p>}
      {entry.contextWorkPage !== undefined && entry.contextWorkSection !== undefined && <><p>Указанная страница находится внутри общего раздела. Его начало и конец сверены со сканами; совпадение имени не подтверждает личность человека.</p><p><Link href={`/library/book/${book}/${entry.contextWorkPage}/work/${entry.contextWorkSection}`}>Читать общий раздел с начала →</Link></p></>}
      {entry.nearbyWorkPage !== undefined && entry.nearbyWorkSection !== undefined && <><p>Рядом с указанной страницей автоматически найден заголовок с этим именем, на странице PDF {entry.nearbyWorkPage}. Это может быть другой человек или ошибка распознавания. Проверьте раздел по скану.</p><p><Link href={`/library/book/${book}/${entry.nearbyWorkPage}/work/${entry.nearbyWorkSection}`}>Открыть возможный раздел рядом →</Link></p></>}
      <p><Link href={`/library?${new URLSearchParams({ q: firstName, book: String(book) })}`}>Искать имя в тексте этой книги →</Link></p>
      {printedInfo && <><p>Если номер в указателе распознан неверно, откройте скан и введите печатный номер страницы. Переход определён автоматически, поэтому сверьте его с книгой.</p><form action={`/library/book/${book}`} className="page-jump-form"><label>Печатная страница <input type="number" name="printed" min="1" max={printedInfo.maxPrintedPage} required defaultValue={entry.printedPage}/></label><button type="submit">Открыть страницу</button></form></>}
    </div></section>
    <p className="coverage-note">Источник: {meta.citation} Страница указателя PDF {page}, строка OCR {line + 1}. {meta.rights}</p>
    <Link className="text-link" href={`/library/index?${new URLSearchParams({ q: firstName })}`}>Искать это имя в других томах →</Link>
  </article>;
}
