#!/usr/bin/env python3
"""Recover index references from separate printed number columns, with local OCR.

This records independent OCR evidence, never changes editorially reviewed entries.
"""
import argparse
import csv
import difflib
import hashlib
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT.parent / 'staints-life-sources'


def words(path):
    with open(path, newline='', encoding='utf-8') as stream:
        return [row for row in csv.DictReader(stream, delimiter='\t') if row['level'] == '5' and row['text'].strip()]


def ocr(image, prefix, language, numeric=False):
    args = ['tesseract', str(image), str(prefix), '-l', language, '--psm', '6']
    if numeric:
        args += ['-c', 'tessedit_char_whitelist=0123456789']
    args.append('tsv')
    subprocess.run(args, check=True, capture_output=True, timeout=180, env={**os.environ, 'OMP_THREAD_LIMIT': '1'})
    return words(str(prefix) + '.tsv')


def line_groups(rows):
    groups = {}
    for row in rows:
        key = (row['block_num'], row['par_num'], row['line_num'])
        groups.setdefault(key, []).append(row)
    return list(groups.values())


def center(row):
    return int(row['top']) + int(row['height']) / 2


def vertical_rules(image):
    """Find the six long vertical rules bounding the two numeric tables."""
    pixels = image.load()
    width, height = image.size
    found = []
    for x in range(width):
        if not (width * .30 < x < width * .49 or width * .74 < x < width * .94):
            continue
        longest = run = 0
        for y in range(height // 8, height * 93 // 100):
            run = run + 1 if pixels[x, y] < 140 else 0
            longest = max(longest, run)
        if longest > height // 8:
            # A slanted or broken printed rule can disappear for a few pixels.
            if found and x <= found[-1][-1] + 4:
                found[-1].append(x)
            else:
                found.append([x])
    centers = [(group[0] + group[-1]) // 2 for group in found]
    if len(centers) != 6 or sum(x < width / 2 for x in centers) != 3:
        return None
    if any(not 15 < centers[i+1] - centers[i] < width * .09 for i in (0, 1, 3, 4)):
        return None
    return centers


def nearest(rows, y, tolerance):
    nearby = [r for r in rows if abs(center(r) - y) <= tolerance]
    return nearby[0] if len(nearby) == 1 else None


def candidate_agrees(reference, day, page):
    """Require the original OCR digits to agree, allowing a separator read as 1."""
    digits = ''.join(ch for ch in reference if ch.isascii() and ch.isdigit())
    return digits in (f'{day}{page}', f'{day}1{page}')


def inspect_page(book, page, source, left, right, entries, tmp):
    prefix = tmp / 'page'
    subprocess.run(['pdftoppm', '-f', str(page), '-l', str(page), '-scale-to', '2400', '-jpeg', '-singlefile', source, str(prefix)], check=True, capture_output=True, timeout=90)
    image = Image.open(str(prefix) + '.jpg').convert('L')
    w, h = image.size
    rules = vertical_rules(image)
    if not rules:
        return [], 'table rules not found'
    results = []
    for col, text in enumerate((left, right)):
        cropped = image.crop((w * col // 2, 0, w * (col + 1) // 2, h))
        file = tmp / f'text-{col}.png'
        cropped.save(file)
        groups = line_groups(ocr(file, tmp / f'text-{col}', 'rus'))
        originals = text.split('\n')
        recognized = [' '.join(row['text'] for row in group) for group in groups]
        normalize = lambda value: ' '.join(value.split())
        matcher = difflib.SequenceMatcher(None, list(map(normalize, originals)), list(map(normalize, recognized)), autojunk=False)
        aligned = {}
        for block in matcher.get_matching_blocks():
            for delta in range(block.size):
                aligned[block.a + delta] = groups[block.b + delta]
        # All names and numeric cells must originate from the same physical row.
        columns = []
        for field in range(2):
            start = rules[col * 3 + field] + 4
            stop = rules[col * 3 + field + 1] - 4
            name = tmp / f'numeric-{col}-{field}.png'
            ImageOps.expand(image.crop((start, 0, stop, h)), border=16, fill=255).save(name)
            rows = ocr(name, tmp / f'numeric-{col}-{field}', 'eng', numeric=True)
            for row in rows:
                row['top'] = str(int(row['top']) - 16)
            columns.append([row for row in rows if row['text'].isdigit() and float(row['conf']) >= 75])
        offset = 0 if col == 0 else len(left.split('\n'))
        found = []
        for number, group in aligned.items():
            entry = entries.get(offset + number)
            if not entry:
                continue
            title_words = [r for r in group if any(ch.isalpha() for ch in r['text'])]
            if not title_words:
                continue
            y = sorted(center(r) for r in title_words)[len(title_words) // 2]
            tolerance = max(8, min(22, max(int(r['height']) for r in title_words) * .65))
            day_word, page_word = (nearest(column, y, tolerance) for column in columns)
            if not day_word or not page_word:
                continue
            day, printed_page = int(day_word['text']), int(page_word['text'])
            if not 1 <= day <= 31 or not 1 <= printed_page <= 1500:
                continue
            found.append((entry, day, printed_page, min(float(day_word['conf']), float(page_word['conf']))))
        # Alignment is accepted only after comparisons against existing two-column references.
        controls = [(e, d, p) for e, d, p, _ in found if e['printed_day'] is not None and e['printed_page'] is not None]
        good = sum(e['printed_day'] == d and e['printed_page'] == p for e, d, p in controls)
        if len(controls) < 8 or good / len(controls) < .95:
            print(f'book={book} page={page} col={col} rejected controls={good}/{len(controls)}', flush=True)
            continue
        print(f'book={book} page={page} col={col} controls={good}/{len(controls)} rows={len(found)}', flush=True)
        for entry, day, printed_page, confidence in found:
            if entry['review_status'] == 'unreviewed' and entry['printed_page'] is None and candidate_agrees(entry['source_line'], day, printed_page):
                results.append((book, page, entry['line_number'], entry['fingerprint'], day, printed_page, confidence))
    return results, None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--book', type=int, choices=range(1, 13))
    parser.add_argument('--page', type=int)
    args = parser.parse_args()
    index = sqlite3.connect(ARCHIVE / 'book-indexes.sqlite3', timeout=30)
    index.row_factory = sqlite3.Row
    source = sqlite3.connect(ARCHIVE / 'rostovskij-ocr.sqlite3')
    books = {row[0]: row for row in source.execute('SELECT number,source_path,pages,sha256 FROM books WHERE number BETWEEN 1 AND 12')}
    pages = index.execute('SELECT * FROM index_pages WHERE is_index=1 ORDER BY book_number,page').fetchall()
    pages = [p for p in pages if (not args.book or p['book_number'] == args.book) and (not args.page or p['page'] == args.page)]
    for number in {p['book_number'] for p in pages}:
        b = books[number]
        checksum = hashlib.sha256()
        with open(b[1], 'rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                checksum.update(chunk)
        digest = checksum.hexdigest()
        if digest != b[3] or any(p['source_sha256'] != digest for p in pages if p['book_number'] == number):
            raise RuntimeError(f'Source checksum mismatch for book {number}')
    index.execute('''CREATE TABLE IF NOT EXISTS numeric_reference_evidence (
        book_number INTEGER NOT NULL, index_page INTEGER NOT NULL, line_number INTEGER NOT NULL,
        fingerprint TEXT NOT NULL, printed_day INTEGER NOT NULL, printed_page INTEGER NOT NULL,
        confidence REAL NOT NULL, method TEXT NOT NULL,
        PRIMARY KEY(book_number,index_page,line_number))''')
    index.commit()
    for row in pages:
        book, page = row['book_number'], row['page']
        entries = {r['line_number']: r for r in index.execute('SELECT * FROM printed_entries WHERE active=1 AND book_number=? AND index_page=?', (book, page))}
        with tempfile.TemporaryDirectory(prefix='index-numbers-', dir=ARCHIVE / 'ocr-work') as directory:
            items, error = inspect_page(book, page, books[book][1], row['left_text'], row['right_text'], entries, Path(directory))
        if error:
            print(f'book={book} page={page} skipped: {error}', flush=True)
            continue
        with index:
            index.executemany("""INSERT INTO numeric_reference_evidence VALUES(?,?,?,?,?,?,?,'tesseract-columns-v1')
                ON CONFLICT(book_number,index_page,line_number) DO UPDATE SET
                    fingerprint=excluded.fingerprint,printed_day=excluded.printed_day,
                    printed_page=excluded.printed_page,confidence=excluded.confidence,method=excluded.method
                WHERE numeric_reference_evidence.fingerprint != excluded.fingerprint""", items)
        print(f'book={book} page={page} recovered={len(items)}', flush=True)
    source.close()
    index.close()


if __name__ == '__main__':
    main()
