"""Archive registered sources next to the repo, with checksums and explicit failure states.

Usage: python3 scripts/archive-sources.py
Original HTML/PDF files are research copies. Their presence does not grant publication rights.
No source text or remote script is executed. Existing successful downloads are preserved.
"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[2] / 'staints-life-sources'
ORIGINALS = ROOT / 'originals'
TEXTS = ROOT / 'texts'
ORIGINALS.mkdir(parents=True, exist_ok=True)
TEXTS.mkdir(parents=True, exist_ok=True)
sources = json.loads((ROOT / 'catalog.json').read_text())['sources']
extra_file = ROOT / 'discovered-literature.json'
if extra_file.exists():
    sources += json.loads(extra_file.read_text())

class PlainText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip = 0
        self.parts = []
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'noscript'): self.skip += 1
        if tag in ('p', 'br', 'div', 'h1', 'h2', 'h3', 'li', 'tr'): self.parts.append('\n')
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript'): self.skip = max(0, self.skip - 1)
    def handle_data(self, data):
        if not self.skip: self.parts.append(data)

def fetch(source):
    if source['url'].startswith('/'):
        return dict(source, status='local-only', localPath=None, scope='see-user-books-manifest')
    ext = '.pdf' if '.pdf' in source['url'].lower() else '.html'
    target = ORIGINALS / (source['id'] + ext)
    record = dict(source)
    record['retrievedAt'] = datetime.now(timezone.utc).isoformat()
    if not target.exists():
        temporary = target.with_suffix(ext + '.part')
        result = subprocess.run(['curl', '--fail', '--location', '--silent', '--show-error', '--max-time', '25', '--max-filesize', '52428800', '--user-agent', 'SaintsLifeResearch/0.1', source['url'], '--output', str(temporary)], capture_output=True, text=True)
        if result.returncode != 0:
            temporary.unlink(missing_ok=True)
            record.update(status='unavailable', error=result.stderr.strip(), localPath=None)
            return record
        temporary.rename(target)
    data = target.read_bytes()
    record.update(status='downloaded', localPath=str(target.relative_to(ROOT)), bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), scope='full-response')
    if ext == '.html':
        # HTML responses sometimes declare Windows-1251 in the document.
        encoding = 'windows-1251' if b'windows-1251' in data[:15000].lower() else 'utf-8'
        decoded = data.decode(encoding, errors='replace')
        title_probe = decoded.lower()
        if any(marker in title_probe for marker in ('<title>access denied', '<title>just a moment', '<title>403 forbidden')):
            record.update(status='blocked-response', scope='error-page')
        parser = PlainText()
        parser.feed(decoded)
        text = '\n'.join(line.strip() for line in ''.join(parser.parts).splitlines() if line.strip())
        textfile = TEXTS / (source['id'] + '.txt')
        textfile.write_text(f"Source: {source['url']}\nRetrieved: {record['retrievedAt']}\nScope: extracted full HTML response, includes navigation; not a verified edition\n\n{text}\n")
        record['textPath'] = str(textfile.relative_to(ROOT))
    return record

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(fetch, sources))
(ROOT / 'manifest.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
for result in results: print(result['status'], result['id'])
