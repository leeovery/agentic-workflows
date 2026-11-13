'use strict';

// ---------------------------------------------------------------------------
// Convergence (16.8; leeway-engine/scripts/domain/convergence.cjs, its screen
// domain/projections/convergence.cjs, the decision point's seam
// domain/decision-point.cjs `convergenceDue`, and the cue on a raise's answer
// in domain/raise.cjs): the run of the person's agreements in a topic's
// discussion, placed by the ledger, broken by a departure and by nothing
// else, and started again from the person's yes or no to the offer
// (16.8.7); no offer while the settling a yes started goes on; the cue on
// the answer that brings it to the offer, never until the ask rule is
// switched on (16.S25), never on a fact's answer, a rerun or outside a
// topic's discussion; the offer drawn where the decision point says it is
// due or on the person's word, its forecast the rule's on each open
// question, each labelled at once, under the person's care entries, a
// question an experiment measures coming to them (16.8.2, 16.S25, 16.S28,
// 9.1.11); the yes logged in the trust log as stated intent, keyed by the
// project, each yes its own event (16.8.6, 16.S26, 16.S45), and the no kept
// in the topic's cache, no offer coming until the next run (16.8.4,
// 16.S27), each only on the person's answer; settling leaving the rule in
// force, a danger point and a measured question still coming to the person
// (16.8.5, 16.S29); and a fresh install's defaults, the offer after 8
// agreements among them (16.20.1, 16.S60).
//
// Layer: verb. World: the ledger suites' epic in discussion, its note window
// holding sixteen questions the person answered and eight open, where notes
// open eight answered and none open; and a second epic's note window, eight
// answered — planted in process, built once and copied for each test. Each
// test keeps its conversation and the trust log in a config folder of its
// own, the log written with the answers the run counts, each naming the
// entry it landed as. The separate call is the stub binary, labelling the
// open questions where a test arms it; the decision point and its seam
// forced in process, as switching the rule on makes them.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, output, refusedPristine, screenOf, sectionOf, statePath, fixtureFrom, cleanupFixture, withEnv } = require('./engine-harness.cjs');
const { useTempFolder, createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, MADE, NOTE, PHASES, SESSION_ID, ledgerHelpers } = require('./ledger-world.cjs');
const { SESSION, raiseHelpers } = require('./raise-world.cjs');
const { DAY, UNDRAWN, lines, history, trustLogHelpers } = require('./trust-world.cjs');
const { labelAnswers } = require('./labels.cjs');
const { auditGate } = require('./gate-audit.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const decisionPoint = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));
const { SHOWN } = require(path.join(SCRIPTS, 'domain/gate.cjs'));
const { offerDue } = require(path.join(SCRIPTS, 'domain/convergence.cjs'));
const { appendEntry } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));
const { newId, shortIds } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { TRUST_LOG } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));
const settings = require(path.join(SCRIPTS, 'domain/trust-settings.cjs'));

/** @typedef {ReturnType<typeof history>} History */
/** @typedef {import('node:test').TestContext} TestContext */

const TOPIC = 'note-window';
const AT = `${UNIT}.${TOPIC}`;
const SPACE = 'space-homing';
const OTHER = 'sora';
const DANGER = 'An answer here could lose data or weaken security, so it always comes to you.';

// The questions open on the note window, each worded for the stub to label.
const OPEN = Object.freeze({
  opens: 'Where does a fresh note window appear?',
  scrolls: 'How does a long note scroll?',
  keeps: 'What does a note file keep on disk?',
  corner: 'How round is a note corner?',
  bin: 'Does deleting a note skip the bin?',
  framework: 'Which framework draws the note view?',
  title: 'Does a note show a title bar?',
  sync: 'Does a note sync across devices?',
});

/** The stub labelling each open question as the forecast's test reads it, the sync question's call failing as with no login. */
const LABELS = JSON.stringify({
  [OPEN.opens]: labelAnswers('behaviour'),
  [OPEN.scrolls]: labelAnswers('behaviour'),
  [OPEN.keeps]: labelAnswers('contract'),
  [OPEN.corner]: labelAnswers('look'),
  [OPEN.bin]: labelAnswers('danger'),
  [OPEN.framework]: labelAnswers('internals', { yes: ['checkable'] }),
  [OPEN.title]: labelAnswers('look'),
  '': 'no-login',
});

