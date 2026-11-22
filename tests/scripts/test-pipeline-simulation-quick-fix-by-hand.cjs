'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's quick-fix merged by hand mid-set: three fixes on
// its one branch through its one pull request, each fix's short record
// written, the pull request merged by hand and the branch cut again for the
// fix after it, whose share in the project's nested clone the door records
// on the unit's manifest before it commits there, and the unit closed,
// landing it there too (19.5.6, 19.5.15, R14, R18), the board drawing its
// close waiting and then following the session to All work (20.14); the
// quick-fix opened in the product's conversation, which its yes left open,
// its close carrying on in the conversation, nothing cleared, back in the
// product's conversation, its talk going on in the same session and log
// (8.14.11). The
// quick-fix opened and closed in its skill is
// test-pipeline-simulation-quick-fix.cjs's.
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
  Sim, answerGate, startUnit, writeTasks, finishClosed, fixBuilt, carryOn, presenceRow,
} = require('./pipeline-world.cjs');
const { git } = require('./engine-harness.cjs');

describe('pipeline simulation: quick-fix merged by hand', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('quick-fix: three fixes built in the quick-fix\'s worktree on its one branch, each passed by its pair, recorded, pushed to its one pull request and done; the pull request merged by hand mid-set, the fix after it on the branch cut again, its share in the nested clone recorded; and the close landing what is left in one commit naming the fix it holds in each, no handoff before it (24.S8), then carrying on in the conversation back in the product\'s, whose talk goes on in the session the quick-fix was opened from', () => {
    const wu = 'typo';
    const branch = `fix/${wu}`;
    startUnit(sim, 'quick-fix', wu, 'The --color flag is spelt --colour');
    const handedOff = sim.handoffs.length;
    assert.strictEqual(sim.run(['enter', 'implementation', wu]).entered, true);
    const base = git(sim.dir, ['rev-parse', 'main']).trim();
    /** Fix `n` written, started and built: its start's answer. @param {number} n @param {string} title @param {string[]} files */
    const built = (n, title, files) => {
      const [fix] = writeTasks(sim, wu, 1, [{ title, type: 'fix', reference: 'none', scenarios: [`${n}.S1 Given the help, when it is read, then it names --colour.`] }]);
      const started = sim.run(['task', 'start', wu, fix]);
      fixBuilt(sim, wu, fix, files, { record: `${title}.` });
      return started;
    };
    const first = built(1, 'Spell the flag --colour', ['src/flag.js']);
    built(2, 'Spell the help --colour', ['src/help.js']);
    // The person merges the pull request by hand mid-set, a squash on main,
    // which their checkout has out.
    git(sim.dir, ['merge', '-q', '--squash', branch]);
    git(sim.dir, ['commit', '-q', '-m', 'Spell it the British way']);
    const third = built(3, 'Spell the docs --colour', ['docs/flags.md', 'api/flags.md']);
    const recorded = sim.manifest(wu).fixes.repos;
    sim.write(`.ledger/${wu}/build/log.md`, '# The fixes\n');
    finishClosed(sim, wu);
    sim.render(['finish', wu], { expect: 'content' });
    const closing = sim.run(['board', sim.env.CLAUDE_CODE_SESSION_ID]).view;
    const unclosed = sim.handoffs.slice(handedOff);
    const yes = sim.run(answerGate(sim, 'finish', '--pick', 'y').next.argv);
    const receipt = sim.sections;
    const closed = sim.run(['board', sim.env.CLAUDE_CODE_SESSION_ID]);
    const conversation = sim.conversations;
    const back = carryOn(sim);
    const row = presenceRow(sim.run(['presence', 'scan', 'product']), 'discovery', 'product');

    assert.deepStrictEqual([first.branch, third.branch, third.cut_again?.map((/** @type {any} */ { replayed }) => replayed)], [branch, branch, [[]]]);
    assert.deepStrictEqual([recorded, yes.landed.map((/** @type {{repo: string, merged: string[]}} */ { repo, merged }) => [repo, merged]), yes.next, yes.back_to], [
      ['api'], [['api', ['1.3']], ['.', ['1.3']]], { kind: 'invoke', skill: 'ledger-discovery', args: ['none', 'none'] }, 'product',
    ], 'the close goes back into the product\'s conversation by its entry');
    assert.match(receipt, /^=== DISPLAY: ended .*\n✓ Typo · quick-fix · complete$/m, 'its receipt the done line the board no longer shows (D38)');
    assert.deepStrictEqual([back.position, sim.conversations, sim.manifest('.').product_session], [{ name: 'product' }, conversation, '001'], 'the close carries on in the conversation, back in the product\'s, its talk in the session the yes left open');
    assert.strictEqual(row?.session_id, sim.env.CLAUDE_CODE_SESSION_ID, 'its presence row in the product\'s conversation stands');
    assert.deepStrictEqual(git(sim.api, ['log', '-1', '--format=%B', 'main']).match(/^Task: .*$/gm), [`Task: ${wu}-1-3`]);
    assert.strictEqual(sim.manifest(wu).status, 'completed');
    assert.deepStrictEqual(unclosed, [], 'no handoff from the opener to the close (24.S8)');
    assert.deepStrictEqual([closing.kind, closing.standing, closing.progress, closing.record.map((/** @type {{title: string}} */ { title }) => title), closed.view.kind, closed.banner.state, closed.banner.facts.map((/** @type {{text: string}} */ { text }) => text)], [
      'quick-fix', 'close', { done: 3, total: 3, written: true }, ['Spell the flag --colour', 'Spell the help --colour', 'Spell the docs --colour'], 'all', 'idle', ['product'],
    ], 'the board draws the close waiting, then follows the session to All work, back in the product\'s conversation');
    assert.deepStrictEqual([git(sim.dir, ['log', '--format=%s', `${base}..main`]).trim().split('\n'), git(sim.dir, ['log', '-1', '--format=%B', 'main']).match(/^Task: .*$/gm)], [
      [`fix(${wu}): The --color flag is spelt --colour`, 'Spell it the British way'], [`Task: ${wu}-1-3`],
    ]);
  });
});
