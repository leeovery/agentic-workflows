'use strict';

// ---------------------------------------------------------------------------
// The matrix and the person's settings (leeway-engine/scripts/domain/
// trust-verbs.cjs, its screens domain/projections/matrix.cjs, the replay
// domain/replay.cjs, the findings split in domain/measures.cjs): `render
// matrix`, per kind the overturned and the lost of the answered and the
// rate the ask rule runs on, what is carried from the person's other
// projects, the one-answer calls, the threshold mid-build and how review
// findings split, from the trust log and the ledger (16.15.1, 17.1.2,
// 17.1.3, 17.S1, 17.S8, P11); `render matrix-replay`, the trust log
// replayed against a proposed setting over its period (16.15.2, 16.15.3,
// P14); `trust threshold` and `trust build-threshold`, written to the
// settings file on the person's yes alone, merged beside what it holds
// (16.4.7, 16.S63, E10); and `trust correct`, the person's correction of a
// kind or a verdict in words, never a row of the matrix (16.15.4, 16.S67).
//
// Layer: verb. Worlds: trust-world.cjs's — each test's folder, its config
// folder holding the trust log, the record, the settings and the
// conversation — and in it, as `fumi`, a copy of a project world of this
// file's own, built once: its unit's manifest written, its ledger's lines
// appended in each test as it needs them, a review's findings or the
// entries the trust log's events name. The engine runs in process through
// the harness, on the frozen clock.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, output, refuses, screenOf, statePath, readState, layout, fixtureFrom, withFrozenClock, FROZEN_MS } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { idOf, DRAWN, NARROW, UNDRAWN, SESSION, DAY, MODEL, lines, useTrustWorld, history } = require('./trust-world.cjs');
const { labelled } = require('./labels.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { appendEntries } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { replay } = require(path.join(SCRIPTS, 'domain/replay.cjs'));
const { ruled } = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));
const { DEFAULTS } = require(path.join(SCRIPTS, 'domain/trust-settings.cjs'));
const { MODEL_LINES } = require(path.join(SCRIPTS, 'domain/trust-counts.cjs'));

const { folder, logPath } = useTrustWorld('engine-matrix-');

const ENV = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION });
const UNIT = 'fumi';
const OTHER = idOf('Aircon');
const AT_25 = Object.freeze({ ...DEFAULTS, threshold: 0.25 });
const AT_15 = Object.freeze({ ...DEFAULTS, threshold: 0.15 });
// Showings of the plan gate its blind ask never draws, and one it draws.
const SHOWINGS = Object.freeze(['0000000000000000', '0000000000000001', '0000000000000002', '0000000000000003', '0000000000000005', '0000000000000006', '0000000000000007',
  '0000000000000008', '0000000000000009', '000000000000000a', '000000000000000b', '000000000000000c', '000000000000000d']);
const DRAWN_SHOWING = '0000000000000012';
// What a replay finds at the learned gates where it replays no showing.
const NO_GATES = Object.freeze({ showings: 0, changed: 0, overruled: 0 });
// The CPU a replay of a busy year may take.
const REPLAY_BUDGET_S = 3;

/** An engine command a row leads to. @param {...string} argv */
const engine = (...argv) => ({ kind: 'engine', argv });
const CARRY_ON = Object.freeze({ kind: 'continue' });

/** The log holding `events`. @param {Record<string, unknown>[]} events */
function logHolding(events) {
  fs.mkdirSync(path.dirname(logPath()), { recursive: true });
  fs.writeFileSync(logPath(), lines(...events));
}

/** The log's events of type `type`. @param {string} type @returns {Record<string, any>[]} */
const logged = (type) => fs.readFileSync(logPath(), 'utf8').split('\n').slice(0, -1).map((line) => JSON.parse(line)).filter((event) => event.type === type);

/** The settings file in this test's config folder. */
const settingsFile = () => path.join(folder(), 'config', 'config.json');

/** The settings file's text, null where there is none. */
const settingsText = () => (fs.existsSync(settingsFile()) ? fs.readFileSync(settingsFile(), 'utf8') : null);

/** The settings file holding `text`, as the person or the knowledge base's setup left it. @param {string} text */
function settingsHolding(text) {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), text);
}

/** A surface drawn in the conversation on the frozen clock. @param {string} dir @param {string[]} args */
const render = (dir, args) => withFrozenClock(() => output(dir, ['render', ...args], { env: ENV }));

/** A command that must succeed in the conversation on the frozen clock: its response. @param {string} dir @param {string[]} args */
const run = (dir, args) => withFrozenClock(() => ok(dir, args, { env: ENV }));

/** A command refused in the conversation on the frozen clock: its error. @param {string} dir @param {string[]} args */
const refused = (dir, args) => withFrozenClock(() => refuses(dir, args, { env: ENV }).error);

/** The person's pick of the row `key` at the gate `gate` shown: the gate's response. @param {string} dir @param {string} gate @param {string} key */
const pick = (dir, gate, key) => run(dir, ['gate', gate, '--pick', key]);

