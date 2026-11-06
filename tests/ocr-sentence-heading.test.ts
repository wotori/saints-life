import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionHeadings, sectionForIndexedName } from '../src/lib/book-sections';

test('authored martyr sermons retain their author and separate adjacent works', () => {
  for (const author of ['Василия Великого', 'Иоанна Златоуста']) {
    const title = `Слово святого ${author}`;
    const body = `Конец предыдущего слова.\n\n${title}\n\nО СВЯТОМ МУЧЕНИКЕ ВАРЛААМЕ\n\n1. Начало слова.`;
    assert.deepEqual(sectionHeadings(body), [{ offset: body.indexOf(title), title: `${title} О СВЯТОМ МУЧЕНИКЕ ВАРЛААМЕ` }]);
    assert.deepEqual(sectionHeadings(`${title}\n\nОбычное предложение.`), []);
    assert.deepEqual(sectionHeadings(`${title} 505\n\nО СВЯТОМ МУЧЕНИКЕ ВАРЛААМЕ`), []);
    assert.deepEqual(sectionHeadings(`${title} о мученике Варлааме 505\n\nТекст.`), []);
    assert.deepEqual(sectionHeadings(`${title}\n\nО СВЯТОМ МУЧЕНИКЕ ВАРЛААМЕ говорится далее.`), []);
  }
});

test('church dedication starts a separate work without swallowing the previous life', () => {
  const text = 'Конец страдания.\n\nОСВЯЩЕНИЕ ХРАМА СВЯТОГО ВЕЛИКОМУЧЕНИКА\n\nГЕОРГИЯ\nв Лидде\n\nТретьего ноября...';
  assert.deepEqual(sectionHeadings(text), [{ offset: text.indexOf('ОСВЯЩЕНИЕ'), title: 'ОСВЯЩЕНИЕ ХРАМА СВЯТОГО ВЕЛИКОМУЧЕНИКА ГЕОРГИЯ' }]);
  assert.deepEqual(sectionHeadings('Освящение храма состоялось в ноябре.'), []);
  assert.equal(sectionHeadings('ПАМЯТЬ СВЯТОГО\nОСВЯЩЕНИЕ ХРАМА\n\nГЕОРГИЯ\n\nТекст.').length, 2);
});

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

test('praise sermon is separate from the preceding life and retains its author', () => {
  const title = 'Похвальное слово\nСВЯТОМУ АПОСТОЛУ АНДРЕЮ ПЕРВОЗВАННОМУ\nсвятого Иоанна Златоустого';
  const body = 'Конец жития. Аминь.\n\n' + title + '\n\nКрепка сеть апостольского ловления.';
  assert.deepEqual(sectionHeadings(body), [{ offset: body.indexOf('Похвальное'), title: title.replaceAll('\n', ' ') }]);
  assert.equal(body.slice(0, sectionHeadings(body)[0].offset).trim(), 'Конец жития. Аминь.');
  for (const text of [
    'Похвальное слово Андрею Первозванному 771\n\nТекст.',
    'Похвальное слово\nСВЯТОМУ АПОСТОЛУ АНДРЕЮ ПЕРВОЗВАННОМУ\nОбычное предложение.',
    'Похвальное слово\nСвятому апостолу Андрею\nсвятого Иоанна Златоустого',
    title.replace('святого Иоанна Златоустого', 'святого Иоанна Златоустого 770'),
  ]) assert.deepEqual(sectionHeadings(text), []);
});
