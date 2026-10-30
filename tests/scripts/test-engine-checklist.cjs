'use strict';

// ---------------------------------------------------------------------------
// The checklists (leeway-engine/scripts/domain/checklist.cjs): `engine
// checklist show|done|skip|close` over the closing points of a unit's work
// (6.4.6–6.4.10); a directive's checklist (6.4.11) is
// test-migration-directives.cjs's.
// Each point's exact list (6.S14), the sweep left off for a unit of one
// topic; Claude's items marked in its own order, one skipped with its
// reason, and the close (2.S2); the engine's own items worked out at each
// call and never kept or marked — the person's questions on the ledger's map
// (6.S13), mail waiting, the cut against `spec.md`, what a phase relies on;
// the close refused while an item is open (6.S26), and a mark from before
// the last close never counting toward the next; finish showing every phase
// start's and close's skips, read from the manifest by another conversation
// (6.S32); the record as stored, `checklists.{point}` on the unit's
// manifest; each write under the writer lock with its own state commit, and
// every refusal writing nothing.
//
// Layer: verb. Worlds, each built once and copied: a project with an epic,
// `payments`, of two topics under discussion, its `spec.md` (area 1 with
// parts 1.1 and 1.2, area 2; scenarios 1.S1 and 2.S1) and its cut written by
// the verb, two phases, the first relying on another unit, `billing`, the
// second on the first; `billing`, under way; and a feature of one topic,
// `solo`, with no cut. And the same project with three checklists marked
// through the verbs all but one item: decided's for `cards` all but
// `findings-rerun`, phase 1's close all but `notes-consolidated`, and ready
// to build's all but `assets-linked`. `show` taking no lock is
// test-engine-manifest-io.cjs's.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, refusedPristine, statePath, layout, writeState, readManifest, commitAll, stateGit, fixtureFrom, cleanupFixture, lockAttempts, holdLock,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const UNIT = 'payments';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'session-1' });

const SPEC = [
  '# Payments', '',
  '## 1. Cards', 'A card is taken once.', '',
  '### 1.1 The form', '1.S1 Given a card form, when the number is typed, then it is checked.', '',
  '### 1.2 The receipt', 'A receipt names its charge.', '',
  '## 2. Refunds', '2.S1 Given a charge, when it is refunded, then the card is credited.', '',
].join('\n');

/** @typedef {{name: string, goal: string, scenarios: string[], sections: string[], relies_on: Array<number|string>}} Phase */

/** @param {string} name @param {Partial<Phase>} fields @returns {Phase} */
const phase = (name, fields) => ({ name, goal: `${name} work.`, scenarios: [], sections: [], relies_on: [], ...fields });

const CARDS = phase('Cards', { scenarios: ['1.S1'], sections: ['1'], relies_on: ['billing'] });
const REFUNDS = phase('Refunds', { scenarios: ['2.S1'], sections: ['2'], relies_on: [1] });

/** A discussion topic, mapped. @param {number} order */
const mapped = (order) => ({ order, summary: `Topic ${order}`, routing: 'discussion', source: 'discovery' });

/** The cut `phases` written onto `unit` by the verb, from a file outside the project. @param {string} dir @param {Phase[]} phases */
function cut(dir, phases) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'checklist-cut-')), 'cut.json');
  fs.writeFileSync(file, JSON.stringify({ phases }));
  try {
    ok(dir, ['cut', UNIT, '--file', file]);
  } finally {
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  }
}

/** Claude's items on the checklist still open marked done in `at`, but those named. @param {string[]} named @param {string[]} [but] @param {string} [at] */
function doneAll(named, but = [], at = dir) {
  for (const item of ok(at, ['checklist', 'show', ...named], { env: SESSION }).items) {
    if (item.by === 'claude' && item.state === 'open' && !but.includes(item.key)) ok(at, ['checklist', 'done', ...named, item.key], { env: SESSION });
  }
}

/** The project every world starts from. @param {string} dir */
function project(dir) {
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: {
      discovery: { items: { cards: mapped(1), refunds: mapped(2) } },
      discussion: { items: { cards: { status: 'in-progress' }, refunds: { status: 'in-progress' } } },
    },
  });
  writeState(dir, layout.unit(UNIT, 'spec.md'), SPEC);
  createManifest(dir, 'billing', {});
  createManifest(dir, 'solo', { phases: { discussion: { items: { solo: { status: 'in-progress' } } } } });
  commitAll(dir, 'init');
  cut(dir, [CARDS, REFUNDS]);
}