/** A screen as read: its title, then each section's lines. @param {string} out @param {string[]} sections */
const screen = (out, sections) => sections.flatMap((name) => (name === 'TITLE' ? screenOf(out, name).map((line) => line.replace(/^# /, '')) : screenOf(out, name)));

/** The matrix's lines above its menu. @param {string} dir */
const matrix = (dir) => screen(render(dir, ['matrix']), ['DISPLAY: matrix']);

/** The row of `kind` in the matrix's table. @param {string[]} drawn @param {string} kind */
const rowOf = (drawn, kind) => drawn.find((line) => line.startsWith(`  ${kind} `));

/** The lines of the matrix from the one headed `heading`, `count` of them. @param {string[]} drawn @param {string} heading @param {number} count */
const block = (drawn, heading, count) => drawn.slice(drawn.findIndex((line) => line.startsWith(heading)), drawn.findIndex((line) => line.startsWith(heading)) + count);

/** A care entry on `kind` here, added on the care entries' screens. @param {string} dir @param {string} kind */
function addCare(dir, kind) {
  render(dir, ['care']);
  pick(dir, 'care entries', 'n');
  const kinds = screenOf(render(dir, ['care-kind']), 'MENU: care kind');
  pick(dir, 'care kind', /** @type {string} */ (kinds.find((line) => line.includes(`→ ${kind} — `))).split(' ')[0]);
  run(dir, ['person', 'keep', '--care', kind]);
}

// The project world: its unit's topics, the note window and the menu bar
// under discussion, and the tray cancelled.
const world = fixtureFrom('engine-matrix-', (dir) => {
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: { discussion: { items: { 'note-window': { status: 'in-progress' }, 'menu-bar': { status: 'in-progress' }, tray: { status: 'cancelled' } } } },
  });
});

/** This test's project, `fumi`, and the id the trust log keys it by. */
function fumi() {
  const dir = world(path.join(folder(), 'fumi'));
  return { dir, id: /** @type {string} */ (JSON.parse(readState(dir, layout.projectManifest)).project_id) };
}

/** The tags of a line written on `topic`. @param {string} [topic] */
const on = (topic = 'note-window') => ({ unit: UNIT, topic, phase: 'discussion', session: SESSION });

/** A question asked by `by`, as its line holds it. @param {string} text @param {string} [by] @param {string} [topic] */
const asked = (text, by = 'review', topic = undefined) => ({ event: 'asked', ...on(topic), by, who_moved_whom: 'none', text, part_of: null, relies_on: [], cites: [], task: null });

/** An answer to `question`, as its line holds it: decided by `by`, given `given`. @param {string} question @param {string} by @param {string} [given] */
const answered = (question, by, given = 'own') => ({
  event: 'decided', ...on(), by, who_moved_whom: 'none', answers: question, text: 'So it is.', why: 'It reads well.', rules_out: [], relies_on: [], product_wide: false,
  sealed: null, alternatives: [], evidence: [], kind: null, hard_to_undo: null, unchecked: false, given, cites: [], task: null,
});

/** `question` moved to `to`, as its line holds it. @param {string} question @param {string} to */
const moved = (question, to) => ({ event: 'moved', ...on(), by: 'claude', who_moved_whom: 'none', question, to });

/**
 * The ledger of `dir` holding the lines `build` writes in one append, each
 * given the id it names or one drawn: what `build` answered.
 * @template T
 * @param {string} dir @param {(add: (fields: Record<string, unknown>, id?: string) => string) => T} build
 * @returns {T}
 */
function ledgerHolding(dir, build) {
  /** @type {{fields: Record<string, unknown>, id: string}[]} */
  const entries = [];
  const made = build((fields, id = newId()) => {
    entries.push({ fields, id });
    return id;
  });
  appendEntries(statePath(dir), entries, []);
  return made;
}

/**
 * The review findings on the ledger of `dir`, settled in each lane as many
 * times as `lanes` says: apply, merged into a finding the record holds;
 * decide, Claude's call; walked, the person's answer; route, moved to the
 * menu bar.
 * @param {string} dir @param {{apply: number, decide: number, walked: number, route: number}} lanes
 */
function findings(dir, lanes) {
  ledgerHolding(dir, (add) => {
    const found = add({
      event: 'found', ...on(), by: 'claude', who_moved_whom: 'none', text: 'Notes float.', how: 'Read the code.', relies_on: [], product_wide: false, known: null, command: null, result: null, cites: [], task: null,
    });
    /** @type {[number, (question: string) => Record<string, unknown>][]} */
    const settle = [
      [lanes.apply, (question) => ({ event: 'merged', ...on(), by: 'claude', who_moved_whom: 'none', question, into: found, duplicate: null })],
      [lanes.decide, (question) => answered(question, 'claude')],
      [lanes.walked, (question) => answered(question, 'person')],
      [lanes.route, (question) => moved(question, 'menu-bar')],
    ];
    let n = 0;
    for (const [count, settled] of settle) {
      for (let i = 0; i < count; i += 1) add(settled(add(asked(`Finding ${(n += 1)}?`))));
    }
  });
}

/**
 * The entries `entries` on the ledger of `dir`, each Claude's call on a
 * question of its own, so a correction can name them.
 * @param {string} dir @param {string[]} entries
 */
function callsHolding(dir, entries) {
  ledgerHolding(dir, (add) => entries.forEach((entry, i) => add(answered(add(asked(`Question ${i}?`, 'claude')), 'claude'), entry)));
}

/**
 * 16.15.1's matrix as the trust log holds it: each kind's answers, the
 * walk to where it stands, and Claude's one-answer calls, no kind's.
 * @param {string} project
 */
function drawnHistory(project) {
  const h = history({ project });
  h.agree(3, 'contract');
  h.depart('fix', 'contract');
  h.agree(9, 'scope');
  for (let i = 0; i < 2; i += 1) h.depart('fix', 'scope');
  h.agree(13, 'behaviour');
  for (let i = 0; i < 3; i += 1) h.depart('fix', 'behaviour');
  h.depart(null, 'behaviour');
  h.agree(3, 'behaviour');
  h.agree(6, 'look');
  for (const verdict of ['nothing', 'nothing', 'loss']) h.depart(verdict, 'look');
  h.agree(12, 'process');
  for (let i = 0; i < 2; i += 1) h.depart('fix', 'process');
  h.agree(15, 'words');
  for (let i = 0; i < 3; i += 1) h.depart('fix', 'words');
  h.agree(29, 'internals');
  h.depart('nothing', 'internals');
  for (let i = 0; i < 63; i += 1) h.call('one', null);
  h.reverse(h.call('one', null));
  return h.events;
}

/**
 * The history 16.15.3's replay draws, in `project`, every question in the
 * last day: twelve behaviour questions taking Claude's lean, then one the
 * person changed, not yet judged, then three more taking it; and four on
 * contract. At 20% behaviour asks until its thirteenth question and again
 * after the change; at 25% it goes quiet after its eleventh and stays so.
 * @param {string} project
 */
function replayedHistory(project) {
  const h = history({ project });
  h.agree(12, 'behaviour');
  h.depart(null, 'behaviour');
  h.agree(3, 'behaviour');
  h.agree(4, 'contract');
  return h;
}

/** The decision point's ruling on a behaviour question in the project at `dir`, blocking build work where `blocks`, its id one the blind draw never takes. @param {string} dir @param {boolean} blocks */
function behaviourRuled(dir, blocks) {
  return withFrozenClock(() => ruled(/** @type {any} */ ({ sort: 'several' }), {
    label: labelled('behaviour'), place: { unit: UNIT, phase: 'implementation', topic: null }, blocks_build: blocks, replaced_by: null, always: null, measured: null, checked: false,
    project: { root: statePath(dir), name: 'Fumi' }, model: MODEL, now: FROZEN_MS, chain: UNDRAWN,
  }));
}

/** The decision point's decision on a behaviour question in the project at `dir`, blocking build work where `blocks`. @param {string} dir @param {boolean} blocks */
const behaviourAt = (dir, blocks) => behaviourRuled(dir, blocks).decision;

/** The record of the person holding the care entries `entries` alone, each `[kind, project id, when added]`, the project Fumi. @param {...[string, string, number]} entries */
function careHeld(...entries) {
  fs.mkdirSync(path.join(folder(), 'config'), { recursive: true });
  fs.writeFileSync(path.join(folder(), 'config', 'person.md'), `<!-- leeway: the record of you, version 1 -->\n\n# The record of you\n\n## Care entries\n\n${entries.map(([kind, id, added]) => `- Fumi: ${kind} · ${id} · ${new Date(added).toISOString()}`).join('\n')}\n`);
}

/**
 * `fn` run in the time zone `zone`, the person's own day read there: its
 * answer.
 * @template T @param {string} zone @param {() => T} fn
 * @returns {T}
 */
function inZone(zone, fn) {
  const held = process.env.TZ;
  process.env.TZ = zone;
  try {
    return fn();
  } finally {
    if (held === undefined) delete process.env.TZ;
    else process.env.TZ = held;
  }
}

/** The replay's found line, in the time zone UTC. @param {string} dir @param {string[]} args */
const found = (dir, args) => inZone('UTC', () => screenOf(render(dir, ['matrix-replay', ...args]), 'DISPLAY: matrix replay').slice(1).join(' ').replace(/ {2,}/g, ' ').trim());

describe('the matrix (16.15.1, 17.1.2, 17.1.3)', () => {
  it('17.S1: the matrix as 16.15.1 draws it — each kind\'s overturned and lost of its answered and the rate the rule runs on, from the trust log; Claude\'s one-answer calls; the threshold mid-build; and how review findings split, from the ledger; its rows the threshold\'s and the build\'s replays, care, help and back to manage', () => {
    const { dir, id } = fumi();
    logHolding(drawnHistory(id));
    addCare(dir, 'look');
    findings(dir, { apply: 97, decide: 81, walked: 21, route: 13 });

    const out = render(dir, ['matrix']);

    assert.deepStrictEqual(screen(out, ['TITLE', 'DISPLAY: matrix', 'MENU: matrix']), [
      '■ Matrix · Fumi',
      'Your threshold is 20%. A kind asks you until its rate falls under',
      'it, then goes quiet, and asks again only once its rate rises over',
      '25%. Where a change would be hard to undo, half: quiet under 10%,',
      'asking again over 12.5%. Danger, a kind under your care entry,',
      'and replacing an answer you gave always ask.',
      '',
      'Rate is the pessimistic bound: the high end of a 95% range on how',
      'often my answer would have cost the product, so a kind with few',
      'answers reads high.',
      '',
      'Overturned counts the answers where you changed or overruled my',
      'lean; lost, those that cost or would have cost the product, one',
      'you haven\'t judged yet counting as lost.',
      '',
      'Nothing is carried from your other projects yet: every count here',
      'is Fumi\'s own.',
      '',
      'OVERTURNED, AND WHAT IT COST, BY KIND',
      '  kind      overturned  lost  rate',
      '  danger             —     —     —  always asks',
      '  contract      1 of 4     0   45%  asks',
      '  scope        2 of 11     0   22%  asks',
      '  behaviour    4 of 20     1   21%  quiet · asks over 25%',
      '  look          3 of 9     1   39%  asks · your care entry',
      '  process      2 of 14     0   18%  quiet · hard to undo asks',
      '  words        3 of 18     0   15%  quiet · hard to undo asks',
      '  internals    1 of 30     0    9%  quiet',
      '',
      'CLAUDE\'S ONE-ANSWER CALLS',
      '  64 calls · 1 overruled · rate 7%. They go ahead as mine, and',
      '  ask you once overrules lift the rate over your 20%.',
      '',
      'MID-BUILD, WHERE A QUESTION BLOCKS WORK',
      '  20%, the same as elsewhere, until a build\'s own answers show',
      '  how much to raise it.',
      '',
      'HOW REVIEW FINDINGS SPLIT (212 across Fumi\'s reviews)',
      '  apply    97  46%  the record or a fact settles it',
      '  decide   81  38%  Claude\'s call',
      '  walked   21  10%  asked you',
      '  route    13   6%  belongs to another topic',
      '· · · · · · · · · · · ·',
      '◆ What would you like to do?',
      '',
      't/threshold → Change your threshold — a replay first shows what',
      '              it would have changed',
      'u/build     → Raise the threshold mid-build — a replay first',
      '              shows what it would have changed',
      'c/care      → Add or drop a care entry — a kind that always asks',
      '              you in Fumi',
      'h/help      → What this screen is for, row by row',
      'b/back      → Back to manage',
    ]);
    const nexts = ['t', 'u', 'c', 'b'].map((key) => {
      render(dir, ['matrix']);
      return pick(dir, 'matrix', key).next;
    });
    assert.deepStrictEqual(nexts, [CARRY_ON, CARRY_ON, engine('render', 'care'), engine('render', 'manage')]);
  });

  it('17.S8: a kind whose departures hold one judged a real loss, one a fix later and one not yet judged — lost counts the judged loss and the unjudged one, at the rate the rule runs on; overturned counts all three', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.agree(10, 'behaviour');
    h.depart('loss', 'behaviour');
    h.depart('fix', 'behaviour');
    h.depart(null, 'behaviour');
    logHolding(h.events);

    const reason = withFrozenClock(() => ruled(/** @type {any} */ ({ sort: 'several' }), {
      label: labelled('behaviour'), place: { unit: UNIT, phase: 'discussion', topic: 'note-window' }, blocks_build: false, replaced_by: null, always: null, measured: null, checked: false,
      project: { root: statePath(dir), name: 'Fumi' }, model: null, now: FROZEN_MS,
    }).reason);

    assert.strictEqual(rowOf(matrix(dir), 'behaviour'), '  behaviour    3 of 13     2   39%  asks');
    assert.match(reason, / 39%, over your 20%\.$/);
  });

  it('the carried line says how much the person\'s other projects carry in, at most 10 answers\' weight a count, Claude\'s one-answer calls\' among them, danger\'s apart — a kind with none of its own here starting from them, as 16.14.4 works it', () => {
    const { dir, id } = fumi();
    const h = history({ project: OTHER });
    h.agree(13, 'look');
    h.agree(3, 'scope');
    h.agree(2, 'danger');
    h.agree(1, 'look', { project: id });
    h.call('one', null);
    h.call('one', null);
    logHolding(h.events);

    const drawn = matrix(dir);

    assert.deepStrictEqual(block(drawn, 'Carried', 3), [
      'Carried from your other projects: 15 answers\' weight, at most 10',
      'for each kind and for my one-answer calls. Each rate here starts',
      'from them and moves with Fumi\'s own answers; the counts below are',
    ]);
    assert.deepStrictEqual([rowOf(drawn, 'look'), rowOf(drawn, 'scope')], ['  look          0 of 1     0   22%  asks', '  scope         0 of 0     0   53%  asks']);
  });

  it('N7: an answer carried in is counted once, under its kind, though the one-answer calls\' count reads it too', () => {
    const { dir } = fumi();
    const h = history({ project: OTHER });
    for (let i = 0; i < 5; i += 1) h.raise('words', '1', { sort: 'one' });
    logHolding(h.events);

    assert.match(block(matrix(dir), 'Carried', 1)[0], /^Carried from your other projects: 5 answers' weight,/);
  });

  it('N4: the one-answer calls\' line says where they stand — asking until the rate falls under the threshold; quiet since it did, asking again over a quarter above it; quiet with overrules weighing under one whole — their rate told from every line the threshold draws', () => {
    const { dir, id } = fumi();
    /** Claude's one-answer calls, `n` of them, then one the person reversed, in `h`. @param {ReturnType<typeof history>} h @param {number} n */
    const overruledAfter = (h, n) => {
      for (let i = 0; i < n; i += 1) h.call('one', null);
      h.reverse(h.call('one', null));
    };
    const asking = history({ project: id });
    overruledAfter(asking, 10);
    const band = history({ project: id });
    overruledAfter(band, 10);
    overruledAfter(band, 10);
    const inherited = history({ project: id, model: MODEL_LINES[0][2] });
    overruledAfter(inherited, 5);

    const said = [asking, band, inherited].map((h) => {
      logHolding(h.events);
      const drawn = matrix(dir);
      const heading = drawn.indexOf('CLAUDE\'S ONE-ANSWER CALLS');
      return drawn.slice(heading + 1, drawn.indexOf('', heading)).map((line) => line.trim()).join(' ');
    });

    assert.deepStrictEqual(said, [
      '11 calls · 1 overruled · rate 34%. Overrules have lifted the rate over your 20%, so they ask you until it falls under it.',
      '22 calls · 2 overruled · rate 24.9%. They went quiet once the rate fell under your 20%, and go ahead as mine until it rises over 25%.',
      '6 calls · 1 overruled · rate 65%. They go ahead as mine, and ask you once overrules lift the rate over your 20%. They ask only once overrules weigh one whole overrule; these weigh 0.5.',
    ]);
  });

  it('a kind\'s rate a hair over a line is told from it: over the line where a quiet kind asks again, and over the one where a change hard to undo asks', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.agree(15, 'scope');
    h.depart('loss', 'scope');
    h.agree(34, 'words');
    h.depart('loss', 'words');
    logHolding(h.events);

    const drawn = matrix(dir);

    assert.deepStrictEqual([rowOf(drawn, 'scope'), rowOf(drawn, 'words')], [
      '  scope        1 of 16     1  25.01%  asks',
      '  words        1 of 35     1  12.51%  quiet · hard to undo asks',
    ]);
  });

  it('P11: each review finding falls in the lane of what settled it — merged into what the record holds, apply; moved to another topic or to the roadmap, route, however it is answered after; the person\'s answer, their "your call" and "don\'t care" among it, theirs the migration carried over, and a call of Claude\'s they kept since, walked; Claude\'s own call, decide, the person\'s replacement of it since counted elsewhere — and one still open, Claude\'s own question and one on a topic since cancelled, put on the roadmap before it was, in none', () => {
    const { dir } = fumi();
    ledgerHolding(dir, (add) => {
      const found = add({
        event: 'found', ...on(), by: 'person', who_moved_whom: 'none', text: 'Notes float.', how: 'Said so.', relies_on: [], product_wide: false, known: null, command: null, result: null, cites: [], task: null,
      });
      add({ event: 'merged', ...on(), by: 'claude', who_moved_whom: 'none', question: add(asked('Do notes float?')), into: found, duplicate: null });
      const routed = add(asked('Does the menu bar show notes?'));
      add(moved(routed, 'menu-bar'));
      add(answered(routed, 'person'));
      add(moved(add(asked('Do notes sync?')), 'roadmap:sync'));
      add(answered(add(asked('Is a note a window?')), 'person'));
      add(answered(add(asked('Does a note snap?')), 'claude', 'your-call'));
      add(answered(add(asked('How round is a corner?')), 'claude', 'dont-care'));
      add(answered(add(asked('Does a note have a shadow?')), 'claude'));
      const faded = add(answered(add(asked('Does a note fade?')), 'claude'));
      add({ event: 'kept', ...on(), by: 'person', who_moved_whom: 'none', entry: faded, reason: 'changed-mind', cause: null, why: 'It reads well.', sealed: 'So it is.', given: 'own' });
      const bordered = add(asked('Does a note have a border?'));
      add({ ...answered(bordered, 'person'), event: 'replaced', replaces: add(answered(bordered, 'claude')), reason: 'was-wrong', cause: null, drops: [], of: 'decision' });
      add(answered(add(asked('Does a note keep its place?')), 'person', 'carried'));
      add(asked('Does a note have a title?'));
      add(answered(add(asked('Does a note float above?', 'claude')), 'claude'));
      add({ ...moved(add(asked('Does the tray hold notes?', 'review', 'tray')), 'roadmap:tray'), ...on('tray') });
    });

    assert.deepStrictEqual(block(matrix(dir), 'HOW REVIEW FINDINGS SPLIT', 5), [
      'HOW REVIEW FINDINGS SPLIT (10 across Fumi\'s reviews)',
      '  apply    1  10%  the record or a fact settles it',
      '  decide   2  20%  Claude\'s call',
      '  walked   5  50%  asked you',
      '  route    2  20%  belongs to another topic',
    ]);
  });

  it('with nothing answered and the settings the person picked, the matrix says so: every kind asks, a care entry in another project none of this one\'s, the one-answer calls go ahead, no finding is settled, and mid-build names the person\'s pick', () => {
    const { dir } = fumi();
    settingsHolding(JSON.stringify({ trust: { threshold: 0.25, build_threshold: 0.3 } }));
    careHeld(['scope', OTHER, FROZEN_MS - DAY]);

    const drawn = matrix(dir);

    assert.deepStrictEqual([drawn[0], rowOf(drawn, 'scope'), rowOf(drawn, 'internals'), ...block(drawn, 'CLAUDE\'S', 3), ...block(drawn, 'MID-BUILD', 2), ...block(drawn, 'HOW REVIEW', 2)], [
      'Your threshold is 25%. A kind asks you until its rate falls under',
      '  scope         0 of 0     0   95%  asks',
      '  internals     0 of 0     0   95%  asks',
      'CLAUDE\'S ONE-ANSWER CALLS',
      '  0 calls · 0 overruled · rate 95%. They go ahead as mine, and',
      '  ask you once overrules lift the rate over your 25%.',
      'MID-BUILD, WHERE A QUESTION BLOCKS WORK',
      '  30%, your pick, where elsewhere it is 25%.',
      'HOW REVIEW FINDINGS SPLIT (0 across Fumi\'s reviews)',
      '  None settled yet.',
    ]);
  });
});

describe('the replay (16.15.2, 16.15.3, P14)', () => {
  it('16.15.3: 25% in place of the 20% — last month\'s questions decided again by the rule at 25%, each over the counts as they stood before it: 6 skipped, 1 of them overruled; the lines it moves; y/yes sets it, n/no keeps 20%, Comment tries another number', () => {
    const { dir, id } = fumi();
    logHolding(replayedHistory(id).events);

    const out = render(dir, ['matrix-replay', '--threshold', '25']);

    assert.deepStrictEqual(screen(out, ['TITLE', 'DISPLAY: matrix replay', 'MENU: matrix replay']), [
      '■ Matrix · Fumi · Replay',
      '25% IN PLACE OF YOUR 20%',
      '  Last month 25% would have skipped 6 questions; you\'d have',
      '  overruled 1 of them.',
      '· · · · · · · · · · · ·',
      'At 25%, the line where a change would be hard to undo moves to',
      '12.5%, and a quiet kind asks again over 31.25%.',
      '',
      '◆ Use 25% as your threshold?',
      '',
      'y/yes   → Use 25% from now on',
      'n/no    → Keep 20%',
      'Comment → Try another number',
    ]);
    assert.deepStrictEqual(pick(dir, 'matrix replay', 'y').next, engine('trust', 'threshold', '25'));
    render(dir, ['matrix-replay', '--threshold', '25']);
    assert.deepStrictEqual(pick(dir, 'matrix replay', 'n').next, engine('render', 'matrix'));
    render(dir, ['matrix-replay', '--threshold', '25']);
    assert.deepStrictEqual(run(dir, ['gate', 'matrix replay', '--typed', 'comment']).next, CARRY_ON);
  });

  it('P14: the period is the last 30 days while they hold 20 questions or more, else the whole log, the line naming it; a question counts once its answer landed; overruled counts a reversal since as it counts a departure', () => {
    const project = { id: OTHER, name: 'Aircon' };
    const at = { project, settings: DEFAULTS, proposed: AT_25, care: [], now: FROZEN_MS, blocking: false };
    const old = history({ project: OTHER, start: FROZEN_MS - 40 * DAY });
    old.agree(10, 'behaviour');
    const reversed = old.agree(1, 'behaviour')[0];
    old.unfollowed('several');
    const recent = history({ project: OTHER });
    recent.agree(19, null);
    recent.reverse(reversed);
    const whole = replay([...old.events, ...recent.events], at);

    recent.agree(1, null);
    const month = replay([...old.events, ...recent.events], at);

    assert.deepStrictEqual(whole, { since: Date.parse(/** @type {string} */ (old.events[0].at)), whole: true, more: false, questions: 30, changed: 1, overruled: 1, gates: NO_GATES });
    assert.deepStrictEqual(month, { since: FROZEN_MS - 30 * DAY, whole: false, more: false, questions: 20, changed: 0, overruled: 0, gates: NO_GATES });
  });

  it('16.4.7: a raise mid-build replays the questions that blocked build work alone, against the threshold used elsewhere where none is picked; and the whole log names its first day', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.blocking(11);
    h.agree(12, 'look');
    logHolding(h.events);

    assert.deepStrictEqual(inZone('UTC', () => screen(render(dir, ['matrix-replay', '--build', '25']), ['DISPLAY: matrix replay', 'MENU: matrix replay'])).slice(0, 8), [
      '25% MID-BUILD IN PLACE OF THE 20%',
      '  Since 31 Dec 2025, 25% mid-build would have skipped 1 question',
      '  that blocked build work; you\'d have overruled none of them.',
      '· · · · · · · · · · · ·',
      'At 25% mid-build, the line where a change would be hard to undo',
      'moves to 12.5%, and a quiet kind asks again over 31.25%.',
      '',
      '◆ Use 25% as your threshold mid-build?',
    ]);
  });

  it('refuses a setting as it stands, a raise mid-build not above the threshold, a number that is no percent between 0 and 100, and both settings or neither', () => {
    const { dir } = fumi();
    settingsHolding(JSON.stringify({ trust: { build_threshold: 0.3 } }));
    /** @type {[string[], string][]} */
    const refusals = [
      [['--threshold', '20'], 'render matrix-replay: 20% is your threshold already'],
      [['--build', '30%'], 'render matrix-replay: 30% is your threshold mid-build already'],
      [['--build', '15'], 'render matrix-replay: mid-build the threshold rises over your 20%, never to 15% — a lower one is your threshold\'s own pick'],
      [['--build', '20'], 'render matrix-replay: mid-build the threshold rises over your 20%, never to 20% — a lower one is your threshold\'s own pick'],
      [['--threshold', '100'], 'render matrix-replay: "100" is no threshold — a percent above 0 and below 100, as 25 or 12.5'],
      [['--threshold', '0'], 'render matrix-replay: "0" is no threshold — a percent above 0 and below 100, as 25 or 12.5'],
      [['--threshold', 'a lot'], 'render matrix-replay: "a lot" is no threshold — a percent above 0 and below 100, as 25 or 12.5'],
      [['--threshold', '25', '--build', '30'], 'render matrix-replay: --threshold <percent> or --build <percent>, one and not both'],
      [[], 'render matrix-replay: --threshold <percent> or --build <percent>, one and not both'],
    ];
    for (const [args, error] of refusals) assert.strictEqual(refused(dir, ['render', 'matrix-replay', ...args]), error, args.join(' '));
  });
});

