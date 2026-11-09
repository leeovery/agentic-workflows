'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's quick-fix scenarios: the opener carrying on in
// place into the quick-fix's skill (24.1.3), its fixes built by their
// builders and passed by their pairs (19.5.22), a builder's question parking
// its fix while the next goes on, answered and built (19.5.25), a question
// Claude raised in the conversation outliving a /clear and holding the close
// until it is answered again, and the close landing the one pull request;
// and a quick-fix's three fixes on its one branch through its one pull
// request, each fix's short record written, the pull request merged by hand
// mid-set and the branch cut again for the fix after it, whose share in the
// project's nested clone the door records on the unit's manifest before it
// commits there, and the unit closed, landing it there too (19.5.6, 19.5.15,
// R14, R18), the board drawing its close waiting and then following the
// session to All work (20.14). Its review is
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
const { git } = require('./engine-harness.cjs');

describe('pipeline simulation: quick-fix', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('quick-fix: the opener carries on into its skill in the same conversation; each fix passed by its pair; a builder\'s question parks its fix while the next goes on, then it is built; Claude\'s own question outlives a /clear, the close refused until it is answered again; and the close landing the one pull request', async () => {
    const wu = 'typo';
    const place = `${wu}.implementation`;
    const started = startUnit(sim, 'quick-fix', wu, 'The --color flag is spelt --colour');
    assert.deepStrictEqual(started.next, { kind: 'invoke', skill: 'leeway-quick-fix-process', args: ['quick-fix', wu] });
    const conversation = sim.env.CLAUDE_CODE_SESSION_ID;

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
    sim.write(`.leeway/${wu}/build/log.md`, '# The fixes\n');
    finishClosed(sim, wu);
    sim.render(['finish', wu], { expect: 'content' });
    const closing = answerGate(sim, 'finish', '--pick', 'y').next.argv;
    sim.refuses(closing, /closes once each question asked in it is answered — \S+ Does the changelog name the rename\?: raise it again for the person to answer/);
    const waiting = sim.run(['board', sim.env.CLAUDE_CODE_SESSION_ID]).view.waiting;
    const again = await sim.runAsync(['raise', place, '--answers', own], null, JSON.stringify({ ...leaningCall('Yes.', 'No.'), question: 'Does the changelog name the rename?' }));
    sim.run(['raise', 'answer', again.raise, '--pick', '1'], null, JSON.stringify({ why: 'A rename is news.' }));
    sim.render(['finish', wu], { expect: 'content' });
    const yes = sim.run(answerGate(sim, 'finish', '--pick', 'y').next.argv);

    assert.deepStrictEqual([first.task, parked.parked, parked.task, receipt], ['1.1', 'Q1', '1.2', 'Q1 answered · task 1.2 builds again · nothing waiting on you']);
    assert.notStrictEqual(sim.env.CLAUDE_CODE_SESSION_ID, conversation);
    assert.deepStrictEqual(waiting.filter(({ kind }) => kind === 'raised').map(({ text }) => text), ['Does the changelog name the rename?'], 'the board draws it waiting after the /clear');
    assert.deepStrictEqual([yes.landed.map((/** @type {{merged: string[]}} */ { merged }) => merged), sim.manifest(wu).status], [[['1.1', '1.3', '1.2']], 'completed']);
  });

  it('quick-fix: three fixes built in the project\'s checkout on its one branch, each passed by its pair, recorded, pushed to its one pull request and done; the pull request merged by hand mid-set, the fix after it on the branch cut again, its share in the nested clone recorded; and the close landing what is left in one commit naming the fix it holds in each, then naming the start menu', () => {
    const wu = 'typo';
    const branch = `fix/${wu}`;
    startUnit(sim, 'quick-fix', wu, 'The --color flag is spelt --colour');
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
    // The person merges the pull request by hand mid-set, a squash on main.
    git(sim.dir, ['switch', '-q', 'main']);
    git(sim.dir, ['merge', '-q', '--squash', branch]);
    git(sim.dir, ['commit', '-q', '-m', 'Spell it the British way']);
    git(sim.dir, ['switch', '-q', branch]);
    const third = built(3, 'Spell the docs --colour', ['docs/flags.md', 'api/flags.md']);
    const recorded = sim.manifest(wu).fixes.repos;
    sim.write(`.leeway/${wu}/build/log.md`, '# The fixes\n');
    finishClosed(sim, wu);
    sim.render(['finish', wu], { expect: 'content' });
    const closing = sim.run(['board', sim.env.CLAUDE_CODE_SESSION_ID]).view;
    const yes = sim.run(answerGate(sim, 'finish', '--pick', 'y').next.argv);
    const closed = sim.run(['board', sim.env.CLAUDE_CODE_SESSION_ID]);

    assert.deepStrictEqual([first.branch, third.branch, third.cut_again?.map((/** @type {any} */ { replayed }) => replayed)], [branch, branch, [[]]]);
    assert.deepStrictEqual([recorded, yes.landed.map((/** @type {{repo: string, merged: string[]}} */ { repo, merged }) => [repo, merged]), yes.next], [
      ['api'], [['api', ['1.3']], ['.', ['1.3']]], { kind: 'handoff', skill: 'leeway', args: [] },
    ]);
    assert.deepStrictEqual(git(sim.api, ['log', '-1', '--format=%B', 'main']).match(/^Task: .*$/gm), [`Task: ${wu}-1-3`]);
    assert.strictEqual(sim.manifest(wu).status, 'completed');
    assert.deepStrictEqual([closing.kind, closing.standing, closing.progress, closing.record.map((/** @type {{title: string}} */ { title }) => title), closed.view.kind, closed.banner.state], [
      'quick-fix', 'close', { done: 3, total: 3, written: true }, ['Spell the flag --colour', 'Spell the help --colour', 'Spell the docs --colour'], 'all', 'done',
    ], 'the board draws the close waiting, then follows the session to All work');
    assert.deepStrictEqual([git(sim.dir, ['log', '--format=%s', `${base}..main`]).trim().split('\n'), git(sim.dir, ['log', '-1', '--format=%B', 'main']).match(/^Task: .*$/gm)], [
      [`fix(${wu}): The --color flag is spelt --colour`, 'Spell it the British way'], [`Task: ${wu}-1-3`],
    ]);
  });
});
