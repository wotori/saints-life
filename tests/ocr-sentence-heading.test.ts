import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionHeadings, sectionForIndexedName } from '../src/lib/book-sections';

test('Protection sermon preserves a lowercase preposition inside its display heading', () => {
  const body = 'ДЕНЬ ПЕРВЫЙ\n\nСЛОВО на ПОКРОВ\nПРЕСВЯТОЙ БОГОРОДИЦЫ\n\nВ последние тяжкие времена,';
  assert.deepEqual(sectionHeadings(body), [{ offset: body.indexOf('СЛОВО'), title: 'СЛОВО на ПОКРОВ ПРЕСВЯТОЙ БОГОРОДИЦЫ' }]);
  assert.deepEqual(sectionHeadings('СЛОВО на обычную тему\n\nТекст.'), []);
  assert.deepEqual(sectionHeadings('СЛОВО на ПОКРОВ объясняет праздник.\n\nТекст.'), []);
});

test('uppercase sentence ending does not truncate the Agathopous and Theodulus account', () => {
  const first = 'СТРАДАНИЕ СВЯТЫХ МУЧЕНИКОВ\nАГАФОПОДА и ФЕОДУЛА\n\nТекст рассказа.';
  const continued = 'если не хочешь в мучениях окончить\nЖИЗНЬ СВОЮ.\n\nСвятой же Феодул отвечал ему:\nРассказ продолжается.';
  assert.deepEqual(sectionHeadings(continued), []);
  const pages = new Map([[73, first], [74, continued]]);
  assert.deepEqual(sectionForIndexedName(page => {
    const body = pages.get(page);
    return body === undefined ? undefined : { body, headings: sectionHeadings(body) };
  }, 74, 'Феодул'), { page: 73, section: 0 });
  assert.equal(sectionHeadings('ЖИЗНЬ\nСВЯТОГО ПАВЛА\n\nРассказ.').length, 1);
});