describe('the replay decides each question as the rule did (16.15.2, 16.15.3)', () => {
  const at = Object.freeze({ project: { id: OTHER, name: 'Aircon' }, settings: DEFAULTS, proposed: AT_25, care: [], now: FROZEN_MS, blocking: false });

  it('16.S63: questions parked mid-build together and answered in turn are each decided at their raise, over the counts before any of them was answered — none skipped', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.blocking(9);
    h.parked(4);
    logHolding(h.events);

    assert.strictEqual(found(dir, ['--build', '25']), 'Since 31 Dec 2025, 25% mid-build would have skipped none of the 13 questions that blocked build work you answered.');
  });

  it('a question raised, others answered while it waits, then it answered: it is decided over what came before its raise alone', () => {
    const h = history({ project: OTHER });
    h.agree(9, 'behaviour');
    const raised = h.now() + 500;
    h.agree(3, 'behaviour');
    h.raise('behaviour', '1', { raised });

    assert.deepStrictEqual(replay(h.events, at), { since: Date.parse(/** @type {string} */ (h.events[0].at)), whole: true, more: false, questions: 13, changed: 2, overruled: 0, gates: NO_GATES });
  });

  it('N3: skipped counts the questions the setting proposed lets go ahead where the person\'s own asks, never those both let go ahead', () => {
    const h = history({ project: OTHER });
    h.agree(20, 'behaviour');

    assert.deepStrictEqual([replay(h.events, at).changed, replay(h.events, { ...at, settings: { ...DEFAULTS, threshold: 0.22 } }).changed], [3, 2]);
  });

  it('each question is decided from what its event holds — its model, its sort, a decision of the person\'s it would replace, Claude\'s mark, the experiment still running that measured it — in its own project alone; a reversal after the clock is none yet; and the period holds a question decided as it opens', () => {
    /**
     * Twelve behaviour answers taking Claude's lean in Aircon, then `then`:
     * the replay at 25% as of the clock `nowOf` reads — its questions, those
     * it changed and those overruled.
     * @param {(h: ReturnType<typeof history>) => void} then @param {(h: ReturnType<typeof history>) => number} [nowOf]
     */
    const changedAfter = (then, nowOf = () => FROZEN_MS) => {
      const h = history({ project: OTHER });
      h.agree(12, 'behaviour');
      then(h);
      const { changed, overruled, questions } = replay(h.events, { ...at, now: nowOf(h) });
      return [questions, changed, overruled];
    };
    const month = history({ project: OTHER, start: FROZEN_MS - 30 * DAY - 1000 });
    month.agree(20, null);

    assert.deepStrictEqual([
      changedAfter((h) => h.raise('behaviour', '1')),
      changedAfter((h) => h.raise('behaviour', '1', {}, { model: MODEL_LINES[0][1] })),
      changedAfter((h) => h.raise('behaviour', '1', { sort: 'one' })),
      changedAfter((h) => h.raise('behaviour', '1', { replacedBy: 'person' })),
      changedAfter((h) => h.raise('behaviour', '1', { always: 'live-server' })),
      changedAfter((h) => h.raise('behaviour', '1', { measured: 'E1' })),
      changedAfter((h) => h.raise('behaviour', '1', {}, { project: idOf('Pay') })),
      changedAfter((h) => h.reverse(h.raise('behaviour', '1')), (h) => h.now() - 500),
      replay(month.events, at).whole,
    ], [[13, 3, 0], [13, 2, 0], [13, 2, 0], [13, 2, 0], [13, 2, 0], [13, 2, 0], [12, 2, 0], [13, 3, 0], false]);
  });

  it('a care entry dropped since stands for the questions decided while it stood — 16 behaviour answers under it, then dropped: none skipped, where read as never standing 3 were — the drop paired with its entry by its project, its kind and when it was added, one dropped part way through standing for those before it alone, and one added again since standing from then (16.5.2)', () => {
    /** 16 behaviour answers in Aircon under a care entry added before them, then `drop`: those 25% skips. @param {(h: ReturnType<typeof history>, added: number) => void} drop */
    const skipped = (drop) => {
      const h = history({ project: OTHER });
      const added = h.now();
      h.agree(16, 'behaviour');
      drop(h, added);
      return replay(h.events, at).changed;
    };
    const partWay = history({ project: OTHER });
    const added = partWay.now();
    partWay.agree(12, 'behaviour');
    partWay.careDrop('behaviour', added);
    const readded = partWay.now() + 500;
    partWay.agree(4, 'behaviour');

    assert.deepStrictEqual([
      skipped(() => {}),
      skipped((h, at16) => h.careDrop('behaviour', at16)),
      skipped((h, at16) => h.careDrop('behaviour', at16, { project: idOf('Pay') })),
      skipped((h, at16) => h.careDrop('look', at16)),
      skipped((h) => h.careDrop('behaviour', h.now())),
      replay(partWay.events, at).changed,
      replay(partWay.events, { ...at, care: [{ project: OTHER, kind: 'behaviour', added: new Date(readded).toISOString() }] }).changed,
    ], [3, 0, 3, 3, 3, 1, 0]);
  });

  it('a question the rule lets go ahead is drawn again by the blind draw on its question\'s id, at the share as it stood: drawn, it is asked, never skipped — one drawn at the wide share alone drawn while its kind held fewer than 20 of the project\'s own answers, however many it holds since (16.17.4, 16.17.9)', () => {
    /** Twelve behaviour answers in Aircon, then a question on `chain`, then `more` answers: the questions and those 25% skips. @param {string} chain @param {number} [more] */
    const skippedOn = (chain, more = 0) => {
      const h = history({ project: OTHER });
      h.agree(12, 'behaviour');
      h.raise('behaviour', '1', { chain });
      h.agree(more, 'behaviour');
      const { questions, changed } = replay(h.events, at);
      return [questions, changed];
    };
    const wide = history({ project: OTHER });
    wide.agree(20, 'behaviour');
    wide.raise('behaviour', '1', { chain: NARROW });

    assert.deepStrictEqual([skippedOn(UNDRAWN), skippedOn(DRAWN), skippedOn(NARROW), skippedOn(NARROW, 10), replay(wide.events, { ...at, settings: { ...DEFAULTS, threshold: 0.1 } }).changed], [[13, 3], [13, 2], [13, 2], [23, 2], 11]);
  });

  it('a question is drawn again at the share its count gave as it was raised: an answer of the project\'s own a reversal cancelled by then gone from it, one cancelled since still in it; a one-answer question at the one-answer calls\' share, never its kind\'s — drawn at the wide share alone, asked where an undrawn one is skipped (16.17.9)', () => {
    /** Those `proposed` skips over the person's `own` in Aircon, the history `build` makes with a last question on `chain`. @param {(h: ReturnType<typeof history>, chain: string) => void} build @param {string} chain @param {number} own @param {number} proposed */
    const skipped = (build, chain, own, proposed) => {
      const h = history({ project: OTHER });
      build(h, chain);
      return replay(h.events, { ...at, settings: { ...DEFAULTS, threshold: own }, proposed: { ...DEFAULTS, threshold: proposed } }).changed;
    };
    /** @type {(h: ReturnType<typeof history>, chain: string) => void} */
    const cancelledBefore = (h, chain) => {
      h.reverse(h.agree(19, 'behaviour')[0]);
      h.raise('behaviour', '1', { chain });
    };
    /** @type {(h: ReturnType<typeof history>, chain: string) => void} */
    const cancelledSince = (h, chain) => {
      const [first] = h.agree(20, 'behaviour');
      h.raise('behaviour', '1', { chain });
      h.reverse(first);
    };
    /** @type {(h: ReturnType<typeof history>, chain: string) => void} */
    const oneAnswer = (h, chain) => {
      for (let i = 0; i < 20; i += 1) h.call('one', 'behaviour');
      h.raise('look', '2', { sort: 'one' });
      h.raise('behaviour', '1', { sort: 'one', chain });
    };

    assert.deepStrictEqual([UNDRAWN, NARROW].map((chain) => [skipped(cancelledBefore, chain, 0.15, 0.25), skipped(cancelledSince, chain, 0.1, 0.25), skipped(oneAnswer, chain, 0.15, 0.2)]), [[9, 11, 1], [8, 11, 1]]);
  });

  it('below the person\'s threshold, a call that went ahead mid-build while the blind question drawn on it waited is overruled where the person answered that question otherwise than the call, never where they kept it or did not care; and a call of Claude\'s it proposed to replace itself, the person keeping it, is no overrule (16.17.6)', () => {
    const h = history({ project: OTHER });
    h.agree(13, 'behaviour');
    const [kept, overturned, shrugged, proposed] = [newId(), newId(), newId(), newId()];
    for (const entry of [kept, overturned, shrugged]) {
      h.call('several', 'behaviour', {}, { blocksBuild: true, entry });
      h.blindDraw(entry);
    }
    h.call('several', 'behaviour', {}, { entry: proposed });
    h.raise('behaviour', '1', { entry: kept, replaces: kept, blind: true, blocksBuild: true, chain: DRAWN });
    h.raise('behaviour', '2', { replaces: overturned, blind: true, blocksBuild: true, chain: DRAWN });
    h.raise('behaviour', '1', { replaces: shrugged, blind: true, blocksBuild: true, chain: DRAWN, dontCare: true });
    h.raise('behaviour', '2', { replaces: proposed, replacedBy: 'claude' });

    const { questions, changed, overruled } = replay(h.events, { ...at, proposed: AT_15 });

    assert.deepStrictEqual({ questions, changed, overruled }, { questions: 4, changed: 4, overruled: 1 });
  });

  it('a care entry stands for the questions decided after it was added alone, as the record holds it', () => {
    const { dir, id } = fumi();
    const h = replayedHistory(id);
    logHolding(h.events);
    careHeld(['behaviour', id, Date.parse(/** @type {string} */ (h.events[12].at)) + 500]);

    assert.strictEqual(found(dir, ['--threshold', '25']), 'Last month 25% would have skipped 3 questions; you\'d have overruled 1 of them.');
  });

  it('16.15.3 below the person\'s threshold: Claude\'s calls that went ahead, each decided again as it landed — those the lower setting would have asked, and those the person overruled since; a call no raise decided is none of them', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.agree(13, 'behaviour');
    const calls = Array.from({ length: 4 }, () => h.call('several', 'behaviour'));
    h.call(null, 'behaviour');
    h.reverse(calls[1]);
    logHolding(h.events);

    assert.strictEqual(found(dir, ['--threshold', '15']), 'Since 31 Dec 2025, 15% would have asked you 4 more questions; you overruled 1 of those calls.');
  });

  it('below the person\'s threshold on a history from before the rule let a call go ahead, every question asked: there is nothing to replay', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.agree(20, 'behaviour');
    h.call(null, 'behaviour');
    logHolding(h.events);

    assert.strictEqual(found(dir, ['--threshold', '15']), 'No call of mine has gone ahead in Fumi yet, so a replay has nothing to show.');
  });

  it('N5: a raise mid-build where no question has blocked build work yet says so, however many others were answered', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.agree(30, 'behaviour');
    logHolding(h.events);

    assert.strictEqual(found(dir, ['--build', '25']), 'No question has blocked build work in Fumi yet, so a replay mid-build has nothing to show.');
  });

  it('N9: the whole log\'s first day is the person\'s own, in their time zone, with its year', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.blocking(11);
    logHolding(h.events);

    const opens = inZone('America/Los_Angeles', () => screenOf(render(dir, ['matrix-replay', '--build', '25']), 'DISPLAY: matrix replay')[1]);

    assert.match(opens, /^ {2}Since 30 Dec 2025, 25% mid-build/);
  });

  it('a kind corrected after a question was raised reaches none of the questions decided before it, and every question decided after it: each is read over the counts of its own stretch between corrections', () => {
    const h = history({ project: OTHER });
    const agreed = h.agree(12, 'behaviour');
    const raised = h.now() + 500;
    for (const entry of agreed.slice(0, 8)) h.correct(entry, { kind: 'look' });
    h.raise('behaviour', '1', { raised });
    h.raise('behaviour', '1');

    assert.strictEqual(replay(h.events, at).changed, 3);
  });

  it('the whole log opens at the first of what it replays, a showing of a learned gate before any question among it', () => {
    const h = history({ project: OTHER });
    h.gate('plan gate', { picked: 'y', showing: SHOWINGS[0] });
    h.agree(13, 'behaviour');
    const { since, whole } = replay(h.events, at);

    assert.deepStrictEqual({ since, whole }, { since: Date.parse(/** @type {string} */ (h.events[0].at)), whole: true });
  });

  it('the period and the whole log\'s first day go by when each question was raised, never when its answer came', () => {
    const opened = FROZEN_MS - 31 * DAY;
    const h = history({ project: OTHER, start: FROZEN_MS - 20 * DAY });
    h.raise('behaviour', '1', { raised: opened });
    h.agree(19, 'behaviour');

    const { since, whole, questions } = replay(h.events, at);

    assert.deepStrictEqual({ since, whole, questions }, { since: opened, whole: true, questions: 20 });
  });

  it('a pick mid-build lowered below the person\'s own replays Claude\'s calls that went ahead in the build alone, each decided again against the pick mid-build, never the threshold used elsewhere', () => {
    const { dir, id } = fumi();
    const settings = { ...DEFAULTS, threshold: 0.2, build_threshold: 0.3 };
    settingsHolding(JSON.stringify({ trust: { threshold: 0.2, build_threshold: 0.3 } }));
    const h = history({ project: id });
    h.blocking(9);
    const calls = Array.from({ length: 4 }, () => h.call('several', 'behaviour', {}, { blocksBuild: true }));
    h.call('several', 'behaviour');
    h.reverse(calls[3]);
    logHolding(h.events);

    const { questions, changed, overruled } = replay(h.events, { project: { id, name: 'Fumi' }, settings, proposed: { ...settings, build_threshold: 0.25 }, care: [], now: FROZEN_MS, blocking: true });

    assert.deepStrictEqual({ questions, changed, overruled }, { questions: 4, changed: 4, overruled: 1 });
    assert.deepStrictEqual(inZone('UTC', () => screen(render(dir, ['matrix-replay', '--build', '25']), ['DISPLAY: matrix replay', 'MENU: matrix replay'])), [
      '25% MID-BUILD IN PLACE OF YOUR 30%',
      '  Since 31 Dec 2025, 25% mid-build would have asked you 4 more',
      '  questions in the build; you overruled 1 of those calls.',
      '· · · · · · · · · · · ·',
      'At 25% mid-build, the line where a change would be hard to undo',
      'moves to 12.5%, and a quiet kind asks again over 31.25%.',
      '',
      '◆ Use 25% as your threshold mid-build?',
      '',
      'y/yes   → Use 25% from now on',
      'n/no    → Keep 30%',
      'Comment → Try another number',
    ]);
  });

  it('a pick mid-build lowered below the person\'s own where no call of mine has gone ahead in the build says so, however many questions blocked it', () => {
    const { dir, id } = fumi();
    settingsHolding(JSON.stringify({ trust: { threshold: 0.2, build_threshold: 0.35 } }));
    const h = history({ project: id });
    h.blocking(7);
    logHolding(h.events);

    assert.strictEqual(found(dir, ['--build', '30']), 'No call of mine has gone ahead in the build in Fumi yet, so a replay mid-build has nothing to show.');
  });

  it('a setting below the person\'s that would have asked none of the calls that went ahead says so', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.agree(30, 'behaviour');
    h.call('several', 'behaviour');
    h.call('several', 'behaviour');
    logHolding(h.events);

    assert.strictEqual(found(dir, ['--threshold', '15']), 'Since 31 Dec 2025, 15% would have asked you none of the 2 calls that went ahead as mine.');
  });
});

