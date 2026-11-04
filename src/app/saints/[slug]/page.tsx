import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Reader } from '@/components/reader';
import { Icon } from '@/components/icon';
import { convertDate, formatDate, isoDate, today } from '@/lib/calendar';
import { getEdition, getSaint, getSource, getWork, saints, saintReadings, saintVenerations, saintCommemorations, traditions } from '@/lib/repository';

export function generateStaticParams() { return saints.map(s => ({ slug: s.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const saint = getSaint((await params).slug);
  return { title: saint?.name ?? 'Запись не найдена', description: saint?.intro };
}
export default async function SaintPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ text?: string }> }) {
  const { slug } = await params;
  const saint = getSaint(slug);
  if (!saint) notFound();
  const available = saintReadings(saint.id);
  const { text } = await searchParams;
  const selected = available.find(r => r.id === text) ?? available[0];
  const edition = selected ? getEdition(selected.editionId) : null;
  const claims = saintVenerations(saint.id);
  const feasts = saintCommemorations(saint.id);
  const fixed = feasts.filter(c => c.rule.kind === 'fixed');
  const uniqueFeasts = fixed.filter((c, i) => fixed.findIndex(other => JSON.stringify(other.rule) === JSON.stringify(c.rule) && other.label === c.label) === i);
  const unresolved = feasts.filter(c => c.rule.kind === 'unresolved');
  const year = today().year;
  return <div className="shell saint-page"><Link href="/saints" className="back-link"><Icon name="chevron-left" size={14}/> Каталог святых</Link><div className="saint-heading"><div className="saint-seal" aria-hidden="true">{saint.name.charAt(0)}<span>✥</span></div><div><div className="eyebrow">{saint.rank}</div><h1>{saint.name}</h1><p className="saint-heading-meta">{saint.lifespan}{saint.place ? ` · ${saint.place}` : ''}</p><p className="saint-heading-intro">{saint.intro ?? 'В начальной подборке сохранены имя и сведения месяцеслова. Жизнеописание пока не подготовлено.'}</p></div></div>
    <div className="saint-layout"><aside className="saint-sidebar"><section className="sidebar-block"><div className="eyebrow">ДНИ ПАМЯТИ · {year}</div>{uniqueFeasts.length ? uniqueFeasts.map(item => {
      if (item.rule.kind !== 'fixed') return null;
      const original = { year, month: item.rule.month, day: item.rule.day };
      const civil = convertDate(original, item.rule.calendar, 'gregorian');
      return <Link key={item.id} href={`/calendar?date=${isoDate(civil)}&tradition=${item.traditionId}`} className="feast-link"><strong>{formatDate(civil)}</strong><span>{formatDate(original)} ст. ст.</span><small>{item.label}</small><Icon name="arrow" size={16}/></Link>;
    }) : <p className="small-muted">Фиксированная дата в указателе не установлена.</p>}{unresolved.length > 0 && <details className="movable-details"><summary>Переходящие памяти ({unresolved.length})</summary><ul>{unresolved.map(c => <li key={c.id}>{c.label}</li>)}</ul><p>Правила дат ещё не сверены, эти памяти не показаны в сетке календаря.</p></details>}</section><section className="sidebar-block"><div className="eyebrow">СВИДЕТЕЛЬСТВА ПОЧИТАНИЯ</div>{claims.map(claim => <div className="veneration-claim" key={claim.traditionId}><span className={`tradition-dot ${claim.traditionId === 'old-believer' ? 'gold' : ''}`}/><strong>{traditions.find(t => t.id === claim.traditionId)?.label}</strong><p>{claim.note}</p><a href={getSource(claim.sourceId).url} target="_blank" rel="noreferrer">Проверить источник ↗</a></div>)}<p className="small-muted">Отсутствие другой традиции означает отсутствие добавленного свидетельства.</p></section><section className="sidebar-block"><div className="eyebrow">ЗАПИСЬ В КАТАЛОГЕ</div><a className="source-citation" href={getSource(saint.sourceId).url} target="_blank" rel="noreferrer">{getSource(saint.sourceId).publisher}<Icon name="external" size={15}/></a><p className="small-muted">{saint.sourceLocator}</p></section></aside><div className="saint-reading-column">{selected && edition ? <><nav className="reading-tabs" aria-label="Версии текста">{available.map(r => <Link key={r.id} href={`/saints/${slug}?text=${r.id}`} className={selected.id === r.id ? 'active' : ''} aria-current={selected.id === r.id ? 'page' : undefined}>{r.title}{r.mode === 'external' && <span aria-label="на сайте издателя"> ↗</span>}</Link>)}</nav><Reader key={selected.id} reading={selected} edition={edition} work={getWork(edition.workId)} sources={edition.sourceIds.map(getSource)}/></> : <div className="empty-state reading-placeholder"><Icon name="book" size={36}/><h2>Жизнеописание ещё не добавлено</h2><p>Карточка сохранена, чтобы имя и подтверждённые дни памяти уже можно было найти. Полный текст и его издание требуют отдельной подготовки.</p><a className="button" href={getSource(saint.sourceId).url} target="_blank" rel="noreferrer">Открыть запись в источнике <Icon name="external" size={16}/></a></div>}</div></div>
  </div>;
}
