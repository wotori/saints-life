import test from 'node:test';
import assert from 'node:assert/strict';
import { commemorations, editions, getSaint, readings, saints, searchSaints, sources, venerations, works } from '../src/lib/repository';
import { convertDate, daysInMonth, fromJdn, isValidDate, matchesCommemoration, monthCells, parseDate, toJdn } from '../src/lib/calendar';
import { matchesSearch, matchesTitle, searchTerms, searchVariants } from '../src/lib/search-terms';
import { reviewedRangeForIndex } from '../src/lib/reviewed-book-ranges';
import { reviewedMentionForPage } from '../src/lib/reviewed-book-mentions';

test('four October accounts preserve ten identities and their source-specific memories', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const groups = [
    { page: 106, heading: 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ ГАИЯ, ФАВСТА, ЕВСЕВИЯ и ХЕРИМОНА', ids: ['gaij-aleksandrijskij', 'favst-aleksandrijskij', 'evsevij-laodikijskij', 'herimon-aleksandrijskij'] },
    { page: 107, heading: 'ПАМЯТЬ СВЯТОГО МУЧЕНИКА ДАВИКТА', ids: ['davikt-efesskij', 'kallisfenija-efesskaja'] },
    { page: 108, heading: 'ПАМЯТЬ ПРЕПОДОБНОМУЧЕНИКА ПЕТРА,', ids: ['petr-kapetolijskij'] },
    { page: 109, heading: 'ПАМЯТЬ СВЯТЫХ МУЧЕНИЦ ДОМНИНЫ,', ids: ['domnina-antiohijskaja', 'virineja-antiohijskaja', 'proskudija-antiohijskaja'] },
  ];
  const sha = 'b33fb5a65d1985f7eef9fe3b0afdf3acc482cd632124240a2672f0652805f849';
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id));
    assert.deepEqual(reviewedWorkForPage(id, 2, group.page, sha, group.heading), { book: 2, page: group.page, section: 0 });
    for (const source of ['calendar-pamyati-4-oktjabrja-kniga-2', 'pomor-mesjaceslov-2015']) assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === source && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 10 && c.rule.day === 4));
  }
  assert.match(getSaint('kallisfenija-efesskaja')?.sourceLocator ?? '', /мирной кончине/);
  assert.ok(commemorations.some(c => c.saintId === 'pavel-preprostyj' && c.sourceId === 'pomor-mesjaceslov-2015' && c.rule.kind === 'fixed' && c.rule.month === 10 && c.rule.day === 4));
});

test('Egean saints keep neighbouring memories and distinguish mentions within a life', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = 'b33fb5a65d1985f7eef9fe3b0afdf3acc482cd632124240a2672f0652805f849';
  const four = ['klavdij-kilikijskij', 'asterij-kilikijskij', 'neon-kilikijskij', 'feonilla-kilikijskaja'];
  for (const id of four) {
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-klavdij-asterij-neon-feonilla' && c.rule.kind === 'fixed' && c.rule.month === 10 && c.rule.day === 29));
    assert.deepEqual(reviewedMentionForPage(id, 2, 608, sha, 'В тот же день память святых мучеников Клавдия, Астерия Неона'), { book: 2, page: 608 });
  }
  for (const id of ['zinovij-egejskij', 'zinovija-egejskaja', ...four.slice(0, 3)]) {
    assert.deepEqual(reviewedWorkForPage(id, 2, 609, sha, 'СТРАДАНИЕ СВЯТОГО СВЯЩЕННОМУЧЕНИКА ЗИНОВИЯ,'), { book: 2, page: 609, section: 0 });
  }
  assert.equal(reviewedWorkForPage(four[3], 2, 609, sha, 'СТРАДАНИЕ СВЯТОГО СВЯЩЕННОМУЧЕНИКА ЗИНОВИЯ,'), undefined);
  for (const id of ['zinovij-egejskij', 'zinovija-egejskaja']) assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'pomor-mesjaceslov-2015' && c.rule.kind === 'fixed' && c.rule.month === 10 && c.rule.day === 30));
});

test('Corinthian and Adrianople commemorations cite each date independently', async () => {
  const { reviewedWorkLocations } = await import('../src/lib/reviewed-book-works');
  const corinth = ['leonid-korinfskij', 'hariessa-korinfskaja', 'nunehija-korinfskaja', 'vasilissa-korinfskaja', 'feodora-korinfskaja', 'nika-korinfskaja', 'galina-korinfskaja'];
  for (const id of corinth) {
    assert.ok(getSaint(id));
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-leonid-s-nim-korinfskie' && c.rule.kind === 'fixed' && c.rule.month === 4 && c.rule.day === 16));
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-korinfskie-march' && c.rule.kind === 'fixed' && c.rule.month === 3 && c.rule.day === 10));
    assert.ok(reviewedWorkLocations(id).some(w => w.book === 7 && w.page === 189));
  }
  const sha = '01c0ca7096c861b5edf80f97c2ee15484b2bb6c8b59cd0ab751e69690aa72ab9';
  for (const id of ['maksim-adrianopolskij', 'feodot-adrianopolskij', 'isihij-adrianopolskij', 'asklipiodota-adrianopolskaja']) {
    assert.deepEqual(reviewedMentionForPage(id, 6, 339, sha, 'В тот же день память святых мучеников Максима, Феодота, Иси-'), { book: 6, page: 339 });
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-maksim-feodot-isihij-asklipiodota' && c.rule.kind === 'fixed' && c.rule.month === 2 && c.rule.day === 19));
    assert.equal(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-adrianopolskie-september'), id !== 'isihij-adrianopolskij');
  }
});

test('nine named Nicopolis martyrs share the book and four have explicit Pomor evidence', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const ids = ['leontij-nikopolskij', 'mavrikij-nikopolskij', 'daniil-nikopolskij', 'antonij-nikopolskij', 'aleksandr-nikopolskij', 'ianikit-nikopolskij', 'sisinij-nikopolskij', 'menej-nikopolskij', 'virilad-nikopolskij'];
  for (const id of ids) {
    assert.ok(getSaint(id));
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-sorok-pjat-nikopolskih' && c.rule.kind === 'fixed' && c.rule.month === 7 && c.rule.day === 10));
    assert.deepEqual(reviewedWorkForPage(id, 11, 234, 'b36fd4ff7ec4ba22854e5f55c566d0f4e7661394995e9586e207f42e8f4876df', 'СТРАДАНИЕ СВЯТЫХ СОРОКА ПЯТИ МУЧЕНИКОВ,'), { book: 11, page: 234, section: 0 });
    assert.equal(venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'), ids.slice(0, 4).includes(id));
  }
});

test('additional Pomor calendar matches retain the printed month and source page', () => {
  for (const [id, month, day, page] of [
    ['anatolij-konstantinopolskij-patriarh', 7, 3, 14],
    ['lukija-rimskaja-s-riksom', 7, 6, 14],
    ['isavr-makedonskij', 7, 6, 14],
    ['koint-frigijskij', 7, 6, 14],
    ['peregrin-dirrahijskij', 7, 7, 14],
    ['evsevon-makkavej', 8, 1, 16],
    ['minsifej-pergijskij', 8, 1, 16],
  ] as const) {
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'pomor-mesjaceslov-2015' && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === month && c.rule.day === day), id);
    assert.ok(venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015' && v.note.includes(`PDF ${page}`)), id);
  }
  assert.ok(!venerations.some(v => ['kiriak-pergijskij', 'papij-dirrahijskij'].includes(v.saintId) && v.sourceId === 'pomor-mesjaceslov-2015'));
});

test('March Pomor evidence covers the names printed in their respective groups', () => {
  const groups = [
    { day: 6, ids: ['feodor-ammorejskij', 'konstantin-ammorejskij'] },
    { day: 7, ids: ['vasilij-hersonesskij', 'evgenij-hersonesskij', 'efrem-hersonesskij', 'kapiton-hersonesskij', 'eferij-hersonesskij', 'elpidij-hersonesskij', 'agafodor-hersonesskij'] },
    { day: 9, ids: ['afanasij-sevastijskij', 'dometian-sevastijskij', 'kirill-sevastijskij', 'evtihij-sevastijskij', 'nikolaj-sevastijskij', 'aleksandr-sevastijskij', 'leontij-sevastijskij', 'ioann-sevastijskij'] },
    { day: 10, ids: ['kodrat-korinfskij', 'kiprian-korinfskij', 'dionisij-s-kodratom', 'anekt-korinfskij', 'pavel-s-kodratom', 'kriskent-korinfskij'] },
  ];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.ok(venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015' && v.note.includes('PDF 5')), id);
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'pomor-mesjaceslov-2015' && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 3 && c.rule.day === group.day), id);
  }
  assert.ok(!venerations.some(v => ['aetij-ammorejskij', 'kandid-sevastijskij'].includes(v.saintId) && v.sourceId === 'pomor-mesjaceslov-2015'));
});

test('the Pomor calendar supports only explicitly matched names and preserves independent traditions', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const kizik = ['feognid-kizicheskij', 'ruf-kizicheskij', 'antipatr-kizicheskij', 'feostih-kizicheskij', 'artema-kizicheskij', 'magn-kizicheskij', 'feodot-kizicheskij', 'favmasij-kizicheskij', 'filimon-kizicheskij'];
  const kerkyra = ['satornij-kerkirskij', 'iakishol-kerkirskij', 'favstian-kerkirskij', 'marsalij-kerkirskij', 'mammij-kerkirskij'];
  for (const [day, ids] of [[29, kizik], [28, kerkyra]] as const) for (const id of ids) {
    assert.ok(venerations.some(v => v.saintId === id && v.traditionId === 'old-believer' && v.sourceId === 'pomor-mesjaceslov-2015'));
    assert.ok(venerations.some(v => v.saintId === id && v.traditionId === 'russian-orthodox'));
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'pomor-mesjaceslov-2015' && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 4 && c.rule.day === day));
  }
  for (const id of kizik) assert.deepEqual(reviewedWorkForPage(id, 8, 437, '34cad51db160ddb198289ea09aa9cd1745abb00e2f2eba61e6bb229cdc078e90', 'ПАМЯТЬ СВЯТЫХ ДЕВЯТИ МУЧЕНИКОВ,'), { book: 8, page: 437, section: 0 });
  assert.ok(!venerations.some(v => v.saintId === 'iannarij-kerkirskij' && v.sourceId === 'pomor-mesjaceslov-2015'));
  assert.ok(!venerations.some(v => v.saintId === 'evfrasij-kerkirskij' && v.sourceId === 'pomor-mesjaceslov-2015'));
});

test('July sixth memories connect distinct people to reviewed texts and a short entry', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = 'b36fd4ff7ec4ba22854e5f55c566d0f4e7661394995e9586e207f42e8f4876df';
  const groups = [
    { page: 117, heading: 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ МАРИНА, МАРФЫ, АВДИФАКСА, АВВАКУМА,', ids: ['marin-persjanin-rimskij', 'marfa-persijanka-rimskaja', 'avdifaks-rimskij', 'avvakum-rimskij', 'kirin-rimskij', 'valentin-rimskij-presviter', 'asterij-rimskij-s-marinom'] },
    { page: 128, heading: 'СТРАДАНИЕ СВЯТОЙ МУЧЕНИЦЫ ЛУКИЙ ДЕВИЦЫ', ids: ['lukija-rimskaja-s-riksom', 'riks-s-lukiej', 'antonij-s-lukiej', 'lukian-s-lukiej', 'isidor-s-lukiej', 'dion-s-lukiej', 'dior-s-lukiej', 'kutonij-s-lukiej', 'aronos-s-lukiej', 'kapik-s-lukiej', 'satur-s-lukiej'] },
    { page: 129, heading: 'СТРАДАНИЕ СВЯТОГО МУЧЕНИКА КОИНТА', ids: ['koint-frigijskij'] },
  ];
  const short = ['isavr-makedonskij', 'innokentij-makedonskij', 'filiks-makedonskij', 'ermij-makedonskij', 'vasilij-makedonskij', 'peregrin-makedonskij', 'ruf-makedonskij', 'rufin-makedonskij', 'iulianija-olshanskaja'];
  for (const group of groups) for (const id of group.ids) assert.deepEqual(reviewedWorkForPage(id, 11, group.page, sha, group.heading), { book: 11, page: group.page, section: 0 });
  for (const id of short) assert.deepEqual(reviewedMentionForPage(id, 11, 130, sha, id === 'iulianija-olshanskaja' ? 'В тот же день обретение честных мощей святой Иулиании девицы,' : 'В тот же день память святых мучеников Исавра диакона, Иннокен-'), { book: 11, page: 130 });
  for (const id of [...groups.flatMap(group => group.ids), ...short]) {
    assert.ok(getSaint(id), id);
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-pamyati-6-ijulja-kniga-11' && c.rule.kind === 'fixed' && c.rule.month === 7 && c.rule.day === 6), id);
  }
  assert.ok(commemorations.some(c => c.saintId === 'iulianija-olshanskaja' && c.label === 'Обретение мощей'));
});

test('separate July memories retain their identities and the translation of Philip’s relics', () => {
  const ids = ['anatolij-pecherskij-blizhnie', 'anatolij-konstantinopolskij-patriarh', 'diomid-kesarijskij', 'evlampij-kesarijskij', 'asklipiodot-kesarijskij', 'golinduha-kesarijskaja', 'filipp-mitropolit-moskovskij', 'vasilij-vsevolodovich-jaroslavskij', 'konstantin-vsevolodovich-jaroslavskij', 'ioann-moskovskij-jurodivyj', 'ioann-jarengskij', 'longin-jarengskij', 'nikodim-kozheozerskij'];
  const sha = 'b36fd4ff7ec4ba22854e5f55c566d0f4e7661394995e9586e207f42e8f4876df';
  const body = "В тот же день память святого отца нашего Анатолия, патриарха\nЦареградского\nВ тот же день память святых мучеников Диомида, Евлампия, Аскли-\nВ тот же день память преподобного Анатолия Печерского, в\nВ тот же день перенесение мощей святителя Филиппа, митрополита\nВ тот же день память благоверных князей Василия и Константина\nВ тот же день преставление блаженного Иоанна, юродивого Мо-\nВ тот же день память преподобных Иоанна и Лонгина, Яренгских\nВ тот же день преставление преподобного Никодима Кожеозерского";
  for (const id of ids) {
    assert.ok(getSaint(id));
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-pamyati-3-ijulja-kniga-11' && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 7 && c.rule.day === 3));
    assert.deepEqual(reviewedMentionForPage(id, 11, 65, sha, body), { book: 11, page: 65 });
  }
  assert.equal(reviewedMentionForPage('anatolij-pecherskij-blizhnie', 11, 65, sha, 'В тот же день память святого отца нашего Анатолия, патриарха'), undefined);
  assert.ok(commemorations.some(c => c.saintId === 'filipp-mitropolit-moskovskij' && c.label === 'Перенесение мощей'));
  assert.equal(reviewedMentionForPage(ids[0], 11, 65, 'wrong-edition', body), undefined);
});

test('the short Corfu memory links eleven named saints to its verified edition and page', () => {
  const ids = ['satornij-kerkirskij', 'iakishol-kerkirskij', 'favstian-kerkirskij', 'iannarij-kerkirskij', 'marsalij-kerkirskij', 'evfrasij-kerkirskij', 'mammij-kerkirskij', 'zinon-kerkirskij', 'evsevij-kerkirskij', 'neon-kerkirskij', 'vitalij-kerkirskij'];
  const sha = '34cad51db160ddb198289ea09aa9cd1745abb00e2f2eba61e6bb229cdc078e90';
  const body = 'В тот же день память святых мучеников: Саторния, Иакисхола,\nФавстиана';
  for (const id of ids) {
    assert.ok(getSaint(id));
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-odinnadcat-kerkirskih' && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 4 && c.rule.day === 28));
    assert.deepEqual(reviewedMentionForPage(id, 8, 436, sha, body), { book: 8, page: 436 });
  }
  assert.equal(reviewedMentionForPage(ids[0], 8, 436, 'different', body), undefined);
  assert.equal(reviewedMentionForPage(ids[0], 8, 436, sha, 'Другой текст'), undefined);
  assert.equal(reviewedMentionForPage('someone-else', 8, 436, sha, body), undefined);
});

test('a reviewed collective passage requires the correct edition, date, range and heading', () => {
  const entry = { book: 5, sourceSha256: 'e62ed1051709261e1b21d03eac3e74d8475e1f77e28c5a56d2faf2b0390e242f', day: 4, pdfPage: 160, reviewed: true };
  const body = (page: number) => page === 139 ? 'ДЕНЬ ЧЕТВЕРТЫЙ\n\nСОБОР\nСВЯТЫХ\nСЕМИДЕСЯТИ АПОСТОЛОВ\n\nТекст.' : undefined;
  assert.deepEqual(reviewedRangeForIndex(entry, body), { page: 139, section: 0 });
  for (const changed of [{ book: 4 }, { sourceSha256: 'another' }, { day: 5 }, { pdfPage: 138 }, { pdfPage: 161 }, { reviewed: false }]) assert.equal(reviewedRangeForIndex({ ...entry, ...changed }, body), undefined);
  assert.equal(reviewedRangeForIndex(entry, () => 'Другой текст'), undefined);
  assert.equal(reviewedRangeForIndex(entry, () => undefined), undefined);
});

test('six named martyrs have a shared sourced commemoration and book passage', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const ids = ['kir-aleksandrijskij', 'ioann-aleksandrijskij-bessrebrenik', 'afanasija-kanopskaja', 'feoktista-kanopskaja', 'feodotija-kanopskaja', 'evdoksija-kanopskaja'];
  for (const id of ids) {
    assert.ok(getSaint(id));
    assert.ok(commemorations.some(item => item.saintId === id && item.sourceId === 'calendar-kir-ioann-afanasija-docheri' && item.rule.kind === 'fixed' && item.rule.calendar === 'julian' && item.rule.month === 1 && item.rule.day === 31));
    assert.deepEqual(reviewedWorkForPage(id, 5, 835, 'e62ed1051709261e1b21d03eac3e74d8475e1f77e28c5a56d2faf2b0390e242f', 'СТРАДАНИЕ СВЯТЫХ ЧУДОТВОРЦЕВ И БЕССРЕБРЕНИКОВ КИРА и ИОАННА'), { book: 5, page: 835, section: 0 });
  }
});

test('Julian feast converts to the civil day without relying on a fixed 13-day offset', () => {
  assert.deepEqual(convertDate({ year: 2026, month: 10, day: 26 }, 'julian', 'gregorian'), { year: 2026, month: 11, day: 8 });
  assert.deepEqual(convertDate({ year: 2100, month: 10, day: 26 }, 'julian', 'gregorian'), { year: 2100, month: 11, day: 9 });
  assert.deepEqual(convertDate({ year: 2026, month: 12, day: 25 }, 'julian', 'gregorian'), { year: 2027, month: 1, day: 7 });
});

test('leap years and weekday placement use each calendar system', () => {
  assert.equal(daysInMonth(2100, 2, 'julian'), 29);
  assert.equal(daysInMonth(2100, 2, 'gregorian'), 28);
  assert.deepEqual(monthCells(2026, 11, 'gregorian')[6].display, { year: 2026, month: 11, day: 1 });
  assert.equal(monthCells(2026, 11, 'gregorian').length, 42);
  for (const calendar of ['gregorian', 'julian'] as const) {
    for (const year of [1601, 1700, 1900, 2000, 2026, 2100, 2198]) {
      for (const month of [1, 2, 3, 12]) {
        const date = { year, month, day: daysInMonth(year, month, calendar) };
        assert.deepEqual(fromJdn(toJdn(date, calendar), calendar), date);
      }
    }
  }
});

test('untrusted calendar dates are validated, not silently normalized', () => {
  assert.equal(parseDate('2026-02-30'), null);
  assert.equal(parseDate('2026-00-10'), null);
  assert.equal(parseDate('oops'), null);
  assert.equal(parseDate('2024-02-29')?.day, 29);
  assert.equal(isValidDate({ year: 2026, month: 2, day: Number.NaN }), false);
});

test('Dmitry and Dimitry aliases and diacritics find the same matching entries', () => {
  assert.equal(searchSaints({ q: 'Дмитрий' }).length, 75);
  assert.equal(searchSaints({ q: 'Дими́трий' }).length, 75);
  assert.equal(searchSaints({ q: 'Дмитрий Солунский' })[0].id, 'dimitrij-solunskij');
  assert.equal(searchSaints({ q: 'неизвестноеимя' }).length, 0);
});

test('book title search finds familiar nominative names in source headings', () => {
  assert.ok(matchesTitle('Житие преподобного Мартирия Зеленецкого', 'Мартирий'));
  assert.ok(matchesTitle('Житие преподобного Сергия Радонежского', 'Сергей'));
  assert.ok(matchesTitle('Память святителя Димитрия Ростовского', 'Дмитрий'));
  assert.ok(matchesTitle('Житие преподобного Саввы', 'Савва'));
  assert.equal(matchesTitle('Житие преподобного Сергия', 'Мария'), false);
  assert.deepEqual(searchTerms('"Димитрий" OR 123'), ['димитри', 'or', '123']);
});

test('book discovery supports common and church forms without treating names as identities', () => {
  for (const [title, query] of [
    ['Иоанн Богослов', 'Иван'], ['Иван', 'Иоанн'], ['Феодор мученик', 'Фёдор'],
    ['Память пророка Илии', 'Илья'], ['Георгий Победоносец', 'Егор'],
    ['Дмитрий Солунский', 'Димитрий'], ['Сергей', 'Сергий'],
  ]) assert.equal(matchesSearch(title, query), true, `${query}: ${title}`);
  assert.equal(matchesSearch('Кикилия мученица', 'Илья'), false);
  assert.equal(matchesSearch('Иоанн мученик', 'Иван святитель'), false);
  assert.deepEqual(searchVariants('Фёдор'), [['федор', 'фёдор', 'феодор']]);
  // Matching a name is not enough to auto-link a book section to a person.
  assert.equal(matchesTitle('Память Иоанна', 'Иван'), false);
  assert.ok(searchSaints({ q: 'Фёдор Сикеот' }).some(s => s.id === 'feodor-sikeot'));
  assert.ok(searchSaints({ q: 'Иван Милостивый' }).some(s => s.id === 'ioann-milostivyj'));
});

test('veneration filters are explicit, and an orthodox record never implies an Old Believer claim', () => {
  const ids = searchSaints({ tradition: 'old-believer' }).map(s => s.id).sort();
  assert.equal(ids.length, 1525);
  assert.ok(ids.every(id => venerations.some(v => v.saintId === id && v.traditionId === 'old-believer')));
  assert.ok(!ids.includes('kiriak-pergijskij'));
  assert.ok(!ids.includes('papij-dirrahijskij'));
  assert.equal(searchSaints({ q: 'Дмитрий', tradition: 'old-believer' }).length, 5);
  assert.ok(searchSaints({ q: 'Дмитрий', tradition: 'old-believer' }).some(s => s.id === 'dimitrij-dabudskij'));
  assert.equal(searchSaints({ reading: 'yes' }).length, 7);
  const reverends = searchSaints({ rank: 'преподобный' });
  assert.ok(reverends.some(s => s.id === 'moisej-murin'));
  assert.ok(reverends.every(s => s.rank.includes('преподобный')));
});

test('same-name records retain independent identities', () => {
  assert.equal(searchSaints({ q: 'Розанов' }).length, 3);
  assert.equal(searchSaints({ q: 'Троицкий' }).length, 2);
  assert.notEqual(getSaint('dimitrij-uglichskij')?.id, getSaint('dimitrij-uglichskij-priluckij')?.id);
});

test('all catalog relationships resolve and external editions never masquerade as local texts', () => {
  for (const collection of [saints, commemorations, sources, works, editions, readings]) assert.equal(new Set(collection.map(item => item.id)).size, collection.length);
  for (const s of saints) assert.ok(sources.some(source => source.id === s.sourceId));
  for (const claim of [...venerations, ...commemorations]) {
    assert.ok(saints.some(s => s.id === claim.saintId));
    assert.ok(sources.some(s => s.id === claim.sourceId));
  }
  for (const r of readings) {
    const edition = editions.find(e => e.id === r.editionId)!;
    assert.ok(edition);
    assert.ok(works.some(w => w.id === edition.workId));
    edition.sourceIds.forEach(id => assert.ok(sources.some(s => s.id === id)));
    if (r.mode === 'external') {
      assert.equal(edition.rights, 'external-only');
      assert.equal(r.sections.length, 0);
    } else assert.ok(r.sections.length > 0);
  }
});

test('calendar matches shared feasts without including unresolved movable dates', () => {
  const hits = commemorations.filter(c => matchesCommemoration(c, { year: 2026, month: 11, day: 8 }));
  assert.equal(hits.filter(c => c.saintId === 'dimitrij-solunskij').length, 2);
  assert.ok(hits.some(c => c.saintId === 'dimitrij-basarbovskij'));
  assert.ok(hits.some(c => c.saintId === 'dimitrij-samopozhertvovatel'));
  const unresolved = commemorations.find(c => c.rule.kind === 'unresolved')!;
  assert.equal(matchesCommemoration(unresolved, { year: 2026, month: 2, day: 8 }), false);
});

test('St John of Shanghai has two separately sourced fixed commemorations', () => {
  assert.ok(getSaint('ioann-shanghai'));
  const dates = commemorations.filter(c => c.saintId === 'ioann-shanghai');
  assert.equal(dates.length, 2);
  assert.ok(dates.some(c => matchesCommemoration(c, { year: 2026, month: 7, day: 2 })));
  assert.ok(dates.some(c => matchesCommemoration(c, { year: 2026, month: 10, day: 12 })));
  assert.ok(dates.every(c => c.sourceId === 'azbyka-ioann-shanghai'));
});

test('verified children’s book links have individual calendar sources and no invented cross-tradition claims', () => {
  const ids = ['nikolaj-mirlikijskij', 'georgij-pobedonosec', 'serafim-sarovskij', 'spiridon-trimifuntskij', 'matrona-moskovskaja', 'ksenija-peterburgskaja', 'aleksandr-nevskij', 'olga-kievskaja', 'ioann-milostivyj', 'evstafij-plakida', 'pelagija-antiohijskaja', 'longin-sotnik', 'moisej-murin', 'artemij-verkolskij'];
  for (const id of ids) {
    assert.ok(getSaint(id));
    const source = id === 'evstafij-plakida' ? 'calendar-evstafij-semja' : `calendar-${id}`;
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === source));
    assert.ok(venerations.some(v => v.saintId === id && v.sourceId === source));
    const oldWitness = venerations.find(v => v.saintId === id && v.traditionId === 'old-believer');
    if (['ioann-milostivyj', 'aleksandr-nevskij', 'nikolaj-mirlikijskij', 'spiridon-trimifuntskij', 'georgij-pobedonosec', 'artemij-verkolskij', 'olga-kievskaja', 'moisej-murin', 'evstafij-plakida', 'pelagija-antiohijskaja', 'longin-sotnik'].includes(id)) assert.equal(oldWitness?.sourceId, 'pomor-mesjaceslov-2015');
    else assert.equal(oldWitness, undefined);
  }
  assert.ok(commemorations.some(c => c.saintId === 'nikolaj-mirlikijskij' && matchesCommemoration(c, { year: 2026, month: 12, day: 19 })));
  assert.ok(commemorations.some(c => c.saintId === 'georgij-pobedonosec' && matchesCommemoration(c, { year: 2026, month: 5, day: 6 })));
});

test('Eustathius and his family have four distinct records tied to both accounts', async () => {
  const { childrenChapterLinks } = await import('../src/data/kids-saints');
  const ids = ['evstafij-plakida', 'feopistija-rimskaja', 'agapij-rimskij', 'feopist-rimskij'];
  for (const id of ids) {
    assert.ok(getSaint(id));
    assert.equal(childrenChapterLinks[id].id, 'kids-saints-5');
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-evstafij-semja' && matchesCommemoration(c, { year: 2026, month: 10, day: 3 })));
    assert.ok(venerations.some(v => v.saintId === id && v.traditionId === 'old-believer' && v.sourceId === 'pomor-mesjaceslov-2015' && v.note.includes('PDF 20')));
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'old-believer' && c.sourceId === 'pomor-mesjaceslov-2015' && matchesCommemoration(c, { year: 2026, month: 10, day: 3 })));
  }
});

test('the Pechersk history links four named people to their shared chapter and individual sources', async () => {
  const { childrenChapterLinks } = await import('../src/data/kids-saints');
  for (const id of ['ilarion-kievskij', 'antonij-pecherskij', 'feodosij-pecherskij', 'nestor-letopisec']) {
    assert.ok(getSaint(id));
    assert.equal(childrenChapterLinks[id].id, 'kids-saints-22');
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === `calendar-${id}`));
    assert.ok(venerations.some(v => v.saintId === id && v.sourceId === `calendar-${id}`));
    const oldWitness = venerations.find(v => v.saintId === id && v.traditionId === 'old-believer');
    if (['feodosij-pecherskij', 'antonij-pecherskij'].includes(id)) assert.equal(oldWitness?.sourceId, 'pomor-mesjaceslov-2015');
    else assert.equal(oldWitness, undefined);
  }
  assert.ok(commemorations.some(c => c.saintId === 'antonij-pecherskij' && matchesCommemoration(c, { year: 2026, month: 7, day: 23 })));
  assert.ok(commemorations.some(c => c.saintId === 'feodosij-pecherskij' && matchesCommemoration(c, { year: 2026, month: 5, day: 16 })));
});

