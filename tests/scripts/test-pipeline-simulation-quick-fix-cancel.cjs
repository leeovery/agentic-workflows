'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's quick-fix cancelled mid-fix (18.3.9, 19.5.29):
// one fix done, its pull request open, and the next holding work not
// committed; the cancel through its confirm from inside the quick-fix's
// session — what the holder had not committed set aside, the checkout
// taken back, the pull request closed and the branch kept — and its
// receipt; then reactivated, the held fix started again, its work put
// back, built and done, and the close landing both. The cancel's own rules
// are test-engine-landing-conformance-quick-fix-nested-cancel.cjs's.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { git } = require('./engine-harness.cjs');
const { Sim, answerGate, startUnit, writeTasks, finishClosed, fixBuilt } = require('./pipeline-world.cjs');

describe('pipeline simulation: quick-fix cancelled mid-fix', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('quick-fix: cancelled with a fix done and the next holding work not committed — the work set aside, the checkout taken back, the receipt naming both; reactivated, the work put back, the fix built, and the close landing both', () => {
    const wu = 'typo';
    startUnit(sim, 'quick-fix', wu, 'The --color flag is spelt --colour');
    sim.run(['enter', 'implementation', wu]);
    /** Fix `title` written: its task. @param {string} title */
    const written = (title) => writeTasks(sim, wu, 1, [{ title, type: 'fix', reference: 'none', scenarios: [`Given the ${title.split(' ')[2]}, when it is read, then it names --colour.`] }])[0];

    const flag = written('Spell the flag --colour');
    sim.run(['task', 'start', wu, flag]);
    fixBuilt(sim, wu, flag, ['src/flag.js'], { record: 'The flag.' });
    const help = written('Spell the help --colour');
    sim.run(['task', 'start', wu, help]);
    sim.run(['brief', 'builder', wu, help]);
    sim.write('src/help.js', '--colour\n');

    sim.render(['cancel-gate', wu], { expect: 'content' });
    const cancelled = sim.run(answerGate(sim, 'cancel gate', '--pick', 'y').next.argv);
    sim.render(['workunit-receipt', wu, '--verb', 'cancel'], { expect: 'content' });
    const left = git(sim.dir, ['branch', '--show-current']).trim();

    sim.run(['workunit', 'reactivate', wu]);
    sim.run(['enter', 'implementation', wu]);
    const started = sim.run(['task', 'start', wu, help]);
    fixBuilt(sim, wu, help, ['src/help.js'], { record: 'The help.' });
    sim.write(`.ledger/${wu}/build/log.md`, '# The fixes\n');
    finishClosed(sim, wu);
    sim.render(['finish', wu], { expect: 'content' });
    const yes = sim.run(answerGate(sim, 'finish', '--pick', 'y').next.argv);

    assert.deepStrictEqual([cancelled.checkout, left, started.put_back], ['main', 'main', ['src/help.js']]);
    assert.deepStrictEqual([yes.landed.map((/** @type {{merged: string[]}} */ { merged }) => merged), sim.manifest(wu).status], [[[flag, help]], 'completed']);
  });
});
