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
const { idOf, SESSION, DAY, MODEL, lines, useTrustWorld, history } = require('./trust-world.cjs');
const { labelled } = require('./labels.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { appendEntries } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { replay } = require(path.join(SCRIPTS, 'domain/replay.cjs'));
const { ruled } = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));
const { DEFAULTS } = require(path.join(SCRIPTS, 'domain/trust-settings.cjs'));

const { folder, logPath } = useTrustWorld('engine-matrix-');

const ENV = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION });
const UNIT = 'fumi';
const OTHER = idOf('Aircon');
const AT_25 = Object.freeze({ ...DEFAULTS, threshold: 0.25 });

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
 * person changed, judged a fix later, then three more taking it; and four
 * on contract.
 * @param {string} project
 */
function replayedHistory(project) {
  const h = history({ project });
  h.agree(12, 'behaviour');
  h.depart('fix', 'behaviour');
  h.agree(3, 'behaviour');
  h.agree(4, 'contract');
  return h;
}

/** A behaviour question in the project at `dir`, blocking build work where `blocks`, as the decision point is given it. @param {string} dir @param {boolean} blocks */
function behaviourAt(dir, blocks) {
  return ruled(/** @type {any} */ ({ sort: 'several' }), {
    label: labelled('behaviour'), place: { unit: UNIT, phase: 'implementation', topic: null }, blocks_build: blocks, replaced_by: null, always: null, checked: false,
    project: { root: statePath(dir), name: 'Fumi' }, model: MODEL, now: FROZEN_MS,
  }).decision;
}

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
      label: labelled('behaviour'), place: { unit: UNIT, phase: 'discussion', topic: 'note-window' }, blocks_build: false, replaced_by: null, always: null, checked: false,
      project: { root: statePath(dir), name: 'Fumi' }, model: null, now: FROZEN_MS,
    }).reason);

    assert.strictEqual(rowOf(matrix(dir), 'behaviour'), '  behaviour    3 of 13     2   39%  asks');
    assert.match(reason, / 39%, over your 20%\.$/);
  });

  it('the carried line says how much the person\'s other projects carry in, at most 10 answers\' weight a count, danger\'s apart — a kind with none of its own here starting from them, as 16.14.4 works it', () => {
    const { dir, id } = fumi();
    const h = history({ project: OTHER });
    h.agree(13, 'look');
    h.agree(3, 'scope');
    h.agree(2, 'danger');
    h.agree(1, 'look', { project: id });
    logHolding(h.events);

    const drawn = matrix(dir);

    assert.deepStrictEqual(block(drawn, 'Carried', 3), [
      'Carried from your other projects: 13 answers\' weight, at most 10',
      'for each kind and for my one-answer calls. Each rate here starts',
      'from them and moves with Fumi\'s own answers; the counts below are',
    ]);
    assert.deepStrictEqual([rowOf(drawn, 'look'), rowOf(drawn, 'scope')], ['  look          0 of 1     0   22%  asks', '  scope         0 of 0     0   53%  asks']);
  });

  it('P11: each review finding falls in the lane of what settled it — merged into what the record holds, apply; moved to another topic or to the roadmap, route, however it is answered after; the person\'s answer, their "your call" and "don\'t care" among it, walked; Claude\'s own call, decide — and one still open, Claude\'s own question and one on a topic since cancelled, put on the roadmap before it was, in none', () => {
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
      add(asked('Does a note have a title?'));
      add(answered(add(asked('Does a note float above?', 'claude')), 'claude'));
      add({ ...moved(add(asked('Does the tray hold notes?', 'review', 'tray')), 'roadmap:tray'), ...on('tray') });
    });

    assert.deepStrictEqual(block(matrix(dir), 'HOW REVIEW FINDINGS SPLIT', 5), [
      'HOW REVIEW FINDINGS SPLIT (7 across Fumi\'s reviews)',
      '  apply   1  14%  the record or a fact settles it',
      '  decide  1  14%  Claude\'s call',
      '  walked  3  43%  asked you',
      '  route   2  29%  belongs to another topic',
    ]);
  });

  it('with nothing answered and the settings the person picked, the matrix says so: every kind asks, the one-answer calls go ahead, no finding is settled, and mid-build names the person\'s pick', () => {
    const { dir } = fumi();
    settingsHolding(JSON.stringify({ trust: { threshold: 0.25, build_threshold: 0.3 } }));

    const drawn = matrix(dir);

    assert.deepStrictEqual([drawn[0], rowOf(drawn, 'internals'), ...block(drawn, 'CLAUDE\'S', 3), ...block(drawn, 'MID-BUILD', 2), ...block(drawn, 'HOW REVIEW', 2)], [
      'Your threshold is 25%. A kind asks you until its rate falls under',
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
    const at = { project, settings: AT_25, care: [], now: FROZEN_MS, blocking: false };
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

    assert.deepStrictEqual(whole, { since: Date.parse(/** @type {string} */ (old.events[0].at)), whole: true, asked: 30, skipped: 1, overruled: 1 });
    assert.deepStrictEqual(month, { since: FROZEN_MS - 30 * DAY, whole: false, asked: 20, skipped: 0, overruled: 0 });
  });

  it('16.4.7: a raise mid-build replays the questions that blocked build work alone, against the threshold used elsewhere where none is picked; and the whole log names its first day', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.blocking(11);
    h.agree(12, 'look');
    logHolding(h.events);

    assert.deepStrictEqual(screen(render(dir, ['matrix-replay', '--build', '25']), ['DISPLAY: matrix replay', 'MENU: matrix replay']).slice(0, 8), [
      '25% MID-BUILD IN PLACE OF THE 20%',
      '  Since 31 Dec, 25% mid-build would have skipped 1 question that',
      '  blocked build work; you\'d have overruled none of them.',
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
      [['--threshold', '100'], 'render matrix-replay: "100" is no threshold — a percent above 0 and below 100, as 25 or 12.5'],
      [['--threshold', '0'], 'render matrix-replay: "0" is no threshold — a percent above 0 and below 100, as 25 or 12.5'],
      [['--threshold', 'a lot'], 'render matrix-replay: "a lot" is no threshold — a percent above 0 and below 100, as 25 or 12.5'],
      [['--threshold', '25', '--build', '30'], 'render matrix-replay: --threshold <percent> or --build <percent>, one and not both'],
      [[], 'render matrix-replay: --threshold <percent> or --build <percent>, one and not both'],
    ];
    for (const [args, error] of refusals) assert.strictEqual(refused(dir, ['render', 'matrix-replay', ...args]), error, args.join(' '));
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

  it('the threshold is written only on the person\'s y/yes on its replay, merged into the settings file beside the knowledge base\'s; with no pick, another pick, or a pick of another number, nothing is written', () => {
    const { dir } = fumi();
    const held = JSON.stringify({ knowledge: { provider: 'openai', model: 'text-embedding-3-small' }, other: 1 });
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
    assert.deepStrictEqual(JSON.parse(/** @type {string} */ (settingsText())), { knowledge: { provider: 'openai', model: 'text-embedding-3-small' }, other: 1, trust: { threshold: 0.25 } });
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
