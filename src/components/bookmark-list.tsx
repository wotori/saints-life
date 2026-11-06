'use client';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { bookmarksSnapshot, legacyBookmark, setBookmark, subscribeBookmarks, type Bookmark } from '@/lib/bookmarks';

const serverSnapshot = () => '[]';

type StoredBookmark = { id: string; title?: string; href?: string };
export function BookmarkList({ legacyReadings }: { legacyReadings: Record<string, Omit<Bookmark, 'id'>> }) {
  const raw = useSyncExternalStore(subscribeBookmarks, bookmarksSnapshot, serverSnapshot);
  const [error, setError] = useState(false);
  const saved = JSON.parse(raw) as StoredBookmark[];
  const entries = saved.map(item => ({ id: item.id, ...(item.title && item.href ? { title: item.title, href: item.href } : legacyReadings[item.id] ?? legacyBookmark(item.id)) }));
  function remove(id: string) {
    try { setBookmark(id, false, ''); setError(false); }
    catch { setError(true); }
  }
  return <section aria-labelledby="saved-readings"><div className="section-heading"><div><div className="eyebrow">ПРОДОЛЖИТЬ ЧТЕНИЕ</div><h2 id="saved-readings">Мои закладки</h2><p>Сохраняются в этом браузере.</p></div></div>
    {error && <p role="status">Не удалось изменить закладку. Проверьте доступ к хранилищу браузера.</p>}
    {entries.length ? <div className="sources-list">{entries.map(item => <article className="source-row" key={item.id}><div><h3>{item.href ? <Link href={item.href}>{item.title} ↗</Link> : 'Старая закладка без адреса'}</h3>{!item.href && <p>Откройте этот текст и сохраните закладку заново, чтобы добавить ссылку.</p>}<button type="button" onClick={() => remove(item.id)} aria-label={`Удалить закладку: ${item.title ?? item.id}`}>Удалить</button></div></article>)}</div> : <p>Пока нет закладок. Сохраните любую страницу во время чтения.</p>}
  </section>;
}
