'use strict';

// ---------------------------------------------------------------------------
// The build's entry and its standing (leeway-engine/scripts/domain/
// build-entry.cjs): `engine enter implementation <unit>`. What it refuses,
// naming the way on and writing nothing — a quick-fix (P9), a unit built
// under the old plan (P12), a build not begun (11.8.3), a work type with no
// build, and a topic named; another session holding the checkout's code
// stopped at the code gate alone, nothing written, `--take` entering and
// back leaving it to that session (12.7.8); the tasks another conversation
// left in flight taken onto this conversation's record with no builder and
// no pair, this conversation's own kept as they stand, the other's record
// left alone, a parked one waiting on its question with no builder until
// the answer (12.13.2); and the answer, which is the recovery note too
// (12.1.6, 12.2.2, 24.2.2, 24.2.5, 12.S4, 24.S13), none for a unit built
// under the old plan: where each phase of the cut stands with its tasks,
// its review's fixes owed until it is settled (13.10.1), the tasks in
// flight with their builders — the entry's of its own unit alone, the
// note's those of the conversation it is asked for, whoever asks — the
// questions waiting and the tasks they park, the entries affected and the
// unit's record by their calls, and the build's log. The standing (P13): each
// phase not yet written, written, running, in review, closed or merged, as
// the tracker, the checklists and the landing hold it, and the build
// finished only once every phase of the cut has closed, so nothing ready
// with a phase not yet written never reads finished (7.4.3, 12.6.7, 12.S16,
// 3.S3). The code gate's wording is render code-gate's
// (test-engine-render-surfaces.cjs); a phase's checklists,
// test-engine-build-checklists-*.cjs's; a task at its step gate,
// test-engine-build-gates-standing.cjs's; the review's fix phases in the
// standing, test-engine-review-fix-phases.cjs's.
//
// Layer: verb. World, built once and copied: the ledger suites' epic,
// `fumi`, its build begun in auto, its cut three phases — Cards and Reports
// relying on nothing, Refunds on Cards — Cards started, its tasks 1.1 done,
// 1.2 in progress, started by another conversation, and 1.3 not started;
// Refunds written, 2.1 not started; Reports not yet written; a question
// asked in its build. Beside it a feature, `solo`, its build begun; another
// feature whose code a peer may hold; a feature cut and not yet built; a
// quick-fix; an epic built under the old plan, and a feature whose old spec
// stands; a cross-cutting concern; and the build's skill installed. Each
// test's conversations keep their records in a config folder of their own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, okSections, okSectionsAsync, output, refusedPristine, git, stateGit, statePath, layout, writeState, readManifest, commitAll, createFile, fixtureFrom, cleanupFixture,
  withEnv, FROZEN_AT, accountTaken,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { MADE, PHASES, ledgerHelpers } = require('./ledger-world.cjs');
const { raiseHelpers } = require('./raise-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { buildStanding } = require(path.join(SCRIPTS, 'domain/build-entry.cjs'));
const { recordReviewer } = require(path.join(SCRIPTS, 'domain/round-report.cjs'));
const { computeNextPhase } = require(path.join(SCRIPTS, 'domain/derivations.cjs'));
const { taskBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));

const UNIT = 'fumi';
const ENGINE = 'node .claude/skills/leeway-engine/scripts/engine.cjs';
// A process that runs and is not this suite's.
const PEER = String(process.ppid);

const CUT = {
  phases: [
    { name: 'Cards', goal: 'Cards are taken.', scenarios: ['1.S1'], sections: ['1'], relies_on: [] },
    { name: 'Refunds', goal: 'Refunds reach the card.', scenarios: ['2.S1'], sections: ['2'], relies_on: [1] },
    { name: 'Reports', goal: 'Reports add up.', scenarios: ['3.S1'], sections: ['3'], relies_on: [] },
  ],
};

/** Task 1.2's account of its one round, as its builder writes it. */
const ACCOUNT = [
  '## What was done', 'A note is sized.', '## Where in the code', '- src/size.js', '## What the tests prove', '- A note sized reads its size back.',
  '## Differs from the task', 'None.', '## Reviews', '### Round 1', 'Passed.',
].join('\n\n');

