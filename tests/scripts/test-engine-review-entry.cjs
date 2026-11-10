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
// its entry where none is held, never by entering again (14.1.5); and each
// question waiting on the person, by the ledger alone, the build's standing
// read only while something is in flight, so an idle entry's cost stays
// flat (12.13.22). Its answer and the recovery note are
// test-engine-review-entry-answer.cjs's; a fix task in flight there, taken
// over at the entry, test-engine-review-fix-tasks.cjs's.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const { traced } = require('./engine-harness.cjs');
const {
  UNIT, inStep, useWorld, env, enter, named, recorded, firstRoundFailed, cutUnmerged, fixBuilt, raisedAtReview,
  ok, okSections, refusedPristine, statePath, git, stateGit, assert,
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

// The most git commands an entry runs with nothing in flight, waiting on a
// fix task: its own reads, nine of them; reading the build's standing too
// would more than double them.
const IDLE_ENTRY = 12;

describe('enter review: what cannot be entered is refused, naming the way on, and nothing is written', () => {
  it('a build whose cut has a phase not closed, naming it or each of them, a quick-fix, whose review the person has not asked for, what the build\'s entry refuses — a unit built under the old plan, a build not begun — and a topic named (14.6.1, 19.5.14)', () => {
    assert.deepStrictEqual([refused(['half']), refused(['open']), refused(['tweak']), refused(['old']), refused(['fresh']), refused([UNIT, 'cards'])], [
      'half\'s review phase starts once every phase of its cut has closed — phase 2 of 2 has not: enter implementation half',
      'open\'s review phase starts once every phase of its cut has closed — phases 1, 2 of 2 have not: enter implementation open',
      'tweak is a quick-fix, whose review runs only once the person asks for one at its close — render finish tweak draws it',
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

describe('the questions waiting on the person (12.13.22)', () => {
  it('names each waiting, with the task it parks or none, read from the ledger alone while nothing is in flight: an idle entry runs no more git than its own reads need', async () => {
    firstRoundFailed();
    await raisedAtReview('Should a receipt be sent by email?', '3.1');
    await raisedAtReview('Should a refund send a receipt too?');
    const lines = enter().sections.split('\n').filter((line) => line.startsWith('waiting: '));
    const { commands } = traced(() => enter());

    assert.deepStrictEqual(lines, [
      'waiting: Q1 — Should a receipt be sent by email? — parks task 3.1',
      'waiting: Q2 — Should a refund send a receipt too? — parks no task',
    ]);
    assert.ok(commands.length <= IDLE_ENTRY, `an idle entry ran ${commands.length} git commands:\n${commands.join('\n')}`);
  });
});
