import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sources } from '../src/data/library';

const destination = resolve(process.cwd(), '../staints-life-sources');
mkdirSync(destination, { recursive: true });
writeFileSync(resolve(destination, 'catalog.json'), `${JSON.stringify({ project: 'Saints Life', createdAt: '2026-11-04', sources }, null, 2)}\n`);
console.log(`Exported ${sources.length} source descriptions to ${destination}`);
