import type { Commemoration, Saint, Veneration } from '@/domain/types';

const entries = [
  { id: 'iosif-arimafejskij', name: 'Иосиф Аримафейский', rank: 'праведный', aliases: ['Иосиф, тайный ученик Христа'], page: 157, detail: 'Отдельный рассказ о погребении Христа. Примечание называет Неделю жен-мироносиц, без постоянной календарной даты.' },
  { id: 'zakhej-kesarijskij', name: 'Закхей Кесарийский', rank: 'святой, епископ', aliases: ['Закхей мытарь', 'Закхей Кесарии Палестинской'], page: 158, detail: 'Закхей, принявший Христа в своём доме, затем епископ Кесарии Палестинской. Не Закхей Гадаринский. Примечание упоминает воскресенье перед началом постной Триоди.' },
  { id: 'maksimin-s-lazarem', name: 'Максимин, спутник Лазаря', rank: 'святой', aliases: ['Максимин, ученик Господень'], page: 157, detail: 'Назван святым учеником Господним в рассказе о лодке с Лазарем. Более точное отождествление и отдельная память этим отрывком не установлены.' },
  { id: 'kelidonij-sleporozhdennyj', name: 'Келидоний Слепорождённый', rank: 'святой', aliases: ['Келидоний, спутник Лазаря'], page: 157, detail: 'Назван святым, родившимся слепым и исцелённым Господом, в рассказе о Лазаре. Отдельная дата памяти в отрывке отсутствует.' },
  { id: 'evnuh-caricy-kandakii', name: 'Евнух царицы Кандакии', rank: 'святой', aliases: ['Эфиопский евнух, крещённый Филиппом'], page: 158, detail: 'Проповедник в Эфиопии, крещённый апостолом Филиппом. Личное имя в этом издании не названо; имя из другого предания не подставлено.' },
];

export const rostovAppendixSaints: Saint[] = entries.map(({ id, name, rank, aliases, page, detail }) => ({
  id, slug: id, name, rank, aliases, sourceId: 'local-rostov',
  sourceLocator: `Книга 5, PDF ${page}, дополнение к Собору семидесяти апостолов. ${detail}`,
}));

export const rostovAppendixVenerations: Veneration[] = entries.map(entry => ({
  saintId: entry.id, traditionId: 'russian-orthodox', sourceId: 'local-rostov',
  note: 'Основание: включение в дополнение к Собору апостолов в Четьих-Минеях, книга 5. Это свидетельство конкретного житийного издания; современный календарь и другие традиции требуют отдельных источников.',
}));

export const rostovAppendixCommemorations: Commemoration[] = [
  { id: 'iosif-arimafejskij-myrrhbearers', saintId: 'iosif-arimafejskij', traditionId: 'russian-orthodox', sourceId: 'local-rostov', label: 'Неделя жен-мироносиц', rule: { kind: 'myrrhbearers', calendar: 'julian' } },
  { id: 'zakhej-kesarijskij-sunday', saintId: 'zakhej-kesarijskij', traditionId: 'russian-orthodox', sourceId: 'local-rostov', label: 'Воскресенье о Закхее', rule: { kind: 'unresolved', note: 'Примечание книги 5, PDF 158: 32-я неделя перед началом постной Триоди. Постоянная дата не назначена; календарное правило требует отдельной сверки.' } },
];