test('the forty martyrs have distinct cards, one documented group and a shared book chapter', async () => {
  const { childrenChapterLinks } = await import('../src/data/kids-saints');
  const people = saints.filter(s => s.id.endsWith('-sevastijskij') && childrenChapterLinks[s.id]?.id === 'kids-saints-19');
  assert.equal(people.length, 40);
  assert.equal(new Set(people.map(s => s.id)).size, 40);
  assert.ok(people.some(s => s.id === 'kirion-sevastijskij'));
  assert.ok(people.some(s => s.id === 'aglaij-sevastijskij'));
  for (const person of people) {
    assert.ok(commemorations.some(c => c.saintId === person.id && c.sourceId === 'calendar-sevastijskie-mucheniki' && matchesCommemoration(c, { year: 2026, month: 3, day: 22 })));
    const namedInPomor = ['afanasij', 'dometian', 'kirill', 'evtihij', 'nikolaj', 'aleksandr', 'leontij', 'ioann'].map(name => `${name}-sevastijskij`);
    assert.equal(venerations.some(v => v.saintId === person.id && v.traditionId === 'old-believer'), namedInPomor.includes(person.id));
  }
});

test('seven named martyrs of Amorium retain distinct cards and their common commemoration', async () => {
  const { reviewedWorkLocations } = await import('../src/lib/reviewed-book-works');
  const people = saints.filter(s => s.id.endsWith('-ammorejskij'));
  assert.equal(people.length, 7);
  for (const person of people) {
    assert.deepEqual(reviewedWorkLocations(person.id), [{ book: 7, page: 139 }]);
    assert.ok(commemorations.some(c => c.saintId === person.id && c.sourceId === 'calendar-ammorejskie-mucheniki' && matchesCommemoration(c, { year: 2026, month: 3, day: 19 })));
    assert.equal(venerations.some(v => v.saintId === person.id && v.traditionId === 'old-believer'), ['feodor-ammorejskij', 'konstantin-ammorejskij'].includes(person.id));
  }
});

test('the two new family groups have individual cards with their common memories', async () => {
  const { reviewedWorkLocations } = await import('../src/lib/reviewed-book-works');
  for (const id of ['vera-rimskaja', 'nadezhda-rimskaja', 'ljubov-rimskaja', 'sofija-rimskaja']) {
    assert.ok(getSaint(id));
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-vera-nadezhda-ljubov-sofija' && matchesCommemoration(c, { year: 2026, month: 9, day: 30 })));
    assert.deepEqual(reviewedWorkLocations(id), [{ book: 1, page: 342 }]);
  }
  for (const id of ['boris-strastoterpec', 'gleb-strastoterpec']) {
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-boris-gleb' && matchesCommemoration(c, { year: 2026, month: 5, day: 15 })));
    assert.ok(reviewedWorkLocations(id).some(w => w.book === 9 && w.page === 74));
  }
  assert.ok(reviewedWorkLocations('gleb-strastoterpec').some(w => w.book === 1 && w.page === 152));
});

test('reviewed edition links require the same person, file and unique heading', async () => {
  const { reviewedWorkForPage, reviewedWorkLocations } = await import('../src/lib/reviewed-book-works');
  const works = (await import('../src/data/reviewed-book-work-links.json')).default.works;
  for (const work of works) {
    for (const id of work.saintIds) {
      assert.ok(getSaint(id), id);
      assert.ok(reviewedWorkLocations(id).some(item => item.book === work.book && item.page === work.page));
      const multiline: Record<string, string> = {
        '5:460': 'ПОКЛОНЕНИЕ ЧЕСТНЫМ ВЕРИГАМ\nСВЯТОГО АПОСТОЛА ПЕТРА',
        '5:389': 'ПЕРВОЕ ИЗБИЕНИЕ\nПРЕПОДОБНЫХ ОТЦОВ',
        '5:403': 'ВТОРОЕ ИЗБИЕНИЕ\nПРЕПОДОБНЫХ ОТЦОВ',
        "3:772": "Похвальное слово\nСВЯТОМУ АПОСТОЛУ АНДРЕЮ ПЕРВОЗВАННОМУ\nсвятого Иоанна Златоустого",
        '3:507': 'Слово святого Василия Великого\n\nО СВЯТОМ МУЧЕНИКЕ ВАРЛААМЕ',
        '3:510': 'Слово святого Иоанна Златоуста\n\nО СВЯТОМ МУЧЕНИКЕ ВАРЛААМЕ',
        "6:153": "ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ\n\nТЫСЯЧИ и ТРЕХ,",
        "12:86": "СЛОВО\nна\n\nПРЕОБРАЖЕНИЕ ГОСПОДНЕ",
        "12:81": "СИНАКСАРЬ!\nна\n\nПРЕОБРАЖЕНИЕ ГОСПОДНЕ",
        "5:7": "СЛОВО\nна\n\nОБРЕЗАНИЕ ХРИСТОВО",
        '12:252': 'ПЕРЕНЕСЕНИЕ\n\nиз Эдессы в Константинополь\nНЕРУКОТВОРНОГО ОБРАЗА\n\nГОСПОДА НАШЕГО ИИСУСА ХРИСТА',
        '1:291': 'СЛОВО\nна\n\nОБНОВЛЕНИЕ ИЕРУСАЛИМСКОГО ХРАМА\nВОСКРЕСЕНИЯ ХРИСТОВА!',
        '2:490': 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ\nАЛЕКСАНДРА ЕПИСКОПА, ИРАКЛИЯ ВОИНА\n\nи четырех жен:\n\nАННЫ, ЕЛИСАВЕТЫ, ФЕОДОТИИ и ГЛИКЕРИИ',
        '1:200': 'Слово\nна\n\nРОЖДЕСТВО БОГОРОДИЦЫ',
        '9:551': 'СТРАДАНИЕ\nСВЯТОГО СВЯЩЕННОМУЧЕНИКА\n\nПАТРИКИЯ\n\nи с ним трех пресвитеров:\nАКАКИЯ, МЕНАНДРА и ПОЛИЕНА',
        '8:427': 'ПАМЯТЬ\nСВЯТЫХ АПОСТОЛОВ\n\nИАСОНА и СОСИПАТРА\n\nи святой мученицы\n\nКЕРКИРЫ ДЕВЫ',
        '6:376': 'СТРАДАНИЕ\nСВЯТОГО МУЧЕНИКА\n\nМАВРИКИЯ\n\nи сына его\n\nФОТИНА\nи с ними семидесяти воинов',
        '6:405': 'ПЕРВОЕ И ВТОРОЕ\n\nОБРЕТЕНИЕ ЧЕСТНОЙ ГЛАВЫ\nПредтечи и Крестителя Господня\n\nИОАННА',
        '6:244': 'ЖИТИЕ\nПРЕПОДОБНОГО ОТЦА НАШЕГО\n\nМАРТИНИАНА,\n\nи память святых жен\n\nЗОИ и ФОТИНИИ',
        '6:276': 'ПЕРЕНЕСЕНИЕ МОЩЕЙ СВЯТОГО БЛАГОВЕРНОГО КНЯЗЯ\n\nМИХАИЛА ВСЕВОЛОДОВИЧА\nЧерниговского, и боярина его\n\nФЕОДОРА',
        '6:98': 'СТРАДАНИЕ\nСВЯТОЙ МУЧЕНИЦЫ\n\nФАВСТЫ ДЕВИЦЫ\n\nи с нею\n\nЕВИЛАСИЯ и МАКСИМА',
        '6:105': 'СТРАДАНИЕ\nСВЯТОЙ МУЧЕНИЦЫ\n\nДОРОФЕИ\n\nи с ней\nХРИСТИНЫ, КАЛЛИСТЫ и ФЕОФИЛА',
        '6:118': 'ПАМЯТЬ СВЯТЫХ МУЧЕНИЦ\nМАРФЫ и МАРИИ\n\nи брата их святого мученика\nЛИКАРИОНА ОТРОКА',
        '6:19': 'ПАМЯТЬ СВЯТОЙ МУЧЕНИЦЫ\nПЕРПЕТУИ\n\nи с ней святых юношей\n\nСАТИРА, РЕВОКАТА, САТОРНИЛА, СЕКУНДА',
        '5:753': 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ\nВАВИЛЫ СИЦИЛИЙСКОГО\n\nи учеников его\n\nТИМОФКЯ и АГАПИЯ',
        '4:170': 'ПАМЯТЬ ПРЕПОДОБНЫХ\nКАРИОНА МОНАХА\n\nи сына его\n\nЗАХАРИИ',
        '4:398': 'СТРАДАНИЕ\nСВЯТОГО СВЯЩЕННОМУЧЕНИКА\n\nЕЛЕВФЕРИЯ\n\nи матери его\n\nАНФИИ',
        '1:370': 'ПАМЯТЬ СВЯТОГО БЛАГОВЕРНОГО КНЯЗЯ\nФЕОДОРА,\n\nСмоленского и Ярославского чудотворца,\nи чад его\n\nДАВИДА и КОНСТАНТИНА',
        '9:522': 'СТРАДАНИЕ\nСВЯТОГО МУЧЕНИКА\n\nФЕОДОТА\n\nи с ним семи дев:\n\nФАИНЫ, КЛАВДИИ, МАТРОНЫ, ТЕКУСЫ,\nИУЛИИ, АЛЕКСАНДРЫ и ЕВФРАСИИ',
        '10:58': 'ПАМЯТЬ\nСВЯТОГО МУЧЕНИКА\n\nЛУКИЛЛИАНА,\n\nи с ним четырех отроков:\nКЛАВДИЯ, ИПАТИЯ, ПАВЛА и ДИОНИСИЯ,\nи святой девы ПАВЛЫ',
      };
      const heading = work.book === 6 && work.page === 33 && work.expectedHeading === 'ПАМЯТЬ СВЯТОГО МУЧЕНИКА' ? 'ПАМЯТЬ СВЯТОГО МУЧЕНИКА\nВЛАСИЯ?' : multiline[`${work.book}:${work.page}`] ?? work.expectedHeading;
      const body = `${heading}\n\nТекст раздела.`;
      assert.deepEqual(reviewedWorkForPage(id, work.book, work.page, work.sourceSha256, body), { book: work.book, page: work.page, section: 0 });
      assert.equal(reviewedWorkForPage(id, work.book, work.page, 'different-source', body), undefined);
      assert.equal(reviewedWorkForPage(id, work.book, work.page, work.sourceSha256, `${body}\n\n${heading}`), undefined);
    }
  }
  assert.equal(reviewedWorkForPage('unrelated-person', works[0].book, works[0].page, works[0].sourceSha256, works[0].expectedHeading), undefined);
});

test('Yaroslavl princes retain separate cards and two shared commemorations', async () => {
  const { reviewedWorkLocations } = await import('../src/lib/reviewed-book-works');
  for (const id of ['feodor-chernyj-jaroslavskij', 'david-feodorovich-jaroslavskij', 'konstantin-feodorovich-jaroslavskij']) {
    assert.ok(getSaint(id));
    assert.deepEqual(reviewedWorkLocations(id), id === 'david-feodorovich-jaroslavskij'
      ? [{ book: 1, page: 370 }, { book: 12, page: 113 }]
      : [{ book: 1, page: 370 }]);
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-feodor-david-konstantin-jaroslavskie' && matchesCommemoration(c, { year: 2026, month: 10, day: 2 })));
    assert.ok(commemorations.some(c => c.saintId === id && matchesCommemoration(c, { year: 2026, month: 3, day: 18 })));
  }
});

 test('running headers are found when a printed page number precedes or follows the title', async () => {
  const { extractRunningHeading } = await import('../src/lib/search-terms');
  assert.equal(extractRunningHeading('  146 Житие преподобного отца\nТекст'), 'Житие преподобного отца');
  assert.equal(extractRunningHeading('Память святого 147\nТекст'), 'Память святого');
  assert.equal(extractRunningHeading('146 Введение\nТекст'), undefined);
});

test('printed index OCR keeps uncertain references and infers a page only with visible separators', async () => {
  const { parsePrintedIndexLine } = await import('../src/lib/search-terms');
  assert.deepEqual(parsePrintedIndexLine('Мамант* мученик...........| 2| 74'), { title: 'Мамант* мученик', sourceLine: '| 2| 74', printedDay: 2, printedPage: 74 });
  assert.deepEqual(parsePrintedIndexLine('Михаил* князь..............| 201395'), { title: 'Михаил* князь', sourceLine: '| 201395' });
  assert.equal(parsePrintedIndexLine('Обычный текст без указателя'), undefined);
  assert.deepEqual(parsePrintedIndexLine('Автоном* священномученик |12 |282'), { title: 'Автоном* священномученик', sourceLine: '|12 |282', printedDay: 12, printedPage: 282 });
  assert.deepEqual(parsePrintedIndexLine('Аристион священномученик | 31102'), { title: 'Аристион священномученик', sourceLine: '| 31102' });
  assert.deepEqual(parsePrintedIndexLine('Ипатий* священномученик. ..| 21 |407'), { title: 'Ипатий* священномученик', sourceLine: '| 21 |407', printedDay: 21, printedPage: 407 });
  assert.deepEqual(parsePrintedIndexLine('Дионисий* священномученик! 3| 72'), { title: 'Дионисий* священномученик', sourceLine: '! 3| 72', printedDay: 3, printedPage: 72 });
  assert.deepEqual(parsePrintedIndexLine('Иоанн* Многострадальный 18 374'), { title: 'Иоанн* Многострадальный', sourceLine: '18 374', printedDay: 18, printedPage: 374 });
  assert.equal(parsePrintedIndexLine('Заголовок таблицы | число'), undefined);
});

test('wrapped index names retain their first line and source position without crossing columns', async () => {
  const { parsePrintedIndexPage } = await import('../src/lib/search-terms');
  const rows = parsePrintedIndexPage('Анна (Евфимиан)\nпреподобная ........... | 29 |601\nАлександр*, патриарх Кон-\nстантинопольский ........| 30 |479\nИмена святых', 'Сергий преподобный .....| 1 | 20');
  assert.deepEqual(rows.map(row => [row.lineNumber, row.parsed.title]), [[1, 'Анна (Евфимиан) преподобная'], [3, 'Александр*, патриарх Константинопольский'], [5, 'Сергий преподобный']]);
  assert.match(rows[0].raw, /Анна \(Евфимиан\)\nпреподобная/u);
});

test('printed page offsets require a sufficient and consistent sample', async () => {
  const { estimatePrintedPageOffset } = await import('../src/lib/search-terms');
  const rows = Array.from({ length: 12 }, (_, i) => ({ page: i + 20, body: `${i + 19} Житие` }));
  assert.equal(estimatePrintedPageOffset([]), undefined);
  assert.equal(estimatePrintedPageOffset(rows), 1);
  assert.equal(estimatePrintedPageOffset(rows.slice(0, 9)), undefined);
  assert.equal(estimatePrintedPageOffset([...rows, { page: 30, body: '25 Житие' }]), undefined);
});

test('book day evidence needs adjacent numbered headings, complete pages and the name in the section', async () => {
  const { dayRanges, dayForNamedPage, dayHeadingOffsets, dayStarts } = await import('../src/lib/book-days');
  const pages = [
    { page: 75, body: 'ДЕНЬ ВТОРОЙ\n\nЖИТИЕ МАМАНТА' },
    { page: 76, body: 'Продолжение жития Маманта' },
    { page: 77, body: 'ДЕНЬ ТРЕТИЙ\n\nЖИТИЕ АНФИМА' },
  ];
  const ranges = dayRanges(pages);
  assert.equal(dayForNamedPage(ranges, pages[0], 'Мамант* мученик')?.day, 2);
  assert.equal(dayForNamedPage(ranges, pages[1], 'Анфим') , undefined);
  assert.equal(dayRanges([pages[0], pages[2]]).length, 0);
  assert.equal(dayRanges([pages[0], { ...pages[2], body: 'ДЕНЬ ЧЕТВЕРТЫЙ' }]).length, 0);
  assert.equal(dayRanges([{ page: 1, body: 'день второй раз он молился' }, pages[2]]).length, 0);
  const text = 'Продолжение\n\nДЕНЬ ТРЕТИЙ\n\nТекст\n\nДЕНЬ НЕИЗВЕСТНЫЙ\n\nОдин день третий раз';
  assert.deepEqual(dayHeadingOffsets(text), [text.indexOf('ДЕНЬ ТРЕТИЙ')]);
  const footnote = 'Предыдущий текст\n\nДЕНЬ ШЕСТНАДЦАТЫЙ!\n\nТекст.';
  assert.deepEqual(dayHeadingOffsets(footnote), [footnote.indexOf('ДЕНЬ ШЕСТНАДЦАТЫЙ')]);
  assert.equal(dayHeadingOffsets('ДЕНЬ ШЕСТНАДЦАТЫЙ! и ещё слова').length, 0);
  assert.equal(dayRanges([{ page: 1, body: footnote }, { page: 2, body: 'ДЕНЬ СЕМНАДЦАТЫЙ !' }])[0]?.day, 16);
  const misread = 'Предыдущий текст\n\nЛень пятый\n\nСТРАДАНИЕ АГАФИИ';
  assert.deepEqual(dayHeadingOffsets(misread), [misread.indexOf('Лень пятый')]);
  assert.equal(dayHeadingOffsets('Лень пятый раз вставать').length, 0);
  assert.equal(dayRanges([{ page: 1, body: misread }, { page: 2, body: 'ДЕНЬ ШЕСТОЙ' }])[0]?.day, 5);
  const observed = [
    ['ДеЕнь СЕДЬМОЙ', 7], ['ДЛеЕнь пятый', 5], ['ЛеЕнь восьмой', 8],
    ['ДЕНЬ ДЕВЯТНАДПАТЫЙ', 19], ['ДЕНЬ ДЕВЯТНАДПЦАТЫЙ', 19],
    ['ДЕНЬ ПЯТНАДНАТЫЙ', 15], ['ДЕНЬ ТРИДПЦАТЫЙ', 30],
  ] as const;
  for (const [heading, expected] of observed) {
    assert.deepEqual(dayHeadingOffsets(`вступление\n${heading}\nтекст`), ['вступление\n'.length]);
    assert.equal(dayStarts([{ page: 1, body: 'ДЕНЬ ПЕРВЫЙ' }, { page: 2, body: heading }]).at(-1)?.day, expected);
  }
});

test('book-day navigation admits unique ordered starts without inventing a day range', async () => {
  const { dayStarts, dayRanges } = await import('../src/lib/book-days');
  const pages = [
    { page: 1, body: 'ДЕНЬ ВТОРОЙ\n\nПервый текст.' },
    { page: 5, body: 'ДЕНЬ ЧЕТВЕРТЫЙ\n\nПоследний текст.' },
  ];
  assert.deepEqual(dayStarts(pages).map(start => [start.day, start.page]), [[2, 1], [4, 5]]);
  assert.equal(dayRanges(pages).length, 0);
  assert.deepEqual(dayStarts([pages[0]]), []);
  assert.deepEqual(dayStarts([...pages, { page: 6, body: 'ДЕНЬ ЧЕТВЕРТЫЙ' }]).filter(start => start.day === 4), []);
  assert.deepEqual(dayStarts([{ page: 1, body: 'ДЕНЬ ПЯТЫЙ' }, { page: 2, body: 'ДЕНЬ ТРЕТИЙ' }]), []);
});

test('checked ending of a volume is tied to the edition and complete source pages', async () => {
  const { reviewedBookDayEnding } = await import('../src/lib/reviewed-book-day-endings');
  const sha = '5d6ad1d1f29953b1f717fcc709ec01032ad6928b642e5b4664378b70284fb152';
  const pages = [
    { page: 637, body: 'ДЕНЬ ДВАДЦАТЬ ДЕВЯТЫЙ' },
    { page: 638, body: 'Ранее\n\nДЕНЬ ТРИДЦАТЫЙ\n\nПоследняя память.' },
    { page: 639, body: 'АЛФАВИТ СВЯТЫХ,\n\nИмена.' },
  ];
  const result = reviewedBookDayEnding(10, 638, sha, pages);
  assert.deepEqual(result, { day: 30, firstPage: 638, firstOffset: 7, nextPage: 639, nextOffset: 0, kind: 'index' });
  assert.equal(reviewedBookDayEnding(10, 638, 'other-edition', pages), undefined);
  assert.equal(reviewedBookDayEnding(10, 638, sha, pages.slice(0, 2)), undefined);
  assert.equal(reviewedBookDayEnding(10, 638, sha, [pages[0], pages[1], { page: 639, body: 'Другой текст' }]), undefined);
  assert.equal(reviewedBookDayEnding(10, 638, sha, [pages[0], { ...pages[1], body: 'ДЕНЬ ДВАДЦАТЬ ВОСЬМОЙ' }, pages[2]]), undefined);
});

test('section headings preserve offsets and do not mistake prose or running headers for headings', async () => {
  const { sectionHeadings } = await import('../src/lib/book-sections');
  const text = 'Житие святого Маманта 74\n\nДЕНЬ ВТОРОЙ\n\nЖИТИЕ И СТРАДАНИЕ\nСВЯТОГО МУЧЕНИКА\nМАМАНТА\n\nСвятой жил в Пафлагонии.\n\nПАМЯТЬ СВЯТОГО\nИОАННА\n\nДругой текст.';
  const headings = sectionHeadings(text);
  assert.equal(headings.length, 2);
  assert.equal(headings[0].title, 'ЖИТИЕ И СТРАДАНИЕ СВЯТОГО МУЧЕНИКА МАМАНТА');
  assert.ok(text.slice(headings[0].offset).startsWith('ЖИТИЕ И СТРАДАНИЕ'));
  assert.ok(text.slice(headings[1].offset).startsWith('ПАМЯТЬ СВЯТОГО'));
});

test('OCR headings recover mixed-case connectors and preserve consecutive section boundaries', async () => {
  const { sectionHeadings, uniqueSectionForName } = await import('../src/lib/book-sections');
  const group = 'ПАМЯТЬ СВЯТОГО БЛАГОВЕРНОГО КНЯЗЯ\nФЕОДОРА,\n\nСмоленского и Ярославского чудотворца,\nи чад его\n\nДАВИДА и КОНСТАНТИНА\n\nТекст жития.';
  assert.equal(sectionHeadings(group)[0].title, 'ПАМЯТЬ СВЯТОГО БЛАГОВЕРНОГО КНЯЗЯ ФЕОДОРА, Смоленского и Ярославского чудотворца, и чад его ДАВИДА и КОНСТАНТИНА');
  assert.equal(uniqueSectionForName(group, 'Давид князь'), 0);
  assert.equal(uniqueSectionForName(group, 'Константин князь'), 0);
  const mixed = 'ПАМЯТЬ святых МУЧЕНИКОВ\nДИОДОРА и ДИДИМА\n\nТекст.\n\nПАМЯТЬ СВЯТОГО ИОАННА\n\nИной текст.';
  assert.equal(uniqueSectionForName(mixed, 'Дидим мученик'), 0);
  assert.equal(uniqueSectionForName(mixed, 'Диодор мученик'), 0);
  assert.equal(sectionHeadings('ПАМЯТЬ ПЕРВАЯ\nПАМЯТЬ ВТОРАЯ\n\nТекст.').length, 2);
  assert.equal(sectionHeadings('ПАМЯТЬ ПЕРВАЯ\n\nЭто обычное предложение.\n\nПАМЯТЬ ВТОРАЯ')[0].title, 'ПАМЯТЬ ПЕРВАЯ');
  const nikandr = 'Житие ПРЕПОДОБНОГО ОТЦА НАШЕГО\nНИКАНДРА ПСКОВСКОГО\n\nТекст жития.';
  assert.equal(uniqueSectionForName(nikandr, 'Никандр преподобный'), 0);
  assert.equal(sectionHeadings('Житие преподобного Никандра 487\n\nОбычный текст.').length, 0);
  assert.equal(sectionHeadings('Увидев такое\nстрадание святых мучеников и\nузнав об этом.').length, 0);
  assert.equal(sectionHeadings('Слово\nна\n\nРОЖДЕСТВО БОГОРОДИЦЫ\n\nТекст.')[0].title, 'Слово на РОЖДЕСТВО БОГОРОДИЦЫ');
});

test('an index name links to a section only when exactly one page heading matches', async () => {
  const { uniqueSectionForName } = await import('../src/lib/book-sections');
  const page = 'ЖИТИЕ МАМАНТА\n\nТекст\n\nПАМЯТЬ ИОАННА\n\nТекст';
  assert.equal(uniqueSectionForName(page, 'Мамант* мученик'), 0);
  assert.equal(uniqueSectionForName(page, 'Иоанн* святитель'), 1);
  assert.equal(uniqueSectionForName(page, 'Георгий'), undefined);
  assert.equal(uniqueSectionForName(page + '\n\nЖИТИЕ МАМАНТА', 'Мамант'), undefined);
  assert.equal(uniqueSectionForName('ЖИТИЕ ПРАВЕДНЫХ\nИОАКИМА и АННЫ\n\nТекст.', 'Анна праведная'), 0);
  assert.equal(uniqueSectionForName('ПАМЯТЬ МУЧЕНИКОВ\nДАДЫ, ГАВЕДДАЯ и КАЗДОИ', 'Дада мученик'), 0);
  assert.equal(uniqueSectionForName('ЖИТИЕ ИОНЫ\n\nТекст.', 'Иона пророк'), 0);
  assert.equal(uniqueSectionForName('ЖИТИЕ АННОНИЯ\n\nТекст.', 'Анна'), undefined);
  assert.equal(uniqueSectionForName('ЖИТИЕ ИОНЫ\n\nТекст.\n\nПАМЯТЬ ИОНЫ', 'Иона'), undefined);
});

test('indexed commemorations and collective lives link to their printed headings', async () => {
  const { sectionHeadings, uniqueSectionForName } = await import('../src/lib/book-sections');
  const page = 'ПАМЯТЬ МУЧЕНИКОВ\n\nТекст.\n\nУБИЕНИЕ СВЯТОГО КНЯЗЯ\nГЛЕБА\n\nЖизнь Глеба.\n\nПРАЗДНОВАНИЕ СВЯТОМУ АПОСТОЛУ\n';
  assert.deepEqual(sectionHeadings(page).map(h => h.title), ['ПАМЯТЬ МУЧЕНИКОВ', 'УБИЕНИЕ СВЯТОГО КНЯЗЯ ГЛЕБА', 'ПРАЗДНОВАНИЕ СВЯТОМУ АПОСТОЛУ']);
  assert.equal(uniqueSectionForName(page, 'Глеб князь'), 1);
  const collective = 'СТРАДАНИЕ\nСВЯТЫХ МУЧЕНИЦ\n\nВЕРЫ, НАДЕЖДЫ И ЛЮБОВИ\nИ МАТЕРИ ИХ\n\nСОФИИ\n\nТекст.';
  for (const name of ['Вера* мученица', 'Надежда* мученица', 'Любовь* мученица', 'София* мученица']) assert.equal(uniqueSectionForName(collective, name), 0);
  assert.equal(uniqueSectionForName('ЖИТИЕ СВЯТОГО\nЗА ВЕРЫ ИСПОВЕДАНИЕ\n\nТекст.', 'Вера мученица'), undefined);
  assert.equal(sectionHeadings('СИНАКСАРЬ НА РОЖДЕСТВО\nСВЯТОГО ИОАННА,\n\nТекст.')[0].title, 'СИНАКСАРЬ НА РОЖДЕСТВО СВЯТОГО ИОАННА,');
  assert.equal(sectionHeadings('СИНАКСАРЬ!\n\nТекст.')[0].title, 'СИНАКСАРЬ!');
  assert.equal(sectionHeadings('ДЕНЬ ДВАДЦАТЬ ВТОРОЙ\n\nЖИЗНЕОПИСАНИЕ\nРАВНОАПОСТОЛЬНОЙ СВЯТОЙ МИРОНОСИЦЫ\n\nМАРИИ МАГДАЛИНЫ\n\nТекст.')[0].title, 'ЖИЗНЕОПИСАНИЕ РАВНОАПОСТОЛЬНОЙ СВЯТОЙ МИРОНОСИЦЫ МАРИИ МАГДАЛИНЫ');
  assert.equal(sectionHeadings('Жизнеописание равноапостольной Марии Магдалины 475\n\nТекст.').length, 0);
  const { reviewedBoundary } = await import('../src/lib/reviewed-book-boundaries');
  assert.equal(reviewedBoundary(11, 658, 'ЖИТИЕ СВЯТОГО ПРЕПОДОБНОМУЧЕНИКА АФАНАСИЯ БРЕСТСКОГО!', 'b36fd4ff7ec4ba22854e5f55c566d0f4e7661394995e9586e207f42e8f4876df', 687, 'АЛФАВИТ СВЯТЫХ,\n\nУказатель'), 0);
  assert.equal(reviewedBoundary(11, 658, 'ЖИТИЕ СВЯТОГО ПРЕПОДОБНОМУЧЕНИКА АФАНАСИЯ БРЕСТСКОГО!', 'wrong-edition', 687, 'АЛФАВИТ СВЯТЫХ,\n\nУказатель'), undefined);
});

