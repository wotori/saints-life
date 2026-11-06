import Link from 'next/link';
import { notFound } from 'next/navigation';
import { chapters } from '@/lib/book-db';
export const dynamic = 'force-dynamic';

export default async function Collection({ params }: { params: Promise<{ book: string }> }) {
  const { book } = await params;
  if (!/^[a-z0-9-]+$/.test(book)) notFound();
  const entries = chapters().filter(chapter => chapter.book_id === book);
  if (!entries.length) notFound();
  const first = entries[0];
  return <div className="shell sources-page"><Link className="back-link" href="/library">‹ Все книги</Link><div className="page-intro"><div className="eyebrow">ОГЛАВЛЕНИЕ</div><h1>{first.book_title}</h1><p>{first.publisher} · {first.year}</p></div><p className="coverage-note">Разделов: {entries.length}. Сведения об издании и точный номер страницы приведены в каждой главе.</p><div className="sources-list">{entries.map((item,i) => <article className="source-row" key={item.id}><span className="source-number">{String(i+1).padStart(2,'0')}</span><div><h2><Link href={`/library/${item.id}`}>{item.title} ↗</Link></h2><p className="source-publisher">{item.locator}</p></div></article>)}</div></div>;
}