/**
 * The ledger at `root` planted in process, in `unit`'s discussion: a
 * question Claude asked, and the person's answer to a question, which took
 * Claude's lean.
 * @param {string} root @param {string} [unit]
 */
function planting(root, unit = UNIT) {
  /** @param {string} topic @param {Record<string, unknown>} fields */
  const plant = (topic, fields) => /** @type {string} */ (appendEntry(root, { unit, topic, phase: 'discussion', session: SESSION_ID, ...fields }, [], newId()).id);
  /** @param {string} topic @param {string} text */
  const asked = (topic, text) => plant(topic, { event: 'asked', ...MADE, text, part_of: null, relies_on: [], cites: [], task: null });
  /** @param {string} topic @param {string} question @param {number} n */
  const decided = (topic, question, n) => plant(topic, {
    event: 'decided', by: 'person', who_moved_whom: 'none', answers: question, text: `Answer ${n}.`, why: 'They said so.', rules_out: [], relies_on: [],
    product_wide: false, sealed: `Answer ${n}.`, alternatives: [], evidence: [], kind: null, hard_to_undo: null, unchecked: true, given: 'own', cites: [], task: null,
  });
  /** @param {string} topic @param {number} n */
  const answered = (topic, n) => decided(topic, asked(topic, `Settled question ${topic} ${n}?`), n);
  return { asked, decided, answered };
}

/** What the world holds, by name: the open questions', and the answered ones' entries, here, on where notes open and on the other epic's note window. */
const made = { open: /** @type {Record<keyof typeof OPEN, string>} */ ({}), here: /** @type {string[]} */ ([]), away: /** @type {string[]} */ ([]), elsewhere: /** @type {string[]} */ ([]) };

const world = fixtureFrom('convergence-', (template) => {
  createManifest(template, UNIT, { work_type: 'epic', phases: PHASES });
  createManifest(template, OTHER, { work_type: 'epic', phases: PHASES });
  const { asked, answered } = planting(statePath(template));
  made.here = Array.from({ length: 16 }, (_, n) => answered(TOPIC, n));
  made.away = Array.from({ length: 8 }, (_, n) => answered(SPACE, n));
  for (const [name, text] of Object.entries(OPEN)) made.open[/** @type {keyof typeof OPEN} */ (name)] = asked(TOPIC, text);
  made.elsewhere = Array.from({ length: 8 }, (_, n) => planting(statePath(template), OTHER).answered(TOPIC, n));
});

const config = useTempFolder('convergence-config-');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = world();
});

afterEach(() => {
  cleanupFixture(dir);
});

const { entries } = ledgerHelpers(() => dir);
const { conversation, inFolder, project, answer, raised } = raiseHelpers(() => dir, config, { sort: 'several', lean: '1' });
const { logEvents } = trustLogHelpers(() => dir, config);

/**
 * The trust log added to as `build` writes it, in this project — from a day
 * ago, or from `start` — each event a second after the last.
 * @param {(h: History) => void} build @param {number} [start]
 */
function logOf(build, start = Date.now() - DAY) {
  const h = history({ project: project(), start });
  build(h);
  fs.mkdirSync(config(), { recursive: true });
  fs.appendFileSync(path.join(config(), TRUST_LOG), lines(...h.events));
}

/** `n` of the person's agreements, each on one of the note window's answered questions, from the one `from` names. @param {History} h @param {number} n @param {number} [from] */
const agreeing = (h, n, from = 0) => made.here.slice(from, from + n).forEach((entry) => h.answered(entry, '1'));

/** The offer due on `topic` as the decision point reads it once switched on: its run, or null. */
const due = (topic = TOPIC) => withEnv({ LEEWAY_CONFIG_DIR: config() }, () => offerDue(dir, UNIT, topic));

/** The decision point's seam as switching the rule on makes it, for the test `t`. @param {TestContext} t */
const switchedOn = (t) => t.mock.method(decisionPoint, 'convergenceDue', offerDue);