test('an index reference can find a preceding heading only across intact pages and without an intervening section', async () => {
  const { sectionHeadings, sectionForIndexedName } = await import('../src/lib/book-sections');
  const raw = new Map([[4, 'ЖИТИЕ МАМАНТА\n\nНачало'], [5, 'Мамант продолжает свой путь'], [6, 'Житие Маманта 6\n\nПродолжение']]);
  const read = (page: number) => { const body = raw.get(page); return body === undefined ? undefined : { body, headings: sectionHeadings(body) }; };
  assert.deepEqual(sectionForIndexedName(read, 6, 'Мамант* мученик'), { page: 4, section: 0 });
  raw.delete(5);
  assert.equal(sectionForIndexedName(read, 6, 'Мамант'), undefined);
  raw.set(5, 'ПАМЯТЬ ИОАННА\n\nДругое житие');
  assert.equal(sectionForIndexedName(read, 6, 'Мамант'), undefined);
  raw.set(5, 'Мамант');
  raw.set(6, 'Текст без его имени');
  assert.equal(sectionForIndexedName(read, 6, 'Мамант'), undefined);
});

test('nearby sections are only suggested for a unique matching heading and preserve the indexed page', async () => {
  const { sectionHeadings, nearbySectionForIndexedName } = await import('../src/lib/book-sections');
  const raw = new Map([[8, 'ПАМЯТЬ СВЯТОГО МУЧЕНИКА АВДИЯ\n\nНачало'], [9, 'Другой текст'], [10, 'ПАМЯТЬ АПОСТОЛА ПЕТРА\n\nТекст'], [11, 'Ещё текст'], [12, 'Конец']]);
  const read = (page: number) => { const body = raw.get(page); return body === undefined ? undefined : { body, headings: sectionHeadings(body) }; };
  assert.deepEqual(nearbySectionForIndexedName(read, 10, 'Авдий мученик', () => true), { page: 8, section: 0 });
  assert.equal(nearbySectionForIndexedName(read, 10, 'Авдий мученик', () => false), undefined);
  raw.set(11, 'ПАМЯТЬ СВЯТОГО АВДИЯ\n\nДругой раздел');
  assert.equal(nearbySectionForIndexedName(read, 10, 'Авдий мученик', () => true), undefined);
  raw.delete(11);
  raw.set(10, 'Продолжение жития Авдия');
  assert.equal(nearbySectionForIndexedName(read, 10, 'Авдий мученик', () => true), undefined);
  assert.equal(nearbySectionForIndexedName(read, 10, 'Воспоминание события', () => true), undefined);
});

test('manual page classification applies only to the reviewed edition and empty successful OCR', async () => {
  const { reviewedPageType } = await import('../src/lib/reviewed-page-types');
  const reviews = (await import('../src/data/reviewed-page-types.json')).default;
  const first = reviews.books.find(item => item.book === 1)!;
  assert.equal(reviewedPageType(1, first.sourceSha256, 156, 'ok', ''), 'illustration');
  assert.equal(reviewedPageType(1, first.sourceSha256, 674, 'ok', ''), 'cover');
  assert.equal(reviewedPageType(1, 'different-edition', 156, 'ok', ''), undefined);
  assert.equal(reviewedPageType(1, first.sourceSha256, 156, 'ok', 'Новый распознанный текст'), undefined);
  assert.equal(reviewedPageType(1, first.sourceSha256, 156, 'error', ''), undefined);
});

test('merged table numbers remain candidates and respect day and book limits', async () => {
  const { mergedIndexCandidates, parsePrintedIndexLine } = await import('../src/lib/search-terms');
  assert.deepEqual(mergedIndexCandidates('| 31100', 30, 673), [{ day: 3, page: 100 }]);
  assert.deepEqual(mergedIndexCandidates('| 231466', 30, 673), [{ day: 23, page: 466 }]);
  assert.deepEqual(mergedIndexCandidates('| 31100', 2, 673), []);
  assert.deepEqual(mergedIndexCandidates('| 31100', 30, 99), []);
  assert.deepEqual(mergedIndexCandidates('| 2| 74', 30, 673), []);
  assert.deepEqual(parsePrintedIndexLine('Ираида мученица ........... 23 | 466]'), { title: 'Ираида мученица', sourceLine: '23 | 466]', printedDay: 23, printedPage: 466 });
});

test('merged index references are used only when book evidence leaves exactly one candidate', async () => {
  const { recoverMergedIndexReference } = await import('../src/lib/search-terms');
  assert.deepEqual(recoverMergedIndexReference('| 11111', 31, 500, page => page === 11), { day: 11, page: 11 });
  assert.equal(recoverMergedIndexReference('| 11111', 31, 500, () => true), undefined);
  assert.equal(recoverMergedIndexReference('| 11111', 31, 500, () => false), undefined);
});

test('printed index retains names with OCR quote marks and grouped entries', async () => {
  const { parsePrintedIndexLine } = await import('../src/lib/search-terms');
  assert.deepEqual(parsePrintedIndexLine("'Трофим* мученик ...........| 19|359"), { title: 'Трофим* мученик', sourceLine: '| 19|359', printedDay: 19, printedPage: 359 });
  assert.deepEqual(parsePrintedIndexLine('Афанасия» преподобная .... | 9|196'), { title: 'Афанасия» преподобная', sourceLine: '| 9|196', printedDay: 9, printedPage: 196 });
  assert.deepEqual(parsePrintedIndexLine('40 дев постниц ............| 1| 72'), { title: '40 дев постниц', sourceLine: '| 1| 72', printedDay: 1, printedPage: 72 });
});

test('OCR line reflow is optional and leaves the original source unchanged', async () => {
  const { formatOcrParagraph } = await import('../src/lib/ocr-format');
  const original = 'родился в Пафлаго-\nнии и на северо-\nзападе';
  assert.equal(formatOcrParagraph(original, false), 'родился в Пафлаго- нии и на северо- западе');
  assert.equal(formatOcrParagraph(original, true), 'родился в Пафлагонии и на северозападе');
  assert.equal(original, 'родился в Пафлаго-\nнии и на северо-\nзападе');
});

test('John biography covers all 17 source chapters with consecutive PDF pages', async () => {
  const { johnChapters } = await import('../src/data/john-chapters');
  assert.equal(johnChapters.length, 17);
  assert.equal(johnChapters[0].first, 14);
  assert.equal(johnChapters[16].last, 254);
  johnChapters.forEach((chapter, index) => {
    assert.equal(chapter.number, index + 1);
    assert.ok(chapter.first <= chapter.last);
    if (index > 0) assert.equal(chapter.first, johnChapters[index - 1].last + 1);
  });
});

test('collective lives link distinct people to one chapter and one evidence source', async () => {
  const { childrenChapterLinks } = await import('../src/data/kids-saints');
  const pairs = [
    ['petr-muromskij', 'fevronija-muromskaja', 'kids-saints-26', 'calendar-petr-fevronija-muromskie'],
    ['kiprian-antiohijskij', 'iustina-antiohijskaja', 'kids-saints-17', 'calendar-kiprian-iustina'],
    ['maksimilian-efesskij', 'iamvlih-efesskij', 'kids-saints-3', 'calendar-efesskie-otroki'],
    ['daniil-prorok', 'ananija-vavilonskij', 'kids-saints-13', 'calendar-daniil-tri-otroka'],
    ['ksenofont-konstantinopolskij', 'marija-konstantinopolskaja', 'kids-saints-28', 'calendar-ksenofont-marija-deti'],
  ];
  for (const [first, second, chapter, source] of pairs) {
    assert.notEqual(getSaint(first)?.id, getSaint(second)?.id);
    assert.equal(childrenChapterLinks[first].id, chapter);
    assert.equal(childrenChapterLinks[second].id, chapter);
    assert.ok(venerations.some(item => item.saintId === first && item.sourceId === source));
    assert.ok(venerations.some(item => item.saintId === second && item.sourceId === source));
  }
  assert.ok(commemorations.some(c => c.saintId === 'petr-muromskij' && matchesCommemoration(c, { year: 2026, month: 7, day: 8 })));
  assert.ok(commemorations.some(c => c.saintId === 'fevronija-muromskaja' && matchesCommemoration(c, { year: 2026, month: 7, day: 8 })));
});

test('the Baptist has seven Orthodox commemorations and Dositheus retains his book-based fixed memory', async () => {
  const { childrenChapterLinks } = await import('../src/data/kids-saints');
  assert.equal(childrenChapterLinks['ioann-predtecha'].id, 'kids-saints-23');
  assert.equal(childrenChapterLinks['dosifej-palestinskij'].id, 'kids-saints-20');
  const dates = commemorations.filter(item => item.saintId === 'ioann-predtecha' && item.traditionId === 'russian-orthodox');
  assert.equal(dates.length, 7);
  assert.ok(dates.some(item => matchesCommemoration(item, { year: 2026, month: 7, day: 7 })));
  const dositheus = commemorations.filter(item => item.saintId === 'dosifej-palestinskij');
  assert.equal(dositheus.length, 1);
  assert.equal(dositheus[0].sourceId, 'local-rostov');
  assert.deepEqual(dositheus[0].rule, { kind: 'fixed', calendar: 'julian', month: 2, day: 19 });
  assert.ok(matchesCommemoration(dositheus[0], { year: 2026, month: 3, day: 4 }));
  assert.ok(matchesCommemoration(dositheus[0], { year: 2024, month: 3, day: 3 }));
  assert.ok(!matchesCommemoration(dositheus[0], { year: 2024, month: 3, day: 4 }));
  assert.ok(!matchesCommemoration(dositheus[0], { year: 2026, month: 2, day: 21 }));
});

test('three book groups retain individual people, checked dates and shared edition links', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const groups = [
    { ids: ['gordian-muchenik-13-sentjabrja', 'makrovij-muchenik-13-sentjabrja', 'ilija-muchenik-13-sentjabrja', 'zotik-muchenik-13-sentjabrja', 'lukian-muchenik-13-sentjabrja', 'valerian-muchenik-13-sentjabrja'], book: 1, page: 305, month: 9, day: 13, sha: 'd8eb94eebea46e0d07798a67d3c15f64d3bb48a85875a8c47c0daa155467fb5c', heading: 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ\n\nГОРДИАНА, МАКРОВИЯ, ИЛИИ, ЗОТИКА,\nЛУКИАНА и ВАЛЕРИАНА' },
    { ids: ['selevk-galatijskij', 'stratonik-muchenik-13-sentjabrja', 'kronid-aleksandrijskij', 'leontij-aleksandrijskij', 'serapion-aleksandrijskij'], book: 1, page: 306, month: 9, day: 13, sha: 'd8eb94eebea46e0d07798a67d3c15f64d3bb48a85875a8c47c0daa155467fb5c', heading: 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ\n\nСЕЛЕВКА, СТРАТОНИКА, КРОНИДА,\nЛЕОНТИЯ и СЕРАПИОНА' },
    { ids: ['maksim-dorostolskij', 'dada-dorostolskij', 'kvintilian-dorostolskij'], book: 8, page: 430, month: 4, day: 28, sha: '34cad51db160ddb198289ea09aa9cd1745abb00e2f2eba61e6bb229cdc078e90', heading: 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ\nМАКСИМА, ДАДЫ и КВИНТИЛИАНА' },
  ];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.ok(commemorations.some(c => c.saintId === id && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === group.month && c.rule.day === group.day), id);
    assert.deepEqual(reviewedWorkForPage(id, group.book, group.page, group.sha, group.heading), { book: group.book, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, group.book, group.page, 'different-edition', group.heading), undefined);
  }
});

test('Alexander Nevsky and Dositheus have their own verified book readings', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const works = [
    { id: 'aleksandr-nevskij', book: 12, page: 492, sha: 'c2753b176cf59793edf93e94e3f26dca118b685057e8d1ddb16743d9bab89fee', body: 'ЖИТИЕ\nСВЯТОГО БЛАГОВЕРНОГО КНЯЗЯ\n\nАЛЕКСАНДРА НЕВСКОГО!' },
    { id: 'dosifej-palestinskij', book: 6, page: 321, sha: '01c0ca7096c861b5edf80f97c2ee15484b2bb6c8b59cd0ab751e69690aa72ab9', body: 'ЖИТИЕ\nПРЕПОДОБНОГО ОТЦА НАШЕГО\n\nДОСИФЕЯ,' },
  ];
  for (const work of works) {
    assert.ok(getSaint(work.id));
    assert.deepEqual(reviewedWorkForPage(work.id, work.book, work.page, work.sha, work.body), { book: work.book, page: work.page, section: 0 });
    assert.equal(reviewedWorkForPage(work.id, work.book, work.page, work.sha, 'ЖИТИЕ ДРУГОГО СВЯТОГО'), undefined);
  }
});

test('Joachim, Anna, Jonah and Nikandr link to their distinct September readings', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = 'd8eb94eebea46e0d07798a67d3c15f64d3bb48a85875a8c47c0daa155467fb5c';
  const groups = [
    { ids: ['ioakim-bogootec', 'anna-bogomatereva'], page: 209, day: 9, body: 'ЖИТИЕ СВЯТЫХ И ПРАВЕДНЫХ БОГООТЕЦ\nИОАКИМА и АННЫ' },
    { ids: ['iona-prorok'], page: 447, day: 22, body: 'ЖИТИЕ СВЯТОГО ПРОРОКА ИОНЫ' },
    { ids: ['nikandr-pskovskij'], page: 487, day: 24, body: 'Житие ПРЕПОДОБНОГО ОТЦА НАШЕГО\nНИКАНДРА ПСКОВСКОГО' },
  ];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id));
    assert.ok(commemorations.some(c => c.saintId === id && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 9 && c.rule.day === group.day));
    assert.deepEqual(reviewedWorkForPage(id, 1, group.page, sha, group.body), { book: 1, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 1, group.page, 'different-edition', group.body), undefined);
  }
});

test('the Maccabees have nine separate cards and one sourced collective reading', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const ids = ['avim-makkavej', 'antonin-makkavej', 'gurij-makkavej', 'eleazar-makkavej', 'evsevon-makkavej', 'alim-makkavej', 'markell-makkavej', 'solomonija-makkavejskaja', 'eleazar-uchitel-makkaveev'];
  const sha = 'c2753b176cf59793edf93e94e3f26dca118b685057e8d1ddb16743d9bab89fee';
  const body = 'СТРАДАНИЕ СВЯТЫХ ВЕТХОЗАВЕТНЫХ МУЧЕНИКОВ\n\nЕЛЕАЗАРА священника,\nсеми братьев МАККАВЕЕВ,\nматери их СОЛОМОНИИ';
  assert.equal(new Set(ids.map(id => getSaint(id)?.id)).size, 9);
  for (const id of ids) {
    assert.ok(getSaint(id));
    assert.ok(commemorations.some(c => c.saintId === id && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 8 && c.rule.day === 1));
    assert.deepEqual(reviewedWorkForPage(id, 12, 12, sha, body), { book: 12, page: 12, section: 0 });
    assert.equal(reviewedWorkForPage(id, 12, 12, 'different-edition', body), undefined);
  }
  assert.notEqual(getSaint('eleazar-makkavej')?.id, getSaint('eleazar-uchitel-makkaveev')?.id);
});

test('nine Pergian martyrs retain individual identities, name variants and their common text', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const ids = ['leontij-pergijskij', 'attij-pergijskij', 'aleksandr-pergijskij', 'kindej-pergijskij', 'minsifej-pergijskij', 'kiriak-pergijskij', 'mineon-pergijskij', 'katun-pergijskij', 'evklej-pergijskij'];
  const sha = 'c2753b176cf59793edf93e94e3f26dca118b685057e8d1ddb16743d9bab89fee';
  const body = 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ\n\nЛЕОНТИНА, АТТА, АЛЕКСАНДРА, КИНДЕЯ,\nМИНСИФЕЯ, КИРИАКА, МИНЕЯ (МИНЕОНА),\nКАТУНА и ЕВКЛЕЯ';
  for (const id of ids) {
    assert.ok(getSaint(id), id);
    assert.ok(commemorations.some(c => c.saintId === id && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 8 && c.rule.day === 1), id);
    assert.deepEqual(reviewedWorkForPage(id, 12, 25, sha, body), { book: 12, page: 25, section: 0 });
    assert.equal(reviewedWorkForPage(id, 12, 25, 'different-edition', body), undefined);
  }
  assert.ok(searchSaints({ q: 'Леонтин Пергийский' }).some(s => s.id === 'leontij-pergijskij'));
  assert.ok(searchSaints({ q: 'Миней Пергийский' }).some(s => s.id === 'mineon-pergijskij'));
  assert.notEqual(getSaint('leontij-pergijskij')?.id, getSaint('leontij-aleksandrijskij')?.id);
});

test('five companions of Agathonicus link to the checked edition and a separately reviewed ending', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedBoundary } = await import('../src/lib/reviewed-book-boundaries');
  const ids = ['agafonik-nikomidijskij', 'zotik-potamskij', 'feoprepij-s-agafonikom', 'akindin-s-agafonikom', 'severian-s-agafonikom'];
  const sha = 'c2753b176cf59793edf93e94e3f26dca118b685057e8d1ddb16743d9bab89fee';
  const heading = 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ: АГАФОНИКА, ЗОТИКА, ФЕОПРЕПИЯ, АКИНДИНА, СЕВИРИАНА';
  const body = 'Завершение рассказа.\n\nВ тот же день память преподоб-\nной Анфусы.';
  for (const id of ids) {
    assert.ok(getSaint(id), id);
    assert.ok(commemorations.some(c => c.saintId === id && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 8 && c.rule.day === 22), id);
    assert.deepEqual(reviewedWorkForPage(id, 12, 349, sha, heading), { book: 12, page: 349, section: 0 });
  }
  assert.notEqual(getSaint('zotik-potamskij')?.id, getSaint('zotik-muchenik-13-sentjabrja')?.id);
  const offset = reviewedBoundary(12, 349, heading, sha, 350, body);
  assert.equal(body.slice(offset), 'В тот же день память преподоб-\nной Анфусы.');
  assert.equal(reviewedBoundary(12, 349, heading, 'different-edition', 350, body), undefined);
  assert.equal(reviewedBoundary(12, 349, heading, sha, 350, body + body), undefined);
  assert.equal(reviewedBoundary(12, 349, heading, sha, 350, 'Изменённый OCR'), undefined);
});

test('nineteen martyrs and bishops have separate sourced cards and the correct shared book texts', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const groups = [
    { ids: ['mark-pastyr-muchenik','aleksandr-s-markom-muchenik','alfej-s-markom-muchenik','zosima-s-markom-muchenik','nikon-s-markom-muchenik','neon-maromilijskij','iliodor-s-markom-muchenik'], book: 1, page: 625, month: 9, day: 28, sha: 'd8eb94eebea46e0d07798a67d3c15f64d3bb48a85875a8c47c0daa155467fb5c', heading: 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ АЛЕКСАНДРА, АЛФЕЯ, ЗОСИМЫ, МАРКА, НИКОНА, НЕОНА и ИЛИОДОРА' },
    { ids: ['evstratij-sevastijskij','avksentij-sevastijskij','evgenij-sevastijskij','mardarij-sevastijskij','orest-sevastijskij'], book: 4, page: 340, month: 12, day: 13, sha: '147b1c3fe520c621b8d87d79025adff2be4f1815241296722e51639dc90b36fe', heading: 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ МАРДАРИЯ, ЕВГЕНИЯ, ЕВСТРАТИЯ, АВКСЕНТИЯ, и ОРЕСТА' },
    { ids: ['efrem-hersonesskij','vasilij-hersonesskij','evgenij-hersonesskij','elpidij-hersonesskij','agafodor-hersonesskij','eferij-hersonesskij','kapiton-hersonesskij'], book: 7, page: 156, month: 3, day: 7, sha: '569c63acc0bb571cd3380e3e9a283510f0e84b0f739a5785f122ca2b2d77c4e9', heading: 'СТРАДАНИЕ СВЯТЫХ СВЯЩЕННОМУЧЕНИКОВ ЕФРЕМА, ВАСИЛИЯ, ЕВГЕНИЯ, ЕЛПИДИЯ, АГАФОДОРА, ЕФЕРИЯ и КАПИТОНА,' },
  ];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.ok(commemorations.some(c => c.saintId === id && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === group.month && c.rule.day === group.day), id);
    assert.deepEqual(reviewedWorkForPage(id, group.book, group.page, group.sha, group.heading), { book: group.book, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, group.book, group.page, 'different-edition', group.heading), undefined);
  }
  assert.notEqual(getSaint('evgenij-sevastijskij')?.id, getSaint('evgenij-hersonesskij')?.id);
});

test('apostles in three shared accounts retain their own dates and book locations', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const groups = [
    { ids: ['stahij-apostol','amplij-apostol','urvan-apostol','narkiss-apostol','aristovul-apostol'], book: 2, page: 618, section: 0, month: 10, day: 31, sha: 'b33fb5a65d1985f7eef9fe3b0afdf3acc482cd632124240a2672f0652805f849', body: 'ПАМЯТЬ СВЯТЫХ АПОСТОЛОВ СТАХИЯ, АМПЛИЯ, УРВАНА, НАРКИССА, АПЕЛЛИЯ и АРИСТОВУЛА' },
    { ids: ['sosfen-apostol','kifa-apostol','tihik-apostol','epafrodit-apostol','kesar-apostol'], book: 4, page: 241, section: 0, month: 12, day: 8, sha: '147b1c3fe520c621b8d87d79025adff2be4f1815241296722e51639dc90b36fe', body: 'ПАМЯТЬ СВЯТЫХ АПОСТОЛОВ СОСФЕНА, АПОЛЛОСА, КИФЫ, ТИХИКА, ЕПАФРОДИТА и КЕСАРЯ' },
    { ids: ['irodion-apostol','agav-apostol','ruf-apostol','asinkrit-apostol','flegont-apostol','ermij-apostol'], book: 8, page: 137, section: 1, month: 4, day: 8, sha: '34cad51db160ddb198289ea09aa9cd1745abb00e2f2eba61e6bb229cdc078e90', body: 'СТРАДАНИЕ СВЯТОГО МУЧЕНИКА ПАВСИЛИПА\n\nТекст.\n\nПАМЯТЬ СВЯТЫХ АПОСТОЛОВ ИРОДИОНА, АГАВА, РУФА, АСИНКРИТА, ФЛЕГОНТА и ЕРМИЯ' },
  ];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.ok(commemorations.some(c => c.saintId === id && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === group.month && c.rule.day === group.day), id);
    assert.deepEqual(reviewedWorkForPage(id, group.book, group.page, group.sha, group.body), { book: group.book, page: group.page, section: group.section });
    assert.equal(reviewedWorkForPage(id, group.book, group.page, 'different-edition', group.body), undefined);
  }
});

test('three accounts preserve twenty people, their dates and source editions', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const groups = [
    { ids: ['feodot-ankirskij','faina-ankirskaja','klavdija-ankirskaja','matrona-ankirskaja','tekusa-ankirskaja','iulija-ankirskaja','aleksandra-ankirskaja','evfrasija-ankirskaja'], book: 9, page: 522, month: 5, day: 18, sha: '82b1215c68f31643b8eb01894d4ace63f2ff7a1caf45f8893122a038ba88d8ac', body: 'СТРАДАНИЕ\nСВЯТОГО МУЧЕНИКА\n\nФЕОДОТА\n\nи с ним семи дев:\n\nФАИНЫ, КЛАВДИИ, МАТРОНЫ, ТЕКУСЫ,\nИУЛИИ, АЛЕКСАНДРЫ и ЕВФРАСИИ' },
    { ids: ['kodrat-korinfskij','kiprian-korinfskij','dionisij-s-kodratom','anekt-korinfskij','pavel-s-kodratom','kriskent-korinfskij'], book: 7, page: 189, month: 3, day: 10, sha: '569c63acc0bb571cd3380e3e9a283510f0e84b0f739a5785f122ca2b2d77c4e9', body: 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ КОДРАТА, КИПРИАНА, ДИОНИСИЯ, АНЕКТА, ПАВЛА, КРИСКЕНТА' },
    { ids: ['lukillian-muchenik','klavdij-otrok-s-lukillianom','ipatij-otrok-s-lukillianom','pavel-otrok-s-lukillianom','dionisij-otrok-s-lukillianom','pavla-s-lukillianom'], book: 10, page: 58, month: 6, day: 3, sha: '5d6ad1d1f29953b1f717fcc709ec01032ad6928b642e5b4664378b70284fb152', body: 'ПАМЯТЬ\nСВЯТОГО МУЧЕНИКА\n\nЛУКИЛЛИАНА,\n\nи с ним четырех отроков:\nКЛАВДИЯ, ИПАТИЯ, ПАВЛА и ДИОНИСИЯ,\nи святой девы ПАВЛЫ' },
  ];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.ok(commemorations.some(c => c.saintId === id && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === group.month && c.rule.day === group.day), id);
    assert.deepEqual(reviewedWorkForPage(id, group.book, group.page, group.sha, group.body), { book: group.book, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, group.book, group.page, 'different-edition', group.body), undefined);
  }
  assert.notEqual(getSaint('dionisij-s-kodratom')?.id, getSaint('dionisij-otrok-s-lukillianom')?.id);
});

test('twenty-four people in three accounts keep separate identities and checked sources', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedBoundary } = await import('../src/lib/reviewed-book-boundaries');
  const groups = [
    { ids: ['attik-sevastijskij','agapij-sevastijskij','evdoksij-sevastijskij','katerij-sevastijskij','istukarij-sevastijskij','paktovij-sevastijskij','niktopolion-sevastijskij'], book: 3, page: 48, month: 11, day: 3, sha: 'b870c6f36c1b21254de6ce6e14690bdacaa639685a03b90cd6f5d44aab4427ce', body: 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ АТТИКА, АГАПИЯ, ЕВДОКСИЯ, КАТЕРИЯ, ИСТУКАРИЯ, ПАКТОВИЯ и НИКТОПОЛИОНА' },
    { ids: ['markian-egipetskij','nikandr-s-markianom','iperehij-s-markianom','apollon-s-markianom','leonid-s-markianom','arij-s-markianom','gorgij-s-markianom','selinij-s-markianom','irinij-s-markianom','pamvon-s-markianom'], book: 10, page: 99, month: 6, day: 5, sha: '5d6ad1d1f29953b1f717fcc709ec01032ad6928b642e5b4664378b70284fb152', body: 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ: МАРКИАНА, НИКАНДРА, ИПЕРЕХИЯ, АПОЛЛОНА, ЛЕОНИДА, АРИЯ, ГОРГИЯ, СЕЛИНИЯ, ИРИНИЯ и ПАМВОНА' },
    { ids: ['peregrin-dirrahijskij','lukian-dirrahijskij','pompej-dirrahijskij','isihij-dirrahijskij','papij-dirrahijskij','satornin-dirrahijskij','german-dirrahijskij'], book: 11, page: 151, month: 7, day: 7, sha: 'b36fd4ff7ec4ba22854e5f55c566d0f4e7661394995e9586e207f42e8f4876df', body: 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ ПЕРЕГРИНА, ЛУКИАНА, ПОМПЕЯ, ИСИХИЯ, ПАПИЯ, САТОРНИНА и ГЕРМАНА' },
  ];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.ok(commemorations.some(c => c.saintId === id && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === group.month && c.rule.day === group.day), id);
    assert.deepEqual(reviewedWorkForPage(id, group.book, group.page, group.sha, group.body), { book: group.book, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, group.book, group.page, 'different-edition', group.body), undefined);
  }
  const last = groups[2];
  const text = `${last.body}\n\nТекст.\n\nВ тот же день преставление преподобной Евфросинии`;
  assert.equal(text.slice(reviewedBoundary(11, 151, last.body, last.sha, 151, text)), 'В тот же день преставление преподобной Евфросинии');
  assert.equal(reviewedBoundary(11, 151, last.body, 'other', 151, text), undefined);
  assert.notEqual(getSaint('isihij-dirrahijskij')?.id, getSaint('isihij-sevastijskij')?.id);
});

