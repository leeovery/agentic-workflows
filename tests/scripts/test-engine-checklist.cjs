'use strict';

// ---------------------------------------------------------------------------
// The checklists (leeway-engine/scripts/domain/checklist.cjs): `engine
// checklist show|done|skip|close` over the closing points of a unit's work
// (6.4.6–6.4.10); a directive's checklist (6.4.11) is
// test-migration-directives.cjs's.
// Each point's exact list (6.S14), the sweep left off for a unit of one
// topic and finish's records indexed where no knowledge base is set up; the
// engine's own items worked out at each
// call and never kept or marked — the person's questions on the ledger's map
// (6.S13), mail waiting, the unit's topics settled, the sweep run, every statement and
// screen of `spec.md` traced, the cut against `spec.md`, the canonical
// assets linked from `spec.md`, another unit a phase relies on — the review
// settled is test-engine-spec-review-settled.cjs's, a build phase's
// checks test-engine-build-checklists.cjs's, and finish's, with its items
// worked in Claude's order and its close (2.S2), test-engine-finish.cjs's;
// no phase's start before the
// build begins (11.8.3);
// the close refused while an item is open (6.S26), and a mark from before
// the last close never counting toward the next; finish showing every phase
// start's skips, read from the manifest by another conversation (6.S32); the
// record as stored, `checklists.{point}` on the unit's manifest; each write
// under the writer lock with its own state commit, and every refusal
// writing nothing.
//
// Layer: verb. Worlds, each built once and copied: a project with an epic,
// `payments`, of two topics under discussion, a "don't care" decision on
// `cards`, its `spec.md` (area 1 with parts 1.1 and 1.2, each a statement
// of the builder's citing that decision, area 2; scenarios
// 1.S1 and 2.S1) and its cut written by
// the verb, two phases, the first relying on another unit, `billing`, the
// second on the first, its build begun; `billing`, under way; and a feature
// of one topic, `solo`, with no cut. And the same project with two
// checklists marked through the verbs all but one item: decided's for
// `cards` all but `findings-rerun`, and ready to build's all but
// `invariants-checked`. `show` taking no lock is
// test-engine-manifest-io.cjs's.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, refusedPristine, statePath, layout, writeState, readManifest, commitAll, fixtureFrom, cleanupFixture, lockAttempts, holdLock, failingStateCommits, retried,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { MADE, ledgerHelpers } = require('./ledger-world.cjs');
const { REVIEWERS } = require('../../skills/leeway-engine/scripts/kernel/reviewers.cjs');

const UNIT = 'payments';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'session-1' });

/** The builder's bracket in the project at `at`, citing its "don't care" decision. @param {string} at */
const builders = (at) => `[builder: ${ledgerHelpers(() => at).entries().find((entry) => entry.given === 'dont-care').id}]`;

/** The unit's spec in the project at `at`, its statements the builder's. @param {string} at */
const specIn = (at) => [
  '# Payments', '',
  '## 1. Cards', '',
  '### 1.1 The form', '', `1.1.1 The number is checked as it is typed. ${builders(at)}`, '',
  '### 1.2 The receipt', '', `1.2.1 A receipt names its charge. ${builders(at)}`, '',
  '## 1-S. Scenarios for §1', '', '1.S1 Given a card form, when the number is typed, then it is checked. (1.1.1)', '',
  '## 2. Refunds', '',
  '## 2-S. Scenarios for §2', '', '2.S1 Given a charge, when it is refunded, then its receipt names it. (1.2.1)', '',
].join('\n');

/** The unit's spec, its first statement's text and bracket as `said` gives. @param {string} said */
const typed = (said) => specIn(dir).replace(`typed. ${builders(dir)}`, said);

/** @typedef {{name: string, goal: string, scenarios: string[], sections: string[], relies_on: Array<number|string>}} Phase */

/** @param {string} name @param {Partial<Phase>} fields @returns {Phase} */
const phase = (name, fields) => ({ name, goal: `${name} work.`, scenarios: [], sections: [], relies_on: [], ...fields });

const CARDS = phase('Cards', { scenarios: ['1.S1'], sections: ['1'], relies_on: ['billing'] });
const REFUNDS = phase('Refunds', { scenarios: ['2.S1'], sections: ['2'], relies_on: [1] });

/** A discussion topic, mapped. @param {number} order */
const mapped = (order) => ({ order, summary: `Topic ${order}`, source: 'discovery' });

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

