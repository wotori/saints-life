#!/usr/bin/env python3
"""Preserve user-provided books in the adjacent research archive with checksums."""
import hashlib
import json
from pathlib import Path
import re
import shutil
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT.parent / 'staints-life-sources'
DESTINATION = ARCHIVE / 'originals' / 'user-books'
ROSTOV = Path('/Users/wotori/git/books/raw_books/Жития')
JOHN = Path('/Users/wotori/Downloads/Святитель Иоанн Шанхайский и Сан-Францисский')
KIDS = Path('/Users/wotori/Downloads/Избранные жития святых в изложении для детей - 1994.pdf')
ROMAN = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10, 'XI': 11, 'XII': 12}


def digest(file):
    checksum = hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            checksum.update(chunk)
    return checksum.hexdigest()


def sources():
    books = []
    for file in ROSTOV.glob('*.pdf'):
        match = re.search(r'Книга\s+([IVX]+)\s+-', file.name)
        if match and match.group(1) in ROMAN:
            number = ROMAN[match.group(1)]
            books.append((f'rostovskij-{number:02}.pdf', file, f'Книга {number}, Ковчег, 2010'))
    books.sort()
    if len(books) != 12 or len({item[0] for item in books}) != 12:
        raise ValueError('Expected exactly one PDF for each of the twelve Rostov volumes.')
    john_pdf = list(JOHN.glob('*.pdf'))
    john_djvu = list(JOHN.glob('*.djvu'))
    if len(john_pdf) != 1 or len(john_djvu) != 1 or not KIDS.is_file():
        raise ValueError('Expected the children’s PDF and one PDF and one DjVu of the John book.')
    books.extend([('kids-saints.pdf', KIDS, 'Жития святых в изложении для детей'), ('ioann-shanghai-2014.pdf', john_pdf[0], 'Владыка Иоанн, PDF, 2014'), ('ioann-shanghai-2014.djvu', john_djvu[0], 'Владыка Иоанн, DjVu, 2014')])
    return books


def main():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    records = []
    for name, original, title in sources():
        target = DESTINATION / name
        sha = digest(original)
        if target.exists():
            if digest(target) != sha:
                raise ValueError(f'Archived file differs; refusing to replace it: {target}')
        else:
            temporary = target.with_suffix(target.suffix + '.part')
            if temporary.exists():
                raise ValueError(f'Unfinished archive copy exists; inspect it first: {temporary}')
            try:
                shutil.copy2(original, temporary)
                if digest(temporary) != sha:
                    raise ValueError(f'Checksum mismatch copying {original}')
                temporary.rename(target)
            except Exception:
                temporary.unlink(missing_ok=True)
                raise
        records.append({'title': title, 'sourcePath': str(original.resolve()), 'localPath': str(target.relative_to(ARCHIVE)), 'sha256': sha, 'bytes': target.stat().st_size, 'archivedAt': datetime.now(timezone.utc).isoformat()})
        print(f'Archived: {name}', flush=True)
    temporary = ARCHIVE / 'user-books-manifest.json.tmp'
    temporary.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(ARCHIVE / 'user-books-manifest.json')


if __name__ == '__main__':
    main()