test('November accounts keep namesakes, edition and separate Pomor testimony', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedBoundary } = await import('../src/lib/reviewed-book-boundaries');
  const sha = 'b870c6f36c1b21254de6ce6e14690bdacaa639685a03b90cd6f5d44aab4427ce';
  const groups = [
    { ids: ['akindin-persidskij', 'pigasij-persidskij', 'anempodist-persidskij', 'elpidifor-persidskij', 'affonij-persidskij'], page: 16, day: 2, heading: 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ АКИНДИНА, ПИГАСИЯ, АНЕМПОДИСТА, ЕЛПИДИФА и АФОНИЯ' },
    { ids: ['markian-kirskij'], page: 28, day: 2, heading: 'ПАМЯТЬ ПРЕПОДОБНОГО МАРКИАНА' },
    { ids: ['akepsim-naessonskij', 'iosif-persidskij-s-akepsimom', 'aifal-persidskij-s-akepsimom'], page: 30, day: 3, heading: 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ АКЕПСИМА ЕПИСКОПА, ИОСИФА ПРЕСВИТЕРА и АИФАЛА ДИАКОНА' },
    { ids: ['akepsim-antiohijskij'], page: 47, day: 3, heading: 'ПАМЯТЬ ПРЕПОДОБНОГО АКЕПСИМА' },
  ];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 3, group.page, sha, group.heading), { book: 3, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 3, group.page, 'other-edition', group.heading), undefined);
    for (const tradition of ['russian-orthodox', 'old-believer']) {
      assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === tradition && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 11 && c.rule.day === group.day), `${id}: ${tradition}`);
    }
  }
  assert.notEqual(getSaint('akepsim-naessonskij')?.id, getSaint('akepsim-antiohijskij')?.id);
  assert.equal(reviewedWorkForPage('akepsim-antiohijskij', 3, 30, sha, groups[2].heading), undefined);
  const end = 'Последние слова. Аминь.\n\nОСВЯЩЕНИЕ ХРАМА СВЯТОГО ВЕЛИКОМУЧЕНИКА';
  assert.equal(end.slice(reviewedBoundary(3, 30, groups[2].heading, sha, 46, end)), 'ОСВЯЩЕНИЕ ХРАМА СВЯТОГО ВЕЛИКОМУЧЕНИКА');
  assert.equal(reviewedBoundary(3, 30, groups[2].heading, 'other-edition', 46, end), undefined);
});

test('November fourth and fifth readings keep thirteen people and three distinct Erms', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = 'b870c6f36c1b21254de6ce6e14690bdacaa639685a03b90cd6f5d44aab4427ce';
  const groups = [
    { ids: ['ioannikij-velikij'], page: 49, day: 4, heading: 'ЖИТИЕ ПРЕПОДОБНОГО ОТЦА НАШЕГО ИОАННИКИЯ ВЕЛИКОГО' },
    { ids: ['nikandr-mirskij', 'ermej-presviter-s-nikandrom'], page: 70, day: 4, heading: 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ НИКАНДРА ЕПИСКОПА и ЕРМЕЯ ПРЕСВИТЕРА' },
    { ids: ['simon-jureveckij'], page: 71, day: 4, heading: 'ПРЕСТАВЛЕНИЕ БЛАЖЕННОГО СИМОНА ЮРЬЕВЕЦКОГО' },
    { ids: ['galaktion-emesskij', 'epistimija-emesskaja'], page: 75, day: 5, heading: 'ЖИТИЕ И СТРАДАНИЕ СВЯТЫХ ПРЕПОДОБНОМУЧЕНИКОВ ГАЛАКТИОНА и ЕПИСТИМЫ' },
    { ids: ['iona-novgorodskij'], page: 89, day: 5, heading: 'ЖИТИЕ СВЯТОГО ИОНЫ,' },
    { ids: ['patrov-apostol', 'erm-filippopolskij-apostol', 'lin-rimskij-apostol', 'gaij-efesskij-apostol', 'filolog-sinopskij-apostol'], page: 101, day: 5, heading: 'ПАМЯТЬ СВЯТЫХ АПОСТОЛОВ ПАТРОВА, ЕРМА, ЛИНА, ГАИЯ и ФИЛОЛОГА' },
    { ids: ['grigorij-aleksandrijskij-5-nojabrja'], page: 102, day: 5, heading: 'ПАМЯТЬ СВЯТОГО ГРИГОРИЯ,' },
  ];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 3, group.page, sha, group.heading), { book: 3, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 3, group.page, 'other-edition', group.heading), undefined);
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'russian-orthodox' && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 11 && c.rule.day === group.day), id);
    assert.equal(venerations.some(v => v.saintId === id && v.traditionId === 'old-believer'), id !== 'simon-jureveckij', id);
  }
  assert.equal(new Set(['ermij-apostol', 'erm-filippopolskij-apostol', 'ermej-presviter-s-nikandrom'].map(id => getSaint(id)?.id)).size, 3);
});

test('November sixth and seventh readings preserve separate accounts and witnesses', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = 'b870c6f36c1b21254de6ce6e14690bdacaa639685a03b90cd6f5d44aab4427ce';
  const groups = [
    { ids: ['pavel-ispovednik-konstantinopolskij'], page: 104, day: 6, section: 0, body: 'ЖИТИЕ СВЯТОГО ПАВЛА ИСПОВЕДНИКА,' },
    { ids: ['varlaam-hutynskij'], page: 113, day: 6, section: 0, body: 'ЖИТИЕ ПРЕПОДОБНОГО ОТЦА НАШЕГО ВАРЛААМА ХУТЫНСКОГО,' },
    { ids: ['german-kazanskij'], page: 116, day: 6, section: 0, body: 'ЖИТИЕ СВЯТОГО ГЕРМАНА,' },
    { ids: ['luka-tavromenijskij'], page: 123, day: 6, section: 0, body: 'ПАМЯТЬ ПРЕПОДОБНОГО ЛУКИ' },
    { ids: ['ieron-melitinskij'], page: 125, day: 7, section: 0, body: 'СТРАДАНИЕ СВЯТОГО МУЧЕНИКА ИЕРОНА' },
    { ids: ['melasipp-ankirskij', 'kasinija-ankirskaja', 'antonin-s-melasippom'], page: 132, day: 7, section: 0, body: 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ МЕЛАСИПЛПА, КАСИНИИЙ и АНТОНИНА' },
    { ids: ['avkt-s-fessalonikiej', 'tavrion-s-fessalonikiej', 'fessalonikija-muchenica'], page: 133, day: 7, section: 0, body: 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ АВКТА, ТАВРИОНА и ФЕССАЛОНИКИИ\n\nТекст.\n\nПАМЯТЬ ПРЕПОДОБНОГО ЛАЗАРЯ' },
    { ids: ['lazar-galisijskij'], page: 133, day: 7, section: 1, body: 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ АВКТА, ТАВРИОНА и ФЕССАЛОНИКИИ\n\nТекст.\n\nПАМЯТЬ ПРЕПОДОБНОГО ЛАЗАРЯ' },
  ];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 3, group.page, sha, group.body), { book: 3, page: group.page, section: group.section });
    assert.equal(reviewedWorkForPage(id, 3, group.page, 'different-edition', group.body), undefined);
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'russian-orthodox' && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 11 && c.rule.day === group.day), id);
    assert.equal(venerations.some(v => v.saintId === id && v.traditionId === 'old-believer'), !['german-kazanskij', 'luka-tavromenijskij'].includes(id), id);
  }
  assert.equal(reviewedWorkForPage('lazar-galisijskij', 3, 133, sha, 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ АВКТА, ТАВРИОНА и ФЕССАЛОНИКИИ'), undefined);
});

test('November ninth and tenth preserve fifteen people and reuse apostle Rodion', async () => {
  const { reviewedWorkForPage, reviewedWorkLocations } = await import('../src/lib/reviewed-book-works');
  const sha = 'b870c6f36c1b21254de6ce6e14690bdacaa639685a03b90cd6f5d44aab4427ce';
  const groups = [
    { ids: ['matrona-konstantinopolskaja'], page: 145, day: 9, heading: 'ЖИТИЕ И ПОДВИГИ ПРЕПОДОБНОЙ МАТЕРИ НАШЕЙ МАТРОНЫ' },
    { ids: ['feoktista-lesboskaja'], page: 161, day: 9, heading: 'ЖИТИЕ ПРЕПОДОБНОЙ ФЕОКТИСТЫ' },
    { ids: ['ioann-kolov'], page: 168, day: 9, heading: 'ЖИТИЕ ПРЕПОДОБНОГО ИОАННА КОЛОВА' },
    { ids: ['onisifor-pangianskij', 'porfirij-s-onisiforom'], page: 174, day: 9, heading: 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ ОНИСИФОРА и ПОРФИРИЯ' },
    { ids: ['evstolija-konstantinopolskaja', 'sosipatra-konstantinopolskaja'], page: 175, day: 9, heading: 'ПАМЯТЬ ПРЕПОДОБНЫХ ЕВСТОЛИИ и СОСИПАТРЫ' },
    { ids: ['antonij-sirijskij-9-nojabrja'], page: 176, day: 9, heading: 'ПАМЯТЬ СВЯТОГО МУЧЕНИКА АНТОНИЯ' },
    { ids: ['aleksandr-solunskij-9-nojabrja'], page: 177, day: 9, heading: 'ПАМЯТЬ СВЯТОГО МУЧЕНИКА АЛЕКСАНДРА СОЛУНСКОГО' },
    { ids: ['orest-tianskij'], page: 178, day: 10, heading: 'СТРАДАНИЕ СВЯТОГО МУЧЕНИКА ОРЕСТА' },
    { ids: ['milij-persidskij'], page: 184, day: 10, heading: 'СТРАДАНИЕ СВЯЩЕННОМУЧЕНИКА МИЛИЯ' },
    { ids: ['olimp-apostol', 'irodion-apostol', 'sosipatr-apostol', 'erast-apostol', 'kuart-apostol'], page: 187, day: 10, heading: 'ПАМЯТЬ СВЯТЫХ АПОСТОЛОВ ОЛИМПА, РОДИОНА, СОСИПАТРА, ЕРАСТА и КУАРТА' },
  ];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 3, group.page, sha, group.heading), { book: 3, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 3, group.page, 'other-edition', group.heading), undefined);
    for (const tradition of ['russian-orthodox', ...(id === 'antonij-sirijskij-9-nojabrja' ? [] : ['old-believer'])]) {
      assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === tradition && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 11 && c.rule.day === group.day), `${id}: ${tradition}`);
    }
  }
  assert.ok(!venerations.some(v => v.saintId === 'antonij-sirijskij-9-nojabrja' && v.traditionId === 'old-believer'));
  assert.ok(reviewedWorkLocations('irodion-apostol').some(x => x.book === 8 && x.page === 137));
  assert.notEqual(getSaint('sosipatr-apostol')?.id, getSaint('sosipatra-konstantinopolskaja')?.id);
  assert.notEqual(getSaint('orest-tianskij')?.id, getSaint('orest-sevastijskij')?.id);
});

test('November eleventh and twelfth keep sourced readings and scoped traditions', async () => {
  const { reviewedWorkForPage, reviewedWorkLocations } = await import('../src/lib/reviewed-book-works');
  const sha = 'b870c6f36c1b21254de6ce6e14690bdacaa639685a03b90cd6f5d44aab4427ce';
  const groups = [
    { ids: ['mina-kotuanskij'], page: 189, day: 11, heading: 'СТРАДАНИЕ СВЯТОГО ВЕЛИКОМУЧЕНИКА МИНЫ' },
    { ids: ['viktor-damasskij', 'stefanida-damasskaja'], page: 200, day: 11, heading: 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ ВИКТОРА и СТЕФАНИДЫ' },
    { ids: ['vikentij-saragosskij'], page: 205, day: 11, heading: 'СТРАДАНИЕ СВЯТОГО МУЧЕНИКА ВИКЕНТИЯ' },
    { ids: ['feodor-studit'], page: 212, day: 11, heading: 'ЖИТИЕ ПРЕПОДОБНОГО ОТЦА НАШЕГО ФЕОДОРА СТУДИТА' },
    { ids: ['stefan-dechanskij'], page: 243, day: 11, heading: 'ЖИТИЕ СВЯТОГО СТЕФАНА ДЕЧАНСКОГО,' },
    { ids: ['maksim-moskovskij-blazhennyj'], page: 261, day: 11, heading: 'ПАМЯТЬ БЛАЖЕННОГО МАКСИМА,' },
    { ids: ['nil-postnik'], page: 285, day: 12, heading: 'ПАМЯТЬ ПРЕПОДОБНОГО НИЛА ПОСТНИКА' },
    { ids: ['ahija-prorok-silomljanin'], page: 288, day: 12, heading: 'ПАМЯТЬ СВЯТОГО ПРОРОКА АХИИ' },
    { ids: ['ioann-vlasatyj-rostovskij'], page: 289, day: 12, heading: 'ЖИТИЕ БЛАЖЕННОГО ИОАННА ВЛАСАТОГО,' },
  ];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 3, group.page, sha, group.heading), { book: 3, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 3, group.page, 'other-edition', group.heading), undefined);
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'russian-orthodox' && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 11 && c.rule.day === group.day), id);
    assert.equal(venerations.some(v => v.saintId === id && v.traditionId === 'old-believer'), !['stefan-dechanskij', 'ioann-vlasatyj-rostovskij'].includes(id), id);
  }
  assert.match(venerations.find(v => v.saintId === 'stefan-dechanskij')?.note ?? '', /сербская/);
  assert.ok(venerations.some(v => v.saintId === 'maksim-moskovskij-blazhennyj' && v.traditionId === 'old-believer' && /23-24/.test(v.note ?? '')));
  assert.ok(venerations.some(v => v.saintId === 'ioann-milostivyj' && v.traditionId === 'old-believer'));
  assert.ok(reviewedWorkLocations('ioann-milostivyj').some(x => x.book === 3 && x.page === 263));
  assert.notEqual(getSaint('ioann-milostivyj')?.id, getSaint('ioann-vlasatyj-rostovskij')?.id);
});

test('November thirteenth and fourteenth connect ten people to six distinct accounts', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = 'b870c6f36c1b21254de6ce6e14690bdacaa639685a03b90cd6f5d44aab4427ce';
  const groups = [
    { ids: ['ioann-zlatoust'], page: 292, day: 13, heading: 'ЖИТИЕ СВЯТОГО ОТЦА НАШЕГО ИОАННА ЗЛАТОУСТА,' },
    { ids: ['antonin-kesarijskij-13-nojabrja', 'nikifor-kesarijskij-13-nojabrja', 'german-kesarijskij-13-nojabrja', 'manefa-kesarijskaja'], page: 352, day: 13, heading: 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ АНТОНИНА, НИКИФОРА, ГЕРМАНА и МАНЕФЫ' },
    { ids: ['filipp-apostol-iz-dvenadcati'], page: 354, day: 14, heading: 'ЖИТИЕ СВЯТОГО АПОСТОЛА ФИЛИППА' },
    { ids: ['grigorij-palama'], page: 366, day: 14, heading: 'ЖИТИЕ СВЯТОГО ГРИГОРИЯ ПАЛАМЫ,' },
    { ids: ['filipp-irapskij'], page: 381, day: 14, heading: 'ЖИТИЕ ПРЕПОДОБНОГО ФИЛИППА ИРАПСКОГО' },
    { ids: ['iustinian-vizantijskij', 'feodora-vizantijskaja-s-iustinianom'], page: 389, day: 14, heading: 'ПАМЯТЬ БЛАГОВЕРНОГО ЦАРЯ ЮСТИНИАНА и ЦАРИЦЫ ФЕОДОРЫ' },
  ];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 3, group.page, sha, group.heading), { book: 3, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 3, group.page, 'other-edition', group.heading), undefined);
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'russian-orthodox' && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 11 && c.rule.day === group.day), id);
    assert.equal(venerations.some(v => v.saintId === id && v.traditionId === 'old-believer'), id !== 'filipp-irapskij', id);
  }
  assert.notEqual(getSaint('filipp-apostol-iz-dvenadcati')?.id, getSaint('filipp-irapskij')?.id);
  assert.notEqual(getSaint('grigorij-palama')?.id, getSaint('grigorij-aleksandrijskij-5-nojabrja')?.id);
});

test('January accounts link twenty-three people and preserve a second sourced Corinthian memory', async () => {
  const { reviewedWorkForPage, reviewedWorkLocations } = await import('../src/lib/reviewed-book-works');
  const sha = 'e62ed1051709261e1b21d03eac3e74d8475e1f77e28c5a56d2faf2b0390e242f';
  const groups = [
    { ids: ['manuil-adrianopolskij','georgij-s-manuilom','petr-s-manuilom','leontij-nikejskij','sionij-s-manuilom','gavriil-s-manuilom','ioann-s-manuilom','leont-s-manuilom','parod-s-manuilom'], page: 691, day: 22, heading: 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ МАНУИЛА, ГЕОРГИЯ, ПЕТРА, ЛЕОНТИЯ, СИОНИЯ, ГАВРИИЛА, ИОАННА, ЛЕОНТА, ПАРОДА' },
    { ids: ['roman-samosatskij','iakov-samosatskij','filofej-samosatskij','iperihij-samosatskij','aviv-samosatskij','iulian-samosatskij','parigorij-samosatskij'], page: 826, day: 29, heading: 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ РОМАНА, ИАКОВА, ФИЛОФЕЯ, ИПЕРИХИЯ, АВИВА, ИУЛИАНА и ПАРИГОРИЯ' },
    { ids: ['viktorin-korinfskij','viktor-korinfskij','nikifor-korinfskij','klavdij-korinfskij','diodor-korinfskij','serapion-korinfskij','papij-korinfskij'], page: 844, day: 31, heading: 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ ВИКТОРИНА, ВИКТОРА, НИКИФОРА, КЛАВДИЯ, ДИОДОРА, СЕРАПИОНА и ПАПИЯ' },
  ];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.ok(commemorations.some(c => c.saintId === id && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 1 && c.rule.day === group.day), id);
    assert.deepEqual(reviewedWorkForPage(id, 5, group.page, sha, group.heading), { book: 5, page: group.page, section: 0 });
  }
  for (const id of groups[2].ids) {
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-kodrat-i-s-nim-korinfskie' && c.rule.kind === 'fixed' && c.rule.month === 3 && c.rule.day === 10), id);
    assert.ok(reviewedWorkLocations(id).some(location => location.book === 7 && location.page === 189), id);
  }
  assert.notEqual(getSaint('leontij-nikejskij')?.id, getSaint('leont-s-manuilom')?.id);
});

test('November fifteenth to seventeenth link distinct people to verified readings and calendars', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = 'b870c6f36c1b21254de6ce6e14690bdacaa639685a03b90cd6f5d44aab4427ce';
  const groups = [
    { ids: ['gurij-edesskij', 'samon-edesskij', 'aviv-edesskij'], page: 392, day: 15, heading: 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ ГУРИЯ, САМОНА и АВИВА' },
    { ids: ['elpidij-s-markellom', 'markell-s-elpidijem', 'evstohij-s-elpidijem'], page: 410, day: 15, heading: 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ ЕЛПИДИЯ, МАРКЕЛЛА и ЕВСТОХИЯ' },
    { ids: ['matfej-apostol-evangelist', 'fulvian-efiopskij'], page: 413, day: 16, heading: 'ЖИТИЕ И СТРАДАНИЕ СВЯТОГО АПОСТОЛА И ЕВАНГЕЛИСТА МАТФЕЯ' },
    { ids: ['grigorij-neokesarijskij'], page: 421, day: 17, heading: 'ЖИТИЕ СВЯТОГО ОТЦА НАШЕГО ГРИГОРИЯ' },
    { ids: ['nikon-radonezhskij'], page: 440, day: 17, heading: 'ЖИТИЕ ПРЕПОДОБНОГО ОТЦА НАШЕГО НИКОНА,' },
    { ids: ['lazar-ikonopisec'], page: 454, day: 17, heading: 'ПАМЯТЬ ПРЕПОДОБНОГО ЛАЗАРЯ ПИСЦА' },
  ];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 3, group.page, sha, group.heading), { book: 3, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 3, group.page, 'other-edition', group.heading), undefined);
    for (const tradition of ['russian-orthodox', ...(id === 'fulvian-efiopskij' ? [] : ['old-believer'])]) {
      assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === tradition && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 11 && c.rule.day === group.day), `${id}: ${tradition}`);
    }
  }
  assert.ok(!venerations.some(v => v.saintId === 'fulvian-efiopskij' && v.traditionId === 'old-believer'));
  assert.ok(commemorations.some(c => c.saintId === 'dimitrij-dabudskij' && c.traditionId === 'old-believer' && c.rule.kind === 'fixed' && c.rule.month === 11 && c.rule.day === 15));
  assert.notEqual(getSaint('matfej-apostol-evangelist')?.id, getSaint('fulvian-efiopskij')?.id);
});

test('November eighteenth and nineteenth preserve distinct names, sources and book sections', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedBoundary } = await import('../src/lib/reviewed-book-boundaries');
  const sha = 'b870c6f36c1b21254de6ce6e14690bdacaa639685a03b90cd6f5d44aab4427ce';
  const groups = [
    { ids: ['platon-ankirskij'], page: 456, day: 18, heading: 'СТРАДАНИЕ СВЯТОГО МУЧЕНИКА ПЛАТОНА' },
    { ids: ['roman-kesarijskij-s-varulom', 'varul-s-romanom'], page: 464, day: 18, heading: 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ' },
    { ids: ['avdij-prorok'], page: 469, day: 19, heading: 'ЖИТИЕ СВЯТОГО ПРОРОКА АВДИЯ' },
    { ids: ['varlaam-indijskij', 'ioasaf-indijskij', 'avenir-indijskij'], page: 472, day: 19, heading: 'ЖИТИЕ ПРЕПОДОБНЫХ ВАРЛААМА и ИОАСАФА,' },
    { ids: ['varlaam-antiohijskij-muchenik'], page: 506, day: 19, heading: 'СТРАДАНИЕ СВЯТОГО МУЧЕНИКА ВАРЛААМА' },
    { ids: ['varlaam-pecherskij'], page: 518, day: 19, heading: 'ЖИТИЕ ПРЕПОДОБНОГО ВАРЛААМА ПЕЧЕРСКОГО' },
    { ids: ['aza-isavrijskij'], page: 522, day: 19, heading: 'ПАМЯТЬ СВЯТОГО МУЧЕНИКА АЗЫ' },
    { ids: ['iliodor-magidskij'], page: 523, day: 19, heading: 'ПАМЯТЬ СВЯТОГО МУЧЕНИКА ИЛИОДОРА' },
  ];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 3, group.page, sha, group.heading), { book: 3, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 3, group.page, 'other-edition', group.heading), undefined);
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'russian-orthodox' && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 11 && c.rule.day === group.day), id);
    assert.equal(venerations.some(v => v.saintId === id && v.traditionId === 'old-believer'), !['varul-s-romanom', 'avenir-indijskij', 'varlaam-pecherskij'].includes(id), id);
  }
  assert.ok(commemorations.some(c => c.saintId === 'ioasaf-indijskij' && c.traditionId === 'old-believer' && c.rule.kind === 'fixed' && c.rule.month === 11 && c.rule.day === 18));
  assert.notEqual(getSaint('varlaam-indijskij')?.id, getSaint('varlaam-antiohijskij-muchenik')?.id);
  assert.notEqual(getSaint('varlaam-pecherskij')?.id, getSaint('varlaam-hutynskij')?.id);
  assert.notEqual(getSaint('iliodor-magidskij')?.id, getSaint('iliodor-s-markom-muchenik')?.id);
  const following = 'Колонтитул\n\nСлово святого Василия Великого\nО СВЯТОМ МУЧЕНИКЕ ВАРЛААМЕ';
  const boundary = reviewedBoundary(3, 506, groups[4].heading, sha, 507, following);
  assert.equal(following.slice(boundary), 'Слово святого Василия Великого\nО СВЯТОМ МУЧЕНИКЕ ВАРЛААМЕ');
  assert.equal(reviewedBoundary(3, 506, groups[4].heading, 'other-edition', 507, following), undefined);
});

test('November twentieth and twenty-second link checked accounts and independently sourced traditions', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedBoundary } = await import('../src/lib/reviewed-book-boundaries');
  const sha = 'b870c6f36c1b21254de6ce6e14690bdacaa639685a03b90cd6f5d44aab4427ce';
  const groups = [
  {
    "ids": [
      "grigorij-dekapolit"
    ],
    "page": 525,
    "day": 20,
    "heading": "ЖИТИЕ ПРЕПОДОБНОГО ОТЦА НАШЕГО ГРИГОРИЯ ДЕКАПОЛИТА"
  },
  {
    "ids": [
      "prokl-konstantinopolskij"
    ],
    "page": 533,
    "day": 20,
    "heading": "ЖИТИЕ СВЯТОГО ПРОКЛА,"
  },
  {
    "ids": [
      "evstafij-nikejskij",
      "fespesij-nikejskij",
      "anatolij-nikejskij"
    ],
    "page": 538,
    "day": 20,
    "heading": "СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ ЕВСТАФИЯ, ФЕСПЕСИЯ и АНАТОЛИЯ"
  },
  {
    "ids": [
      "dasij-dorostolskij"
    ],
    "page": 546,
    "day": 20,
    "heading": "ПАМЯТЬ СВЯТОГО МУЧЕНИКА ДАСИЯ"
  },
  {
    "ids": [
      "nirsa-persidskij",
      "iosif-uchenik-nirsy"
    ],
    "page": 547,
    "day": 20,
    "heading": "ПАМЯТЬ СВЯТЫХ СВЯЩЕННОМУЧЕНИКОВ НИРСЫ и ИОСИФА"
  },
  {
    "ids": [
      "ioann-episkop-persidskij-20-nojabrja",
      "saverij-episkop-persidskij",
      "isaakij-episkop-persidskij",
      "ipatij-episkop-persidskij"
    ],
    "page": 548,
    "day": 20,
    "heading": "ПАМЯТЬ СВЯТЫХ СВЯЩЕННОМУЧЕНИКОВ ИОАННА, САВЕРИЯ, ИСААКИЯ, ИПАТИЯ"
  },
  {
    "ids": [
      "kikilija-rimskaja",
      "valerian-s-kikiliej",
      "tivurtij-s-kikiliej",
      "maksim-s-kikiliej"
    ],
    "page": 564,
    "day": 22,
    "heading": "СТРАДАНИЕ СВЯТОЙ МУЧЕНИЦЫ КИКИЛИИ И С НЕЙ СВЯТЫХ МУЧЕНИКОВ ВАЛЕРИАНА, ТИВУРТИЯ и МАКСИМА"
  },
  {
    "ids": [
      "filimon-apostol",
      "arhipp-apostol",
      "apfija-ravnoapostolnaja"
    ],
    "page": 574,
    "day": 22,
    "heading": "ПАМЯТЬ СВЯТЫХ АПОСТОЛОВ ФИЛИМОНА, АРХИППА и АПФИИ"
  },
  {
    "ids": [
      "mihail-voin-bolgarskij"
    ],
    "page": 575,
    "day": 22,
    "heading": "ПАМЯТЬ ПРАВЕДНОГО МИХАИЛА ВОИНА:"
  },
  {
    "ids": [
      "prokopij-chtec-kesarijskij"
    ],
    "page": 578,
    "day": 22,
    "heading": "ПАМЯТЬ СВЯТОГО МУЧЕНИКА ПРОКОПИЯ"
  },
  {
    "ids": [
      "menign-parijskij"
    ],
    "page": 579,
    "day": 22,
    "heading": "ПАМЯТЬ СВЯТОГО МУЧЕНИКА МЕНИГНА"
  },
  {
    "ids": [
      "agavva-ismaelitjanin"
    ],
    "page": 581,
    "day": 22,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОГО АГАВВЫ"
  }
];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 3, group.page, sha, group.heading), { book: 3, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 3, group.page, 'other-edition', group.heading), undefined);
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'russian-orthodox' && c.rule.kind === 'fixed' && c.rule.month === 11 && c.rule.day === group.day), id);
    assert.equal(venerations.some(v => v.saintId === id && v.traditionId === 'old-believer'), id !== 'maksim-s-kikiliej', id);
  }
  const heading = 'ПАМЯТЬ ПРЕПОДОБНОГО АГАВВЫ';
  const body = 'Память.\n\nВ тот же день память святого благоверного князя Михаила Твер-\nского.';
  const end = reviewedBoundary(3, 581, heading, sha, 581, body);
  assert.ok(end !== undefined && body.slice(end).startsWith('В тот же день'));
  assert.equal(reviewedBoundary(3, 581, heading, 'other-edition', 581, body), undefined);
  assert.notEqual(getSaint('filimon-apostol')?.id, getSaint('filimon-kizicheskij')?.id);
});