/** Claude's call on where a new note opens, as the raise suites make it. */
const CALL = Object.freeze({
  question: 'When you make a new note, where should its window open?',
  rows: [
    { key: '1', name: 'Cursor', text: 'On the screen the cursor is on', notice: 'the note opens where you are looking' },
    { key: '2', name: 'Main', text: 'On the main screen', notice: 'every note opens on the same screen' },
  ],
  lean: '1',
  why: 'A note follows the person.',
  sort: 'several',
  mechanism: 'The screen under the pointer when the note is made.',
  product_wide: false,
});

/** The question the world asks in the build: its short id. */
const made = { where: '' };

/** A task's file, written beside the project. @param {string} dir @param {string} title */
function taskFile(dir, title) {
  const file = path.join(dir, '..', `${path.basename(dir)}-task.md`);
  fs.writeFileSync(file, [
    `# ${title}`, '', '## Type', 'feat', '', '## Problem', `${title} is missing.`, '', '## Solution', `Add ${title.toLowerCase()}.`, '',
    '## Outcome', `${title} works.`, '', '## Acceptance scenarios', `- Given a note, when ${title.toLowerCase()} runs, then it answers.`, '', '## Spec reference', '§1', '',
  ].join('\n'));
  return file;
}

const world = fixtureFrom('engine-build-entry-', (dir) => {
  createManifest(dir, UNIT, { work_type: 'epic', phases: PHASES, build: { position: 'auto' }, cut: CUT, checklists: { 'phase-1-start': { items: {}, closed: FROZEN_AT } } });
  createManifest(dir, 'solo', { build: { position: 'step' }, cut: { phases: [CUT.phases[0]] } });
  createManifest(dir, 'other', {});
  createManifest(dir, 'fresh', { cut: { phases: [CUT.phases[0]] } });
  createManifest(dir, 'tweak', { work_type: 'quick-fix' });
  createManifest(dir, 'old', { work_type: 'epic', phases: { planning: { items: { old: { status: 'completed' } } } }, build: { position: 'auto' } });
  createManifest(dir, 'kept', { phases: { specification: { items: { kept: { status: 'completed' } } } }, build: { position: 'auto' } });
  createManifest(dir, 'concern', { work_type: 'cross-cutting' });
  createFile(dir, '.claude/skills/leeway-implementation-process/SKILL.md', '# The build\n');
  commitAll(dir, 'the world');
  ok(dir, ['task', 'phase', UNIT, '1', '--title', 'Cards']);
  ok(dir, ['task', 'phase', UNIT, '2', '--title', 'Refunds']);
  for (const [phase, title] of [['1', 'Open a note'], ['1', 'Size a note'], ['1', 'Place a note'], ['2', 'Refund a note']]) ok(dir, ['task', 'create', UNIT, phase, '--file', taskFile(dir, title)]);
  fs.rmSync(taskFile(dir, ''));
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-build-entry-world-'));
  try {
    accountTaken(dir, UNIT, '1.1');
    ok(dir, ['task', 'done', UNIT, '1.1'], { env: { LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'earlier' } });
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: { LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'earlier' } });
  } finally {
    fs.rmSync(config, { recursive: true, force: true });
  }
  made.where = ledgerHelpers(() => dir).write('ask', `${UNIT}.implementation`, [], { ...MADE, text: 'Where does a new note open?' }).id;
});

let dir = ''; // the project
let config = ''; // the system config: the conversations' folders

beforeEach(() => {
  dir = world();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-build-entry-config-'));
});

afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(config, { recursive: true, force: true });
});

/** The engine as the conversation `sessionId` runs it. @param {string} [sessionId] */
const env = (sessionId = 'sess-1') => ({ LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: sessionId, CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined });

/** An entry that must succeed: its response and its sections. @param {string[]} args @param {string} [sessionId] */
const enter = (args, sessionId) => okSections(dir, ['enter', 'implementation', ...args], { env: env(sessionId) });

/** An entry that must refuse, writing nothing: its error. @param {string[]} args */
const refused = (args) => refusedPristine(dir, ['enter', 'implementation', ...args], { env: env() }).error;

/** A conversation's position as recorded, or null. @param {string} [sessionId] */
function position(sessionId = 'sess-1') {
  try { return JSON.parse(fs.readFileSync(path.join(config, 'conversations', sessionId, 'position.json'), 'utf8')); } catch { return null; }
}

