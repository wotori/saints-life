import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { reviewedBookSupplement, withoutPreviousWorkSupplements } from '../src/lib/reviewed-book-supplements';

const body = 'Next life\n\nContinued note. End of note.\n\nNotes of next life.';
const record = { book: 11, firstPage: 29, heading: 'Heading', sourceSha256: 'edition', page: 34, pageTextSha256: createHash('sha256').update(body).digest('hex'), start: 'Continued note.', end: 'End of note.' };

test('continued footnote excludes the next life and its own notes', () => {
  assert.equal(reviewedBookSupplement(11, 29, 'Heading', 'edition', 34, body, [record]), 'Continued note. End of note.');
  assert.equal(reviewedBookSupplement(11, 34, 'Heading', 'edition', 34, body, [record]), undefined);
  assert.equal(reviewedBookSupplement(11, 29, 'Heading', 'other-edition', 34, body, [record]), undefined);
  assert.equal(reviewedBookSupplement(11, 29, 'Heading', 'edition', 34, `${body} changed`, [record]), undefined);
  assert.equal(reviewedBookSupplement(11, 29, 'Heading', 'edition', 34, body, [record, record]), undefined);
});

test('the next work keeps its own notes but excludes a verified preceding footnote', () => {
  const result = withoutPreviousWorkSupplements(11, 34, 'edition', 34, body, body, [record]);
  assert.ok(result.includes('Next life'));
  assert.ok(result.includes('Notes of next life.'));
  assert.ok(!result.includes('Continued note.'));
  assert.equal(withoutPreviousWorkSupplements(11, 29, 'edition', 34, body, body, [record]), body);
  assert.equal(withoutPreviousWorkSupplements(11, 34, 'other-edition', 34, body, body, [record]), body);
  assert.equal(withoutPreviousWorkSupplements(11, 34, 'edition', 34, body + ' changed', body, [record]), body);
});

test("two works starting on the same page keep separate footnotes", () => {
  const page = "554 День двадиать восьмой (10 апреля по н. ст.)\n\nПАМЯТЬ ПРЕПОДОБНОГО ОТЦА НАШЕГО\nСТЕФАНА ИСПОВЕДНИКА\n\nреподобный Стефан, исповедник Христов, жил при царе Льве\nАрмянине'. С детства возлюбив постническое житие и украсив\nсебя добродетельною жизнью, он был впоследствии игуменом Три-\nглийского монастыря?, приняв сан игумена вследствие усиленных\nпросьб братии; учением своим он увещевал многих богоугодно и в\nчистоте проводить жизнь. Но вот нечестивый царь Лев Армянин воз-\nдвиг лютое гонение на христиан, уничтожая святые иконы. Тогда он\nпризвал преподобного Стефана и начал принуждать его изменить\nправославной вере, отказаться от поклонения святым иконам и соб-\nственноручно подписать свое отречение от Православия.\nПреподобный же не только отказался сделать это, но укорял царя\nза его нечестие. За свою твердость в Православии преподобный Сте-\nфан принял многие муки и темничные узы; потом был сослан в за-\nточение, и здесь, дойдя до крайнего истощения от страданий и бо-\nлезней, преподобный Стефан отошел ко Христу Богу?з, ради Которого\nпретерпел многие муки и принял смерть.\n\nПОВЕСТЬ\nО ТАКСИОТЕ ВОИНЕ\n\nКарфагене* жил один муж, по имени Таксиот, воин, проводив-\nший жизнь свою в великих грехах. Однажды город Карфаген\nпостигла заразная болезнь, от которой умирало много людей; Так-\n\n' Лев У Армянин — император Византийский, царствовал с 813 по 820 год.\n\n? Триглийский монастырь находился в окрестностях Константинополя.\n\n3 Кончина святого Стефана последовала после 815 года (в том году он был\nсослан в заточение).\n\n* Карфаген — знаменитая в древности колония финикиян, находившаяся на\nсевере Африки. Своего высшего расцвета древний Карфаген достиг во П веке до\nРождества Христова, но на развалинах древнего Карфагена, при первых римских\nимператорах, возник новый Карфаген, который существовал довольно продолжи-\nтельное время.\n";
  const previous = "ПАМЯТЬ ПРЕПОДОБНОГО ОТЦА НАШЕГО СТЕФАНА ИСПОВЕДНИКА";
  const current = "ПОВЕСТЬ О ТАКСИОТЕ ВОИНЕ";
  const entry = { book: 7, firstPage: 556, page: 556, heading: previous, sourceSha256: "edition", pageTextSha256: createHash("sha256").update(page).digest("hex"), start: "' Лев У Армянин", end: "сослан в заточение)." };
  const cleaned = withoutPreviousWorkSupplements(7, 556, "edition", 556, page, page, [entry], current);
  assert.ok(!cleaned.includes(entry.start));
  assert.ok(cleaned.includes("Карфаген"));
  assert.equal(withoutPreviousWorkSupplements(7, 556, "edition", 556, page, page, [entry], previous), page);
  assert.equal(withoutPreviousWorkSupplements(7, 556, "other", 556, page, page, [entry], current), page);
  assert.equal(withoutPreviousWorkSupplements(7, 556, "edition", 556, page + " changed", page, [entry], current), page);
});