/** The decision point as switching the rule on makes it, for the test `t`, on a question never drawn blind. @param {TestContext} t */
const ruledOn = (t) => t.mock.method(decisionPoint, 'decide', (/** @type {any} */ call, /** @type {any} */ at) => decisionPoint.ruled(call, { ...at, chain: UNDRAWN }));

/** Why the offer is refused on the note window, drawn as it comes with no word of the person's. */
const notDue = () => refusedPristine(dir, ['render', 'convergence', AT], { env: conversation() }).error;

/** The offer, drawn in the conversation `env` names, its payload announced: the whole render. @param {string[]} [flags] @param {Record<string, string>} [env] */
const offer = (flags = [], env = {}) => output(dir, ['render', 'convergence', AT, ...flags], { env: conversation({ LEEWAY_GATE_SURFACE: '1', ...env }) });

/** The person's answer `pick` on the offer last drawn: the gate's answer. @param {'y'|'n'} pick */
const answerOffer = (pick) => ok(dir, ['gate', 'convergence offer', '--pick', pick], { env: conversation() });

/** The person's yes on the offer, drawn on their word: the accept's answer. */
function accept() {
  offer(['--asked']);
  answerOffer('y');
  return ok(dir, ['convergence', 'accept', UNIT, TOPIC], { env: conversation() });
}

/** The note window's cache file keeping the person's no. */
const declinedFile = () => statePath(dir, '.cache', UNIT, 'discussion', TOPIC, 'convergence.json');

/** The trust log's convergence events. */
const accepted = () => logEvents().filter(({ type }) => type === 'convergence');

/** The open question `name`'s short id, as the ledger stands. @param {keyof typeof OPEN} name */
const shortOf = (name) => /** @type {string} */ (shortIds(entries().map(({ id }) => id)).get(made.open[name]));

/** The DATA line the offer `out` gives the open question `name`. @param {string} out @param {keyof typeof OPEN} name */
const forecastFor = (out, name) => sectionOf(out, 'DATA').split('\n').find((line) => line.startsWith(`open ${shortOf(name)}: `));

/** Claude's call on the open question `text`, leaning to its first row. @param {string} text */
const callOn = (text) => ({
  question: text,
  rows: [{ key: '1', name: 'Mine', text: `My answer to ${text}`, notice: 'what I would build' }, { key: '2', name: 'Other', text: `Another answer to ${text}`, notice: 'what else it could be' }],
  lean: '1', why: 'It follows the person.', sort: 'several', mechanism: 'How it is built.', product_wide: false,
});

