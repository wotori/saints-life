import { dayStarts, type DayPage, type DayRange } from '@/lib/book-days';

// Начало последнего дня и начало указателя или приложений сверены по сканам издания «Ковчег», 2010.
const endings = [
  [1, 30, 652, 669, 'index', 'd8eb94eebea46e0d07798a67d3c15f64d3bb48a85875a8c47c0daa155467fb5c'],
  [2, 31, 615, 622, 'index', 'b33fb5a65d1985f7eef9fe3b0afdf3acc482cd632124240a2672f0652805f849'],
  [3, 30, 760, 782, 'index', 'b870c6f36c1b21254de6ce6e14690bdacaa639685a03b90cd6f5d44aab4427ce'],
  [4, 31, 815, 831, 'index', '147b1c3fe520c621b8d87d79025adff2be4f1815241296722e51639dc90b36fe'],
  [5, 31, 835, 846, 'index', 'e62ed1051709261e1b21d03eac3e74d8475e1f77e28c5a56d2faf2b0390e242f'],
  [6, 29, 473, 478, 'index', '01c0ca7096c861b5edf80f97c2ee15484b2bb6c8b59cd0ab751e69690aa72ab9'],
  [7, 31, 585, 635, 'appendix', '569c63acc0bb571cd3380e3e9a283510f0e84b0f739a5785f122ca2b2d77c4e9'],
  [8, 30, 442, 451, 'appendix', '34cad51db160ddb198289ea09aa9cd1745abb00e2f2eba61e6bb229cdc078e90'],
  [9, 31, 727, 733, 'appendix', '82b1215c68f31643b8eb01894d4ace63f2ff7a1caf45f8893122a038ba88d8ac'],
  [10, 30, 638, 639, 'index', '5d6ad1d1f29953b1f717fcc709ec01032ad6928b642e5b4664378b70284fb152'],
  [11, 31, 651, 657, 'appendix', 'b36fd4ff7ec4ba22854e5f55c566d0f4e7661394995e9586e207f42e8f4876df'],
  [12, 31, 542, 573, 'appendix', 'c2753b176cf59793edf93e94e3f26dca118b685057e8d1ddb16743d9bab89fee'],
] as const;

export type ReviewedDayEnding = DayRange & { nextOffset: 0; kind: 'index' | 'appendix' };

/** Do not use a checked boundary if the edition, heading, or intervening OCR pages changed. */
export function reviewedBookDayEnding(book: number, firstPage: number, sha: string, rows: DayPage[]): ReviewedDayEnding | undefined {
  const record = endings.find(([number, , first, , , sourceSha]) => number === book && first === firstPage && sourceSha === sha);
  if (!record) return undefined;
  const [, day, , end, kind] = record;
  const starts = dayStarts(rows);
  const start = starts.find(item => item.day === day && item.page === firstPage);
  if (!start || starts.some(item => item.page > firstPage && item.page < end)) return undefined;
  const pages = new Map(rows.map(row => [row.page, row.body]));
  for (let page = firstPage; page <= end; page++) if (!pages.has(page)) return undefined;
  const marker = kind === 'index' ? 'АЛФАВИТ СВЯТЫХ,' : book === 8 ? 'ПРИЛОЖЕНИЕ' : 'ПРИЛОЖЕНИЯ';
  const body = pages.get(end)!;
  if (!body.trimStart().startsWith(marker) || body.split('\n').filter(line => line.trim() === marker).length !== 1) return undefined;
  return { day, firstPage, firstOffset: start.offset, nextPage: end, nextOffset: 0, kind };
}