/** A DATA section of `lines`, as the entry draws it. @param {string[]} lines */
const data = (lines) => `=== DATA (reason from this — never display or parse the sections below) ===\n${lines.join('\n')}\n`;

/** The build's standing, as this conversation reads it, with its tasks in flight. */
const standing = () => withEnv({ LEEWAY_CONFIG_DIR: config }, () => buildStanding(dir, UNIT, position()?.tasks ?? []));

/** Where each phase of the cut stands. */
const states = () => standing().phases.map(({ state }) => state);

/** Each named checklist closed on the unit's manifest, as its close records it. @param {string[]} names */
function closed(names) {
  const manifest = readManifest(dir, UNIT);
  createManifest(dir, UNIT, { ...manifest, checklists: { ...manifest.checklists, ...Object.fromEntries(names.map((name) => [name, { items: {}, closed: FROZEN_AT }])) } });
}

/** The lines the world's entry answers past its in-flight lines: the ledger's calls, the build's log, and the engine by its absolute path, for a call from a task's worktree. */
const readsAfter = () => [
  `affected: \`${ENGINE} ledger affected ${UNIT}\``,
  `record: \`${ENGINE} ledger record ${UNIT}\``,
  `build log: ${statePath(dir, `${UNIT}/build/log.md`)}`,
  `engine: \`node ${path.join(SCRIPTS, 'engine.cjs')}\` — the engine by its absolute path, for a call made from a task's worktree`,
];

const PHASE_LINES = Object.freeze([
  'phase: phase 1 of 3, "Cards": running — tasks 1.1 done, 1.2 in progress, 1.3 not started',
  'phase: phase 2 of 3, "Refunds": written — tasks 2.1 not started',
  'phase: phase 3 of 3, "Reports": not yet written',
]);

describe('enter implementation: what cannot be entered is refused, naming the way on, and nothing is written', () => {
  it('a quick-fix (P9), a unit built under the old plan (P12), a build not begun (11.8.3), a work type with no build, and a topic named', () => {
    assert.deepStrictEqual([refused(['tweak']), refused(['old']), refused(['kept']), refused(['fresh']), refused([UNIT, 'note-window'])], [
      'tweak is a quick-fix, whose delivery is built with the reshape\'s 29.15 — until then a quick-fix stops at its scoping',
      'old was built under the old plan, and its build is entered once the reshape\'s 29.17 migration has cut it',
      'kept was built under the old plan, and its build is entered once the reshape\'s 29.17 migration has cut it',
      'fresh\'s build has not begun — ready to build\'s yes begins it: render ready-to-build fresh',
      `implementation is entered at the work unit — name no topic: engine enter implementation ${UNIT}`,
    ]);
    assert.match(refused(['concern']), /^a cross-cutting has no implementation — its phases are /);
  });
});

describe('another session holding the checkout\'s code (12.7.8)', () => {
  it('stops at the code gate alone, naming that session and when it was last active, and writes nothing — no position, no task taken', () => {
    okSections(dir, ['presence', 'beat', 'other', 'implementation', 'other'], { env: { ...env('peer'), CLAUDE_PID: PEER } });
    const head = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const { res, sections } = enter([UNIT]);

    assert.deepStrictEqual(res, { ok: true, phase: 'implementation', unit: UNIT, entered: false });
    assert.match(sections, /^=== DISPLAY: code gate .*\n⚑ Another session is implementing "Other" \(other\) — last active \d+s ago\.\n/);
    assert.match(sections, /=== MENU: code gate /);
    assert.doesNotMatch(sections, /=== DATA/);
    assert.deepStrictEqual([stateGit(dir, ['rev-parse', 'HEAD']).trim(), position()], [head, null]);
  });

  it('yes is the entry again with --take, which enters; back leaves it to that session — to the epic\'s menu, or carrying on where there is none', () => {
    okSections(dir, ['presence', 'beat', 'other', 'implementation', 'other'], { env: { ...env('peer'), CLAUDE_PID: PEER } });
    enter([UNIT]);
    const { next } = ok(dir, ['gate', 'code gate', '--pick', 'y'], { env: env() });
    assert.deepStrictEqual(next, { kind: 'engine', argv: ['enter', 'implementation', UNIT, '--take'] });
    assert.strictEqual(enter(next.argv.slice(2)).res.entered, true);
    enter([UNIT]);
    const epic = ok(dir, ['gate', 'code gate', '--pick', 'b'], { env: env() }).next;
    enter(['solo']);

    assert.deepStrictEqual([epic, ok(dir, ['gate', 'code gate', '--pick', 'b'], { env: env() }).next], [{ kind: 'handoff', skill: 'leeway-continue-epic', args: [UNIT] }, { kind: 'continue' }]);
  });
});

