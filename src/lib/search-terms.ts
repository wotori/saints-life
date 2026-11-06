/** Lightweight name matching for Russian nominative queries and source titles. */
export function searchTerms(input: string): string[] {
  const aliases: Record<string, string> = { дмитрий: 'димитри', димитрий: 'димитри', сергей: 'серги', алексей: 'алекси', павел: 'пав', лев: 'льв' };
  return (input.slice(0, 200).toLocaleLowerCase('ru').replaceAll('ё', 'е').match(/[\p{L}\p{N}]+/gu) ?? [])
    .slice(0, 8).map(term => aliases[term] ?? (term.length > 4 && /[йая]$/u.test(term) ? term.slice(0, -1) : term));
}

export function matchesTitle(title: string, query: string): boolean {
  const normalized = title.toLocaleLowerCase('ru').replaceAll('ё', 'е');
  return searchTerms(query).every(term => normalized.includes(term));
}

/** Search aliases are for discovery only, never proof that two records are one person. */
export function searchVariants(input: string): string[][] {
  const aliases: Record<string, string[]> = {
    дмитрий: ['димитри', 'дмитри'], димитрий: ['димитри', 'дмитри'],
    сергей: ['серги', 'серге'], сергий: ['серги', 'серге'],
    алексей: ['алекси', 'алексе'], алексий: ['алекси', 'алексе'],
    павел: ['павел', 'павл'], лев: ['лев', 'льв'],
    иван: ['иван', 'иоанн'], иоанн: ['иоанн', 'иван'],
    федор: ['федор', 'фёдор', 'феодор'], феодор: ['феодор', 'федор', 'фёдор'],
    петр: ['петр', 'пётр'],
    илья: ['иль', 'илия', 'илии', 'илию', 'илией'], илия: ['илия', 'илии', 'илию', 'илией', 'иль'],
    егор: ['егор', 'георги'], георгий: ['георги', 'егор'],
  };
  const normalized = input.slice(0, 200).normalize('NFD').replace(/[\u0300\u0301]/g, '').normalize('NFC').toLocaleLowerCase('ru').replaceAll('ё', 'е');
  return (normalized.match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8).map(term => aliases[term] ?? searchTerms(term));
}

export function matchesSearch(title: string, query: string): boolean {
  const words = title.normalize('NFD').replace(/[\u0300\u0301]/g, '').normalize('NFC').toLocaleLowerCase('ru').replaceAll('ё', 'е').match(/[\p{L}\p{N}]+/gu) ?? [];
  return searchVariants(query).every(variants => variants.some(variant => words.some(word => word.startsWith(variant))));
}

/** Extract a candidate running header without treating the printed page number as part of the title. */
export function extractRunningHeading(body: string): string | undefined {
  const line = body.split('\n').find(value => value.trim())?.trim()
    .replace(/^\d+\s+/u, '').replace(/\s+(?:\d+|[IVXLИП]+)\s*$/u, '').trim();
  return line && /^(житие|память|страдание|слово|обретение|перенесение|убиение|преставление|воспоминание|повесть|собор|празднование|синаксарь)\s/iu.test(line) ? line : undefined;
}

