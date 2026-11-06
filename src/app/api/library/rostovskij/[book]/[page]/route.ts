import { GET as genericGet } from '@/app/api/library/book/[book]/[page]/route';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ book: string; page: string }> }) {
  const params = await context.params;
  if (!/^\d+$/.test(params.book) || Number(params.book) > 12) return new Response('Not found', { status: 404 });
  return genericGet(request, { params: Promise.resolve(params) });
}
