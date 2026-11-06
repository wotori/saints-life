import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { rebuildPrintedEntries, registerSupplementalIndexLines } from '../src/lib/printed-index-import';

test('materializing source entries is repeatable and protects reviewed records', () => {
  const index = new DatabaseSync(':memory:');
  const ocr = new DatabaseSync(':memory:');
  try {
    ocr.exec("CREATE TABLE books(number INTEGER PRIMARY KEY, sha256 TEXT); INSERT INTO books VALUES(1,'book-hash')");
    index.exec("CREATE TABLE index_pages(book_number INTEGER,page INTEGER,left_text TEXT,right_text TEXT,is_index INTEGER,source_sha256 TEXT)");
    const initial = 'Мамант* мученик ...........| 2| 74\nИоанн* Постник ............| 2| 85';
    index.prepare('INSERT INTO index_pages VALUES(1,670,?,?,1,?)').run(initial, '', 'book-hash');
    assert.deepEqual(rebuildPrintedEntries(index, ocr), { entries: 2, pages: 1 });
    assert.deepEqual(rebuildPrintedEntries(index, ocr), { entries: 2, pages: 1 });
    index.prepare("UPDATE printed_entries SET review_status='reviewed',title='Исправленное имя',review_note='Сверено' WHERE line_number=0").run();
    rebuildPrintedEntries(index, ocr);
    assert.deepEqual({ ...index.prepare('SELECT title,review_status,review_note,active FROM printed_entries WHERE line_number=0').get() }, { title: 'Исправленное имя', review_status: 'reviewed', review_note: 'Сверено', active: 1 });

    index.prepare('UPDATE index_pages SET left_text=?').run('Мамант* мученик ...........| 2| 74\nТекст без строки указателя');
    assert.equal(rebuildPrintedEntries(index, ocr).entries, 1);
    assert.equal(index.prepare('SELECT active FROM printed_entries WHERE line_number=1').get()?.active, 0);
    index.prepare('UPDATE index_pages SET left_text=?').run('Другое имя ...........| 2| 74');
    assert.throws(() => rebuildPrintedEntries(index, ocr), /Reviewed source line changed/);
    assert.equal(index.prepare('SELECT title FROM printed_entries WHERE line_number=0').get()?.title, 'Исправленное имя');
    assert.equal(index.prepare('SELECT active FROM printed_entries WHERE line_number=1').get()?.active, 0);
  } finally { index.close(); ocr.close(); }
});

