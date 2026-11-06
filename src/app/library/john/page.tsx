import Link from 'next/link';
import { johnChapters } from '@/data/john-chapters';
import { johnContentsPages } from '@/lib/book-index-db';
import { ocrPage } from '@/lib/ocr-db';
import { scannedBookMetadata } from '@/lib/book-metadata';

export const dynamic = 'force-dynamic';

export default async function JohnContents({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.slice(0, 100).trim().toLocaleLowerCase('ru').replaceAll('ё', 'е') : '';
  const book = ocrPage(13, 1);
  const contents = johnContentsPages().map(page => ({ ...page, lines: page.body.split('\n').filter(line => !query || line.toLocaleLowerCase('ru').replaceAll('ё', 'е').includes(query)) })).filter(page => !query || page.lines.length);
  const chapters = (book && book.pages >= 255 ? johnChapters : []).filter(chapter => !query || chapter.title.toLocaleLowerCase('ru').replaceAll('ё', 'е').includes(query));
  return <div className="shell sources-page"><Link className="back-link" href="/library">‹ Все книги</Link><div className="page-intro"><div className="eyebrow">КНИГА О СВЯТИТЕЛЕ ИОАННЕ</div><h1>Владыка Иоанн - святитель русского зарубежья</h1><p>{scannedBookMetadata(13).publisher}</p></div>
    <form action="/library/john" className="search-box"><input name="q" aria-label="Поиск в содержании книги" placeholder="Название или слово" defaultValue={query}/><button type="submit" aria-label="Найти">→</button></form>
    {!book && <p className="coverage-note">Исходная книга пока недоступна в локальной библиотеке.</p>}
    <section><div className="section-heading"><div><div className="eyebrow">ЧАСТЬ I</div><h2>Жизнеописание</h2><p>17 глав, начала сверены со страницами PDF.</p></div></div><div className="sources-list">{chapters.map(chapter => <article className="source-row" key={chapter.number}><span className="source-number">{chapter.number}</span><div><h2><Link href={`/library/john/${chapter.number}`}>{chapter.title} ↗</Link></h2><p>Страницы PDF {chapter.first}-{chapter.last}</p></div></article>)}</div>{!chapters.length && <p>По запросу глав жизнеописания не найдено.</p>}</section>
    <section><div className="section-heading"><div><div className="eyebrow">ВСЁ ИЗДАНИЕ</div><h2>Печатное содержание</h2><p>Автоматическое распознавание может содержать ошибки; сверьте со сканом.</p></div></div>{contents.map(page => <details className="toc-page" key={page.page} open={Boolean(query)}><summary>Страница содержания PDF {page.page} · <a href={`/api/library/book/13/${page.page}`} target="_blank" rel="noreferrer">скан ↗</a></summary><pre>{page.lines.join('\n')}</pre></details>)}{!contents.length && <p>Совпадений в распознанном содержании пока нет.</p>}<p className="coverage-note">{scannedBookMetadata(13).citation} {scannedBookMetadata(13).rights}</p><Link href="/library/book/13/1" className="button">Открыть книгу по страницам →</Link></section>
  </div>;
}
