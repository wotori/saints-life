import Link from 'next/link';
import { notFound } from 'next/navigation';
import { chapter } from '@/lib/book-db';
import { ChapterReading } from '@/components/chapter-reading';
export const dynamic = 'force-dynamic';
export default async function BookChapter({ params }: { params: Promise<{ id: string }> }) {
  const item = chapter((await params).id); if (!item) notFound();
  return <article className="shell about-page"><Link className="back-link" href={`/library/collection/${item.book_id}`}>‹ Оглавление</Link><div className="page-intro"><div className="eyebrow">ТЕКСТ ИЗ КНИГИ · ЛОКАЛЬНАЯ БИБЛИОТЕКА</div><h1>{item.title}</h1><p>{item.book_title} · {item.publisher} · {item.year}</p></div><ChapterReading item={item}/></article>;
}
