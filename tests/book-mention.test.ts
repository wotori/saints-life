import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BookMention } from '../src/components/book-mention';

test('rendered mention cites its own edition and preserves PDF page and reading links', () => {
  const john = renderToStaticMarkup(createElement(BookMention, { book: 13, page: 568, name: 'Пётр (Могила)' }));
  assert.match(john, /Сретенского монастыря, 2014/);
  assert.match(john, /страница PDF 568/);
  assert.match(john, /href="\/library\/book\/13\/568\?focus=/);
  assert.match(john, /href="\/api\/library\/book\/13\/568"/);
  assert.doesNotMatch(john, /Ковчег/);
  const rostovsky = renderToStaticMarkup(createElement(BookMention, { book: 11, page: 674, name: 'Пётр (Могила)' }));
  assert.match(rostovsky, /Ковчег/);
  assert.match(rostovsky, /2010/);
  assert.doesNotMatch(rostovsky, /Сретенского/);
});
