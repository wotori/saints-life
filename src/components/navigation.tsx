'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Rosette } from '@/components/icon';

export function Navigation() {
  const path = usePathname();
  return <header className="site-header"><div className="header-inner">
    <Link href="/" className="brand" aria-label="Saints Life, главная"><Rosette/><span>Жития<span className="brand-sub">SAINTS LIFE</span></span></Link>
    <nav aria-label="Основная навигация">{[['/', 'Главная'], ['/saints', 'Святые'], ['/calendar', 'Календарь'], ['/sources', 'Источники']].map(([href, label]) => <Link key={href} href={href} className={(href === '/' ? path === href : path.startsWith(href)) ? 'active' : ''} aria-current={(href === '/' ? path === href : path.startsWith(href)) ? 'page' : undefined}>{label}</Link>)}</nav>
    <Link href="/about" className="header-about">О библиотеке <span>↗</span></Link>
  </div></header>;
}
