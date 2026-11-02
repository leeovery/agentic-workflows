'use strict';

// ---------------------------------------------------------------------------
// The person's review of the spec (leeway-engine/scripts/domain/
// spec-review.cjs, and the page's model, domain/spec-page-model.cjs): Claude's
// tick on each line, drawn from the entries it cites (11.11.15, 11.S32) — a
// line restating the person's decisions or resting on findings, or the
// builder's, carries it with its reason; one resting on a call of Claude's,
// on a decision carried over by the migration, on one marked hard to undo,
// or tracing to no entry stays open with its reason, and a scenario takes
// its tick from its statements but none of their flags; `engine spec marks
// <unit> --file`, storing the page's marks and answering the comments
// waiting for Claude (11.11.4, 11.11.8), and each refusal storing nothing;
// the record, `spec-review.json`, written from the stored marks with each
// line's state and conversation (11.11.7, 11.11.9, 11.S26, 11.S35) — none
// where the person did not take the review (11.S22) — a tick on wording
// since changed read as changed, one on sources alone changed kept (11.S28),
// a line removed after it was marked kept as removed; the review settled at
// ready to build's yes on the marks it is handed (11.11.5, 11.11.8, 11.S25);
// and the numbers the open page holds, which `spec land` refuses to change
// (11.11.3).
//
// Layer: verb. World, built once and copied: an epic, `payments`, its one
// topic `cards` decided, its entries written through the ledger's verbs — a
// decision of the person's, a call of Claude's, a "don't care" decision, a
// finding and a question left open — and one carried over as the migration
// writes it, and its spec landed citing them.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, refusedPristine, statePath, layout, writeState, readState, commitAll, fixtureFrom, cleanupFixture, treeSnapshot,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { MADE, ledgerHelpers } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { specPage, lineTicks, HARD_TO_UNDO } = require(path.join(SCRIPTS, 'domain/spec-page-model.cjs'));
const { settleReview } = require(path.join(SCRIPTS, 'domain/spec-review.cjs'));
const { specReading } = require(path.join(SCRIPTS, 'domain/spec-sections.cjs'));
const { withTraceView } = require(path.join(SCRIPTS, 'domain/spec-trace.cjs'));
const { trustLogPath } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));

const UNIT = 'payments';
const SPEC = layout.unit(UNIT, 'spec.md');
const RECORD = layout.unit(UNIT, 'spec-review.json');
const MARKS = layout.cache(UNIT, 'specification', 'marks.json');
const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });
const BUILDERS = 'Left to the builder: holds nothing you would see';

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

/** The spec, its statements as given, the second area's part fixed. @param {string[]} statements */
function spec(statements) {
  return [
    '# Payments', '', '## 1. Cards', '', '### 1.1 The form', '', ...statements.flatMap((line) => [line, '']),
    '## 1-S. Scenarios for §1', '',
    '1.S1 Given a form, when it is sent, then the card is charged. (1.1.1, 1.1.3)', '',
    '1.S2 Given a form, when the brand is unknown, then it is refused. (1.1.1, 1.1.2)', '',
    '## 2. Refunds', '', '### 2.1 Whole', '', '2.1.1 A refund goes back to the card. [builder]', '',
  ].join('\n');
}

/** The landed spec's statements. */
const STATEMENTS = () => [
  `1.1.1 Visa and Mastercard are taken. [${made.taken}]`,
  `1.1.2 An unknown brand is refused. [${made.call}]`,
  `1.1.3 Corners are ten points. [builder: ${made.radius}]`,
  `Screen: the form. [${made.taken}, ${made.brand}]`,
  `1.1.4 The form shows the card's brand. [${made.brand}]`,
  `1.1.5 Cards are checked as typed. [${made.open}]`,
  `1.1.6 Visa and Mastercard, an unknown brand refused. [${made.taken}, ${made.call}]`,
  `1.1.7 A declined card is retried once. [${made.carried}]`,
  `1.1.8 Corners are rounded. [${made.radius}]`,
];

