'use strict';

// ---------------------------------------------------------------------------
// Ready to build (leeway-engine/scripts/domain/ready-to-build.cjs, its screen
// domain/projections/ready-to-build.cjs): `engine render ready-to-build
// <unit> [--page] [--calls]`, an epic's screen as 11.8.8 draws it — Claude's
// calls at the spec counted by kind, the outline, the phase cut read from the
// manifest (11.S31), auto first and recommended (3.S18), the review row only
// where the session can publish a page (11.S22, 11.S27), and, while the page
// is open, its foot counting the review by the marks last stored (11.11.7);
// a verdict asked of each call the person changed among the spec's gap
// answers before the gate (16.10.11); the screen standing on ready to
// build's close, voided by a land or a cut after it (E12), and refused for an
// old spec's items, a build begun and a unit the spec's entry refuses;
// `engine ready-to-build yes <unit> --position auto|step [--marks <file>]`,
// writing `build: {position}` and committing it, the review settled on fresh
// marks while the page is open and none written while it is not (11.S22,
// 11.S25), no build before it (11.S13); the split — a decided topic
// postponed while the spec is written, its lines then invented, and no
// postpone once the build has begun (11.S18, 18.4.19); and `engine workunit
// position <unit> auto|step`, the switch logged as a `position-switch` event
// while the first pick is not (3.3.6, 3.3.7, E14). Every refusal writes and
// commits nothing.
//
// Layer: verb. Worlds, each built once and copied: an epic, `payments`, its
// topics `cards` and `refunds` decided through the ledger's verbs, two calls
// of Claude's made at the spec, one labelled and one not, and a call of
// Claude's on `cards` that is not the spec's; its sweep taken, its spec
// landed citing them and cut into two phases; and the same with ready to
// build's checklist worked and closed. Each test's trust log sits in a
// config folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, output, refuses, refusedPristine, sectionOf, statePath, layout, writeState, readState, readManifest, commitAll, stateGit, head, lastMessage, touched, fixtureFrom, cleanupFixture,
} = require('./engine-harness.cjs');
const { createManifest, useTempFolder } = require('./discovery-test-utils.cjs');
const { MADE } = require('./ledger-world.cjs');
const { NB, unwrap } = require('./render-surfaces-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { trustLogPath } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));

const UNIT = 'payments';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'ready-to-build-session' });
const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });
const SPEC_AT = `${UNIT}.specification`;
const READ_BACK = layout.cache(UNIT, 'specification', 'read-back.json');

/** Each entry's short id by name, filled as the world is built. @type {Record<string, string>} */
const made = {};

/** One ledger write: its short id. @param {string} dir @param {string} verb @param {string} at @param {string[]} flags @param {Record<string, unknown>} content */
function write(dir, verb, at, flags, content) {
  return ok(dir, ['ledger', verb, at, ...flags], { env: SESSION, stdin: JSON.stringify(content) }).id;
}

/** A question asked at `at` and answered as `answer` says: the answer's short id. @param {string} dir @param {string} at @param {string} text @param {Record<string, unknown>} answer */
function answered(dir, at, text, answer) {
  return write(dir, 'decide', at, ['--answers', write(dir, 'ask', at, [], { ...MADE, text })], { why: 'Because.', ...answer });
}

/** A discussion topic, mapped. @param {number} order */
const mapped = (order) => ({ order, summary: `Topic ${order}`, source: 'discovery' });

/** The epic, its two topics' discussions as `status` gives them. @param {string} dir @param {string} status */
function payments(dir, status) {
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: {
      discovery: { items: { cards: mapped(1), refunds: mapped(2) } },
      discussion: { items: { cards: { status }, refunds: { status } } },
    },
  });
}