test('November twenty-third through twenty-fifth preserve namesakes and checked readings', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = 'b870c6f36c1b21254de6ce6e14690bdacaa639685a03b90cd6f5d44aab4427ce';
  const groups = [
  {
    "ids": [
      "zakhej-gadarinskij",
      "alfej-kesarijskij-chtec"
    ],
    "page": 467,
    "day": 18,
    "heading": "ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ ЗАКХЕЯ и АЛФЕЯ"
  },
  {
    "ids": [
      "amfilohij-ikonijskij"
    ],
    "page": 582,
    "day": 23,
    "heading": "ЖИТИЕ СВЯТОГО ОТЦА НАШЕГО АМФИЛОХИЯ,"
  },
  {
    "ids": [
      "grigorij-akragantijskij"
    ],
    "page": 587,
    "day": 23,
    "heading": "ЖИТИЕ СВЯТОГО ОТЦА НАШЕГО ГРИГОРИЯ,"
  },
  {
    "ids": [
      "sisinij-kizicheskij-episkop"
    ],
    "page": 616,
    "day": 23,
    "heading": "ПАМЯТЬ СВЯТОГО МУЧЕНИКА СИСИНИЯ"
  },
  {
    "ids": [
      "feodor-antiohijskij-23-nojabrja"
    ],
    "page": 617,
    "day": 23,
    "heading": "ПАМЯТЬ СВЯТОГО МУЧЕНИКА ФЕОДОРА"
  },
  {
    "ids": [
      "ekaterina-aleksandrijskaja"
    ],
    "page": 619,
    "day": 24,
    "heading": "ЖИТИЕ И СТРАДАНИЕ СВЯТОЙ ВЕЛИКОМУЧЕНИЦЫ ЕКАТЕРИНЫ"
  },
  {
    "ids": [
      "merkurij-kesarijskij"
    ],
    "page": 641,
    "day": 24,
    "heading": "СТРАДАНИЕ СВЯТОГО ВЕЛИКОМУЧЕНИКА МЕРКУРИЯ"
  },
  {
    "ids": [
      "merkurij-smolenskij"
    ],
    "page": 651,
    "day": 24,
    "heading": "ПАМЯТЬ СВЯТОГО МУЧЕНИКА МЕРКУРИЯ СМОЛЕНСКОГО"
  },
  {
    "ids": [
      "simon-sojginskij"
    ],
    "page": 655,
    "day": 24,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОГО СИМОНА СОЙГИНСКОГО"
  },
  {
    "ids": [
      "mastridija-aleksandrijskaja"
    ],
    "page": 657,
    "day": 24,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОЙ МАСТРИДИИ"
  },
  {
    "ids": [
      "kliment-rimskij-papa"
    ],
    "page": 659,
    "day": 25,
    "heading": "ЖИТИЕ И СТРАДАНИЕ СВЯТОГО СВЯЩЕННОМУЧЕНИКА КЛИМЕНТА,"
  },
  {
    "ids": [
      "petr-aleksandrijskij-arhiepiskop"
    ],
    "page": 674,
    "day": 25,
    "heading": "ЖИТИЕ И СТРАДАНИЕ СВЯТОГО СВЯЩЕННОМУЧЕНИКА ПЕТРА,"
  },
  {
    "ids": [
      "petr-molchalnik-galatijskij"
    ],
    "page": 680,
    "day": 25,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОГО ПЕТРА МОЛЧАЛЬНИКА"
  }
];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 3, group.page, sha, group.heading), { book: 3, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 3, group.page, 'other-edition', group.heading), undefined);
    for (const tradition of ['russian-orthodox', ...(id === 'simon-sojginskij' ? [] : ['old-believer'])]) {
      assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === tradition && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 11 && c.rule.day === group.day), `${id}: ${tradition}`);
    }
  }
  assert.ok(!venerations.some(v => v.saintId === 'simon-sojginskij' && v.traditionId === 'old-believer'));
  assert.ok(commemorations.some(c => c.saintId === 'aleksandr-nevskij' && c.traditionId === 'old-believer' && c.rule.kind === 'fixed' && c.rule.month === 11 && c.rule.day === 23));
  assert.notEqual(getSaint('merkurij-kesarijskij')?.id, getSaint('merkurij-smolenskij')?.id);
  assert.notEqual(getSaint('petr-aleksandrijskij-arhiepiskop')?.id, getSaint('petr-molchalnik-galatijskij')?.id);
  assert.notEqual(getSaint('sisinij-kizicheskij-episkop')?.id, getSaint('sisinij-nikopolskij')?.id);
});

test('November twenty-sixth through thirtieth preserve calendar evidence and distinct namesakes', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { sectionHeadings } = await import('../src/lib/book-sections');
  const sha = 'b870c6f36c1b21254de6ce6e14690bdacaa639685a03b90cd6f5d44aab4427ce';
  const groups = [
  {
    "ids": [
      "alipij-stolpnik-adrianopolskij"
    ],
    "page": 681,
    "day": 26,
    "heading": "ЖИТИЕ ПРЕПОДОБНОГО ОТЦА НАШЕГО АЛИПИЯ СТОЛПНИКА"
  },
  {
    "ids": [
      "iakov-otshelnik-sirijskij"
    ],
    "page": 688,
    "day": 26,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОГО ИАКОВА ОТШЕЛЬНИКА"
  },
  {
    "ids": [
      "iakov-persjanin"
    ],
    "page": 691,
    "day": 27,
    "heading": "СТРАДАНИЕ СВЯТОГО МУЧЕНИКА ИАКОВА ПЕРСЯНИНА"
  },
  {
    "ids": [
      "roman-sirijskij-27-nojabrja"
    ],
    "page": 702,
    "day": 27,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОГО РОМАНА"
  },
  {
    "ids": [
      "iakov-rostovskij-episkop"
    ],
    "page": 703,
    "day": 27,
    "heading": "ПАМЯТЬ СВЯТОГО ИАКОВА,"
  },
  {
    "ids": [
      "stefan-novyj-ispovednik"
    ],
    "page": 705,
    "day": 28,
    "heading": "СТРАДАНИЕ СВЯТОГО ПРЕПОДОБНОМУЧЕНИКА СТЕФАНА НОВОГО"
  },
  {
    "ids": [
      "feodor-rostovskij-arhiepiskop"
    ],
    "page": 746,
    "day": 28,
    "heading": "ЖИТИЕ СВЯТОГО ОТЦА НАШЕГО ФЕОДОРА,"
  },
  {
    "ids": [
      "irinarh-sevastijskij"
    ],
    "page": 754,
    "day": 28,
    "heading": "ПАМЯТЬ СВЯТОГО МУЧЕНИКА ИРИНАРХА"
  },
  {
    "ids": [
      "akakij-sinajskij"
    ],
    "page": 756,
    "day": 29,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОГО ОТЦА НАШЕГО АКАКИЯ СИНАЙСКОГО"
  },
  {
    "ids": [
      "paramon-vifinskij"
    ],
    "page": 758,
    "day": 29,
    "heading": "ПАМЯТЬ СВЯТОГО МУЧЕНИКА ПАРАМОНА"
  },
  {
    "ids": [
      "filumen-ankirskij"
    ],
    "page": 759,
    "day": 29,
    "heading": "ПАМЯТЬ СВЯТОГО МУЧЕНИКА ФИЛУМЕНА"
  },
  {
    "ids": [
      "andrej-pervozvannyj"
    ],
    "page": 760,
    "day": 30,
    "heading": "ПОДВИГИ И СТРАДАНИЯ СВЯТОГО АПОСТОЛА АНДРЕЯ ПЕРВОЗВАННОГО"
  },
  {
    "ids": [
      "frumentij-efiopskij"
    ],
    "page": 778,
    "day": 30,
    "heading": "ПАМЯТЬ СВЯТОГО ФРУМЕНТИЯ,"
  }
];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 3, group.page, sha, group.heading), { book: 3, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 3, group.page, 'other-edition', group.heading), undefined);
    for (const tradition of ['russian-orthodox', 'old-believer']) {
      assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === tradition && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 11 && c.rule.day === group.day), `${id}: ${tradition}`);
    }
  }
  assert.equal(sectionHeadings('ДЕНЬ ТРИДЦАТЫЙ\n\nПОДВИГИ И СТРАДАНИЯ\nСВЯТОГО АПОСТОЛА\n\nАНДРЕЯ ПЕРВОЗВАННОГО\n\nТекст')[0]?.title, 'ПОДВИГИ И СТРАДАНИЯ СВЯТОГО АПОСТОЛА АНДРЕЯ ПЕРВОЗВАННОГО');
  assert.notEqual(getSaint('iakov-persjanin')?.id, getSaint('iakov-rostovskij-episkop')?.id);
  assert.notEqual(getSaint('iakov-otshelnik-sirijskij')?.id, getSaint('iakov-persjanin')?.id);
});

test('December first through fourth identify fourteen readings and keep traditions distinct', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '147b1c3fe520c621b8d87d79025adff2be4f1815241296722e51639dc90b36fe';
  const groups = [
  {
    "ids": [
      "naum-prorok"
    ],
    "page": 7,
    "day": 1,
    "heading": "ПАМЯТЬ СВЯТОГО ПРОРОКА НАУМА"
  },
  {
    "ids": [
      "filaret-milostivyj"
    ],
    "page": 10,
    "day": 1,
    "heading": "ЖИТИЕ СВЯТОГО ПРАВЕДНОГО ФИЛАРЕТА МИЛОСТИВОГО"
  },
  {
    "ids": [
      "avvakum-prorok"
    ],
    "page": 36,
    "day": 2,
    "heading": "ПАМЯТЬ СВЯТОГО ПРОРОКА АВВАКУМА"
  },
  {
    "ids": [
      "miropija-hiosskaja"
    ],
    "page": 41,
    "day": 2,
    "heading": "СТРАДАНИЕ СВЯТОЙ МУЧЕНИЦЫ МИРОПИИ"
  },
  {
    "ids": [
      "afanasij-pecherskij-blizhnie"
    ],
    "page": 43,
    "day": 2,
    "heading": "ЖИТИЕ ПРЕПОДОБНОГО АФАНАСИЯ ПЕЧЕРСКОГО"
  },
  {
    "ids": [
      "stefan-urosh-serbskij"
    ],
    "page": 45,
    "day": 2,
    "heading": "ЖИТИЕ СВЯТОГО СТЕФАНА,"
  },
  {
    "ids": [
      "ioann-oksirinfskij",
      "iraklemon-oksirinfskij",
      "andrej-oksirinfskij",
      "feofil-oksirinfskij"
    ],
    "page": 47,
    "day": 2,
    "heading": "ПАМЯТЬ ПРЕПОДОБНЫХ ИОАННА, ИРАКЛЕМОНА, АНДРЕЯ и ФЕОФИЛА"
  },
  {
    "ids": [
      "sofonija-prorok"
    ],
    "page": 49,
    "day": 3,
    "heading": "ПАМЯТЬ СВЯТОГО ПРОРОКА СОФОНИИ"
  },
  {
    "ids": [
      "ioann-molchalnik-kolonijskij"
    ],
    "page": 54,
    "day": 3,
    "heading": "ЖИТИЕ ПРЕПОДОБНОГО ОТЦА НАШЕГО ИОАННА МОЛЧАЛЬНИКА"
  },
  {
    "ids": [
      "savva-storozhevskij"
    ],
    "page": 70,
    "day": 3,
    "heading": "ПРЕСТАВЛЕНИЕ ПРЕПОДОБНОГО САВВЫ СТОРОЖЕВСКОГО"
  },
  {
    "ids": [
      "savva-storozhevskij"
    ],
    "page": 72,
    "day": 3,
    "heading": "СКАЗАНИЕ О ЧУДЕСАХ ПРЕПОДОБНОГО САВВЫ"
  },
  {
    "ids": [
      "varvara-iliopolskaja",
      "iulianija-s-varvaroj"
    ],
    "page": 76,
    "day": 4,
    "heading": "ЖИТИЕ И СТРАДАНИЕ СВЯТОЙ ВЕЛИКОМУЧЕНИЦЫ ВАРВАРЫ"
  },
  {
    "ids": [
      "ioann-damaskin"
    ],
    "page": 97,
    "day": 4,
    "heading": "ЖИТИЕ ПРЕПОДОБНОГО ОТЦА НАШЕГО ИОАННА ДАМАСКИНА"
  },
  {
    "ids": [
      "ioann-polivotskij"
    ],
    "page": 117,
    "day": 4,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОГО ИОАННА ПОЛИВОТСКОГО"
  }
];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 4, group.page, sha, group.heading), { book: 4, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 4, group.page, 'other-edition', group.heading), undefined);
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'russian-orthodox' && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 12 && c.rule.day === group.day), id);
    assert.equal(venerations.some(v => v.saintId === id && v.traditionId === 'old-believer'), !['afanasij-pecherskij-blizhnie', 'stefan-urosh-serbskij', 'iulianija-s-varvaroj'].includes(id), id);
  }
  assert.ok(commemorations.some(c => c.saintId === 'filaret-milostivyj' && c.traditionId === 'old-believer' && c.rule.kind === 'fixed' && c.rule.month === 12 && c.rule.day === 2));
  assert.ok(!commemorations.some(c => c.saintId === 'filaret-milostivyj' && c.traditionId === 'russian-orthodox' && c.rule.kind === 'fixed' && c.rule.month === 12 && c.rule.day === 2));
  assert.notEqual(getSaint('stefan-urosh-serbskij')?.id, getSaint('stefan-dechanskij')?.id);
});

test('December fifth through eighth connect readings and reuse existing people', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '147b1c3fe520c621b8d87d79025adff2be4f1815241296722e51639dc90b36fe';
  const groups = [
  {
    "ids": [
      "savva-osvjashhennyj"
    ],
    "page": 119,
    "day": 5,
    "heading": "ЖИТИЕ И ПОДВИГИ ПРЕПОДОБНОГО ОТЦА НАШЕГО САВВЫ ОСВЯЩЕННОГО"
  },
  {
    "ids": [
      "karion-egipetskij",
      "zaharija-s-karionom"
    ],
    "page": 170,
    "day": 5,
    "heading": "ПАМЯТЬ ПРЕПОДОБНЫХ КАРИОНА МОНАХА и сына его ЗАХАРИИ"
  },
  {
    "ids": [
      "amvrosij-mediolanskij"
    ],
    "page": 209,
    "day": 7,
    "heading": "ЖИТИЕ СВЯТОГО ОТЦА НАШЕГО АМВРОСИЯ,"
  },
  {
    "ids": [
      "nil-stolobenskij"
    ],
    "page": 231,
    "day": 7,
    "heading": "ЖИТИЕ ПРЕПОДОБНОГО НИЛА СТОЛОБЕНСКОГО,"
  },
  {
    "ids": [
      "afinodor-mesopotamskij"
    ],
    "page": 235,
    "day": 7,
    "heading": "ПАМЯТЬ СВЯТОГО МУЧЕНИКА АФИНОДОРА"
  },
  {
    "ids": [
      "pavel-poslushlivyj"
    ],
    "page": 236,
    "day": 7,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОГО"
  },
  {
    "ids": [
      "patapij-fivanskij"
    ],
    "page": 238,
    "day": 8,
    "heading": "ЖИТИЕ ПРЕПОДОБНОГО ОТЦА НАШЕГО ПАТАПИЯ"
  }
];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    const body = group.page === 170 ? 'ПАМЯТЬ ПРЕПОДОБНЫХ\nКАРИОНА МОНАХА\n\nи сына его\n\nЗАХАРИИ' : group.heading;
    assert.deepEqual(reviewedWorkForPage(id, 4, group.page, sha, body), { book: 4, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 4, group.page, 'other-edition', group.heading), undefined);
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'russian-orthodox' && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 12 && c.rule.day === group.day), id);
    assert.equal(venerations.some(v => v.saintId === id && v.traditionId === 'old-believer'), id !== 'nil-stolobenskij', id);
  }
  for (const [day, ids] of [[6, ['nikolaj-mirlikijskij']], [8, ['sosfen-apostol', 'kifa-apostol', 'tihik-apostol', 'epafrodit-apostol', 'kesar-apostol']]] as const) for (const id of ids) {
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'old-believer' && c.rule.kind === 'fixed' && c.rule.month === 12 && c.rule.day === day), id);
  }
  assert.notEqual(getSaint('savva-osvjashhennyj')?.id, getSaint('savva-storozhevskij')?.id);
});

test('December ninth to twelfth keep separate people and sourced calendars', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '147b1c3fe520c621b8d87d79025adff2be4f1815241296722e51639dc90b36fe';
  const groups = [
  {
    "ids": [
      "anna-prorochica-mat-samuila"
    ],
    "page": 248,
    "day": 9,
    "heading": "ПАМЯТЬ СВЯТОЙ ПРОРОЧИЦЫ АННЫ,"
  },
  {
    "ids": [
      "stefan-novosijatel"
    ],
    "page": 252,
    "day": 9,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОГО СТЕФАНА НОВОСИЯТЕЛЯ!"
  },
  {
    "ids": [
      "sofronij-kiprskij"
    ],
    "page": 254,
    "day": 9,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОГО СОФРОНИЯ,"
  },
  {
    "ids": [
      "mina-aleksandrijskij-krasnorechivyj",
      "ermogen-aleksandrijskij",
      "evgraf-s-minoj"
    ],
    "page": 255,
    "day": 10,
    "heading": "СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ МИНЫ, ЕРМОГЕНА и ЕВГРАФА"
  },
  {
    "ids": [
      "gemell-paflagonskij"
    ],
    "page": 276,
    "day": 10,
    "heading": "ПАМЯТЬ СВЯТОГО ГЕМЕЛЛА"
  },
  {
    "ids": [
      "foma-defurkin"
    ],
    "page": 277,
    "day": 10,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОГО"
  },
  {
    "ids": [
      "daniil-stolpnik"
    ],
    "page": 283,
    "day": 11,
    "heading": "ЖИТИЕ ПРЕПОДОБНОГО ОТЦА НАШЕГО ДАНИИЛА СТОЛПНИКА"
  },
  {
    "ids": [
      "nikon-suhoj-pecherskij"
    ],
    "page": 309,
    "day": 11,
    "heading": "ЖИТИЕ ПРЕПОДОБНОГО НИКОНА"
  },
  {
    "ids": [
      "akepsij-persidskij",
      "aifal-persidskij-s-akepsijem"
    ],
    "page": 313,
    "day": 11,
    "heading": "ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ АКЕПСИЯ и АИФАЛА"
  },
  {
    "ids": [
      "miraks-egipetskij"
    ],
    "page": 314,
    "day": 11,
    "heading": "ПАМЯТЬ СВЯТОГО МУЧЕНИКА МИРАКСА"
  },
  {
    "ids": [
      "luka-novyj-stolpnik"
    ],
    "page": 317,
    "day": 11,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОГО ЛУКИ,"
  },
  {
    "ids": [
      "aleksandr-ierusalimskij"
    ],
    "page": 337,
    "day": 12,
    "heading": "ПАМЯТЬ СВЯТОГО СВЯЩЕННОМУЧЕНИКА АЛЕКСАНДРА,"
  },
  {
    "ids": [
      "razumnik-rimskij"
    ],
    "page": 339,
    "day": 12,
    "heading": "ПАМЯТЬ СВЯТОГО МУЧЕНИКА РАЗУМНИКА"
  }
];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 4, group.page, sha, group.heading), { book: 4, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 4, group.page, 'other-edition', group.heading), undefined);
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'russian-orthodox' && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 12 && c.rule.day === group.day), id);
    assert.equal(venerations.some(v => v.saintId === id && v.traditionId === 'old-believer'), id !== 'nikon-suhoj-pecherskij', id);
  }
  assert.ok(commemorations.some(c => c.saintId === 'spiridon-trimifuntskij' && c.traditionId === 'old-believer' && c.rule.kind === 'fixed' && c.rule.month === 12 && c.rule.day === 12));
  assert.notEqual(getSaint('anna-prorochica-mat-samuila')?.id, getSaint('anna-bogomatereva')?.id);
  assert.notEqual(getSaint('daniil-stolpnik')?.id, getSaint('daniil-prorok')?.id);
  assert.notEqual(getSaint('aifal-persidskij-s-akepsijem')?.id, getSaint('aifal-persidskij-s-akepsimom')?.id);
});

test('December thirteenth to sixteenth link collective accounts and independent witnesses', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '147b1c3fe520c621b8d87d79025adff2be4f1815241296722e51639dc90b36fe';
  const groups = [
  {
    "ids": [
      "lukija-sirakuzskaja"
    ],
    "page": 368,
    "day": 13,
    "heading": "СТРАДАНИЕ СВЯТОЙ МУЧЕНИЦЫ ЛУКИИ"
  },
  {
    "ids": [
      "arsenij-latrijskij"
    ],
    "page": 374,
    "day": 13,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОГО АРСЕНИЯ ЛАТРСКОГО"
  },
  {
    "ids": [
      "firs-vifinskij",
      "levkij-vifinskij",
      "kallinik-s-firsom",
      "filimon-antinojskij",
      "apollonij-s-filimonem",
      "arian-antinskoj",
      "feotih-s-arianom"
    ],
    "page": 376,
    "day": 14,
    "heading": "СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ ФИРСА, ЛЕВКИЯ, КАЛЛИНИКА, ФИЛИМОНА, АПОЛЛОНИЯ"
  },
  {
    "ids": [
      "elevferij-illirijskij",
      "anfija-mat-elevferija",
      "koriv-s-elevferiem"
    ],
    "page": 398,
    "day": 15,
    "heading": "СТРАДАНИЕ СВЯТОГО СВЯЩЕННОМУЧЕНИКА ЕЛЕВФЕРИЯ и матери его АНФИИ"
  },
  {
    "ids": [
      "stefan-surozhskij"
    ],
    "page": 406,
    "day": 15,
    "heading": "ЖИТИЕ СВЯТОГО СТЕФАНА ИСПОВЕДЛНИКА,"
  },
  {
    "ids": [
      "pavel-latrijskij"
    ],
    "page": 411,
    "day": 15,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОГО ПАВЛА ЛАТРСКОГО"
  },
  {
    "ids": [
      "elevferij-kuvikularij"
    ],
    "page": 412,
    "day": 15,
    "heading": "ПАМЯТЬ СВЯТОГО МУЧЕНИКА"
  },
  {
    "ids": [
      "pard-otshelnik"
    ],
    "page": 414,
    "day": 15,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОГО ПАРДА ОТШЕЛЬНИКА"
  },
  {
    "ids": [
      "aggej-prorok"
    ],
    "page": 415,
    "day": 16,
    "heading": "ПАМЯТЬ СВЯТОГО ПРОРОКА АГГЕЯ"
  },
  {
    "ids": [
      "feofanija-carica"
    ],
    "page": 417,
    "day": 16,
    "heading": "ЖИТИЕ БЛАЖЕННОЙ ЦАРИЦЫ ФЕОФАНИИ"
  },
  {
    "ids": [
      "marin-muchenik-16-dekabrja"
    ],
    "page": 423,
    "day": 16,
    "heading": "ПАМЯТЬ СВЯТОГО МУЧЕНИКА МАРИНА"
  }
];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    const body = group.page === 398 ? 'СТРАДАНИЕ\nСВЯТОГО СВЯЩЕННОМУЧЕНИКА\n\nЕЛЕВФЕРИЯ\n\nи матери его\n\nАНФИИ' : group.heading;
    assert.deepEqual(reviewedWorkForPage(id, 4, group.page, sha, body), { book: 4, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 4, group.page, 'other-edition', body), undefined);
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'russian-orthodox' && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 12 && c.rule.day === group.day), id);
    assert.equal(venerations.some(v => v.saintId === id && v.traditionId === 'old-believer'), id !== 'feotih-s-arianom', id);
  }
  for (const id of ['evstratij-sevastijskij', 'avksentij-sevastijskij', 'evgenij-sevastijskij', 'mardarij-sevastijskij', 'orest-sevastijskij']) {
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'old-believer' && c.rule.kind === 'fixed' && c.rule.month === 12 && c.rule.day === 13), id);
  }
  assert.notEqual(getSaint('elevferij-illirijskij')?.id, getSaint('elevferij-kuvikularij')?.id);
  assert.notEqual(getSaint('lukija-sirakuzskaja')?.id, getSaint('lukija-rimskaja-s-riksom')?.id);
  assert.notEqual(getSaint('marin-muchenik-16-dekabrja')?.id, getSaint('marin-persjanin-rimskij')?.id);
});

test('December seventeenth through twentieth preserve shared accounts and scoped witnesses', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '147b1c3fe520c621b8d87d79025adff2be4f1815241296722e51639dc90b36fe';
  const groups = [
  {
    "ids": [
      "daniil-ispovednik-nivertskij"
    ],
    "page": 449,
    "day": 17,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОГО ДАНИИЛА ИСПОВЕДНИКА"
  },
  {
    "ids": [
      "sevastian-rimskij",
      "nikostrat-s-sevastianom",
      "zoja-rimskaja-s-sevastianom",
      "kastorij-s-sevastianom",
      "trankvillin-rimskij",
      "markellin-s-sevastianom",
      "mark-s-sevastianom",
      "klavdij-s-sevastianom",
      "simforian-s-sevastianom",
      "viktorin-s-sevastianom",
      "tivurtij-s-sevastianom",
      "kastul-s-sevastianom"
    ],
    "page": 450,
    "day": 18,
    "heading": "ЖИТИЕ И СТРАДАНИЕ СВЯТОГО МУЧЕНИКА СЕВАСТИАНА"
  },
  {
    "ids": [
      "modest-ierusalimskij"
    ],
    "page": 475,
    "day": 18,
    "heading": "ПАМЯТЬ СВЯТОГО МОДЕСТА,"
  },
  {
    "ids": [
      "flor-amijskij"
    ],
    "page": 477,
    "day": 18,
    "heading": "ПАМЯТЬ СВЯТОГО ФЛОРА,"
  },
  {
    "ids": [
      "mihail-sinkell"
    ],
    "page": 478,
    "day": 18,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОГО МИХАИЛА СИНКЕЛЛА"
  },
  {
    "ids": [
      "vonifatij-tarsijskij",
      "aglaida-rimskaja"
    ],
    "page": 481,
    "day": 19,
    "heading": "СТРАДАНИЕ СВЯТОГО МУЧЕНИКА ВОНИФАТИЯ"
  },
  {
    "ids": [
      "vonifatij-ferentijskij"
    ],
    "page": 490,
    "day": 19,
    "heading": "ЖИТИЕ СВЯТОГО ВОНИФАТИЯ МИЛОСТИВОГО,"
  },
  {
    "ids": [
      "grigorij-omiritskij"
    ],
    "page": 496,
    "day": 19,
    "heading": "ЖИТИЕ СВЯТОГО ГРИГОРИЯ,"
  },
  {
    "ids": [
      "ilija-egipetskij-19-dekabrja",
      "prov-egipetskij-19-dekabrja",
      "aris-egipetskij-19-dekabrja"
    ],
    "page": 521,
    "day": 19,
    "heading": "ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ ИЛИИ, ПРОВА и АРИСА"
  },
  {
    "ids": [
      "polievkt-kesarijskij-19-dekabrja",
      "timofej-s-polievktom"
    ],
    "page": 522,
    "day": 19,
    "heading": "ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ ПОЛИЕВКТА и ТИМОФЕЯ"
  },
  {
    "ids": [
      "ignatij-bogonosec"
    ],
    "page": 523,
    "day": 20,
    "heading": "СТРАДАНИЕ СВЯТОГО СВЯЩЕННОМУЧЕНИКА ИГНАТИЯ БОГОНОСЦА"
  },
  {
    "ids": [
      "filogonij-antiohijskij"
    ],
    "page": 536,
    "day": 20,
    "heading": "ПАМЯТЬ СВЯТОГО ФИЛОГОНИЯ,"
  },
  {
    "ids": [
      "daniil-serbskij-arhiepiskop"
    ],
    "page": 537,
    "day": 20,
    "heading": "ЖИТИЕ СВЯТОГО ДАНИИЛА,"
  }
];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 4, group.page, sha, group.heading), { book: 4, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 4, group.page, 'other-edition', group.heading), undefined);
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'russian-orthodox' && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 12 && c.rule.day === group.day), id);
    assert.equal(venerations.some(v => v.saintId === id && v.traditionId === 'old-believer'), !['zoja-rimskaja-s-sevastianom', 'simforian-s-sevastianom', 'viktorin-s-sevastianom', 'daniil-serbskij-arhiepiskop'].includes(id), id);
  }
  for (const id of ['daniil-prorok', 'ananija-vavilonskij', 'azarija-vavilonskij', 'misail-vavilonskij']) {
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'old-believer' && c.rule.kind === 'fixed' && c.rule.month === 12 && c.rule.day === 17), id);
  }
  assert.notEqual(getSaint('vonifatij-tarsijskij')?.id, getSaint('vonifatij-ferentijskij')?.id);
  assert.notEqual(getSaint('daniil-ispovednik-nivertskij')?.id, getSaint('daniil-serbskij-arhiepiskop')?.id);
});

