import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ocrPage } from '@/lib/ocr-db';
import { sourcePdf } from '@/lib/source-archive';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const run = promisify(execFile);

export async function GET(_request: Request, { params }: { params: Promise<{ book: string; page: string }> }) {
  const values = await params;
  if (!/^\d+$/.test(values.book) || !/^\d+$/.test(values.page)) return new Response('Not found', { status: 404 });
  const book = Number(values.book), page = Number(values.page);
  if (!Number.isSafeInteger(book) || !Number.isSafeInteger(page) || book < 1 || book > 13 || page < 1 || page > 10000) return new Response('Not found', { status: 404 });
  const item = ocrPage(book, page);
  if (!item || page > item.pages) return new Response('Not found', { status: 404 });
  try {
    const name = book === 13 ? 'ioann-shanghai-2014.pdf' : `rostovskij-${String(book).padStart(2, '0')}.pdf`;
    const source = await sourcePdf(item.source_path, item.source_sha256, name);
    if (!source) throw new Error('Source missing or checksum mismatch');
    const { stdout } = await run('pdftoppm', ['-f', String(page), '-l', String(page), '-scale-to', '1800', '-jpeg', '-singlefile', source], { encoding: 'buffer', maxBuffer: 15 * 1024 * 1024, timeout: 30000 });
    return new Response(new Uint8Array(stdout), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' } });
  } catch {
    return new Response('Не удалось открыть скан. Проверьте исходную книгу, её контрольную сумму и Poppler.', { status: 503 });
  }
}
