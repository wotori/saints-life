"""Prepare local-model inputs and validate literal name candidates, never saint identities.

Generated candidates stay in the adjacent research archive, outside the public catalogue.
"""
import argparse
import hashlib
import json
from pathlib import Path
import random
import re
import sqlite3

ROOT = Path(__file__).resolve().parents[2] / 'staints-life-sources'
DEST = ROOT / 'reports' / 'name-mining'


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    temp.replace(path)


def chunks(body, size=3500, overlap=250):
    start = 0
    while start < len(body):
        end = min(start + size, len(body))
        if end < len(body):
            split = body.rfind('\n', start + size // 2, end)
            if split > start:
                end = split
        yield start, body[start:end]
        if end == len(body):
            break
        start = end - overlap


def prepare(args):
    if any((DEST / f'{args.run}-{suffix}.json').exists() for suffix in ['input', 'output', 'run']):
        raise FileExistsError('Run already exists; resume its batch or choose a new --run name')
    selected_books = sorted(set(args.books))
    if not selected_books or any(book < 1 for book in selected_books):
        raise ValueError('Select positive book numbers')
    db = sqlite3.connect(f'file:{ROOT / "rostovskij-ocr.sqlite3"}?mode=ro', uri=True)
    available_books = {row[0] for row in db.execute('SELECT number FROM books')}
    unknown_books = set(selected_books) - available_books
    if unknown_books:
        db.close()
        raise ValueError(f'Unknown books: {sorted(unknown_books)}')
    candidates = []
    placeholders = ','.join('?' for _ in selected_books)
    for book, page, body, sha, source in db.execute(f'''
        SELECT p.book_number,p.page,p.body,b.sha256,b.source_path
        FROM pages p JOIN books b ON b.number=p.book_number
        WHERE p.book_number IN ({placeholders}) AND p.status='ok'
        ORDER BY p.book_number,p.page
    ''', selected_books):
        if not body or not body.strip():
            continue
        for start, text in chunks(body):
            candidates.append(dict(id=f'{book}:{page}:{start}:{sha}:{digest(text)}',
                book=book, page=page, offset=start, text=text,
                sourceSha256=sha, pageTextSha256=digest(body), sourcePath=source))
    db.close()
    if not candidates:
        raise ValueError('Selected books have no non-empty successfully processed pages')
    random.Random(args.seed).shuffle(candidates)
    selected = candidates[:args.limit] if args.limit else candidates
    save(DEST / f'{args.run}-input.json', selected)
    prompt = Path(__file__).with_name('person-candidates-prompt.txt').read_text()
    (DEST / f'{args.run}-prompt.txt').write_text(prompt)
    save(DEST / f'{args.run}-run.json', dict(seed=args.seed, model=args.model, books=selected_books,
        availableChunks=len(candidates), selectedChunks=len(selected),
        promptSha256=digest(prompt), status='prepared', purpose='unverified literal person-name candidates'))
    print(json.dumps(dict(available=len(candidates), selected=len(selected), output=str(DEST / f'{args.run}-input.json'))))


def book_progress(inputs, completed, missing):
    """Progress through selected inputs, not OCR or exhaustive person coverage."""
    completed, missing = set(completed), set(missing)
    books = {}
    for item in inputs:
        book = books.setdefault(item['book'], dict(book=item['book'], inputChunks=0,
            completedChunks=0, missingChunks=0, invalidChunks=0, pages={}))
        state = 'completedChunks' if item['id'] in completed else 'missingChunks' if item['id'] in missing else 'invalidChunks'
        book['inputChunks'] += 1
        book[state] += 1
        book['pages'].setdefault(item['page'], []).append(state == 'completedChunks')
    result = []
    for number in sorted(books):
        book = books[number]
        pages = book.pop('pages')
        book.update(inputPages=len(pages), fullyCheckedInputPages=sum(all(states) for states in pages.values()),
            partiallyCheckedInputPages=sum(any(states) and not all(states) for states in pages.values()),
            uncheckedInputPages=sum(not any(states) for states in pages.values()))
        result.append(book)
    return result


def check(args):
    inputs = json.loads((DEST / f'{args.run}-input.json').read_text())
    raw = json.loads((DEST / f'{args.run}-output.json').read_text())
    db = sqlite3.connect(f'file:{ROOT / "rostovskij-ocr.sqlite3"}?mode=ro', uri=True)
    accepted, rejected, completed, missing = [], [], [], []
    for item in inputs:
        answer = raw.get(item['id'])
        if answer is None:
            missing.append(item['id'])
            continue
        row = db.execute('SELECT p.body,b.sha256 FROM pages p JOIN books b ON b.number=p.book_number WHERE p.book_number=? AND p.page=?', (item['book'], item['page'])).fetchone()
        if not row or row[1] != item['sourceSha256'] or digest(row[0]) != item['pageTextSha256'] or row[0][item['offset']:item['offset']+len(item['text'])] != item['text']:
            rejected.append(dict(id=item['id'], reason='source-changed'))
            continue
        if not isinstance(answer, str):
            rejected.append(dict(id=item['id'], reason='invalid-answer'))
            continue
        completed.append(item['id'])
        if answer.strip() == 'NONE':
            continue
        for name in dict.fromkeys(part.strip() for part in answer.split('|')):
            matches = list(re.finditer(r'(?<!\w)' + re.escape(name) + r'(?!\w)', item['text']))
            if len(name) < 3 or len(name) > 160 or not any(char.isupper() for char in name) or not matches:
                rejected.append(dict(id=item['id'], candidate=name, reason='not-literal-name-span'))
                continue
            positions = [item['offset'] + match.start() for match in matches]
            accepted.append(dict(book=item['book'], page=item['page'], candidate=name,
                sourceSha256=item['sourceSha256'], pageTextSha256=item['pageTextSha256'],
                sourcePath=item['sourcePath'], offsets=positions, chunkId=item['id'],
                status='unreviewed-model-candidate', model=args.model,
                scanUrl=f'/api/library/book/{item["book"]}/{item["page"]}'))
    db.close()
    report = dict(scope='Literal span validation only; not identity, sainthood, or exhaustive name coverage.',
        model=args.model, inputChunks=len(inputs), completedChunks=len(completed),
        invalidChunks=len(inputs) - len(completed) - len(missing),
        missingChunks=len(missing), acceptedCandidates=len(accepted), rejectedCandidates=len(rejected),
        candidates=accepted, rejected=rejected, missing=missing,
        bookProgress=book_progress(inputs, completed, missing),
        bookProgressScope='Selected input chunks and pages only. A fully checked input page has validated responses for all its selected chunks; this does not prove every name was found or verified. Books/pages outside this run are not counted.')
    save(DEST / f'{args.run}-checked.json', report)
    manifest = DEST / f'{args.run}-run.json'
    if manifest.exists():
        state = json.loads(manifest.read_text())
        state.update(status='needs-attention' if report['invalidChunks'] else 'awaiting-review' if not missing else 'partially-checked',
            completedChunks=len(completed), missingChunks=len(missing),
            literalCandidates=len(accepted), rejectedCandidates=len(rejected))
        save(manifest, state)
    print(json.dumps({k:v for k,v in report.items() if k not in ['candidates','rejected','missing']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'check'])
    parser.add_argument('--run', default='pilot')
    parser.add_argument('--limit', type=int, default=20)
    parser.add_argument('--seed', type=int, default=20261105)
    parser.add_argument('--model', default='gemma3:12b')
    parser.add_argument('--books', nargs='+', type=int, default=list(range(1, 13)),
        help='Book numbers for prepare; defaults to the twelve Rostov volumes')
    args = parser.parse_args()
    if not args.run.replace('-', '').replace('_', '').isalnum():
        parser.error('run must be a simple filename component')
    (prepare if args.command == 'prepare' else check)(args)
