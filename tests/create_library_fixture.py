"""Create disposable, synthetic library data for browser tests."""
import sqlite3
import sys
import hashlib
from pathlib import Path

destination = Path(sys.argv[1])
destination.mkdir(parents=True, exist_ok=True)

# Minimal two-page PDF containing test text, built without external libraries.
stream = b'BT /F1 18 Tf 30 160 Td (Test page) Tj ET\n'
objects = [
    b'<< /Type /Catalog /Pages 2 0 R >>',
    b'<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>',
    b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    f'<< /Length {len(stream)} >>\nstream\n'.encode() + stream + b'endstream',
    b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
]
data = bytearray(b'%PDF-1.4\n')
offsets = [0]
for number, value in enumerate(objects, 1):
    offsets.append(len(data))
    data.extend(f'{number} 0 obj\n'.encode() + value + b'\nendobj\n')
xref = len(data)
data.extend(f'xref\n0 {len(offsets)}\n0000000000 65535 f \n'.encode())
for offset in offsets[1:]:
    data.extend(f'{offset:010d} 00000 n \n'.encode())
data.extend(f'trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode())
pdf = destination / 'fixture.pdf'
pdf.write_bytes(data)

# A separate valid 829-page PDF exercises the John book's real page numbers.
john_count = 829
font_id = 3 + john_count
stream_id = font_id + 1
kids = ' '.join(f'{number} 0 R' for number in range(3, font_id)).encode()
john_objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [' + kids + f'] /Count {john_count} >>'.encode()]
for _ in range(john_count):
    john_objects.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents {stream_id} 0 R /Resources << /Font << /F1 {font_id} 0 R >> >> >>'.encode())
john_objects.append(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
john_objects.append(f'<< /Length {len(stream)} >>\nstream\n'.encode() + stream + b'endstream')
john_data = bytearray(b'%PDF-1.4\n')
john_offsets = [0]
for number, value in enumerate(john_objects, 1):
    john_offsets.append(len(john_data))
    john_data.extend(f'{number} 0 obj\n'.encode() + value + b'\nendobj\n')
john_xref = len(john_data)
john_data.extend(f'xref\n0 {len(john_offsets)}\n0000000000 65535 f \n'.encode())
for offset in john_offsets[1:]:
    john_data.extend(f'{offset:010d} 00000 n \n'.encode())
john_data.extend(f'trailer\n<< /Size {len(john_offsets)} /Root 1 0 R >>\nstartxref\n{john_xref}\n%%EOF\n'.encode())
john_pdf = destination / 'john.pdf'
john_pdf.write_bytes(john_data)
pdf_hash = hashlib.sha256(data).hexdigest()
john_hash = hashlib.sha256(john_data).hexdigest()
archived = destination / 'originals' / 'user-books'
archived.mkdir(parents=True, exist_ok=True)
(archived / 'rostovskij-02.pdf').write_bytes(data)
(archived / 'kids-saints.pdf').write_bytes(data)

with sqlite3.connect(destination / 'ocr.sqlite3') as db:
    db.executescript('''CREATE TABLE books (number INTEGER PRIMARY KEY, title TEXT NOT NULL, source_path TEXT NOT NULL, pages INTEGER NOT NULL, sha256 TEXT NOT NULL);
CREATE TABLE pages (book_number INTEGER NOT NULL, page INTEGER NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL, error TEXT, PRIMARY KEY(book_number, page));
CREATE VIRTUAL TABLE pages_fts USING fts5(body, book_number UNINDEXED, page UNINDEXED, tokenize='unicode61');''')
    db.execute('INSERT INTO books VALUES (1, ?, ?, 2, ?)', ('Жития святых. Книга 1', str(pdf), pdf_hash))
    db.execute('INSERT INTO books VALUES (2, ?, ?, 2, ?)', ('Тестовая книга разделов', '/missing/rostovskij-02.pdf', pdf_hash))
    db.execute('INSERT INTO books VALUES (3, ?, ?, 69, ?)', ('Тестовая книга с печатной нумерацией', str(john_pdf), john_hash))
    db.execute('INSERT INTO books VALUES (4, ?, ?, 43, ?)', ('Тестовая книга длинного жития', str(john_pdf), john_hash))
    # This fixture exercises an edition-bound OCR link; its synthetic scan is not served as that edition.
    db.execute('INSERT INTO books VALUES (8, ?, ?, 436, ?)', ('Тестовая книга с краткой памятью', str(pdf), '34cad51db160ddb198289ea09aa9cd1745abb00e2f2eba61e6bb229cdc078e90'))
    db.execute('INSERT INTO books VALUES (10, ?, ?, 639, ?)', ('Тест последнего дня тома', str(pdf), '5d6ad1d1f29953b1f717fcc709ec01032ad6928b642e5b4664378b70284fb152'))
    db.execute('INSERT INTO books VALUES (13, ?, ?, 829, ?)', ('Владыка Иоанн - святитель русского зарубежья', str(john_pdf), john_hash))
    body = '7 Житие преподобного Агапита Печерского\n\nЖИТИЕ ПРЕПОДОБНОГО АГАПИТА\n\nТестовое описание святого Агапита.'
    db.execute('INSERT INTO pages VALUES (1, 1, ?, ?, NULL)', (body, 'ok'))
    db.execute('INSERT INTO pages VALUES (13, 1, ?, ?, NULL)', ('Иоанн Шанхайский. Тестовая страница из отдельного издания.', 'ok'))
    db.execute('INSERT INTO pages VALUES (13, 14, ?, ?, NULL)', ('Первая глава о жизни святителя. Тестовый текст.', 'ok'))
    db.execute('INSERT INTO pages VALUES (13, 15, ?, ?, NULL)', ('', 'ok'))
    db.execute('INSERT INTO pages VALUES (2, 1, ?, ?, NULL)', ('ДЕНЬ ВТОРОЙ\n\nЖИТИЕ СВЯТОГО\nМАМАНТА\n\nПервая страница жития. Пафлаго-\nнии.', 'ok'))
    db.execute('INSERT INTO pages VALUES (2, 2, ?, ?, NULL)', ('Житие Иоанна 2\n\nПродолжение жития Маманта.\n\nПАМЯТЬ СВЯТОГО\nИОАННА\n\nТекст соседнего раздела.', 'ok'))
    db.execute('INSERT INTO pages VALUES (8, 436, ?, ?, NULL)', ('В тот же день память святых мучеников: Саторния, Иакисхола,\nФавстиана. Тестовая краткая память.', 'ok'))
    db.execute('INSERT INTO pages VALUES (10, 637, ?, ?, NULL)', ('ДЕНЬ ДВАДЦАТЬ ДЕВЯТЫЙ\n\nПредыдущий день.', 'ok'))
    db.execute('INSERT INTO pages VALUES (10, 638, ?, ?, NULL)', ('Окончание предыдущего дня.\n\nДЕНЬ ТРИДЦАТЫЙ\n\nПоследний день книги.', 'ok'))
    db.execute('INSERT INTO pages VALUES (10, 639, ?, ?, NULL)', ('АЛФАВИТ СВЯТЫХ,\n\nЗаписи указателя.', 'ok'))
    for printed in range(1, 13):
        extra = (' Спиридон святитель.' if printed == 4 else '')
        if printed == 3:
            extra += '\n\nПАМЯТЬ СВЯТОЙ МУЧЕНИЦЫ МАРФЫ\n\nЖитие Марфы.\n\nПАМЯТЬ святых МУЧЕНИКОВ\nДИОДОРА и ДИДИМА\n\nТест об обоих мучениках.\n\nЖитие СВЯТОГО ПРОРОКА ИОНЫ\n\nТестовое житие пророка.'
        if printed == 5:
            extra += '\n\nЖИТИЕ ПАФНУТИЯ\n\nИстория Пафнутия.'
        marker = 'ДЕНЬ ТРЕТИЙ\n\n' if printed == 4 else 'ДЛеЕнь четвертый!\n\n' if printed == 6 else ''
        db.execute('INSERT INTO pages VALUES (3, ?, ?, ?, NULL)', (printed + 2, f'{printed} Тестовый заголовок\n\n{marker}Текст страницы {printed}.' + extra, 'ok'))
    for printed in range(13, 68):
        db.execute('INSERT INTO pages VALUES (3, ?, ?, ?, NULL)', (printed + 2, f'{printed} Тестовый заголовок\n\nИсторияповтор на странице {printed}.', 'ok'))
    for page in range(1, 44):
        body = 'ДЕНЬ ПЕРВЫЙ\n\nЖИТИЕ ДЛИННОЕ\n\nНачало рассказа.' if page == 1 else f'Продолжение рассказа, страница {page}.'
        if page == 42:
            body += '\n\nПАМЯТЬ ДРУГОГО СВЯТОГО\n\nТекст другого жития.'
        if page == 43:
            body = 'ДЕНЬ ВТОРОЙ\n\nТекст следующего дня.'
        db.execute('INSERT INTO pages VALUES (4, ?, ?, ?, NULL)', (page, body, 'ok'))
    db.execute('INSERT INTO pages_fts(rowid,body,book_number,page) SELECT rowid,body,book_number,page FROM pages')

with sqlite3.connect(destination / 'epub.sqlite3') as db:
    db.executescript('''CREATE TABLE books(id TEXT PRIMARY KEY,title TEXT NOT NULL,publisher TEXT,year TEXT,sha256 TEXT,source_path TEXT,rights TEXT);
CREATE TABLE chapters(id TEXT PRIMARY KEY,book_id TEXT NOT NULL,title TEXT NOT NULL,locator TEXT NOT NULL,position INTEGER NOT NULL,body TEXT NOT NULL);''')
    db.execute('INSERT INTO books VALUES(?,?,?,?,?,?,?)', ('fixture', 'Тестовое издание', 'Тестовый издатель', '2011', pdf_hash, str(pdf), 'Тестовая запись'))
    db.execute('INSERT INTO chapters VALUES(?,?,?,?,?,?)', ('fixture-1', 'fixture', 'Житие Мартирия Зеленецкого', 'страницы PDF 1-2', 0, 'Тестовое содержание главы.'))
    db.execute('INSERT INTO books VALUES(?,?,?,?,?,?,?)', ('trial', 'Тестовый фрагмент', 'Издатель', '2011', 'trial', 'trial.epub', 'Ознакомительный фрагмент'))
    db.execute('INSERT INTO chapters VALUES(?,?,?,?,?,?)', ('trial-1', 'trial', 'Скрытый фрагмент', 'content.html#1', 0, 'Фрагмент не показывается.'))
    db.execute('INSERT INTO books VALUES(?,?,?,?,?,?,?)', ('kids-saints', 'Тестовая книга для детей', 'Тестовый издатель', '2011', pdf_hash, '/missing/kids-saints.pdf', 'Тестовая запись'))
    db.execute('INSERT INTO chapters VALUES(?,?,?,?,?,?)', ('kids-saints-2', 'kids-saints', 'Святитель Николай Чудотворец', 'страницы PDF 1-2', 0, 'Тестовое житие святителя Николая.'))
    db.execute('INSERT INTO chapters VALUES(?,?,?,?,?,?)', ('kids-saints-26', 'kids-saints', 'Петр и Феврония Муромские', 'страницы PDF 1-2', 1, 'Тестовое общее житие Петра и Февронии.'))
    db.execute('INSERT INTO chapters VALUES(?,?,?,?,?,?)', ('kids-saints-27', 'kids-saints', 'Святители Василий Великий и Григорий Богослов', 'страницы PDF 1-2', 2, 'Тестовое общее житие Василия и Григория.'))
    db.execute('INSERT INTO chapters VALUES(?,?,?,?,?,?)', ('kids-saints-20', 'kids-saints', 'Преподобный Досифей', 'страницы PDF 1-2', 3, 'Тестовое житие Досифея.'))
    db.execute('INSERT INTO chapters VALUES(?,?,?,?,?,?)', ('kids-saints-23', 'kids-saints', 'Иоанн Креститель', 'страницы PDF 1-2', 4, 'Тестовое житие Иоанна Предтечи.'))
    db.execute('INSERT INTO chapters VALUES(?,?,?,?,?,?)', ('kids-saints-22', 'kids-saints', 'История Киево-Печерской Лавры', 'страницы PDF 1-2', 5, 'История Илариона, Антония, Феодосия и Нестора.'))
    db.execute('INSERT INTO chapters VALUES(?,?,?,?,?,?)', ('kids-saints-19', 'kids-saints', 'Сорок мучеников Севастийских', 'страницы PDF 1-2', 6, 'Тестовая история сорока мучеников.'))
    db.execute('INSERT INTO chapters VALUES(?,?,?,?,?,?)', ('kids-saints-5', 'kids-saints', 'Великомученик Евстафий Плакида', 'страницы PDF 1-2', 7, 'Тестовое житие Евстафия, Феопистии и их детей.'))

with sqlite3.connect(destination / 'indexes.sqlite3') as db:
    db.execute('''CREATE TABLE index_pages(book_number INTEGER NOT NULL,page INTEGER NOT NULL,left_text TEXT NOT NULL,right_text TEXT NOT NULL,is_index INTEGER NOT NULL,leaders INTEGER NOT NULL,source_sha256 TEXT NOT NULL,PRIMARY KEY(book_number,page))''')
    db.execute('INSERT INTO index_pages VALUES(?,?,?,?,?,?,?)', (1, 2, 'Мамант* мученик ...........| 2| 74\n' + 'Тестовый святой ...........| 3| 75\n' * 55, '', 1, 56, pdf_hash))
    db.execute('INSERT INTO index_pages VALUES(?,?,?,?,?,?,?)', (3, 14, 'Спиридон святитель ...........| 112\nФеофан святитель ...........| 113\nВоскресение Христово ............ прил. 3\nМарфа мученица ...........| 2| 4\nИоанн мученик ...........| 2| 4\nДиодор мученик ...........| 2| 3\nДидим мученик ...........| 2| 3\nИона пророк ...........| 2| 3', '', 1, 8, john_hash))

with sqlite3.connect(destination / 'indexes.sqlite3') as db:
    db.execute('CREATE TABLE john_contents_pages(page INTEGER PRIMARY KEY,body TEXT NOT NULL,source_sha256 TEXT NOT NULL)')
    db.execute('INSERT INTO john_contents_pages VALUES(?,?,?)', (821, 'Глава 1. В Харькове\nПроповедь о вере', john_hash))
    db.execute('INSERT INTO john_contents_pages VALUES(?,?,?)', (822, 'Чужое издание', 'different-edition'))
