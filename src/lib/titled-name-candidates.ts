/** Literal search hints, not an exhaustive name extractor or evidence of sainthood. */
export function titledNameCandidates(body: string) {
  return scanTitledNameCandidates(body).candidates;
}

/** Exclusions remain inspectable; filtering a hint is not an identity decision. */
export function scanTitledNameCandidates(body: string) {
  const martyr = '(?:[Мм]учени|[Сс]вященномучени|[Пп]реподобномучени)(?:к(?:а|у|ом|е)?|ц(?:а|ы|е|у|ей|ею))';
  const title = `(?:[Сс]вят(?:ой|ая|ое|ого|ому|ым|ом|ую)|[Пп]реподобн(?:ый|ая|ого|ому|ым|ом|ую|ой)|[Бб]лаженн(?:ый|ая|ого|ому|ым|ом|ую|ой)|[Пп]раведн(?:ый|ая|ого|ому|ым|ом|ую|ой)|[Сс]вятител(?:ь|я|ю|ем|е)|${martyr}|[Ии]споведни(?:к(?:а|у|ом|е)?|ц(?:а|ы|е|у|ей|ею)))`;
  const rank = '(?:(?:авва|аввы|папа|папы|папе|дева|девы|деве|мученик|мученика|мученику|мученица|мученицы|епископ|епископа|пресвитер|пресвитера|диакон|диакона|князь|князя)\\s+){0,2}';
  const modifier = '(?:[Хх]ристов(?:а|о|ы|у|ой|ою|ом|ым|ых|ого|ому|ыми)?|[Бб]ож(?:ий|ия|ие|ии|ию|ией|иею|ием|иим|иих|ияго|иего|иему|иими|ья|ье|ьи|ью|ьей|ьего|ьему|ьим|ьих|ьими))';
  const pattern = new RegExp(`(?<![\\p{L}\\p{M}])${title}\\s+${rank}(?:(?<modifier>${modifier})\\s+)?(?<name>[А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?)(?![\\p{L}\\p{M}-])`, 'gu');
  const modifierOnly = new RegExp(`^${modifier}$`, 'u');
  const excluded = /^(?:Бог(?:а|у|ом)?|Господ(?:ь|а|у|ом)|Христ(?:ос|а|у|ом|е)|Дух(?:а|у|ом|е)?|Троиц[а-я]*|Ангел[а-я]*|Евангели[а-я]*|Писани[а-я]*)$/u;
  const liturgicalTerms = new Set([
    'Церковь', 'Церкви', 'Церковью',
    'Крест', 'Креста', 'Кресту', 'Крестом', 'Кресте',
    'Пасха', 'Пасхи', 'Пасхе', 'Пасху', 'Пасхой',
    'Четыредесятница', 'Четыредесятницы', 'Четыредесятнице', 'Четыредесятницу', 'Четыредесятницей',
    'Пятидесятница', 'Пятидесятницы', 'Пятидесятнице', 'Пятидесятницу', 'Пятидесятницей',
    'Евхаристия', 'Евхаристии', 'Евхаристию', 'Евхаристией',
    'Причастие', 'Причастия', 'Причастию', 'Причастием', 'Причастии',
    'Причащение', 'Причащения', 'Причащению', 'Причащением', 'Причащении',
    'Синод', 'Синода', 'Синоду', 'Синодом', 'Синоде',
  ]);
  const codepointOffsets = new Map<number, number>();
  let utf16 = 0, codepoint = 0;
  for (const char of body) { codepointOffsets.set(utf16, codepoint++); utf16 += char.length; }
  const found = new Map<string, Set<number>>();
  const suppressed = new Map<string, Set<number>>();
  const add = (target: Map<string, Set<number>>, text: string, start: number) => {
    if (!target.has(text)) target.set(text, new Set());
    target.get(text)!.add(codepointOffsets.get(start)!);
  };
  for (const match of body.matchAll(pattern)) {
    const candidate = match.groups!.name;
    const start = match.index + match[0].length - candidate.length;
    const qualifier = match.groups!.modifier;
    if (qualifier) add(suppressed, qualifier, match.index + match[0].lastIndexOf(qualifier));
    const target = excluded.test(candidate) || modifierOnly.test(candidate) || liturgicalTerms.has(candidate) ? suppressed : found;
    add(target, candidate, start);
  }
  const records = (items: Map<string, Set<number>>) => [...items].map(([candidate, offsets]) => ({ candidate, offsets: [...offsets].sort((a, b) => a - b) }));
  return { candidates: records(found), excludedTerms: records(suppressed) };
}