const fresh = fixtureFrom('checklist-', project);

const marked = fixtureFrom('checklist-marked-', (at) => {
  project(at);
  doneAll(['decided', UNIT, 'cards'], ['findings-rerun'], at);
  doneAll(['phase-close', UNIT, '1'], ['notes-consolidated'], at);
  doneAll(['ready-to-build', UNIT], ['assets-linked'], at);
});

let dir = '';

/** Each test of the calling `describe` on a copy of `world`. @param {() => string} world */
function eachOn(world) {
  beforeEach(() => { dir = world(); });
  afterEach(() => { cleanupFixture(dir); });
}

/** @param {string[]} args @param {Record<string, string>} [env] */
const checklist = (args, env = SESSION) => ok(dir, ['checklist', ...args], { env });

/** `checklist show`'s answer. @param {...string} named */
const show = (...named) => checklist(['show', ...named]);

/** Each item a checklist shows: its key, who checks it, where it stands, and its text. @param {...string} named */
const standing = (...named) => show(...named).items.map((/** @type {any} */ item) => `${item.key} ${item.by} ${item.state}: ${item.text}`);

/** Where each of a checklist's engine items stands. @param {...string} named */
const engineItems = (...named) => show(...named).items.filter((/** @type {any} */ item) => item.by === 'engine').map((/** @type {any} */ item) => `${item.key} ${item.state}`);

/** Where one item of a checklist stands. @param {string} key @param {...string} named */
const itemState = (key, ...named) => show(...named).items.find((/** @type {any} */ item) => item.key === key).state;

/** The refusal's error, nothing written or committed. @param {string[]} args */
const refused = (args) => refusedPristine(dir, ['checklist', ...args], { env: SESSION }).error;

/** The unit's checklists, as its manifest holds them. @param {string} [unit] */
const records = (unit = UNIT) => readManifest(dir, unit).checklists;

/** A message waiting in a topic's mail. @param {string} topic */
const mailFor = (topic) => layout.unit(UNIT, 'topics', topic, 'mail', '001-from-refunds.md');

