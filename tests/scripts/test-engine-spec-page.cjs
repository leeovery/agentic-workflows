'use strict';

// ---------------------------------------------------------------------------
// The person's review page (leeway-engine/scripts/domain/spec-page.cjs):
// `engine spec page <unit>`, writing the one fixed page with the spec as its
// data and the store's first writes — every line with its tick and flags,
// each screen after its line, each area's count, Claude's tick on each line
// as the page's model draws it, and the page declaring `db` alone (11.11.2,
// 11.11.3, 11.11.5, 11.11.13, 11.11.15, 11.S23, 11.S32); `engine spec
// published <unit> <url>`, which opens the page and answers where its marks
// are read back to; `engine spec push <unit>
// --store [--reason] [--from]`, planning what a re-land changed for the open
// page against the store's listing — one numbered change with its reason
// and the lines that led to it, earlier wordings kept oldest first, a
// removed line kept where it stood, an area emptied and brought back, a line
// brought back, a change to sources alone recording none, a push that
// stopped finished, and the documents the store holds named for
// `if_version` (11.11.6, 11.11.17, 11.S28, 11.S33); each refusal writing
// nothing; and the page's own rules, its state functions run from the
// template: Claude's tick never over a line changed since the person's tick,
// the person's untick holding on any wording, To do the lines waiting on
// the person, a line the person marked under a filter staying in its view,
// and no snapshot moving the page before the saved line has landed
// (11.11.4, 11.11.6, 11.11.16, 11.11.19).
//
// Layer: verb; the page's rules, unit. World, built once and copied: an epic, `payments`, its one
// topic `cards` decided, its entries written through the ledger's verbs — a
// decision of the person's, a call of Claude's, a "don't care" decision and
// a finding — and its spec landed citing them.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  ok, refusedPristine, statePath, layout, writeState, commitAll, fixtureFrom, cleanupFixture, withFrozenClock, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { MADE, ledgerHelpers } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { specPage } = require(path.join(SCRIPTS, 'domain/spec-page-model.cjs'));

const UNIT = 'payments';
const SPEC = layout.unit(UNIT, 'spec.md');
const PAGE = layout.cache(UNIT, 'specification', 'page');
const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });
const AT = FROZEN_AT.replace(/\.[0-9]{3}Z$/, 'Z');
const TITLE = "Payments & <Refunds> $' $&";
const URL = 'https://claude.ai/public/artifacts/0123';
const TEMPLATE = path.join(SCRIPTS, '../content/spec-page/page.html');

/** The epic's manifest, its one topic's discussion as `status` gives it. @param {string} dir @param {string} status @param {Record<string, unknown>} [more] */
function payments(dir, status, more = {}) {
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: { discovery: { items: { cards: { order: 1, summary: 'Cards', source: 'discovery' } } }, discussion: { items: { cards: { status } } } },
    ...more,
  });
}

/** Each entry's short id by name, filled as the world is built. @type {Record<string, string>} */
const made = {};

/** The spec's first part's statements, as landed. */
const STATEMENTS = () => [
  `1.1.1 Visa and Mastercard are taken. [${made.taken}]`,
  `1.1.2 An unknown brand is refused. [${made.call}]`,
  `1.1.3 Corners are ten points. [builder: ${made.radius}]`,
  `Screen: the form. [${made.taken}, ${made.brand}]`,
  '```text\nCARD  ____ ____\n```',
  `1.1.4 The form shows the card's brand, $& and $' as typed. [${made.brand}]`,
  `1.1.5 A declined card is refused. [${made.taken}]`,
];

/** The spec, its first part's statements as given, with or without its second area. @param {string[]} statements @param {boolean} [refunds] */
function spec(statements, refunds = true) {
  return [
    `# ${TITLE}`, '', 'How to read it.', '', '## 1. Cards', '', '### 1.1 The form', '', ...statements.flatMap((line) => [line, '']),
    '## 1-S. Scenarios for §1', '',
    '1.S1 Given a form, when it is sent, then the card is charged. (1.1.1, 1.1.3)', '',
    ...(refunds ? ['## 2. Refunds', '', '### 2.1 Whole', '', `2.1.1 A refund goes back to the card. [builder: ${made.radius}]`, ''] : []),
  ].join('\n');
}