const world = fixtureFrom('spec-review-', (dir) => {
  payments(dir, 'in-progress');
  commitAll(dir, 'init');
  const { write, carriedOver } = ledgerHelpers(() => dir);
  const at = `${UNIT}.discussion.cards`;
  const ask = (/** @type {string} */ text) => write('ask', at, [], { ...PERSON, text }).id;
  const decide = (/** @type {string} */ question, /** @type {string} */ text, content = {}) => write('decide', at, ['--answers', question], { ...PERSON, text, why: `Why: ${text}`, ...content }).id;
  made.taken = decide(ask('Which cards are taken?'), 'Visa and Mastercard.');
  made.call = decide(ask('What of an unknown brand?'), 'Refused.', MADE);
  made.radius = decide(ask('What radius are the corners?'), 'Ten points.', { ...MADE, given: 'dont-care' });
  made.brand = write('find', at, [], { ...MADE, text: 'The form shows the card\'s brand.', how: 'read in the code', known: 'read' }).id;
  made.open = ask('Are cards checked as typed?');
  made.carried = carriedOver(at, ask('Is a declined card retried?'), 'Once.');
  payments(dir, 'completed');
  commitAll(dir, 'topics settled');
  writeState(dir, SPEC, spec(STATEMENTS()));
  ok(dir, ['spec', 'land', UNIT]);
});

let dir = '';
beforeEach(() => { dir = world(); });
afterEach(() => { cleanupFixture(dir); });

const { full, entries } = ledgerHelpers(() => dir);

/** The day an entry was made. @param {string} short */
const dayOf = (short) => /** @type {string} */ (entries().find((entry) => entry.id === full(short)).at).slice(0, 10);

/** A line's current fingerprint, by id. @param {string} id */
const hOf = (id) => /** @type {{h: string}} */ (specPage(dir, UNIT).lines.find((line) => line.id === id)).h;

/** A message of the page's: by the person or Claude, at `ms`. @param {'p'|'c'} by @param {number} ms @param {string} x */
const message = (by, ms, x) => ({ [`${by}${ms}`]: { by, x } });

/** The marks file Claude hands in, outside the state. @param {unknown} marks @param {string} [name] */
function marksFile(marks, name = 'marks.json') {
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(marks));
  return file;
}

/** The review page built and its publishing recorded, which opens it. */
function publish() {
  ok(dir, ['spec', 'page', UNIT]);
  ok(dir, ['spec', 'published', UNIT, 'https://claude.ai/public/artifacts/0123']);
}

/** Store marks through the verb, the page published first: its answer. @param {Record<string, unknown>} marks */
function storeMarks(marks) {
  publish();
  return ok(dir, ['spec', 'marks', UNIT, '--file', marksFile(marks)]);
}

/** The review settled on marks handed in, the page published first: its answer. @param {Record<string, unknown>} marks */
function settle(marks) {
  publish();
  return settleReview(dir, UNIT, marksFile(marks, 'handed.json'));
}

/** The record as written. */
const record = () => JSON.parse(readState(dir, RECORD));

/** A message as the record holds it. @param {'person'|'claude'} by @param {number} ms @param {string} text */
const said = (by, ms, text) => ({ by, at: new Date(ms).toISOString(), text });

/** The ids of the page's lines carrying a flag. @param {string} flag */
const flagged = (flag) => specPage(dir, UNIT).sections.flatMap(({ items }) => items).flatMap((item) => (item.k === 'line' && item.flags.includes(flag) ? [item.id] : []));