describe('the replay at the learned gates (16.20.2, 3.2.7)', () => {
  const at = Object.freeze({ project: { id: OTHER, name: 'Aircon' }, settings: DEFAULTS, proposed: AT_25, care: [], now: FROZEN_MS, blocking: false });

  /**
   * Ten answers of y at the plan gate in Aircon, each on a showing of its
   * own, then one on `third`, then y and n on two showings more.
   * @param {string} third
   */
  function answeredAt(third) {
    const h = history({ project: OTHER });
    for (const showing of SHOWINGS.slice(0, 10)) h.gate('plan gate', { picked: 'y', showing });
    h.gate('plan gate', { picked: 'y', showing: third });
    h.gate('plan gate', { picked: 'y', showing: SHOWINGS[10] });
    h.gate('plan gate', { picked: 'n', showing: SHOWINGS[11] });
    return h;
  }

  it('above the person\'s threshold: the showings they answered, each decided again over the gate\'s count as it stood before it — those it would have run as a step, and those among them the person picked otherwise at; one its blind ask draws shows at any threshold; a gate off the list, a step run, and a raise mid-build replay no showing', () => {
    const offList = answeredAt(SHOWINGS[12]);
    offList.gate('state lost gate', { picked: 'y' });
    const stepped = answeredAt(SHOWINGS[12]);
    stepped.step('plan gate', 'y', DRAWN_SHOWING);

    assert.deepStrictEqual([replay(answeredAt(SHOWINGS[12]).events, at).gates, replay(answeredAt(DRAWN_SHOWING).events, at).gates, replay(offList.events, at).gates, replay(stepped.events, at).gates], [
      { showings: 13, changed: 3, overruled: 1 },
      { showings: 13, changed: 2, overruled: 1 },
      { showings: 13, changed: 3, overruled: 1 },
      { showings: 13, changed: 3, overruled: 1 },
    ]);
    assert.deepStrictEqual(replay(answeredAt(SHOWINGS[12]).events, { ...at, settings: { ...DEFAULTS, build_threshold: 0.2 }, proposed: { ...DEFAULTS, build_threshold: 0.25 }, blocking: true }).gates, NO_GATES);
  });

  it('below the person\'s threshold: the steps run, each decided again over the gate\'s count as it stood before it — those it would have shown, none where the setting proposed steps it too', () => {
    const h = history({ project: OTHER });
    for (let i = 0; i < 13; i += 1) h.gate('plan gate', { picked: 'y' });
    for (const showing of SHOWINGS.slice(0, 3)) h.step('plan gate', 'y', showing);

    assert.deepStrictEqual([replay(h.events, { ...at, proposed: AT_15 }).gates, replay(h.events, { ...at, proposed: { ...DEFAULTS, threshold: 0.195 } }).gates], [
      { showings: 3, changed: 3, overruled: 0 },
      { showings: 3, changed: 0, overruled: 0 },
    ]);
  });

  it('a showing answered in words the separate call read as the step\'s row is no pick otherwise; one read as another row is', () => {
    const h = history({ project: OTHER });
    for (const showing of SHOWINGS.slice(0, 10)) h.gate('plan gate', { picked: 'y', showing });
    h.gate('plan gate', { reading: 'y', showing: SHOWINGS[10] });
    h.gate('plan gate', { reading: 'n', showing: SHOWINGS[11] });

    assert.deepStrictEqual(replay(h.events, at).gates, { showings: 12, changed: 2, overruled: 1 });
  });

  it('each showing is decided over the gate\'s count for the model of the session it came in: steps on a model before the newest, its answers given on it, read in full (16.4.4)', () => {
    const h = history({ project: OTHER, model: MODEL_LINES[0][1] });
    for (let i = 0; i < 13; i += 1) h.gate('plan gate', { picked: 'y' });
    for (const showing of SHOWINGS.slice(0, 3)) h.step('plan gate', 'y', showing);

    assert.deepStrictEqual(replay(h.events, { ...at, proposed: AT_15 }).gates, { showings: 3, changed: 3, overruled: 0 });
  });

  it('over the last month, its showings alone: a gate\'s showings from before it replay none (P14)', () => {
    const old = history({ project: OTHER, start: FROZEN_MS - 70 * DAY });
    for (const showing of SHOWINGS) old.gate('plan gate', { picked: 'y', showing });
    const recent = history({ project: OTHER, start: FROZEN_MS - 10 * DAY });
    recent.agree(20, 'behaviour');
    recent.gate('plan gate', { picked: 'y', showing: DRAWN_SHOWING });
    const { whole, gates } = replay([...old.events, ...recent.events], at);

    assert.deepStrictEqual({ whole, gates }, { whole: false, gates: { showings: 1, changed: 0, overruled: 0 } });
  });

  it('the replay screen says what the threshold would have changed at the gates — above the person\'s, the stops it would have gone on past and those they picked otherwise at; below, the stops it would have made, opening with the period where no question opens it', () => {
    const { dir, id } = fumi();
    const above = history({ project: id });
    above.agree(13, 'behaviour');
    for (const showing of SHOWINGS.slice(0, 10)) above.gate('plan gate', { picked: 'y', showing });
    above.gate('plan gate', { picked: 'y', showing: SHOWINGS[10] });
    above.gate('plan gate', { picked: 'n', showing: SHOWINGS[11] });
    logHolding(above.events);
    const less = inZone('UTC', () => screenOf(render(dir, ['matrix-replay', '--threshold', '25']), 'DISPLAY: matrix replay'));
    const below = history({ project: id });
    for (let i = 0; i < 13; i += 1) below.gate('plan gate', { picked: 'y' });
    for (const showing of SHOWINGS.slice(0, 3)) below.step('plan gate', 'y', showing);
    logHolding(below.events);
    const more = inZone('UTC', () => screenOf(render(dir, ['matrix-replay', '--threshold', '15']), 'DISPLAY: matrix replay'));

    assert.deepStrictEqual([less, more], [[
      '25% IN PLACE OF YOUR 20%',
      '  Since 31 Dec 2025, 25% would have skipped 3 questions; you\'d',
      '  have overruled none of them.',
      '  At the gates that learn from your answers, it would have gone',
      '  on past 2 of the 12 stops you answered; you\'d have picked',
      '  otherwise at 1 of them.',
    ], [
      '15% IN PLACE OF YOUR 20%',
      '  No call of mine has gone ahead in Fumi yet.',
      '  Since 31 Dec 2025, at the gates that learn from your answers,',
      '  15% would have stopped at 3 of the 3 stops I went on past.',
    ]]);
  });

  it('the replay screen says the threshold would have gone on past none of the stops answered where it changes none, naming no pick otherwise', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    for (const showing of SHOWINGS.slice(0, 3)) h.gate('plan gate', { picked: 'y', showing });
    logHolding(h.events);

    assert.strictEqual(found(dir, ['--threshold', '25']), 'You haven\'t answered a question in Fumi yet. Since 31 Dec 2025, at the gates that learn from your answers, 25% would have gone on past none of the 3 stops you answered.');
  });
});

