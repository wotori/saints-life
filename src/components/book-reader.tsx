'use client';
import { useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { Icon } from '@/components/icon';
import { isBookmarked, setBookmark, subscribeBookmarks } from '@/lib/bookmarks';
import { formatOcrParagraph } from '@/lib/ocr-format';
import { matchesSearch, searchVariants } from '@/lib/search-terms';
import type { ReviewedPageType } from '@/lib/reviewed-page-types';

export type ReaderPage = { page: number; paragraphs: string[]; scanUrl: string; status: string | null; reviewedType?: ReviewedPageType };

export function BookReader({ paragraphs, pages, id, label, ocrReflow = false, emptyScan, focus = '' }: { paragraphs?: string[]; pages?: ReaderPage[]; id: string; label: string; ocrReflow?: boolean; emptyScan?: { url: string; page: number; reviewedType?: ReviewedPageType }; focus?: string }) {
  const [fontSize, setFontSize] = useState(20);
  const [dark, setDark] = useState(false);
  const [joinHyphenated, setJoinHyphenated] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const focusTerms = searchVariants(focus);
  const canFocus = focusTerms.length > 0 && focusTerms.every(variants => variants.some(term => term.length >= 3));
  const highlighted = canFocus ? (paragraphs ?? []).map((paragraph, i) => matchesSearch(formatOcrParagraph(paragraph, true), focus) ? i : -1).filter(i => i >= 0) : [];
  const saved = useSyncExternalStore(subscribeBookmarks, () => isBookmarked(id), () => false);
  function toggleBookmark() {
    try { setBookmark(id, !saved, document.querySelector('h1')?.textContent?.trim() || label); }
    catch { setStorageError(true); }
  }
  return <div className={`reader ${dark ? 'reader-dark' : ''}`}>
    <div className="reader-toolbar"><div className="reader-type"><Icon name="book" size={17}/>{label}</div><div className="reader-controls"><button disabled={fontSize <= 16} onClick={() => setFontSize(s => s - 2)} aria-label="Уменьшить шрифт">А−</button><span aria-label="Размер шрифта">{fontSize}</span><button disabled={fontSize >= 28} onClick={() => setFontSize(s => s + 2)} aria-label="Увеличить шрифт">А+</button><span className="toolbar-divider"/><button onClick={() => setDark(value => !value)} aria-label={dark ? 'Светлая тема чтения' : 'Тёмная тема чтения'}><Icon name={dark ? 'sun' : 'moon'} size={18}/></button><button onClick={toggleBookmark} aria-label={saved ? 'Удалить закладку' : 'Сохранить закладку'} aria-pressed={saved} className={saved ? 'bookmarked' : ''}><Icon name={saved ? 'check' : 'bookmark'} size={18}/></button></div></div>
    {ocrReflow && <div className="ocr-reflow-control"><button type="button" aria-pressed={joinHyphenated} onClick={() => setJoinHyphenated(value => !value)}>Объединять переносы слов: {joinHyphenated ? 'включено' : 'выключено'}</button>{joinHyphenated && <span>Некоторые дефисы могут быть частью слова. Сверяйте со сканом.</span>}</div>}
    {focus && <p className="storage-note">{highlighted.length ? <>Возможные совпадения для «{focus}» выделены в тексте. <a href="#found-on-page">Перейти к первому →</a> Имя может относиться к другому человеку; сверьте со сканом.</> : <>Не удалось найти «{focus}» в распознанном тексте страницы. Сверьте страницу со сканом: имя может быть распознано с ошибкой или находиться рядом.</>}</p>}
    {storageError && <p role="status" className="storage-note">Браузер не разрешил сохранить закладку.</p>}
    {saved && <p role="status" className="storage-note">Закладка сохранена в этом браузере. Вернуться к тексту можно в разделе «Книги».</p>}
    <div className="reading-body" style={{ fontSize: `${fontSize}px` }}>{pages ? pages.map(page => <section key={page.page} className="continuous-page" id={`page-${page.page}`}><div className="continuous-page-heading"><h2>Страница PDF {page.page}</h2><a href={page.scanUrl} target="_blank" rel="noreferrer">Открыть скан ↗</a></div>{page.status !== 'ok' ? <p>Страница ещё не распознана. Её можно прочитать на скане.</p> : page.paragraphs.length ? page.paragraphs.map((p, i) => <p key={i}>{ocrReflow ? formatOcrParagraph(p, joinHyphenated) : p}</p>) : <EmptyScan url={page.scanUrl} page={page.page} reviewedType={page.reviewedType}/>}</section>) : <section>{paragraphs?.length ? paragraphs.map((p, i) => <p key={i} id={highlighted[0] === i ? 'found-on-page' : undefined} className={highlighted.includes(i) ? 'ocr-focus' : undefined}>{ocrReflow ? formatOcrParagraph(p, joinHyphenated) : p}</p>) : emptyScan ? <EmptyScan {...emptyScan}/> : <p>На этой странице распознанный текст отсутствует. Проверьте скан.</p>}</section>}</div>
  </div>;
}

function EmptyScan({ url, page, reviewedType }: { url: string; page: number; reviewedType?: ReviewedPageType }) {
  return <figure className="empty-scan"><Image src={url} alt={`Скан страницы PDF ${page}`} width={720} height={1024} unoptimized/><figcaption>{reviewedType === 'cover' ? 'Обложка издания.' : reviewedType === 'illustration' ? 'Иллюстрация издания. Подписи на изображении могли не распознаться.' : 'Текст на странице не распознан. Показан скан источника.'}</figcaption></figure>;
}
