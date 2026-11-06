'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Icon } from '@/components/icon';
import type { CalendarSystem, CivilDate, Commemoration, Saint, TraditionId } from '@/domain/types';
import type { PrintedIndexHit } from '@/lib/book-index-db';
import type { CollectiveReading } from '@/lib/collective-memories';
import type { OcrBookDay } from '@/lib/ocr-db';
import { printedIndexReference, printedIndexTextHref } from '@/lib/printed-index-display';
import { matchesSearch } from '@/lib/search-terms';
import { convertDate, daysInMonth, formatDate, isoDate, isValidDate, matchesCommemoration, monthCells, MONTHS, parseDate, toJdn } from '@/lib/calendar';

export function CalendarBrowser({ initialDate, initialStyle, initialTradition, saints, commemorations, printedEntries, bookDays, collectiveReadings = [], todayDate }: { initialDate: CivilDate; initialStyle: CalendarSystem; initialTradition: string; saints: Saint[]; commemorations: Commemoration[]; printedEntries: PrintedIndexHit[]; bookDays: OcrBookDay[]; collectiveReadings?: CollectiveReading[]; todayDate: CivilDate }) {
  const [date, setDate] = useState(initialDate);
  const [style, setStyle] = useState<CalendarSystem>(initialStyle);
  const [tradition, setTradition] = useState(initialTradition);
  const [query, setQuery] = useState('');
  const display = convertDate(date, 'gregorian', style);
  const old = convertDate(date, 'gregorian', 'julian');
  const relevant = commemorations.filter(c => !tradition || c.traditionId === tradition);
  const cells = monthCells(display.year, display.month, style);
  const matches = (s: Saint) => matchesSearch([s.name, ...s.aliases].join(' '), query.trim());
  const daySaints = saints.filter(s => matches(s) && relevant.some(c => c.saintId === s.id && matchesCommemoration(c, date)));
  const matchingEntries = useMemo(() => tradition ? [] : printedEntries.filter(entry => matchesSearch(entry.title, query.trim())), [printedEntries, query, tradition]);
  const indexDays = useMemo(() => new Set(matchingEntries.map(entry => `${entry.julianMonth}:${entry.calendarDay}`)), [matchingEntries]);
  const indexSaints = matchingEntries.filter(entry => entry.julianMonth === old.month && entry.calendarDay === old.day);
  const bookDay = !tradition && !query.trim() ? bookDays.find(entry => entry.month === old.month && entry.day === old.day) : undefined;
  const matchingCollectives = tradition === 'old-believer' ? [] : collectiveReadings.filter(item => matchesSearch(item.title, query.trim()));
  const dayCollectives = matchingCollectives.filter(item => item.month === old.month && item.day === old.day);
  const monthSaints = saints.filter(s => matches(s) && relevant.some(c => c.saintId === s.id && cells.some(cell => cell.inMonth && matchesCommemoration(c, cell.civil))));
  const setSelection = (nextDate: CivilDate, nextStyle = style, nextTradition = tradition) => {
    if (!isValidDate(nextDate)) return;
    setDate(nextDate); setStyle(nextStyle); setTradition(nextTradition);
    const params = new URLSearchParams({ date: isoDate(nextDate), style: nextStyle, tradition: nextTradition });
    window.history.replaceState(null, '', `/calendar?${params}`);
  };
  function changeMonth(delta: number) {
    const index = display.year * 12 + display.month - 1 + delta;
    const year = Math.floor(index / 12);
    const month = index % 12 + 1;
    if (year < 1601 || year > 2198) return;
    const next = convertDate({ year, month, day: Math.min(display.day, daysInMonth(year, month, style)) }, style, 'gregorian');
    setSelection(next);
  }
  return <><div className="calendar-filters"><div className="segmented" aria-label="Календарный стиль"><button aria-pressed={style === 'gregorian'} className={style === 'gregorian' ? 'selected' : ''} onClick={() => setSelection(date, 'gregorian')}>Новый стиль</button><button aria-pressed={style === 'julian'} className={style === 'julian' ? 'selected' : ''} onClick={() => setSelection(date, 'julian')}>Старый стиль</button></div><label className="calendar-tradition"><span className="sr-only">Традиция календаря</span><select value={tradition} onChange={e => setSelection(date, style, e.target.value)}><option value="">Все традиции</option><option value="russian-orthodox">Православный месяцеслов</option><option value="old-believer">Старообрядческая традиция</option></select></label></div>
    <div className="calendar-layout"><section className="calendar-panel" aria-label="Календарь памятей"><div className="month-navigation"><h2>{MONTHS[display.month - 1]} <span>{display.year}</span></h2><div><button onClick={() => changeMonth(-1)} aria-label="Предыдущий месяц"><Icon name="chevron-left" size={17}/></button><button onClick={() => setSelection(todayDate)} className="today-button">Сегодня</button><button onClick={() => changeMonth(1)} aria-label="Следующий месяц"><Icon name="chevron-right" size={17}/></button></div></div><div className="weekday-grid">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => <span key={d}>{d}</span>)}</div><div className="month-grid">{cells.map(cell => {
      const hits = relevant.filter(c => matchesCommemoration(c, cell.civil) && saints.some(s => s.id === c.saintId && matches(s)));
      const hasModern = hits.some(c => c.traditionId === 'russian-orthodox');
      const hasOld = hits.some(c => c.traditionId === 'old-believer');
      const julian = convertDate(cell.civil, 'gregorian', 'julian');
      const hasBookEntry = indexDays.has(`${julian.month}:${julian.day}`) || matchingCollectives.some(item => item.month === julian.month && item.day === julian.day);
      const selected = toJdn(cell.civil) === toJdn(date);
      return <button key={isoDate(cell.civil)} onClick={() => setSelection(cell.civil)} aria-label={`${formatDate(cell.display, true)}${style === 'julian' ? ', старый стиль' : ''}${hits.length ? ', есть дни памяти' : ''}${hasBookEntry ? ', есть книжные записи' : ''}`} aria-pressed={selected} className={`${!cell.inMonth ? 'outside-month' : ''} ${selected ? 'selected' : ''} ${toJdn(cell.civil) === toJdn(todayDate) ? 'is-today' : ''}`}><span>{cell.display.day}</span><span className="day-dots" aria-hidden="true">{hasModern && <i/>}{hasOld && <i className="gold"/>}{hasBookEntry && <i className="book-index"/>}</span></button>;
    })}</div><div className="calendar-legend"><span><i/>Православный месяцеслов</span><span><i className="gold"/>Старообрядческие источники</span><span><i className="book-index"/>Книжные записи</span></div><label className="jump-date">Перейти к дате (новый стиль)<input aria-label="Перейти к дате" type="date" min="1601-01-01" max="2198-12-31" value={isoDate(date)} onChange={e => { const next = parseDate(e.target.value); if (next) setSelection(next); }}/></label></section>
    <section className="day-panel"><div className="eyebrow">ДНИ ПАМЯТИ В ПОДБОРКЕ</div><h2>{formatDate(date)}</h2><p className="old-date">{formatDate(old)} по старому стилю</p><div className="search-box calendar-search"><Icon name="search" size={18}/><input aria-label="Поиск в календаре" placeholder="Найти имя в календаре" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button onClick={() => setQuery('')} aria-label="Очистить поиск"><Icon name="close" size={17}/></button>}</div><div aria-live="polite">{daySaints.length ? daySaints.map(s => <CalendarSaint key={s.id} saint={s} items={relevant.filter(c => c.saintId === s.id && matchesCommemoration(c, date))}/>) : !indexSaints.length && !dayCollectives.length && <div className="calendar-empty"><span aria-hidden="true">✧</span><h3>В подборке памятей записей пока нет</h3><p>Это отражает объём нашей подборки. В полном церковном календаре в этот день могут быть другие памяти.</p></div>}</div>{bookDay && <div className="month-results"><div className="eyebrow">ДЕНЬ В КНИГЕ</div><p className="small-muted">Начало дня найдено автоматически по заголовкам. На странице может быть конец предыдущего дня; сверьте текст со сканом.</p><p>{bookDay.hasRange && <><Link href={`/library/book/${bookDay.book}/${bookDay.page}/day`}>Читать этот день ↗</Link> · </>}<Link href={`/library/book/${bookDay.book}/${bookDay.page}`}>Открыть начало дня в книге {bookDay.book} ↗</Link> · <Link href={`/library/book/${bookDay.book}/${bookDay.page}/continuous`}>Читать подряд ↗</Link></p></div>}<CollectiveMemories entries={dayCollectives}/><IndexSaints entries={indexSaints}/><div className="month-results"><div className="eyebrow">В ВЫБРАННОМ МЕСЯЦЕ · {monthSaints.length}</div>{monthSaints.slice(0, 12).map(s => { const cell = cells.find(cell => cell.inMonth && relevant.some(c => c.saintId === s.id && matchesCommemoration(c, cell.civil)))!; return <button key={s.id} onClick={() => setSelection(cell.civil)}><span>{s.name}</span><strong>{cell.display.day}</strong></button>; })}{!monthSaints.length && <p className="small-muted">По этим условиям записей нет.</p>}{monthSaints.length > 12 && <p className="small-muted">Показаны первые 12 записей. Все памяти доступны при выборе дня в календаре.</p>}</div></section></div>
    <p className="coverage-note">Календарь показывает проверенные карточки, коллективные памяти по книжному источнику и отдельно строки печатных указателей при выборе всех традиций. Квадрат обозначает запись в книге, а не принадлежность к традиции или число святых. Переходящие памяти пока исключены из сетки: их правила расчёта ещё не сверены. «Сегодня» определяется по московскому времени.</p>
  </>;
}

