export type Bookmark = { id: string; title: string; href: string };
const keyPrefix = 'saints-bookmark:';
const infoPrefix = 'saints-bookmark-info:';

export function subscribeBookmarks(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener('saints-storage', callback);
  return () => { window.removeEventListener('storage', callback); window.removeEventListener('saints-storage', callback); };
}

export function isBookmarked(id: string): boolean {
  try { return localStorage.getItem(keyPrefix + id) === 'true'; } catch { return false; }
}

/** Keep the original flag so older saved bookmarks remain compatible. */
export function setBookmark(id: string, saved: boolean, title: string, page?: string): void {
  const key = keyPrefix + id, info = infoPrefix + id;
  if (saved) {
    const href = page ?? window.location.pathname + window.location.search;
    if (!localPath(href)) throw new Error('Invalid bookmark path');
    localStorage.setItem(info, JSON.stringify({ title, href }));
    localStorage.setItem(key, 'true');
  } else {
    localStorage.removeItem(key);
    localStorage.removeItem(info);
  }
  window.dispatchEvent(new Event('saints-storage'));
}

function localPath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/[\\\u0000-\u001f]/u.test(value);
}

/** Return a stable string for useSyncExternalStore; ignore damaged or foreign URLs. */
export function bookmarksSnapshot(): string {
  try {
    const items: { id: string; title?: string; href?: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(keyPrefix) || localStorage.getItem(key) !== 'true') continue;
      const id = key.slice(keyPrefix.length);
      if (!id) continue;
      let info: { title?: unknown; href?: unknown } = {};
      try { info = JSON.parse(localStorage.getItem(infoPrefix + id) ?? '{}') ?? {}; } catch { /* Older flags have no metadata. */ }
      if (typeof info.title === 'string' && localPath(info.href)) items.push({ id, title: info.title.slice(0, 300), href: info.href });
      else items.push({ id });
    }
    return JSON.stringify(items.sort((a, b) => a.id.localeCompare(b.id)));
  } catch { return '[]'; }
}

/** Some old entries encode their original page in their identifier. */
export function legacyBookmark(id: string): Omit<Bookmark, 'id'> | undefined {
  let match = /^scan-(\d+)-(\d+)$/.exec(id);
  if (match) return { title: `Книга ${match[1]}, страница ${match[2]}`, href: `/library/book/${match[1]}/${match[2]}` };
  match = /^scan-range-(\d+)-(\d+)$/.exec(id);
  if (match) return { title: `Книга ${match[1]}, чтение со страницы ${match[2]}`, href: `/library/book/${match[1]}/${match[2]}/continuous` };
  match = /^day-(\d+)-(\d+)-(\d+)$/.exec(id);
  if (match) return { title: `Книга ${match[1]}, день со страницы ${match[2]}`, href: `/library/book/${match[1]}/${match[2]}/day${match[2] === match[3] ? '' : `?from=${match[3]}`}` };
  match = /^work-(\d+)-(\d+)-(\d+)(?:-(\d+))?$/.exec(id);
  if (match) return { title: `Книга ${match[1]}, раздел на странице ${match[2]}`, href: `/library/book/${match[1]}/${match[2]}/work/${match[3]}${match[4] ? `?from=${match[4]}` : ''}` };
  match = /^john-chapter-(\d+)$/.exec(id);
  if (match) return { title: `Владыка Иоанн, глава ${match[1]}`, href: `/library/john/${match[1]}` };
  match = /^chapter-([a-zA-Z0-9_-]+)$/.exec(id);
  if (match) return { title: 'Глава книги', href: `/library/${match[1]}` };
  return undefined;
}
