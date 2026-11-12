'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's quick-fix with a fix held open while its blind
// question waits (16.17.6), the decision point forced to draw blind: the
// fix's builder's call cheap to undo going ahead, its question parking
// none, the fix held once its pair passes it; the next fix started in the
// checkout, its work not yet committed. The next fix keeps the checkout —
// committing its work, the held fix waiting behind it — once the person
// answers, and once a change to the held fix lifts the hold. And the held
// fix changed again while its pair re-reads the first change keeps the
// checkout, a change read only by a round briefed after it (12.1.4). A fix
// parked by a question asked is test-pipeline-simulation-quick-fix-parked.cjs's.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const {
  Sim, startUnit, writeTasks, landed, placeIn, wentAheadBlind, pickedRow, PASSED_REPORT,
} = require('./pipeline-world.cjs');

const WU = 'typo';
const CALL = Object.freeze({ question: 'Does --color stay as an alias?', lean: 'Yes.', other: 'No.' });
const BEHIND = /^brief: typo builds in its one checkout, one task at a time — task 1\.2 is in flight, and task 1\.1 goes on once task 1\.2 is done or closed, or a question parks it$/;

describe('pipeline simulation: quick-fix with a fix held open on its blind question', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  /** Fix `title` written: its task. @param {string} title */
  const written = (title) => writeTasks(sim, WU, 1, [{ title, type: 'fix', reference: 'none', scenarios: [`Given the ${title.split(' ')[2]}, when it is read, then it names --colour.`] }])[0];

  /** `file` written and committed under `fix`, then pushed to the quick-fix's pull request. @param {string} fix @param {string} file @param {string} text */
  function pushed(fix, file, text) {
    sim.write(file, text);
    sim.run(['commit', '--paths', file, '--task', WU, fix, '-m', `fix(${WU}): task ${fix}`]);
    sim.run(['land', 'open', WU, fix]);
  }

  /** Something added to `fix` by the orchestrator. @param {string} fix @param {string} text */
  const added = (fix, text) => sim.run(['task', 'add', WU, fix, '--file', sim.write(`.leeway/.cache/${WU}/build/addition.md`, `${text}\n`), '--by', 'orchestrator']);

  /**
   * The flag's fix built and pushed, its builder's call going ahead while
   * its blind question, Q1, waits, and its pair passing it, so it is held:
   * the fix. @param {import('node:test').TestContext} t
   */
  async function heldFlag(t) {
    startUnit(sim, 'quick-fix', WU, 'The --color flag is spelt --colour');
    sim.run(['enter', 'implementation', WU]);
    const flag = written('Spell the flag --colour');
    sim.run(['task', 'start', WU, flag]);
    sim.run(['brief', 'builder', WU, flag]);
    pushed(flag, 'src/flag.js', '--colour\n');
    await wentAheadBlind(t, sim, WU, flag, CALL);
    for (const letter of ['a', 'b']) landed(placeIn(sim, sim.run(['brief', 'reviewer', WU, flag, '--letter', letter]), 'Where your report goes'), PASSED_REPORT);
    return flag;
  }

  /** The flag's fix held, then the help's started in the checkout, its work not yet committed: the two fixes. @param {import('node:test').TestContext} t */
  async function heldWithHelpStarted(t) {
    const flag = await heldFlag(t);
    const help = written('Spell the help --colour');
    sim.run(['task', 'start', WU, help]);
    sim.run(['brief', 'builder', WU, help]);
    sim.write('src/help.js', '--colour\n');
    return { flag, help };
  }

  /** The help's fix keeping the checkout: its work committed under it, the flag's builder refused behind it. @param {{flag: string, help: string}} fixes */
  function helpKeepsTheCheckout({ flag, help }) {
    sim.run(['commit', '--paths', 'src/help.js', '--task', WU, help, '-m', `fix(${WU}): spell the help --colour`]);
    sim.refuses(['brief', 'builder', WU, flag], BEHIND);
  }

  it('16.17.6: the person\'s answer frees the held fix behind the one started in the checkout while it was held — that fix committing its work, the held fix waiting until it is done', async (t) => {
    const fixes = await heldWithHelpStarted(t);

    assert.strictEqual(pickedRow(sim, WU, 'Q1', CALL.lean), 'Q1 answered · task 1.1 builds again as built once task 1.2 is done or closed, or a question parks it · nothing waiting on you');
    helpKeepsTheCheckout(fixes);
  });

  it('16.17.6: something added to the held fix lifts its hold, freeing it behind the one started in the checkout while it was held — that fix committing its work, the held fix waiting until it is done', async (t) => {
    const fixes = await heldWithHelpStarted(t);

    added(fixes.flag, 'Keep --color as an alias.');

    helpKeepsTheCheckout(fixes);
  });

  it('12.1.4, 16.17.6: the held fix changed again while its pair re-reads the first change keeps the checkout: the next fix\'s start refused', async (t) => {
    const flag = await heldFlag(t);
    added(flag, 'Keep --color as an alias.');
    sim.run(['brief', 'builder', WU, flag]);
    pushed(flag, 'src/alias.js', '--color\n');
    sim.run(['brief', 'reviewer', WU, flag, '--letter', 'a']);

    added(flag, 'Warn when --color is used.');

    sim.refuses(['task', 'start', WU, written('Spell the help --colour')], /task 1\.1 is in flight, and task 1\.2 starts once it is done or closed, or a question parks it$/);
  });
});
