import Link from 'next/link';
import type { Saint } from '@/domain/types';
import { Icon } from '@/components/icon';
import { primaryFeast, saintReadings, saintVenerations } from '@/lib/repository';

export function SaintCard({ saint }: { saint: Saint }) {
  const hasReading = saintReadings(saint.id).some(r => r.mode === 'summary');
  const shared = saintVenerations(saint.id).length > 1;
  return <Link href={`/saints/${saint.slug}`} className={`saint-card ${saint.id === 'avvakum-petrov' ? 'old-believer-card' : ''}`}>
    <div className="card-top"><span className="card-rank">{saint.rank.split(',')[0]}</span><Icon name="arrow" size={18}/></div>
    <div className="card-monogram" aria-hidden="true">{saint.name.charAt(0)}<span>✧</span></div>
    <h3>{saint.name}</h3>
    <p className="saint-era">{saint.lifespan ?? 'Запись в месяцеслове'}{saint.place ? ` · ${saint.place}` : ''}</p>
    <p className="saint-intro">{saint.intro ?? 'Имя и дни памяти сверены по указателю. Подробное жизнеописание ещё не добавлено.'}</p>
    <div className="card-bottom"><span><Icon name="calendar" size={15}/>{primaryFeast(saint.id)}</span><span>{hasReading ? 'Читать' : 'Карточка'} <span aria-hidden="true">↗</span></span></div>
    {shared && <span className="shared-label">Две традиции почитания</span>}
  </Link>;
}