describe('the points of a unit\'s work, each its exact list (6.4.6–6.4.10, 6.S14)', () => {
  eachOn(fresh);

  it('lists each point\'s items in the spec\'s order, each in the spec\'s words with who checks it, every one open on a fresh unit but what the engine finds done', () => {
    assert.deepStrictEqual({
      decided: standing('decided', UNIT, 'cards'),
      ready: standing('ready-to-build', UNIT),
      start: standing('phase-start', UNIT, '2'),
      close: standing('phase-close', UNIT, '2'),
      finish: standing('finish', UNIT),
    }, {
      decided: [
        'questions-closed engine done: every question of the person\'s closed',
        'closing-pass claude open: the closing pass run, and its last re-read changing nothing',
        'decisions-entered claude open: every decision in the conversation has an entry',
        'replacements-checked claude open: each replacement checked against what it replaced',
        'conflicts-read claude open: the read for conflicting answers run within the topic',
        'findings-rerun claude open: each measured finding the topic\'s decisions rest on re-run',
        'mailbox-empty engine done: the topic\'s mailbox empty: every message raised and answered',
        'product-lines-shown claude open: the product-record lines and any candidates are on the screen',
      ],
      ready: [
        'topics-settled claude open: every topic decided, cancelled or postponed, a feature\'s one topic being decided by this same screen',
        'sweep-run claude open: the sweep between topics run, where the unit has more than one topic',
        'replacements-checked claude open: the spec has checked each replacement against what it replaced',
        'statements-traced claude open: every statement traced',
        'review-settled claude open: the review\'s last pass changed nothing',
        'phases-complete engine done: each phase in the cut has its scenarios, sections and relies-on',
        'invariants-checked claude open: every invariant names a check or says none can',
        'sections-drawn engine done: every section of the spec drawn on by at least one phase in the cut',
        'assets-linked claude open: canonical assets linked',
      ],
      start: [
        'tasks-written claude open: tasks written with their links',
        'design-settled claude open: shared design settled',
        'relies-on-done engine open: what the phase relies on is done',
      ],
      close: [
        'tasks-passed claude open: every task passed its pair',
        'phase-review-passed claude open: the phase review passed and its fixes landed',
        'scenarios-reported claude open: each scenario proven or reported not proven',
        'notes-consolidated claude open: the notes for later read by the consolidation agent, then made into tasks or dropped with a reason',
        'stack-merged claude open: the stack merged, or waiting at its gate in step',
      ],
      finish: [
        'review-passed claude open: the review phase passed and its report is written, where the unit has a review phase (a quick-fix\'s only when the person asks)',
        'inbox-closed claude open: resolved inbox items closed',
        'build-log-closed claude open: the build log closed',
        'records-indexed claude open: the records indexed',
      ],
    });
  });

  it('answers the checklist by its name, with its close, null where never closed, and the skips its gate shows beside its items', () => {
    assert.deepStrictEqual(show('decided', UNIT, 'cards'), {
      ok: true,
      unit: UNIT,
      checklist: 'decided.cards',
      closed: null,
      items: [
        { key: 'questions-closed', text: 'every question of the person\'s closed', by: 'engine', state: 'done' },
        { key: 'closing-pass', text: 'the closing pass run, and its last re-read changing nothing', by: 'claude', state: 'open' },
        { key: 'decisions-entered', text: 'every decision in the conversation has an entry', by: 'claude', state: 'open' },
        { key: 'replacements-checked', text: 'each replacement checked against what it replaced', by: 'claude', state: 'open' },
        { key: 'conflicts-read', text: 'the read for conflicting answers run within the topic', by: 'claude', state: 'open' },
        { key: 'findings-rerun', text: 'each measured finding the topic\'s decisions rest on re-run', by: 'claude', state: 'open' },
        { key: 'mailbox-empty', text: 'the topic\'s mailbox empty: every message raised and answered', by: 'engine', state: 'done' },
        { key: 'product-lines-shown', text: 'the product-record lines and any candidates are on the screen', by: 'claude', state: 'open' },
      ],
      skips: [],
    });
  });

  it('leaves the sweep between topics off for a unit of one live topic — a feature\'s, or an epic\'s whose second is cancelled — and refuses marking it there', () => {
    const keys = (/** @type {string} */ unit) => show('ready-to-build', unit).items.map((/** @type {any} */ item) => item.key);
    const unswept = ['topics-settled', 'replacements-checked', 'statements-traced', 'review-settled', 'phases-complete', 'invariants-checked', 'sections-drawn', 'assets-linked'];
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'refunds'], { env: SESSION });

    assert.deepStrictEqual([keys('solo'), keys(UNIT)], [unswept, unswept]);
    assert.strictEqual(refused(['done', 'ready-to-build', 'solo', 'sweep-run']),
      'checklist done: ready-to-build has no item "sweep-run" — its items are topics-settled, replacements-checked, statements-traced, review-settled, phases-complete, invariants-checked, sections-drawn, assets-linked');
  });

  it('refuses a point the engine lacks, a unit, topic or phase the project lacks, a unit with no cut, an item the point lacks, and arguments of another shape, writing nothing', () => {
    const usage = /^Usage: engine checklist show <checklist> \| engine checklist done <checklist> <item> \| .* \| <checklist>: decided <work-unit> <topic> \| /;
    for (const args of [['show', 'started', UNIT], ['show', 'finish'], ['show', 'decided', UNIT], ['close', 'finish', UNIT, 'extra'], ['done', 'finish'], ['show', 'finish', UNIT, '--force', 'yes'], ['tidy', 'finish', UNIT]]) {
      assert.match(refused(args), usage, args.join(' '));
    }
    assert.deepStrictEqual([
      refused(['show', 'finish', 'ledger']),
      refused(['show', 'finish', 'Not A Unit']),
      refused(['show', 'decided', UNIT, 'wallets']),
      refused(['show', 'phase-start', UNIT, '3']),
      refused(['show', 'phase-close', UNIT, '0']),
      refused(['show', 'phase-start', 'solo', '1']),
      refused(['done', 'finish', UNIT, 'tidied']),
    ], [
      'checklist show: there is no work unit "ledger"',
      'checklist show: there is no work unit "Not A Unit"',
      `checklist show: ${UNIT} has no topic "wallets"`,
      `checklist show: ${UNIT}'s cut has no phase 3 — its phases are 1 to 2`,
      `checklist show: ${UNIT}'s cut has no phase 0 — its phases are 1 to 2`,
      'checklist show: solo has no cut — its phases come from engine cut',
      'checklist done: finish has no item "tidied" — its items are review-passed, inbox-closed, build-log-closed, records-indexed',
    ]);
  });
});

