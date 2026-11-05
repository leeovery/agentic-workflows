'use strict';

// ---------------------------------------------------------------------------
// The review phase's entry (leeway-engine/scripts/domain/review-entry.cjs,
// its records review-phase.cjs): `engine enter review <unit>`. What it
// refuses, naming the way on and writing nothing — what the build's entry
// refuses, and a build whose cut has a phase not closed, each such phase
// named (14.6.1), or in step a stack of it waiting at its merge gate, the
// gate named (7.2.4); another session holding the checkout's code stopped at the
// build's code gate, nothing written, `--take` entering (12.7.8, 12.S50);
// the snapshot of the working tree outside `.leeway/` taken for round 1 at
// its entry where none is held, never by entering again (14.1.5); the answer:
// the round under review, the spec's areas, never merged, five as one (14.2.1,
// 14.2.3), the reads the round takes — every area and the test surface at
// round 1, then those `review reads` named, from the areas whose findings
// made fix tasks (14.3.3) — each of the round's reports in and reading, so a
// return briefs only the rest — the fix phase a round's fix tasks are written
// or built in, numbered from the cut (P14), the fix tasks waited on, none
// closed, and in step their phase's merge at its gate (14.6.2), each
// round's report, the spec, the record and the build's log; once a round
// ends the review phase, how it ended and what is next; each question
// waiting on the person, by the ledger alone, the build's standing read
// only while something is in flight, so an idle entry's cost stays flat
// (12.13.22); and the recovery note, re-reading what the entry reads
// (24.2.2). A fix task in flight there, taken over at the
// entry, is test-engine-review-fix-tasks.cjs's.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const { output, traced } = require('./engine-harness.cjs');
const {
  UNIT, inStep, ENGINE, ENGINE_LINE, SESSION_ID, AREAS, EVERY, FIVE, RECEIPT, FAILING, useWorld, env, enter, reportText, reported, named, recorded, refusedRound, firstRoundFailed, fixPhaseWritten, cutUnmerged, fixBuilt, fixClosed, raisedAtReview, data,
  ok, okSections, refusedPristine, statePath, writeState, git, stateGit, assert,
} = require('./review-world.cjs');

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });

// A process that runs and is not this suite's.
const PEER = String(process.ppid);

/** An entry that must refuse, writing nothing: its error. @param {string[]} args */
const refused = (args) => refusedPristine(dir, ['enter', 'review', ...args], { env: env() }).error;