describe('the run (16.8.7)', () => {
  it('16.S25, 16.S60: the person\'s agreements in a row in the topic\'s discussion bring the offer at the eighth, never the seventh', () => {
    logOf((h) => agreeing(h, 7));
    const seven = due();
    logOf((h) => h.answered(made.here[7], '1'));

    assert.deepStrictEqual([seven, due()], [null, 8]);
  });

  it('a departure breaks it; an answer the person didn\'t follow, Claude\'s own call there, an answer on another topic and one a reversal cancels neither extend nor break it', () => {
    logOf((h) => {
      agreeing(h, 2);
      h.answered(made.here[2], '2');
      h.answered(made.here[3], '1');
      h.reverse(made.here[3]);
      agreeing(h, 8, 4);
      h.unfollowed('several');
      h.call('several', 'behaviour', {}, { entry: made.here[12] });
      for (const entry of made.away) h.answered(entry, '1');
      h.answered(made.here[13], '1');
    });

    assert.strictEqual(due(), 9);
  });

  it('the person\'s reversal entered in the topic is a departure: it breaks the run, and the answer it reverses no longer counts (16.10.10)', () => {
    logOf((h) => agreeing(h, 8));
    ok(dir, ['ledger', 'replace', NOTE, '--replaces', made.here[2], '--reason', 'changed-mind'], {
      env: conversation(), stdin: JSON.stringify({ by: 'person', drops: ['Answer 2.'], text: 'Another answer.', why: 'They changed their mind.' }),
    });
    logOf((h) => agreeing(h, 8, 8), Date.now());

    assert.strictEqual(due(), 8);
  });

  it('the person\'s "don\'t care" on a blind question, which tells nothing of Claude\'s judgement, neither extends nor breaks it (16.17.1)', () => {
    logOf((h) => {
      agreeing(h, 4);
      h.answered(made.here[4], '1', 'behaviour', { dontCare: true, blind: true });
      agreeing(h, 4, 5);
    });

    assert.strictEqual(due(), 8);
  });

  it('answers in another unit\'s topic of the same key never reach it', () => {
    logOf((h) => made.elsewhere.forEach((entry) => h.answered(entry, '1')));

    assert.strictEqual(due(), null);
  });

  it('the person\'s yes on another topic leaves this topic\'s run as it stands', () => {
    logOf((h) => {
      agreeing(h, 4);
      h.converged(UNIT, SPACE);
      agreeing(h, 4, 4);
    });

    assert.strictEqual(due(), 8);
  });

  it('no offer is due where nothing is left open to settle, however long the run', () => {
    logOf((h) => made.away.forEach((entry) => h.answered(entry, '1')));

    assert.strictEqual(due(SPACE), null);
  });

  it('after the person\'s yes, no offer comes while a question open at the yes is still open, however long the run since; once each is closed, one comes on a question asked since', (t) => {
    const { asked, decided } = planting(statePath(dir));
    t.mock.timers.enable({ apis: ['Date'], now: Date.now() - 2 * DAY });
    const before = asked(TOPIC, 'Does a note keep its place?');
    t.mock.timers.reset();
    logOf((h) => {
      h.converged(UNIT, TOPIC);
      Object.values(made.open).forEach((question, n) => h.answered(decided(TOPIC, question, n), '1'));
    });
    const settling = due();
    asked(TOPIC, 'Does a note pin to the desktop?');
    logOf((h) => h.answered(decided(TOPIC, before, 8), '1'), Date.now());

    assert.deepStrictEqual([settling, due()], [null, 9]);
  });
});

describe('the cue on a raise\'s answer (16.8.1)', () => {
  it('until the ask rule is switched on, no offer comes: the answer bringing the run to 8 cues nothing', async () => {
    logOf((h) => agreeing(h, 7));
    const { raise } = (await raised(NOTE, ['--answers', made.open.opens], callOn(OPEN.opens), conversation())).res;

    assert.deepStrictEqual(answer(raise, ['--pick', '1']).convergence, undefined);
  });

  it('16.S25: switched on, the answer bringing the run to 8 cues the offer — the unit, the topic and the agreements in a row there — and its rerun cues nothing', async (t) => {
    switchedOn(t);
    logOf((h) => agreeing(h, 7));
    const { raise } = (await raised(NOTE, ['--answers', made.open.opens], callOn(OPEN.opens), conversation())).res;

    assert.deepStrictEqual([answer(raise, ['--pick', '1']).convergence, answer(raise, ['--pick', '1']).convergence], [{ unit: UNIT, topic: TOPIC, agreements: 8 }, undefined]);
  });

  it('a fact\'s answer cues nothing, though the offer is due', async (t) => {
    switchedOn(t);
    logOf((h) => agreeing(h, 8));
    const fact = { question: OPEN.keeps, rows: [], mechanism: 'Outside the code.', product_wide: false };
    const { raise } = (await raised(NOTE, ['--answers', made.open.keeps, '--fact'], fact, conversation())).res;

    assert.deepStrictEqual([answer(raise, ['--own'], { text: 'The text alone.', why: 'They know their files.' }).convergence, due()], [undefined, 8]);
  });

  it('an answer outside a topic\'s discussion — a bugfix\'s investigation — cues nothing, whatever the decision point would say', async (t) => {
    t.mock.method(decisionPoint, 'convergenceDue', () => 8);
    createManifest(dir, 'mend', { work_type: 'bugfix', phases: { investigation: { items: { mend: { status: 'in-progress' } } } } });
    const where = 'mend.investigation.mend';
    const { id } = ok(dir, ['ledger', 'ask', where], { env: conversation(), stdin: JSON.stringify({ ...MADE, text: 'Where does the crash start?' }) });
    const { raise } = (await raised(where, ['--answers', id], callOn('Where does the crash start?'), conversation())).res;

    assert.deepStrictEqual(answer(raise, ['--pick', '1']).convergence, undefined);
  });
});

