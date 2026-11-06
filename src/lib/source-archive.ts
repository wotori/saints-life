import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

export function archiveRoot(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.SAINTS_SOURCES_DIR ?? path.resolve(process.cwd(), '../staints-life-sources'));
}

const verified = new Map<string, Promise<boolean>>();

async function matchesSource(file: string, expected: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(expected)) return false;
  try {
    const info = await stat(/*turbopackIgnore: true*/ file);
    if (!info.isFile()) return false;
    const key = JSON.stringify([file, info.size, info.mtimeMs, info.ctimeMs, expected]);
    let result = verified.get(key);
    if (!result) {
      result = (async () => {
        const hash = createHash('sha256');
        for await (const chunk of createReadStream(/*turbopackIgnore: true*/ file)) hash.update(chunk);
        return hash.digest('hex') === expected.toLowerCase();
      })().catch(() => false);
      verified.set(key, result);
    }
    return await result;
  } catch { return false; }
}

/** Resolve only the known archive name, and never substitute a different edition. */
export async function sourcePdf(original: string, sha256: string, archiveName?: string): Promise<string | undefined> {
  const candidates = [original];
  if (archiveName && /^[a-z0-9-]+\.pdf$/.test(archiveName)) {
    candidates.push(path.join(archiveRoot(), 'originals', 'user-books', archiveName));
  }
  for (const file of new Set(candidates)) if (await matchesSource(file, sha256)) return file;
  return undefined;
}
