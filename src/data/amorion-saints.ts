import type { Commemoration, Saint, Source, Veneration } from '@/domain/types';

// Names checked against the group calendar and pages PDF 139-140 of book 7.
const names: readonly { id: string; name: string; aliases?: readonly string[] }[] = [
  { id: 'konstantin-ammorejskij', name: 'Константин Амморейский', aliases: ['Константин Друнгарий'] },
  { id: 'aetij-ammorejskij', name: 'Аетий Амморейский', aliases: ['Аеций Амморейский'] },
  { id: 'feofil-ammorejskij', name: 'Феофил Амморейский' },
  { id: 'feodor-ammorejskij', name: 'Феодор Амморейский', aliases: ['Феодор Кратир'] },
  { id: 'melissen-ammorejskij', name: 'Мелиссен Амморейский', aliases: ['Милиссен Амморейский'] },
  { id: 'kallist-ammorejskij', name: 'Каллист Амморейский', aliases: ['Каллист Турмарх'] },
  { id: 'vasoj-ammorejskij', name: 'Васой Амморейский', aliases: ['Вассой Амморейский'] },
];

const sourceId = 'calendar-ammorejskie-mucheniki';
export const amorionSources: Source[] = [{ id: sourceId, title: 'Сорок два мученика Амморейских', publisher: 'Азбука веры', url: 'https://azbyka.ru/days/sv-sobor-konstantin-aetij-feofil-feodor-ammorejskie-frigijskie', kind: 'calendar', traditionId: 'russian-orthodox', accessedAt: '2026-11-04', rights: 'Права на интернет-публикацию не установлены. Приведена ссылка на источник.', note: 'Совместная календарная статья называет семерых из сорока двух мучеников. Другие традиции требуют отдельных источников.' }];
export const amorionSaints: Saint[] = names.map(item => ({ id: item.id, slug: item.id, name: item.name, aliases: [...(item.aliases ?? [])], rank: 'мученик', sourceId, sourceLocator: 'Имена и общая память сверены с календарной статьёй и страницами 139-140 книги 7.' }));
export const amorionVenerations: Veneration[] = names.map(item => ({ saintId: item.id, traditionId: 'russian-orthodox', sourceId, note: 'Имя и общая память подтверждены указанным православным источником.' }));
export const amorionCommemorations: Commemoration[] = names.map(item => ({ id: `${item.id}-group`, saintId: item.id, traditionId: 'russian-orthodox', sourceId, label: 'Общая память сорока двух мучеников', rule: { kind: 'fixed', calendar: 'julian', month: 3, day: 6 } }));