const world = fixtureFrom('spec-page-', (dir) => {
  payments(dir, 'in-progress');
  commitAll(dir, 'init');
  const { write } = ledgerHelpers(() => dir);
  const at = `${UNIT}.discussion.cards`;
  const ask = (/** @type {string} */ text) => write('ask', at, [], { ...PERSON, text }).id;
  const decide = (/** @type {string} */ question, /** @type {string} */ text, content = {}) => write('decide', at, ['--answers', question], { ...PERSON, text, why: `Why: ${text}`, ...content }).id;
  made.taken = decide(ask('Which cards are taken?'), 'Visa and Mastercard.');
  made.call = decide(ask('What of an unknown brand?'), 'Refused.', MADE);
  made.radius = decide(ask('What radius are the corners?'), 'Ten points.', { ...MADE, given: 'dont-care' });
  made.brand = write('find', at, [], { ...MADE, text: 'The form shows the card\'s brand.', how: 'read in the code', known: 'read' }).id;
  payments(dir, 'completed');
  commitAll(dir, 'topics settled');
  writeState(dir, SPEC, spec(STATEMENTS()));
  ok(dir, ['spec', 'land', UNIT]);
});

let dir = '';
beforeEach(() => { dir = world(); });
afterEach(() => { cleanupFixture(dir); });

/** A verb's answer, the clock frozen. @param {string[]} args */
const frozen = (args) => withFrozenClock(() => ok(dir, args));

/** The page built: its answer. */
const build = () => frozen(['spec', 'page', UNIT]);

/** The page built and published: its first writes. */
function opened() {
  const { batches } = build();
  frozen(['spec', 'published', UNIT, URL]);
  return batches;
}

/** A JSON file. @param {string} file */
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** A planned folder's writes, in the order its batches send them: `collection/doc` and the document. @param {string[]} batches */
const writesOf = (batches) => batches.flatMap((file) => json(file)).map(({ op, collection, doc_id: doc, file_path: at }) => ({ op, to: `${collection}/${doc}`, body: json(at) }));

/** A planned folder's documents, by `collection/doc`. @param {string[]} batches @returns {Record<string, any>} */
const docsOf = (batches) => Object.fromEntries(writesOf(batches).map(({ to, body }) => [to, body]));

/** The store as ArtifactData's list saves it, holding each planned folder's writes in turn. @param {...string[]} planned */
function listing(...planned) {
  const root = path.join(dir, 'store');
  fs.rmSync(root, { recursive: true, force: true });
  for (const batches of planned) {
    for (const { to, body } of writesOf(batches)) {
      fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true });
      fs.writeFileSync(path.join(root, `${to}.json`), JSON.stringify(body));
    }
  }
  return root;
}

/** The spec re-landed, its first part's statements as given. @param {string[]} statements @param {boolean} [refunds] */
function reland(statements, refunds = true) {
  writeState(dir, SPEC, spec(statements, refunds));
  ok(dir, ['spec', 'land', UNIT]);
}

/** A push planned against `store`: its answer. @param {string} store @param {string[]} [more] */
const push = (store, more = []) => frozen(['spec', 'push', UNIT, '--reason', 'Unknown brands are asked about.', '--store', store, ...more]);

/** A document's fingerprint: the SHA-256 of its JSON without `f`, keys sorted, as the page's store computes it. @param {Record<string, unknown>} doc */
function fOf({ f: _f, ...rest }) {
  const sorted = (/** @type {unknown} */ value) => (Array.isArray(value) ? value.map(sorted)
    : value !== null && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(/** @type {any} */ (value)[key])])) : value);
  return crypto.createHash('sha256').update(JSON.stringify(sorted(rest))).digest('hex').slice(0, 12);
}

