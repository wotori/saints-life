/** Reflow page lines for display; the original stored OCR remains untouched. */
export function formatOcrParagraph(text: string, joinHyphenated: boolean): string {
  const unix = text.replace(/\r\n?/g, '\n');
  const joined = joinHyphenated ? unix.replace(/(?<=[А-Яа-яЁё])-[ \t]*\n[ \t]*(?=[а-яё])/gu, '') : unix;
  return joined.replace(/\n[ \t]*/g, ' ');
}
