import type { Metadata } from 'next';
import Link from 'next/link';
import { Navigation } from '@/components/navigation';
import { Rosette } from '@/components/icon';
import './globals.css';

export const metadata: Metadata = { title: { default: 'Жития святых | Saints Life', template: '%s | Saints Life' }, description: 'Святые, их жития и дни памяти. Читайте и сравнивайте источники православной и старообрядческой традиций.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru" data-scroll-behavior="smooth"><body><a className="skip-link" href="#main">К содержанию</a><Navigation/><main id="main">{children}</main><footer className="site-footer"><div className="footer-inner"><div className="footer-brand"><Rosette/><span>Жития святых<small>История человека. История веры.</small></span></div><div><Link href="/about">О библиотеке</Link><Link href="/sources">Наши источники</Link></div><p>Исследовательский прототип · 2026<br/>Каждый текст имеет свой источник.</p></div></footer></body></html>;
}