/** A line of an area as its items hold it, by id. @param {Record<string, any>} area @param {string} id */
const itemIn = (area, id) => area.items.find((/** @type {{id?: string}} */ item) => item.id === id);

describe('spec page: the page and its first writes (11.11.2, 11.11.13, 11.S23)', () => {
  it('answers the page, its title, the capabilities declaring db alone, and the batches to send in order (11.11.5)', () => {
    const page = statePath(dir, PAGE);
    assert.deepStrictEqual(build(), {
      ok: true,
      unit: UNIT,
      page: path.join(page, 'page.html'),
      title: TITLE,
      icon: 'checklist',
      capabilities: { db: { rules: ['spec', 'history', 'changes', 'assess', 'live'].map((at) => ({ path: at, read: 'view', write: 'admin' })) } },
      lines: 8,
      batches: [path.join(page, 'seed', 'batch-1.json')],
    });
  });

  it('the page is the fixed template, its title escaped and the spec its data, nothing else changed', () => {
    const { page, batches } = build();
    const html = fs.readFileSync(page, 'utf8');
    const data = /<script type="application\/json" id="spec-data">(.*)<\/script>/.exec(html)?.[1] ?? '';
    const template = fs.readFileSync(TEMPLATE, 'utf8');
    assert.strictEqual(html, template.replaceAll('%%TITLE%%', () => 'Payments &amp; &lt;Refunds&gt; $&#x27; $&amp;').replace('%%DATA%%', () => data));
    assert.ok(data.includes("$& and $' as typed"), 'a replacement pattern in the data is kept as written');
    assert.ok(!data.includes('<'), 'a < in the data is escaped, so it never closes its script');
    const docs = docsOf(batches);
    const { c: _c, f: _f, ...index } = docs['spec/index'];
    assert.deepStrictEqual(JSON.parse(data), { index: { ...index, f: fOf(index) }, s1: docs['spec/s1'], s2: docs['spec/s2'] });
  });

  it('every line is an item with its id, number and flags, each screen after its line, each area counted (11.11.3)', () => {
    const docs = docsOf(build().batches);
    const lines = (/** @type {string} */ doc) => docs[doc].items.map((/** @type {Record<string, unknown>} */ { k, t, id, num, kind, after, flags }) => (k === 'line' ? { id, num, kind, after, flags } : { k, t }));
    assert.deepStrictEqual(lines('spec/s1'), [
      { k: 'h3', t: '1.1 The form' },
      { id: '1-1-1', num: '1.1.1', kind: 'statement', after: undefined, flags: [] },
      { id: '1-1-2', num: '1.1.2', kind: 'statement', after: undefined, flags: ['claude'] },
      { id: '1-1-3', num: '1.1.3', kind: 'statement', after: undefined, flags: ['builder'] },
      { id: '1-1-3-scr1', num: 'screen', kind: 'screen', after: '1.1.3', flags: ['screen'] },
      { id: '1-1-4', num: '1.1.4', kind: 'statement', after: undefined, flags: [] },
      { id: '1-1-5', num: '1.1.5', kind: 'statement', after: undefined, flags: [] },
      { k: 'h2s', t: 'Scenarios for §1' },
      { id: '1-S1', num: '1.S1', kind: 'scenario', after: undefined, flags: [] },
    ]);
    const { sections, total, title, h1, intro, c } = docs['spec/index'];
    assert.deepStrictEqual({ sections, total, title, h1, intro, c }, {
      sections: [{ num: 1, title: 'Cards', count: 7 }, { num: 2, title: 'Refunds', count: 1 }], total: 8, title: TITLE, h1: TITLE, intro: '\n\nHow to read it.\n\n', c: 0,
    });
  });

  it('each area is the model\'s, every document carrying its fingerprint', () => {
    const docs = docsOf(build().batches);
    const model = specPage(dir, UNIT);
    for (const { num, items } of model.sections) assert.deepStrictEqual(docs[`spec/s${num}`], { items, f: fOf({ items }) });
    assert.strictEqual(docs['spec/index'].f, fOf(docs['spec/index']));
  });

  it('Claude\'s tick on each line as the model draws it, with its reason and the wording it holds for (11.11.15, 11.S32)', () => {
    const docs = docsOf(build().batches);
    const model = specPage(dir, UNIT);
    const expected = (/** @type {number} */ section) => ({
      lines: Object.fromEntries(model.lines.filter((line) => line.section === section).map(({ id, h }) => [id, { ...model.ticks.get(id), h, at: AT }])),
    });
    assert.deepStrictEqual({ s1: docs['assess/s1'], s2: docs['assess/s2'] }, { s1: expected(1), s2: expected(2) });
    const verdicts = Object.fromEntries(Object.entries(docs['assess/s1'].lines).map(([id, { v }]) => [id, v]));
    assert.deepStrictEqual(verdicts, { '1-1-1': 'soft', '1-1-2': 'open', '1-1-3': 'soft', '1-1-3-scr1': 'soft', '1-1-4': 'soft', '1-1-5': 'soft', '1-S1': 'soft' });
  });

  it('the first writes: the areas, the index, the ticks, then the status line empty; no history and no change yet', () => {
    const writes = writesOf(build().batches);
    assert.deepStrictEqual(writes.map(({ op, to }) => `${op} ${to}`), [
      'set spec/s1', 'set spec/s2', 'set spec/index', 'set assess/s1', 'set assess/s2', 'set live/status',
    ]);
    assert.deepStrictEqual(writes.at(-1)?.body, { x: '', at: AT });
  });

  it('writes in batches of at most 40', () => {
    const areas = Array.from({ length: 20 }, (_, k) => k + 3).flatMap((n) => [`## ${n}. Area ${n}`, '', `### ${n}.1 Part`, '', `${n}.1.1 Holds. [builder: ${made.radius}]`, '']);
    writeState(dir, SPEC, `${spec(STATEMENTS())}\n${areas.join('\n')}`);
    ok(dir, ['spec', 'land', UNIT]);
    assert.deepStrictEqual(build().batches.map((file) => json(file).length), [40, 6]);
  });
});