describe('the replay\'s cost', () => {
  it('a busy year across three projects — twenty questions and twenty calls a day each — ended over a month ago, so the whole log replays, in one walk through it, each count walked once', () => {
    const kinds = /** @type {const} */ (['behaviour', 'look', 'words', 'scope', 'process', 'internals', 'contract']);
    const opened = FROZEN_MS - 396 * DAY;
    const events = [OTHER, idOf('Pay'), idOf('Docs')].flatMap((project, p) => {
      const h = history({ project, start: opened });
      for (let d = 0; d < 7300; d += 1) {
        const when = opened + (d * DAY) / 20 + p;
        h.agree(1, kinds[d % kinds.length], { at: when });
        h.call('several', kinds[d % kinds.length], { at: when + DAY / 40 });
      }
      return h.events;
    });

    const started = process.cpuUsage();
    const { questions } = replay(events, { project: { id: OTHER, name: 'Aircon' }, settings: DEFAULTS, proposed: AT_25, care: [], now: FROZEN_MS, blocking: false });
    const { user, system } = process.cpuUsage(started);

    assert.strictEqual(questions, 7300);
    // About 0.7 s of CPU here; walking each question's counts afresh cost
    // 12 s. CPU, not wall time, so load does not move it.
    assert.ok((user + system) / 1e6 < REPLAY_BUDGET_S, `the replay took ${(user + system) / 1e6} s of CPU, over ${REPLAY_BUDGET_S} s`);
  });
});