test('materializing rejects an index attributed to another source edition', () => {
  const index = new DatabaseSync(':memory:');
  const ocr = new DatabaseSync(':memory:');
  try {
    ocr.exec("CREATE TABLE books(number INTEGER PRIMARY KEY, sha256 TEXT); INSERT INTO books VALUES(1,'expected')");
    index.exec("CREATE TABLE index_pages(book_number INTEGER,page INTEGER,left_text TEXT,right_text TEXT,is_index INTEGER,source_sha256 TEXT)");
    index.prepare('INSERT INTO index_pages VALUES(1,670,?,?,1,?)').run('Мамант ........| 2| 74', '', 'wrong');
    assert.throws(() => rebuildPrintedEntries(index, ocr), /Source checksum mismatch/);
    assert.equal(index.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='printed_entries'").get()?.n, 0);
  } finally { index.close(); ocr.close(); }
});

test('review batches preserve OCR, are repeatable and roll back on mismatch', async () => {
  const { reviewPrintedEntries } = await import('../src/lib/printed-index-review');
  const index = new DatabaseSync(':memory:');
  const ocr = new DatabaseSync(':memory:');
  try {
    ocr.exec("CREATE TABLE books(number INTEGER PRIMARY KEY, sha256 TEXT, pages INTEGER); INSERT INTO books VALUES(1,'book-hash',700)");
    index.exec("CREATE TABLE index_pages(book_number INTEGER,page INTEGER,left_text TEXT,right_text TEXT,is_index INTEGER,source_sha256 TEXT)");
    index.prepare('INSERT INTO index_pages VALUES(1,670,?,?,1,?)').run('Мамант ........| 2| 74\nИоанн ........| 2| 85', '', 'book-hash');
    rebuildPrintedEntries(index, ocr);
    const row = index.prepare('SELECT fingerprint,raw_line FROM printed_entries WHERE line_number=0').get() as {fingerprint: string; raw_line: string};
    const item = { book: 1, indexPage: 670, line: 0, fingerprint: row.fingerprint, title: 'Мамант мученик', day: 2, printedPage: 74, note: 'Сверено со сканом' };
    assert.throws(() => reviewPrintedEntries(index, ocr, [item, { ...item, line: 1 }]), /Source mismatch/);
    assert.equal(index.prepare('SELECT review_status FROM printed_entries WHERE line_number=0').get()?.review_status, 'unreviewed');
    assert.equal(reviewPrintedEntries(index, ocr, [item]), 1);
    assert.equal(reviewPrintedEntries(index, ocr, [item]), 0);
    assert.equal(index.prepare('SELECT raw_line FROM printed_entries WHERE line_number=0').get()?.raw_line, row.raw_line);
    assert.equal(index.prepare('SELECT count(*) AS n FROM printed_entry_reviews').get()?.n, 1);
    assert.throws(() => reviewPrintedEntries(index, ocr, [{ ...item, day: 3 }]), /Already reviewed/);
    rebuildPrintedEntries(index, ocr);
    assert.equal(index.prepare('SELECT title FROM printed_entries WHERE line_number=0').get()?.title, 'Мамант мученик');
  } finally { index.close(); ocr.close(); }
});

test('omitted source lines are reproducible and bound to the original OCR and edition', () => {
  const index = new DatabaseSync(':memory:');
  const ocr = new DatabaseSync(':memory:');
  try {
    ocr.exec("CREATE TABLE books(number INTEGER PRIMARY KEY, sha256 TEXT); INSERT INTO books VALUES(1,'book-hash')");
    index.exec("CREATE TABLE index_pages(book_number INTEGER,page INTEGER,left_text TEXT,right_text TEXT,is_index INTEGER,source_sha256 TEXT)");
    const raw = 'Воспоминание* У] Вселенского собора';
    index.prepare('INSERT INTO index_pages VALUES(1,670,?,?,1,?)').run(`Мамант ........| 2| 74\n${raw}`, '', 'book-hash');
    rebuildPrintedEntries(index, ocr);
    const item = { book: 1, indexPage: 670, line: 1, fingerprint: createHash('sha256').update(`book-hash\0${raw}`).digest('hex') };
    assert.throws(() => registerSupplementalIndexLines(index, ocr, [item, { ...item, line: 2 }]), /source mismatch/i);
    assert.equal(registerSupplementalIndexLines(index, ocr, [item]), 1);
    assert.equal(registerSupplementalIndexLines(index, ocr, [item]), 0);
    assert.equal(rebuildPrintedEntries(index, ocr).entries, 2);
    index.prepare("UPDATE printed_entries SET review_status='reviewed',title='VI Вселенский собор' WHERE line_number=1").run();
    rebuildPrintedEntries(index, ocr);
    assert.equal(index.prepare('SELECT title FROM printed_entries WHERE line_number=1').get()?.title, 'VI Вселенский собор');
    index.prepare('UPDATE index_pages SET left_text=?').run('Мамант ........| 2| 74\nИной текст');
    assert.throws(() => rebuildPrintedEntries(index, ocr), /Supplemental source line changed/);
    assert.equal(index.prepare('SELECT title FROM printed_entries WHERE line_number=1').get()?.title, 'VI Вселенский собор');
  } finally { index.close(); ocr.close(); }
});

test('excluding an OCR artifact preserves evidence and survives a rebuild', async () => {
  const { excludePrintedEntries } = await import('../src/lib/printed-index-review');
  const index = new DatabaseSync(':memory:');
  const ocr = new DatabaseSync(':memory:');
  try {
    ocr.exec("CREATE TABLE books(number INTEGER PRIMARY KEY, sha256 TEXT); INSERT INTO books VALUES(1,'book-hash')");
    index.exec("CREATE TABLE index_pages(book_number INTEGER,page INTEGER,left_text TEXT,right_text TEXT,is_index INTEGER,source_sha256 TEXT)");
    index.prepare('INSERT INTO index_pages VALUES(1,670,?,?,1,?)').run('н|5\nМамант ........| 2| 74', '', 'book-hash');
    rebuildPrintedEntries(index, ocr);
    const row = index.prepare('SELECT fingerprint,raw_line FROM printed_entries WHERE line_number=0').get() as {fingerprint: string; raw_line: string};
    const item = { book: 1, indexPage: 670, line: 0, fingerprint: row.fingerprint, note: 'Сверено со сканом: фрагмент заголовка' };
    assert.throws(() => excludePrintedEntries(index, ocr, [item, { ...item, line: 1 }]), /Source mismatch/);
    assert.equal(index.prepare('SELECT review_status FROM printed_entries WHERE line_number=0').get()?.review_status, 'unreviewed');
    assert.equal(excludePrintedEntries(index, ocr, [item]), 1);
    assert.equal(excludePrintedEntries(index, ocr, [item]), 0);
    rebuildPrintedEntries(index, ocr);
    assert.deepEqual({ ...index.prepare('SELECT review_status,raw_line FROM printed_entries WHERE line_number=0').get() }, { review_status: 'excluded', raw_line: row.raw_line });
    assert.equal(index.prepare('SELECT count(*) AS n FROM printed_entry_reviews').get()?.n, 1);
  } finally { index.close(); ocr.close(); }
});

test('a source reference without a fixed day can be reviewed without inventing a date', async () => {
  const { reviewPrintedEntries } = await import('../src/lib/printed-index-review');
  const index = new DatabaseSync(':memory:');
  const ocr = new DatabaseSync(':memory:');
  try {
    ocr.exec("CREATE TABLE books(number INTEGER PRIMARY KEY, sha256 TEXT, pages INTEGER); INSERT INTO books VALUES(1,'book-hash',800)");
    index.exec("CREATE TABLE index_pages(book_number INTEGER,page INTEGER,left_text TEXT,right_text TEXT,is_index INTEGER,source_sha256 TEXT)");
    index.prepare('INSERT INTO index_pages VALUES(1,670,?,?,1,?)').run('Воскресение Христово ............ прил. 707', '', 'book-hash');
    rebuildPrintedEntries(index, ocr);
    const row = index.prepare('SELECT fingerprint FROM printed_entries WHERE line_number=0').get() as {fingerprint: string};
    const item = { book: 1, indexPage: 670, line: 0, fingerprint: row.fingerprint, title: 'Воскресение Христово', day: null, printedPage: 707, note: 'День в указателе не указан' };
    assert.equal(reviewPrintedEntries(index, ocr, [item]), 1);
    rebuildPrintedEntries(index, ocr);
    assert.deepEqual({ ...index.prepare('SELECT printed_day,printed_page,review_status FROM printed_entries WHERE line_number=0').get() }, { printed_day: null, printed_page: 707, review_status: 'reviewed' });
  } finally { index.close(); ocr.close(); }
});