/** Preserve the OCR line; infer a printed page only when both table separators are visible. */
export function parsePrintedIndexLine(line: string): { title: string; sourceLine: string; printedPage?: number; printedDay?: number } | undefined {
  const match = line.match(/^\s*['’«»“”„]*\s*([\p{L}\p{N}][\p{L}\p{M}\p{N}* ()',.\-»“”„]*?)\s*\.{3,}\s*(.+)$/u)
    ?? line.match(/^\s*['’«»“”„]*\s*([\p{L}][\p{L}\p{M}* ()',.\-»“”„]*?)(?:\s|(?=[|!\[]))+([|!\[]\s*[\d\s|!\]]*\d[\d\s|!\]]*)$/u)
    ?? line.match(/^\s*([\p{L}][\p{L}\p{M}* ()',.\-»“”„]*?)\s+(\d{1,2}\s+\d{1,4})\s*$/u);
  if (!match) return undefined;
  const title = match[1].replace(/(?:\s*\.)+\s*$/u, '').replace(/\s+/g, ' ').trim();
  const reference = match[2].trim();
  const numbers = reference.match(/^[|!\[]?\s*(\d{1,2})\s*[|!]\s*(\d{1,4})\s*[|!\]]?\s*$/u)
    ?? reference.match(/^\s*(\d{1,2})\s+(\d{1,4})\s*$/u);
  return { title, sourceLine: reference, ...(numbers ? { printedDay: Number(numbers[1]), printedPage: Number(numbers[2]) } : {}) };
}

/** Keep the terminal OCR line as the stable key when a name wraps onto two lines. */
export function parsePrintedIndexPage(left: string, right: string): { lineNumber: number; raw: string; parsed: NonNullable<ReturnType<typeof parsePrintedIndexLine>> }[] {
  const output: { lineNumber: number; raw: string; parsed: NonNullable<ReturnType<typeof parsePrintedIndexLine>> }[] = [];
  let offset = 0;
  for (const column of [left, right]) {
    const lines = column.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const parsed = parsePrintedIndexLine(lines[i]);
      if (!parsed) continue;
      const previous = i > 0 ? lines[i - 1].trim() : '';
      const wrapped = /^[а-яё]/u.test(parsed.title) && /^[А-ЯЁ][\p{L}\p{M}* ()',.\-»“”„]*$/u.test(previous)
        && !/^(?:имена святых|[А-ЯЁ\s]*ПАМЯТИ)/iu.test(previous) && !parsePrintedIndexLine(previous);
      const title = wrapped ? `${previous.replace(/-$/u, '')}${previous.endsWith('-') ? '' : ' '}${parsed.title}` : parsed.title;
      output.push({ lineNumber: offset + i, raw: wrapped ? `${lines[i - 1]}\n${lines[i]}` : lines[i], parsed: { ...parsed, title } });
    }
    offset += lines.length;
  }
  return output;
}

/** Estimate the page-number offset only when most readable running headers agree. */
export function estimatePrintedPageOffset(rows: { page: number; body: string }[]): number | undefined {
  const counts = new Map<number, number>();
  for (const row of rows) {
    const line = row.body.split('\n').find(value => value.trim())?.trim() ?? '';
    const match = line.match(/^(\d{1,3})\s+\D|\s+(\d{1,3})$/u);
    if (!match) continue;
    const delta = row.page - Number(match[1] ?? match[2]);
    if (delta < 0 || delta > 20) continue;
    counts.set(delta, (counts.get(delta) ?? 0) + 1);
  }
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, pair) => sum + pair[1], 0);
  return sorted.length > 0 && sorted[0][1] >= 10 && sorted[0][1] / total >= .95 ? sorted[0][0] : undefined;
}

/** Possible day/page pairs when an OCR engine has read the table separator as digit 1. */
export function mergedIndexCandidates(reference: string, maxDay: number, maxPage: number): { day: number; page: number }[] {
  const digits = reference.match(/^[|!\[]?\s*(\d{3,7})\s*[|!\]]?\s*$/u)?.[1];
  if (!digits) return [];
  const candidates: { day: number; page: number }[] = [];
  for (const dayLength of [1, 2]) {
    if (digits[dayLength] !== '1') continue;
    const day = Number(digits.slice(0, dayLength));
    const pageText = digits.slice(dayLength + 1);
    if (!pageText || pageText.startsWith('0')) continue;
    const page = Number(pageText);
    if (day >= 1 && day <= maxDay && page >= 1 && page <= maxPage) candidates.push({ day, page });
  }
  return candidates;
}

/** A second OCR pass may disambiguate numbers, but must agree with the original digit sequence. */
export function agreesWithIndexDigits(reference: string, day: number, page: number): boolean {
  const digits = (reference.match(/[0-9]/g) ?? []).join('');
  return digits === `${day}${page}` || digits === `${day}1${page}`;
}

/** Accept a recovered table reference only if exactly one candidate has matching book evidence. */
export function recoverMergedIndexReference(reference: string, maxDay: number, maxPage: number, matchesBook: (page: number) => boolean): { day: number; page: number } | undefined {
  const matches = mergedIndexCandidates(reference, maxDay, maxPage).filter(candidate => matchesBook(candidate.page));
  return matches.length === 1 ? matches[0] : undefined;
}
