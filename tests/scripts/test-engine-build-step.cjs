'use strict';

// ---------------------------------------------------------------------------
// Step's one task at a time (leeway-engine/scripts/domain/task-verbs.cjs,
// 12.7.9): task start refused beside the task in flight; and where more
// than one goes on — an answer freeing one while another went on, or two
// left running in auto — the one in flight the one that went back in flight
// first, by when each was last freed (task-parks.cjs): an answer to its
// question, a merge or a move of it, a replacement or a keep of the decision
// it would replace. The others are held behind it in the answer's receipt
// (questions.cjs), their gate (build-screens.cjs) and their briefs
// (brief.cjs). The gates themselves are test-engine-build-gates.cjs.
//
// Layer: verb. World: the build screens' world (build-screens-world.cjs),
// built once and copied; a test that needs a phase of the review's fixes
// writes phase 4 past the cut.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ok, okSections, refusedPristine, cleanupFixture, sectionOf, ledgerEntries, statePath } = require('./engine-harness.cjs');
const { UNIT, CALL, ACCOUNT_DRAWN, taskText, buildScreensWorld, buildScreenHelpers } = require('./build-screens-world.cjs');
const { SESSION, raiseHelpers } = require('./raise-world.cjs');
const { MADE } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { appendEntry } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));

let dir = ''; // the project
let config = ''; // the system config: the conversations' folders

beforeEach(() => {
  dir = buildScreensWorld();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-build-step-config-'));
});

afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(config, { recursive: true, force: true });
});

const { env, screen, refused, position, parkOn, proposeOn } = buildScreenHelpers(() => dir, () => config);
const { conversation, answer } = raiseHelpers(() => dir, () => config, CALL);

/** The question `name` drawn and answered, its lean picked unless `pick` says: the answer's receipt. @param {string} name @param {string} [pick] */
const answered = (name, pick = '1') => answer(okSections(dir, ['raise', 'draw', UNIT, name], { env: conversation() }).res.raise, ['--pick', pick]).receipt;

/** The ledger's events, in its order. */
const events = () => ledgerEntries(statePath(dir));

/** The full id of the question parked as `Q{number}`. @param {number} number */
const parkedQuestion = (number) => events().find((e) => e.event === 'parked' && e.number === number).question;

/** The full id of the last decision made for `task`. @param {string} task */
const decidedFor = (task) => events().findLast((e) => e.event === 'decided' && e.task === task).id;

/** A ledger write of Claude's in the build, which must land. @param {string} verb @param {string[]} flags @param {object} [content] */
const written = (verb, flags, content = {}) => ok(dir, ['ledger', verb, `${UNIT}.implementation`, ...flags], { env: env(), stdin: JSON.stringify({ ...MADE, ...content }) });

/**
 * Ways a question stops waiting with no answer of its own, each given its
 * full id: merged into the answer to Q2, or moved to the roadmap as a
 * clone's merge lays it, the build itself having no topic to move one from.
 * @type {Array<[string, (question: string) => void]>}
 */
const UNANSWERED_ENDS = [
  ['merged into another\'s answer', (question) => written('merge', ['--question', question, '--into', decidedFor('1.2')])],
  ['moved to the roadmap', (question) => appendEntry(statePath(dir), { event: 'moved', unit: UNIT, topic: null, phase: 'implementation', session: SESSION, ...MADE, question, to: 'roadmap:refunds' }, [])],
];

/** Why `task start` refuses the task, writing nothing. @param {string} task */
const startRefused = (task) => refusedPristine(dir, ['task', 'start', UNIT, task], { env: env() }).error;

/** The refusal of task start beside the task in flight. @param {string} task */
const beside = (task) => `task start: pay builds in step, one task at a time — task ${task} is in flight or at its gate, and the next starts once the person's go there is given and it is done`;

/** The refusal of a task held behind the one in flight, as `said` opens it. @param {string} said @param {string} inFlight @param {string} task */
const behind = (said, inFlight, task) => `${said}: pay builds in step, one task at a time — task ${inFlight} is in flight, and task ${task} goes on once it is done`;