/** The spec, its statements citing the entries the world made. */
const spec = () => [
  '# Payments', '',
  '## 1. Cards', '', '### 1.1 The form', '',
  `1.1.1 Visa and Mastercard are taken. [${made.taken}]`, '',
  `1.1.2 An unknown brand is refused. [${made.brand}]`, '',
  '## 1-S. Scenarios for §1', '',
  '1.S1 Given a form, when a Visa is offered, then it is taken. (1.1.1)', '',
  '1.S2 Given a form, when the brand is unknown, then it is refused. (1.1.2)', '',
  '## 2. Refunds', '', '### 2.1 Whole', '',
  `2.1.1 A refund goes back to the card. [${made.refund}]`, '',
  `2.1.2 A refund is sent within a day. [${made.day}]`, '',
  '## 2-S. Scenarios for §2', '',
  '2.S1 Given a charge, when it is refunded, then the card is credited. (2.1.1, 2.1.2)', '',
].join('\n');

const CARDS = { name: 'Cards', goal: 'Cards are taken as decided.', scenarios: ['1.S1', '1.S2'], sections: ['1'], relies_on: [] };
const REFUNDS = { name: 'Refunds', goal: 'Refunds reach the card.', scenarios: ['2.S1'], sections: ['2.1'], relies_on: [1] };

/** The cut `phases` written by the verb from a file in the cache. @param {string} dir @param {object[]} phases */
function cut(dir, phases) {
  ok(dir, ['cut', UNIT, '--file', writeState(dir, layout.cache(UNIT, 'specification', 'cut.json'), JSON.stringify({ phases }))]);
}

/** The epic built through the verbs: its topics decided, the calls at the spec made, its sweep taken, its spec landed and cut. @param {string} dir */
function buildLanded(dir) {
  payments(dir, 'in-progress');
  commitAll(dir, 'init');
  made.taken = answered(dir, `${UNIT}.discussion.cards`, 'Which cards are taken?', { ...PERSON, text: 'Visa and Mastercard.' });
  answered(dir, `${UNIT}.discussion.cards`, 'Is the brand shown?', { ...MADE, text: 'As a logo.' });
  made.refund = answered(dir, `${UNIT}.discussion.refunds`, 'Where does a refund go?', { ...PERSON, text: 'Back to the card.' });
  payments(dir, 'completed');
  writeState(dir, layout.unit(UNIT, 'sweep-taken.json'), JSON.stringify({ taken: '2026-11-01T00:00:00.000Z', messages: [], candidates: [] }));
  commitAll(dir, 'topics settled, the sweep taken');
  made.brand = answered(dir, SPEC_AT, 'What of an unknown brand?', { ...MADE, text: 'Refused.', kind: 'behaviour' });
  made.day = answered(dir, SPEC_AT, 'How soon is a refund sent?', { ...MADE, text: 'Within a day.' });
  writeState(dir, layout.unit(UNIT, 'spec.md'), spec());
  ok(dir, ['spec', 'land', UNIT]);
  cut(dir, [CARDS, REFUNDS]);
}

/** Claude's items of ready to build's checklist marked done, and the checklist closed: the close's answer. @param {string} at */
function closeReady(at) {
  for (const item of ['replacements-checked', 'review-settled', 'invariants-checked']) ok(at, ['checklist', 'done', 'ready-to-build', UNIT, item]);
  return ok(at, ['checklist', 'close', 'ready-to-build', UNIT]);
}

const landed = fixtureFrom('ready-to-build-', buildLanded);

const closed = fixtureFrom('ready-to-build-closed-', (at) => {
  buildLanded(at);
  closeReady(at);
});

let dir = '';
const config = useTempFolder('ready-to-build-config-');

/** Each test of the calling `describe` on a copy of `world`, its trust log its own. @param {() => string} world */
function eachOn(world) {
  /** @type {string|undefined} */
  let pinned;
  beforeEach(() => {
    dir = world();
    pinned = process.env.LEEWAY_CONFIG_DIR;
    process.env.LEEWAY_CONFIG_DIR = config();
  });
  afterEach(() => {
    process.env.LEEWAY_CONFIG_DIR = pinned;
    cleanupFixture(dir);
  });
}

/** The screen, `flags` given. @param {string[]} [flags] */
const screen = (flags = []) => output(dir, ['render', 'ready-to-build', UNIT, ...flags], { env: SESSION });

/** The keys of the gate's rows, in order. @param {string} out */
const rowKeys = (out) => [...sectionOf(out, 'MENU: ready to build').matchAll(/^\*\*`?([a-zA-Z]+(?:\/[a-z]+)?)`?\*\*/gm)].map((m) => m[1]);

