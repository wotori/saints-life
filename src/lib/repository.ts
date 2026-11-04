import directory from '@/data/directory.json';
import { avvakum, curated, editions, readings, sources, works } from '@/data/library';
import type { Commemoration, Saint, TraditionId, Veneration } from '@/domain/types';
import { convertDate, formatDate } from '@/lib/calendar';

export const traditions: { id: TraditionId; label: string; short: string; note: string }[] = [
  { id: 'russian-orthodox', label: 'Православный месяцеслов', short: 'Православный месяцеслов', note: 'Сведения из месяцеслова «Азбуки веры». Не охватывает автоматически все поместные церкви.' },
  { id: 'old-believer', label: 'Старообрядческая традиция', short: 'Старообрядческая', note: 'РПСЦ и старообрядческие публикации. Точная область подтверждения указана у каждой записи.' },
];

export const saints: Saint[] = [
  ...directory.saints.map(s => ({ ...s, ...curated[s.id] })), avvakum,
];
export const venerations: Veneration[] = [
  ...directory.venerations as Veneration[],
  { saintId: 'dimitrij-solunskij', traditionId: 'old-believer', sourceId: 'ruvera-solunskij', note: 'Почитание отражено в старообрядческой публикации «Русская вера». Конкретное согласие не указано.' },
  { saintId: 'avvakum-petrov', traditionId: 'old-believer', sourceId: 'rpsc-avvakum', note: 'Почитание в РПСЦ подтверждено каноном на официальном сайте Московской митрополии. Не утверждает признания другими церквами.' },
];
export const commemorations: Commemoration[] = [
  ...directory.commemorations as Commemoration[],
  { id: 'solunskij-old-believer', saintId: 'dimitrij-solunskij', traditionId: 'old-believer', sourceId: 'ruvera-solunskij', label: 'День памяти', rule: { kind: 'fixed', calendar: 'julian', month: 10, day: 26 } },
  { id: 'avvakum-pustozersk', saintId: 'avvakum-petrov', traditionId: 'old-believer', sourceId: 'ruvera-avvakum-date', label: 'Память Пустозерских страдальцев', rule: { kind: 'fixed', calendar: 'julian', month: 4, day: 14 } },
];

export { editions, readings, sources, works };
export const getSaint = (slug: string) => saints.find(s => s.slug === slug);
export const getSource = (id: string) => sources.find(s => s.id === id)!;
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
  const words = normalize(filters.q ?? '').split(/\s+/).filter(Boolean);
  return saints.filter(s => {
    const haystack = normalize([s.name, ...s.aliases, s.rank, s.place ?? ''].join(' '));
    return words.every(word => haystack.includes(word)) &&
      (!filters.tradition || saintVenerations(s.id).some(v => v.traditionId === filters.tradition)) &&
      (!filters.rank || s.rank.split(',')[0] === filters.rank) &&
      (filters.reading !== 'yes' || saintReadings(s.id).some(r => r.mode === 'summary'));
  }).sort((a, b) => (a.featured ?? 100) - (b.featured ?? 100) || a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id));
}

export function primaryFeast(saintId: string, year = 2026) {
  const item = saintCommemorations(saintId).find(c => c.rule.kind === 'fixed' && c.label === 'День памяти') ?? saintCommemorations(saintId).find(c => c.rule.kind === 'fixed');
  if (!item || item.rule.kind !== 'fixed') return 'Дата уточняется';
  return formatDate(convertDate({ year, month: item.rule.month, day: item.rule.day }, item.rule.calendar, 'gregorian'));
}
