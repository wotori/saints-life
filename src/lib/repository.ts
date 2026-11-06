import directory from '@/data/directory.json';
import { councilSaints, councilSources, councilVenerations, councilCommemorations } from '@/data/council-saints';
import { avvakum, ioannShanghai, curated, editions, readings, sources, works } from '@/data/library';
import { childrenSaints, childrenSources, childrenVenerations, childrenCommemorations } from '@/data/kids-saints';
import { amorionSaints, amorionSources, amorionVenerations, amorionCommemorations } from '@/data/amorion-saints';
import { bookSaints, bookSaintSources, bookSaintVenerations, bookSaintCommemorations } from '@/data/book-saints';
import { pomorSaints, pomorSources, pomorVenerations, pomorCommemorations } from '@/data/pomor-calendar';
import { rostovAppendixSaints, rostovAppendixVenerations, rostovAppendixCommemorations } from '@/data/rostov-appendix-saints';
import type { Commemoration, Saint, TraditionId, Veneration } from '@/domain/types';
import { commemorationDateForDisplayYear, convertDate, formatDate } from '@/lib/calendar';
import { matchesSearch } from '@/lib/search-terms';

export const traditions: { id: TraditionId; label: string; short: string; note: string }[] = [
  { id: 'russian-orthodox', label: 'Православный месяцеслов', short: 'Православный месяцеслов', note: 'Сведения из месяцеслова «Азбуки веры». Не охватывает автоматически все поместные церкви.' },
  { id: 'old-believer', label: 'Старообрядческая традиция', short: 'Старообрядческая', note: 'Источники разных старообрядческих общин. Точная область подтверждения указана у каждой записи.' },
];

export const saints: Saint[] = [
  ...directory.saints.map(s => ({ ...s, ...curated[s.id] })), avvakum, ioannShanghai, ...childrenSaints, ...amorionSaints, ...bookSaints, ...pomorSaints, ...rostovAppendixSaints, ...councilSaints,
];
export const venerations: Veneration[] = [
  ...directory.venerations as Veneration[],
  { saintId: 'dimitrij-solunskij', traditionId: 'old-believer', sourceId: 'ruvera-solunskij', note: 'Почитание отражено в старообрядческой публикации «Русская вера». Конкретное согласие не указано.' },
  { saintId: 'avvakum-petrov', traditionId: 'old-believer', sourceId: 'rpsc-avvakum', note: 'Почитание в РПСЦ подтверждено каноном на официальном сайте Московской митрополии. Не утверждает признания другими церквами.' },
  { saintId: 'ioann-shanghai', traditionId: 'russian-orthodox', sourceId: 'azbyka-ioann-shanghai', note: 'Память указана в православном месяцеслове; источник сообщает о канонизации РПЦЗ в 1994 году.' },
  ...childrenVenerations,
  ...amorionVenerations,
  ...bookSaintVenerations,
  ...pomorVenerations,
  ...rostovAppendixVenerations,
  ...councilVenerations,
];
export const commemorations: Commemoration[] = [
  ...directory.commemorations as Commemoration[],
  { id: 'solunskij-old-believer', saintId: 'dimitrij-solunskij', traditionId: 'old-believer', sourceId: 'ruvera-solunskij', label: 'День памяти', rule: { kind: 'fixed', calendar: 'julian', month: 10, day: 26 } },
  { id: 'avvakum-pustozersk', saintId: 'avvakum-petrov', traditionId: 'old-believer', sourceId: 'ruvera-avvakum-date', label: 'Память Пустозерских страдальцев', rule: { kind: 'fixed', calendar: 'julian', month: 4, day: 14 } },
  { id: 'ioann-shanghai-memory', saintId: 'ioann-shanghai', traditionId: 'russian-orthodox', sourceId: 'azbyka-ioann-shanghai', label: 'День памяти', rule: { kind: 'fixed', calendar: 'julian', month: 6, day: 19 } },
  { id: 'ioann-shanghai-relics', saintId: 'ioann-shanghai', traditionId: 'russian-orthodox', sourceId: 'azbyka-ioann-shanghai', label: 'Обретение мощей', rule: { kind: 'fixed', calendar: 'julian', month: 9, day: 29 } },
  ...childrenCommemorations,
  ...amorionCommemorations,
  ...bookSaintCommemorations,
  ...pomorCommemorations,
  ...rostovAppendixCommemorations,
  ...councilCommemorations,
];

export { editions, readings, works };
export const allSources = [...sources, ...childrenSources, ...amorionSources, ...bookSaintSources, ...pomorSources, ...councilSources];
export { allSources as sources };
export const getSaint = (slug: string) => saints.find(s => s.slug === slug);
export const getSource = (id: string) => allSources.find(s => s.id === id)!;
export const getEdition = (id: string) => editions.find(e => e.id === id)!;
export const getWork = (id: string) => works.find(w => w.id === id)!;
export const saintReadings = (id: string) => readings.filter(r => r.saintId === id);
export const saintVenerations = (id: string) => venerations.filter(v => v.saintId === id);
export const saintCommemorations = (id: string) => commemorations.filter(c => c.saintId === id);
export const featuredSaints = () => saints.filter(s => s.featured).sort((a, b) => a.featured! - b.featured!);

export function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('ru').replaceAll('ё', 'е').replaceAll('дмитрий', 'димитрий').trim();
}

export interface SearchFilters { q?: string; tradition?: string; rank?: string; reading?: string }
export function searchSaints(filters: SearchFilters) {
  return saints.filter(s => {
    const haystack = [s.name, ...s.aliases, s.rank, s.place ?? ''].join(' ');
    return matchesSearch(haystack, filters.q ?? '') &&
      (!filters.tradition || saintVenerations(s.id).some(v => v.traditionId === filters.tradition)) &&
      (!filters.rank || s.rank.split(',')[0] === filters.rank) &&
      (filters.reading !== 'yes' || saintReadings(s.id).some(r => r.mode === 'summary'));
  }).sort((a, b) => (a.featured ?? 100) - (b.featured ?? 100) || a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id));
}

export function primaryFeast(saintId: string, year = 2026) {
  const item = saintCommemorations(saintId).find(c => c.rule.kind === 'fixed' && c.label === 'День памяти') ?? saintCommemorations(saintId).find(c => c.rule.kind !== 'unresolved');
  if (!item || item.rule.kind === 'unresolved') return 'Дата уточняется';
  const date = commemorationDateForDisplayYear(item, year);
  return date ? formatDate(convertDate(date, item.rule.calendar, 'gregorian')) : 'Дата уточняется';
}
