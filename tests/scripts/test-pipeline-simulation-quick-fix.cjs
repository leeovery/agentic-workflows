'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's quick-fix, opened and closed in its own skill:
// the opener carrying on in place into the quick-fix's skill (24.1.3), its
// fixes built by their builders and passed by their pairs (19.5.22), each
// one's account its builder's, a builder's question parking its fix while
// the next goes on, answered and built (19.5.25), a question Claude raised
// in the conversation outliving a /clear and holding the close until it is
// answered again, and the close landing the one pull request. Its merge by
// hand is test-pipeline-simulation-quick-fix-by-hand.cjs's, its review
// test-pipeline-simulation-quick-fix-review.cjs's, its moves
// test-pipeline-simulation-quick-fix-move.cjs's.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const {
  Sim, answerGate, carryOn, startUnit, writeTasks, finishClosed, fixBuilt,
} = require('./pipeline-world.cjs');
const { leaningCall } = require('./ledger-world.cjs');

describe('pipeline simulation: quick-fix', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('quick-fix: the opener carries on into its skill in the same conversation; each fix passed by its pair; a builder\'s question parks its fix while the next goes on, then it is built; Claude\'s own question outlives a /clear, named by the entry and holding the close\'s checklist until it is answered again; and the close landing the one pull request, no handoff from the opener to the close (24.S8)', async () => {
    const wu = 'typo';
    const place = `${wu}.implementation`;
    const started = startUnit(sim, 'quick-fix', wu, 'The --color flag is spelt --colour');
    assert.deepStrictEqual(started.next, { kind: 'invoke', skill: 'leeway-quick-fix-process', args: ['quick-fix', wu] });
    const conversation = sim.env.CLAUDE_CODE_SESSION_ID;
    const handedOff = sim.handoffs.length;

    // Invoked in place: the skill's entry, in this conversation, records the
    // place, so a compaction carries on in the quick-fix's skill.
    assert.strictEqual(sim.run(['enter', 'implementation', wu]).entered, true);
    const here = carryOn(sim);
    assert.deepStrictEqual([here.position, here.skill], [
      { name: wu, phase: 'implementation', topic: wu }, path.join(sim.dir, '.claude/skills/leeway-quick-fix-process/SKILL.md'),
    ]);

    /** Fix `n` written as task 1.`n` and started: the task. @param {number} n @param {string} title */
    const begun = (n, title) => {
      const [fix] = writeTasks(sim, wu, 1, [{ title, type: 'fix', reference: 'none', scenarios: [`Given the ${title.split(' ')[2]}, when it is read, then it names --colour.`] }]);
      sim.run(['task', 'start', wu, fix]);
      return fix;
    };
    const first = fixBuilt(sim, wu, begun(1, 'Spell the flag --colour'), ['src/flag.js'], { record: 'The flag.' });
    const account = sim.render(['task-account', wu, first.task], { expect: 'content' });

    // The second fix's builder asks: its fix parks on the question, and the
    // third goes on.
    const asking = begun(2, 'Spell the help --colour');
    const asked = sim.run(['ledger', 'ask', place, '--task', asking], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Does the help keep --color as an alias?' })).id;
    const parked = await sim.runAsync(['raise', place, '--answers', asked, '--parks', asking], null, JSON.stringify({ ...leaningCall('Yes.', 'No.'), question: 'Does the help keep --color as an alias?' }));
    fixBuilt(sim, wu, begun(3, 'Spell the docs --colour'), ['docs/flags.md'], { record: 'The docs.' });
    const drawn = sim.run(['raise', 'draw', wu, parked.parked]);
    const receipt = sim.run(['raise', 'answer', drawn.raise, '--pick', '1'], null, JSON.stringify({ why: 'Old scripts pass it.' })).receipt;
    fixBuilt(sim, wu, asking, ['src/help.js'], { record: 'The help.' });

    // Claude's own question, raised in the conversation, parks nothing; the
    // conversation cleared and the quick-fix entered again, the close is
    // refused over it until it is raised again and answered.
    const own = sim.run(['ledger', 'ask', place], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Does the changelog name the rename?' })).id;
    await sim.runAsync(['raise', place, '--answers', own], null, JSON.stringify({ ...leaningCall('Yes.', 'No.'), question: 'Does the changelog name the rename?' }));
    sim.handOver();
    sim.run(['enter', 'implementation', wu]);
    const named = sim.read(['enter', 'implementation', wu]);
    sim.write(`.leeway/${wu}/build/log.md`, '# The fixes\n');
    sim.refuses(['checklist', 'close', 'finish', wu], /finish has items open: questions-answered/);
    const waiting = sim.run(['board', sim.env.CLAUDE_CODE_SESSION_ID]).view.waiting;
    const again = await sim.runAsync(['raise', place, '--answers', own], null, JSON.stringify({ ...leaningCall('Yes.', 'No.'), question: 'Does the changelog name the rename?' }));
    sim.run(['raise', 'answer', again.raise, '--pick', '1'], null, JSON.stringify({ why: 'A rename is news.' }));
    finishClosed(sim, wu);
    sim.render(['finish', wu], { expect: 'content' });
    const unclosed = sim.handoffs.slice(handedOff);
    const yes = sim.run(answerGate(sim, 'finish', '--pick', 'y').next.argv);

    assert.deepStrictEqual([first.task, parked.parked, parked.task, receipt], ['1.1', 'Q1', '1.2', 'Q1 answered · task 1.2 builds again · nothing waiting on you']);
    assert.notStrictEqual(sim.env.CLAUDE_CODE_SESSION_ID, conversation);
    assert.match(account, /▪ Spell the flag --colour \(task 1\.1\)\n\n✓ Passed its review in round 1\n\n- Phase: 1 — the fixes\n[\s\S]*WHAT WAS DONE\n  Built\.\n  · src\/flag\.js\n/, 'a fix\'s account, asked for, is its builder\'s');
    assert.match(named, /\nwaiting: \S+ — Does the changelog name the rename\? — asked in the conversation and still open: raise it again for the person to answer, raise typo\.implementation --answers \S+\n/, 'the entry after the /clear names it');
    assert.deepStrictEqual(waiting.filter(({ kind }) => kind === 'raised').map(({ text }) => text), ['Does the changelog name the rename?'], 'the board draws it waiting after the /clear');
    assert.deepStrictEqual(unclosed, [], 'no handoff from the opener to the close (24.S8)');
    assert.deepStrictEqual([yes.landed.map((/** @type {{merged: string[]}} */ { merged }) => merged), sim.manifest(wu).status], [[['1.1', '1.3', '1.2']], 'completed']);
  });
});
