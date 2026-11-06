import type { CalendarSystem, CivilDate, Commemoration } from '@/domain/types';

export const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
export const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

// Integer Julian day numbers avoid timezone and daylight-saving arithmetic.
export function toJdn(date: CivilDate, calendar: CalendarSystem = 'gregorian'): number {
  const a = Math.floor((14 - date.month) / 12);
  const y = date.year + 4800 - a;
  const m = date.month + 12 * a - 3;
  const base = date.day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4);
  return calendar === 'julian' ? base - 32083 : base - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

export function fromJdn(jdn: number, calendar: CalendarSystem = 'gregorian'): CivilDate {
  let c: number;
  let century = 0;
  if (calendar === 'gregorian') {
    const a = jdn + 32044;
    century = Math.floor((4 * a + 3) / 146097);
    c = a - Math.floor(century * 146097 / 4);
  } else c = jdn + 32082;
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor(1461 * d / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return { year: century * 100 + d - 4800 + Math.floor(m / 10), month: m + 3 - 12 * Math.floor(m / 10), day: e - Math.floor((153 * m + 2) / 5) + 1 };
}

export function convertDate(date: CivilDate, from: CalendarSystem, to: CalendarSystem): CivilDate {
  return fromJdn(toJdn(date, from), to);
}

export function daysInMonth(year: number, month: number, calendar: CalendarSystem = 'gregorian') {
  const next = month === 12 ? { year: year + 1, month: 1, day: 1 } : { year, month: month + 1, day: 1 };
  return toJdn(next, calendar) - toJdn({ year, month, day: 1 }, calendar);
}

export function isValidDate(date: CivilDate, calendar: CalendarSystem = 'gregorian') {
  return Number.isInteger(date.year) && date.year >= 1600 && date.year <= 2199 && Number.isInteger(date.month) && date.month >= 1 && date.month <= 12 && Number.isInteger(date.day) && date.day >= 1 && date.day <= daysInMonth(date.year, date.month, calendar);
}

export function parseDate(value?: string): CivilDate | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = { year, month, day };
  return isValidDate(date) ? date : null;
}

export function isoDate(date: CivilDate) {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

export function formatDate(date: CivilDate, includeYear = false) {
  return `${date.day} ${MONTHS_GENITIVE[date.month - 1]}${includeYear ? ` ${date.year}` : ''}`;
}

export function today(): CivilDate {
  const value = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date());
  return parseDate(value)!;
}

export function commemorationDateForYear(item: Commemoration, year: number): CivilDate | undefined {
  if (item.rule.kind === 'cheesefare-saturday' || item.rule.kind === 'second-sunday-lent' || item.rule.kind === 'second-sunday-after-pentecost' || item.rule.kind === 'myrrhbearers') {
    if (!Number.isInteger(year) || year < 1600 || year > 2199) return undefined;
    // Julian computus; offsets are elapsed days from Pascha, not inclusive counts.
    const lunar = (19 * (year % 19) + 15) % 30;
    const weekday = (2 * (year % 4) + 4 * (year % 7) - lunar + 34) % 7;
    const pascha = { year, month: Math.floor((lunar + weekday + 114) / 31), day: (lunar + weekday + 114) % 31 + 1 };
    const offsets = { 'cheesefare-saturday': -50, 'second-sunday-lent': -35, 'second-sunday-after-pentecost': 63, myrrhbearers: 14 };
    const offset = offsets[item.rule.kind];
    return fromJdn(toJdn(pascha, 'julian') + offset, 'julian');
  }
  if (item.rule.kind === 'forefathers') {
    const first = toJdn({ year, month: 12, day: 11 }, 'julian');
    const date = fromJdn(first + (6 - first % 7 + 7) % 7, 'julian');
    return isValidDate(date, 'julian') ? date : undefined;
  }
  if (item.rule.kind === 'after-nativity') {
    const christmas = toJdn({ year, month: 12, day: 25 }, 'julian');
    const daysUntilSunday = (6 - christmas % 7 + 7) % 7;
    // If Christmas is Sunday, the Fathers are commemorated on Monday, December 26.
    const date = fromJdn(christmas + (daysUntilSunday || 1), 'julian');
    return isValidDate(date, 'julian') ? date : undefined;
  }
  if (item.rule.kind === 'unresolved') return undefined;
  const { calendar, month, day, nonLeapDay } = item.rule;
  const actualDay = day > daysInMonth(year, month, calendar) ? nonLeapDay : day;
  if (actualDay === undefined) return undefined;
  const date = { year, month, day: actualDay };
  return isValidDate(date, calendar) ? date : undefined;
}

export function matchesCommemoration(item: Commemoration, civil: CivilDate) {
  if (item.rule.kind === 'unresolved') return false;
  const date = convertDate(civil, 'gregorian', item.rule.calendar);
  const expected = commemorationDateForYear(item, date.year);
  return expected !== undefined && date.month === expected.month && date.day === expected.day;
}

export function monthCells(year: number, month: number, calendar: CalendarSystem) {
  const start = toJdn({ year, month, day: 1 }, calendar);
  const offset = ((start % 7) + 7) % 7; // JDN 0 is Monday.
  return Array.from({ length: 42 }, (_, i) => {
    const jdn = start - offset + i;
    return { display: fromJdn(jdn, calendar), civil: fromJdn(jdn), inMonth: fromJdn(jdn, calendar).month === month };
  });
}

/** Preserve fixed-date behaviour; December Julian movable feasts fall in the next civil year. */
export function commemorationDateForDisplayYear(item: Commemoration, civilYear: number): CivilDate | undefined {
  return commemorationDateForYear(item, item.rule.kind === 'after-nativity' ? civilYear - 1 : civilYear);
}
