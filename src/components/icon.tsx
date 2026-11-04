type IconName = 'search' | 'arrow' | 'book' | 'calendar' | 'source' | 'chevron-left' | 'chevron-right' | 'bookmark' | 'check' | 'external' | 'sun' | 'moon' | 'close';
const paths: Record<IconName, React.ReactNode> = {
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
  arrow: <><path d="M4 12h15m-6-6 6 6-6 6"/></>,
  book: <><path d="M12 5v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z"/><path d="M6 8h3m6 0h3M6 12h3m6 0h3"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h1m6 0h1m-8 4h1"/></>,
  source: <><path d="m3 8 9-5 9 5M3 21h18M5 10v8m7-8v8m7-8v8M2 8h20"/></>,
  'chevron-left': <path d="m15 5-7 7 7 7"/>,
  'chevron-right': <path d="m9 5 7 7-7 7"/>,
  bookmark: <path d="M6 3h12v18l-6-4-6 4Z"/>,
  check: <path d="m5 12 4 4 10-10"/>,
  external: <><path d="M14 3h7v7m0-7L10 14M10 4H4v16h16v-6"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/></>,
  moon: <path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
};
export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>;
}

export function Rosette({ className = '' }: { className?: string }) {
  return <svg className={className} width="42" height="42" viewBox="0 0 60 60" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="1.1"><circle cx="30" cy="30" r="23"/><circle cx="30" cy="30" r="18"/>{Array.from({ length: 8 }, (_, i) => <ellipse key={i} cx="30" cy="21" rx="5" ry="12" transform={`rotate(${i * 45} 30 30)`}/>)}<circle cx="30" cy="30" r="3" fill="currentColor"/></g></svg>;
}