/** Q1 parks 1.1, 1.2 starts beside it, then Q2 parks 1.2: nothing goes on. */
async function bothParked() {
  await parkOn(['1.1']);
  ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });
  await parkOn(['1.2'], 1);
}

describe('task start in step: one task at a time (12.7.9)', () => {
  it('refuses a task while another of the unit\'s is in flight or at its gate, writing nothing; in auto both start (12.S52)', () => {
    const error = startRefused('1.2');
    position('auto');

    assert.strictEqual(error, beside('1.1'));
    assert.strictEqual(ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() }).task, '1.2');
  });

  it('holds the next while a task of the review\'s fixes past the cut is in progress, started in another conversation, writing nothing', () => {
    ok(dir, ['task', 'done', UNIT, '1.1'], { env: env() });
    ok(dir, ['task', 'phase', UNIT, '4', '--title', 'Fixes'], { env: env() });
    for (const title of ['Mask the reprint', 'Mask the copy']) {
      fs.writeFileSync(path.join(config, 'fix.md'), taskText(title, [`${title} works.`]));
      ok(dir, ['task', 'create', UNIT, '4', '--file', path.join(config, 'fix.md')], { env: env() });
    }
    ok(dir, ['task', 'start', UNIT, '4.1'], { env: { ...env(), CLAUDE_CODE_SESSION_ID: 'sess-2' } });

    assert.strictEqual(startRefused('4.2'), beside('4.1'));
  });

  it('starts the next while a question parks the task in flight — a parked task holds nothing new to test — and starts the task in flight again; the next waits on the one then in flight', async () => {
    ok(dir, ['task', 'start', UNIT, '1.1'], { env: env() });
    await parkOn(['1.1']);
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });

    assert.strictEqual(startRefused('1.3'), beside('1.2'));
  });
});

