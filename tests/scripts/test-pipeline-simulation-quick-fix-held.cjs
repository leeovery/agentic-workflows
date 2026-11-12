'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's quick-fix with a fix held open while its blind
// question waits (16.17.6), the decision point forced to draw blind: the
// fix's builder's call cheap to undo going ahead, its question parking
// none, the fix held once its pair passes it; the next fix started in the
// checkout, its work not yet committed. The next fix keeps the checkout —
// committing its work, the held fix waiting behind it — once the person
// answers, and once a change to the held fix lifts the hold. A fix parked
// by a question asked is test-pipeline-simulation-quick-fix-parked.cjs's.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  Sim, startUnit, writeTasks, landed, placeIn, PASSED_REPORT,
} = require('./pipeline-world.cjs');
const { leaningCall } = require('./ledger-world.cjs');
const { labelAnswers } = require('./labels.cjs');

const decisionPoint = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/decision-point.cjs'));
const { RAISE_SHOWN } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/gate.cjs'));

const WU = 'typo';
const PLACE = `${WU}.implementation`;
const QUESTION = 'Does --color stay as an alias?';
const LEAN = 'Yes.';
const BEHIND = /^brief: typo builds in its one checkout, one task at a time — task 1\.2 is in flight, and task 1\.1 goes on once task 1\.2 is done or closed, or a question parks it$/;

describe('pipeline simulation: quick-fix with a fix held open on its blind question', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  /** Fix `title` written: its task. @param {string} title */
  const written = (title) => writeTasks(sim, WU, 1, [{ title, type: 'fix', reference: 'none', scenarios: [`Given the ${title.split(' ')[2]}, when it is read, then it names --colour.`] }])[0];

  /**
   * The decision point drawing blind for test `t`, the question labelled
   * behaviour, cheap to undo; the flag's fix built and committed, its
   * builder's call going ahead while its question, Q1, waits, and its pair
   * passing it, so it is held; then the help's fix started in the checkout,
   * its work not yet committed: the two fixes.
   * @param {import('node:test').TestContext} t
   */
  async function heldWithHelpStarted(t) {
    t.mock.method(decisionPoint, 'decide', () => ({ decision: 'blind', reason: 'Asked cold.' }));
    sim.env = { ...sim.env, CLAUDE_STUB_ANSWERS: JSON.stringify({ [QUESTION]: labelAnswers('behaviour'), '': 'no-login' }) };
    startUnit(sim, 'quick-fix', WU, 'The --color flag is spelt --colour');
    sim.run(['enter', 'implementation', WU]);
    const flag = written('Spell the flag --colour');
    sim.run(['task', 'start', WU, flag]);
    sim.run(['brief', 'builder', WU, flag]);
    sim.write('src/flag.js', '--colour\n');
    sim.run(['commit', '--paths', 'src/flag.js', '--task', WU, flag, '-m', `fix(${WU}): spell the flag --colour`]);
    sim.run(['land', 'open', WU, flag]);
    const asked = sim.run(['ledger', 'ask', PLACE, '--task', flag], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: QUESTION })).id;
    const drawn = await sim.runAsync(['raise', PLACE, '--answers', asked, '--parks', flag], null, JSON.stringify({ ...leaningCall(LEAN, 'No.'), question: QUESTION }));
    assert.deepStrictEqual([drawn.decision, drawn.task], ['blind', null], 'the call goes ahead, its question parking no fix');
    for (const letter of ['a', 'b']) landed(placeIn(sim, sim.run(['brief', 'reviewer', WU, flag, '--letter', letter]), 'Where your report goes'), PASSED_REPORT);

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

    const { raise } = sim.run(['raise', 'draw', WU, 'Q1']);
    const seals = JSON.parse(fs.readFileSync(path.join(sim.configDir, 'conversations', sim.env.CLAUDE_CODE_SESSION_ID, RAISE_SHOWN), 'utf8'));
    const { key } = seals[raise].call.rows.find((/** @type {{text: string}} */ row) => row.text === LEAN);
    assert.strictEqual(sim.run(['raise', 'answer', raise, '--pick', key], null, JSON.stringify({ why: 'Old scripts pass it.' })).receipt,
      'Q1 answered · task 1.1 builds again as built once task 1.2 is done or closed, or a question parks it · nothing waiting on you');
    helpKeepsTheCheckout(fixes);
  });

  it('16.17.6: something added to the held fix lifts its hold, freeing it behind the one started in the checkout while it was held — that fix committing its work, the held fix waiting until it is done', async (t) => {
    const fixes = await heldWithHelpStarted(t);

    sim.run(['task', 'add', WU, fixes.flag, '--file', sim.write(`.leeway/.cache/${WU}/build/addition.md`, 'Keep --color as an alias.\n'), '--by', 'orchestrator']);

    helpKeepsTheCheckout(fixes);
  });
});
