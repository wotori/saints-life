/** Show the checked values first, keeping uncertain OCR clearly labelled. */
export function printedIndexReference(entry: { reviewStatus: 'reviewed' | 'unreviewed'; printedDay?: number; printedPage?: number; sourceLine: string; recoveredNumbers?: boolean }): string {
  if (entry.reviewStatus === 'reviewed') {
    return `${entry.printedDay ? `день ${entry.printedDay}` : 'день не указан'}${entry.printedPage ? ` · печатная страница ${entry.printedPage}` : ''} · сверено с указателем`;
  }
  if (entry.recoveredNumbers && entry.printedDay && entry.printedPage) {
    return `день ${entry.printedDay} · печатная страница ${entry.printedPage} · восстановлено автоматически`;
  }
  return `распознавание: ${entry.sourceLine} · не проверено`;
}

/** Keep a tentative page reference and carry the indexed name as a search hint. */
export function printedIndexTextHref(entry: { book: number; title: string; pdfPage?: number; workPage?: number; workSection?: number }): string | undefined {
  if (!entry.pdfPage) return undefined;
  if (entry.workSection !== undefined) return `/library/book/${entry.book}/${entry.workPage ?? entry.pdfPage}/work/${entry.workSection}`;
  const name = entry.title.split(/[\s*]+/u)[0];
  return `/library/book/${entry.book}/${entry.pdfPage}?${new URLSearchParams({ focus: name })}`;
}
