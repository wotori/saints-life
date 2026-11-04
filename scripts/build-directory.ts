import { readFileSync, writeFileSync } from 'node:fs';
import { convertDate } from '../src/lib/calendar';
import type { Commemoration, Saint, Veneration } from '../src/domain/types';

const input = readFileSync(new URL('../src/data/dimitri-directory.tsv', import.meta.url), 'utf8');
const saints: Saint[] = [];
const commemorations: Commemoration[] = [];
const venerations: Veneration[] = [];
for (const row of input.split('\n').filter(row => row && !row.startsWith('#'))) {
  const [key, name, rank, fixed, movable] = row.split('|');
  if (!key || !name || !rank || movable === undefined) throw new Error(`Invalid directory row: ${row}`);
  const id = `dimitrij-${key}`;
  saints.push({ id, slug: id, name, rank, aliases: [name.replace('Димитрий', 'Дмитрий')], sourceId: 'azbyka-directory', sourceLocator: `${name}; ${rank}; ${fixed || 'индивидуальная дата не указана'}` });
  venerations.push({ saintId: id, traditionId: 'russian-orthodox', sourceId: 'azbyka-directory', note: 'Запись в православном месяцеслове «Азбуки веры». Не заменяет документ о канонизации.' });
  for (const [index, entry] of fixed.split(';').filter(Boolean).entries()) {
    const [date, label = 'День памяти'] = entry.split(':');
    const [month, day] = date.split('-').map(Number);
    const old = convertDate({ year: 2026, month, day }, 'gregorian', 'julian');
    commemorations.push({ id: `${id}-fixed-${index}`, saintId: id, traditionId: 'russian-orthodox', sourceId: 'azbyka-directory', label, rule: { kind: 'fixed', calendar: 'julian', month: old.month, day: old.day } });
  }
  for (const [index, label] of movable.split(';').map(s => s.trim()).filter(Boolean).entries()) {
    commemorations.push({ id: `${id}-movable-${index}`, saintId: id, traditionId: 'russian-orthodox', sourceId: 'azbyka-directory', label, rule: { kind: 'unresolved', note: 'Источник отмечает дату как переходящую. Правило ещё не сверено; в календарную сетку не включено.' } });
  }
}
writeFileSync(new URL('../src/data/directory.json', import.meta.url), `${JSON.stringify({ saints, venerations, commemorations }, null, 2)}\n`);
console.log(`Directory: ${saints.length} entries, ${commemorations.length} commemorations.`);