/** The snapshot of the working tree, as the entry wrote it, or null. */
function snapshot() {
  const file = statePath(dir, '.cache', UNIT, 'review', 'tree.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** The lines every answer ends with: the spec, the record, the build's log and the engine. @param {string} [unit] */
const readsAfter = (unit = UNIT) => [
  `spec: ${statePath(dir, `${unit}/spec.md`)}`,
  `record: \`${ENGINE} ledger record ${unit}\``,
  `build log: ${statePath(dir, `${unit}/build/log.md`)}`,
  ENGINE_LINE,
];

/** The base line: the branch the unit's work lands on, each reader's base. */
const BASE_LINE = 'base: main — the branch the unit\'s work lands on, the --base of each reader\'s brief';

/** The areas' lines, each by its name and its title. */
const AREA_LINES = ['area: 1-cards — §1 Cards', 'area: 2-refunds — §2 Refunds'];

/** A round's report's line. @param {number} round */
const reportLine = (round) => `round report: ${statePath(dir, `${UNIT}/review/round-${round}.md`)}`;

/** The fix phase line: the phase a round's fix tasks are `written` or `built` in. @param {number} phase @param {number} round @param {'written'|'built'} how */
const fixPhaseLine = (phase, round, how) => `fix phase: phase ${phase}, where round ${round}'s fix tasks are ${how}`;

// The most git commands an entry runs with nothing in flight, waiting on a
// fix task: its own reads, nine of them; reading the build's standing too
// would more than double them.
const IDLE_ENTRY = 12;

/** The reads line while round 2's are not yet named. */
const UNNAMED = `reads: not yet named — once round 1's fix tasks are done, review reads ${UNIT} names them from what those changed, among them 1-cards`;

describe('enter review: what cannot be entered is refused, naming the way on, and nothing is written', () => {
  it('a build whose cut has a phase not closed, naming it or each of them, and what the build\'s entry refuses — a quick-fix, a unit built under the old plan, a build not begun — and a topic named (14.6.1)', () => {
    assert.deepStrictEqual([refused(['half']), refused(['open']), refused(['tweak']), refused(['old']), refused(['fresh']), refused([UNIT, 'cards'])], [
      'half\'s review phase starts once every phase of its cut has closed — phase 2 of 2 has not: enter implementation half',
      'open\'s review phase starts once every phase of its cut has closed — phases 1, 2 of 2 have not: enter implementation open',
      'tweak is a quick-fix, whose delivery is built with the reshape\'s 29.15 — until then a quick-fix stops at its scoping',
      'old was built under the old plan, and its build is entered once the reshape\'s 29.17 migration has cut it',
      'fresh\'s build has not begun — ready to build\'s yes begins it: render ready-to-build fresh',
      `review is entered at the work unit — name no topic: engine enter review ${UNIT}`,
    ]);
  });

  it('in step, a build whose cut has a stack waiting at its merge gate, naming the gate; in auto, its stacks waiting for finish, it is entered (7.2.4)', () => {
    cutUnmerged();
    const entered = enter().res.entered;
    inStep();

    assert.deepStrictEqual([entered, refused([UNIT])], [true, `${UNIT} builds in step, and its review phase is entered once every phase of its cut has merged — phase 2 waits at its gate: render phase-merge-gate ${UNIT} 2`]);
  });
});

describe('another session holding the checkout\'s code (12.7.8)', () => {
  it('12.S50: stops at the code gate alone, naming the session building another unit and when it was last active, writing nothing and taking no snapshot; yes is the entry again with --take, which enters', () => {
    okSections(dir, ['presence', 'beat', 'half', 'implementation', 'half'], { env: { ...env('peer'), CLAUDE_PID: PEER } });
    const head = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const { res, sections } = enter();

    assert.deepStrictEqual(res, { ok: true, phase: 'review', unit: UNIT, entered: false });
    assert.match(sections, /^=== DISPLAY: code gate .*\n⚑ Another session is implementing "Half" \(half\) — last active \d+s ago\.\n/);
    assert.match(sections, /=== MENU: code gate /);
    assert.doesNotMatch(sections, /=== DATA/);
    assert.deepStrictEqual([stateGit(dir, ['rev-parse', 'HEAD']).trim(), snapshot()], [head, null]);
    const { next } = ok(dir, ['gate', 'code gate', '--pick', 'y'], { env: env() });
    assert.deepStrictEqual(next, { kind: 'engine', argv: ['enter', 'review', UNIT, '--take'] });
    assert.strictEqual(enter(next.argv.slice(2)).res.entered, true);
    assert.notStrictEqual(snapshot(), null);
  });
});

describe('the snapshot of the working tree outside .leeway/ (14.1.5)', () => {
  it('holds its round, each repository\'s HEAD, each path its status lists, with the fingerprint of what it holds, and its ignored entries, taken for round 1 at its entry and never again by entering', () => {
    fs.writeFileSync(path.join(dir, 'src/card.js'), 'export const card = 2;\n');
    fs.mkdirSync(path.join(dir, '.git/info'), { recursive: true });
    fs.appendFileSync(path.join(dir, '.git/info/exclude'), 'local.json\n');
    fs.writeFileSync(path.join(dir, 'local.json'), '{}\n');
    enter();
    const taken = snapshot();
    fs.writeFileSync(path.join(dir, 'src/receipt.js'), 'export const receipt = 2;\n');
    enter();

    assert.deepStrictEqual(Object.keys(taken), ['round', 'heads', 'paths', 'ignored']);
    assert.ok(taken.ignored['.'].includes('local.json'), JSON.stringify(taken.ignored));
    assert.strictEqual(taken.round, 1);
    assert.deepStrictEqual(taken.heads, { '.': git(dir, ['rev-parse', 'HEAD']).trim() });
    assert.deepStrictEqual(Object.keys(taken.paths), ['src/card.js']);
    assert.match(taken.paths['src/card.js'], /^ M [0-9a-f]{12}$/);
    assert.deepStrictEqual(snapshot(), taken);
  });

  it('is dropped once its round is recorded; a later round\'s is taken as review reads opens it, never by entering, waiting on fix tasks or not', () => {
    firstRoundFailed();
    const recorded1 = snapshot();
    enter();
    const waiting = snapshot();
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    enter();
    const built = snapshot();
    named(['1-cards']);

    assert.deepStrictEqual([recorded1, waiting, built], [null, null, null]);
    assert.deepStrictEqual([snapshot()?.round, snapshot()?.heads], [2, { '.': git(dir, ['rev-parse', 'HEAD']).trim() }]);
  });
});

describe('the answer: the round under review, the spec\'s areas, and what the round reads', () => {
  it('14.S2: round 1 answers each of a five-area spec\'s areas, never merged, and reads every one of them beside the test surface — committing nothing', () => {
    const head = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const { res, sections } = okSections(dir, ['enter', 'review', 'five'], { env: env() });
    const names = FIVE.map((title, at) => `${at + 1}-${title.toLowerCase()}`);

    assert.deepStrictEqual(res, { ok: true, phase: 'review', unit: 'five', entered: true, started: false });
    assert.strictEqual(sections, data([
      'round: round 1', ...FIVE.map((title, at) => `area: ${names[at]} — §${at + 1} ${title}`), `reads: ${names.join(', ')}, the test surface (tests)`, fixPhaseLine(2, 1, 'written'), BASE_LINE, ...readsAfter('five'),
    ]));
    assert.strictEqual(stateGit(dir, ['rev-parse', 'HEAD']).trim(), head);
  });

  it('a return to a round some of whose reports are in names each that reads, so only the rest are briefed — one not reading among the rest', () => {
    enter();
    const report = (/** @type {string} */ name) => statePath(dir, `${UNIT}/review/round-1/${name}.md`);
    writeState(dir, `${UNIT}/review/round-1/1-cards-a.md`, reportText([]));
    writeState(dir, `${UNIT}/review/round-1/1-cards-b.md`, '# Review\n\nHalf written.\n');
    writeState(dir, `${UNIT}/review/round-1/tests-a.md`, reportText(['bug: A card\'s expiry is checked nowhere.']));

    assert.deepStrictEqual(enter().sections.split('\n').filter((line) => line.startsWith('report in: ')), [`report in: ${report('1-cards-a')}`, `report in: ${report('tests-a')}`]);
  });

  it('a one-area spec answers its one area', () => {
    const { sections } = okSections(dir, ['enter', 'review', 'solo'], { env: env() });

    assert.deepStrictEqual(sections.split('\n').filter((line) => /^(area|reads): /.test(line)), ['area: 1-cards — §1 Cards', 'reads: 1-cards, the test surface (tests)']);
  });

  it('14.S3: after a round whose findings made fix tasks, the next waits on each until it is done, then its reads are named from what they changed — among them every area whose findings made one', () => {
    firstRoundFailed();
    const waiting = enter().sections;
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    const unnamed = enter().sections;
    named(['2-refunds', '1-cards']);

    assert.strictEqual(waiting, data(['round: round 2', ...AREA_LINES, UNNAMED, fixPhaseLine(3, 1, 'built'), 'fix task waiting: 3.1 not started', BASE_LINE, reportLine(1), ...readsAfter()]));
    assert.strictEqual(unnamed, data(['round: round 2', ...AREA_LINES, UNNAMED, BASE_LINE, reportLine(1), ...readsAfter()]));
    assert.strictEqual(enter().sections, data(['round: round 2', ...AREA_LINES, 'reads: 1-cards, 2-refunds', fixPhaseLine(4, 2, 'written'), BASE_LINE, reportLine(1), ...readsAfter()]));
  });

  it('in step, once the fix tasks are done, waits on their phase\'s merge at its gate until each not closed has landed (14.6.2)', () => {
    inStep();
    enter();
    reported(1, EVERY, { ...FAILING, '2-refunds-b': ['bug: A refund names no charge.'] });
    fixPhaseWritten(3, [['Send the receipt', '§1.2'], ['Name the charge', '§2.1']]);
    recorded({ can_now: [], findings: [RECEIPT, { area: '2-refunds', scope: 'in', call: 'bug', text: 'A refund names no charge.', from: ['2-refunds-b#1'], fix: '3.2' }] });
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    fixClosed(3, 2);
    const merging = enter().sections;
    git(dir, ['commit', '-q', '--allow-empty', '-m', `feat(${UNIT}): landed`, '-m', `Task: ${UNIT}-3-1`]);

    const unnamed = `reads: not yet named — once round 1's fix tasks are done and their phase has merged, review reads ${UNIT} names them from what those changed, among them 1-cards, 2-refunds`;
    assert.strictEqual(merging, data(['round: round 2', ...AREA_LINES, unnamed, `merge waiting: phase 3 waits at its gate: render phase-merge-gate ${UNIT} 3`, BASE_LINE, reportLine(1), ...readsAfter()]));
    assert.strictEqual(enter().sections, data(['round: round 2', ...AREA_LINES, unnamed, BASE_LINE, reportLine(1), ...readsAfter()]));
  });

  it('a fix task closed waits on nothing — in step, no merge of its phase either', () => {
    inStep();
    firstRoundFailed();
    fixClosed(3, 1);

    const unnamed = `reads: not yet named — once round 1's fix tasks are done and their phase has merged, review reads ${UNIT} names them from what those changed, among them 1-cards`;
    assert.strictEqual(enter().sections, data(['round: round 2', ...AREA_LINES, unnamed, BASE_LINE, reportLine(1), ...readsAfter()]));
  });

  it('once a round passes with no fix task, the review phase is over, finish next, and nothing is read', () => {
    enter();
    reported(1, EVERY);
    recorded({ can_now: ['Pay by card.'], findings: [] });

    assert.strictEqual(enter().sections, data(['round: the review phase passed in round 1 — finish is next', ...AREA_LINES, BASE_LINE, reportLine(1), ...readsAfter()]));
  });

  it('13.4.4: a round passing with nits fixed in its fix phase ends the review phase once their fix tasks are done, no area read again for them', () => {
    enter();
    reported(1, EVERY, { '2-refunds-b': ['nit: A refund\'s label is terse.'] });
    fixPhaseWritten(3, [['Word the label', '§2.1']]);
    const res = recorded({ can_now: ['Pay by card.'], findings: [{ area: '2-refunds', scope: 'in', call: 'nit', text: 'A refund\'s label is terse.', from: ['2-refunds-b#1'], fix: '3.1' }] });
    const building = enter().sections;
    const again = refusedRound({ can_now: [], findings: [] });
    fixBuilt(3, 1, 'Word the label', 'main', 'src/label.js');

    assert.deepStrictEqual(res, { ok: true, round: 1, passed: true, fixes: ['3.1'], ends: true, fix_phase: 3, areas: AREAS, committed: res.committed });
    assert.strictEqual(again, `review round: ${UNIT}'s review phase passed in round 1 — its fix tasks are built, then finish: task 3.1 not started`);
    assert.strictEqual(building, data([
      'round: the review phase passed in round 1 — its fix tasks are built, then finish', ...AREA_LINES, fixPhaseLine(3, 1, 'built'), 'fix task waiting: 3.1 not started', BASE_LINE, reportLine(1), ...readsAfter(),
    ]));
    assert.strictEqual(enter().sections, data(['round: the review phase passed in round 1 — finish is next', ...AREA_LINES, BASE_LINE, reportLine(1), ...readsAfter()]));
  });
});

describe('the questions waiting on the person (12.13.22)', () => {
  it('names each waiting, with the task it parks or none', async () => {
    firstRoundFailed();
    await raisedAtReview('Should a receipt be sent by email?', '3.1');
    await raisedAtReview('Should a refund send a receipt too?');

    assert.deepStrictEqual(enter().sections.split('\n').filter((line) => line.startsWith('waiting: ')), [
      'waiting: Q1 — Should a receipt be sent by email? — parks task 3.1',
      'waiting: Q2 — Should a refund send a receipt too? — parks no task',
    ]);
  });

  it('reads them from the ledger alone while nothing is in flight: an idle entry runs no more git than its own reads need', () => {
    firstRoundFailed();
    enter();
    const { commands } = traced(() => enter());

    assert.ok(commands.length <= IDLE_ENTRY, `an idle entry ran ${commands.length} git commands:\n${commands.join('\n')}`);
  });
});

describe('the recovery note (24.2.2)', () => {
  it('mid-review, asked for by its session id with none of the caller\'s own, re-reads the review\'s skill, the record\'s call, each round\'s report, the spec, the build\'s log and where the review stands', () => {
    firstRoundFailed();
    fs.mkdirSync(path.join(dir, '.claude/skills/leeway-review-process'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude/skills/leeway-review-process/SKILL.md'), '# The review\n');
    writeState(dir, `${UNIT}/build/log.md`, '# The build\n\nPhase 3: 3.1 not started.\n');
    enter();
    const note = output(dir, ['conversation', 'position', SESSION_ID], { env: { ...env(), CLAUDE_CODE_SESSION_ID: '' } });

    for (const line of [
      `- ${path.join(dir, '.claude/skills/leeway-review-process/SKILL.md')} and its framework`, `- \`${ENGINE} ledger record ${UNIT}\``,
      ...[`${UNIT}/review/round-1.md`, `${UNIT}/spec.md`, `${UNIT}/build/log.md`].map((rel) => `- ${statePath(dir, rel)}\n`),
      `\nround: round 2\n${AREA_LINES.join('\n')}\n${UNNAMED}\n${fixPhaseLine(3, 1, 'built')}\nfix task waiting: 3.1 not started\n`,
    ]) {
      assert.ok(note.includes(line), `the note names ${line}\n${note}`);
    }
  });
});