describe('Claude\'s tick, drawn from the entries each line cites (11.11.15, 11.S32)', () => {
  it('11.S32: a line restating the person\'s decision, resting on a finding, or the builder\'s carries the tick with its reason; one resting on a call of Claude\'s, alone or beside the person\'s, on a decision carried over, citing a question, or marked the builder\'s citing nothing stays open with its reason; a scenario takes its tick from its statements', () => {
    const { ticks } = specPage(dir, UNIT);

    assert.deepStrictEqual(Object.fromEntries(ticks), {
      '1-1-1': { v: 'soft', why: `Restates your decision ${made.taken} of ${dayOf(made.taken)}` },
      '1-1-2': { v: 'open', why: `Rests on Claude's call ${made.call}` },
      '1-1-3': { v: 'soft', why: BUILDERS },
      '1-1-3-scr1': { v: 'soft', why: `Restates your decision ${made.taken} of ${dayOf(made.taken)}` },
      '1-1-4': { v: 'soft', why: `Rests on the finding ${made.brand} of ${dayOf(made.brand)}` },
      '1-1-5': { v: 'open', why: `Traces to no entry: ${made.open} is a question — cite its answer` },
      '1-1-6': { v: 'open', why: `Rests on Claude's call ${made.call}` },
      '1-1-7': { v: 'open', why: `Rests on ${made.carried}, carried over from before, its maker unknown` },
      '1-1-8': { v: 'soft', why: BUILDERS },
      '1-S1': { v: 'soft', why: 'Draws on 1.1.1 and 1.1.3, each carrying Claude\'s tick' },
      '1-S2': { v: 'open', why: 'Draws on 1.1.2, which waits on you' },
      '2-1-1': { v: 'open', why: 'Traces to no entry: cites no entry — a builder\'s line cites the "don\'t care" decision it rests on' },
    });
  });

  it('flags the statements and screens resting on a call of Claude\'s, and those left to the builder by a cite that traces — a bare builder\'s bracket, which does not, flagging nothing, and a scenario taking none of its statements\' flags (11.11.2)', () => {
    assert.deepStrictEqual([flagged('claude'), flagged('builder')], [['1-1-2', '1-1-6'], ['1-1-3', '1-1-8']]);
  });

  it('11.S36\'s drawn half: a line restating the person\'s decision marked hard to undo stays open, its reason saying its question was; unmarked, it carries the tick (P8)', () => {
    const { lines } = specReading(readState(dir, SPEC));
    const marked = withTraceView(dir, UNIT, [], (view) => {
      const decision = /** @type {{line: Record<string, unknown>}} */ (view.entries.get(full(made.taken)));
      const unmarked = lineTicks(view, lines).ticks.get('1.1.1');
      decision.line[HARD_TO_UNDO] = true;
      return [unmarked, lineTicks(view, lines).ticks.get('1.1.1')];
    });

    assert.deepStrictEqual(marked, [
      { v: 'soft', why: `Restates your decision ${made.taken} of ${dayOf(made.taken)}` },
      { v: 'open', why: `Restates your decision ${made.taken}, its question marked hard to undo` },
    ]);
  });
});

describe('the page\'s marks stored, answering the comments waiting for Claude (11.11.4, 11.11.5)', () => {
  it('stores the marks by document, each as the page holds it or saved under data, and answers each line whose conversation is open with the person\'s message last, its messages in the order their keys\' times give', () => {
    const marks = {
      s1: {
        data: {
          m: {
            '1-1-1': { s: 'comment', t: { ...message('p', 3000, 'And Amex?'), ...message('p', 1000, 'Why Visa?'), ...message('c', 2000, 'Your decision.') } },
            '1-1-2': { s: 'comment', t: { ...message('p', 1000, 'Refused how?'), ...message('c', 2000, 'With a message.') } },
            '1-1-4': { s: 'tick', h: hOf('1-1-4'), t: message('p', 1000, 'Fine.') },
          },
        },
        version: 3,
      },
      s2: { m: { '2-1-1': { s: 'comment', t: { ...message('p', 5000, ''), ...message('p', 6000, 'Partial refunds?') } } } },
    };

    assert.deepStrictEqual(storeMarks(marks), {
      ok: true,
      unit: UNIT,
      waiting: [
        {
          number: '1.1.1', id: '1-1-1', doc: 's1', wording: 'Visa and Mastercard are taken.',
          conversation: [said('person', 1000, 'Why Visa?'), said('claude', 2000, 'Your decision.'), said('person', 3000, 'And Amex?')],
        },
        { number: '2.1.1', id: '2-1-1', doc: 's2', wording: 'A refund goes back to the card.', conversation: [said('person', 6000, 'Partial refunds?')] },
      ],
    });
    assert.deepStrictEqual(JSON.parse(readState(dir, MARKS)), { s1: { m: marks.s1.data.m }, s2: marks.s2 });
  });

  it('a tick on a wording since changed, its conversation the person\'s last, waits for Claude as an open conversation does', () => {
    const { waiting } = settle({ s1: { m: { '1-1-1': { s: 'tick', h: 'aaaaaaaaaaaa', t: message('p', 1000, 'Ticked, but why?') } } } });

    assert.deepStrictEqual(waiting.map(({ number }) => number), ['1.1.1']);
  });
});