test('December twenty-first through twenty-fourth link named people to their accounts', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '147b1c3fe520c621b8d87d79025adff2be4f1815241296722e51639dc90b36fe';
  const groups = [
  {
    "ids": [
      "iulianija-nikomidiiskaja"
    ],
    "page": 550,
    "day": 21,
    "heading": "СТРАДАНИЕ СВЯТОЙ МУЧЕНИЦЫ ИУЛИАНИИ ДЕВЫ"
  },
  {
    "ids": [
      "petr-moskovskij-mitropolit"
    ],
    "page": 560,
    "day": 21,
    "heading": "ЖИТИЕ СВЯТОГО ПЕТРА,"
  },
  {
    "ids": [
      "femistoklej-mirlikiiskij"
    ],
    "page": 568,
    "day": 21,
    "heading": "ПАМЯТЬ СВЯТОГО МУЧЕНИКА ФЕМИСТОКЛЕЯ"
  },
  {
    "ids": [
      "anastasija-uzoreshitelnica",
      "hrisogon-s-anastasiej",
      "feodotija-s-anastasiej",
      "evod-s-feodotiej",
      "evtihian-s-anastasiej"
    ],
    "page": 569,
    "day": 22,
    "heading": "СТРАДАНИЕ СВЯТОЙ ВЕЛИКОМУЧЕНИЦЫ АНАСТАСИИ УЗОРЕШИТЕЛЬНИЦЫ,"
  },
  {
    "ids": [
      "nifont-kiprskij"
    ],
    "page": 588,
    "day": 23,
    "heading": "ЖИТИЕ СВЯТОГО ОТЦА НАШЕГО НИФОНТА,"
  },
  {
    "ids": [
      "feodul-kritskij",
      "satornin-kritskij",
      "evpor-kritskij",
      "gelasij-kritskij",
      "evnikian-kritskij",
      "zotik-kritskij",
      "pompij-kritskij",
      "agafopus-kritskij",
      "vasilid-kritskij",
      "evarest-kritskij"
    ],
    "page": 610,
    "day": 23,
    "heading": "СТРАДАНИЕ СВЯТЫХ ДЕСЯТИ МУЧЕНИКОВ КРИТСКИХ"
  },
  {
    "ids": [
      "pavel-neokesarijskij"
    ],
    "page": 614,
    "day": 23,
    "heading": "ПАМЯТЬ СВЯТОГО ПАВЛА,"
  },
  {
    "ids": [
      "evgenija-rimskaja",
      "prot-s-evgeniej",
      "iakinf-s-evgeniej",
      "klavdija-mat-evgenii"
    ],
    "page": 617,
    "day": 24,
    "heading": "ЖИТИЕ И СТРАДАНИЕ СВЯТОЙ ПРЕПОДОБНОМУЧЕНИЦЫ ЕВГЕНИИ"
  },
  {
    "ids": [
      "nikolaj-monah-24-dekabrja"
    ],
    "page": 641,
    "day": 24,
    "heading": "ПАМЯТЬ ПРЕПОДОБНОГО НИКОЛАЯ МОНАХА"
  }
];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 4, group.page, sha, group.heading), { book: 4, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 4, group.page, 'other-edition', group.heading), undefined);
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'russian-orthodox' && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 12 && c.rule.day === group.day), id);
    assert.equal(venerations.some(v => v.saintId === id && v.traditionId === 'old-believer'), !['evtihian-s-anastasiej', 'pompij-kritskij', 'prot-s-evgeniej', 'klavdija-mat-evgenii'].includes(id), id);
  }
  assert.notEqual(getSaint('iulianija-nikomidiiskaja')?.id, getSaint('iulianija-s-varvaroj')?.id);
  assert.notEqual(getSaint('nikolaj-monah-24-dekabrja')?.id, getSaint('nikolaj-mirlikijskij')?.id);
});

test('late December book readings retain distinct names, sources and calendars', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '147b1c3fe520c621b8d87d79025adff2be4f1815241296722e51639dc90b36fe';
  const rows = [
    { id: 'feodor-nachertannyj', day: 27, page: 730, body: 'ЖИТИЕ И СТРАДАНИЕ СВЯТОГО ПРЕПОДОБНОМУЧЕНИКА И ИСПОВЕДНИКА\nФЕОДОРА\nИ БРАТА ЕГО ПРЕПОДОБНОГО\nФЕОФАНА' },
    { id: 'feodor-konstantinopolskij-27-dekabrja', day: 27, page: 750, body: 'ПАМЯТЬ СВЯТОГО ФЕОДОРА,' },
    { id: 'mark-pecherskij-grobokopatel', day: 29, page: 791, body: 'ЖИТИЕ ПРЕПОДОБНЫХ МАРКА ПЕЩЕРНИКА и ФЕОФИЛА ПЛАЧЛИВОГО' },
    { id: 'feofil-pecherskij-plachlivyj', day: 29, page: 791, body: 'ЖИТИЕ ПРЕПОДОБНЫХ МАРКА ПЕЩЕРНИКА и ФЕОФИЛА ПЛАЧЛИВОГО' },
    { id: 'feodora-kesarijskaja-30-dekabrja', day: 30, page: 811, body: 'ПАМЯТЬ ПРЕПОДОБНОЙ ФЕОДОРЫ КЕСАРИЙСКОЙ' },
    { id: 'feodora-caregradskaja', day: 30, page: 813, body: 'ПАМЯТЬ ПРЕПОДОБНОЙ ФЕОДОРЫ ЦАРЕГРАДСКОЙ' },
  ];
  for (const row of rows) {
    assert.ok(getSaint(row.id), row.id);
    assert.ok(commemorations.some(c => c.saintId === row.id && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 12 && c.rule.day === row.day), row.id);
    assert.deepEqual(reviewedWorkForPage(row.id, 4, row.page, sha, row.body), { book: 4, page: row.page, section: 0 });
    assert.equal(reviewedWorkForPage(row.id, 4, row.page, 'other-edition', row.body), undefined);
  }
  for (const id of ['mark-pecherskij-grobokopatel', 'feofil-pecherskij-plachlivyj']) {
    assert.ok(!venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'));
  }
});

test('Nicomedia martyrs have individual cards and one sourced account', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const ids = ['glikerij-nikomidiiskij', 'zinon-nikomidiiskij-28-dekabrja', 'feofil-diakon-nikomidiiskij', 'dorofej-nikomidiiskij', 'mardonij-nikomidiiskij', 'migdonij-nikomidiiskij', 'indis-nikomidiiskij', 'gorgonij-nikomidiiskij', 'petr-nikomidiiskij-s-indisom', 'agafija-nikomidiiskaja', 'feofila-nikomidiiskaja', 'domna-nikomidiiskaja', 'evfimij-nikomidiiskij-28-dekabrja'];
  const sha = '147b1c3fe520c621b8d87d79025adff2be4f1815241296722e51639dc90b36fe';
  const body = 'СТРАДАНИЕ ДВАДЦАТИ ТЫСЯЧ МУЧЕНИКОВ,\nв Никомидии сожженных';
  assert.equal(new Set(ids.map(id => getSaint(id)?.id)).size, 13);
  for (const id of ids) {
    assert.ok(getSaint(id), id);
    assert.ok(commemorations.some(c => c.saintId === id && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 12 && c.rule.day === 28), id);
    assert.deepEqual(reviewedWorkForPage(id, 4, 751, sha, body), { book: 4, page: 751, section: 0 });
    const pomor = venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015');
    assert.equal(pomor, !['agafija-nikomidiiskaja', 'feofila-nikomidiiskaja', 'evfimij-nikomidiiskij-28-dekabrja'].includes(id), id);
  }
});

test('January readings preserve named pairs and scoped calendar witnesses', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = 'e62ed1051709261e1b21d03eac3e74d8475e1f77e28c5a56d2faf2b0390e242f';
  const pairs = [
    { ids: ['zosima-kilikijskij', 'afanasij-kommentarisij'], day: 4, page: 166, body: 'ПАМЯТЬ СВЯТЫХ\nПРЕПОДОБНОМУЧЕНИКА ЗОСИМЫ и МУЧЕНИКА АФАНАСИЯ' },
    { ids: ['feopempt-nikomidiiskij', 'feona-nikomidiiskij'], day: 5, page: 167, body: 'СТРАДАНИЕ святых мучеников\nФЕОПЕМПТЛА и ФЕОНЫ' },
  ];
  for (const group of pairs) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.ok(commemorations.some(c => c.saintId === id && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 1 && c.rule.day === group.day), id);
    assert.ok(venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'), id);
    assert.deepEqual(reviewedWorkForPage(id, 5, group.page, sha, group.body), { book: 5, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 5, group.page, 'other-edition', group.body), undefined);
  }
  assert.ok(!venerations.some(v => v.saintId === 'apollinarija-egipetskaja' && v.sourceId === 'pomor-mesjaceslov-2015'));
});

test('January readings distinguish adjacent sections and Philip’s two dates', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = 'e62ed1051709261e1b21d03eac3e74d8475e1f77e28c5a56d2faf2b0390e242f';
  const body = 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ ФЕОФИЛА и ЕЛЛАДИЯ\n\nТекст.\n\nПАМЯТЬ ПРЕПОДОБНОГО ЕМИЛИАНА ИСПОВЕДНИКА';
  for (const id of ['feofil-diakon-8-janvarja', 'elladij-s-feofilom']) {
    assert.deepEqual(reviewedWorkForPage(id, 5, 246, sha, body), { book: 5, page: 246, section: 0 });
  }
  assert.deepEqual(reviewedWorkForPage('emilian-kizicheskij', 5, 246, sha, body), { book: 5, page: 246, section: 1 });
  assert.equal(reviewedWorkForPage('emilian-kizicheskij', 5, 246, 'other-edition', body), undefined);
  const dates = commemorations.filter(c => c.saintId === 'filipp-mitropolit-moskovskij' && c.rule.kind === 'fixed' && c.rule.calendar === 'julian');
  assert.ok(dates.some(c => c.rule.kind === 'fixed' && c.rule.month === 1 && c.rule.day === 9 && c.sourceId === 'calendar-pamyati-9-janvarja-kniga-5'));
  assert.ok(dates.some(c => c.rule.kind === 'fixed' && c.rule.month === 7 && c.rule.day === 3 && c.label === 'Перенесение мощей'));
  assert.ok(!venerations.some(v => v.saintId === 'grigorij-pecherskij-chudotvorec' && v.sourceId === 'pomor-mesjaceslov-2015'));
});

test('January 16 collective reading keeps the named martyrs and verified name variants', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const ids = ['spevsipp-langonijskij', 'elevsipp-langonijskij', 'melevsipp-langonijskij', 'leonilla-langonijskaja', 'neon-langonijskij', 'turvon-langonijskij', 'iovilla-langonijskaja'];
  const sha = 'e62ed1051709261e1b21d03eac3e74d8475e1f77e28c5a56d2faf2b0390e242f';
  const body = 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ\nСПЕВСИППА, ЕЛЕВСИППА И МЕЛЕВСИППА,';
  assert.equal(new Set(ids.map(id => getSaint(id)?.id)).size, 7);
  for (const id of ids) {
    assert.ok(getSaint(id), id);
    assert.ok(commemorations.some(c => c.saintId === id && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 1 && c.rule.day === 16), id);
    assert.deepEqual(reviewedWorkForPage(id, 5, 462, sha, body), { book: 5, page: 462, section: 0 });
    assert.equal(reviewedWorkForPage(id, 5, 462, 'other-edition', body), undefined);
    assert.equal(venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'), ['melevsipp-langonijskij', 'leonilla-langonijskaja'].includes(id), id);
  }
});

test('January 20 collective memories preserve individual people and scanned edition', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = 'e62ed1051709261e1b21d03eac3e74d8475e1f77e28c5a56d2faf2b0390e242f';
  const groups = [
    { ids: ['vass-nikomidiiskij', 'evsevij-nikomidiiskij-s-vassom', 'evtihij-nikomidiiskij-s-vassom', 'vasilid-nikomidiiskij-s-vassom'], page: 615, body: 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ ВАССА, ЕВСЕВИЯ, ЕВТИХИЯ и ВАСИЛИДА', pomor: true },
    { ids: ['inna-skifskij', 'pinna-skifskij', 'rimma-skifskij'], page: 616, body: 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ ИННЫ, ПИННЫ и РРММЫ', pomor: false },
  ];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.ok(commemorations.some(c => c.saintId === id && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 1 && c.rule.day === 20), id);
    assert.deepEqual(reviewedWorkForPage(id, 5, group.page, sha, group.body), { book: 5, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 5, group.page, 'other-edition', group.body), undefined);
    assert.equal(commemorations.some(c => c.saintId === id && c.sourceId === 'pomor-mesjaceslov-2015' && c.rule.kind === 'fixed' && c.rule.month === 1 && c.rule.day === 20), group.pomor, id);
  }
});

test('January 22 and 24 keep Anastasius events and Sicilian martyrs distinct', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = 'e62ed1051709261e1b21d03eac3e74d8475e1f77e28c5a56d2faf2b0390e242f';
  const group = ['vavila-sicilijskij', 'timofej-s-vaviloj', 'agapij-s-vaviloj'];
  const body = 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ\nВАВИЛЫ СИЦИЛИЙСКОГО\n\nи учеников его\n\nТИМОФКЯ и АГАПИЯ';
  for (const id of group) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 5, 753, sha, body), { book: 5, page: 753, section: 0 });
    assert.ok(commemorations.some(c => c.saintId === id && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 1 && c.rule.day === 24), id);
  }
  for (const tradition of ['russian-orthodox', 'old-believer']) {
    const dates = commemorations.filter(c => c.saintId === 'anastasij-persjanin' && c.traditionId === tradition && c.rule.kind === 'fixed' && c.rule.calendar === 'julian');
    assert.equal(dates.length, 2);
    assert.equal(new Set(dates.map(c => c.id)).size, 2);
    assert.ok(dates.some(c => c.rule.kind === 'fixed' && c.rule.month === 1 && c.rule.day === 22 && c.label === 'День памяти'));
    assert.ok(dates.some(c => c.rule.kind === 'fixed' && c.rule.month === 1 && c.rule.day === 24 && c.label === 'Перенесение мощей'));
  }
});

test('Felicitas and her seven sons retain individual cards and one account', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const ids = ['felicata-rimskaja', 'iannarij-syn-felicaty', 'feliks-syn-felicaty', 'filipp-syn-felicaty', 'silvan-syn-felicaty', 'aleksandr-syn-felicaty', 'vitalij-syn-felicaty', 'marcial-syn-felicaty'];
  const sha = 'e62ed1051709261e1b21d03eac3e74d8475e1f77e28c5a56d2faf2b0390e242f';
  for (const id of ids) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 5, 777, sha, 'ПАМЯТЬ СВЯТОЙ МУЧЕНИЦЫ ФЕЛИЦАТЫ'), { book: 5, page: 777, section: 0 });
    assert.equal(venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'), id === 'felicata-rimskaja', id);
  }
  for (const tradition of ['russian-orthodox', 'old-believer']) {
    const dates = commemorations.filter(c => c.saintId === 'ioann-zlatoust' && c.traditionId === tradition && c.rule.kind === 'fixed' && c.rule.calendar === 'julian');
    assert.ok(dates.some(c => c.rule.kind === 'fixed' && c.rule.month === 1 && c.rule.day === 27 && c.label === 'Перенесение мощей'));
    assert.equal(new Set(dates.map(c => c.id)).size, dates.length);
  }
});

test('three hierarchs and Ignatius retain separately sourced commemorations', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = 'e62ed1051709261e1b21d03eac3e74d8475e1f77e28c5a56d2faf2b0390e242f';
  const body = 'СОБОР ТРЕХ ВЕЛИКИХ ВСЕЛЕНСКИХ УЧИТЕЛЕЙ ВАСИЛИЯ ВЕЛИКОГО, ГРИГОРИЯ БОГОСЛОВА и ИОАННА ЗЛАТОУСТА';
  for (const id of ['vasilij-velikij', 'grigorij-bogoslov', 'ioann-zlatoust']) {
    for (const tradition of ['russian-orthodox', 'old-believer']) {
      const dates = commemorations.filter(c => c.saintId === id && c.traditionId === tradition);
      assert.ok(dates.some(c => c.rule.kind === 'fixed' && c.rule.month === 1 && c.rule.day === 30 && c.label === 'Собор трёх святителей'), id);
      assert.equal(new Set(dates.map(c => c.id)).size, dates.length, id);
    }
    assert.deepEqual(reviewedWorkForPage(id, 5, 827, sha, body), { book: 5, page: 827, section: 0 });
  }
  for (const tradition of ['russian-orthodox', 'old-believer']) {
    const dates = commemorations.filter(c => c.saintId === 'ignatij-bogonosec' && c.traditionId === tradition);
    assert.ok(dates.some(c => c.rule.kind === 'fixed' && c.rule.month === 1 && c.rule.day === 29 && c.label === 'Перенесение мощей'));
    assert.equal(new Set(dates.map(c => c.id)).size, dates.length);
  }
});

test('February readings distinguish same-page entries and Perpetua’s companions', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '01c0ca7096c861b5edf80f97c2ee15484b2bb6c8b59cd0ab751e69690aa72ab9';
  const shared = 'ПАМЯТЬ СВЯТОЙ МУЧЕНИЦЫ ПЕРПЕТУИ\n\nи с ней святых юношей\n\nСАТИРА, РЕВОКАТА, САТОРНИЛА, СЕКУНДА';
  for (const id of ['perpetuja-karfagenskaja', 'satir-karfagenskij', 'revokat-karfagenskij', 'satornil-karfagenskij', 'sekund-karfagenskij', 'filicitata-karfagenskaja']) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 6, 19, sha, shared), { book: 6, page: 19, section: 0 });
  }
  const page = 'ПАМЯТЬ СВЯТОЙ АННЫ ПРОРОЧИЦЫ\n\nТекст.\n\nПАМЯТЬ СВЯТОГО МУЧЕНИКА\nВЛАСИЯ?';
  assert.deepEqual(reviewedWorkForPage('anna-prorochica-doch-fanuila', 6, 33, sha, page), { book: 6, page: 33, section: 0 });
  assert.deepEqual(reviewedWorkForPage('vlasij-kesarijskij-pastuh', 6, 33, sha, page), { book: 6, page: 33, section: 1 });
  assert.notEqual(getSaint('anna-prorochica-doch-fanuila')?.id, getSaint('anna-prorochica-mat-samuila')?.id);
  assert.equal(reviewedWorkForPage('vlasij-kesarijskij-pastuh', 6, 33, 'other-edition', page), undefined);
});

test('February collective stories keep named companions and calendar witnesses separate', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '01c0ca7096c861b5edf80f97c2ee15484b2bb6c8b59cd0ab751e69690aa72ab9';
  const groups = [
    { ids: ['feodulija-anazarvskaja', 'elladij-s-feoduliej', 'makarij-s-feoduliej', 'evagrij-s-feoduliej'], page: 77, body: 'СТРАДАНИЕ СВЯТОЙ МУЧЕНИЦЫ ФЕОДУЛИИ' },
    { ids: ['marfa-s-mariej', 'marija-s-marfoj', 'likarion-s-marfoj'], page: 118, body: 'ПАМЯТЬ СВЯТЫХ МУЧЕНИЦ\nМАРФЫ и МАРИИ\n\nи брата их святого мученика\nЛИКАРИОНА ОТРОКА' },
  ];
  for (const group of groups) for (const id of group.ids) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 6, group.page, sha, group.body), { book: 6, page: group.page, section: 0 });
    assert.equal(reviewedWorkForPage(id, 6, group.page, 'other-edition', group.body), undefined);
  }
  assert.ok(!venerations.some(v => v.saintId === 'likarion-s-marfoj' && v.sourceId === 'pomor-mesjaceslov-2015'));
});

test('Maria and Eugene share a reading and Dimitry has a Pomor witness', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '01c0ca7096c861b5edf80f97c2ee15484b2bb6c8b59cd0ab751e69690aa72ab9';
  const body = 'ЖИТИЕ ПРЕПОДОБНОЙ МАРИИ,\n\nподвизавшейся в мужском образе под именем\nМАРИНА,\n\nи отца ее, преподобного ЕВГЕНИЯ';
  for (const id of ['marija-vifinskaja-marin', 'evgenij-otec-marii-marina']) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 6, 236, sha, body), { book: 6, page: 236, section: 0 });
    assert.ok(venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'), id);
  }
  assert.ok(commemorations.some(c => c.saintId === 'dimitrij-priluckij' && c.sourceId === 'pomor-mesjaceslov-2015' && c.rule.kind === 'fixed' && c.rule.calendar === 'julian' && c.rule.month === 2 && c.rule.day === 11));
  assert.ok(!venerations.some(v => v.saintId === 'vaptos-s-haralampiem' && v.sourceId === 'pomor-mesjaceslov-2015'));
});

test('Pamphilus companions and the Chernihiv commemorations retain their sources', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '01c0ca7096c861b5edf80f97c2ee15484b2bb6c8b59cd0ab751e69690aa72ab9';
  const ids = ['pamfil-kesarijskij', 'valent-s-pamfilom', 'pavel-s-pamfilom', 'porfirij-s-pamfilom', 'selevkij-s-pamfilom', 'feodul-s-pamfilom', 'iulian-s-pamfilom', 'samuil-s-pamfilom', 'ilija-s-pamfilom', 'daniil-s-pamfilom', 'ieremija-s-pamfilom', 'isaija-s-pamfilom'];
  for (const id of ids) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 6, 284, sha, 'СТРАДАНИЕ СВЯТЫХ ДВЕНАДЦАТИ МУЧЕНИКОВ: ПАМФИЛА ПРЕСВИТЕРА'), { book: 6, page: 284, section: 0 });
    assert.ok(venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'), id);
  }
  for (const id of ['mihail-chernigovskij-knyaz', 'feodor-boyarin-chernigovskij']) {
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-mihail-feodor-september' && c.rule.kind === 'fixed' && c.rule.month === 9 && c.rule.day === 20));
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'pomor-mesjaceslov-2015' && c.rule.kind === 'fixed' && c.rule.month === 9 && c.rule.day === 20));
  }
  assert.ok(!commemorations.some(c => c.saintId === 'feodor-boyarin-chernigovskij' && c.sourceId === 'pomor-mesjaceslov-2015' && c.rule.kind === 'fixed' && c.rule.month === 2 && c.rule.day === 14));
});

test('February book links retain shared readings and independent commemorations', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '01c0ca7096c861b5edf80f97c2ee15484b2bb6c8b59cd0ab751e69690aa72ab9';
  const apostles = ['arhipp-apostol', 'filimon-apostol', 'apfija-ravnoapostolnaja'];
  for (const id of apostles) {
    assert.deepEqual(reviewedWorkForPage(id, 6, 333, sha, 'ПАМЯТЬ СВЯТЫХ АПОСТОЛОВ АРХИППА, ФИЛИМОНА и АПФИИ'), { book: 6, page: 333, section: 0 });
    for (const tradition of ['russian-orthodox', 'old-believer']) {
      const dates = commemorations.filter(c => c.saintId === id && c.traditionId === tradition);
      assert.ok(dates.some(c => c.rule.kind === 'fixed' && c.rule.month === 2 && c.rule.day === 19));
      assert.equal(new Set(dates.map(c => c.id)).size, dates.length);
    }
  }
  for (const tradition of ['russian-orthodox', 'old-believer']) {
    const dates = commemorations.filter(c => c.saintId === 'mina-aleksandrijskij-krasnorechivyj' && c.traditionId === tradition);
    assert.ok(dates.some(c => c.rule.kind === 'fixed' && c.rule.month === 2 && c.rule.day === 17 && c.label === 'Обретение мощей'));
    assert.equal(new Set(dates.map(c => c.id)).size, dates.length);
  }
  assert.notEqual(getSaint('lev-velikij-rimskij')?.id, getSaint('lev-katanskij')?.id);
  assert.ok(!venerations.some(v => v.saintId === 'agapit-sinadskij' && v.sourceId === 'pomor-mesjaceslov-2015'));
});

test('February and July readings preserve source references and distinguish namesakes', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const feb = '01c0ca7096c861b5edf80f97c2ee15484b2bb6c8b59cd0ab751e69690aa72ab9';
  const july = 'b36fd4ff7ec4ba22854e5f55c566d0f4e7661394995e9586e207f42e8f4876df';
  const first = 'moisej-sirijskij-s-ioannom', second = 'moisej-sirijskij-s-polihroniem';
  assert.notEqual(getSaint(first)?.id, getSaint(second)?.id);
  assert.deepEqual(reviewedWorkForPage(first, 6, 402, feb, 'ПАМЯТЬ ПРЕПОДОБНЫХ ИОАННА, АНТИОХА, АНТОНИНА и МОИСЕЯ'), { book: 6, page: 402, section: 0 });
  assert.equal(reviewedWorkForPage(first, 6, 403, feb, 'ПАМЯТЬ ПРЕПОДОБНЫХ ЗЕВИНА, ПОЛИХРОНИЯ, МОИСКЯ и ДАМИАНА'), undefined);
  assert.deepEqual(reviewedWorkForPage(second, 6, 403, feb, 'ПАМЯТЬ ПРЕПОДОБНЫХ ЗЕВИНА, ПОЛИХРОНИЯ, МОИСКЯ и ДАМИАНА'), { book: 6, page: 403, section: 0 });
  const alex = 'aleksandr-neusypajushhih';
  assert.deepEqual(reviewedWorkForPage(alex, 11, 46, july, 'ЖИТИЕ ПРЕПОДОБНОГО ОТЦА НАШЕГО АЛЕКСАНДРА,'), { book: 11, page: 46, section: 0 });
  assert.deepEqual(reviewedMentionForPage(alex, 6, 404, feb, 'В тот же день память преподобного Александра монаха, обители'), { book: 6, page: 404 });
  assert.equal(reviewedMentionForPage(alex, 6, 404, 'other-edition', 'В тот же день память преподобного Александра монаха, обители'), undefined);
  assert.ok(commemorations.some(c => c.saintId === alex && c.sourceId === 'calendar-pamyati-3-ijulja-kniga-11' && c.rule.kind === 'fixed' && c.rule.month === 7 && c.rule.day === 3));
  assert.ok(commemorations.some(c => c.saintId === 'ioann-predtecha' && c.sourceId === 'pomor-mesjaceslov-2015' && c.rule.kind === 'fixed' && c.rule.month === 2 && c.rule.day === 24));
  assert.ok(!venerations.some(v => v.saintId === 'filipp-s-mavrikijem' && v.sourceId === 'pomor-mesjaceslov-2015'));
});

test('February 29 commemorations follow each source in leap and common Julian years', async () => {
  const { commemorationDateForYear, convertDate } = await import('../src/lib/calendar');
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const ids = ['ioann-kassian-rimljanin', 'ioann-varsonofij-damasskij', 'feoktirist-pelikitskij'];
  for (const id of ids) {
    const orthodox = commemorations.find(c => c.saintId === id && c.traditionId === 'russian-orthodox')!;
    const pomor = commemorations.find(c => c.saintId === id && c.traditionId === 'old-believer')!;
    assert.deepEqual(commemorationDateForYear(orthodox, 2024), { year: 2024, month: 2, day: 29 });
    assert.deepEqual(commemorationDateForYear(orthodox, 2026), { year: 2026, month: 2, day: 28 });
    assert.equal(commemorationDateForYear(pomor, 2026), undefined);
    assert.ok(matchesCommemoration(orthodox, { year: 2026, month: 3, day: 13 }));
    assert.ok(!matchesCommemoration(pomor, { year: 2026, month: 3, day: 13 }));
    const leap2100 = convertDate({ year: 2100, month: 2, day: 29 }, 'julian', 'gregorian');
    assert.ok(matchesCommemoration(orthodox, leap2100));
    assert.ok(matchesCommemoration(pomor, leap2100));
  }
  const sha = '01c0ca7096c861b5edf80f97c2ee15484b2bb6c8b59cd0ab751e69690aa72ab9';
  const body = 'ПАМЯТЬ\nпреподобного отца нашего\n\nКАССИАНА РИМЛЯНИНА';
  assert.deepEqual(reviewedWorkForPage(ids[0], 6, 473, sha, body), { book: 6, page: 473, section: 0 });
  assert.equal(reviewedWorkForPage(ids[0], 6, 473, 'other-edition', body), undefined);
});

test('March readings link named companions to their common source and retain distinct traditions', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const sha = '569c63acc0bb571cd3380e3e9a283510f0e84b0f739a5785f122ca2b2d77c4e9';
  const body = 'СТРАДАНИЕ\nСВЯТЫХ МУЧЕНИКОВ\n\nПАВЛА и сестры его ИУЛИАНИИ\n\nи прочих с ними';
  for (const id of ['pavel-ptolemaidskij', 'iulianija-ptolemaidskaja', 'kodrat-s-pavlom-ptolemaidskim', 'akakij-s-pavlom-ptolemaidskim', 'stratonik-s-iulianiej']) {
    assert.deepEqual(reviewedWorkForPage(id, 7, 83, sha, body), { book: 7, page: 83, section: 0 });
    assert.ok(venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'));
  }
  assert.deepEqual(reviewedWorkForPage('evdokija-iliopolskaja', 7, 7, sha, '_ ЖИТИЕ И СТРАДАНИЕ\nСВЯТОЙ ПРЕПОДОБНОМУЧЕНИЦЫ\n\nЕВДОКИИ'), { book: 7, page: 7, section: 0 });
  const anchor = 'В тот же день память святых мучеников Маркелла и Антония, ог-';
  assert.deepEqual(reviewedMentionForPage('markell-muchenik-1-marta', 7, 42, sha, anchor), { book: 7, page: 42 });
  assert.equal(reviewedMentionForPage('markell-muchenik-1-marta', 7, 42, 'different-source', anchor), undefined);
  assert.ok(venerations.some(v => v.saintId === 'gerasim-iordanskij' && v.sourceId === 'pomor-mesjaceslov-2015'));
  assert.ok(!venerations.some(v => v.saintId === 'evfalija-sicilijskaja' && v.sourceId === 'pomor-mesjaceslov-2015'));
});

