'use client';
import { useState, useSyncExternalStore } from 'react';
import type { Edition, Reading, Source, Work } from '@/domain/types';
import { Icon } from '@/components/icon';

const subscribe = (callback: () => void) => { window.addEventListener('storage', callback); window.addEventListener('saints-storage', callback); return () => { window.removeEventListener('storage', callback); window.removeEventListener('saints-storage', callback); }; };
const serverSnapshot = () => false;

export function Reader({ reading, edition, work, sources }: { reading: Reading; edition: Edition; work: Work; sources: Source[] }) {
  const [fontSize, setFontSize] = useState(20);
  const [dark, setDark] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const saved = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(`saints-bookmark:${reading.id}`) === 'true'; } catch { return false; } }, serverSnapshot);
  function toggleBookmark() {
    try { localStorage.setItem(`saints-bookmark:${reading.id}`, String(!saved)); window.dispatchEvent(new Event('saints-storage')); }
    catch { setStorageError(true); }
  }
  const words = reading.sections.flatMap(s => s.paragraphs).join(' ').split(/\s+/).length;
  return <div className={`reader ${dark ? 'reader-dark' : ''}`}>
    <div className="reader-toolbar"><div className="reader-type"><Icon name="book" size={17}/>{reading.mode === 'summary' ? `Редакционное изложение · ${Math.max(1, Math.ceil(words / 180))} мин чтения` : 'Внешняя публикация'}</div><div className="reader-controls"><button disabled={fontSize <= 16} onClick={() => setFontSize(s => s - 2)} aria-label="Уменьшить шрифт">А−</button><span aria-label="Размер шрифта">{fontSize}</span><button disabled={fontSize >= 28} onClick={() => setFontSize(s => s + 2)} aria-label="Увеличить шрифт">А+</button><span className="toolbar-divider"/><button onClick={() => setDark(d => !d)} aria-label={dark ? 'Светлая тема чтения' : 'Тёмная тема чтения'}><Icon name={dark ? 'sun' : 'moon'} size={18}/></button><button onClick={toggleBookmark} aria-label={saved ? 'Удалить закладку' : 'Сохранить закладку'} aria-pressed={saved} className={saved ? 'bookmarked' : ''}><Icon name={saved ? 'check' : 'bookmark'} size={18}/></button></div></div>
    {storageError && <p role="status" className="storage-note">Браузер не разрешил сохранить закладку.</p>}
    {saved && <p role="status" className="storage-note">Закладка сохранена в этом браузере. Этот текст можно открыть по той же ссылке.</p>}
    <div className="reading-body" style={{ fontSize: `${fontSize}px` }}><div className="eyebrow">{work.kind === 'editorial' ? 'ДЛЯ ПЕРВОГО ЗНАКОМСТВА' : work.kind === 'article' ? 'СТАТЬЯ' : 'БИБЛИОТЕКА ЖИТИЙ'}</div><h2>{work.title}</h2><p className="reading-byline">{work.author} · {edition.language}</p>
      {reading.mode === 'summary' ? <>{reading.sections.map((section, i) => <section key={section.title} id={`chapter-${i}`}><h3>{section.title}</h3>{section.paragraphs.map((p, j) => <p key={j}>{p}</p>)}</section>)}<div className="reading-end" aria-hidden="true">✥</div></> : <div className="external-reading"><Icon name="source" size={36}/><h3>Читать в издании источника</h3><p>Полный текст этой публикации находится у издателя. Здесь сохранено описание, чтобы можно было отличить автора произведения от издателя и конкретной версии текста.</p><p>{edition.note}</p><a className="button" href={sources[0].url} target="_blank" rel="noreferrer">Открыть полный текст <Icon name="external" size={16}/></a></div>}
    </div>
    <div className="reader-provenance"><div className="eyebrow">О ТЕКСТЕ, КОТОРЫЙ ВЫ ЧИТАЕТЕ</div><p>{edition.note}</p><dl><div><dt>Автор</dt><dd>{work.author}</dd></div><div><dt>Публикация</dt><dd>{edition.publication}</dd></div><div><dt>Издатель</dt><dd>{edition.publisher}</dd></div><div><dt>Доступ</dt><dd>{edition.rights === 'original-editorial' ? 'Собственное редакционное изложение' : 'Полный текст у издателя'}</dd></div></dl><div className="reader-source-links">{sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer"><span>{source.publisher}: {source.title}<small>Дата обращения: {source.accessedAt}</small></span><Icon name="external" size={16}/></a>)}</div></div>
  </div>;
}
