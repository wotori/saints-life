"""Verify the requested book archive and stored coverage without modifying databases.

This checks preservation, not OCR accuracy or exhaustive saint identification.
"""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sqlite3


EXPECTED = {f'rostovskij-{n:02}.pdf': n for n in range(1, 13)}
EXPECTED.update({'ioann-shanghai-2014.pdf': 13,
                 'ioann-shanghai-2014.djvu': None, 'kids-saints.pdf': 'kids-saints'})


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def audit(root, verify_originals=False):
    errors, files = [], []
    manifest = json.loads((root / 'user-books-manifest.json').read_text())
    for name, book in EXPECTED.items():
        records = [r for r in manifest if r['localPath'] == f'originals/user-books/{name}']
        if len(records) != 1:
            errors.append(f'{name}: expected exactly one manifest record, found {len(records)}')
            continue
        record = records[0]
        path = root / record['localPath']
        result = dict(file=record['localPath'], book=book)
        try:
            sha = digest(path)
            result['sha256'] = sha
            if sha != record['sha256'] or path.stat().st_size != record['bytes']:
                raise ValueError('archived file differs from manifest')
            if verify_originals:
                if digest(Path(record['sourcePath'])) != sha:
                    raise ValueError('original differs from archived copy')
                result['originalVerified'] = True
            if isinstance(book, int):
                with closing(sqlite3.connect((root / 'rostovskij-ocr.sqlite3').as_uri() + '?mode=ro', uri=True)) as db:
                    editions = db.execute('SELECT sha256,pages FROM books WHERE number=?', (book,)).fetchall()
                    if len(editions) != 1 or editions[0][0] != sha:
                        raise ValueError('OCR edition missing, duplicated or checksum differs')
                    count = editions[0][1]
                    pages = db.execute('SELECT page,status FROM pages WHERE book_number=? ORDER BY page', (book,)).fetchall()
                    if [p[0] for p in pages] != list(range(1, count + 1)):
                        raise ValueError('OCR page sequence has missing, duplicate or extra pages')
                    if any(p[1] != 'ok' for p in pages):
                        raise ValueError('OCR contains unfinished or failed pages')
                    result['storedPages'] = count
            elif book == 'kids-saints':
                with closing(sqlite3.connect((root / 'library.sqlite3').as_uri() + '?mode=ro', uri=True)) as db:
                    editions = db.execute('SELECT sha256 FROM books WHERE id=?', (book,)).fetchall()
                    if editions != [(sha,)]:
                        raise ValueError('chapter edition missing, duplicated or checksum differs')
                    chapters = db.execute('SELECT position,locator,body FROM chapters WHERE book_id=?', (book,)).fetchall()
                    if len(chapters) != 28 or len({c[0] for c in chapters}) != 28:
                        raise ValueError('expected 28 chapters with unique positions')
                    if any(not (c[1] or '').strip() or not (c[2] or '').strip() for c in chapters):
                        raise ValueError('chapter has empty text or missing source locator')
                    result['storedChapters'] = len(chapters)
            result['verified'] = True
        except (OSError, ValueError, sqlite3.Error) as error:
            result['verified'] = False
            errors.append(f'{name}: {error}')
        files.append(result)
    return dict(checkedAt=datetime.now(timezone.utc).isoformat(),
                scope='Archived bytes, edition checksums and stored page/chapter coverage. Not OCR fidelity, person completeness or publication rights.',
                originalsRequested=verify_originals, files=files, errors=errors,
                passed=not errors)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, default=Path(os.environ.get('SAINTS_SOURCES_DIR', Path(__file__).resolve().parents[2] / 'staints-life-sources')))
    parser.add_argument('--verify-originals', action='store_true', help='Also require original files at the manifest source paths')
    args = parser.parse_args()
    root = args.archive.resolve()
    report = audit(root, args.verify_originals)
    destination = root / 'reports' / 'library-files-audit.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(destination)
    print(json.dumps(dict(passed=report['passed'], verifiedFiles=sum(f.get('verified', False) for f in report['files']), errors=report['errors'], report=str(destination)), ensure_ascii=False))
    raise SystemExit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
