/** Search hints only: generated forms never establish identity or replace source text. */
export function nameInflectionSuggestions(name: string): string[] {
  const first = name.normalize('NFC').toLocaleLowerCase('ru').replace(/ё/g, 'е').split(/[\s,]+/u)[0];
  if (!/^[а-я]+$/u.test(first)) return [];
  const irregular: Record<string, string[]> = {
    павел: ['павла', 'павлу', 'павлом', 'павле'],
    лев: ['льва', 'льву', 'львом', 'льве'],
  };
  if (irregular[first]) return irregular[first];
  for (const [ending, suffixes] of [
    ['ий', ['ия', 'ию', 'ием', 'ии']],
    ['ия', ['ии', 'ию', 'ией', 'иею']],
    ['ей', ['ея', 'ею', 'еем', 'ее']],
    ['й', ['я', 'ю', 'ем', 'е']],
    ['я', ['и', 'е', 'ю', 'ей', 'ею']],
  ] as const) {
    if (first.endsWith(ending)) return suffixes.map(suffix => first.slice(0, -ending.length) + suffix);
  }
  if (first.endsWith('а')) {
    const stem = first.slice(0, -1);
    return [/[гкхжчшщ]$/u.test(stem) ? 'и' : 'ы', 'е', 'у', 'ой', 'ою'].map(suffix => stem + suffix);
  }
  if (/[бвгджзклмнпрстфхцчшщ]$/u.test(first)) return ['а', 'у', 'ом', 'е'].map(suffix => first + suffix);
  return [];
}