test('March namesakes retain separate book identities and sourced witnesses', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const sha = '569c63acc0bb571cd3380e3e9a283510f0e84b0f739a5785f122ca2b2d77c4e9';
  const ids = ['konon-isavrijskij', 'konon-ogorodnik', 'konon-ikonijskij-otec', 'konon-ikonijskij-syn'];
  assert.equal(new Set(ids.map(id => getSaint(id)?.id)).size, 4);
  const body = 'СТРАДАНИЕ\nСВЯТОГО ПРЕПОДОБНОМУЧЕНИКА\n\nКОНОНА и сына его КОНОНА,\n\nв Иконии пострадавших';
  for (const id of ids.slice(2)) assert.deepEqual(reviewedWorkForPage(id, 7, 131, sha, body), { book: 7, page: 131, section: 0 });
  assert.equal(reviewedWorkForPage(ids[0], 7, 131, sha, body), undefined);
  assert.deepEqual(reviewedMentionForPage('onisij-s-kononom-isavrijskim', 7, 129, sha, 'Память святого мученика Онисия, жившего и пострадавшего в'), { book: 7, page: 129 });
  for (const id of ['feodor-chernyj-jaroslavskij', 'david-feodorovich-jaroslavskij', 'konstantin-feodorovich-jaroslavskij']) {
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'pomor-mesjaceslov-2015' && c.label === 'Перенесение мощей' && c.rule.kind === 'fixed' && c.rule.month === 3 && c.rule.day === 5));
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'russian-orthodox' && c.label === 'Обретение мощей' && c.rule.kind === 'fixed' && c.rule.month === 3 && c.rule.day === 5));
  }
  assert.ok(!venerations.some(v => v.saintId === 'konon-isavrijskij' && v.sourceId === 'pomor-mesjaceslov-2015'));
});

test('March readings keep namesakes and different calendar dates tied to their sources', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const sha = '569c63acc0bb571cd3380e3e9a283510f0e84b0f739a5785f122ca2b2d77c4e9';
  const body = 'СТРАДАНИЕ СВЯТОГО МУЧЕНИКА КОДРАТА НИКОМИДИЙСКОГО И С НИМ СВЯТЫХ МУЧЕНИКОВ САТОРИНА и РУФИНА';
  for (const id of ['kodrat-nikomidijskij', 'satorin-nikomidijskij', 'rufin-nikomidijskij']) assert.deepEqual(reviewedWorkForPage(id, 7, 196, sha, body), { book: 7, page: 196, section: 0 });
  assert.equal(reviewedWorkForPage('kodrat-korinfskij', 7, 196, sha, body), undefined);
  assert.ok(commemorations.some(c => c.saintId === 'pionij-smirnskij' && c.sourceId === 'pomor-mesjaceslov-2015' && c.rule.kind === 'fixed' && c.rule.month === 3 && c.rule.day === 10));
  assert.ok(commemorations.some(c => c.saintId === 'pionij-smirnskij' && c.traditionId === 'russian-orthodox' && c.rule.kind === 'fixed' && c.rule.month === 3 && c.rule.day === 11));
  const anchor = 'В тот же день память святой мученицы Христины, в [У веке в Пер-';
  assert.deepEqual(reviewedMentionForPage('hristina-persidskaja', 7, 280, sha, anchor), { book: 7, page: 280 });
  assert.equal(reviewedMentionForPage('hristina-persidskaja', 7, 280, 'other-edition', anchor), undefined);
});

test('March collective memories preserve indistinguishable namesakes and source scope', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const sha = '569c63acc0bb571cd3380e3e9a283510f0e84b0f739a5785f122ca2b2d77c4e9';
  const ids = ['agapij-kesarijskij-15-marta', 'puplij-s-agapiem', 'timolaj-s-agapiem', 'romil-s-agapiem', 'aleksandr-pervyj-s-agapiem', 'aleksandr-vtoroj-s-agapiem', 'dionisij-pervyj-s-agapiem', 'dionisij-vtoroj-s-agapiem'];
  const body = 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ АГАПИЯ, ПУПЛИЯ, ТИМОЛАЯ, РОМИЛА, АЛЕКСАНДРА, АЛЕКСАНДРА, ДИОНИСИЯ и ДИОНИСИЯ';
  assert.equal(new Set(ids.map(id => getSaint(id)?.id)).size, 8);
  for (const id of ids) {
    assert.deepEqual(reviewedWorkForPage(id, 7, 304, sha, body), { book: 7, page: 304, section: 0 });
    assert.equal(venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'), id !== 'puplij-s-agapiem');
  }
  const anchor = 'В тот же день преставление святого Серапиона, архиепископа Нов-';
  assert.deepEqual(reviewedMentionForPage('serapion-novgorodskij', 7, 316, sha, anchor), { book: 7, page: 316 });
  assert.equal(reviewedMentionForPage('serapion-novgorodskij', 7, 316, 'other-edition', anchor), undefined);
  for (const tradition of ['russian-orthodox', 'old-believer']) assert.ok(commemorations.some(c => c.saintId === 'aristovul-apostol' && c.traditionId === tradition && c.rule.kind === 'fixed' && c.rule.month === 3 && c.rule.day === 16));
});

test('March families retain collective readings and independent calendar dates', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '569c63acc0bb571cd3380e3e9a283510f0e84b0f739a5785f122ca2b2d77c4e9';
  const family = ['hrisanf-rimskij', 'darija-rimskaja-s-hrisanfom', 'klavdij-tribun-rimskij', 'ilarija-s-klavdiem', 'iason-s-klavdiem', 'mavr-s-klavdiem', 'diodor-s-hrisanfom', 'marian-s-hrisanfom'];
  for (const id of family) assert.deepEqual(reviewedWorkForPage(id, 7, 366, sha, 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ ХРИСАНФА и ДАРИИ'), { book: 7, page: 366, section: 0 });
  assert.ok(!venerations.some(v => v.saintId === 'iason-s-klavdiem' && v.sourceId === 'pomor-mesjaceslov-2015'));
  for (const id of ['aleksandra-amisskaja', 'klavdija-amisskaja']) {
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'old-believer' && c.rule.kind === 'fixed' && c.rule.month === 3 && c.rule.day === 18));
    assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'russian-orthodox' && c.rule.kind === 'fixed' && c.rule.month === 3 && c.rule.day === 20));
  }
  for (const tradition of ['russian-orthodox', 'old-believer']) {
    const dates = commemorations.filter(c => c.saintId === 'anin-chudotvorec' && c.traditionId === tradition);
    assert.ok(dates.some(c => c.rule.kind === 'fixed' && c.rule.month === 3 && c.rule.day === 13));
    assert.ok(dates.some(c => c.rule.kind === 'fixed' && c.rule.month === 3 && c.rule.day === 18));
    assert.equal(new Set(dates.map(c => c.id)).size, dates.length);
  }
});

test('March accounts distinguish Nikons, Jacob witnesses and companions', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '569c63acc0bb571cd3380e3e9a283510f0e84b0f739a5785f122ca2b2d77c4e9';
  const ids = ['filit-s-lidiej', 'lidija-s-filitom', 'makedon-s-filitom', 'feoprepij-s-filitom', 'kronid-s-filitom', 'amfilohij-s-filitom'];
  for (const id of ids) {
    assert.deepEqual(reviewedWorkForPage(id, 7, 435, sha, 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ ФИЛИТА и ЛИДИИ'), { book: 7, page: 435, section: 0 });
    assert.ok(venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'));
  }
  assert.notEqual(getSaint('nikon-sicilijskij')?.id, getSaint('nikon-pecherskij-igumen')?.id);
  assert.ok(!venerations.some(v => v.saintId === 'nikon-pecherskij-igumen' && v.sourceId === 'pomor-mesjaceslov-2015'));
  assert.notEqual(getSaint('iakov-episkop-ispovednik-21-marta')?.id, getSaint('iakov-studijskij-ispovednik')?.id);
  assert.ok(commemorations.some(c => c.saintId === 'iakov-studijskij-ispovednik' && c.sourceId === 'calendar-iakov-studijskij-mart' && c.rule.kind === 'fixed' && c.rule.month === 3 && c.rule.day === 24));
});

test('Gothic group links to a collective source without inferring every tradition', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '569c63acc0bb571cd3380e3e9a283510f0e84b0f739a5785f122ca2b2d77c4e9';
  const body = 'ПАМЯТЬ ДВАДЦАТИ ШЕСТИ МУЧЕНИКОВ ГОТСКИХ!';
  for (const id of ['vafusij-gotskij', 'iskoj-gotskij', 'sila-gotskij', 'larisa-gotskaja', 'alla-gotskaja', 'gaafa-gotskaja', 'duklida-gotskaja', 'agafon-gotskij', 'konstans-gotskij']) {
    assert.ok(getSaint(id), id);
    assert.deepEqual(reviewedWorkForPage(id, 7, 478, sha, body), { book: 7, page: 478, section: 0 });
    assert.equal(reviewedWorkForPage(id, 7, 478, 'different-source', body), undefined);
  }
  for (const id of ['iskoj-gotskij', 'sila-gotskij', 'larisa-gotskaja', 'duklida-gotskaja', 'agafon-gotskij']) assert.ok(venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'), id);
  for (const id of ['alla-gotskaja', 'gaafa-gotskaja', 'vafusij-gotskij']) assert.ok(!venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'), id);
  assert.ok(getSaint('alla-gotskaja')?.sourceLocator.includes('требует проверки'));
});

test('end of March retains individual Hypatii, brief mentions and Ionah dates', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const sha = '569c63acc0bb571cd3380e3e9a283510f0e84b0f739a5785f122ca2b2d77c4e9';
  assert.deepEqual(reviewedWorkForPage('ipatij-gangrskij', 7, 585, sha, 'ПАМЯТЬ СВЯТОГО СВЯЩЕННОМУЧЕНИКА ИПАТИЯ ЧУДОТВОРЦА,'), { book: 7, page: 585, section: 0 });
  assert.equal(reviewedWorkForPage('ipatij-rufianskij', 7, 585, sha, 'ПАМЯТЬ СВЯТОГО СВЯЩЕННОМУЧЕНИКА ИПАТИЯ ЧУДОТВОРЦА,'), undefined);
  const anchor = 'В тот же день память святой Еввулы, матери святого Пантелеи-';
  assert.deepEqual(reviewedMentionForPage('evvula-mat-panteleimona', 7, 583, sha, anchor), { book: 7, page: 583 });
  assert.equal(reviewedMentionForPage('zosima-sirakuzskij', 7, 583, sha, anchor), undefined);
  assert.notEqual(getSaint('ioad-prorok')?.id, getSaint('iona-prorok')?.id);
  assert.ok(commemorations.some(c => c.saintId === 'iona-mitropolit-moskovskij' && c.traditionId === 'old-believer' && c.rule.kind === 'fixed' && c.rule.month === 3 && c.rule.day === 30));
  assert.ok(commemorations.some(c => c.saintId === 'iona-mitropolit-moskovskij' && c.traditionId === 'russian-orthodox' && c.rule.kind === 'fixed' && c.rule.month === 3 && c.rule.day === 31));
});

test('April first days preserve book boundaries and separate short memories', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const { reviewedBoundary } = await import('../src/lib/reviewed-book-boundaries');
  const sha = '34cad51db160ddb198289ea09aa9cd1745abb00e2f2eba61e6bb229cdc078e90';
  const heading = 'ПАМЯТЬ ПРЕПОДОБНОГО ОТЦА НАШЕГО ЕВФИМИЯ СУЗДАЛЬСКОГО';
  const anchor = 'В тот же день память преподобного отца нашего Макария исповед-';
  assert.deepEqual(reviewedWorkForPage('evfimij-suzdalskij', 8, 26, sha, heading), { book: 8, page: 26, section: 0 });
  assert.equal(reviewedWorkForPage('makarij-pelikitskij-ispovednik', 8, 26, sha, heading), undefined);
  assert.deepEqual(reviewedMentionForPage('makarij-pelikitskij-ispovednik', 8, 31, sha, anchor), { book: 8, page: 31 });
  assert.equal(reviewedMentionForPage('ahaz-pravednyj', 8, 31, sha, anchor), undefined);
  const body = `Окончание жития.\n${anchor}`;
  assert.equal(body.slice(reviewedBoundary(8, 26, heading, sha, 31, body)), anchor);
  assert.equal(reviewedBoundary(8, 26, heading, 'different-edition', 31, body), undefined);
  for (const id of ['amfian-kesarijskij', 'edesij-aleksandrijskij']) {
    assert.ok(venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'));
  }
});

test('April fourth and fifth preserve distinct people and book boundaries', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const { reviewedBoundary } = await import('../src/lib/reviewed-book-boundaries');
  const sha = '34cad51db160ddb198289ea09aa9cd1745abb00e2f2eba61e6bb229cdc078e90';
  const heading = 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ АГАФОПОДА и ФЕОДУЛА';
  for (const id of ['agafopod-solunskij', 'feodul-solunskij']) {
    assert.deepEqual(reviewedWorkForPage(id, 8, 72, sha, heading), { book: 8, page: 72, section: 0 });
    assert.ok(venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'));
  }
  assert.notEqual(getSaint('puplij-egipetskij')?.id, getSaint('puplij-s-agapiem')?.id);
  const anchor = 'В тот же день память преподобных отцов Феоны, Симеона и Фор-';
  for (const id of ['feona-pustynnik', 'simeon-pustynnik-s-feonoj', 'forvin-pustynnik']) {
    assert.deepEqual(reviewedMentionForPage(id, 8, 104, sha, anchor), { book: 8, page: 104 });
  }
  const body = `Конец жития.\n${anchor}`;
  const theodora = 'ПАМЯТЬ ПРЕПОДОБНОЙ ФЕОДОРЫ СОЛУНСКОЙ';
  assert.equal(body.slice(reviewedBoundary(8, 103, theodora, sha, 104, body)), anchor);
  assert.equal(reviewedBoundary(8, 103, theodora, 'another-edition', 104, body), undefined);
  const george = getSaint('georgij-malejskij');
  assert.equal(george?.sourceId, 'tatmitropolia-georgij-malejskij');
  assert.ok(george?.aliases.includes('Георгий Безмолвник'));
  const georgeAnchor = 'В тот же день память преподобного Георгия Безмолвника.';
  assert.deepEqual(reviewedMentionForPage('georgij-malejskij', 8, 71, sha, georgeAnchor), { book: 8, page: 71 });
  assert.equal(reviewedMentionForPage('georgij-malejskij', 8, 71, 'another-edition', georgeAnchor), undefined);
  assert.equal(reviewedMentionForPage('georgij-hozevit', 8, 71, sha, georgeAnchor), undefined);
});

test('April sixth to eighth retain short memories and shared-page works', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const { reviewedBoundary } = await import('../src/lib/reviewed-book-boundaries');
  const sha = '34cad51db160ddb198289ea09aa9cd1745abb00e2f2eba61e6bb229cdc078e90';
  const heading = 'СТРАДАНИЕ СВЯТОГО МУЧЕНИКА ПАВСИЛИПА';
  assert.deepEqual(reviewedWorkForPage('pavsilip', 8, 137, sha, heading), { book: 8, page: 137, section: 0 });
  const anchor = 'В тот же день память святого Руфина диакона, святой мучени-';
  for (const id of ['rufin-sinopskij', 'akilina-sinopskaja']) {
    assert.deepEqual(reviewedMentionForPage(id, 8, 129, sha, anchor), { book: 8, page: 129 });
  }
  assert.equal(reviewedMentionForPage('daniil-perejaslavskij', 8, 129, sha, anchor), undefined);
  const body = `Конец рассказа.\n${anchor}`;
  const calliopius = 'СТРАДАНИЕ СВЯТОГО МУЧЕНИКА КАЛЛИОПИЯ';
  assert.equal(body.slice(reviewedBoundary(8, 123, calliopius, sha, 129, body)), anchor);
  assert.equal(reviewedBoundary(8, 123, calliopius, 'another-edition', 129, body), undefined);
  for (const id of ['irodion-apostol', 'agav-apostol', 'ruf-apostol', 'asinkrit-apostol', 'flegont-apostol', 'ermij-apostol']) {
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'pomor-mesjaceslov-2015' && c.rule.kind === 'fixed' && c.rule.month === 4 && c.rule.day === 8));
  }
});

test('April ninth to eleventh retain collective readings and uncertain calendar variants', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const { reviewedBoundary } = await import('../src/lib/reviewed-book-boundaries');
  const sha = '34cad51db160ddb198289ea09aa9cd1745abb00e2f2eba61e6bb229cdc078e90';
  const heading = 'СТРАДАНИЕ СВЯТОГО МУЧЕНИКА ТЕРЕНТИЯ';
  for (const id of ['terentij-afrikanskij', 'afrikan-s-terentiem', 'maksim-afrikanskij-10-aprelja', 'pompij-afrikanskij', 'zinon-afrikanskij', 'aleksandr-afrikanskij', 'feodor-afrikanskij']) {
    assert.deepEqual(reviewedWorkForPage(id, 8, 146, sha, heading), { book: 8, page: 146, section: 0 });
  }
  assert.ok(!venerations.some(v => v.saintId === 'pompij-afrikanskij' && v.sourceId === 'pomor-mesjaceslov-2015'));
  const anchor = 'В тот же день память святых мучеников Иакова пресвитера, Аза-';
  for (const id of ['iakov-persidskij-presviter', 'azadan-persidskij', 'avdikij-persidskij']) {
    assert.deepEqual(reviewedMentionForPage(id, 8, 151, sha, anchor), { book: 8, page: 151 });
  }
  const body = `Конец рассказа.\n${anchor}`;
  assert.equal(body.slice(reviewedBoundary(8, 146, heading, sha, 151, body)), anchor);
  assert.equal(reviewedBoundary(8, 146, heading, 'another-edition', 151, body), undefined);
  assert.notEqual(getSaint('martinian-rimskij')?.id, getSaint('martinian-palestinskij')?.id);
});

test('April twelfth to fourteenth retain collective accounts and short memories', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const { reviewedBoundary } = await import('../src/lib/reviewed-book-boundaries');
  const sha = '34cad51db160ddb198289ea09aa9cd1745abb00e2f2eba61e6bb229cdc078e90';
  const heading = 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ ЛИТОВСКИХ АНТОНИЯ, ИОАННА и ЕВСТАФИЯ';
  for (const id of ['antonij-vilenskij', 'ioann-vilenskij', 'evstafij-vilenskij']) {
    assert.deepEqual(reviewedWorkForPage(id, 8, 201, sha, heading), { book: 8, page: 201, section: 0 });
    assert.ok(venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'));
  }
  const anchor = 'В тот же день памяти преподобномучеников Мины, Давида и';
  for (const id of ['mina-palestinskij-12-aprelja', 'david-palestinskij-12-aprelja', 'ioann-palestinskij-12-aprelja']) {
    assert.deepEqual(reviewedMentionForPage(id, 8, 176, sha, anchor), { book: 8, page: 176 });
  }
  const body = `Конец рассказа.\n${anchor}`;
  const anthusa = 'ПАМЯТЬ ПРЕПОДОБНОЙ АНФУСЫ';
  assert.equal(body.slice(reviewedBoundary(8, 175, anthusa, sha, 176, body)), anchor);
  assert.equal(reviewedBoundary(8, 175, anthusa, 'another-edition', 176, body), undefined);
  assert.notEqual(getSaint('kriskent-mirlikijskij')?.id, getSaint('kriskent-korinfskij')?.id);
});

test('April fifteenth to seventeenth preserve collective accounts and Azat dates', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '34cad51db160ddb198289ea09aa9cd1745abb00e2f2eba61e6bb229cdc078e90';
  const heading = 'СТРАДАНИЕ СВЯТОГО СВЯЩЕННОМУЧЕНИКА СИМЕОНА,';
  for (const id of ['simeon-persidskij-episkop', 'avdelaj-persidskij', 'ananij-persidskij-presviter', 'husdazat-persidskij', 'fusik-persidskij', 'askitreja-persidskaja', 'azat-persidskij']) {
    assert.deepEqual(reviewedWorkForPage(id, 8, 229, sha, heading), { book: 8, page: 229, section: 0 });
  }
  for (const day of [14, 17]) assert.ok(commemorations.some(c => c.saintId === 'azat-persidskij' && c.traditionId === 'russian-orthodox' && c.rule.kind === 'fixed' && c.rule.month === 4 && c.rule.day === day));
  for (const id of ['ananij-persidskij-presviter', 'askitreja-persidskaja']) assert.ok(!venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'));
  assert.ok(getSaint('husdazat-persidskij')?.aliases.includes('Усфазан'));
  assert.notEqual(getSaint('irina-solunskaja-s-agapiej')?.id, getSaint('hionija-solunskaja')?.id);
});

test('April eighteenth to twentieth keep separate namesakes and shared accounts', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '34cad51db160ddb198289ea09aa9cd1745abb00e2f2eba61e6bb229cdc078e90';
  const group = 'ПАМЯТЬ СВЯТЫХ МУЧЕНИКОВ ВИКТОРА, ЗОТИКА, ЗИНОНА, АКИНДИНА и СЕВЕРИАНА';
  const following = 'СТРАДАНИЕ СВЯТОГО МУЧЕНИКА ИОАННА НОВОГО';
  const body = `${group}\n\nТекст.\n\n${following}`;
  for (const id of ['viktor-s-zotikom', 'zotik-s-viktorom', 'zinon-s-viktorom', 'akindin-s-viktorom', 'severian-s-viktorom']) {
    assert.deepEqual(reviewedWorkForPage(id, 8, 266, sha, body), { book: 8, page: 266, section: 0 });
  }
  assert.deepEqual(reviewedWorkForPage('ioann-novyj-ianinskij', 8, 266, sha, body), { book: 8, page: 266, section: 1 });
  assert.notEqual(getSaint('anastasij-sinajskij-igumen')?.id, getSaint('anastasij-sinait-antiohijskij')?.id);
  assert.notEqual(getSaint('avksentij-s-kosmoj')?.id, getSaint('avksentij-vifinskij')?.id);
  assert.ok(commemorations.some(c => c.saintId === 'avraamij-bolgarskij' && c.label === 'Перенесение мощей' && c.rule.kind === 'fixed' && c.rule.month === 4 && c.rule.day === 20));
});

test('April twenty-first to twenty-third retain collective lives and separate memories', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const { reviewedBoundary } = await import('../src/lib/reviewed-book-boundaries');
  const sha = '34cad51db160ddb198289ea09aa9cd1745abb00e2f2eba61e6bb229cdc078e90';
  const heading = 'СТРАДАНИЕ СВЯТОГО СВЯЩЕННОМУЧЕНИКА ИАННУАРИЯ';
  for (const id of ['iannuarij-beneventskij', 'prokul-puteolskij', 'sossij-puteolskij', 'favst-s-iannuariem', 'disiderij-s-iannuariem', 'evtihij-s-iannuariem', 'akution-s-iannuariem']) {
    assert.deepEqual(reviewedWorkForPage(id, 8, 290, sha, heading), { book: 8, page: 290, section: 0 });
  }
  const anchor = 'В тот же день память святой мученицы царицы Александры и свя-';
  for (const id of ['aleksandra-rimskaja-carica', 'anatolij-s-georgiem', 'protoleon-s-georgiem']) {
    assert.deepEqual(reviewedMentionForPage(id, 8, 370, sha, anchor), { book: 8, page: 370 });
  }
  const body = `Конец рассказа.\n${anchor}`;
  const george = 'СТРАДАНИЕ СВЯТОГО ВЕЛИКОМУЧЕНИКА ГЕОРГИЯ ПОБЕДОНОСЦА';
  assert.equal(body.slice(reviewedBoundary(8, 336, george, sha, 370, body)), anchor);
  assert.equal(reviewedBoundary(8, 336, george, 'other-edition', 370, body), undefined);
  for (const id of ['georgij-pobedonosec', 'feodor-sikeot']) assert.ok(venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'));
  for (const id of ['evtihij-s-iannuariem', 'akution-s-iannuariem']) assert.ok(!venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'));
});

test('April twenty-fourth to twenty-sixth keep collective lives and short memories', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const { reviewedBoundary } = await import('../src/lib/reviewed-book-boundaries');
  const sha = '34cad51db160ddb198289ea09aa9cd1745abb00e2f2eba61e6bb229cdc078e90';
  const heading = 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ ЕВСЕВИЯ, НЕОНА, ЛЕОНТИЯ, ЛОНГИНА';
  for (const id of ['evsevij-s-neonom', 'neon-s-evseviem', 'leontij-s-evseviem', 'longin-s-evseviem']) {
    assert.deepEqual(reviewedWorkForPage(id, 8, 376, sha, heading), { book: 8, page: 376, section: 0 });
  }
  assert.ok(!venerations.some(v => v.saintId === 'neon-s-evseviem' && v.sourceId === 'pomor-mesjaceslov-2015'));
  const anchor = 'В тот же день память преподобного Саввы Печерского, подвизав-';
  assert.deepEqual(reviewedMentionForPage('savva-pecherskij', 8, 377, sha, anchor), { book: 8, page: 377 });
  const body = `Конец рассказа.\n${anchor}`;
  assert.equal(body.slice(reviewedBoundary(8, 376, heading, sha, 377, body)), anchor);
  assert.equal(reviewedBoundary(8, 376, heading, 'other-edition', 377, body), undefined);
  assert.notEqual(getSaint('savva-pecherskij')?.id, getSaint('savva-stratilat-rimskij')?.id);
});

test('April twenty-seventh to thirtieth retain joint readings and separate relic dates', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const { reviewedBoundary } = await import('../src/lib/reviewed-book-boundaries');
  const sha = '34cad51db160ddb198289ea09aa9cd1745abb00e2f2eba61e6bb229cdc078e90';
  const heading = 'ПАМЯТЬ\nСВЯТЫХ АПОСТОЛОВ\n\nИАСОНА и СОСИПАТРА\n\nи святой мученицы\n\nКЕРКИРЫ ДЕВЫ';
  for (const id of ['iason-apostol', 'sosipatr-apostol', 'kerkira-deva', 'satornij-kerkirskij', 'iakishol-kerkirskij', 'favstian-kerkirskij', 'iannarij-kerkirskij', 'marsalij-kerkirskij', 'evfrasij-kerkirskij', 'mammij-kerkirskij']) {
    assert.deepEqual(reviewedWorkForPage(id, 8, 427, sha, heading), { book: 8, page: 427, section: 0 });
  }
  const anchor = 'В тот же день память святых мучеников Диодора и Родопиана диа-';
  for (const id of ['diodor-afrodisijskij', 'rodopian-afrodisijskij']) assert.deepEqual(reviewedMentionForPage(id, 8, 441, sha, anchor), { book: 8, page: 441 });
  assert.ok(!venerations.some(v => v.saintId === 'rodopian-afrodisijskij' && v.sourceId === 'pomor-mesjaceslov-2015'));
  const body = `Конец рассказа.\n${anchor}`;
  const memnon = 'ПАМЯТЬ ПРЕПОДОБНОГО ОТЦА НАШЕГО МЕМНОНА ЧУДОТВОРЦА';
  assert.equal(body.slice(reviewedBoundary(8, 441, memnon, sha, 441, body)), anchor);
  for (const id of ['nikita-novgorodskij', 'vasilij-amasijskij']) assert.ok(commemorations.some(c => c.saintId === id && c.traditionId === 'russian-orthodox' && c.label === 'Обретение мощей' && c.rule.kind === 'fixed' && c.rule.month === 4 && c.rule.day === 30));
});

