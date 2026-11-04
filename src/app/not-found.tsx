import Link from 'next/link';
export default function NotFound() { return <div className="shell empty-state not-found"><span className="eyebrow">СТРАНИЦА НЕ НАЙДЕНА</span><h1>Этот лист пока пуст.</h1><p>Возможно, ссылка изменилась. Попробуйте найти имя в каталоге.</p><Link className="button" href="/saints">Вернуться к святым</Link></div>; }
