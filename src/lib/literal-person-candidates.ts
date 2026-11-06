type Person = { name: string; aliases: readonly string[] };

/** Finds catalogue spellings only. A match is never an identity decision. */
export function literalPersonMatcher(people: readonly Person[]) {
  const patterns = new Map<string, RegExp>();
  for (const person of people) for (const name of [person.name, ...person.aliases]) {
    const words = name.match(/[\p{L}\p{M}]+/gu) ?? [];
    if (words.length < 2) continue;
    const normalized = name.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('ru').replace(/ё/g, 'е');
    if (!normalized || patterns.has(normalized)) continue;
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/е/g, '[её]').replace(/ /g, '\\s+');
    patterns.set(normalized, new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])${escaped}(?![\\p{L}\\p{M}\\p{N}_])`, 'giu'));
  }
  return {
    spellings: patterns.size,
    find(body: string) {
      const offsets = new Map<number, number>();
      let utf16 = 0, codepoint = 0;
      for (const char of body) { offsets.set(utf16, codepoint++); utf16 += char.length; }
      const matches = new Map<string, Set<number>>();
      for (const pattern of patterns.values()) {
        pattern.lastIndex = 0;
        for (const match of body.matchAll(pattern)) {
          const offset = offsets.get(match.index)!;
          if (!matches.has(match[0])) matches.set(match[0], new Set());
          matches.get(match[0])!.add(offset);
        }
      }
      return [...matches].map(([candidate, found]) => ({ candidate, offsets: [...found].sort((a, b) => a - b) }));
    },
  };
}
