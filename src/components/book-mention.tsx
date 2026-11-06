import Link from 'next/link';
import { scannedBookMetadata } from '@/lib/book-metadata';

export function BookMention({ book, page, name }: { book: number; page: number; name: string }) {
  const query = new URLSearchParams({ focus: name.split(/[\s,]+/u)[0] });
  return <div className="calendar-saint"><div>
    <h3><Link href={`/library/book/${book}/${page}?${query}`}>Открыть страницу книги {book} ↗</Link></h3>
    <p>{scannedBookMetadata(book).citation} · страница PDF {page} · <a href={`/api/library/book/${book}/${page}`} target="_blank" rel="noreferrer">скан страницы ↗</a></p>
  </div></div>;
}