describe('marks refused, nothing stored', () => {
  /** The refusal's error, nothing written or committed. @param {string[]} args */
  const refused = (args) => refusedPristine(dir, ['spec', 'marks', ...args]).error;

  it('refuses a unit the project lacks, a unit with no spec, and a concluded spec', () => {
    const file = marksFile({});
    const none = refused(['nowhere', '--file', file]);
    fs.rmSync(statePath(dir, SPEC));
    const unwritten = refused([UNIT, '--file', file]);
    payments(dir, 'completed', { build: { position: 'auto' } });
    const concluded = refused([UNIT, '--file', file]);

    assert.deepStrictEqual([none, unwritten, concluded], [
      'spec marks: there is no work unit "nowhere"',
      `spec marks: ${UNIT} has no spec — its folder holds no spec.md, and the page reviews the spec`,
      `spec marks: ${UNIT}'s spec is concluded — its review ended when the build began`,
    ]);
  });

  it('refuses marks from a page not published — built or not — writing nothing', () => {
    const file = marksFile({});
    const unbuilt = refused([UNIT, '--file', file]);
    ok(dir, ['spec', 'page', UNIT]);
    const built = refused([UNIT, '--file', file]);
    const why = `spec marks: ${UNIT}'s review page is not published — publish it, record it with spec published ${UNIT} <url>, then read its marks back`;

    assert.deepStrictEqual([unbuilt, built], [why, why]);
  });

  it('refuses a file it cannot read as the marks, naming every fault, one per line', () => {
    publish();
    const unparsed = path.join(dir, 'unparsed.json');
    fs.writeFileSync(unparsed, '{');
    const shapes = marksFile({
      notes: { m: {} },
      s1: {
        m: {
          '1-1-1': { s: 'done', h: 7, at: 1 },
          '1-1-2': 'tick',
          '1-1-3': { t: { x1: { x: 'Hm' }, p12: { by: 'q', x: 'Hm' }, c13: 'Hm' } },
          '1-1': { s: 'tick' },
        },
      },
      s2: [],
    });

    assert.match(refused([UNIT, '--file', unparsed]), /^spec marks: .*unparsed\.json holds no marks: /);
    assert.strictEqual(refused([UNIT, '--file', marksFile([], 'list.json')]), `spec marks: ${path.join(dir, 'list.json')} holds no marks — the marks are the page's collection by document, {"s1": {"m": {…}}, …}`);
    assert.strictEqual(refused([UNIT, '--file', shapes]), [
      'spec marks: notes is no document of the marks — each is s<N>, holding {"m": {…}}',
      's1\'s mark on 1-1-1: s is "tick", "comment" or empty',
      's1\'s mark on 1-1-1: h is the fingerprint of the line\'s wording',
      's1\'s mark on 1-1-1: at is when it was made',
      's1\'s mark on 1-1-2 is no mark — a mark is {"s", "h", "t", "at"}',
      's1\'s mark on 1-1-3: "x1" is no message\'s key — p or c and the time in epoch milliseconds',
      's1\'s mark on 1-1-3: message p12 is no message — {"by": "p"|"c", "x": "<text>"}',
      's1\'s mark on 1-1-3: message c13 is no message — {"by": "p"|"c", "x": "<text>"}',
      's1\'s mark on 1-1: 1-1 is no line\'s id — a line\'s number with its dots as dashes, as 3-2-1, 3-S4 or 3-2-1-scr1',
      's2 is no document of the marks — each is s<N>, holding {"m": {…}}',
    ].join('\n'));
  });

  it('refuses a spec its grammar cannot read, and an argv of another shape', () => {
    publish();
    writeState(dir, SPEC, '# Payments\n\nNothing numbered.\n');
    const file = marksFile({});

    assert.match(refused([UNIT, '--file', file]), /^spec marks: the spec has no area/);
    assert.strictEqual(refused([UNIT]), 'Usage: engine spec marks <work-unit> --file <marks.json>');
  });
});