/** What a row of the gate shown leads to. @param {string} name @param {string} key */
const pick = (name, key) => ok(dir, ['gate', name, '--pick', key], { env: SESSION }).next;

/** The refusal's error, nothing written or committed. @param {string[]} args */
const refused = (args) => refusedPristine(dir, args, { env: SESSION }).error;

/** The yes, `flags` after the unit. @param {string[]} flags */
const yes = (flags) => ok(dir, ['ready-to-build', 'yes', UNIT, ...flags], { env: SESSION });

/** The trust log's events of `type`. @param {string} type */
function events(type) {
  const log = trustLogPath();
  return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line)).filter((event) => event.type === type) : [];
}

/** The review page built and its publishing recorded, which opens it. */
function publish() {
  ok(dir, ['spec', 'page', UNIT]);
  ok(dir, ['spec', 'published', UNIT, 'https://claude.ai/public/artifacts/0123']);
}

/** Marks Claude read back from the page, written where the gate's rows take them: its path. @param {Record<string, object>} marks */
const readBack = (marks) => writeState(dir, READ_BACK, JSON.stringify(marks));

/** A comment the person left on a line, waiting for Claude. @param {string} id @param {string} text */
const commented = (id, text) => ({ [id]: { s: 'comment', t: { p1000: { by: 'p', x: text } } } });

