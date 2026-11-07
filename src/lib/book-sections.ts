import { matchesTitle } from '@/lib/search-terms';

export type SectionHeading = { offset: number; title: string };
const headingStart = /^(КРЕЩЕНИЕ|ЗАЧАТИЕ|ОСВЯЩЕНИЕ|УСПЕНИЕ|О СОЗДАНИИ|ЖИТИЕ|ЖИЗНЕОПИСАНИЕ|ЖИЗНЬ|ПАМЯТЬ|СТРАДАНИЕ|ПОДВИГИ|СКАЗАНИЕ|ОБРЕТЕНИЕ|ПЕРЕНЕСЕНИЕ|СЛОВО|УБИЕНИЕ|ПРЕСТАВЛЕНИЕ|ВОСПОМИНАНИЕ|ПОВЕСТЬ|СОБОР|ПРАЗДНОВАНИЕ|СИНАКСАРЬ!?)(?:\s|,|$)/iu;

// OCR sometimes reads small capitals and conjunctions as ordinary lowercase.
function isDisplayLine(line: string): boolean {
  line = line.replace(/^СЛОВО на(?=\s+[А-ЯЁ])/u, 'СЛОВО НА');
  const corrected = line.replace(headingStart, word => word.toLocaleUpperCase('ru')).replace(/(?<![\p{L}])(?:святых|святого|святой|святому|святые|святаго|мучеников|мучениц|преподобного|отца|нашего|сестры|сына|сыновей|их|чад|его|родных|ее|братьев)(?![\p{L}])/gu, word => word.toLocaleUpperCase('ru'));
  return /^[А-ЯЁA-Z0-9\s.,:;!()«»'’\-и]+$/u.test(corrected);
}

function bridgesTitleToUppercase(lines: string[], index: number): boolean {
  const line = lines[index]?.trim() ?? '';
  if (!/^(?:(?:на|о|об)|(?:[А-ЯЁ]|из\s|и\s|его\s|с\s)[А-ЯЁа-яё\s,.:;()«»'’\-]+)$/u.test(line) || /[.!?]$/u.test(line) || line.length > 100 || line.split(/\s+/u).length > 10) return false;
  for (let next = index + 1; next <= index + 4 && next < lines.length; next++) {
    const candidate = lines[next].trim();
    if (!candidate) continue;
    if (/^(?:и|с|его)\s[а-яё\s,]{2,50}$/u.test(candidate)) continue;
    return /[А-ЯЁ]/u.test(candidate) && isDisplayLine(candidate) && candidate.length <= 100 && !/^(?:ДЕНЬ|КРЕЩЕНИЕ|ЗАЧАТИЕ|ОСВЯЩЕНИЕ|УСПЕНИЕ|О СОЗДАНИИ|ЖИТИЕ|ЖИЗНЕОПИСАНИЕ|ЖИЗНЬ|ПАМЯТЬ|СТРАДАНИЕ|ПОДВИГИ|СКАЗАНИЕ|ОБРЕТЕНИЕ|ПЕРЕНЕСЕНИЕ|СЛОВО|УБИЕНИЕ|ПРЕСТАВЛЕНИЕ|ВОСПОМИНАНИЕ|ПОВЕСТЬ|СОБОР|ПРАЗДНОВАНИЕ|СИНАКСАРЬ)(?:\s|,|$)/u.test(candidate);
  }
  return false;
}

// Capitalised display headings are candidates only: OCR can miss or invent boundaries.
export function sectionHeadings(body: string): SectionHeading[] {
  const lines = body.split('\n');
  const offsets: number[] = [];
  let position = 0;
  for (const line of lines) { offsets.push(position); position += line.length + 1; }
  const result: SectionHeading[] = [];
  for (let i = 0; i < lines.length; i++) {
    const first = lines[i].trim().replace(/^_\s+(?=[А-ЯЁ])/u, '');
    // This sentence-case title needs its full subtitle to exclude running headers.
    if (first === 'Повесть о затворнике,') {
      const subtitle = lines.slice(i + 1, i + 5).map(line => line.trim()).filter(Boolean);
      if (subtitle[0] === 'которому Бог открыл об участи' && subtitle[1] === 'принимающих милостыню') {
        result.push({ offset: offsets[i], title: [first, ...subtitle.slice(0, 2)].join(' ') });
      }
      continue;
    }
    // A dropped initial in a display heading requires a separate uppercase name.
    // Preserve the OCR title; do not repair prose or running headers.
    if (first === 'АМЯТЬ СВЯТОГО' && /^[А-ЯЁ]+,$/u.test(lines[i + 1]?.trim() ?? '')) {
      result.push({ offset: offsets[i], title: first + ' ' + lines[i + 1].trim() });
      i += 1;
      continue;
    }
    // This relic feast uses two display lines rather than a generic life heading.
    if (first === 'ПОКЛОНЕНИЕ ЧЕСТНЫМ ВЕРИГАМ'
      && lines[i + 1]?.trim() === 'СВЯТОГО АПОСТОЛА ПЕТРА') {
      result.push({ offset: offsets[i], title: 'ПОКЛОНЕНИЕ ЧЕСТНЫМ ВЕРИГАМ СВЯТОГО АПОСТОЛА ПЕТРА' });
      i += 1;
      continue;
    }
    // Require the separate subject line: running headers also name these accounts.
    if (/^(?:ПЕРВОЕ|ВТОРОЕ) ИЗБИЕНИЕ$/u.test(first)
      && lines[i + 1]?.trim() === 'ПРЕПОДОБНЫХ ОТЦОВ') {
      result.push({ offset: offsets[i], title: `${first} ПРЕПОДОБНЫХ ОТЦОВ` });
      i += 1;
      continue;
    }
    // Praise sermons have a sentence-case label, display subject and author line.
    // Require all three so running headers and prose cannot split a work.
    if (first === 'Похвальное слово') {
      const subject = lines[i + 1]?.trim() ?? '';
      const author = lines[i + 2]?.trim() ?? '';
      if (/^СВЯТОМУ АПОСТОЛУ [А-ЯЁ]+(?: [А-ЯЁ]+)*$/u.test(subject)
        && /^святого [А-ЯЁ][а-яё]+(?: [А-ЯЁ][а-яё]+){1,2}$/u.test(author)) {
        result.push({ offset: offsets[i], title: [first, subject, author].join(' ') });
        i += 2;
      }
      continue;
    }
    if (!/^[А-ЯЁ]/u.test(first) || !headingStart.test(first)) continue;
    // An author line is a heading only when followed by a separate display subject.
    // This excludes running headers, which include a page number or the subject inline.
    const authoredSermon = /^Слово святого [А-ЯЁ][а-яё]+(?: [А-ЯЁ][а-яё]+){1,2}$/u.test(first)
      && lines.slice(i + 1, i + 4).find(line => line.trim())?.trim().match(/^О СВЯТОМ МУЧЕНИКЕ [А-ЯЁ]+$/u);
    if ((!isDisplayLine(first) && !authoredSermon) || first.length > 160) continue;
    // OCR capitalised the end of a sentence in the April account of Agathopous.
    if (/^ЖИЗНЬ\s+СВОЮ[.!]?$/u.test(first)) continue;
    const title = [first];
    let blanks = 0;
    for (let j = i + 1; j < lines.length && j < i + 10 && title.length < 6; j++) {
      const line = lines[j].trim();
      if (!line) { blanks++; if (blanks > 2) break; continue; }
      if (/^ДЕНЬ\s/u.test(line) || headingStart.test(line) || (!isDisplayLine(line) && !bridgesTitleToUppercase(lines, j)) || line.length > 100) break;
      title.push(line);
      blanks = 0;
    }
    result.push({ offset: offsets[i], title: title.join(' ') });
  }
  return result;
}

// Short names in the printed nominative also occur in the heading in oblique cases.
// Compare whole words and a small set of endings, not arbitrary three-letter substrings.
function matchesIndexedName(text: string, name: string): boolean {
  if (matchesTitle(text, name)) return true;
  const normalized = name.toLocaleLowerCase('ru').replaceAll('ё', 'е');
  // «Веры» is also a common noun and needs the explicit collective-title rule below.
  if (normalized === 'вера' || normalized.length !== 4 || !/[ая]$/u.test(normalized)) return false;
  const stem = normalized.slice(0, -1);
  const endings = new Set(['а', 'я', 'ы', 'и', 'е', 'у', 'ю', 'ой', 'ою', 'ей', 'ею']);
  return (text.toLocaleLowerCase('ru').replaceAll('ё', 'е').match(/[а-я]+/gu) ?? []).some(word => word.startsWith(stem) && endings.has(word.slice(stem.length)));
}

/** Only link automatically when the name matches exactly one heading on the page. */
export function uniqueSectionForName(body: string, title: string): number | undefined {
  const name = title.split(/[\s*]+/u)[0];
  if (name.length < 3) return undefined;
  const matches = sectionHeadings(body).map((heading, position) => ({ heading, position })).filter(item => {
    if (matchesIndexedName(item.heading.title, name)) return true;
    // This well-defined collective title changes the endings of both short names.
    const heading = item.heading.title.toLocaleLowerCase('ru').replaceAll('ё', 'е');
    return /^(вера|любовь)$/iu.test(name) && /веры/u.test(heading) && /надежды/u.test(heading) && /любови/u.test(heading) && /мучениц/u.test(heading);
  });
  return matches.length === 1 ? matches[0].position : undefined;
}

export type SectionPage = { body: string; headings: SectionHeading[] };

/** A nearby match is only a lead, never a replacement for the printed reference. */
export function nearbySectionForIndexedName(readPage: (page: number) => SectionPage | undefined, targetPage: number, title: string, accepts: (page: number, offset: number) => boolean): { page: number; section: number } | undefined {
  const name = title.split(/[\s*]+/u)[0];
  if (name.length < 5 || /^(освящение|память|житие|жизнь|страдание|подвиги|сказание|обретение|перенесение|убиение|преставление|воспоминание|празднование|собор)$/iu.test(name)) return undefined;
  const target = readPage(targetPage);
  if (!target || matchesIndexedName(target.body, name)) return undefined;
  const candidates: { page: number; section: number }[] = [];
  for (let page = Math.max(1, targetPage - 2); page <= targetPage + 2; page++) {
    if (page === targetPage) continue;
    const row = readPage(page);
    if (!row) continue;
    row.headings.forEach((heading, section) => {
      if (matchesIndexedName(heading.title, name) && accepts(page, heading.offset)) candidates.push({ page, section });
    });
  }
  return candidates.length === 1 ? candidates[0] : undefined;
}

/** Follow an index page backwards only across contiguous OCR pages and no intervening heading. */
export function sectionForIndexedName(readPage: (page: number) => SectionPage | undefined, targetPage: number, title: string): { page: number; section: number } | undefined {
  const target = readPage(targetPage);
  if (!target) return undefined;
  const current = uniqueSectionForName(target.body, title);
  if (current !== undefined) return { page: targetPage, section: current };
  if (target.headings.length) return undefined;
  const name = title.split(/[\s*]+/u)[0];
  if (name.length < 3 || !matchesIndexedName(target.body, name)) return undefined;
  for (let page = targetPage - 1; page >= Math.max(1, targetPage - 39); page--) {
    const previous = readPage(page);
    if (!previous) return undefined;
    if (previous.headings.length) {
      const section = previous.headings.length - 1;
      return matchesIndexedName(previous.headings[section].title, name) ? { page, section } : undefined;
    }
  }
  return undefined;
}
