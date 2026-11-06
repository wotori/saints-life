/** Conservative evidence from consecutive day headings in a scanned book, not a reviewed calendar. */
export type DayRange = { day: number; firstPage: number; nextPage: number; firstOffset: number };
export type DayPage = { page: number; body: string };
export type DayStart = { day: number; page: number; offset: number };

const ordinals: Record<string, number> = {
  'ПЕРВЫЙ': 1, 'ВТОРОЙ': 2, 'ТРЕТИЙ': 3, 'ЧЕТВЕРТЫЙ': 4, 'ПЯТЫЙ': 5,
  'ШЕСТОЙ': 6, 'СЕДЬМОЙ': 7, 'ВОСЬМОЙ': 8, 'ДЕВЯТЫЙ': 9, 'ДЕСЯТЫЙ': 10,
  'ОДИННАДЦАТЫЙ': 11, 'ДВЕНАДЦАТЫЙ': 12, 'ТРИНАДЦАТЫЙ': 13, 'ЧЕТЫРНАДЦАТЫЙ': 14,
  'ПЯТНАДЦАТЫЙ': 15, 'ШЕСТНАДЦАТЫЙ': 16, 'СЕМНАДЦАТЫЙ': 17, 'ВОСЕМНАДЦАТЫЙ': 18,
  'ДЕВЯТНАДЦАТЫЙ': 19, 'ДВАДЦАТЫЙ': 20, 'ДВАДЦАТЬ ПЕРВЫЙ': 21, 'ДВАДЦАТЬ ВТОРОЙ': 22,
  'ДВАДЦАТЬ ТРЕТИЙ': 23, 'ДВАДЦАТЬ ЧЕТВЕРТЫЙ': 24, 'ДВАДЦАТЬ ПЯТЫЙ': 25,
  'ДВАДЦАТЬ ШЕСТОЙ': 26, 'ДВАДЦАТЬ СЕДЬМОЙ': 27, 'ДВАДЦАТЬ ВОСЬМОЙ': 28,
  'ДВАДЦАТЬ ДЕВЯТЫЙ': 29, 'ТРИДЦАТЫЙ': 30, 'ТРИДЦАТЬ ПЕРВЫЙ': 31,
  // Варианты ошибок OCR, сверенные с заголовками сканов в книгах 3, 5, 7 и 8.
  'ДЕВЯТНАДПАТЫЙ': 19, 'ДЕВЯТНАДПЦАТЫЙ': 19, 'ПЯТНАДНАТЫЙ': 15, 'ТРИДПЦАТЫЙ': 30,
};

/** Match observed OCR errors while keeping offsets in the unchanged source text. */
function dayHeadings(body: string): { day: number; offset: number }[] {
  return [...body.matchAll(/^[ \t]*(?:[ДЛ]ЕНЬ|ДЕЕНЬ|ЛЕЕНЬ|ДЛЕЕНЬ)[ \t]+([А-ЯЁ ]+?)[ \t]*(?:[!¹1])?[ \t]*$/gimu)].flatMap(match => {
    const name = match[1].toLocaleUpperCase('ru').replaceAll('Ё', 'Е').replace(/\s+/g, ' ').trim();
    const day = ordinals[name];
    return day ? [{ day, offset: match.index ?? 0 }] : [];
  });
}

/** Offsets of standalone, recognised day headings in the unmodified OCR text. */
export function dayHeadingOffsets(body: string): number[] {
  return dayHeadings(body).map(heading => heading.offset);
}

/** A start page can be useful without knowing where the day ends. */
export function dayStarts(rows: DayPage[]): DayStart[] {
  const markers: DayStart[] = [];
  for (const row of [...rows].sort((a, b) => a.page - b.page)) {
    for (const heading of dayHeadings(row.body)) markers.push({ ...heading, page: row.page });
  }
  if (markers.length < 2) return [];
  return markers.filter((marker, index) => {
    const previous = markers[index - 1], next = markers[index + 1];
    return markers.filter(other => other.day === marker.day).length === 1
      && (!previous || previous.day < marker.day)
      && (!next || marker.day < next.day);
  });
}

export function dayRanges(rows: DayPage[]): DayRange[] {
  const pages = [...rows].sort((a, b) => a.page - b.page);
  const available = new Set(pages.map(row => row.page));
  const markers: { day: number; page: number; offset: number }[] = [];
  for (const row of pages) {
    for (const heading of dayHeadings(row.body)) markers.push({ ...heading, page: row.page });
  }
  const ranges: DayRange[] = [];
  for (let i = 0; i + 1 < markers.length; i++) {
    const first = markers[i], next = markers[i + 1];
    if (next.day !== first.day + 1 || next.page <= first.page) continue;
    let complete = true;
    for (let page = first.page; page <= next.page; page++) if (!available.has(page)) { complete = false; break; }
    if (complete) ranges.push({ day: first.day, firstPage: first.page, nextPage: next.page, firstOffset: first.offset });
  }
  return ranges;
}

export function dayForNamedPage(ranges: DayRange[], row: DayPage | undefined, title: string): DayRange | undefined {
  if (!row) return undefined;
  const range = ranges.find(item => row.page >= item.firstPage && row.page < item.nextPage);
  if (!range) return undefined;
  const name = title.split(/[\s*]+/u)[0].toLocaleLowerCase('ru').replaceAll('ё', 'е');
  if (name.length < 3) return undefined;
  const body = row.body.toLocaleLowerCase('ru').replaceAll('ё', 'е');
  const start = row.page === range.firstPage ? range.firstOffset : 0;
  return body.indexOf(name, start) >= 0 ? range : undefined;
}