describe('a phase\'s close worked in Claude\'s order (2.S2, 6.4.2, 6.4.12)', () => {
  eachOn(fresh);

  it('ends each item done but the one skipped, its reason recorded, and the close recorded on the unit\'s manifest — Claude\'s marks and the close alone, each write committed alone', () => {
    const before = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const named = ['phase-close', UNIT, '1'];
    const marks = {
      'stack-merged': checklist(['done', ...named, 'stack-merged']),
      'tasks-passed': checklist(['done', ...named, 'tasks-passed']),
      'notes-consolidated': checklist(['skip', ...named, 'notes-consolidated', '--reason', 'No notes were left for later.']),
      'scenarios-reported': checklist(['done', ...named, 'scenarios-reported']),
      'phase-review-passed': checklist(['done', ...named, 'phase-review-passed']),
    };
    const closing = checklist(['close', ...named]);

    const stored = (/** @type {any} */ { state, reason, at }) => (reason === undefined ? { state, at } : { state, reason, at });
    assert.deepStrictEqual(records(), { 'phase-1-close': { items: Object.fromEntries(Object.entries(marks).map(([key, mark]) => [key, stored(mark)])), closed: closing.closed } });
    assert.deepStrictEqual(marks['notes-consolidated'], {
      ok: true, unit: UNIT, checklist: 'phase-1-close', item: 'notes-consolidated', state: 'skipped', reason: 'No notes were left for later.',
      at: marks['notes-consolidated'].at, committed: marks['notes-consolidated'].committed,
    });
    assert.deepStrictEqual(closing, { ok: true, unit: UNIT, checklist: 'phase-1-close', closed: closing.closed, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.deepStrictEqual(stateGit(dir, ['log', '--reverse', '--format=%s', `${before}..HEAD`]).trim().split('\n'), [
      ...Object.entries(marks).map(([key, { state }]) => `checklist(${UNIT}): phase-1-close ${key} ${state}`),
      `checklist(${UNIT}): phase-1-close closed`,
    ]);
    assert.deepStrictEqual([...new Set(stateGit(dir, ['log', '--format=', '--name-only', `${before}..HEAD`]).trim().split('\n'))], [layout.manifest(UNIT)]);
  });

  it('writes under the writer lock: a live holder keeps the record unwritten until it lets go', (t) => {
    const lock = holdLock(statePath(dir, layout.lock));
    /** @type {unknown[]} */
    const whileHeld = [];
    const attempts = lockAttempts(t, lock, () => {
      whileHeld.push(records());
      fs.unlinkSync(lock);
    });

    checklist(['done', 'phase-close', UNIT, '1', 'tasks-passed']);

    assert.deepStrictEqual([attempts, whileHeld, Object.keys(records()['phase-1-close'].items)], [['taken', 'made'], [undefined], ['tasks-passed']]);
  });
});

describe('the engine\'s own items, worked out at each call (6.4.3)', () => {
  eachOn(marked);

  it('reads a question of the person\'s still open as open, done once it is answered, open again for a new one, and open on the topic it is moved to, not the one it left — never marked (6.S13)', () => {
    const topic = `${UNIT}.discussion.cards`;
    const write = (/** @type {string} */ verb, /** @type {string[]} */ flags, /** @type {object} */ content) => ok(dir, ['ledger', verb, topic, ...flags], { env: SESSION, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', ...content }) }).id;
    const questions = (/** @type {string} */ on = 'cards') => itemState('questions-closed', 'decided', UNIT, on);

    const asked = write('ask', [], { text: 'Which cards are taken?' });
    const open = questions();
    assert.strictEqual(refused(['done', 'decided', UNIT, 'cards', 'questions-closed']), 'checklist done: questions-closed is the engine\'s to check, never marked — it reads done once it holds');
    write('decide', ['--answers', asked], { text: 'Visa and Mastercard.', why: 'They are what the bank takes.' });
    const answered = questions();
    const refunds = write('ask', [], { text: 'Are refunds made to the card?' });
    const askedAgain = questions();
    write('move', ['--question', refunds, '--to', 'refunds'], {});

    assert.deepStrictEqual([open, answered, askedAgain, questions(), questions('refunds')], ['open', 'done', 'open', 'done', 'open']);
  });

  it('reads mail waiting in the topic\'s mail as the mailbox open, its own topic\'s alone, and a file that is no message as no mail', () => {
    writeState(dir, mailFor('cards'), '# A message\n');
    writeState(dir, layout.unit(UNIT, 'topics', 'refunds', 'mail', '.DS_Store'), 'Finder');
    const mailbox = (/** @type {string} */ topic) => itemState('mailbox-empty', 'decided', UNIT, topic);

    assert.deepStrictEqual([mailbox('cards'), mailbox('refunds')], ['open', 'done']);
  });

  it('reads the cut against spec.md: every part drawn on, directly or through its area, and each phase naming a scenario and a section, relying on nothing or more', () => {
    const engines = () => engineItems('ready-to-build', UNIT);
    const seen = [];
    cut(dir, [{ ...CARDS, sections: ['1.1'] }, REFUNDS]);
    seen.push(engines());
    cut(dir, [{ ...CARDS, sections: ['1.1', '1.2'], relies_on: [] }, { ...REFUNDS, relies_on: [] }]);
    seen.push(engines());
    cut(dir, [CARDS, REFUNDS, phase('Polish', { sections: ['2'], relies_on: [2] })]);
    seen.push(engines());
    cut(dir, [CARDS, { ...REFUNDS, sections: [] }, phase('Polish', { scenarios: [], sections: ['2'] })]);
    seen.push(engines());

    assert.deepStrictEqual(seen, [
      ['phases-complete done', 'sections-drawn open'],
      ['phases-complete done', 'sections-drawn done'],
      ['phases-complete open', 'sections-drawn done'],
      ['phases-complete open', 'sections-drawn done'],
    ]);
    assert.deepStrictEqual(engineItems('ready-to-build', 'solo'), ['phases-complete open', 'sections-drawn open']);
  });

  it('reads what a phase relies on as done once an earlier phase\'s close is recorded and another unit is completed, never cancelled (12.6.3)', () => {
    const relied = (/** @type {string} */ number) => itemState('relies-on-done', 'phase-start', UNIT, number);
    const before = [relied('1'), relied('2')];
    checklist(['done', 'phase-close', UNIT, '1', 'notes-consolidated']);
    checklist(['close', 'phase-close', UNIT, '1']);
    createManifest(dir, 'billing', { status: 'cancelled' });
    const cancelled = relied('1');
    createManifest(dir, 'billing', { status: 'completed' });

    assert.deepStrictEqual([before, cancelled, [relied('1'), relied('2')]], [['open', 'open'], 'open', ['done', 'done']]);
  });

  it('refuses to mark or skip an engine item, and keeps none in the record however it reads', () => {
    writeState(dir, mailFor('cards'), '# A message\n');
    assert.strictEqual(refused(['skip', 'decided', UNIT, 'cards', 'mailbox-empty', '--reason', 'Read already.']), 'checklist skip: mailbox-empty is the engine\'s to check, never marked — it reads done once it holds');
    fs.rmSync(statePath(dir, mailFor('cards')));
    checklist(['done', 'decided', UNIT, 'cards', 'findings-rerun']);
    checklist(['close', 'decided', UNIT, 'cards']);

    assert.deepStrictEqual(Object.keys(records().decided.cards.items), ['closing-pass', 'decisions-entered', 'replacements-checked', 'conflicts-read', 'product-lines-shown', 'findings-rerun']);
  });
});

describe('the close, refused while any item is open (6.4.4, 6.S26)', () => {
  eachOn(marked);

  it('refuses decided\'s close while mail waits, naming it, and closes once the mailbox is empty', () => {
    checklist(['done', 'decided', UNIT, 'cards', 'findings-rerun']);
    writeState(dir, mailFor('cards'), '# A message\n');

    assert.strictEqual(refused(['close', 'decided', UNIT, 'cards']), 'checklist close: decided.cards has items open: mailbox-empty');
    fs.rmSync(statePath(dir, mailFor('cards')));
    assert.strictEqual(checklist(['close', 'decided', UNIT, 'cards']).checklist, 'decided.cards');
  });

  it('refuses decided\'s close while a measured finding is not yet re-run', () => {
    assert.strictEqual(refused(['close', 'decided', UNIT, 'cards']), 'checklist close: decided.cards has items open: findings-rerun');
  });

  it('refuses ready to build\'s close while the cut leaves a section undrawn, naming every item open', () => {
    cut(dir, [{ ...CARDS, sections: ['1.1'] }, REFUNDS]);

    assert.strictEqual(refused(['close', 'ready-to-build', UNIT]), 'checklist close: ready-to-build has items open: sections-drawn, assets-linked');
  });

  it('counts no mark made before the last close toward the next: a topic reopened by mail closes again on its marks made since (10.2.7)', () => {
    const named = ['decided', UNIT, 'cards'];
    checklist(['done', ...named, 'findings-rerun']);
    const first = checklist(['close', ...named]).closed;
    const reopened = show(...named);

    assert.strictEqual(refused(['close', ...named]), 'checklist close: decided.cards has items open: closing-pass, decisions-entered, replacements-checked, conflicts-read, findings-rerun, product-lines-shown');
    doneAll(named);
    const second = checklist(['close', ...named]).closed;

    assert.deepStrictEqual([reopened.closed, reopened.items.filter((/** @type {any} */ item) => item.state === 'open').length, second > first], [first, 6, true]);
    assert.strictEqual(records().decided.cards.closed, second);
  });
});

describe('skips (6.4.2, 6.4.5)', () => {
  eachOn(marked);

  it('a skip records its reason: none given, or a blank one, is refused', () => {
    assert.match(refused(['skip', 'finish', UNIT, 'inbox-closed']), /^Usage: engine checklist /);
    assert.strictEqual(refused(['skip', 'finish', UNIT, 'inbox-closed', '--reason', ' ']), 'checklist skip: a skip records its reason — --reason "<text>"');
  });

  it('decided\'s gate shows its own skips; a phase\'s start and close show none of theirs', () => {
    checklist(['skip', 'decided', UNIT, 'cards', 'findings-rerun', '--reason', 'No finding was measured.']);
    checklist(['skip', 'phase-close', UNIT, '1', 'notes-consolidated', '--reason', 'No notes were left for later.']);
    const { at } = records().decided.cards.items['findings-rerun'];

    assert.deepStrictEqual([show('decided', UNIT, 'cards').skips, show('phase-close', UNIT, '1').skips], [
      [{ checklist: 'decided.cards', item: 'findings-rerun', text: 'each measured finding the topic\'s decisions rest on re-run', reason: 'No finding was measured.', at }],
      [],
    ]);
  });

  it('finish shows every phase start\'s and close\'s skips, then its own, read from the unit\'s manifest by a later conversation (6.S32)', () => {
    createManifest(dir, 'billing', { status: 'completed' });
    checklist(['skip', 'phase-start', UNIT, '1', 'design-settled', '--reason', 'Nothing shared.']);
    checklist(['done', 'phase-start', UNIT, '1', 'tasks-written']);
    checklist(['close', 'phase-start', UNIT, '1']);
    checklist(['skip', 'phase-close', UNIT, '1', 'notes-consolidated', '--reason', 'No notes were left for later.']);
    checklist(['close', 'phase-close', UNIT, '1']);
    checklist(['skip', 'finish', UNIT, 'records-indexed', '--reason', 'Indexed at the last phase.']);
    const at = (/** @type {string} */ key, /** @type {string} */ item) => records()[key].items[item].at;

    const later = checklist(['show', 'finish', UNIT], { CLAUDE_CODE_SESSION_ID: 'session-2' });

    assert.deepStrictEqual(later.skips, [
      { checklist: 'phase-1-start', item: 'design-settled', text: 'shared design settled', reason: 'Nothing shared.', at: at('phase-1-start', 'design-settled') },
      {
        checklist: 'phase-1-close', item: 'notes-consolidated', text: 'the notes for later read by the consolidation agent, then made into tasks or dropped with a reason',
        reason: 'No notes were left for later.', at: at('phase-1-close', 'notes-consolidated'),
      },
      { checklist: 'finish', item: 'records-indexed', text: 'the records indexed', reason: 'Indexed at the last phase.', at: at('finish', 'records-indexed') },
    ]);
  });
});