describe('the offer (16.8.2)', () => {
  it('16.S25: drawn where the decision point says it is due — the run, how many are open, how many I\'d settle and which come to the person by kind, the most first, kinds tied in the labeller\'s order and those whose label failed last — each open question labelled at once, its DATA saying each one\'s forecast and that a point may still draw blind; refused at the same run while the decision point offers none, as until the ask rule is switched on', (t) => {
    logOf((h) => {
      h.agree(30, 'behaviour');
      agreeing(h, 8);
    });
    const offersNone = notDue();
    switchedOn(t);
    const meet = fs.mkdtempSync(path.join(config(), 'meet-'));

    const out = offer([], { CLAUDE_STUB_ANSWERS: LABELS, CLAUDE_STUB_MEET: `${Object.keys(OPEN).length}:${meet}` });

    const gate = auditGate(out, 'render convergence');
    assert.strictEqual(offersNone, 'render convergence: no offer is due on Note Window — the decision point offers none at 8 agreements in a row; on the person\'s word, --asked');
    assert.deepStrictEqual(screenOf(out, 'MENU: convergence offer'), [
      '· · · · · · · · · · · ·',
      '8 agreements in a row on Note Window.',
      '',
      '8 open: I\'d settle 3; 5 come to you — 2 looks, 1 danger, 1 contract, 1 of a kind I couldn\'t tell.',
      '',
      '◆ Settle the rest?',
      '',
      'y/yes → Settle the rest — my 3 go in the ledger, your 5 come one',
      '        at a time, then the decided screen',
      'n/no  → Not yet — keep going point by point; I\'ll offer again',
      '        after the next run',
    ]);
    assert.deepStrictEqual(sectionOf(out, 'DATA').split('\n').slice(0, -1), [
      'offer: after 8 agreements in a row',
      'forecast: the ask rule\'s as the counts stand now, never binding — settling raises each open question as any call, and the rule decides each; at settle time a point may still be drawn blind and come to the person, its reveal saying why',
      `open ${shortOf('opens')}: mine, behaviour`,
      `open ${shortOf('scrolls')}: mine, behaviour`,
      `open ${shortOf('keeps')}: yours, contract`,
      `open ${shortOf('corner')}: yours, look`,
      `open ${shortOf('bin')}: yours, danger`,
      `open ${shortOf('framework')}: mine, internals`,
      `open ${shortOf('title')}: yours, look`,
      `open ${shortOf('sync')}: yours, no kind`,
    ]);
    assert.deepStrictEqual(gate?.options.map(({ key, word }) => `${key}/${word}`), ['y/yes', 'n/no']);
  });

  it('16.S28: on the person\'s word it is drawn whatever the run — three agreements in a row — every question coming to them while no label is given; with no word of theirs it is refused', () => {
    logOf((h) => agreeing(h, 3));

    const out = offer(['--asked']);

    assert.deepStrictEqual(screenOf(out, 'MENU: convergence offer').slice(1, 9), [
      'You\'ve asked me to settle the rest of Note Window.',
      '',
      '8 open: all 8 come to you — 8 of a kind I couldn\'t tell.',
      '',
      '◆ Settle the rest?',
      '',
      'y/yes → Settle the rest — your 8 come one at a time, then the',
      '        decided screen',
    ]);
    assert.strictEqual(sectionOf(out, 'DATA').split('\n')[0], 'offer: on the person\'s word');
    assert.strictEqual(notDue(), 'render convergence: no offer is due on Note Window — the decision point offers none at 3 agreements in a row; on the person\'s word, --asked');
  });

  it('16.8.5: the forecast reads the person\'s care entries — a quiet kind under one in this project comes to them', () => {
    logOf((h) => h.agree(30, 'behaviour'));
    fs.writeFileSync(path.join(config(), 'person.md'), `<!-- leeway: the record of you, version 1 -->\n\n# The record of you\n\n## Care entries\n\n- Fumi: behaviour · ${project()} · 2026-01-01T00:00:00.000Z\n`);

    const out = offer(['--asked'], { CLAUDE_STUB_ANSWERS: LABELS });

    assert.deepStrictEqual([forecastFor(out, 'opens'), forecastFor(out, 'scrolls')], [`open ${shortOf('opens')}: yours, behaviour`, `open ${shortOf('scrolls')}: yours, behaviour`]);
  });

  it('refuses, writing nothing, a topic with nothing open, one under no discussion, a unit the project lacks and an address of another shape', () => {
    const refused = (/** @type {string} */ at) => refusedPristine(dir, ['render', 'convergence', at, '--asked'], { env: conversation() }).error;

    assert.deepStrictEqual([refused(`${UNIT}.${SPACE}`), refused(`${UNIT}.menu-bar`), refused('kumo.notes'), refused(UNIT)], [
      'render convergence: nothing is open on Space Homing to settle',
      `render convergence: ${UNIT} has no topic "menu-bar" under discussion — the offer settles the rest of a topic under discussion`,
      'render convergence: there is no work unit "kumo" — the start menu lists the work in progress',
      `render convergence: address must be <work-unit>.<topic>, got "${UNIT}"`,
    ]);
  });
});

