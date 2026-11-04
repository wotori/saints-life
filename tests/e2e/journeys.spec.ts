import { test, expect } from '@playwright/test';

test('home, search aliases, pagination, clear filters and missing results', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('У каждой жизни');
  await page.getByRole('textbox', { name: 'Имя святого' }).fill('Дмитрий');
  await page.getByRole('button', { name: 'Найти святого', exact: true }).click();
  await expect(page.locator('.results-bar')).toContainText('68');
  await page.getByRole('navigation', { name: 'Страницы каталога' }).getByRole('link', { name: '2', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('.saint-card')).toHaveCount(12);
  await page.getByLabel('Традиция', { exact: true }).selectOption('old-believer');
  await page.getByRole('button', { name: 'Применить' }).click();
  await expect(page.locator('.saint-card')).toHaveCount(1);
  await expect(page.locator('.saint-card')).toContainText('Солунский');
  await page.getByRole('searchbox', { name: 'Поиск святых' }).fill('неттакогоимени');
  await page.getByRole('button', { name: 'Искать', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Пока не нашли это имя' })).toBeVisible();
  await page.getByRole('link', { name: 'Сбросить фильтры' }).click();
  await expect(page.locator('.results-bar')).toContainText('69');
  await expect(page.getByRole('searchbox', { name: 'Поиск святых' })).toHaveValue('');
  await expect(page.getByLabel('Традиция', { exact: true })).toHaveValue('');
  expect(errors).toEqual([]);
});

test('reader provenance, independent editions, settings and persistent bookmarks', async ({ page }) => {
  await page.goto('/saints/dimitrij-solunskij');
  await expect(page.locator('.reading-body')).toContainText('Жизнь и исповедание веры');
  await expect(page.locator('.reader-provenance')).toContainText('Редакция Saints Life');
  await page.getByRole('button', { name: 'Увеличить шрифт' }).click();
  await expect(page.locator('.reading-body')).toHaveCSS('font-size', '22px');
  await page.getByRole('button', { name: 'Тёмная тема чтения' }).click();
  await expect(page.locator('.reader')).toHaveClass(/reader-dark/);
  await page.getByRole('button', { name: 'Сохранить закладку' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Удалить закладку' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'По Димитрию Ростовскому' }).click();
  await expect(page.locator('.reader-provenance')).toContainText('Святитель Димитрий Ростовский');
  await expect(page.getByRole('link', { name: 'Открыть полный текст' })).toHaveAttribute('href', 'https://pravoslavie.ru/57273.html');
  await expect(page.locator('.reading-body')).not.toContainText('Жизнь и исповедание веры');
  await page.getByRole('link', { name: 'Старообрядческая публикация' }).click();
  await expect(page.locator('.reader-provenance')).toContainText('Русская вера');
  await page.goto('/saints/dimitrij-belyaev');
  await expect(page.getByRole('heading', { name: 'Жизнеописание ещё не добавлено' })).toBeVisible();
});

test('calendar physical day, both styles, independent traditions, day links and shareable state', async ({ page }) => {
  await page.goto('/calendar?date=2026-11-08');
  await expect(page.locator('.calendar-saint')).toHaveCount(3);
  await page.getByRole('button', { name: 'Старый стиль', exact: true }).click();
  await expect(page.locator('.month-navigation')).toContainText('октябрь');
  await expect(page.locator('.month-grid button.selected')).toContainText('26');
  await expect(page.locator('.day-panel > h2')).toHaveText('8 ноября');
  await page.getByLabel('Традиция календаря').selectOption('old-believer');
  await expect(page.locator('.calendar-saint')).toHaveCount(1);
  await expect(page.locator('.calendar-saint')).toContainText('Солунский');
  await page.reload();
  await expect(page.locator('.month-grid button.selected')).toContainText('26');
  await expect(page.getByLabel('Традиция календаря')).toHaveValue('old-believer');
  await page.getByLabel('Перейти к дате', { exact: true }).fill('2026-04-27');
  await expect(page.locator('.calendar-saint')).toContainText('Аввакум');
  await page.locator('.calendar-saint').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Аввакум');
  await page.goto('/calendar?date=invalid');
  await expect(page.locator('.month-grid')).toBeVisible();
});

test('sources, actual 404 status and responsive layouts', async ({ page }, testInfo) => {
  for (const route of ['/', '/saints', '/saints/dimitrij-solunskij', '/calendar?date=2026-11-08', '/sources', '/about']) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), route).toBe(true);
    if (route === '/' || route.startsWith('/calendar') || route.includes('solunskij')) await page.screenshot({ path: `test-results/${testInfo.project.name}-${route === '/' ? 'home' : route.startsWith('/calendar') ? 'calendar' : 'reader'}.png`, fullPage: true });
  }
  await page.goto('/sources');
  await expect(page.locator('.source-row')).toHaveCount(13);
  const response = await page.goto('/saints/no-such-saint');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Этот лист пока пуст.' })).toBeVisible();
});