describe('the screen (11.8.8, 3.S18)', () => {
  eachOn(closed);

  it('draws an epic\'s ready to build: its title, Claude\'s calls at the spec counted by kind, the outline, the phase cut read from the manifest, and the foot over auto first and recommended, step, the calls and a comment — no review row where the session cannot publish a page (11.S27, 11.S31)', () => {
    const out = screen();

    assert.strictEqual(sectionOf(out, 'DISPLAY: ready to build'), [
      'Payments — ready to build',
      '',
      'CLAUDE\'S CALLS (2)',
      '  1 behaviour · 1 unlabelled — the labeller gives each its kind',
      '',
      'THE OUTLINE (2 sections)',
      '  ├─ 1 Cards',
      '  └─ 2 Refunds',
      '',
      'THE PHASE CUT (2 phases · 3 scenarios)',
      '  ├─ 1 Cards',
      '  │     2 scenarios · draws on §1',
      '  └─ 2 Refunds',
      '        1 scenario · draws on §2.1',
      '',
    ].join('\n'));
    assert.strictEqual(sectionOf(out, 'MENU: ready to build'), [
      '· · · · · · · · · · · ·',
      'Your pick approves the outline and the phase cut, and starts the build in that position.',
      '',
      '**`◆ Build it, and in which position?`**',
      '',
      '**`a/auto`**  → Auto — runs on its own; danger stops what it touches, a',
      `${NB(10)}question for you parks only what depends on it, and`,
      `${NB(10)}finish waits for you (recommended)`,
      '**`s/step`**  → Step — it also stops after each task, for you to review',
      `${NB(10)}and test it`,
      '**`c/calls`** → See Claude\'s 2 calls',
      '**Comment** → Ask for a change to the outline or the phase cut',
      '',
    ].join('\n'));
    assert.deepStrictEqual(pick('ready to build', 'a'), { kind: 'engine', argv: ['ready-to-build', 'yes', UNIT, '--position', 'auto'] });
    screen();
    assert.deepStrictEqual(pick('ready to build', 's'), { kind: 'engine', argv: ['ready-to-build', 'yes', UNIT, '--position', 'step'] });
  });

  it('offers the review on a page where the session can publish one, saying it is optional, the row building the page (11.S22, 11.11.11)', () => {
    const out = screen(['--page']);

    assert.deepStrictEqual(rowKeys(out), ['a/auto', 's/step', 'r/review', 'c/calls', 'Comment']);
    assert.match(unwrap(sectionOf(out, 'MENU: ready to build')), /^\*\*`r\/review`\*\* → Review the spec on a page first — all of it, the parts you care about, or none$/m);
    assert.deepStrictEqual(pick('ready to build', 'r'), { kind: 'engine', argv: ['spec', 'page', UNIT] });
  });

  it('lists Claude\'s calls at the spec with --calls, each under its question with its kind — never a call made in a topic — and draws no calls row', () => {
    const out = screen(['--calls', '--page']);

    assert.match(sectionOf(out, 'DISPLAY: ready to build'), /^CLAUDE'S CALLS \(2\)\n {2}1 behaviour · 1 unlabelled — the labeller gives each its kind\n {2}├─ ◇ What of an unknown brand\? +\[behaviour\]\n {2}│ {5}Refused\.\n {2}└─ ◇ How soon is a refund sent\? +\[unlabelled\]\n {8}Within a day\.\n$/m);
    assert.deepStrictEqual(rowKeys(out), ['a/auto', 's/step', 'r/review', 'Comment']);
  });

  it('opens the calls from their row, keeping the review row the session can offer', () => {
    screen(['--page']);

    assert.deepStrictEqual(pick('ready to build', 'c'), { kind: 'engine', argv: ['render', 'ready-to-build', UNIT, '--calls', '--page'] });
  });

  it('while the review page is open, counts in the foot the lines ticked, those carrying Claude\'s tick let stand and the rest, by the marks last stored; its review row reads the comments, and each pick takes the marks read back (11.11.7, 11.11.5)', () => {
    publish();
    ok(dir, ['spec', 'marks', UNIT, '--file', readBack({ s1: { m: { '1-1-1': { s: 'tick' } } } })]);
    const out = screen(['--page']);

    assert.match(sectionOf(out, 'MENU: ready to build'), /^Your pick approves the outline and the phase cut, records the 1 line you ticked on the review page and the 2 carrying Claude's tick that you let stand \(the other 4 pass without review\), and starts the build in that position\.$/m);
    assert.match(unwrap(sectionOf(out, 'MENU: ready to build')), /^\*\*`r\/review`\*\* +→ Read the comments you've left on the page$/m);
    const file = statePath(dir, READ_BACK);
    assert.deepStrictEqual(pick('ready to build', 'r'), { kind: 'engine', argv: ['spec', 'marks', UNIT, '--file', file] });
    screen(['--page']);
    assert.deepStrictEqual(pick('ready to build', 'a'), { kind: 'engine', argv: ['ready-to-build', 'yes', UNIT, '--position', 'auto', '--marks', file] });
  });

  it('says so where the person ticked nothing on the open page', () => {
    publish();

    assert.match(sectionOf(screen(), 'MENU: ready to build'), /^Your pick approves the outline and the phase cut, records the 3 carrying Claude's tick that you let stand \(the other 4 pass without review\), and starts the build in that position\.$/m);
  });

  it('shows a skipped item with its reason (6.4.5)', () => {
    for (const item of ['replacements-checked', 'review-settled']) ok(dir, ['checklist', 'done', 'ready-to-build', UNIT, item]);
    ok(dir, ['checklist', 'skip', 'ready-to-build', UNIT, 'invariants-checked', '--reason', 'The spec states no invariant.']);
    ok(dir, ['checklist', 'close', 'ready-to-build', UNIT]);

    assert.match(sectionOf(screen(), 'DISPLAY: ready to build'), /\n\n {2}⚑ Skipped: every invariant names a check or says none can — The\n {4}spec states no invariant\.\n$/);
  });
});

describe('a verdict on each call the person changed among the spec\'s gap answers (16.10.11)', () => {
  eachOn(closed);

  it('asks it before the gate, one at a time, given at ready to build, the yes refused until each is asked — a change made in a topic never asked here', () => {
    const call = answered(dir, SPEC_AT, 'Is a refund ever partial?', { ...MADE, text: 'Never.' });
    const changed = write(dir, 'replace', SPEC_AT, ['--replaces', call, '--reason', 'changed-mind'], { by: 'person', drops: ['never partial'], text: 'When the person asks.', why: 'The person wants it so.' });
    const elsewhere = answered(dir, `${UNIT}.discussion.cards`, 'Is a card saved?', { ...MADE, text: 'Never.' });
    write(dir, 'replace', `${UNIT}.discussion.cards`, ['--replaces', elsewhere, '--reason', 'changed-mind'], { by: 'person', drops: ['never saved'], text: 'When asked.', why: 'The person wants it so.' });
    const first = screen();

    assert.match(sectionOf(first, 'DISPLAY: ready to build'), /YOUR VERDICT \(1 of 1 call you changed\)\n {2}└─ Is a refund ever partial\?\n {8}My answer: Never\.\n {8}Yours: When the person asks\.\n$/);
    assert.ok(!first.includes('MENU: ready to build'), 'the gate waits on the verdict');
    assert.strictEqual(refused(['ready-to-build', 'yes', UNIT, '--position', 'auto']), 'ready-to-build yes: a verdict is still to ask — render ready-to-build asks each before the yes');
    const { argv } = pick('verdict', 'f');
    assert.deepStrictEqual([argv[2].startsWith(changed), argv.filter((_, at) => at !== 2)], [true, ['verdict', 'give', 'fix', '--at', 'ready-to-build']]);
    ok(dir, ['verdict', 'give', changed, 'fix', '--at', 'ready-to-build'], { env: SESSION });
    assert.match(screen(), /=== MENU: ready to build /);
  });
});

describe('the close the screen stands on (E12)', () => {
  eachOn(landed);

  it('refuses until ready to build\'s checklist is closed, writing nothing', () => {
    assert.strictEqual(refused(['render', 'ready-to-build', UNIT]), `render ready-to-build: ready-to-build is open — its items are worked, then it is closed: checklist close ready-to-build ${UNIT}`);
  });

  it('keeps on the close what the spec and the cut held, and is voided by a land after it, until the checklist is worked afresh and closed again', () => {
    const { closed: at } = closeReady(dir);
    const record = readManifest(dir, UNIT).checklists['ready-to-build'];
    assert.deepStrictEqual(Object.keys(record), ['items', 'closed', 'spec_hash', 'cut_hash']);
    assert.match(record.spec_hash, /^[0-9a-f]{12}$/);
    writeState(dir, layout.unit(UNIT, 'spec.md'), readState(dir, layout.unit(UNIT, 'spec.md')).replace('are taken.', 'are taken, and no other.'));
    ok(dir, ['spec', 'land', UNIT]);

    const voided = `ready-to-build was closed before ${UNIT}'s spec changed — a land after the close voids it, so its items are worked afresh and it is closed again`;
    assert.strictEqual(refused(['render', 'ready-to-build', UNIT]), `render ready-to-build: ${voided}`);
    assert.strictEqual(refused(['ready-to-build', 'yes', UNIT, '--position', 'auto']), `ready-to-build yes: ${voided}`);
    assert.match(refuses(dir, ['checklist', 'close', 'ready-to-build', UNIT]).error, /has items open: replacements-checked, review-settled, invariants-checked$/);
    assert.ok(closeReady(dir).closed > at);
    assert.match(screen(), /=== MENU: ready to build /);
  });

  it('is voided by a cut after it', () => {
    closeReady(dir);
    cut(dir, [{ ...CARDS, goal: 'Cards, sooner.' }, REFUNDS]);

    assert.strictEqual(refused(['ready-to-build', 'yes', UNIT, '--position', 'auto']), `ready-to-build yes: ready-to-build was closed before ${UNIT}'s spec was cut again — a cut after the close voids it, so its items are worked afresh and it is closed again`);
  });

  it('refuses while an item the engine checks fails since the close: a decided topic postponed for a split leaves the lines citing it invented, so the spec is written again (11.10.3, 11.S18)', () => {
    closeReady(dir);
    const postponed = ok(dir, ['topic', 'postpone', UNIT, 'refunds', '--horizon', 'next'], { env: SESSION });

    assert.strictEqual(postponed.status, 'postponed');
    assert.deepStrictEqual(ok(dir, ['spec', 'land', UNIT]).invented.map((/** @type {{number: string}} */ line) => line.number), ['2.1.1']);
    assert.strictEqual(refused(['render', 'ready-to-build', UNIT]), 'render ready-to-build: ready-to-build has items open since its close: statements-traced — they are worked, and it is closed again');
  });
});

describe('what never comes to ready to build (11.8.1)', () => {
  eachOn(closed);

  it('refuses a unit keeping the old spec\'s items, naming the migration\'s cut', () => {
    createManifest(dir, UNIT, { ...readManifest(dir, UNIT), phases: { ...readManifest(dir, UNIT).phases, specification: { items: { cards: { status: 'completed' } } } } });
    commitAll(dir, 'an old spec item');

    assert.strictEqual(refused(['render', 'ready-to-build', UNIT]), `render ready-to-build: ${UNIT} keeps its spec in the old form, which never comes to ready to build — the migration's cut for built units carries it across (29.17)`);
  });

  it('refuses a unit the spec\'s entry refuses: one the project lacks, and a quick-fix, whose pipeline holds no spec', () => {
    createManifest(dir, 'tidy', { work_type: 'quick-fix' });
    commitAll(dir, 'a quick-fix');

    assert.match(refused(['render', 'ready-to-build', 'nowhere']), /^render ready-to-build: there is no work unit "nowhere"/);
    assert.strictEqual(refused(['ready-to-build', 'yes', 'tidy', '--position', 'auto']), 'ready-to-build yes: a quick-fix has no specification — its phases are scoping, implementation, review');
  });
});

describe('the yes (11.8.1, 11.8.6, E11)', () => {
  eachOn(closed);

  it('begins the build in the position picked, its manifest holding it as `build`, committed alone, with no review written where no page is open, and hands to the epic\'s menu (11.S22, E7)', () => {
    const before = head(dir);
    const answer = yes(['--position', 'auto']);

    assert.deepStrictEqual(answer, { ok: true, unit: UNIT, position: 'auto', record: null, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(), next: { kind: 'handoff', skill: 'leeway-continue-epic', args: [UNIT] } });
    assert.deepStrictEqual(readManifest(dir, UNIT).build, { position: 'auto' });
    assert.deepStrictEqual([lastMessage(dir), touched(statePath(dir), 'HEAD'), stateGit(dir, ['rev-parse', 'HEAD~1']).trim()], [`ready-to-build(${UNIT}): auto`, [`M\t${layout.manifest(UNIT)}`], before]);
    assert.ok(!fs.existsSync(statePath(dir, layout.unit(UNIT, 'spec-review.json'))));
    assert.deepStrictEqual(events('position-switch'), [], 'the first pick is the gate\'s record, never a switch (E14)');
  });

  it('concludes the spec: ready to build passes once, the spec is never landed again, and a phase may start (11.8.1, 11.S13)', () => {
    yes(['--position', 'step']);

    assert.strictEqual(refused(['render', 'ready-to-build', UNIT]), `render ready-to-build: ready to build has passed for ${UNIT} — its build began in step, and its position switches through workunit position ${UNIT} auto|step`);
    assert.match(refused(['spec', 'land', UNIT]), /^spec land: payments's spec is concluded/);
    assert.strictEqual(ok(dir, ['checklist', 'show', 'phase-start', UNIT, '1']).checklist, 'phase-1-start');
  });

  it('closes the map for good: no decided topic is postponed once the build has begun (18.4.19)', () => {
    yes(['--position', 'auto']);

    assert.strictEqual(refused(['topic', 'postpone', UNIT, 'refunds', '--horizon', 'next']), `postponing "refunds" is refused — ${UNIT}'s build has begun, so its map is closed: a decision that must change is settled in the build, and abandoning the work is the unit's cancel, through manage on the start menu`);
  });

  it('takes no marks while no page is open, and refuses a position that is none of the build\'s and arguments of another shape, writing nothing', () => {
    assert.strictEqual(refused(['ready-to-build', 'yes', UNIT, '--position', 'auto', '--marks', statePath(dir, READ_BACK)]), `ready-to-build yes: ${UNIT}'s review page is not open, so the yes takes no marks — the build starts with no review recorded`);
    for (const args of [['--position', 'bounded'], [], ['--position', 'auto', '--force', 'yes']]) {
      assert.match(refused(['ready-to-build', 'yes', UNIT, ...args]), /^Usage: engine ready-to-build yes <work-unit> --position auto\|step \[--marks <file>\]/, args.join(' '));
    }
  });
});

describe('the yes over an open review page (11.11.5, 11.11.8, 11.11.9)', () => {
  eachOn(closed);

  it('refuses without the page\'s marks, writing nothing', () => {
    publish();

    assert.strictEqual(refused(['ready-to-build', 'yes', UNIT, '--position', 'auto']), `ready-to-build yes: ${UNIT}'s review page is open, so the yes takes its marks — read them back from the page and give them as a file`);
  });

  it('refuses while a comment waits for Claude, listing each, the marks it was handed stored and nothing committed (11.S25)', () => {
    publish();
    const before = head(dir);
    const marks = { s1: { m: commented('1-1-2', 'Why refuse it?') } };

    assert.strictEqual(refuses(dir, ['ready-to-build', 'yes', UNIT, '--position', 'auto', '--marks', readBack(marks)], { env: SESSION }).error,
      'ready-to-build yes: a comment on the review page waits for Claude, so the build does not start — Claude answers each beneath its line, then shows ready to build again:\n  1.1.2: "Why refuse it?"');
    assert.deepStrictEqual([head(dir), readManifest(dir, UNIT).build, JSON.parse(readState(dir, layout.cache(UNIT, 'specification', 'marks.json')))], [before, undefined, marks]);
  });

  it('settles the review on the fresh marks, committing its record with the build (11.S26)', () => {
    publish();
    const before = head(dir);
    const answer = yes(['--position', 'step', '--marks', readBack({ s1: { m: { '1-1-1': { s: 'tick' } } } })]);

    assert.strictEqual(answer.record, layout.unit(UNIT, 'spec-review.json'));
    assert.strictEqual(JSON.parse(readState(dir, answer.record)).lines['1.1.1'].state, 'approved');
    assert.deepStrictEqual([touched(statePath(dir), 'HEAD'), stateGit(dir, ['rev-parse', 'HEAD~1']).trim()], [[`M\t${layout.manifest(UNIT)}`, `A\t${layout.unit(UNIT, 'spec-review.json')}`].sort(), before]);
  });
});

describe('the build\'s position switched (3.3.6, 3.3.7)', () => {
  eachOn(closed);

  it('writes the new position and logs the switch in the trust log, committed alone (3.S14, E14)', () => {
    yes(['--position', 'auto']);
    const before = head(dir);
    const answer = ok(dir, ['workunit', 'position', UNIT, 'step'], { env: SESSION });

    assert.deepStrictEqual(answer, { ok: true, unit: UNIT, position: 'step', committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.deepStrictEqual([readManifest(dir, UNIT).build, lastMessage(dir), touched(statePath(dir), 'HEAD'), stateGit(dir, ['rev-parse', 'HEAD~1']).trim()], [{ position: 'step' }, `build(${UNIT}): position step`, [`M\t${layout.manifest(UNIT)}`], before]);
    assert.deepStrictEqual(events('position-switch').map(({ unit, to }) => ({ unit, to })), [{ unit: UNIT, to: 'step' }]);
  });

  it('refuses before the build begins, a switch to the position it is in, a unit the project lacks, and a position that is none of the build\'s, writing nothing', () => {
    assert.strictEqual(refused(['workunit', 'position', UNIT, 'step']), `workunit position: ${UNIT}'s build has not begun — its position is chosen at ready to build`);
    yes(['--position', 'auto']);
    assert.deepStrictEqual([
      refused(['workunit', 'position', UNIT, 'auto']),
      refused(['workunit', 'position', 'nowhere', 'step']),
    ], [
      `workunit position: ${UNIT}'s build is in auto already`,
      'workunit position: there is no work unit "nowhere" — the start menu lists the work in progress',
    ]);
    assert.match(refused(['workunit', 'position', UNIT, 'bounded']), /^Usage: engine workunit position <work-unit> auto\|step — the position is auto or step$/);
    assert.deepStrictEqual(events('position-switch'), []);
  });
});
