'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's quick-fix with a fix parked mid-build (19.5.23,
// 19.5.25): its builder's question parking it with a commit of its own and
// work not committed, which its park sets aside; the next fix built and
// done in the checkout it leaves clean; the parked fix freed, named back by
// `task ready`, started again — its work put back — and finished, its
// account's figures counting its own commits alone, the other fix's between
// them left out (task-base.cjs, `ownWork`); and the close landing both,
// with no handoff from the opener to the close (24.S8). The checkout's
// rules are test-engine-quick-fix-checkout.cjs's.
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
  Sim, answerGate, startUnit, writeTasks, finishClosed, fixBuilt,
} = require('./pipeline-world.cjs');
const { leaningCall } = require('./ledger-world.cjs');

describe('pipeline simulation: quick-fix with a fix parked', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('quick-fix: a fix parked holding a commit and work not committed sets it aside; the next fix built and done; the parked fix named back, its work put back and finished, its account counting its own commits alone; the close landing both, no handoff on the way', async () => {
    const wu = 'typo';
    const place = `${wu}.implementation`;
    startUnit(sim, 'quick-fix', wu, 'The --color flag is spelt --colour');
    const handedOff = sim.handoffs.length;
    sim.run(['enter', 'implementation', wu]);
    /** Fix `title` written: its task. @param {string} title */
    const written = (title) => writeTasks(sim, wu, 1, [{ title, type: 'fix', reference: 'none', scenarios: [`Given the ${title.split(' ')[2]}, when it is read, then it names --colour.`] }])[0];

    const flag = written('Spell the flag --colour');
    sim.run(['task', 'start', wu, flag]);
    sim.run(['brief', 'builder', wu, flag]);
    sim.write('src/flag.js', '--colour\n');
    sim.run(['commit', '--paths', 'src/flag.js', '--task', wu, flag, '-m', `fix(${wu}): spell the flag --colour`]);
    sim.write('src/alias.js', '--color\n');
    const asked = sim.run(['ledger', 'ask', place, '--task', flag], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Does --color stay as an alias?' })).id;
    const parked = await sim.runAsync(['raise', place, '--answers', asked, '--parks', flag], null, JSON.stringify({ ...leaningCall('Yes.', 'No.'), question: 'Does --color stay as an alias?' }));

    const help = written('Spell the help --colour');
    sim.run(['task', 'start', wu, help]);
    fixBuilt(sim, wu, help, ['src/help.js'], { record: 'The help.' });
    const drawn = sim.run(['raise', 'draw', wu, parked.parked]);
    sim.run(['raise', 'answer', drawn.raise, '--pick', '1'], null, JSON.stringify({ why: 'Old scripts pass it.' }));
    const back = sim.run(['task', 'ready', wu, '1']).back;
    const started = sim.run(['task', 'start', wu, flag]);
    fixBuilt(sim, wu, flag, ['src/alias.js'], { record: 'The flag.' });
    const account = sim.render(['task-account', wu, flag], { expect: 'content' });

    sim.write(`.leeway/${wu}/build/log.md`, '# The fixes\n');
    finishClosed(sim, wu);
    sim.render(['finish', wu], { expect: 'content' });
    const unclosed = sim.handoffs.slice(handedOff);
    const yes = sim.run(answerGate(sim, 'finish', '--pick', 'y').next.argv);

    assert.deepStrictEqual([parked.set_aside, back, started.put_back], [['src/alias.js'], flag, ['src/alias.js']]);
    assert.match(account, /✓ Proves 1 criterion · 2 files changed · \+2 −0\n/, 'its own two commits, the help\'s between them left out');
    assert.deepStrictEqual(unclosed, [], 'no handoff from the opener to the close (24.S8)');
    assert.deepStrictEqual([yes.landed.map((/** @type {{merged: string[]}} */ { merged }) => merged), sim.manifest(wu).status], [[[help, flag]], 'completed']);
  });
});