describe('the answer: where the build stands, and what to read beside the ledger (12.1.6, 12.2.2, 24.2.5)', () => {
  it('answers each phase of the cut with its tasks, each task in flight, the ledger\'s calls and the build\'s log — starting nothing, the unit its place', () => {
    const head = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const { res, sections } = enter([UNIT]);

    assert.deepStrictEqual(res, { ok: true, phase: 'implementation', unit: UNIT, entered: true, started: false });
    assert.strictEqual(sections, data(['position: auto', ...PHASE_LINES, 'in flight: task 1.2, no builder dispatched here — its builder and pair go afresh on its branch', ...readsAfter()]));
    assert.deepStrictEqual([stateGit(dir, ['rev-parse', 'HEAD']).trim(), position()], [head, { name: UNIT, phase: 'implementation', topic: UNIT, tasks: [{ task: '1.2', builder: null, reviewers: [] }] }]);
  });

  /** Task 1.2's line, the entry's, once its review stands as `setUp` leaves it. @param {() => void} setUp */
  const lineOf = (setUp) => {
    setUp();
    return enter([UNIT]).sections.split('\n').find((line) => line.startsWith('in flight: task 1.2'));
  };

  /** A report of round `round` of task 1.2 by reviewer `letter`, passing. @param {number} round @param {string} letter */
  const passedBy = (round, letter) => writeState(dir, `${UNIT}/build/tasks/1.2/round-${round}-${letter}.md`, '## Findings\n\nNone.\n\nVerdict: pass\n');

  /** Round 1 of task 1.2 passed by both its reviewers. */
  const passedRound = () => ['a', 'b'].forEach((letter) => passedBy(1, letter));

  /** Round 1's reports, read for their notes for later and nits, as a line names them. */
  const readReports = () => `read its reports, ${['a', 'b'].map((letter) => `\`${statePath(dir, `${UNIT}/build/tasks/1.2/round-1-${letter}.md`)}\``).join(' and ')}, for their notes for later and the nits the task's commits do not yet fix`;

  it('N1, N2 (13.4.5, 24.2.4): a task with no builder dispatched here whose last round passed, its account not taken and no worktree having its branch out, names its builder\'s brief first, which lays one out, and that round\'s reports to read for their notes for later and nits, fixed there before its account is taken', () => {
    const line = lineOf(passedRound);

    assert.strictEqual(line, `in flight: task 1.2, no builder dispatched here — round 1 of its review passed, its account not taken — no worktree has its branch checked out, so send its builder its brief first, engine brief builder ${UNIT} 1.2, which lays one out and asks for its account; ${readReports()}, and fix those in that worktree before its account is taken`);
  });

  it('N1, N2 (13.4.5, 24.2.4): the same task, a worktree having its branch out, names that round\'s reports to read for their notes for later and nits, fixed in that worktree, then its builder\'s brief for the account', () => {
    const folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engine-build-entry-tree-')));
    const tree = path.join(folder, 'tree');
    try {
      git(dir, ['worktree', 'add', '-q', '-b', taskBranch({ unit: UNIT, phase: 1, n: 2 }, 'feat', 'Size a note'), tree, 'main']);
      const line = lineOf(passedRound);

      assert.strictEqual(line, `in flight: task 1.2, no builder dispatched here — round 1 of its review passed, its account not taken — ${readReports()}, and fix those in ${tree}, where its branch is checked out; then send its builder its brief for its account, engine brief builder ${UNIT} 1.2`);
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });

  it('N2 (12.14): a task whose last round passed, its account written and not taken, names its taking; once it is taken, its landing', () => {
    passedRound();
    writeState(dir, `${UNIT}/build/tasks/1.2.md`, ACCOUNT);
    const written = lineOf(() => {});
    accountTaken(dir, UNIT, '1.2');
    const taken = lineOf(() => {});

    assert.deepStrictEqual([written, taken], [
      `in flight: task 1.2, no builder dispatched here — round 1 of its review passed, its account written and not taken — take it, engine task account ${UNIT} 1.2`,
      `in flight: task 1.2, no builder dispatched here — round 1 of its review passed, its account taken — show its landing, render task-landed ${UNIT} 1.2, then land it, engine land open ${UNIT} 1.2`,
    ]);
  });

  it('a round its pair is reading here names no reviewer\'s brief; one a reviewer of is briefed again for names it', () => {
    const ref = { unit: UNIT, phase: 1, n: 2 };
    const reading = lineOf(() => ['a', 'b'].forEach((letter) => recordReviewer(dir, ref, 1, letter, 'sess-1')));
    const again = lineOf(() => recordReviewer(dir, ref, 2, 'a', 'earlier'));

    assert.deepStrictEqual([reading, again], [
      'in flight: task 1.2, no builder dispatched here — round 1 of its review is not reported whole — reviewer a is reading it here, reviewer b is reading it here; its builder goes afresh once the round is read',
      `in flight: task 1.2, no builder dispatched here — round 2 of its review is not reported whole — reviewer a is briefed again for it, reviewer b is briefed again for it: engine brief reviewer ${UNIT} 1.2 --letter <letter>; its builder goes afresh once the round is read`,
    ]);
  });

  it('takes a task another conversation left in flight onto this one\'s record with no builder and no pair, keeps this one\'s own as it stands, and leaves the other\'s record alone', () => {
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env('earlier') });
    ok(dir, ['conversation', 'builder', 'earlier', 'agent-old'], { env: env('earlier') });
    ok(dir, ['task', 'start', UNIT, '1.3'], { env: env() });
    ok(dir, ['conversation', 'builder', 'sess-1', 'agent-own'], { env: env() });
    const { sections } = enter([UNIT]);

    assert.deepStrictEqual([position().tasks, position('earlier').tasks], [
      [{ task: '1.3', builder: 'agent-own', reviewers: [] }, { task: '1.2', builder: null, reviewers: [] }],
      [{ task: '1.2', builder: 'agent-old', reviewers: [] }],
    ]);
    assert.ok(sections.includes('in flight: task 1.3, its builder agent `agent-own`\nin flight: task 1.2, no builder dispatched here — its builder and pair go afresh on its branch\n'), sections);
  });

  it('takes a parked task over in flight, its line saying it waits on its question, no builder going to it until the person answers (12.13.2)', async () => {
    const { conversation } = raiseHelpers(() => dir, () => config, CALL);
    await okSectionsAsync(dir, ['raise', `${UNIT}.implementation`, '--answers', made.where, '--parks', '1.2'], { env: conversation(), stdin: JSON.stringify(CALL) });
    const { sections } = enter([UNIT]);

    assert.deepStrictEqual([position().tasks, sections.split('\n').filter((line) => line.startsWith('in flight: '))], [
      [{ task: '1.2', builder: null, reviewers: [] }],
      ['in flight: task 1.2, parked on Q1 — it waits on the person\'s answer, and no builder goes to it until then'],
    ]);
  });

  it('says, a line each, the fixes a phase\'s failed review owes as phase-review-passed reads them — every report of the count in — in the entry and the note, until a settlement answers it with every fix it names done (13.10.1)', () => {
    const settleWay = `task settle ${UNIT} --phase 1 --file <why> [--fixes <task>,…]`;
    const unsettled = `phase 1's review failed, and no settlement answers it — write its fixes as tasks of the phase, then settle it, naming them: ${settleWay}`;
    const report = (/** @type {string} */ letter, /** @type {string} */ verdict) => writeState(dir, layout.unit(UNIT, 'build', 'phases', 'phase-1', `review-${letter}.md`),
      `# Review\n\n## Findings\n\n${verdict === 'pass' ? 'None.' : '- bug: a note opens off screen\n  Scenario: a note made on a second screen'}\n\nVerdict: ${verdict}\n`);
    const settle = (/** @type {string[]} */ fixes) => ok(dir, ['task', 'settle', UNIT, '--phase', '1', '--file', writeState(dir, layout.cache(UNIT, 'why.md'), 'A second screen is out of this phase.\n'), ...fixes]);
    const owed = () => standing().phases[0].fixes_owed;
    report('b', 'fail');
    const seen = [owed()];
    report('a', 'pass');
    seen.push(owed());
    const lines = enter([UNIT]).sections.split('\n');
    const note = output(dir, ['conversation', 'position'], { env: env() });
    ok(dir, ['task', 'create', UNIT, '1', '--file', taskFile(dir, 'Keep a note on screen')]);
    fs.rmSync(taskFile(dir, ''));
    settle(['--fixes', '1.4']);
    seen.push(owed());
    ok(dir, ['task', 'close', UNIT, '1.4', '--reason', 'A note off screen is the window manager\'s.']);
    seen.push(owed());
    settle([]);

    assert.deepStrictEqual([...seen, owed()], [
      [],
      [unsettled],
      ['phase 1\'s review failed, and task 1.4, a fix of it, is open'],
      [`phase 1's review failed, and task 1.4, a fix of it, is closed — settle it again, naming the fixes that stand: ${settleWay}`],
      [],
    ]);
    assert.deepStrictEqual(lines.slice(lines.indexOf(PHASE_LINES[0]), lines.indexOf(PHASE_LINES[0]) + 2), [PHASE_LINES[0], `fixes owed: ${unsettled}`]);
    assert.ok(note.includes(`${PHASE_LINES[0]}\nfixes owed: ${unsettled}\n`), note);
    assert.ok(!enter([UNIT]).sections.includes('fixes owed:'), 'a settled review with every fix done owes none');
  });

  it('answers each question waiting on the person and the tasks it parks, the task parked on it in its phase\'s line (12.8.4)', async () => {
    const { conversation } = raiseHelpers(() => dir, () => config, CALL);
    await okSectionsAsync(dir, ['raise', `${UNIT}.implementation`, '--answers', made.where, '--parks', '1.3'], { env: conversation(), stdin: JSON.stringify(CALL) });
    const lines = enter([UNIT]).sections.split('\n');

    assert.deepStrictEqual([lines.find((line) => line.startsWith('phase: phase 1 ')), lines.filter((line) => line.startsWith('waiting: '))], [
      'phase: phase 1 of 3, "Cards": running — tasks 1.1 done, 1.2 in progress, 1.3 parked on Q1',
      [`waiting: Q1 — ${CALL.question} — parks task 1.3`],
    ]);
  });

  it('is the recovery note too: a compaction re-reads the build\'s skill, the ledger\'s calls, the build\'s log, and where each phase stands (12.S4, 24.S13)', () => {
    enter([UNIT]);
    writeState(dir, layout.unit(UNIT, 'build', 'log.md'), '# The build\n\nPhase 1: 1.2 in flight.\n');
    const note = output(dir, ['conversation', 'position'], { env: env() });

    for (const line of [
      path.join(dir, '.claude/skills/leeway-implementation-process/SKILL.md'), `\`${ENGINE} ledger affected ${UNIT}\``, `\`${ENGINE} ledger record ${UNIT}\``,
      statePath(dir, `${UNIT}/build/log.md`), ...PHASE_LINES, 'in flight: task 1.2, no builder dispatched here — its builder and pair go afresh on its branch',
    ]) {
      assert.ok(note.includes(line), `the note names ${line}\n${note}`);
    }
  });

  describe('carries the tasks in flight of the conversation it is asked for, never the calling process\'s — a compaction asks from outside that conversation (24.2.4)', () => {
    /** sess-1's note, asked for by a process whose own id is `caller`; its in-flight lines. @param {string|undefined} caller */
    const asked = (caller) => output(dir, ['conversation', 'position', 'sess-1'], { env: { ...env(), CLAUDE_CODE_SESSION_ID: caller } })
      .split('\n').filter((line) => line.startsWith('in flight: '));
    const OWN = ['in flight: task 1.2, its builder agent `agent-own`'];
    beforeEach(() => {
      enter([UNIT]);
      ok(dir, ['conversation', 'builder', 'sess-1', 'agent-own'], { env: env() });
    });

    it('asked with no session id of its own', () => {
      assert.deepStrictEqual(asked(undefined), OWN);
    });

    it('asked by another conversation with tasks in flight of its own', () => {
      ok(dir, ['task', 'start', UNIT, '1.3'], { env: env('other') });

      assert.deepStrictEqual(asked('other'), OWN);
    });
  });

  it('gives a unit built under the old plan no build\'s standing in its recovery note, its build begun all the same (P12)', () => {
    fs.mkdirSync(path.join(config, 'conversations', 'sess-1'), { recursive: true });
    fs.writeFileSync(path.join(config, 'conversations', 'sess-1', 'position.json'), JSON.stringify({ name: 'kept', phase: 'implementation', topic: 'kept' }));
    const note = output(dir, ['conversation', 'position'], { env: env() });

    assert.ok(note.includes('leeway-implementation-process'), note);
    assert.doesNotMatch(note, /position: auto|build log:/);
  });
});

