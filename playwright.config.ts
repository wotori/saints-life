import { defineConfig, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const fixtureDir = mkdtempSync(path.join(tmpdir(), 'saints-life-e2e-'));
execFileSync('python3', [path.resolve('tests/create_library_fixture.py'), fixtureDir]);
execFileSync(path.resolve('node_modules/.bin/tsx'), [path.resolve('scripts/build-printed-index.ts')], { env: { ...process.env, SAINTS_INDEX_DB: path.join(fixtureDir, 'indexes.sqlite3'), SAINTS_OCR_DB: path.join(fixtureDir, 'ocr.sqlite3') } });
const fixtureIndex = new DatabaseSync(path.join(fixtureDir, 'indexes.sqlite3'));
fixtureIndex.prepare("UPDATE printed_entries SET review_status='reviewed' WHERE book_number=1 AND index_page=2 AND line_number=0").run();
fixtureIndex.prepare("UPDATE printed_entries SET review_status='reviewed',printed_day=NULL,printed_page=3 WHERE book_number=3 AND index_page=14 AND line_number=2").run();
fixtureIndex.prepare("UPDATE printed_entries SET review_status='reviewed' WHERE book_number=3 AND index_page=14 AND line_number=3").run();
fixtureIndex.exec('CREATE TABLE numeric_reference_evidence(book_number INTEGER,index_page INTEGER,line_number INTEGER,fingerprint TEXT,printed_day INTEGER,printed_page INTEGER,confidence REAL,method TEXT)');
fixtureIndex.prepare("INSERT INTO numeric_reference_evidence SELECT 3,14,0,fingerprint,1,2,99,'tesseract-columns-v1' FROM printed_entries WHERE book_number=3 AND index_page=14 AND line_number=0").run();
fixtureIndex.exec("INSERT INTO numeric_reference_evidence VALUES(3,14,1,'stale',1,3,99,'tesseract-columns-v1')");
fixtureIndex.close();
process.on('exit', () => rmSync(fixtureDir, { recursive: true, force: true }));

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 60000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3101', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', channel: 'chrome' } },
  ],
  webServer: { command: 'npm run start -- --port 3101', url: 'http://127.0.0.1:3101', reuseExistingServer: false, timeout: 120_000, env: { SAINTS_SOURCES_DIR: fixtureDir, SAINTS_OCR_DB: path.join(fixtureDir, 'ocr.sqlite3'), SAINTS_LIBRARY_DB: path.join(fixtureDir, 'epub.sqlite3'), SAINTS_INDEX_DB: path.join(fixtureDir, 'indexes.sqlite3') } },
});