function IndexSaints({ entries }: { entries: PrintedIndexHit[] }) {
  if (!entries.length) return null;
  return <div className="month-results"><div className="eyebrow">ПРЕДВАРИТЕЛЬНО В КНИГАХ · {entries.length}</div><p className="small-muted">У каждой строки указан статус сверки. Одинаковые имена могут относиться к разным людям; эти записи не подтверждают почитание в других традициях.</p>{entries.map(entry => <div className="calendar-saint" key={`${entry.book}-${entry.indexPage}-${entry.line}`}><div><h3><Link href={`/library/entry/${entry.book}/${entry.indexPage}/${entry.line}`}>{entry.title} ↗</Link></h3><p>Книга {entry.book} · {printedIndexReference(entry)}{printedIndexTextHref(entry) && <> · <Link href={printedIndexTextHref(entry)!}>открыть текст ↗</Link></>} · <a href={`/api/library/book/${entry.book}/${entry.indexPage}`} target="_blank" rel="noreferrer">скан указателя ↗</a>{entry.dayHeadingPage && <> · <a href={`/api/library/book/${entry.book}/${entry.dayHeadingPage}`} target="_blank" rel="noreferrer">заголовок дня ↗</a>{entry.printedDay !== entry.calendarDay && ' · число уточнено по тексту книги'}</>}</p></div></div>)}</div>;
}