describe('the person\'s settings (16.4.7, 16.13.2, E10)', () => {
  it('16.S63: a question blocking build work takes the threshold used elsewhere until the person picks a higher one from its replay on the matrix — then it takes theirs, a question not blocking keeping the threshold, and the matrix says so', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.blocking(11);
    logHolding(h.events);
    const before = [behaviourAt(dir, true), behaviourAt(dir, false)];

    render(dir, ['matrix']);
    assert.deepStrictEqual(pick(dir, 'matrix', 'u').next, CARRY_ON);
    render(dir, ['matrix-replay', '--build', '25']);
    const set = run(dir, pick(dir, 'matrix replay', 'y').next.argv);

    assert.deepStrictEqual(before, ['ask', 'ask']);
    assert.deepStrictEqual(set, { ok: true, build_threshold: '25%', next: engine('render', 'matrix') });
    assert.deepStrictEqual([behaviourAt(dir, true), behaviourAt(dir, false)], ['proceed', 'ask']);
    assert.deepStrictEqual(block(matrix(dir), 'MID-BUILD', 2)[1], '  25%, your pick, where elsewhere it is 20%.');
  });

  it('the threshold is written only on the person\'s y/yes on its replay, merged into the settings file beside the knowledge base\'s and every other setting under its key; with no pick, another pick, or a pick of another number, nothing is written', () => {
    const { dir } = fumi();
    const held = JSON.stringify({ knowledge: { provider: 'openai', model: 'text-embedding-3-small' }, other: 1, trust: { build_threshold: 0.4, later: 'kept' } });
    settingsHolding(held);
    const unpicked = 'trust threshold: the person has not picked 30% — only their y/yes on its replay, render matrix-replay --threshold 30, sets it, and nothing is written';

    const refusals = [refused(dir, ['trust', 'threshold', '30'])];
    render(dir, ['matrix-replay', '--threshold', '30']);
    pick(dir, 'matrix replay', 'n');
    refusals.push(refused(dir, ['trust', 'threshold', '30']));
    render(dir, ['matrix-replay', '--threshold', '25']);
    pick(dir, 'matrix replay', 'y');
    refusals.push(refused(dir, ['trust', 'threshold', '30']));
    const unwritten = settingsText();
    const set = run(dir, ['trust', 'threshold', '25%']);

    assert.deepStrictEqual(refusals, [unpicked, unpicked, unpicked]);
    assert.strictEqual(unwritten, held);
    assert.deepStrictEqual(set, { ok: true, threshold: '25%', next: engine('render', 'matrix') });
    assert.deepStrictEqual(JSON.parse(/** @type {string} */ (settingsText())), { knowledge: { provider: 'openai', model: 'text-embedding-3-small' }, other: 1, trust: { build_threshold: 0.4, later: 'kept', threshold: 0.25 } });
  });

  it('a pick is checked against the settings as they stand when it is written: one another conversation has set meanwhile is refused, and nothing written', () => {
    const { dir } = fumi();
    render(dir, ['matrix-replay', '--threshold', '25']);
    pick(dir, 'matrix replay', 'y');
    const meanwhile = JSON.stringify({ trust: { threshold: 0.25 } });
    settingsHolding(meanwhile);

    assert.strictEqual(refused(dir, ['trust', 'threshold', '25']), 'trust threshold: 25% is your threshold already');
    assert.strictEqual(settingsText(), meanwhile);
  });

  it('N1: a threshold picked above the pick mid-build leaves mid-build the threshold\'s own — a question blocking build work never asks where the same question elsewhere goes ahead — and the matrix says the pick sits below it', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.blocking(9);
    logHolding(h.events);
    for (const flag of ['--build', '--threshold']) {
      render(dir, ['matrix-replay', flag, flag === '--build' ? '25' : '30']);
      run(dir, pick(dir, 'matrix replay', 'y').next.argv);
    }

    const [blocking, elsewhere] = [behaviourRuled(dir, true), behaviourRuled(dir, false)];

    assert.deepStrictEqual(JSON.parse(/** @type {string} */ (settingsText())), { trust: { build_threshold: 0.25, threshold: 0.3 } });
    assert.deepStrictEqual([blocking.decision, elsewhere.decision], ['proceed', 'proceed']);
    assert.strictEqual(blocking.reason, elsewhere.reason);
    assert.match(blocking.reason, /under your 30%\.$/);
    assert.deepStrictEqual(block(matrix(dir), 'MID-BUILD', 2)[1], '  30%, the same as elsewhere: your 25% pick sits below it.');
  });

  it('N2: a threshold picked equal to the pick mid-build reads as the pick, the same as elsewhere, never as one below it', () => {
    const { dir } = fumi();
    for (const flag of ['--build', '--threshold']) {
      render(dir, ['matrix-replay', flag, '30']);
      run(dir, pick(dir, 'matrix replay', 'y').next.argv);
    }

    assert.deepStrictEqual(JSON.parse(/** @type {string} */ (settingsText())), { trust: { build_threshold: 0.3, threshold: 0.3 } });
    assert.deepStrictEqual(block(matrix(dir), 'MID-BUILD', 2)[1], '  30%, your pick, the same as elsewhere.');
  });

  it('a settings file that does not read, or holds a setting the rule cannot read, is refused, naming it, and never written over; a pick with no conversation is refused', () => {
    const { dir } = fumi();
    render(dir, ['matrix-replay', '--threshold', '25']);
    pick(dir, 'matrix replay', 'y');
    const file = settingsFile();

    settingsHolding('{"knowledge": ');
    const unread = refused(dir, ['trust', 'threshold', '25']);
    const unreadText = settingsText();
    settingsHolding(JSON.stringify({ trust: { build_threshold: 2 } }));
    const misheld = refused(dir, ['trust', 'threshold', '25']);
    const misheldText = settingsText();
    const sessionless = withFrozenClock(() => refuses(dir, ['trust', 'threshold', '25'], { env: { CLAUDE_CODE_SESSION_ID: undefined } }).error);

    assert.match(unread, new RegExp(`^the settings file ${file} does not read — `));
    assert.strictEqual(unreadText, '{"knowledge": ');
    assert.strictEqual(misheld, `the settings file ${file}'s trust.build_threshold is not null or a fraction above 0 and below 1: 2`);
    assert.strictEqual(misheldText, JSON.stringify({ trust: { build_threshold: 2 } }));
    assert.match(sessionless, /^trust threshold: no conversation to answer in/);
  });
});