describe('the person\'s answer (16.8.3, 16.8.4, 16.8.6)', () => {
  it('16.S26, 16.S45: their yes is stated intent, logged in the trust log under the project\'s id, with no kind — a rerun read once, another yes its own — and the run starts again from it', (t) => {
    switchedOn(t);
    logOf((h) => agreeing(h, 8));
    offer();
    answerOffer('y');

    const yes = ok(dir, ['convergence', 'accept', UNIT, TOPIC], { env: conversation() });
    ok(dir, ['convergence', 'accept', UNIT, TOPIC], { env: conversation() });
    const restarted = [due(), notDue()];
    accept();

    assert.deepStrictEqual(yes, { ok: true, convergence: 'accepted', unit: UNIT, topic: TOPIC });
    const [{ id, at: _at, project_name: _name, ...event }, ...more] = accepted();
    assert.deepStrictEqual([event, more.map((again) => again.id === id)], [{ v: 1, type: 'convergence', project: project(), model: null, session: SESSION, unit: UNIT, topic: TOPIC }, [true, false]]);
    assert.deepStrictEqual(restarted, [null, 'render convergence: no offer is due on Note Window — the decision point offers none at 0 agreements in a row; on the person\'s word, --asked']);
  });

  it('16.S27: their no is kept in the topic\'s cache, when they gave it, and no offer comes again until the next run of 8', (t) => {
    switchedOn(t);
    logOf((h) => agreeing(h, 8));
    offer();
    answerOffer('n');
    const { answered } = JSON.parse(fs.readFileSync(inFolder(SHOWN), 'utf8'));

    const no = ok(dir, ['convergence', 'decline', UNIT, TOPIC], { env: conversation() });
    const afterNo = due();
    logOf((h) => agreeing(h, 7, 8), Date.now());
    const seven = due();
    logOf((h) => h.answered(made.here[15], '1'), Date.now() + DAY);

    assert.deepStrictEqual(no, { ok: true, convergence: 'declined', unit: UNIT, topic: TOPIC });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(declinedFile(), 'utf8')), { declined: answered.at });
    assert.deepStrictEqual([afterNo, seven, due(), accepted()], [null, null, 8, []]);
  });

  it('refuses, writing nothing, an answer the person never gave — no offer shown, their other row, another topic\'s — and a call of another shape', () => {
    logOf((h) => agreeing(h, 8));
    const refused = (/** @type {string[]} */ args) => refusedPristine(dir, ['convergence', ...args], { env: conversation() }).error;
    const before = refused(['accept', UNIT, TOPIC]);
    offer(['--asked']);
    answerOffer('n');

    assert.deepStrictEqual([before, refused(['accept', UNIT, TOPIC]), refused(['decline', UNIT, SPACE]), refused(['accept', UNIT]), refused(['settle', UNIT, TOPIC])], [
      `convergence accept: the person has not said yes to settling the rest of ${TOPIC} — only their answer on the offer, render convergence, leads here, and nothing is written`,
      `convergence accept: the person has not said yes to settling the rest of ${TOPIC} — only their answer on the offer, render convergence, leads here, and nothing is written`,
      `convergence decline: the person has not said no to settling the rest of ${SPACE} — only their answer on the offer, render convergence, leads here, and nothing is written`,
      'Usage: engine convergence accept <work-unit> <topic>   (the person\'s yes on the convergence offer)',
      'Usage: engine convergence <accept|decline> …\nconvergence accept <work-unit> <topic>   (the person\'s yes on the convergence offer)\nconvergence decline <work-unit> <topic>   (the person\'s no on it)',
    ]);
    assert.deepStrictEqual([accepted(), fs.existsSync(declinedFile())], [[], false]);
  });
});

