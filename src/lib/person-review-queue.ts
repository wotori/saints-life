import { createHash } from 'node:crypto';
import { nameInflectionSuggestions } from './name-inflection-suggestions';

export type NameCandidate = {
  book: number; page: number; candidate: string; sourceSha256: string;
  pageTextSha256: string; offsets: number[]; chunkId: string;
};
type CataloguePerson = { id: string; name: string; aliases: readonly string[] };
type Page = { body: string; sourceSha256: string };

/** Spelling suggestions only. Neither a unique name nor an alias proves identity. */
export function personReviewQueue(candidates: readonly NameCandidate[], people: readonly CataloguePerson[], readPage: (book: number, page: number) => Page | undefined) {
  const normalize = (value: string) => value.normalize('NFC').toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/gu, ' ').trim();
  const names = new Map<string, Set<string>>();
  const firstNames = new Map<string, Set<string>>();
  const inflectedNames = new Map<string, Set<string>>();
  for (const person of people) for (const value of [person.name, ...person.aliases]) {
    const first = normalize(value).split(/[\s,]+/u)[0];
    if (!first) continue;
    if (!firstNames.has(first)) firstNames.set(first, new Set());
    firstNames.get(first)!.add(person.id);
    for (const form of nameInflectionSuggestions(value)) {
      if (!inflectedNames.has(form)) inflectedNames.set(form, new Set());
      inflectedNames.get(form)!.add(person.id);
    }
  }
  for (const person of people) for (const value of [person.name, ...person.aliases]) {
    const key = normalize(value);
    if (!key) continue;
    if (!names.has(key)) names.set(key, new Set());
    names.get(key)!.add(person.id);
  }
  const pages = new Map<string, { page: Page; hash: string; chars: string[] } | undefined>();
  const groups = new Map<string, {
    spelling: string; variants: Set<string>; suggestedSaintIds: string[]; suggestionBasis: string;
    declensionSuggestedSaintIds: string[];
    occurrences: { book: number; page: number; offset: number; text: string; context: string; sourceSha256: string; pageTextSha256: string; scanUrl: string; readingUrl: string; chunkIds: string[] }[];
  }>();
  const rejected: { candidate: NameCandidate; reason: string }[] = [];
  for (const candidate of candidates) {
    const pageKey = `${candidate.book}:${candidate.page}`;
    if (!pages.has(pageKey)) {
      const page = readPage(candidate.book, candidate.page);
      pages.set(pageKey, page && { page, hash: createHash('sha256').update(page.body).digest('hex'), chars: Array.from(page.body) });
    }
    const saved = pages.get(pageKey);
    if (!saved || saved.page.sourceSha256 !== candidate.sourceSha256 || saved.hash !== candidate.pageTextSha256) {
      rejected.push({ candidate, reason: 'source-or-page-changed' });
      continue;
    }
    const length = Array.from(candidate.candidate).length;
    const offsets = candidate.offsets;
    if (!length || !offsets.length || offsets.some(offset => !Number.isInteger(offset) || offset < 0 || saved.chars.slice(offset, offset + length).join('') !== candidate.candidate)) {
      rejected.push({ candidate, reason: 'invalid-literal-offset' });
      continue;
    }
    const key = normalize(candidate.candidate);
    const exact = names.get(key);
    const first = !/\s/u.test(key) ? firstNames.get(key) : undefined;
    if (!groups.has(key)) groups.set(key, { spelling: key, variants: new Set(),
      suggestedSaintIds: [...new Set([...(exact ?? []), ...(first ?? [])])].sort(),
      declensionSuggestedSaintIds: [...(inflectedNames.get(key) ?? [])].sort(),
      suggestionBasis: first ? 'first-name-only' : exact ? 'full-name-or-alias' : 'none', occurrences: [] });
    const group = groups.get(key)!;
    group.variants.add(candidate.candidate);
    for (const offset of new Set(offsets)) {
      const existing = group.occurrences.find(item => item.book === candidate.book && item.page === candidate.page && item.offset === offset && item.text === candidate.candidate);
      if (existing) {
        if (!existing.chunkIds.includes(candidate.chunkId)) existing.chunkIds.push(candidate.chunkId);
        continue;
      }
      group.occurrences.push({ book: candidate.book, page: candidate.page, offset, text: candidate.candidate,
        context: saved.chars.slice(Math.max(0, offset - 180), offset + length + 220).join(''),
        sourceSha256: candidate.sourceSha256, pageTextSha256: candidate.pageTextSha256,
        scanUrl: `/api/library/book/${candidate.book}/${candidate.page}`,
        readingUrl: `/library/book/${candidate.book}/${candidate.page}?${new URLSearchParams({ focus: candidate.candidate })}`,
        chunkIds: [candidate.chunkId] });
    }
  }
  const queue = [...groups.values()].map(group => ({ ...group, variants: [...group.variants].sort(),
    status: 'unreviewed' as const,
    spellingMatch: group.suggestedSaintIds.length === 0 ? 'none' : group.suggestedSaintIds.length === 1 ? 'single' : 'ambiguous',
    occurrences: group.occurrences.sort((a, b) => a.book - b.book || a.page - b.page || a.offset - b.offset),
  })).sort((a, b) => b.occurrences.length - a.occurrences.length || a.spelling.localeCompare(b.spelling, 'ru'));
  return { scope: 'Spelling and separate generated declension suggestions, never verified identities or evidence of sainthood. First-name and declension hints include catalogue aliases, cover some forms only and are not exhaustive.', queue, rejected };
}
