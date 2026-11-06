import type { Metadata } from 'next';
import { CalendarBrowser } from '@/components/calendar-browser';
import { commemorations, saints, traditions } from '@/lib/repository';
import { parseDate, today } from '@/lib/calendar';
import { printedIndexHits } from '@/lib/book-index-db';
import { ocrBookDays, collectiveBookReadings } from '@/lib/ocr-db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Календарь дней памяти' };
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string; style?: string; tradition?: string }> }) {
  const params = await searchParams;
  const todayDate = today();
  const initialDate = parseDate(params.date) ?? todayDate;
  const initialStyle = params.style === 'julian' ? 'julian' : 'gregorian';
  const initialTradition = traditions.some(t => t.id === params.tradition) ? params.tradition! : '';
  const printedEntries = printedIndexHits('', { allowEmpty: true, limit: 10000 }).filter(entry => entry.julianMonth && entry.calendarDay);
  return <div className="shell calendar-page"><div className="page-intro"><div className="eyebrow">ВРЕМЯ ХРАНИТ ИМЕНА</div><h1>Календарь памяти</h1><p>Выберите день, чтобы встретиться с его историей.</p></div><CalendarBrowser key={`${params.date}-${params.style}-${params.tradition}`} initialDate={initialDate} initialStyle={initialStyle} initialTradition={initialTradition} todayDate={todayDate} saints={saints} commemorations={commemorations} printedEntries={printedEntries} bookDays={ocrBookDays()} collectiveReadings={collectiveBookReadings()}/></div>;
}
