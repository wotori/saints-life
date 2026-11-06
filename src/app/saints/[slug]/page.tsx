import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Reader } from '@/components/reader';
import { Icon } from '@/components/icon';
import { commemorationDateForDisplayYear, convertDate, formatDate, isoDate, today } from '@/lib/calendar';
import { getEdition, getSaint, getSource, getWork, saints, saintReadings, saintVenerations, saintCommemorations, traditions } from '@/lib/repository';
import { ocrBooks, reviewedBookWorksForSaint, reviewedBookMentionsForSaint } from '@/lib/ocr-db';
import { chapterForSaint } from '@/lib/book-db';
import { BookMention } from '@/components/book-mention';
import { ChapterReading } from '@/components/chapter-reading';

export function generateStaticParams() { return saints.map(s => ({ slug: s.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const saint = getSaint((await params).slug);
  return { title: saint?.name ?? 'Запись не найдена', description: saint?.intro };
}
export default async function SaintPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ text?: string }> }) {
  const { slug } = await params;
  const saint = getSaint(slug);
  if (!saint) notFound();
  const available = saintReadings(saint.id);
  const { text } = await searchParams;
  const selected = available.find(r => r.id === text) ?? available[0];
  const edition = selected ? getEdition(selected.editionId) : null;
  const johnBook = saint.id === 'ioann-shanghai' ? ocrBooks().find(book => book.number === 13) : undefined;
  const localChapter = chapterForSaint(saint.id);
  const bookWorks = reviewedBookWorksForSaint(saint.id);
  const bookMentions = reviewedBookMentionsForSaint(saint.id);
  const selectedChapter = localChapter && (!selected || text === localChapter.id) ? localChapter : undefined;
  const claims = saintVenerations(saint.id);
  const feasts = saintCommemorations(saint.id);
  const fixed = feasts.filter(c => c.rule.kind !== 'unresolved');
  const uniqueFeasts = fixed.filter((c, i) => fixed.findIndex(other => JSON.stringify(other.rule) === JSON.stringify(c.rule) && other.label === c.label && other.traditionId === c.traditionId) === i);
  const unresolved = feasts.filter(c => c.rule.kind === 'unresolved');
  const year = today().year;
  return <div className="shell saint-page"><Link href="/saints" className="back-link"><Icon name="chevron-left" size={14}/> Каталог святых</Link><div className="saint-heading"><div className="saint-seal" aria-hidden="true">{saint.name.charAt(0)}<span>✥</span></div><div><div className="eyebrow">{saint.rank}</div><h1>{saint.name}</h1><p className="saint-heading-meta">{saint.lifespan}{saint.place ? ` · ${saint.place}` : ''}</p><p className="saint-heading-intro">{saint.intro ?? (localChapter || bookWorks.length || bookMentions.length ? 'Имя и сведения о памяти сверены с указанным источником. Ниже можно прочитать связанный раздел книги.' : 'В начальной подборке сохранены имя и сведения месяцеслова. Жизнеописание пока не подготовлено.')}</p></div></div>
    <div className="saint-layout"><aside className="saint-sidebar"><section className="sidebar-block"><div className="eyebrow">ДНИ ПАМЯТИ · {year}</div>{uniqueFeasts.length ? uniqueFeasts.map(item => {
      if (item.rule.kind === 'unresolved') return null;
      const source = getSource(item.sourceId);
      const original = commemorationDateForDisplayYear(item, year);
      if (!original && item.rule.kind === 'fixed') return <div key={item.id} className="feast-entry"><p>{formatDate({ year, month: item.rule.month, day: item.rule.day })} ст. ст. · {item.label} · {traditions.find(t => t.id === item.traditionId)?.short}</p><p className="small-muted">В этом году такой даты нет; перенос в источнике не уточнён.</p><a className="feast-source" href={source.url} target="_blank" rel="noreferrer">Источник даты ↗</a></div>;
      if (!original) return null;
      const civil = convertDate(original, item.rule.calendar, 'gregorian');
      return <div key={item.id} className="feast-entry"><Link href={`/calendar?date=${isoDate(civil)}&tradition=${item.traditionId}`} className="feast-link"><strong>{formatDate(civil)}</strong><span>{formatDate(original)} ст. ст.</span><small>{item.label} · {traditions.find(t => t.id === item.traditionId)?.short}</small><Icon name="arrow" size={16}/></Link><a className="feast-source" href={source.url} target="_blank" rel="noreferrer" aria-label={`Источник даты ${formatDate(civil)}: ${source.title}`}>Источник даты ↗</a></div>;
    }) : <p className="small-muted">Фиксированная дата в указателе не установлена.</p>}{unresolved.length > 0 && <details className="movable-details"><summary>Переходящие памяти ({unresolved.length})</summary><ul>{unresolved.map(c => <li key={c.id}>{c.label}</li>)}</ul><p>Правила дат ещё не сверены, эти памяти не показаны в сетке календаря.</p></details>}</section><section className="sidebar-block"><div className="eyebrow">СВИДЕТЕЛЬСТВА ПОЧИТАНИЯ</div>{claims.map(claim => <div className="veneration-claim" key={claim.traditionId}><span className={`tradition-dot ${claim.traditionId === 'old-believer' ? 'gold' : ''}`}/><strong>{traditions.find(t => t.id === claim.traditionId)?.label}</strong><p>{claim.note}</p><a href={getSource(claim.sourceId).url} target="_blank" rel="noreferrer">Проверить источник ↗</a></div>)}<p className="small-muted">Отсутствие другой традиции означает отсутствие добавленного свидетельства.</p></section><section className="sidebar-block"><div className="eyebrow">ЗАПИСЬ В КАТАЛОГЕ</div><a className="source-citation" href={getSource(saint.sourceId).url} target="_blank" rel="noreferrer">{getSource(saint.sourceId).publisher}<Icon name="external" size={15}/></a><p className="small-muted">{saint.sourceLocator}</p></section></aside><div className="saint-reading-column">
      {(selected || localChapter) && <nav className="reading-tabs" aria-label="Версии текста">{available.map(r => <Link key={r.id} href={`/saints/${slug}?text=${r.id}`} className={!selectedChapter && selected?.id === r.id ? 'active' : ''} aria-current={!selectedChapter && selected?.id === r.id ? 'page' : undefined}>{r.title}{r.mode === 'external' && <span aria-label="на сайте издателя"> ↗</span>}</Link>)}{localChapter && <Link href={`/saints/${slug}?text=${localChapter.id}`} className={selectedChapter ? 'active' : ''} aria-current={selectedChapter ? 'page' : undefined}>{localChapter.id === 'kids-saints-22' ? 'История для детей' : 'Житие для детей'}</Link>}</nav>}
      {selectedChapter ? <ChapterReading item={selectedChapter}/> : selected && edition ? <Reader key={selected.id} reading={selected} edition={edition} work={getWork(edition.workId)} sources={edition.sourceIds.map(getSource)}/> : johnBook ? <div className="empty-state reading-placeholder"><Icon name="book" size={36}/><h2>Владыка Иоанн - святитель русского зарубежья</h2><p>Книга о святителе: составитель протоиерей Пётр Перекрёстов, Издательство Сретенского монастыря, 2014. Обработано страниц: {johnBook.completed} из {johnBook.pages}. Скан доступен для сверки.</p><Link className="button" href="/library/john">Читать книгу <Icon name="arrow" size={16}/></Link></div> : bookWorks.length || bookMentions.length ? null : <div className="empty-state reading-placeholder"><Icon name="book" size={36}/><h2>Жизнеописание ещё не добавлено</h2><p>Карточка сохранена, чтобы имя и подтверждённые дни памяти уже можно было найти. Полный текст и его издание требуют отдельной подготовки.</p><a className="button" href={getSource(saint.sourceId).url} target="_blank" rel="noreferrer">Открыть запись в источнике <Icon name="external" size={16}/></a></div>}
      {bookWorks.length > 0 && <section className="month-results"><h2>В издании по Четьим-Минеям</h2><p className="small-muted">«Жития святых» по руководству Четьих-Миней, «Ковчег», 2010; издание содержит и позднейшие дополнения. Текст распознан автоматически. Общие жития могут рассказывать о нескольких святых.</p>{bookWorks.map(work => <div className="calendar-saint" key={`${work.book}-${work.page}`}><div><h3><Link href={`/library/book/${work.book}/${work.page}/work/${work.section}`}>Читать раздел книги {work.book} ↗</Link></h3><p>«Ковчег», 2010 · страница PDF {work.page} · <a href={`/api/library/book/${work.book}/${work.page}`} target="_blank" rel="noreferrer">скан начала раздела ↗</a></p></div></div>)}</section>}
      {bookMentions.length > 0 && <section className="month-results"><h2>Упоминания в книгах</h2><p className="small-muted">Ссылки ведут к кратким памятям, цитатам или примечаниям об этом человеке. Это не обязательно отдельное житие. На странице могут находиться другие записи; распознавание может содержать ошибки.</p>{bookMentions.map(mention => <BookMention key={`${mention.book}-${mention.page}`} book={mention.book} page={mention.page} name={saint.name}/>)}</section>}
      <p className="coverage-note"><Link href={`/library/index?${new URLSearchParams({ q: saint.name.split(/[\s,]+/u)[0] })}`}>Найти это имя в печатных указателях →</Link>. Записи с одинаковым именем могут относиться к разным людям.</p></div></div>
  </div>;
}
