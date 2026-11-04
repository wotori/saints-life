'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/icon';
import type { CalendarSystem, CivilDate, Commemoration, Saint, TraditionId } from '@/domain/types';
import { convertDate, daysInMonth, formatDate, isoDate, isValidDate, matchesCommemoration, monthCells, MONTHS, parseDate, toJdn } from '@/lib/calendar';

export function CalendarBrowser({ initialDate, initialStyle, initialTradition, saints, commemorations, todayDate }: { initialDate: CivilDate; initialStyle: CalendarSystem; initialTradition: string; saints: Saint[]; commemorations: Commemoration[]; todayDate: CivilDate }) {
  const [date, setDate] = useState(initialDate);
  const [style, setStyle] = useState<CalendarSystem>(initialStyle);
  const [tradition, setTradition] = useState(initialTradition);
  const [query, setQuery] = useState('');
  const display = convertDate(date, 'gregorian', style);
  const old = convertDate(date, 'gregorian', 'julian');
  const relevant = commemorations.filter(c => !tradition || c.traditionId === tradition);
  const cells = monthCells(display.year, display.month, style);
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replaceAll('ё', 'е').replaceAll('дмитрий', 'димитрий');
  const matches = (s: Saint) => normalize([s.name, ...s.aliases].join(' ')).includes(normalize(query.trim()));
  const daySaints = saints.filter(s => matches(s) && relevant.some(c => c.saintId === s.id && matchesCommemoration(c, date)));
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
      const selected = toJdn(cell.civil) === toJdn(date);
      return <button key={isoDate(cell.civil)} onClick={() => setSelection(cell.civil)} aria-label={`${formatDate(cell.display, true)}${style === 'julian' ? ', старый стиль' : ''}${hits.length ? ', есть дни памяти' : ''}`} aria-pressed={selected} className={`${!cell.inMonth ? 'outside-month' : ''} ${selected ? 'selected' : ''} ${toJdn(cell.civil) === toJdn(todayDate) ? 'is-today' : ''}`}><span>{cell.display.day}</span><span className="day-dots">{hasModern && <i/>}{hasOld && <i className="gold"/>}</span></button>;
    })}</div><div className="calendar-legend"><span><i/>Православный месяцеслов</span><span><i className="gold"/>Старообрядческие источники</span></div><label className="jump-date">Перейти к дате (новый стиль)<input aria-label="Перейти к дате" type="date" min="1601-01-01" max="2198-12-31" value={isoDate(date)} onChange={e => { const next = parseDate(e.target.value); if (next) setSelection(next); }}/></label></section>
    <section className="day-panel"><div className="eyebrow">ДНИ ПАМЯТИ В ПОДБОРКЕ</div><h2>{formatDate(date)}</h2><p className="old-date">{formatDate(old)} по старому стилю</p><div className="search-box calendar-search"><Icon name="search" size={18}/><input aria-label="Поиск в календаре" placeholder="Найти имя в календаре" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button onClick={() => setQuery('')} aria-label="Очистить поиск"><Icon name="close" size={17}/></button>}</div><div aria-live="polite">{daySaints.length ? daySaints.map(s => <CalendarSaint key={s.id} saint={s} items={relevant.filter(c => c.saintId === s.id && matchesCommemoration(c, date))}/>) : <div className="calendar-empty"><span aria-hidden="true">✧</span><h3>На этот день записей пока нет</h3><p>Это отражает объём нашей подборки. В полном церковном календаре в этот день могут быть другие памяти.</p></div>}</div><div className="month-results"><div className="eyebrow">В ВЫБРАННОМ МЕСЯЦЕ · {monthSaints.length}</div>{monthSaints.slice(0, 12).map(s => { const cell = cells.find(cell => cell.inMonth && relevant.some(c => c.saintId === s.id && matchesCommemoration(c, cell.civil)))!; return <button key={s.id} onClick={() => setSelection(cell.civil)}><span>{s.name}</span><strong>{cell.display.day}</strong></button>; })}{!monthSaints.length && <p className="small-muted">По этим условиям записей нет.</p>}{monthSaints.length > 12 && <p className="small-muted">Показаны первые 12 записей. Все памяти доступны при выборе дня в календаре.</p>}</div></section></div>
    <p className="coverage-note">Календарь показывает только памяти из начальной подборки. Цвет точки обозначает источник традиции, а не количество святых. Переходящие памяти пока исключены из сетки: их правила расчёта ещё не сверены. «Сегодня» определяется по московскому времени.</p>
  </>;
}

function CalendarSaint({ saint, items }: { saint: Saint; items: Commemoration[] }) {
  const traditionIds = [...new Set(items.map(c => c.traditionId))] as TraditionId[];
  return <Link href={`/saints/${saint.slug}`} className="calendar-saint"><div className="calendar-initial" aria-hidden="true">{saint.name.charAt(0)}</div><div><span className="card-rank">{saint.rank.split(',')[0]}</span><h3>{saint.name}</h3><p>{[...new Set(items.map(c => c.label))].join(' · ')}</p><small>{traditionIds.map(t => t === 'old-believer' ? 'Старообрядческая' : 'Православный месяцеслов').join(' · ')}</small></div><Icon name="arrow" size={17}/></Link>;
}
