import 'server-only';
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { archiveRoot } from '@/lib/source-archive';
import { matchesSearch } from '@/lib/search-terms';
import { childrenChapterLinks } from '@/data/kids-saints';

const dbPath = process.env.SAINTS_LIBRARY_DB ?? path.join(archiveRoot(), 'library.sqlite3');
export type Chapter = { id: string; book_id: string; title: string; locator: string; position: number; body: string; book_title: string; publisher: string; year: string; rights: string; source_path: string; source_sha256: string };
export function chapters(query = ''): Pick<Chapter, 'id' | 'book_id' | 'title' | 'locator' | 'book_title' | 'publisher' | 'year'>[] {
  if (!existsSync(/*turbopackIgnore: true*/ dbPath)) return [];
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try { return (db.prepare("SELECT c.id,c.book_id,c.title,c.locator,b.title AS book_title,b.publisher,b.year FROM chapters c JOIN books b ON b.id=c.book_id WHERE COALESCE(b.rights,'') NOT LIKE 'Ознакомительный%' ORDER BY b.title,c.position").all() as Pick<Chapter, 'id' | 'book_id' | 'title' | 'locator' | 'book_title' | 'publisher' | 'year'>[]).filter(row => matchesSearch(row.title, query)); }
  finally { db.close(); }
}
export function chapter(id: string): Chapter | undefined {
  if (!existsSync(/*turbopackIgnore: true*/ dbPath)) return undefined;
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try { return db.prepare("SELECT c.*, b.title AS book_title, b.publisher, b.year, b.rights,b.source_path,b.sha256 AS source_sha256 FROM chapters c JOIN books b ON b.id=c.book_id WHERE c.id=? AND COALESCE(b.rights,'') NOT LIKE 'Ознакомительный%'").get(id) as Chapter | undefined; }
  finally { db.close(); }
}

export function chapterForSaint(saintId: string): Chapter | undefined {
  const link = childrenChapterLinks[saintId];
  if (!link) return undefined;
  const entry = chapter(link.id);
  return entry?.title === link.title ? entry : undefined;
}