/** `refunds` cancelled on the unit's map, as a cancel before the spec left it. */
function refundsCancelled() {
  const { phases } = readManifest(dir, UNIT);
  createManifest(dir, UNIT, {
    ...readManifest(dir, UNIT),
    phases: {
      ...phases,
      discovery: { items: { ...phases.discovery.items, refunds: { ...phases.discovery.items.refunds, cancelled: true } } },
      discussion: { items: { ...phases.discussion.items, refunds: { status: 'cancelled', previous_status: 'in-progress' } } },
    },
  });
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
  createManifest(dir, 'billing', {});
  createManifest(dir, 'solo', { phases: { discussion: { items: { solo: { status: 'in-progress' } } } } });
  commitAll(dir, 'init');
  const { write } = ledgerHelpers(() => dir);
  const radius = write('ask', `${UNIT}.discussion.cards`, [], { ...MADE, text: 'What radius are the corners?' }).id;
  write('decide', `${UNIT}.discussion.cards`, ['--answers', radius], { ...MADE, given: 'dont-care', text: 'Ten points.', why: 'Any radius serves.' });
  createManifest(dir, UNIT, { ...readManifest(dir, UNIT), build: { position: 'auto' } });
  writeState(dir, layout.unit(UNIT, 'spec.md'), specIn(dir));
  commitAll(dir, 'spec written');
  cut(dir, [CARDS, REFUNDS]);
}

const fresh = fixtureFrom('checklist-', project);

const marked = fixtureFrom('checklist-marked-', (at) => {
  project(at);
  doneAll(['decided', UNIT, 'cards'], ['findings-rerun'], at);
  doneAll(['ready-to-build', UNIT], ['invariants-checked'], at);
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

  it('lists each point\'s items in the spec\'s order, each in the spec\'s words with who checks it — a task\'s pass read against the reviewers\' count (13.3.4) — every one open on a fresh unit but what the engine finds done', () => {
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
        'product-lines-shown claude open: the product-record lines and any candidates written for the screen that shows the close',
      ],
      ready: [
        'topics-settled engine open: every topic decided, cancelled or postponed, a feature\'s one topic being decided by this same screen',
        'sweep-run engine open: the sweep between topics run, where the unit has more than one topic',
        'replacements-checked claude open: the spec has checked each replacement against what it replaced',
        'statements-traced engine done: every statement traced',
        'review-settled engine open: the review\'s last pass changed nothing',
        'phases-complete engine done: each phase in the cut has its scenarios, sections and relies-on',
        'invariants-checked claude open: every invariant names a check or says none can',
        'sections-drawn engine done: every section of the spec drawn on by at least one phase in the cut',
        'assets-linked engine done: canonical assets linked from spec.md — one gone or no longer needed set to reference: asset status <work-unit> <path> reference',
      ],
      start: [
        'tasks-written engine open: tasks written with their links',
        'design-settled claude open: shared design settled',
        'relies-on-done engine open: what the phase relies on is done: closed, and its stack merged',
      ],
      close: [
        `tasks-passed engine open: every task passed each of its ${REVIEWERS} reviewers`,
        'phase-review-passed engine open: the phase review passed and its fixes landed',
        'scenarios-reported engine open: each scenario proven or reported not proven',
        'notes-consolidated engine done: the notes for later read by the consolidation agent, then made into tasks or dropped with a reason',
        'stack-merged engine open: the stack merged, or waiting at its gate in step',
      ],
      finish: [
        'review-passed engine open: the review phase passed and its report is written, where the unit has a review phase (a quick-fix\'s only when the person asks)',
        'questions-answered engine done: no question waiting on the person',
        'inbox-closed engine done: resolved inbox items closed',
        'build-log-closed claude open: the build log closed',
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
        { key: 'product-lines-shown', text: 'the product-record lines and any candidates written for the screen that shows the close', by: 'claude', state: 'open' },
      ],
      skips: [],
    });
  });

  it('leaves the sweep between topics off for a unit of one live topic — a feature\'s, or an epic\'s whose second is cancelled — and refuses marking it there', () => {
    const keys = (/** @type {string} */ unit) => show('ready-to-build', unit).items.map((/** @type {any} */ item) => item.key);
    const unswept = ['topics-settled', 'replacements-checked', 'statements-traced', 'review-settled', 'phases-complete', 'invariants-checked', 'sections-drawn', 'assets-linked'];
    refundsCancelled();

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
      'checklist done: finish has no item "tidied" — its items are review-passed, questions-answered, inbox-closed, build-log-closed',
    ]);
  });
});

