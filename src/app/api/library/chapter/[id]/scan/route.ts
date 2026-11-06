import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chapter } from '@/lib/book-db';
import { sourcePdf } from '@/lib/source-archive';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const run = promisify(execFile);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9-]+$/.test(id)) return new Response('Not found', { status: 404 });
  const item = chapter(id);
  const range = item?.source_path.toLowerCase().endsWith('.pdf') ? item.locator.match(/^страницы PDF (\d+)-(\d+)$/u) : null;
  const raw = new URL(request.url).searchParams.get('page') ?? '';
  if (!item || !range || !/^\d+$/.test(raw)) return new Response('Not found', { status: 404 });
  const page = Number(raw), first = Number(range[1]), last = Number(range[2]);
  if (!Number.isSafeInteger(page) || page < first || page > last || page > 10000) return new Response('Not found', { status: 404 });
  try {
    const source = await sourcePdf(item.source_path, item.source_sha256, item.book_id === 'kids-saints' ? 'kids-saints.pdf' : undefined);
    if (!source) throw new Error('Source missing or checksum mismatch');
    const { stdout } = await run('pdftoppm', ['-f', String(page), '-l', String(page), '-scale-to', '1800', '-jpeg', '-singlefile', source], { encoding: 'buffer', maxBuffer: 15 * 1024 * 1024, timeout: 30000 });
    return new Response(new Uint8Array(stdout), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' } });
  } catch {
    return new Response('Не удалось открыть скан. Проверьте исходную книгу, её контрольную сумму и Poppler.', { status: 503 });
  }
}
