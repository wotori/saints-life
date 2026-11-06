import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { printedPageInfo } from '@/lib/ocr-db';
export default async function Jump({ params, searchParams }: { params: Promise<{ book: string }>; searchParams: Promise<{ page?: string; printed?: string }> }) {
  const { book } = await params;
  const { page = '1', printed } = await searchParams;
  if (!/^\d+$/.test(book) || !Number.isSafeInteger(Number(book))) notFound();
  if (printed !== undefined) {
    const info = printedPageInfo(Number(book));
    if (typeof printed === 'string' && /^\d+$/.test(printed) && Number.isSafeInteger(Number(printed)) && Number(printed) >= 1 && info && Number(printed) <= info.maxPrintedPage) redirect(`/library/book/${book}/${Number(printed) + info.offset}?fromPrinted=${Number(printed)}`);
    return <article className="shell about-page"><h1>Не удалось открыть страницу</h1><p>Проверьте номер печатной страницы или перейдите к книге и выберите страницу PDF.</p><Link href={`/library/book/${Number(book)}/1`}>Открыть книгу →</Link></article>;
  }
  if (typeof page !== 'string' || !/^\d+$/.test(page)) notFound();
  redirect(`/library/book/${book}/${page}`);
}