describe('no phase starts before the build begins (11.8.1, 11.8.3, 11.S13)', () => {
  eachOn(fresh);

  it('refuses a phase\'s start, to show, mark or close, until ready to build\'s yes has begun the build, writing nothing — a phase\'s close untouched', () => {
    const { build, ...waiting } = readManifest(dir, UNIT);
    createManifest(dir, UNIT, waiting);
    commitAll(dir, 'the build not begun');
    const refusal = (/** @type {string} */ verb) => `checklist ${verb}: ${UNIT}'s build has not begun, so no phase starts — ready to build's yes begins it: render ready-to-build ${UNIT}`;

    assert.deepStrictEqual([
      refused(['show', 'phase-start', UNIT, '1']),
      refused(['done', 'phase-start', UNIT, '1', 'tasks-written']),
      refused(['close', 'phase-start', UNIT, '1']),
    ], [refusal('show'), refusal('done'), refusal('close')]);
    assert.deepStrictEqual([build, show('phase-close', UNIT, '1').checklist], [{ position: 'auto' }, 'phase-1-close']);
  });
});

describe('a mark\'s write (6.4.12)', () => {
  eachOn(fresh);

  it('writes under the writer lock: a live holder keeps the record unwritten until it lets go', (t) => {
    const lock = holdLock(statePath(dir, layout.lock));
    /** @type {unknown[]} */
    const whileHeld = [];
    const attempts = lockAttempts(t, lock, () => {
      whileHeld.push(records());
      fs.unlinkSync(lock);
    });

    checklist(['done', 'finish', UNIT, 'build-log-closed']);

    assert.deepStrictEqual([attempts, whileHeld, Object.keys(records().finish.items)], [['taken', 'made'], [undefined], ['build-log-closed']]);
  });
});

