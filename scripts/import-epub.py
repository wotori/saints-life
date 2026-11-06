#!/usr/bin/env python3
"""Import the supplied EPUB as a private local SQLite corpus, preserving source locators."""
import argparse, hashlib, re, sqlite3, zipfile
from pathlib import Path
from html.parser import HTMLParser
from xml.etree import ElementTree as ET

class Text(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.parts=[]; self.count=0; self.anchors={}; self.hidden=0
    def add(self, value): self.parts.append(value); self.count += len(value)
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag in ('head','script','style'): self.hidden+=1
        if self.hidden: return
        if 'id' in attrs: self.anchors[attrs['id']]=self.count
        if tag in ('p','h1','h2','h3','div','br','li'): self.add('\n\n')
    def handle_endtag(self, tag):
        if tag in ('head','script','style'): self.hidden=max(0,self.hidden-1)
    def handle_data(self, data):
        if not self.hidden: self.add(data)

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('epub'); ap.add_argument('--db',default='../staints-life-sources/library.sqlite3'); ap.add_argument('--book-id',help='Stable identifier for this edition'); args=ap.parse_args()
    source=Path(args.epub); db=Path(args.db); db.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(source) as z:
        root=ET.fromstring(z.read('content.opf')); ns={'o':'http://www.idpf.org/2007/opf','d':'http://purl.org/dc/elements/1.1/'}
        title=root.findtext('.//d:title',namespaces=ns); publisher=root.findtext('.//d:publisher',namespaces=ns); year=root.findtext('.//d:date',namespaces=ns)
        manifest={x.attrib['id']:x.attrib['href'] for x in root.findall('.//o:manifest/o:item',ns)}
        files=[manifest[x.attrib['idref']] for x in root.findall('.//o:spine/o:itemref',ns) if manifest[x.attrib['idref']].endswith('.html')]
        alltext=[]; offsets={}; base=0; trial=False
        for f in files:
            raw=z.read(f).decode('utf-8')
            if 'litres_trial_promo' in raw:
                trial=True
                continue
            parser=Text(); parser.feed(raw); body=''.join(parser.parts); alltext.append(body)
            offsets.update({f+'#'+key:base+value for key,value in parser.anchors.items()}); base+=len(body)
        text=''.join(alltext); ncx=ET.fromstring(z.read('toc.ncx')); n={'n':'http://www.daisy.org/z3986/2005/ncx/'}
        entries=[]
        for point in ncx.findall('.//n:navPoint',n):
            if point.findall('n:navPoint',n): continue
            label=point.findtext('n:navLabel/n:text',namespaces=n); content=point.find('n:content',n); href=content.attrib['src'] if content is not None else ''
            if label and href in offsets: entries.append((label,href,offsets[href]))
        entries.sort(key=lambda x:x[2]); con=sqlite3.connect(db)
        con.executescript('CREATE TABLE IF NOT EXISTS books(id TEXT PRIMARY KEY,title TEXT NOT NULL,publisher TEXT,year TEXT,sha256 TEXT,source_path TEXT,rights TEXT); CREATE TABLE IF NOT EXISTS chapters(id TEXT PRIMARY KEY,book_id TEXT NOT NULL,title TEXT NOT NULL,locator TEXT NOT NULL,position INTEGER NOT NULL,body TEXT NOT NULL,FOREIGN KEY(book_id) REFERENCES books(id)); CREATE INDEX IF NOT EXISTS chapters_book ON chapters(book_id,position);')
        volume=re.search(r'Том\s*(\d+)',title or '',re.IGNORECASE)
        if not args.book_id and not volume: raise ValueError('Book volume was not found in metadata; supply --book-id.')
        book=args.book_id or 'russian-saints-vol'+volume.group(1); digest=hashlib.sha256(source.read_bytes()).hexdigest()
        existing=con.execute('SELECT sha256 FROM books WHERE id=?',(book,)).fetchone()
        if existing and existing[0]!=digest: raise ValueError(f'An edition with id {book} already exists and has a different SHA-256; supply a different --book-id to preserve both editions.')
        rights='Ознакомительный фрагмент ЛитРес. Последний раздел может быть оборван. Права на публичное распространение не проверены.' if trial else 'Права на публичное распространение конкретного издания не проверены.'
        with con:
            con.execute('INSERT OR REPLACE INTO books VALUES(?,?,?,?,?,?,?)',(book,title,publisher,year,digest,str(source.resolve()),rights))
            con.execute('DELETE FROM chapters WHERE book_id=?',(book,))
            for i,(label,href,start) in enumerate(entries):
                end=entries[i+1][2] if i+1<len(entries) else len(text)
                body=re.sub(r'\n[ \t]*\n(?:[ \t]*\n)+','\n\n',text[start:end]).strip()
                con.execute('INSERT INTO chapters VALUES(?,?,?,?,?,?)',(book+'-'+str(i+1),book,label,href,i,body))
        print(f'{title}: {len(entries)} разделов, {sum(len(x) for x in alltext)} символов; фрагмент: {trial}; база {db.resolve()}')
if __name__=='__main__': main()
