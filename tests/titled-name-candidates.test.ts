import test from 'node:test';
import assert from 'node:assert/strict';
import { titledNameCandidates, scanTitledNameCandidates } from '../src/lib/titled-name-candidates';

test('title hints retain literal cases, line breaks, repeated mentions and Unicode codepoint offsets', () => {
  const body = '😀 Святой Ираклид; святого\nПавла. Блаженная Сильвия. Святой папа Феликс. Святой Ираклид.';
  const found = titledNameCandidates(body);
  assert.deepEqual(found.map(row => row.candidate), ['Ираклид', 'Павла', 'Сильвия', 'Феликс']);
  assert.equal(found[0].offsets.length, 2);
  for (const row of found) for (const offset of row.offsets) {
    assert.equal(Array.from(body).slice(offset, offset + Array.from(row.candidate).length).join(''), row.candidate);
  }
});

test('known false terms, honorary superlatives and broken OCR names do not become named-person hints', () => {
  assert.deepEqual(titledNameCandidates('Святой Дух. Святая Троица. Святое Евангелие. Святой Ангел. Святейший Ермон. Святой Иоа-\nнн. СВЯТОЙ ПАВЕЛ.'), []);
  assert.deepEqual(titledNameCandidates('святой Борис-Михаил').map(row => row.candidate), ['Борис-Михаил']);
});

test('righteous people and hierarchs are discoverable without changing literal source spelling', () => {
  const body = '😀 Праведный Симеон; праведной Анны; праведному Иову; святитель Николай; святителя\nГригория. Неправедный Судия. Святительство Ивана.';
  const found = titledNameCandidates(body);
  assert.deepEqual(found.map(row => row.candidate), ['Симеон', 'Анны', 'Иову', 'Николай', 'Григория']);
  for (const row of found) for (const offset of row.offsets) {
    assert.equal(Array.from(body).slice(offset, offset + Array.from(row.candidate).length).join(''), row.candidate);
  }
});

test('liturgical phrases leave auditable exclusions without hiding adjacent names or similar names', () => {
  const body = '😀 святой Церкви; святого Креста; святой Пасхи; святую Четыредесятницу; святой Пятидесятницы; святой Евхаристии; святому Причастию; святого Причащения; святого Синода. Святой Пасхалий; святой Христофор; святой Крест-Иван; святой Иоанн.';
  const scan = scanTitledNameCandidates(body);
  assert.deepEqual(scan.candidates.map(row => row.candidate), ['Пасхалий', 'Христофор', 'Крест-Иван', 'Иоанн']);
  assert.equal(scan.excludedTerms.length, 9);
  for (const row of [...scan.candidates, ...scan.excludedTerms]) for (const offset of row.offsets) {
    assert.equal(Array.from(body).slice(offset, offset + Array.from(row.candidate).length).join(''), row.candidate);
  }
});

test('earlier exclusions remain recoverable with every repeated occurrence', () => {
  const scan = scanTitledNameCandidates('Святой Дух; святого Духа; святой Дух; святой Павел.');
  assert.deepEqual(scan.candidates.map(row => row.candidate), ['Павел']);
  assert.deepEqual(scan.excludedTerms.map(row => [row.candidate, row.offsets.length]), [['Дух', 2], ['Духа', 1]]);
});

test('sacred modifiers preserve the following name and retain literal exclusion offsets', () => {
  const body = '😀 Мученик Христов Иоанн; мученицы Христовой Наталии; святой Божий Павел; мученика христова\nВиктора. Мученик Христов; святой Божий. Святой Христофор; святой Божидар.';
  const scan = scanTitledNameCandidates(body);
  assert.deepEqual(scan.candidates.map(row => row.candidate), ['Иоанн', 'Наталии', 'Павел', 'Виктора', 'Христофор', 'Божидар']);
  assert.deepEqual(scan.excludedTerms.map(row => [row.candidate, row.offsets.length]), [['Христов', 2], ['Христовой', 1], ['Божий', 2], ['христова', 1]]);
  for (const row of [...scan.candidates, ...scan.excludedTerms]) for (const offset of row.offsets) {
    assert.equal(Array.from(body).slice(offset, offset + Array.from(row.candidate).length).join(''), row.candidate);
  }
});

test('modifier handling does not cross punctuation or discard hyphenated names', () => {
  const scan = scanTitledNameCandidates('Мученик Христов. Павел пришёл. Святой Христов-Иван; святой Божий-Павел. Мученик Христов Иоанн; святой Пётр.');
  assert.deepEqual(scan.candidates.map(row => row.candidate), ['Христов-Иван', 'Божий-Павел', 'Иоанн', 'Пётр']);
  assert.equal(scan.excludedTerms[0].offsets.length, 2);
});

test('martyr and confessor titles find literal names without requiring an additional holy prefix', () => {
  const body = '😀 Мученик Виктор; мученицы Наталии; священномученику Клименту; священномученицей Фотинией; преподобномученика Никона; преподобномученице Февронии; исповедник Максим; исповеднице Феодоре; святой мученик Виктор. Лжемученик Павел; мученическая Анна; исповеднический Иоанн.';
  const found = titledNameCandidates(body);
  assert.deepEqual(found.map(row => row.candidate), ['Виктор', 'Наталии', 'Клименту', 'Фотинией', 'Никона', 'Февронии', 'Максим', 'Феодоре']);
  assert.equal(found[0].offsets.length, 2);
  for (const row of found) for (const offset of row.offsets) {
    assert.equal(Array.from(body).slice(offset, offset + Array.from(row.candidate).length).join(''), row.candidate);
  }
});
