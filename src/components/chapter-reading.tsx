import type { Chapter } from '@/lib/book-db';
import { BookReader } from '@/components/book-reader';

export function ChapterReading({ item }: { item: Chapter }) {
  const pageRange = item.source_path.toLowerCase().endsWith('.pdf') ? item.locator.match(/^страницы PDF (\d+)-(\d+)$/u) : null;
  return <><BookReader id={`chapter-${item.id}`} label="Текст из предоставленной книги" paragraphs={item.body.split(/\n\s*\n/).filter(Boolean)}/><p className="coverage-note">Источник: {item.book_title}; {item.publisher}, {item.year}. Раздел: {item.locator}. {item.rights}</p>{pageRange && <form action={`/api/library/chapter/${item.id}/scan`} target="_blank" className="page-jump-form"><label>Страница оригинала <input name="page" type="number" min={pageRange[1]} max={pageRange[2]} defaultValue={pageRange[1]}/></label><button type="submit">Открыть скан ↗</button></form>}</>;
}
