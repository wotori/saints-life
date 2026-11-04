import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { SaintCard } from '@/components/saint-card';
import { saints, searchSaints, traditions } from '@/lib/repository';

export const metadata: Metadata = { title: 'Каталог святых' };
type Params = { q?: string; tradition?: string; rank?: string; reading?: string; page?: string };
export default async function SaintsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const filters = { q: typeof params.q === 'string' ? params.q.slice(0, 200) : '', tradition: traditions.some(t => t.id === params.tradition) ? params.tradition ?? '' : '', rank: typeof params.rank === 'string' ? params.rank : '', reading: params.reading === 'yes' ? 'yes' : '' };
  const result = searchSaints(filters);
  const pages = Math.max(1, Math.ceil(result.length / 12));
  const page = Math.max(1, Math.min(pages, Number.parseInt(params.page ?? '1', 10) || 1));
  const ranks = [...new Set(saints.map(s => s.rank.split(',')[0]))].sort((a, b) => a.localeCompare(b, 'ru'));
  const pageHref = (number: number) => `/saints?${new URLSearchParams({ ...filters, page: String(number) })}`;
  return <div className="shell catalog-page"><div className="page-intro"><div className="eyebrow">ЛЮДИ, ИМЕНА, ИСТОРИИ</div><h1>Святые</h1><p>Найдите имя. Познакомьтесь с жизнью. Обратитесь к источнику.</p></div>
    <form action="/saints" key={JSON.stringify(filters)} className="catalog-filters"><div className="search-box"><Icon name="search"/><input type="search" aria-label="Поиск святых" name="q" defaultValue={filters.q} placeholder="Имя, место или слово из наименования"/><button type="submit" aria-label="Искать"><Icon name="arrow"/></button></div><div className="filter-selects"><label>Традиция<select aria-label="Традиция" name="tradition" defaultValue={filters.tradition}><option value="">Все традиции</option>{traditions.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label><label>Лик святости<select aria-label="Лик святости" name="rank" defaultValue={filters.rank}><option value="">Все лики</option>{ranks.map(r => <option key={r}>{r}</option>)}</select></label><label>Тексты<select aria-label="Тексты" name="reading" defaultValue={filters.reading}><option value="">Все записи</option><option value="yes">Есть чтение на сайте</option></select></label><button className="button filter-apply" type="submit">Применить</button></div></form>
    <div className="results-bar"><p aria-live="polite">Найдено записей: <strong>{result.length}</strong>{filters.q ? <> по запросу «{filters.q}»</> : ''}</p><Link href="/saints" className="text-link">Сбросить фильтры <Icon name="close" size={14}/></Link></div>
    {result.length ? <div className="saint-grid">{result.slice((page - 1) * 12, page * 12).map(s => <SaintCard key={s.id} saint={s}/>)}</div> : <div className="empty-state"><Icon name="search" size={32}/><h2>Пока не нашли это имя</h2><p>Библиотека начинается с Димитриев и примера старообрядческого почитания Аввакума. Попробуйте изменить запрос или убрать фильтры.</p><Link className="button" href="/saints">Показать все записи</Link></div>}
    {pages > 1 && <nav className="pagination" aria-label="Страницы каталога">{Array.from({ length: pages }, (_, i) => <Link href={pageHref(i + 1)} key={i} className={page === i + 1 ? 'selected' : ''} aria-current={page === i + 1 ? 'page' : undefined}>{i + 1}</Link>)}</nav>}
    <p className="coverage-note">В основе подборки 68 записей из месяцеслова «Азбуки веры» и отдельная карточка протопопа Аввакума. Отметка традиции означает наличие указанного свидетельства. Отсутствие отметки означает, что свидетельство ещё не добавлено.</p>
  </div>;
}