describe('the task in flight where more than one goes on (12.7.9)', () => {
  it('holds a task an answer freed while another went on behind it: the receipt says it builds again once that one is done, its gate and its briefs refused until then and the next task\'s start naming the one in flight — whose gate draws — then the freed task\'s gate draws once it is done', async () => {
    await parkOn(['1.1']);
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });
    const receipt = answered('Q1');
    const held = [refused(['step-gate', UNIT, '1.1']), refusedPristine(dir, ['brief', 'reviewer', UNIT, '1.1', '--base', 'main', '--letter', 'a'], { env: env() }).error];
    const next = startRefused('1.3');
    const inFlight = sectionOf(screen(['step-gate', UNIT, '1.2']), 'DISPLAY: step gate');
    ok(dir, ['task', 'done', UNIT, '1.2'], { env: env() });

    assert.strictEqual(receipt, 'Q1 answered · task 1.1 builds again once task 1.2 is done · nothing waiting on you');
    assert.deepStrictEqual(held, [behind('render step-gate', '1.2', '1.1'), behind('brief', '1.2', '1.1')]);
    assert.strictEqual(next, beside('1.2'));
    assert.match(inFlight, /^▪ Show a receipt \(task 1\.2\)/);
    assert.strictEqual(sectionOf(screen(['step-gate', UNIT, '1.1']), 'DISPLAY: step gate'), `${ACCOUNT_DRAWN}\n`);
  });

  it('reads the task in flight by when an answer freed each, not by when each parked: the questions answered newest first, the task parked last goes on first, its gate drawing and the other held behind it', async () => {
    await bothParked();
    const first = answered('Q2');
    const second = answered('Q1');

    assert.deepStrictEqual([first, second], [
      'Q2 answered · task 1.2 builds again · 1 waiting on you',
      'Q1 answered · task 1.1 builds again once task 1.2 is done · nothing waiting on you',
    ]);
    assert.match(sectionOf(screen(['step-gate', UNIT, '1.2']), 'DISPLAY: step gate'), /^▪ Show a receipt \(task 1\.2\)/);
    assert.strictEqual(refused(['step-gate', UNIT, '1.1']), behind('render step-gate', '1.2', '1.1'));
  });

  it('answered newest first after a third task ran and finished while both waited, the task parked last still goes on first', async () => {
    await bothParked();
    ok(dir, ['task', 'start', UNIT, '1.3'], { env: env() });
    ok(dir, ['task', 'done', UNIT, '1.3'], { env: env() });
    answered('Q2');

    assert.strictEqual(answered('Q1'), 'Q1 answered · task 1.1 builds again once task 1.2 is done · nothing waiting on you');
  });

  for (const [pick, how] of [['keep', 'keep of the decision'], ['1', 'replacement of it']]) {
    it(`a task parked on a replacement proposed goes back in flight at the person's ${how}, as one parked on a question does at its answer`, async () => {
      await proposeOn('1.1');
      ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });
      await parkOn(['1.2'], 1);
      answered('Q2');

      assert.strictEqual(answered('Q1', pick), 'Q1 answered · task 1.1 builds again once task 1.2 is done · nothing waiting on you');
    });
  }

  for (const [how, end] of UNANSWERED_ENDS) {
    it(`a task whose question is ${how} goes back in flight there, behind the one an answer freed before`, async () => {
      await bothParked();
      answered('Q2');
      end(parkedQuestion(1));

      assert.strictEqual(refused(['step-gate', UNIT, '1.1']), behind('render step-gate', '1.2', '1.1'));
    });
  }

  it('a task whose answer is replaced later went back in flight at the answer, ahead of the one an answer freed after it', async () => {
    await bothParked();
    answered('Q1');
    answered('Q2');
    written('replace', ['--replaces', decidedFor('1.1'), '--reason', 'was-wrong'], { text: 'A refund prints a slip.', why: 'A slip is shorter.', drops: [] });

    assert.strictEqual(refused(['step-gate', UNIT, '1.2']), behind('render step-gate', '1.1', '1.2'));
  });

  it('a task parked again on a replacement of the decision it was freed by keeping goes back in flight at the second keep, not the first', async () => {
    await proposeOn('1.1');
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });
    await parkOn(['1.2'], 1);
    answered('Q1', 'keep');
    await proposeOn('1.1');
    answered('Q2');

    assert.strictEqual(answered('Q3', 'keep'), 'Q3 answered · task 1.1 builds again once task 1.2 is done · nothing waiting on you');
  });

  it('a task freed, parked again and freed once more goes behind the one an answer freed meanwhile', async () => {
    await bothParked();
    answered('Q1');
    await parkOn(['1.1'], 2);
    answered('Q2');

    assert.strictEqual(answered('Q3'), 'Q3 answered · task 1.1 builds again once task 1.2 is done · nothing waiting on you');
  });

  it('frees the tasks one answer parked one at a time, in the tracker\'s order; in auto each builds again at once', async () => {
    await parkOn(['1.1']);
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });
    await parkOn(['1.2']);
    const receipt = answered('Q1');
    const held = refused(['step-gate', UNIT, '1.2']);
    position('auto');
    await parkOn(['1.1', '1.2'], 1);

    assert.strictEqual(receipt, 'Q1 answered · their tasks build again, task 1.1 first · nothing waiting on you');
    assert.strictEqual(held, behind('render step-gate', '1.1', '1.2'));
    assert.strictEqual(answered('Q2'), 'Q2 answered · their tasks build again · nothing waiting on you');
  });

  it('switched from auto to step with two tasks running, the first in the tracker\'s order goes on and the other is held behind it', () => {
    position('auto');
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });
    position('step');

    assert.strictEqual(refused(['step-gate', UNIT, '1.2']), behind('render step-gate', '1.1', '1.2'));
    assert.strictEqual(sectionOf(screen(['step-gate', UNIT, '1.1']), 'DISPLAY: step gate'), `${ACCOUNT_DRAWN}\n`);
  });
});
