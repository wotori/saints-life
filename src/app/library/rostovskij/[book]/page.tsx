import { redirect, notFound } from 'next/navigation';
export default async function Jump({ params, searchParams }: { params: Promise<{ book: string }>; searchParams: Promise<{ page?: string }> }) {
  const { book } = await params;
  const { page = '1' } = await searchParams;
  if (!/^\d+$/.test(book) || !/^\d+$/.test(page)) notFound();
  redirect(`/library/rostovskij/${book}/${page}`);
}