describe('spec page: refusals', () => {
  it('refuses a unit the project lacks, writing nothing', () => {
    assert.match(refusedPristine(dir, ['spec', 'page', 'nowhere']).error, /^spec page: there is no work unit "nowhere"$/);
  });

  it('refuses a concluded spec, its review ended, writing nothing', () => {
    payments(dir, 'completed', { build: { position: 'auto' } });
    commitAll(dir, 'build begun');
    assert.match(refusedPristine(dir, ['spec', 'page', UNIT]).error, /^spec page: payments's spec is concluded — its review ended when the build began$/);
  });

  it('refuses an area over the store\'s limit, writing nothing', () => {
    writeState(dir, SPEC, spec([...STATEMENTS(), `1.1.6 ${'Café. '.repeat(30000)}[${made.taken}]`]));
    ok(dir, ['spec', 'land', UNIT]);
    assert.match(refusedPristine(dir, ['spec', 'page', UNIT]).error, /^spec page: documents over the store's limit of 245,760 bytes, nothing planned: spec\/s1 \([0-9,]+ bytes\) — split the section$/);
  });

  it('refuses arguments it does not take', () => {
    assert.match(refusedPristine(dir, ['spec', 'page', UNIT, '--title', 'x']).error, /^Usage: engine spec page <work-unit>$/);
  });
});

describe('spec published: the page opened once Claude records its publishing', () => {
  it('records the address and when, beside the page, and answers both, with the file Claude reads its marks back to', () => {
    build();
    assert.deepStrictEqual(frozen(['spec', 'published', UNIT, URL]), {
      ok: true, unit: UNIT, url: URL, at: AT, read_back: statePath(dir, layout.cache(UNIT, 'specification', 'read-back.json')),
    });
    assert.deepStrictEqual(json(statePath(dir, layout.cache(UNIT, 'specification', 'published.json'))), { url: URL, at: AT });
  });

  it('a page published holds its numbers, and building it again keeps it open (11.11.3)', () => {
    opened();
    build();
    const statements = STATEMENTS();
    writeState(dir, SPEC, spec([...statements.slice(0, 6), statements[6].replace('1.1.5', '1.1.6')]));
    assert.match(refusedPristine(dir, ['spec', 'land', UNIT]).error, /1\.1\.6 now holds the wording 1\.1\.5 held/);
  });

  it('a page built and never published is not open: it holds no number', () => {
    build();
    const statements = STATEMENTS();
    reland([...statements.slice(0, 6), statements[6].replace('1.1.5', '1.1.6')]);
  });

  it('refuses a unit with no page built, writing nothing', () => {
    assert.match(refusedPristine(dir, ['spec', 'published', UNIT, URL]).error, /^spec published: payments has no review page built — build it with spec page payments$/);
  });

  it('refuses an address that is no URL, and arguments of another shape, writing nothing', () => {
    build();
    assert.match(refusedPristine(dir, ['spec', 'published', UNIT, 'auto']).error, /^spec published: auto is no page's address — give the artifact's URL$/);
    assert.match(refusedPristine(dir, ['spec', 'published', UNIT]).error, /^Usage: engine spec published <work-unit> <url>$/);
  });
});

describe('spec push: a re-land brought to the open page (11.11.6, 11.11.17, 11.S33)', () => {
  /** The page published and seeded, then 1.1.2 reworded, 1.1.5 removed and 1.1.6 added. */
  function changed() {
    const seed = opened();
    const statements = STATEMENTS();
    reland([statements[0], statements[1].replace('refused', 'asked about'), ...statements.slice(2, 6), `1.1.6 A card is saved. [${made.taken}]`]);
    return seed;
  }

  it('one numbered change, its reason and the lines that led to it, each write planned in order, the documents held named, the page\'s address answered', () => {
    const seed = changed();
    const answer = push(listing(seed), ['--from', '1.1.2,1-1-5']);
    const change = { n: 1, at: AT, why: 'Unknown brands are asked about.', from: ['1-1-2', '1-1-5'], added: ['1-1-6'], reworded: ['1-1-2'], removed: ['1-1-5'] };
    const out = statePath(dir, PAGE, 'push-1');
    assert.deepStrictEqual(answer, {
      ok: true, unit: UNIT, url: URL, change, resumed: false, batches: [path.join(out, 'batch-1.json')], existing: ['spec/s1', 'spec/index', 'assess/s1'],
    });
    assert.deepStrictEqual(writesOf(answer.batches).map(({ to }) => to), ['history/s1', 'changes/c1', 'spec/s1', 'spec/index', 'assess/s1']);
    assert.deepStrictEqual(docsOf(answer.batches)['changes/c1'], change);
    assert.strictEqual(docsOf(answer.batches)['spec/index'].c, 1);
  });

  it('a reworded line keeps its earlier wording, with the change that replaced it', () => {
    const seed = changed();
    const before = itemIn(docsOf(seed)['spec/s1'], '1-1-2');
    const docs = docsOf(push(listing(seed)).batches);
    assert.deepStrictEqual(docs['history/s1'], { lines: { '1-1-2': [{ h: before.h, at: AT, parts: before.parts, c: 1 }] } });
    assert.deepStrictEqual(itemIn(docs['spec/s1'], '1-1-2').parts, [['text', 'An unknown brand is asked about.']]);
  });

  it('a removed line stays where it stood, with the change that removed it', () => {
    const seed = changed();
    const was = itemIn(docsOf(seed)['spec/s1'], '1-1-5');
    const { items } = docsOf(push(listing(seed)).batches)['spec/s1'];
    assert.deepStrictEqual(items.map((/** @type {{k: string, id?: string}} */ { k, id }) => id ?? k), ['h3', '1-1-1', '1-1-2', '1-1-3', '1-1-3-scr1', '1-1-4', '1-1-5', '1-1-6', 'h2s', '1-S1']);
    assert.deepStrictEqual(itemIn({ items }, '1-1-5'), { k: 'removed', id: '1-1-5', num: '1.1.5', kind: 'statement', parts: was.parts, src: was.src, c: 1 });
  });

  it('an area that loses every line keeps them, removed, counted 0; brought back, its lines are added again with their history', () => {
    const seed = opened();
    reland(STATEMENTS(), false);
    const first = push(listing(seed)).batches;
    const emptied = docsOf(first);
    const was = itemIn(docsOf(seed)['spec/s2'], '2-1-1');
    assert.deepStrictEqual([emptied['changes/c1'].removed, emptied['spec/s2'].items], [['2-1-1'], [{ k: 'removed', id: '2-1-1', num: '2.1.1', kind: 'statement', parts: was.parts, src: was.src, c: 1 }]]);
    assert.deepStrictEqual(emptied['spec/index'].sections, [{ num: 1, title: 'Cards', count: 7 }, { num: 2, title: 'Refunds', count: 0 }]);
    reland(STATEMENTS());
    const back = docsOf(push(listing(seed, first)).batches);
    assert.deepStrictEqual([back['changes/c2'].added, itemIn(back['spec/s2'], '2-1-1').k, back['spec/index'].sections[1].count], [['2-1-1'], 'line', 1]);
    assert.deepStrictEqual(back['history/s2'].lines['2-1-1'], [{ h: was.h, at: AT, parts: was.parts, c: 1 }]);
  });

  it('the earlier wordings run oldest first across changes, and Changes holds each', () => {
    const seed = changed();
    const first = push(listing(seed)).batches;
    const statements = STATEMENTS();
    reland([statements[0], statements[1].replace('refused', 'shown a message'), ...statements.slice(2, 6), `1.1.6 A card is saved. [${made.taken}]`]);
    const second = docsOf(push(listing(seed, first)).batches);
    assert.deepStrictEqual(second['history/s1'].lines['1-1-2'].map((/** @type {{c: number}} */ { c }) => c), [1, 2]);
    assert.deepStrictEqual([second['changes/c2'].n, second['spec/index'].c, second['changes/c1']], [2, 2, undefined]);
  });

  it('a line brought back is that line again, the wording removed joining its history', () => {
    const seed = changed();
    const first = push(listing(seed)).batches;
    reland(STATEMENTS().concat(`1.1.6 A card is saved. [${made.taken}]`));
    const docs = docsOf(push(listing(seed, first)).batches);
    const removed = itemIn(docsOf(first)['spec/s1'], '1-1-5');
    assert.deepStrictEqual(docs['changes/c2'].added, ['1-1-5']);
    assert.deepStrictEqual(itemIn(docs['spec/s1'], '1-1-5').k, 'line');
    assert.deepStrictEqual(docs['history/s1'].lines['1-1-5'], [{ h: itemIn(docsOf(seed)['spec/s1'], '1-1-5').h, at: AT, parts: removed.parts, c: 1 }]);
  });

  it('a change to sources alone records no change and needs no reason: the line keeps its fingerprint (11.S28)', () => {
    const seed = opened();
    const statements = STATEMENTS();
    reland([statements[0].replace(`[${made.taken}]`, `[${made.taken}, ${made.brand}]`), ...statements.slice(1)]);
    const answer = frozen(['spec', 'push', UNIT, '--store', listing(seed)]);
    assert.deepStrictEqual([answer.change, writesOf(answer.batches).map(({ to }) => to)], [null, ['spec/s1']]);
    assert.strictEqual(itemIn(docsOf(answer.batches)['spec/s1'], '1-1-1').h, itemIn(docsOf(seed)['spec/s1'], '1-1-1').h);
  });

  it('a push that stopped before its index landed is finished, not counted again', () => {
    const seed = changed();
    const first = push(listing(seed)).batches;
    const stopped = listing(seed, first);
    fs.writeFileSync(path.join(stopped, 'spec', 'index.json'), JSON.stringify(docsOf(seed)['spec/index']));
    const answer = push(stopped);
    assert.deepStrictEqual([answer.resumed, answer.change.n, writesOf(answer.batches).map(({ to }) => to)], [true, 1, ['spec/index']]);
  });

  it('a store already holding the spec has nothing to write, each tick keeping when it was made', () => {
    const store = listing(opened());
    const ticks = path.join(store, 'assess', 's1.json');
    const held = json(ticks);
    for (const tick of Object.values(held.lines)) tick.at = '2025-01-01T00:00:00Z';
    fs.writeFileSync(ticks, JSON.stringify(held));
    assert.deepStrictEqual(push(store), {
      ok: true, unit: UNIT, url: URL, change: null, resumed: false, batches: [], existing: [], note: 'the store already holds this spec: nothing to write',
    });
  });
});

describe('spec push: refusals', () => {
  it('refuses a unit with no page built, writing nothing', () => {
    fs.mkdirSync(path.join(dir, 'store'));
    assert.match(refusedPristine(dir, ['spec', 'push', UNIT, '--store', path.join(dir, 'store')]).error, /^spec push: payments has no review page built — build it with spec page payments$/);
  });

  it('refuses a page not published, writing nothing', () => {
    const store = listing(build().batches);
    assert.match(refusedPristine(dir, ['spec', 'push', UNIT, '--store', store]).error, /^spec push: payments's review page is not published — publish it, then record it with spec published payments <url>$/);
  });

  it('refuses a listing that is no folder, writing nothing', () => {
    opened();
    assert.match(refusedPristine(dir, ['spec', 'push', UNIT, '--store', 'nowhere']).error, /^spec push: nowhere is no folder — save the store's spec, history, changes and assess collections into it/);
  });

  it('refuses a line in --from the spec does not have, writing nothing', () => {
    const store = listing(opened());
    assert.match(refusedPristine(dir, ['spec', 'push', UNIT, '--reason', 'x', '--store', store, '--from', '1.1.1,9.9.9']).error, /^spec push: --from names lines the spec does not have: 9-9-9$/);
  });

  it('refuses a push changing lines with no reason, writing nothing', () => {
    const store = listing(opened());
    const statements = STATEMENTS();
    reland([statements[0].replace('taken', 'accepted'), ...statements.slice(1)]);
    assert.match(refusedPristine(dir, ['spec', 'push', UNIT, '--store', store]).error, /^spec push: this push changes lines \(1 reworded\): say why with --reason "<one line>"$/);
  });

  it('refuses without its listing', () => {
    assert.match(refusedPristine(dir, ['spec', 'push', UNIT, '--reason', 'x']).error, /^Usage: engine spec push <work-unit> --store <dir> \[--reason <line>\] \[--from <ids>\]$/);
  });
});

describe('the page\'s own rules, its state functions run from the template (11.11.4, 11.11.6, 11.11.16, 11.11.19)', () => {
  const NAMES = ['thread', 'lastBy', 'yourTurn', 'needsYou', 'assessOf', 'view', 'matches'];
  const SOFT = Object.freeze({ v: 'soft', why: 'Restates your decision.' });

  /** A function's declaration in the page's script, braces counted to its end. @param {string} html @param {string} name */
  function declared(html, name) {
    const start = html.indexOf(`function ${name}(`);
    let depth = 0;
    for (let i = html.indexOf('{', start); i < html.length; i++) {
      if (html[i] === '{') depth += 1;
      else if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
    }
    throw new Error(`no function ${name} in the page`);
  }

  /** The page's state functions over one line, `1-1-1`, its wording's fingerprint `now`, carrying Claude's tick. @returns {any} */
  function page() {
    const context = vm.createContext({
      byId: new Map([['1-1-1', { dataset: { id: '1-1-1', h: 'now', flags: '' } }]]),
      assess: { '1-1-1': { ...SOFT, h: 'now' } },
      state: {},
      filter: 'all',
      held: new Set(),
    });
    vm.runInContext(NAMES.map((name) => declared(fs.readFileSync(TEMPLATE, 'utf8'), name)).join('\n'), context);
    return context;
  }

  /** The line as the page settles it from a stored mark: Claude's tick shown, changed, and whether it waits on the person. @param {Record<string, unknown>|undefined} mark */
  function settled(mark) {
    const context = page();
    const m = context.view('1-1-1', mark);
    return { soft: Boolean(m.soft), changed: Boolean(m.changed), waits: context.needsYou(m) };
  }

  it('a line nobody marked shows Claude\'s tick and waits on nobody', () => {
    assert.deepStrictEqual(settled(undefined), { soft: true, changed: false, waits: false });
  });

  it('Claude\'s tick never shows on a line changed since the person ticked it: it reads changed and waits on them (11.11.6, 11.11.4)', () => {
    assert.deepStrictEqual(settled({ s: 'tick', h: 'before' }), { soft: false, changed: true, waits: true });
  });

  it('the person\'s untick holds against Claude\'s tick whatever wording it held (11.11.16)', () => {
    assert.deepStrictEqual([settled({ s: '', h: 'now' }), settled({ s: '', h: 'before' })], [
      { soft: false, changed: false, waits: true }, { soft: false, changed: false, waits: true },
    ]);
  });

  it('To do shows every line waiting on the person — one Claude answered, one changed with its conversation — and none carrying a tick (11.11.19)', () => {
    const context = page();
    context.filter = 'todo';
    const shown = (/** @type {Record<string, unknown>|undefined} */ mark) => {
      context.state = { '1-1-1': context.view('1-1-1', mark) };
      return context.matches({ dataset: { id: '1-1-1', flags: '' } });
    };
    const answered = { s: 'comment', t: { p1000: { by: 'p', x: 'Why?' }, c2000: { by: 'c', x: 'Your decision.' } } };
    const talkedThenChanged = { s: 'tick', h: 'before', t: { p1000: { by: 'p', x: 'Why?' } } };
    assert.deepStrictEqual([shown(answered), shown(talkedThenChanged), shown(undefined), shown({ s: 'tick', h: 'now' })], [true, true, false, false]);
  });

  it('a line the person marked under a filter stays shown by it, though it no longer matches', () => {
    const context = page();
    context.filter = 'todo';
    context.state = { '1-1-1': context.view('1-1-1', { s: 'tick', h: 'now' }) };
    const shown = () => context.matches({ dataset: { id: '1-1-1', flags: '' } });
    const before = shown();
    context.held.add('1-1-1');
    assert.deepStrictEqual([before, shown()], [false, true]);
  });

  it('no snapshot moves the page before the saved line has landed; after it, the person\'s place holds', () => {
    /** @type {number[]} */
    const scrolled = [];
    const line = { getClientRects: () => [{}], getBoundingClientRect: () => ({ top: 90 }) };
    const context = vm.createContext({ byId: new Map([['1-1-1', line]]), window: { scrollBy: (/** @type {number} */ x, /** @type {number} */ y) => scrolled.push(y) }, spy: () => {}, landed: false });
    vm.runInContext(declared(fs.readFileSync(TEMPLATE, 'utf8'), 'keepAnchor'), context);
    context.keepAnchor({ id: '1-1-1', y: 40 });
    context.landed = true;
    context.keepAnchor({ id: '1-1-1', y: 40 });
    assert.deepStrictEqual(scrolled, [50]);
  });
});