describe('settling (16.8.5)', () => {
  it('16.S26, 16.S29: once accepted, each point is raised as usual and the rule still holds — a quiet kind\'s call lands in the ledger as mine, a danger point still comes to the person', async (t) => {
    ruledOn(t);
    logOf((h) => h.agree(30, 'behaviour'));
    const env = conversation({ CLAUDE_STUB_ANSWERS: LABELS });
    accept();

    const settled = (await raised(NOTE, ['--answers', made.open.opens], callOn(OPEN.opens), env)).res;
    const bin = (await raised(NOTE, ['--answers', made.open.bin], callOn(OPEN.bin), env)).res;

    assert.deepStrictEqual([settled.decision, entries().at(-1)?.by, entries().at(-1)?.answers], ['proceed', 'claude', made.open.opens]);
    assert.deepStrictEqual([bin.decision, bin.reason], ['ask', DANGER]);
  });

  it('9.1.11: a question an experiment still running measures always comes to the person — the forecast counts it theirs, as the rule does, and its raise under the rule asks, naming the experiment', async (t) => {
    ruledOn(t);
    logOf((h) => h.agree(30, 'behaviour'));
    const problem = statePath(dir, '.cache', UNIT, 'discussion', TOPIC, 'problem.md');
    fs.mkdirSync(path.dirname(problem), { recursive: true });
    fs.writeFileSync(problem, '# Problem — where a note opens\n');
    const experiment = ok(dir, ['experiment', 'create', UNIT, TOPIC, '--slug', 'placement', '--from', 'discussion', '--question', shortOf('opens'), '--problem', problem], { env: conversation() }).id;

    const out = offer(['--asked'], { CLAUDE_STUB_ANSWERS: LABELS });
    const measured = (await raised(NOTE, ['--answers', made.open.opens], callOn(OPEN.opens), conversation({ CLAUDE_STUB_ANSWERS: LABELS }))).res;

    assert.deepStrictEqual([forecastFor(out, 'opens'), forecastFor(out, 'scrolls'), measured.decision, measured.reason], [
      `open ${shortOf('opens')}: yours, behaviour`, `open ${shortOf('scrolls')}: mine, behaviour`, 'ask', `Experiment ${experiment}, still running, measures this question, so it comes to you.`,
    ]);
  });
});

describe('the defaults (16.20.1)', () => {
  it('16.S60: a fresh install decides at the release\'s numbers — 20%, 10% where hard to undo, asking again at 25% and 12.5%, the other projects capped at 10 answers\' weight, half at six months old and for a new model\'s inheritance, blind questions at one in ten — and offers convergence after 8 agreements in a row', () => {
    const { threshold, build_threshold: build } = withEnv({ LEEWAY_CONFIG_DIR: config() }, () => settings.trustSettings());

    assert.deepStrictEqual({
      threshold, build, hard: threshold * settings.HARD_TO_UNDO, again: threshold * settings.ASK_AGAIN, hardAgain: threshold * settings.HARD_TO_UNDO * settings.ASK_AGAIN,
      percentile: settings.PERCENTILE, cap: settings.PRIOR_CAP, aged: settings.AGED_AFTER_MS / DAY, agedWeight: settings.AGED_WEIGHT, inherited: settings.INHERITED_WEIGHT,
      blind: settings.BLIND_SHARE, run: settings.CONVERGENCE_RUN,
    }, {
      threshold: 0.2, build: null, hard: 0.1, again: 0.25, hardAgain: 0.125,
      percentile: 0.95, cap: 10, aged: 183, agedWeight: 0.5, inherited: 0.5,
      blind: 0.1, run: 8,
    });
  });
});