describe('the review\'s record (11.11.7, 11.11.9)', () => {
  it('11.S26: the ticked lines approved explicitly, the comment answered but not ticked open and left as written with its conversation, the rest — carrying no tick of Claude\'s — passed without review; the trust log untouched', () => {
    const trust = () => (fs.existsSync(trustLogPath()) ? fs.readFileSync(trustLogPath(), 'utf8') : null);
    const before = trust();
    const settled = settle({
      s1: {
        m: {
          '1-1-2': { s: 'tick', h: hOf('1-1-2') },
          '1-1-6': { s: 'comment', t: { ...message('p', 1000, 'Both?'), ...message('c', 2000, 'Both.') } },
        },
      },
    });
    const { lines } = record();

    assert.deepStrictEqual(settled, { waiting: [], record: RECORD });
    assert.deepStrictEqual([lines['1.1.2'], lines['1.1.6'], lines['1.1.5'], lines['1.S2']], [
      { state: 'approved', conversation: [] },
      { state: 'open', conversation: [said('person', 1000, 'Both?'), said('claude', 2000, 'Both.')] },
      { state: 'passed', conversation: [] },
      { state: 'passed', conversation: [] },
    ]);
    assert.strictEqual(trust(), before);
  });

  it('11.S35: holds every line by number, a screen\'s included, in one state — approved, approved after a comment, Claude\'s tick let stand, open, changed since its tick, passed without review — and a line removed after its tick as removed, with its conversation; a tick with no fingerprint stands, and the person\'s untick holds against Claude\'s tick whatever wording it held (11.11.16)', () => {
    settle({
      s1: {
        m: {
          '1-1-1': { s: 'tick', h: hOf('1-1-1'), t: { ...message('p', 1000, 'Amex?'), ...message('c', 2000, 'Not decided.') } },
          '1-1-2': { s: 'tick' },
          '1-1-3': { s: '', h: hOf('1-1-3') },
          '1-1-4': { s: 'tick', h: 'aaaaaaaaaaaa' },
          '1-1-5': { s: 'comment', t: { ...message('p', 3000, 'Typed how?'), ...message('c', 3500, 'Not decided.') } },
          '1-1-9': { s: 'tick', h: 'bbbbbbbbbbbb', t: message('p', 4000, 'Gone?') },
          '1-1-10': { s: '', h: 'cccccccccccc' },
        },
      },
      s2: { m: { '2-1-1': { s: '', h: 'dddddddddddd' } } },
    });

    assert.deepStrictEqual(record(), {
      lines: {
        '1.1.1': { state: 'approved-after-comment', conversation: [said('person', 1000, 'Amex?'), said('claude', 2000, 'Not decided.')] },
        '1.1.2': { state: 'approved', conversation: [] },
        '1.1.3': { state: 'passed', conversation: [] },
        '1.1.3-scr1': { state: 'claudes-tick', conversation: [] },
        '1.1.4': { state: 'changed', conversation: [] },
        '1.1.5': { state: 'open', conversation: [said('person', 3000, 'Typed how?'), said('claude', 3500, 'Not decided.')] },
        '1.1.6': { state: 'passed', conversation: [] },
        '1.1.7': { state: 'passed', conversation: [] },
        '1.1.8': { state: 'claudes-tick', conversation: [] },
        '1.S1': { state: 'claudes-tick', conversation: [] },
        '1.S2': { state: 'passed', conversation: [] },
        '2.1.1': { state: 'passed', conversation: [] },
        '1.1.9': { state: 'removed', conversation: [said('person', 4000, 'Gone?')] },
      },
    });
  });

  it('11.S28\'s code half: a tick stands across a land changing the line\'s sources alone, and reads changed once its wording changes', () => {
    const marks = { s1: { m: { '1-1-1': { s: 'tick', h: hOf('1-1-1') }, '1-1-4': { s: 'tick', h: hOf('1-1-4') } } } };
    publish();
    const [taken, ...rest] = STATEMENTS();
    writeState(dir, SPEC, spec([taken.replace(`[${made.taken}]`, `[${made.taken}, ${made.brand}]`), ...rest.map((line) => line.replace('the card\'s brand', 'the brand'))]));
    ok(dir, ['spec', 'land', UNIT]);
    settleReview(dir, UNIT, marksFile(marks));

    assert.deepStrictEqual([record().lines['1.1.1'].state, record().lines['1.1.4'].state], ['approved', 'changed']);
  });

  it('11.S22: writes a record, every line passed or Claude\'s, where the page was published and nothing marked', () => {
    settle({});

    assert.deepStrictEqual(Object.values(record().lines).map(({ state }) => state), [
      'claudes-tick', 'passed', 'claudes-tick', 'claudes-tick', 'claudes-tick', 'passed', 'passed', 'passed', 'claudes-tick', 'claudes-tick', 'passed', 'passed',
    ]);
  });
});