describe('the engine\'s own items, worked out at each call (6.4.3)', () => {
  eachOn(marked);

  it('reads a question of the person\'s still open as open, done once it is answered, open again for a new one, and open on the topic it is moved to, not the one it left — never marked (6.S13)', () => {
    const { build, ...beforeItsSpec } = readManifest(dir, UNIT);
    createManifest(dir, UNIT, beforeItsSpec);
    fs.rmSync(statePath(dir, layout.unit(UNIT, 'spec.md')));
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
      ['topics-settled open', 'sweep-run open', 'statements-traced done', 'review-settled open', 'phases-complete done', 'sections-drawn open', 'assets-linked done'],
      ['topics-settled open', 'sweep-run open', 'statements-traced done', 'review-settled open', 'phases-complete done', 'sections-drawn done', 'assets-linked done'],
      ['topics-settled open', 'sweep-run open', 'statements-traced done', 'review-settled open', 'phases-complete open', 'sections-drawn done', 'assets-linked done'],
      ['topics-settled open', 'sweep-run open', 'statements-traced done', 'review-settled open', 'phases-complete open', 'sections-drawn done', 'assets-linked done'],
    ]);
    assert.deepStrictEqual(engineItems('ready-to-build', 'solo'), ['topics-settled open', 'statements-traced open', 'review-settled open', 'phases-complete open', 'sections-drawn open', 'assets-linked done']);
  });

  it('reads the unit\'s topics as settled once every live topic is decided — a topic under discussion open, one cancelled or postponed no longer live (11.2.1, 6.4.7)', () => {
    const settled = () => itemState('topics-settled', 'ready-to-build', UNIT);
    const seen = [settled()];
    createManifest(dir, UNIT, { ...readManifest(dir, UNIT), phases: { ...readManifest(dir, UNIT).phases, discussion: { items: { cards: { status: 'completed' }, refunds: { status: 'in-progress' } } } } });
    seen.push(settled());
    refundsCancelled();

    assert.deepStrictEqual([...seen, settled()], ['open', 'open', 'done']);
  });

  it('reads the sweep run once its report is taken — open with none, open for a report in the cache alone — from the record committed, which a cleared cache leaves standing; one sweep for the spec (8.10.3, 8.S33)', () => {
    const swept = () => itemState('sweep-run', 'ready-to-build', UNIT);
    const seen = [swept()];
    writeState(dir, layout.cache(UNIT, 'specification', 'sweep.json'), JSON.stringify({ candidates: [], messages: [], builder_calls: [] }));
    seen.push(swept());
    writeState(dir, layout.unit(UNIT, 'sweep-taken.json'), JSON.stringify({ candidates: [], builder_calls: [] }));
    seen.push(swept());
    fs.rmSync(statePath(dir, layout.cache(UNIT)), { recursive: true, force: true });

    assert.deepStrictEqual([...seen, swept()], ['open', 'open', 'done', 'done']);
  });

  it('reads every statement and screen of spec.md traced to the ledger as done, a statement or a screen that is not as open, and a spec its grammar cannot read as open (11.4.1, 11.4.5)', () => {
    const traced = () => itemState('statements-traced', 'ready-to-build', UNIT);
    const seen = [traced()];
    for (const said of ['typed.', `typed. ${builders(dir)}\n\nScreen: the form, drawn.`, 'typed. [see below]']) {
      writeState(dir, layout.unit(UNIT, 'spec.md'), typed(said));
      seen.push(traced());
    }

    assert.deepStrictEqual(seen, ['done', 'open', 'open', 'open']);
  });

  it('reads the canonical assets linked once spec.md links every file the unit\'s current entries link as canonical — one a reference link names never needed, a link to a file elsewhere linking nothing (11.6.3, 11.S9)', () => {
    const linked = () => itemState('assets-linked', 'ready-to-build', UNIT);
    const at = `${UNIT}.specification`;
    const write = (/** @type {string} */ verb, /** @type {string[]} */ flags, /** @type {object} */ content) => ok(dir, ['ledger', verb, at, ...flags], { env: SESSION, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', ...content }) }).id;
    const decided = write('decide', ['--answers', write('ask', [], { text: 'What does the form look like?' })], { text: 'As drawn.', why: 'The spike settled it.' });
    for (const [file, status] of [['form.png', 'canonical'], ['notes.md', 'reference']]) {
      writeState(dir, layout.assets(UNIT, file), `${file}\n`);
      ok(dir, ['asset', 'add', UNIT, layout.assets(UNIT, file), '--entry', decided, '--status', status], { env: SESSION });
    }
    const seen = [linked()];
    writeState(dir, layout.unit(UNIT, 'spec.md'), typed(`typed, as [the form](../form.png) shows. ${builders(dir)}`));
    seen.push(linked());
    writeState(dir, layout.unit(UNIT, 'spec.md'), typed(`typed, as [the form](assets/form.png) shows. ${builders(dir)}`));

    assert.deepStrictEqual([...seen, linked()], ['open', 'open', 'done']);
  });

  it('reads a spike\'s folder linked as canonical linked by a link to it, with or without its trailing slash, or to a file it holds, never by a link beside it (11.6.3)', () => {
    const linked = () => itemState('assets-linked', 'ready-to-build', UNIT);
    const at = `${UNIT}.specification`;
    const write = (/** @type {string} */ verb, /** @type {string[]} */ flags, /** @type {object} */ content) => ok(dir, ['ledger', verb, at, ...flags], { env: SESSION, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', ...content }) }).id;
    const decided = write('decide', ['--answers', write('ask', [], { text: 'How does the frame scroll?' })], { text: 'Smoothly.', why: 'The spike settled it.' });
    const spike = ok(dir, ['asset', 'spike', UNIT, 'frame']).path;
    writeState(dir, `${spike}/Frame.swift`, 'struct Frame {}\n');
    writeState(dir, `${UNIT}/spikes/001-frameworks/notes.md`, 'notes\n');
    ok(dir, ['asset', 'add', UNIT, spike, '--entry', decided, '--status', 'canonical'], { env: SESSION });
    const seen = [linked()];
    for (const target of ['spikes/001-frameworks/notes.md', 'spikes/001-frame', 'spikes/001-frame/', 'spikes/001-frame/Frame.swift']) {
      writeState(dir, layout.unit(UNIT, 'spec.md'), typed(`typed, as [the spike](${target}) shows. ${builders(dir)}`));
      seen.push(linked());
    }

    assert.deepStrictEqual(seen, ['open', 'open', 'done', 'done', 'done']);
  });

  it('keeps a canonical file gone from disk open however the spec links it, until it is set to reference, as its text says (11.6.3)', () => {
    const linked = () => itemState('assets-linked', 'ready-to-build', UNIT);
    const at = `${UNIT}.specification`;
    const write = (/** @type {string} */ verb, /** @type {string[]} */ flags, /** @type {object} */ content) => ok(dir, ['ledger', verb, at, ...flags], { env: SESSION, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', ...content }) }).id;
    const decided = write('decide', ['--answers', write('ask', [], { text: 'What does the form look like?' })], { text: 'As drawn.', why: 'The mockup settled it.' });
    writeState(dir, layout.assets(UNIT, 'form.png'), 'form\n');
    ok(dir, ['asset', 'add', UNIT, layout.assets(UNIT, 'form.png'), '--entry', decided, '--status', 'canonical'], { env: SESSION });
    writeState(dir, layout.unit(UNIT, 'spec.md'), typed(`typed, as [the form](assets/form.png) shows. ${builders(dir)}`));
    fs.rmSync(statePath(dir, layout.assets(UNIT, 'form.png')));
    const gone = linked();
    ok(dir, ['asset', 'status', UNIT, layout.assets(UNIT, 'form.png'), 'reference'], { env: SESSION });

    assert.deepStrictEqual([gone, linked()], ['open', 'done']);
    assert.match(ok(dir, ['checklist', 'show', 'ready-to-build', UNIT]).items.find((/** @type {{key: string}} */ item) => item.key === 'assets-linked').text, /set to reference: asset status <work-unit> <path> reference$/);
  });

  it('reads another unit a phase relies on as done once that unit is completed, never cancelled (12.6.2)', () => {
    const relied = () => itemState('relies-on-done', 'phase-start', UNIT, '1');
    const before = relied();
    createManifest(dir, 'billing', { status: 'cancelled' });
    const cancelled = relied();
    createManifest(dir, 'billing', { status: 'completed' });

    assert.deepStrictEqual([before, cancelled, relied()], ['open', 'open', 'done']);
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

  it('a mark whose commit fails names the retry that commits it, which leaves nothing uncommitted', () => {
    const res = failingStateCommits(dir, () => checklist(['done', 'decided', UNIT, 'cards', 'findings-rerun']));

    assert.strictEqual(res.committed, null);
    assert.deepStrictEqual(retried(dir, res), { took: [`M\t${layout.manifest(UNIT)}`], left: '' });
  });

  it('refuses decided\'s close while a measured finding is not yet re-run', () => {
    assert.strictEqual(refused(['close', 'decided', UNIT, 'cards']), 'checklist close: decided.cards has items open: findings-rerun');
  });

  it('refuses ready to build\'s close while the cut leaves a section undrawn, naming every item open', () => {
    cut(dir, [{ ...CARDS, sections: ['1.1'] }, REFUNDS]);

    assert.strictEqual(refused(['close', 'ready-to-build', UNIT]), 'checklist close: ready-to-build has items open: topics-settled, sweep-run, review-settled, invariants-checked, sections-drawn');
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
    assert.match(refused(['skip', 'finish', UNIT, 'build-log-closed']), /^Usage: engine checklist /);
    assert.strictEqual(refused(['skip', 'finish', UNIT, 'build-log-closed', '--reason', ' ']), 'checklist skip: a skip records its reason — --reason "<text>"');
  });

  it('decided\'s gate shows its own skips; a phase\'s start shows none of its own', () => {
    checklist(['skip', 'decided', UNIT, 'cards', 'findings-rerun', '--reason', 'No finding was measured.']);
    checklist(['skip', 'phase-start', UNIT, '2', 'design-settled', '--reason', 'Nothing shared.']);
    const { at } = records().decided.cards.items['findings-rerun'];

    assert.deepStrictEqual([show('decided', UNIT, 'cards').skips, show('phase-start', UNIT, '2').skips], [
      [{ checklist: 'decided.cards', item: 'findings-rerun', text: 'each measured finding the topic\'s decisions rest on re-run', reason: 'No finding was measured.', at }],
      [],
    ]);
  });

  it('finish shows every phase start\'s skips, in the cut\'s order, then its own, read from the unit\'s manifest by a later conversation (6.S32)', () => {
    checklist(['skip', 'phase-start', UNIT, '2', 'design-settled', '--reason', 'Nothing shared.']);
    checklist(['skip', 'finish', UNIT, 'build-log-closed', '--reason', 'Closed at the last phase.']);
    checklist(['skip', 'phase-start', UNIT, '1', 'design-settled', '--reason', 'One task alone.']);
    const at = (/** @type {string} */ key, /** @type {string} */ item) => records()[key].items[item].at;

    const later = checklist(['show', 'finish', UNIT], { CLAUDE_CODE_SESSION_ID: 'session-2' });

    assert.deepStrictEqual(later.skips, [
      { checklist: 'phase-1-start', item: 'design-settled', text: 'shared design settled', reason: 'One task alone.', at: at('phase-1-start', 'design-settled') },
      { checklist: 'phase-2-start', item: 'design-settled', text: 'shared design settled', reason: 'Nothing shared.', at: at('phase-2-start', 'design-settled') },
      { checklist: 'finish', item: 'build-log-closed', text: 'the build log closed', reason: 'Closed at the last phase.', at: at('finish', 'build-log-closed') },
    ]);
  });
});