describe('corrections in words (16.15.4, 16.S67)', () => {
  it('16.S67: a kind is corrected in words, never on the matrix, whose rows edit none — `trust correct --kind` logs it and the counts follow; a verdict given likewise, `--verdict`', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    const [moving] = h.agree(2, 'behaviour');
    const lost = h.depart('loss', 'behaviour');
    logHolding(h.events);
    callsHolding(dir, [moving, lost]);
    const before = matrix(dir);

    const kind = run(dir, ['trust', 'correct', moving.slice(0, 8), '--kind', 'look']);
    const verdict = run(dir, ['trust', 'correct', lost, '--verdict', 'fix']);
    const after = matrix(dir);

    assert.deepStrictEqual([kind, verdict].map(({ entry, ...rest }) => [entry.length < lost.length, rest]), [[true, { ok: true, kind: 'look' }], [true, { ok: true, verdict: 'fix' }]]);
    assert.deepStrictEqual(logged('correction').map(({ entry, kind: k, verdict: v }) => [entry, k, v]), [[moving, 'look', null], [lost, null, 'fix']]);
    assert.deepStrictEqual([before, after].map((drawn) => [rowOf(drawn, 'behaviour'), rowOf(drawn, 'look')].map((row) => row?.slice(0, 28))), [
      ['  behaviour     1 of 3     1', '  look          0 of 0     0'],
      ['  behaviour     1 of 2     0', '  look          0 of 1     0'],
    ]);
  });

  it('refuses a kind on a question no answer of this machine\'s names, a verdict on an answer that took the lean or one waiting on its verdict, a kind or a verdict there is none of, and argv of another shape — logging nothing', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    const [agreed] = h.agree(1, 'behaviour');
    const waiting = h.depart(null, 'behaviour');
    logHolding(h.events);
    const unlogged = newId();
    callsHolding(dir, [agreed, waiting, unlogged]);
    const usage = 'Usage: engine trust correct <entry> --kind <process|danger|contract|scope|look|words|behaviour|internals> | --verdict <nothing|fix|loss>';
    /** @type {[string[], string|RegExp][]} */
    const refusals = [
      [[unlogged, '--kind', 'look'], /^trust correct: \S+ is no question this machine's trust log holds an answer or a call for — a kind is corrected where the counts read it$/],
      [[agreed, '--verdict', 'fix'], /^trust correct: \S+ is no departure this machine logged — a verdict is corrected on the machine where it was given$/],
      [[waiting, '--verdict', 'fix'], /^trust correct: \S+ waits on its verdict — give it with verdict give; only a verdict given is corrected$/],
      [[agreed, '--kind', 'flow'], 'trust correct: "flow" is no kind — process, danger, contract, scope, look, words, behaviour, internals'],
      [[waiting, '--verdict', 'skip'], 'trust correct: "skip" is no verdict to correct to — nothing, fix, loss; a skip is no verdict given'],
      [[agreed, '--kind'], usage],
      [[agreed, '--kind', 'look', '--verdict', 'fix'], usage],
      [['--kind', 'look'], usage],
    ];
    for (const [args, error] of refusals) {
      const said = refused(dir, ['trust', 'correct', ...args]);
      if (typeof error === 'string') assert.strictEqual(said, error, args.join(' '));
      else assert.match(said, error, args.join(' '));
    }
    assert.deepStrictEqual(logged('correction'), []);
  });
});