test('May first to third retain family accounts, short memories and sourced dates', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const { reviewedBoundary } = await import('../src/lib/reviewed-book-boundaries');
  const sha = '82b1215c68f31643b8eb01894d4ace63f2ff7a1caf45f8893122a038ba88d8ac';
  const heading = 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ ЕСПЕРА И ЗОИ';
  for (const id of ['esper-attalijskij', 'zoja-s-esperom', 'kiriak-s-esperom', 'feodul-s-esperom']) {
    assert.deepEqual(reviewedWorkForPage(id, 9, 68, sha, heading), { book: 9, page: 68, section: 0 });
    assert.ok(venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'));
  }
  const anchor = 'В тот же день празднуется память священномученика Макария,';
  assert.deepEqual(reviewedMentionForPage('makarij-mitropolit-kievskij', 9, 67, sha, anchor), { book: 9, page: 67 });
  const body = `Конец рассказа.\n${anchor}`;
  assert.equal(body.slice(reviewedBoundary(9, 67, 'СТРАДАНИЕ СВЯТОГО МУЧЕНИКА ВАТЫ', sha, 67, body)), anchor);
  assert.ok(commemorations.some(c => c.saintId === 'afanasij-velikij-aleksandrijskij' && c.traditionId === 'russian-orthodox' && c.rule.kind === 'fixed' && c.rule.month === 5 && c.rule.day === 2));
  assert.ok(commemorations.some(c => c.saintId === 'feodosij-pecherskij' && c.sourceId === 'pomor-mesjaceslov-2015' && c.rule.kind === 'fixed' && c.rule.month === 5 && c.rule.day === 3));
});

test('May fourth to sixth distinguish two Barbari and link the named companions', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '82b1215c68f31643b8eb01894d4ace63f2ff7a1caf45f8893122a038ba88d8ac';
  const heading = 'СТРАДАНИЕ СВЯТОГО МУЧЕНИКА ВАРВАРА ВОИНА';
  for (const id of ['varvar-voin', 'vakh-s-varvarom', 'kallimah-s-varvarom', 'dionisij-s-varvarom']) {
    assert.deepEqual(reviewedWorkForPage(id, 9, 208, sha, heading), { book: 9, page: 208, section: 0 });
  }
  assert.equal(reviewedWorkForPage('varvar-byvshij-razbojnik', 9, 208, sha, heading), undefined);
  assert.notEqual(getSaint('varvar-voin')?.id, getSaint('varvar-byvshij-razbojnik')?.id);
  assert.ok(venerations.some(v => v.saintId === 'varvar-byvshij-razbojnik' && v.sourceId === 'pomor-mesjaceslov-2015'));
  assert.ok(!venerations.some(v => v.saintId === 'varvar-voin' && v.sourceId === 'pomor-mesjaceslov-2015'));
});

test('May seventh to ninth preserve separate sources and links to the book', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '82b1215c68f31643b8eb01894d4ace63f2ff7a1caf45f8893122a038ba88d8ac';
  const heading = 'СТРАДАНИЕ СВЯТОГО МУЧЕНИКА ХРИСТОФОРА';
  for (const id of ['hristofor-muchenik', 'kallinikija-s-hristoforom', 'akilina-s-hristoforom']) assert.deepEqual(reviewedWorkForPage(id, 9, 275, sha, heading), { book: 9, page: 275, section: 0 });
  for (const id of ['kallinikija-s-hristoforom', 'akilina-s-hristoforom']) assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-hristofor-i-sputnicy-maj'));
  assert.ok(commemorations.some(c => c.saintId === 'antonij-pecherskij' && c.sourceId === 'pomor-mesjaceslov-2015' && c.rule.kind === 'fixed' && c.rule.month === 5 && c.rule.day === 7));
  assert.ok(commemorations.some(c => c.saintId === 'nikolaj-mirlikijskij' && c.sourceId === 'pomor-mesjaceslov-2015' && c.label === 'Перенесение мощей' && c.rule.kind === 'fixed' && c.rule.month === 5 && c.rule.day === 9));
});

test('life and works heading separates the shared text of Cyril and Methodius', async () => {
  const { sectionHeadings } = await import('../src/lib/book-sections');
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const body = 'ЖИЗНЬ И ТРУДЫ\nПРЕПОДОБНЫХ ОТЦОВ НАШИХ\n\nМЕФОДИЯ И КОНСТАНТИНА,\n\nв монашестве КИРИЛЛА,\nучителей славянских\n\nТекст рассказа.';
  const sha = '82b1215c68f31643b8eb01894d4ace63f2ff7a1caf45f8893122a038ba88d8ac';
  assert.equal(sectionHeadings(body)[0]?.title, 'ЖИЗНЬ И ТРУДЫ ПРЕПОДОБНЫХ ОТЦОВ НАШИХ МЕФОДИЯ И КОНСТАНТИНА,');
  for (const id of ['kirill-solunskij', 'mefodij-moravskij']) {
    assert.deepEqual(reviewedWorkForPage(id, 9, 306, sha, body), { book: 9, page: 306, section: 0 });
  }
});

test('May short entries stay separate from the adjacent martyr and preserve their sources', async () => {
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const sha = '82b1215c68f31643b8eb01894d4ace63f2ff7a1caf45f8893122a038ba88d8ac';
  const body = 'В тот же день память святого Исидора, Христа ради юродивого,\nРостовского чудотворца.\n\nВ тот же день память преподобного отца нашего Никиты, затвор-\nника Печерского.';
  for (const id of ['isidor-rostovskij-tverdislov', 'nikita-novgorodskij']) {
    assert.deepEqual(reviewedMentionForPage(id, 9, 455, sha, body), { book: 9, page: 455 });
    assert.equal(reviewedMentionForPage(id, 9, 455, 'other-edition', body), undefined);
  }
  assert.equal(reviewedMentionForPage('maksim-muchenik-14maja', 9, 455, sha, body), undefined);
  assert.ok(commemorations.some(c => c.saintId === 'nikita-novgorodskij' && c.sourceId === 'calendar-pamyati-14-maja-kniga-9'));
  assert.ok(!venerations.some(v => v.saintId === 'serapion-sindonit' && v.sourceId === 'pomor-mesjaceslov-2015'));
});

test('May shared accounts keep separate named companions and source-specific dates', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '82b1215c68f31643b8eb01894d4ace63f2ff7a1caf45f8893122a038ba88d8ac';
  for (const id of ['solohon-muchenik', 'pamfamir-s-solohonom', 'pamfalon-s-solohonom']) {
    assert.deepEqual(reviewedWorkForPage(id, 9, 519, sha, 'ПАМЯТЬ СВЯТОГО МУЧЕНИКА СОЛОХОНА'), { book: 9, page: 519, section: 0 });
  }
  for (const id of ['iraklij-afinskij', 'pavlin-afinskij', 'venedim-afinskij']) {
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'pomor-mesjaceslov-2015' && c.rule.kind === 'fixed' && c.rule.month === 5 && c.rule.day === 13));
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-pamyati-18-maja-kniga-9' && c.rule.kind === 'fixed' && c.rule.month === 5 && c.rule.day === 18));
  }
  assert.ok(commemorations.some(c => c.saintId === 'aleksij-moskovskij-mitropolit' && c.sourceId === 'calendar-pamyati-20-maja-kniga-9' && c.label === 'Обретение мощей'));
});

test('May twenty-fourth keeps two neighbouring readings on one page separate', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '82b1215c68f31643b8eb01894d4ace63f2ff7a1caf45f8893122a038ba88d8ac';
  const body = 'СТРАДАНИЕ СВЯТОГО МУЧЕНИКА СЕРАПИОНА\n\nТекст о Серапионе.\n\nПАМЯТЬ ПРЕПОДОБНОГО ОТЦА НАШЕГО НИКИТЫ СТОЛПНИКА,\n\nТекст о Никите.';
  assert.deepEqual(reviewedWorkForPage('serapion-egipetskij-24maja', 9, 667, sha, body), { book: 9, page: 667, section: 0 });
  assert.deepEqual(reviewedWorkForPage('kallinik-s-serapionom', 9, 667, sha, body), { book: 9, page: 667, section: 0 });
  assert.deepEqual(reviewedWorkForPage('nikita-perejaslavskij-stolpnik', 9, 667, sha, body), { book: 9, page: 667, section: 1 });
  assert.ok(commemorations.some(c => c.saintId === 'vasilisk-amasejskij' && c.sourceId === 'calendar-pamyati-22-maja-kniga-9'));
  assert.ok(!venerations.some(v => v.saintId === 'evfrosinija-polockaja' && v.sourceId === 'pomor-mesjaceslov-2015'));
});

test('May Feraponts and short memories retain their own editions and dates', async () => {
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const sha = '82b1215c68f31643b8eb01894d4ace63f2ff7a1caf45f8893122a038ba88d8ac';
  const body = 'В тот же день память святых мучеников Аверкия и Елены, по не-\nкоторым памятникам.\n\nВ тот же день празднуется обретение мощей преподобного Мака-\nрия Калязинского.';
  for (const id of ['averkij-s-elenoj', 'elena-s-averkiem', 'makarij-kaljazinskij']) assert.deepEqual(reviewedMentionForPage(id, 9, 685, sha, body), { book: 9, page: 685 });
  assert.equal(new Set(['ferapont-kiprskij', 'ferapont-sardijskij', 'ferapont-belozerskij'].map(id => getSaint(id)?.id)).size, 3);
  for (const id of ['kiprian-mitropolit-moskovskij', 'fotij-mitropolit-moskovskij', 'iona-mitropolit-moskovskij']) assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-pamyati-27-maja-kniga-9' && c.label === 'Перенесение мощей'));
});

test('end of May separates Theodosias and distinguishes apostle Hermes from the martyr', () => {
  for (const id of ['feodosija-tirskaja', 'feodosija-konstantinopolskaja-29maja']) {
    assert.ok(getSaint(id));
    assert.ok(!venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'));
  }
  assert.notEqual(getSaint('ermij-apostol')?.id, getSaint('ermij-muchenik-31maja')?.id);
  for (const id of ['ermij-apostol', 'ermij-muchenik-31maja']) {
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'pomor-mesjaceslov-2015' && c.rule.kind === 'fixed' && c.rule.month === 5 && c.rule.day === 31));
  }
});

test('June accounts preserve two Justins and the evidence for named companions', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '5d6ad1d1f29953b1f717fcc709ec01032ad6928b642e5b4664378b70284fb152';
  assert.notEqual(getSaint('iustin-filosof-rimskij')?.id, getSaint('iustin-rimskij-s-haritonom')?.id);
  for (const id of ['iustin-rimskij-s-haritonom', 'hariton-s-iustinom', 'harita-s-iustinom']) assert.deepEqual(reviewedWorkForPage(id, 10, 19, sha, 'СТРАДАНИЕ СВЯТОГО МУЧЕНИКА ИУСТИНА'), { book: 10, page: 19, section: 0 });
  assert.ok(!venerations.some(v => v.saintId === 'pavel-otrok-s-lukillianom' && v.sourceId === 'pomor-mesjaceslov-2015'));
  assert.ok(commemorations.some(c => c.saintId === 'nikifor-konstantinopolskij-patriarh' && c.sourceId === 'calendar-pamyati-2-ijunja-kniga-10'));
});

test('June collective readings identify companions and keep calendar evidence scoped', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '5d6ad1d1f29953b1f717fcc709ec01032ad6928b642e5b4664378b70284fb152';
  const heading = 'СТРАДАНИЕ СВЯТЫХ ПРЕПОДОБНОМУЧЕНИЦ АРХЕЛАЙИ, ФЕКЛЫ И СУСАННЫ';
  for (const id of ['arhelaja-s-fekloj', 'fekla-s-arhelaej', 'susanna-s-arhelaej']) {
    assert.deepEqual(reviewedWorkForPage(id, 10, 110, sha, heading), { book: 10, page: 110, section: 0 });
    assert.ok(!venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'));
  }
  for (const id of ['markian-egipetskij', 'nikandr-s-markianom']) assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'pomor-mesjaceslov-2015' && c.rule.kind === 'fixed' && c.rule.month === 6 && c.rule.day === 5));
});

test('June Roman groups and Kushte dates keep persons and sources separate', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '5d6ad1d1f29953b1f717fcc709ec01032ad6928b642e5b4664378b70284fb152';
  assert.notEqual(getSaint('markell-papa-rimskij')?.id, getSaint('markellin-papa-rimskij')?.id);
  for (const id of ['markellin-papa-rimskij', 'klavdij-s-markellinom', 'kirin-s-markellinom', 'antonin-s-markellinom']) assert.deepEqual(reviewedWorkForPage(id, 10, 133, sha, 'ПАМЯТЬ СВЯТОГО СВЯЩЕННОМУЧЕНИКА МАРКЕЛЛИНА'), { book: 10, page: 133, section: 0 });
  for (const [sourceId, day] of [['calendar-pamyati-9-ijunja-kniga-10', 9], ['pomor-mesjaceslov-2015', 10]] as const) assert.ok(commemorations.some(c => c.saintId === 'aleksandr-kushtskij' && c.sourceId === sourceId && c.rule.kind === 'fixed' && c.rule.month === 6 && c.rule.day === day));
});

test('four Oxyrhynchus ascetics retain both readings and separate calendar sources', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '5d6ad1d1f29953b1f717fcc709ec01032ad6928b642e5b4664378b70284fb152';
  const heading = 'ЖИТИЕ ПРЕПОДОБНОГО ОТЦА НАШЕГО ОНУФРИЯ ВЕЛИКОГО';
  for (const id of ['ioann-oksirinfskij', 'andrej-oksirinfskij', 'iraklemon-oksirinfskij', 'feofil-oksirinfskij']) {
    assert.deepEqual(reviewedWorkForPage(id, 10, 221, sha, heading), { book: 10, page: 221, section: 0 });
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-pamyati-12-ijunja-kniga-10'));
    assert.ok(!commemorations.some(c => c.saintId === id && c.sourceId === 'pomor-mesjaceslov-2015' && c.rule.kind === 'fixed' && c.rule.month === 6 && c.rule.day === 12));
  }
});

test('June Dulas and same-page short memories have distinct identities and sources', async () => {
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const sha = '5d6ad1d1f29953b1f717fcc709ec01032ad6928b642e5b4664378b70284fb152';
  assert.notEqual(getSaint('dula-kilikijskij')?.id, getSaint('dula-egipetskij-strastoterpec')?.id);
  const body = 'В тот же день память иже во святых отца нашего Ионы, митропо-\nлита Московского.\n\nВ тот же день перенесение мощей преподобного Феодора Сикео-\nта.';
  for (const id of ['iona-mitropolit-moskovskij', 'feodor-sikeot']) assert.deepEqual(reviewedMentionForPage(id, 10, 367, sha, body), { book: 10, page: 367 });
  assert.ok(venerations.some(v => v.saintId === 'dula-kilikijskij' && v.sourceId === 'pomor-mesjaceslov-2015'));
  assert.ok(!venerations.some(v => v.saintId === 'dula-egipetskij-strastoterpec' && v.sourceId === 'pomor-mesjaceslov-2015'));
});

test('June Tikhons remain distinct and short entries do not become full lives', async () => {
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '5d6ad1d1f29953b1f717fcc709ec01032ad6928b642e5b4664378b70284fb152';
  assert.equal(new Set(['tihon-amafuntskij', 'tihon-medynskij', 'tihon-luhovskij'].map(id => getSaint(id)?.id)).size, 3);
  const body = 'В тот же день память преподобного Тихона Медынского (Калуж-\nского).\n\nПАМЯТЬ ПРЕПОДОБНОГО ОТЦА НАШЕГО ТИХОНА,\n\nТекст.';
  assert.deepEqual(reviewedMentionForPage('tihon-medynskij', 10, 371, sha, body), { book: 10, page: 371 });
  assert.deepEqual(reviewedWorkForPage('tihon-luhovskij', 10, 371, sha, body), { book: 10, page: 371, section: 0 });
  assert.equal(reviewedWorkForPage('tihon-medynskij', 10, 371, sha, body), undefined);
});

test('June translations preserve the three individual saints and scoped Pomor evidence', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '5d6ad1d1f29953b1f717fcc709ec01032ad6928b642e5b4664378b70284fb152';
  const heading = 'ПЕРЕНЕСЕНИЕ МОЩЕЙ СВЯТЫХ МУЧЕНИКОВ ИННЫ, ПИННЫ И РИММЫ';
  for (const id of ['inna-skifskij', 'pinna-skifskij', 'rimma-skifskij']) {
    assert.deepEqual(reviewedWorkForPage(id, 10, 451, sha, heading), { book: 10, page: 451, section: 0 });
    assert.ok(commemorations.some(c => c.saintId === id && c.sourceId === 'calendar-pamyati-20-ijunja-kniga-10' && c.label === 'Перенесение мощей'));
  }
  assert.ok(!venerations.some(v => v.saintId === 'pinna-skifskij' && v.sourceId === 'pomor-mesjaceslov-2015'));
  assert.ok(commemorations.some(c => c.saintId === 'iulian-anazavrskij' && c.sourceId === 'calendar-pamyati-21-ijunja-kniga-10'));
});

test('June short entries include only named people and keep uncertain variants apart', async () => {
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const sha = '5d6ad1d1f29953b1f717fcc709ec01032ad6928b642e5b4664378b70284fb152';
  const body = 'В тот же день память святых мучеников Евстохия, Глия, Урвана и\nпрочих.';
  for (const id of ['evstohij-ankirskij-23ijunja', 'gaij-s-evstohiem-23ijunja', 'urvan-s-evstohiem-23ijunja']) assert.deepEqual(reviewedMentionForPage(id, 10, 489, sha, body), { book: 10, page: 489 });
  for (const id of ['prob-s-evstohiem-23ijunja', 'lollij-s-evstohiem-23ijunja']) assert.equal(reviewedMentionForPage(id, 10, 489, sha, body), undefined);
  assert.ok(!venerations.some(v => v.saintId === 'kiriak-s-orentiem' && v.sourceId === 'pomor-mesjaceslov-2015'));
});

test('Febronia companions can be sourced only to the Pomor calendar without inferred recognition', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = '5d6ad1d1f29953b1f717fcc709ec01032ad6928b642e5b4664378b70284fb152';
  const heading = 'ЖИТИЕ и СТРАДАНИЕ СВЯТОЙ ПРЕПОДОБНОМУЧЕНИЦЫ ФЕВРОНИИ';
  for (const id of ['vrienna-s-fevroniej', 'ierija-s-fevroniej', 'fomaida-s-fevroniej']) {
    assert.ok(getSaint(id));
    assert.deepEqual(reviewedWorkForPage(id, 10, 503, sha, heading), { book: 10, page: 503, section: 0 });
    assert.ok(venerations.some(v => v.saintId === id && v.sourceId === 'pomor-mesjaceslov-2015'));
    assert.ok(!venerations.some(v => v.saintId === id && v.traditionId === 'russian-orthodox'));
  }
});

test('apostle headings with punctuation and the printed synaxis preserve source scope', async () => {
  const { sectionHeadings } = await import('../src/lib/book-sections');
  const { reviewedMentionForPage } = await import('../src/lib/reviewed-book-mentions');
  const sha = '5d6ad1d1f29953b1f717fcc709ec01032ad6928b642e5b4664378b70284fb152';
  const body = 'ЖИТИЕ, ПОДВИГИ и СТРАДАНИЕ\n\nСВЯТОГО СЛАВНОГО и ВСЕХВАЛЬНОГО\nВЕРХОВНОГО АПОСТОЛА\n\nПЕТРА\n\nТекст.';
  assert.equal(sectionHeadings(body)[0]?.title, 'ЖИТИЕ, ПОДВИГИ и СТРАДАНИЕ СВЯТОГО СЛАВНОГО и ВСЕХВАЛЬНОГО ВЕРХОВНОГО АПОСТОЛА ПЕТРА');
  const synod = 'Собор святых славных и всехвальных двенадцати апостолов: Петра\nи других.';
  assert.deepEqual(reviewedMentionForPage('petr-apostol-pervoverhovnyj', 10, 638, sha, synod), { book: 10, page: 638 });
  assert.equal(reviewedMentionForPage('pavel-apostol-pervoverhovnyj', 10, 638, sha, synod), undefined);
  assert.ok(commemorations.some(c => c.saintId === 'pavel-apostol-pervoverhovnyj' && c.sourceId === 'calendar-pamyati-30-ijunja-kniga-10'));
});

test('July Roman physicians and Mokius companions preserve shared readings and distinct people', async () => {
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const sha = 'b36fd4ff7ec4ba22854e5f55c566d0f4e7661394995e9586e207f42e8f4876df';
  for (const id of ['kosma-rimskij-bessrebrenik', 'damian-rimskij-bessrebrenik']) assert.deepEqual(reviewedWorkForPage(id, 11, 7, sha, 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ КОСМЫ И ДАМИАНА'), { book: 11, page: 7, section: 0 });
  for (const id of ['mokij-s-markom-3ijulja', 'mark-s-mokiem-3ijulja']) assert.deepEqual(reviewedWorkForPage(id, 11, 64, sha, 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ МОКИЯ И МАРКА'), { book: 11, page: 64, section: 0 });
  assert.notEqual(getSaint('mokij-s-markom-3ijulja')?.id, getSaint('mokij-amfipolskij')?.id);
});

test('church foundation heading is a separate section without treating prose as a title', async () => {
  const { sectionHeadings } = await import('../src/lib/book-sections');
  const text = 'ДЕНЬ ЧЕТЫРНАДЦАТЫЙ\n\nО СОЗДАНИИ\nЦЕРКВИ ЧЕСТНОГО УСПЕНИЯ\n\nПРЕСВЯТОЙ БОГОРОДИЦЫ\n\nв Киево-Печерской обители\n\nНикто не должен сомневаться.';
  assert.equal(sectionHeadings(text)[0].title, 'О СОЗДАНИИ ЦЕРКВИ ЧЕСТНОГО УСПЕНИЯ ПРЕСВЯТОЙ БОГОРОДИЦЫ');
  assert.equal(sectionHeadings('О создании церкви говорится в следующем рассказе.').length, 0);
});

test('Dormition and image translation titles preserve their display lines', async () => {
  const { sectionHeadings } = await import('../src/lib/book-sections');
  assert.equal(sectionHeadings('УСПЕНИЕ\nПРЕСВЯТОЙ ВЛАДЫЧИЦЫ НАШЕЙ\n\nБОГОРОДИЦЫ и ПРИСНОДЕВЫ МАРИИ\n\nПо совершении...')[0].title, 'УСПЕНИЕ ПРЕСВЯТОЙ ВЛАДЫЧИЦЫ НАШЕЙ БОГОРОДИЦЫ и ПРИСНОДЕВЫ МАРИИ');
  assert.equal(sectionHeadings('ПЕРЕНЕСЕНИЕ\n\nиз Эдессы в Константинополь\nНЕРУКОТВОРНОГО ОБРАЗА\n\nГОСПОДА НАШЕГО ИИСУСА ХРИСТА\n\nВо дни...')[0].title, 'ПЕРЕНЕСЕНИЕ из Эдессы в Константинополь НЕРУКОТВОРНОГО ОБРАЗА ГОСПОДА НАШЕГО ИИСУСА ХРИСТА');
  assert.equal(sectionHeadings('Успение описано в следующей главе.').length, 0);
});


test('August patriarchs preserve the book and calendar disagreement about John', async () => {
  const { reviewedWorkLocations } = await import('../src/lib/reviewed-book-works');
  const cappadocian = getSaint('ioann-kappadokijec');
  const faster = getSaint('ioann-postnik-konstantinopolskij');
  assert.ok(cappadocian && faster);
  assert.equal(cappadocian.sourceId, 'local-rostov');
  assert.equal(faster.sourceId, 'calendar-pamyati-30-avgusta-kniga-12');
  assert.ok(reviewedWorkLocations(cappadocian.id).some(w => w.book === 12 && w.page === 481));
  assert.ok(!reviewedWorkLocations(faster.id).some(w => w.book === 12 && w.page === 481));
  assert.ok(!venerations.some(v => v.saintId === cappadocian.id && v.traditionId === 'old-believer'));
  assert.ok(venerations.some(v => v.saintId === faster.id && v.sourceId === 'pomor-mesjaceslov-2015'));
  assert.ok(commemorations.some(c => c.saintId === cappadocian.id && c.sourceId === 'local-rostov' && matchesCommemoration(c, { year: 2026, month: 9, day: 12 })));
});


test('every catalog person has a unique identifier across all book collections', () => {
  const ids = saints.map(saint => saint.id);
  assert.equal(new Set(ids).size, ids.length);
});


test('reviewed works do not repeat the same section of the same edition', async () => {
  const { default: data } = await import('../src/data/reviewed-book-work-links.json');
  const keys = data.works.map(work => JSON.stringify([work.book, work.page, work.sourceSha256, work.expectedHeading]));
  assert.equal(new Set(keys).size, keys.length);
});

test('conception heading separates the two Annas without treating prose as a heading', async () => {
  const { sectionHeadings } = await import('../src/lib/book-sections');
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const heading = 'ЗАЧАТИЕ СВЯТОЙ БОГОПРАМАТЕРИ АННЫ,';
  const body = 'ДЕНЬ ДЕВЯТЫЙ\n\nЗАЧАТИЕ\nСВЯТОЙ БОГОПРАМАТЕРИ\n\nАННЫ,\n\nкогда зачала святую Богородицу\nТекст.';
  assert.deepEqual(sectionHeadings(body).map(h => h.title), [heading]);
  assert.equal(sectionHeadings('Зачатие святой Анны празднуется в декабре.').length, 0);
  assert.equal(sectionHeadings('Зачатие святой Анны 245').length, 0);
  const sha = '147b1c3fe520c621b8d87d79025adff2be4f1815241296722e51639dc90b36fe';
  assert.deepEqual(reviewedWorkForPage('anna-bogomatereva', 4, 247, sha, body), { book: 4, page: 247, section: 0 });
  assert.equal(reviewedWorkForPage('anna-prorochica-mat-samuila', 4, 247, sha, body), undefined);
});


test('baptism display heading exposes its own reading without splitting prose or running headers', async () => {
  const { sectionHeadings } = await import('../src/lib/book-sections');
  const { reviewedWorkForPage } = await import('../src/lib/reviewed-book-works');
  const body = 'ДЕНЬ ШЕСТОЙ\n\nКРЕЩЕНИЕ ГОСПОДНЕ\n\nГосподь наш Иисус Христос.\n\nСЛОВО\nНА БОГОЯВЛЕНИЕ ГОСПОДНЕ\n\nТекст.';
  const headings = sectionHeadings(body);
  assert.deepEqual(headings.map(h => h.title), ['КРЕЩЕНИЕ ГОСПОДНЕ', 'СЛОВО НА БОГОЯВЛЕНИЕ ГОСПОДНЕ']);
  assert.equal(headings[0].offset, body.indexOf('КРЕЩЕНИЕ'));
  assert.equal(sectionHeadings('Крещение Господне 189').length, 0);
  assert.equal(sectionHeadings('Крещение происходит в реке Иордане.').length, 0);
  const sha = 'e62ed1051709261e1b21d03eac3e74d8475e1f77e28c5a56d2faf2b0390e242f';
  assert.deepEqual(reviewedWorkForPage('ioann-predtecha', 5, 190, sha, body), { book: 5, page: 190, section: 0 });
  assert.equal(reviewedWorkForPage('ioann-predtecha', 5, 190, 'changed-edition', body), undefined);
});


test('Sinai massacre accounts have separate headings without matching running headers', async () => {
  const { sectionHeadings } = await import('../src/lib/book-sections');
  for (const ordinal of ['ПЕРВОЕ', 'ВТОРОЕ']) {
    const title = `${ordinal} ИЗБИЕНИЕ`;
    const body = `Конец предыдущего рассказа.\n\n${title}\nПРЕПОДОБНЫХ ОТЦОВ\n\nв Синае и Раифе\n\nНачало рассказа.`;
    assert.deepEqual(sectionHeadings(body), [{ offset: body.indexOf(title), title: `${title} ПРЕПОДОБНЫХ ОТЦОВ` }]);
    assert.deepEqual(sectionHeadings(`${title} ПРЕПОДОБНЫХ ОТЦОВ 401`), []);
    assert.deepEqual(sectionHeadings(`${title}\nОбычное предложение.`), []);
  }
  assert.deepEqual(sectionHeadings('Второе избиение преподобных отцов 401'), []);
  assert.deepEqual(sectionHeadings('Первое избиение совершено было в четвертом веке.'), []);
});


test('Peter chains display title is separate from prose and running headers', async () => {
  const { sectionHeadings } = await import('../src/lib/book-sections');
  const body = 'ДЕНЬ ШЕСТНАДЦАТЫЙ\n\nПОКЛОНЕНИЕ ЧЕСТНЫМ ВЕРИГАМ\nСВЯТОГО АПОСТОЛА ПЕТРА\n\nТекст.';
  assert.deepEqual(sectionHeadings(body), [{ offset: body.indexOf('ПОКЛОНЕНИЕ'), title: 'ПОКЛОНЕНИЕ ЧЕСТНЫМ ВЕРИГАМ СВЯТОГО АПОСТОЛА ПЕТРА' }]);
  for (const text of ['Поклонение честным веригам апостола Петра 459', 'Поклонение честным веригам совершается в январе.', 'ПОКЛОНЕНИЕ ЧЕСТНЫМ ВЕРИГАМ\nОбычная проза.', 'ПОКЛОНЕНИЕ ЧЕСТНЫМ ВЕРИГАМ СВЯТОГО АПОСТОЛА ПЕТРА 459']) {
    assert.deepEqual(sectionHeadings(text), []);
  }
});