function CalendarSaint({ saint, items }: { saint: Saint; items: Commemoration[] }) {
  const traditionIds = [...new Set(items.map(c => c.traditionId))] as TraditionId[];
  return <Link href={`/saints/${saint.slug}`} className="calendar-saint"><div className="calendar-initial" aria-hidden="true">{saint.name.charAt(0)}</div><div><span className="card-rank">{saint.rank.split(',')[0]}</span><h3>{saint.name}</h3><p>{[...new Set(items.map(c => c.label))].join(' · ')}</p><small>{traditionIds.map(t => t === 'old-believer' ? 'Старообрядческая' : 'Православный месяцеслов').join(' · ')}</small></div><Icon name="arrow" size={17}/></Link>;
}

function CollectiveMemories({ entries }: { entries: CollectiveReading[] }) {
  if (!entries.length) return null;
  return <section className="month-results" aria-label="Коллективные памяти"><div className="eyebrow">КОЛЛЕКТИВНЫЕ ПАМЯТИ ПО КНИГЕ</div>{entries.map(entry => <article className="calendar-saint" key={entry.id}><div><h3><Link href={entry.href}>{entry.title} ↗</Link></h3><p>{entry.note}</p><p>Книга {entry.book}, страница PDF {entry.page} · <a href={`/api/library/book/${entry.book}/${entry.page}`}>Скан источника ↗</a></p></div></article>)}</section>;
}
