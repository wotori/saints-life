import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionHeadings, sectionForIndexedName } from '../src/lib/book-sections';

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