describe('the build\'s standing (P13)', () => {
  it('answers each phase of the cut, its tasks, this conversation\'s tasks in flight, the questions waiting, and whether the build is finished', () => {
    enter([UNIT]);
    const task = (/** @type {string} */ shown, /** @type {string} */ title, /** @type {string} */ status) => ({ task: shown, title, status, parked: [], after: [] });

    assert.deepStrictEqual(standing(), {
      unit: UNIT,
      position: 'auto',
      phases: [
        { phase: 1, name: 'Cards', round: null, relies_on: [], state: 'running', tasks: [task('1.1', 'Open a note', 'done'), task('1.2', 'Size a note', 'in-progress'), task('1.3', 'Place a note', 'open')], fixes_owed: [] },
        { phase: 2, name: 'Refunds', round: null, relies_on: [1], state: 'written', tasks: [task('2.1', 'Refund a note', 'open')], fixes_owed: [] },
        { phase: 3, name: 'Reports', round: null, relies_on: [], state: 'not yet written', tasks: [], fixes_owed: [] },
      ],
      in_flight: [{ task: '1.2', builder: null, reviewers: [] }],
      waiting: [],
      finished: false,
      merging: null,
      turn: null,
    });
    assert.ok(!enter(['solo']).sections.includes('in flight:'), 'another build\'s entry names none of this conversation\'s tasks in flight');
  });

  it('reads a phase in review once every task not closed is done, closed once its close is recorded, merged once its tasks landed — and the build finished only once every phase of the cut has closed, so nothing ready with a phase not yet written never reads finished (7.4.3, 12.6.7, 12.S16, 3.S3)', () => {
    const seen = [states()];
    accountTaken(dir, UNIT, '1.2');
    ok(dir, ['task', 'done', UNIT, '1.2'], { env: env() });
    ok(dir, ['task', 'close', UNIT, '1.3', '--reason', 'Folded into 1.2.'], { env: env() });
    seen.push(states());
    closed(['phase-1-close']);
    seen.push(states());
    for (const task of ['1-1', '1-2']) git(dir, ['commit', '-q', '--allow-empty', '-m', `feat(${UNIT}): landed`, '-m', `Task: ${UNIT}-${task}`]);
    closed(['phase-2-start', 'phase-2-close']);
    accountTaken(dir, UNIT, '2.1');
    ok(dir, ['task', 'done', UNIT, '2.1'], { env: env() });
    seen.push(states());

    assert.deepStrictEqual(seen, [
      ['running', 'written', 'not yet written'],
      ['in review', 'written', 'not yet written'],
      ['closed', 'written', 'not yet written'],
      ['merged', 'closed', 'not yet written'],
    ]);
    assert.deepStrictEqual(ok(dir, ['task', 'ready', UNIT]).tasks, [], 'the tracker reports nothing ready');
    assert.deepStrictEqual([standing().finished, computeNextPhase(readManifest(dir, UNIT))], [false, { next_phase: 'implementation', phase_label: 'implementation (in-progress)' }]);
    assert.match(refusedPristine(dir, ['checklist', 'close', 'phase-close', UNIT, '3'], { env: env() }).error, /^checklist close: phase-3-close has items open: tasks-passed, /);
  });
});
