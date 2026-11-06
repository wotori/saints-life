/** Checks catalogue references, not the historical identity of a person. */
export function reviewedSaintLinkErrors(
  records: readonly { book: number; page: number; saintIds: readonly string[] }[],
  knownSaintIds: ReadonlySet<string>,
  label: string,
): string[] {
  return records.flatMap(record => {
    const location = `${label}: ${record.book}/${record.page}`;
    const errors: string[] = [];
    if (!record.saintIds.length) errors.push(`Empty saint links: ${location}`);
    const seen = new Set<string>();
    for (const id of record.saintIds) {
      if (!knownSaintIds.has(id)) errors.push(`Unknown saint ${JSON.stringify(id)}: ${location}`);
      if (seen.has(id)) errors.push(`Duplicate saint ${JSON.stringify(id)}: ${location}`);
      seen.add(id);
    }
    return errors;
  });
}
