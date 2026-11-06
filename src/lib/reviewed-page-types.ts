import reviews from '@/data/reviewed-page-types.json';

export type ReviewedPageType = 'cover' | 'illustration';

/** A review applies only to the exact edition and an unchanged, textless OCR page. */
export function reviewedPageType(book: number, sourceSha: string, page: number, status: string | null, body: string | null): ReviewedPageType | undefined {
  if (status !== 'ok' || (body ?? '').trim()) return undefined;
  const source = reviews.books.find(item => item.book === book && item.sourceSha256 === sourceSha);
  const kind = source?.pages.find(item => item.page === page)?.kind;
  return kind === 'cover' || kind === 'illustration' ? kind : undefined;
}