describe('the review settled at ready to build\'s yes, on the marks it is handed (11.11.5, 11.11.8)', () => {
  it('stores the marks handed in before it reads them: the record written from them where no comment waits; a comment left since the marks last stored waits, and no record is written (11.S25)', () => {
    storeMarks({});
    const settled = settleReview(dir, UNIT, marksFile({ s1: { m: { '1-1-2': { s: 'tick', h: hOf('1-1-2') } } } }, 'fresh.json'));
    const ticked = record().lines['1.1.2'].state;
    fs.rmSync(statePath(dir, RECORD));
    const late = settleReview(dir, UNIT, marksFile({ s1: { m: { '1-1-1': { s: 'comment', t: message('p', 1000, 'Amex?') } } } }, 'late.json'));

    assert.deepStrictEqual([settled, ticked], [{ waiting: [], record: RECORD }, 'approved']);
    assert.deepStrictEqual(late, {
      waiting: [{ number: '1.1.1', id: '1-1-1', doc: 's1', wording: 'Visa and Mastercard are taken.', conversation: [said('person', 1000, 'Amex?')] }],
      record: null,
    });
    assert.deepStrictEqual([fs.existsSync(statePath(dir, RECORD)), Object.keys(JSON.parse(readState(dir, MARKS)).s1.m)], [false, ['1-1-1']]);
  });

  it('settles nothing while no page is published (11.S22), and refuses an open page with no marks handed in, writing nothing', () => {
    ok(dir, ['spec', 'page', UNIT]);
    const closed = settleReview(dir, UNIT);
    publish();
    const before = treeSnapshot(dir);

    assert.deepStrictEqual(closed, { waiting: [], record: null });
    assert.throws(() => settleReview(dir, UNIT), /^Error: payments's review page is open, so the yes takes its marks — read them back from the page and give them as a file$/);
    assert.deepStrictEqual(treeSnapshot(dir), before);
  });
});

describe('the numbers the open review page holds, which a land never changes (11.11.3)', () => {
  /** The spec with statements as given, landed: the answer. @param {string[]} statements */
  const landing = (statements) => {
    writeState(dir, SPEC, spec(statements));
    return ok(dir, ['spec', 'land', UNIT]);
  };
  /** The spec with statements as given, its land refused with nothing written or committed: the refusal. @param {string[]} statements */
  const refused = (statements) => {
    writeState(dir, SPEC, spec(statements));
    return refusedPristine(dir, ['spec', 'land', UNIT]).error;
  };
  /** The landed statements with one inserted as 1.1.2, every later one renumbered. */
  function inserted() {
    const [taken, ...rest] = STATEMENTS();
    return [taken, `1.1.2 Amex is refused. [${made.call}]`, ...rest.map((line) => line.replace(/^1\.1\.(\d+) /, (_, k) => `1.1.${Number(k) + 1} `))];
  }

  it('refuses, while the page is open, a line moved to another number and an added number below the next free one — the marks\' numbers held with the landed spec\'s', () => {
    storeMarks({ s1: { m: { '1-1-10': { s: 'comment', t: message('p', 1000, 'Removed since.') } } } });

    assert.strictEqual(refused(inserted()).split('\n')[0], 'spec land: 1.1.3 now holds the wording 1.1.2 held — a number never changes while the review page is open: a line keeps its number, and a line added takes the next free one');
    assert.strictEqual(refused([...STATEMENTS(), `1.1.9 Amex is refused. [${made.call}]`]), 'spec land: 1.1.9 is added while the review page is open — a line added takes the next free number, 1.1.11');
  });

  it('refuses, while the page is open, a number removed by an earlier land given to another line, and lands the removed line brought back with its wording', () => {
    storeMarks({});
    const kept = STATEMENTS().slice(0, -1);
    landing(kept);

    assert.strictEqual(refused([...kept, `1.1.8 Discover is refused. [${made.call}]`]), 'spec land: 1.1.8 was removed while the review page is open, and its number is not given to another line — a line added takes the next free number, 1.1.9');
    assert.strictEqual(landing(STATEMENTS()).statements, 9);
  });

  it('lands, while the page is open, a reworded line and a line added at the next free number', () => {
    storeMarks({});
    const [taken, ...rest] = STATEMENTS();

    assert.strictEqual(landing([taken.replace('are taken', 'are both taken'), ...rest, `1.1.9 Discover is refused. [${made.call}]`]).statements, 10);
  });

  it('lands a renumbered spec while no page is open', () => {
    assert.strictEqual(landing(inserted()).statements, 10);
  });
});
