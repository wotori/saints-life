import records from '@/data/collective-memories.json';
import { sectionHeadings } from '@/lib/book-sections';

export { records as collectiveMemories };
export type CollectiveMemory = typeof records[number];
export type CollectiveReading = CollectiveMemory & { href: string };

export function collectiveReading(record: CollectiveMemory, sourceSha256: string, body: string): CollectiveReading | undefined {
  if (record.sourceSha256 !== sourceSha256 || !record.anchor) return undefined;
  const offset = body.indexOf(record.anchor);
  if (offset < 0 || body.indexOf(record.anchor, offset + 1) !== -1) return undefined;
  const base = `/library/book/${record.book}/${record.page}`;
  if (!record.heading) return { ...record, href: base };
  const sections = sectionHeadings(body).map((heading, section) => ({ heading, section })).filter(item => item.heading.title === record.heading);
  return sections.length === 1 ? { ...record, href: `${base}/work/${sections[0].section}` } : undefined;
}
