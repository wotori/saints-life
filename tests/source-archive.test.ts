import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sourcePdf } from '../src/lib/source-archive';

test('archive lookup recovers moved sources but refuses a different edition', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'saints-source-'));
  const oldRoot = process.env.SAINTS_SOURCES_DIR;
  process.env.SAINTS_SOURCES_DIR = root;
  try {
    const dir = path.join(root, 'originals', 'user-books');
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, 'rostovskij-01.pdf');
    await writeFile(file, 'edition one');
    const sha = createHash('sha256').update('edition one').digest('hex');
    assert.equal(await sourcePdf('/missing/book.pdf', sha, 'rostovskij-01.pdf'), file);
    assert.equal(await sourcePdf(file, sha), file);
    assert.equal(await sourcePdf('/missing/book.pdf', sha, '../rostovskij-01.pdf'), undefined);
    await writeFile(file, 'another edition');
    assert.equal(await sourcePdf('/missing/book.pdf', sha, 'rostovskij-01.pdf'), undefined);
    assert.equal(await sourcePdf(file, sha), undefined);
    assert.equal(await sourcePdf(file, 'invalid'), undefined);
  } finally {
    if (oldRoot === undefined) delete process.env.SAINTS_SOURCES_DIR;
    else process.env.SAINTS_SOURCES_DIR = oldRoot;
    await rm(root, { recursive: true, force: true });
  }
});
