import { redirect, notFound } from 'next/navigation';
export default async function LegacyPage({ params }: { params: Promise<{ book: string; page: string }> }) {
  const { book, page } = await params;
  if (!/^\d+$/.test(book) || !/^\d+$/.test(page) || Number(book) > 12) notFound();
  redirect(`/library/book/${book}/${page}`);
}
