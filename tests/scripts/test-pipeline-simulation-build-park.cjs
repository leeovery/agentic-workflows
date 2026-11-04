'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's build in auto with two tasks side by side, as
// its skill's prose runs it: a feature's one phase, its two tasks each laid
// out by `task worktree` from a worktree made at the default branch.
// One builder stopping, the orchestrator recording the stop, the task
// failed on the board until it adds what the task needs and sends its
// builder back in, the task text as written (13.S16, 20.4.9); the other's
// builder finding a decision of the unit's own record wrong, replaced
// through a raise at the build's place parking its task — never a message,
// which the spec refuses — the one line said (12.S44, 12.S30), its pair
// passing it while it waits. The other task landing with the question
// waiting beneath its summary; nothing left to go on, the stop report
// drawn; the person, ready, answering against the lean — the parked task
// changed under its passed round, so its builder builds what changed, its
// account refused, and its pair reads it again (12.1.4); its brief then
// saying to merge the chain's tip back before its account, the merge
// finished through the commit door under the task; the builder reporting
// it merged, the loop going on from the top of its landing, the account
// refused until its builder writes it, then counting the task's own work
// alone, and its summary (12.14).
// The builder's note consolidated at the phase's close, writing no task, so
// the phase review's brief names the mutation run, and the review phase
// entered in the same conversation (24.S7).
//
// Layer: simulation. World: this file's own, built once from the project
// every scenario starts from (pipeline-world.cjs) — a feature through its
// spec to ready to build's pick in auto, its one phase written and started —
// a copy per scenario, which replays the engine calls the build's prose
// makes, in order, the oracle (pipeline-oracle.cjs) auditing the whole state
// after every mutation. A phase's fix round and its nit are
// test-pipeline-simulation-build.cjs's.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { git } = require('./engine-harness.cjs');
const {
  Sim, worldFrom, startUnit, discussed, specToBuild, buildEntry, startPhase, writeTasks, briefOf, landed, placeIn, buildLoop, VERIFY_FILES,
} = require('./pipeline-world.cjs');
const { leaningCall } = require('./ledger-world.cjs');

const { taskBranch } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/landing-names.cjs'));

const WU = 'ledgerly';
const PASSED = '## Findings\n\nNone.\n\nVerdict: pass\n';

/** A feature in auto, its one phase written and started. */
const showingWorld = worldFrom('pipeline-build-park-', (sim) => {
  startUnit(sim, 'feature', WU, 'A ledger');
  discussed(sim, WU, WU);
  specToBuild(sim, WU, [WU], 'a');
  buildEntry(sim, WU);
  sim.run(['task', 'phase', WU, '1', '--title', 'Showing']);
  sim.run(['brief', 'task-writer', WU, '1']);
  writeTasks(sim, WU, 1, [{ title: 'Show an entry', scenarios: ['1.S1'] }, { title: 'Check the hash on show' }]);
  startPhase(sim, WU, 1);
});

describe('pipeline simulation: the build with two tasks side by side', () => {
  let sim;
  /** @type {ReturnType<typeof buildLoop>} */ let loop;
  beforeEach(() => {
    sim = new Sim(showingWorld);
    loop = buildLoop(sim, WU);
  });
  afterEach(() => {
    loop.cleared();
    sim.destroy();
  });

  it('13.S16, 12.S44, 12.1.4, 24.S7: two tasks side by side — a stopped builder sent back in with what the task lacked, a decision replaced at the build\'s place parking the other task, the stop report, the person answering against the lean so the task\'s pair reads it again — and on into the review phase with no handoff', async () => {
    const conversation = sim.env.CLAUDE_CODE_SESSION_ID;
    const ready = sim.run(['task', 'ready', WU]).tasks.map((/** @type {{task: string}} */ t) => t.task);
    assert.deepStrictEqual(ready, ['1.1', '1.2'], 'two tasks sharing no files run side by side');
    for (const task of ready) sim.run(['task', 'start', WU, task]);
    sim.render(['build-headline', WU, '--file', sim.write(`.leeway/.cache/${WU}/build/headline.json`, { tasks: [{ task: '1.1', changes: 'An entry shows.', watch: 'The entry.' }, { task: '1.2', changes: 'A shown entry checks its hash.', watch: 'The hash.' }] })], { expect: 'content' });
    const showingBrief = loop.brief(['builder', WU, '1.1']);
    const showing = loop.isolated('1.1');
    loop.brief(['builder', WU, '1.2']);
    const hashing = loop.isolated('1.2');
    const main = git(sim.dir, ['rev-parse', 'main']).trim();
    assert.deepStrictEqual([showing, hashing].map((tree) => git(tree, ['rev-parse', 'HEAD']).trim()), [main, main], 'each starts on the branch the project lands on');

    // 1.1's builder stops: the orchestrator records the stop, the board
    // reading the task failed (20.4.9), adds what it needs to the task and
    // sends it back in, which takes the stop off; the task stands as written
    // (13.S16).
    const stateOf = () => sim.run(['board', conversation]).view.phases[0].tasks.find((/** @type {{task: string}} */ t) => t.task === '1.1').state;
    assert.strictEqual(typeof sim.run(['task', 'stopped', WU, '1.1']).stopped, 'string');
    const stopped = stateOf();
    const written = sim.run(['task', 'show', WU, '1.1']).text;
    sim.run(['task', 'add', WU, '1.1', '--file', sim.write(`.leeway/.cache/${WU}/build/addition.md`, 'An entry is shown by its id.\n'), '--by', 'orchestrator']);
    assert.ok(briefOf(sim, loop.brief(['builder', WU, '1.1'])).includes('## Added by the orchestrator\n\nAn entry is shown by its id.'), 'the builder goes back in with the addition on its task');
    assert.deepStrictEqual([stopped, stateOf()], ['failed', 'building'], 'failed from the stop until its builder is sent back in');
    const shown = sim.run(['task', 'show', WU, '1.1']);
    assert.deepStrictEqual([shown.text, shown.additions.map((/** @type {{by: string}} */ a) => a.by)], [written, ['orchestrator']], 'the task as written, the addition the orchestrator\'s');

    // 1.2's builder finds the feature's decision wrong: replaced where it is
    // found, never sent as a message, its task parked (12.S44, 12.S30); its
    // pair reads it meanwhile and passes it.
    const [decision] = JSON.parse(sim.read(['ledger', 'record', WU, WU])).decisions;
    sim.refuses(['topic', 'send', WU, WU, '--from', `${WU}.${WU}`, '--content', sim.write(`.leeway/.cache/${WU}/build/message-hash.md`, '# The hash\n\nShould a show check it?\n'), '--slug', 'the-hash'], /has its spec/);
    const proposal = { ...leaningCall('A shown entry checks its hash.', 'A shown entry trusts the ledger.'), question: 'Should showing an entry check its hash?' };
    const parked = await sim.runAsync(['raise', `${WU}.implementation`, '--replaces', decision.id, '--reason', 'was-wrong', '--parks', '1.2'], null, JSON.stringify(proposal));
    assert.deepStrictEqual([parked.decision, parked.parked, parked.task], ['ask', 'Q1', '1.2']);
    assert.match(parked.line, /^Task 1\.2 parks on Q1, waiting for you: Should showing an entry check its hash\? The other tasks carry on\.$/);
    loop.committed(hashing, '1.2', { 'src/hash.js': 'export const hash = 1;\n' });
    loop.pairRound('1.2');

    // 1.1 lands, the question waiting beneath its summary; its builder's
    // note banked; its chain names nothing, 1.2 still to end.
    loop.committed(showing, '1.1', { ...VERIFY_FILES, 'src/show.js': 'export const show = 1;\n' });
    loop.setUp(showing, showingBrief, '1.S1');
    sim.run(['task', 'note', WU, '--file', sim.write(`.leeway/.cache/${WU}/build/note.md`, 'Showing an entry reads the whole ledger.\n')]);
    loop.pairRound('1.1');
    loop.accounted('1.1', ['Passed.']);
    assert.match(sim.render(['task-landed', WU, '1.1'], { expect: 'content' }), /Q1 Should showing an entry check its hash\?/, 'the question waiting shows beneath the landing');
    sim.refuses(['render', 'step-gate', WU, '1.1'], /builds in auto, where no gate follows a task/);
    assert.strictEqual(loop.landedTask('1.1'), undefined, 'a chain with a task of its phase still to end names no mutation run');

    // Nothing left can go on: the stop report, the question front and centre.
    assert.match(sim.render(['build-stop', WU], { expect: 'content' }), /Q1/);
    sim.read(['raise', 'waiting', WU]);

    // The person, ready, answers against the lean: the receipt frees the
    // task, the replacement on the ledger at the build's place; the task
    // changed under its passed round, so its builder builds what changed,
    // its account waits, and its pair reads it again (12.1.4).
    const drawn = sim.run(['raise', 'draw', WU, 'Q1']);
    assert.strictEqual(sim.run(['raise', 'answer', drawn.raise, '--pick', '2'], null, JSON.stringify({ why: 'The ledger is trusted already.' })).receipt,
      'Q1 answered · task 1.2 builds again · nothing waiting on you');
    const replaced = fs.readFileSync(path.join(sim.dir, '.leeway/.ledger.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line)).filter((event) => event.event === 'replaced');
    assert.deepStrictEqual(replaced.map((event) => [event.phase, event.replaces.startsWith(decision.id)]), [['implementation', true]], 'the replacement lands at the build\'s place');
    sim.read(['ledger', 'affected', WU]);
    const back = briefOf(sim, loop.brief(['builder', WU, '1.2']));
    assert.match(back, /The task changed after your reviewers passed it in round 1/);
    assert.doesNotMatch(back, /it has landed/);
    sim.refuses(['task', 'account', WU, '1.2'], /changed after round 1 passed/);
    loop.committed(hashing, '1.2', { 'src/hash.js': 'export const hash = 0;\n' });
    loop.pairRound('1.2');

    // Built beside 1.1, which chained first: its brief orders the merge of
    // the chain's tip back before the account, the merge finished through
    // the door under the task (12.14).
    const tip = taskBranch({ unit: WU, phase: 1, n: 1 }, 'feat', 'Show an entry');
    const passed = briefOf(sim, loop.brief(['builder', WU, '1.2']));
    assert.ok(passed.includes(`# Where your branch stands\n\nYour phase's chain has moved on past your branch. Merge its tip back before anything else, from your task's worktree, one repository at a time in this order, each merge committed before the next starts:\n\n- \`git merge --no-ff --no-commit ${tip}\``), 'the builder is told to merge the chain\'s tip back first');
    assert.match(passed, /commit the merge through the door, naming each file you resolved — or, where nothing conflicted, any file the merge changed: [^\n]*, which finishes it\.\n\nThen write the task's account, as \*\*Where your account goes\*\* says, and report \*\*accounted\*\*\./, 'the merge first, then the account');
    git(hashing, ['merge', '-q', '--no-ff', '--no-commit', tip]);
    sim.runIn(hashing, ['commit', '--paths', 'src/show.js', '--task', WU, '1.2', '-m', `merge(${WU}): the chain's tip back`]);
    assert.deepStrictEqual([git(hashing, ['rev-list', '--parents', '-n', '1', 'HEAD']).trim().split(' ').length, git(hashing, ['log', '-1', '--format=%(trailers:key=Leeway-Task,valueonly)']).trim()], [3, `${WU}-1-2`], 'the merge committed whole, under the task');

    // Its builder reports it merged: the loop goes on from the top of its
    // landing, the account it takes refused as none is written, so its
    // builder's brief goes again for one.
    sim.refuses(['task', 'account', WU, '1.2'], /has no account/);
    loop.accounted('1.2', ['Passed.', 'Passed, the ledger trusted.']);
    const figures = JSON.parse(fs.readFileSync(path.join(sim.dir, `.leeway/${WU}/build/tasks/1.2/figures.json`), 'utf8'));
    assert.deepStrictEqual([figures.files, figures.added, figures.removed], [1, 1, 0], 'the account counts the task\'s own work, never what it merged back');
    sim.render(['task-landed', WU, '1.2'], { expect: 'content' });
    sim.refuses(['render', 'step-gate', WU, '1.2'], /builds in auto, where no gate follows a task/);
    assert.strictEqual(loop.landedTask('1.2'), undefined, 'the phase\'s last chain, its note not yet consolidated, names no mutation run');

    // The phase's close: the builder's note consolidated, writing no task, so
    // the phase review's brief names the mutation run, then its review.
    sim.read(['checklist', 'show', 'phase-close', WU, '1']);
    landed(placeIn(sim, loop.brief(['consolidation', WU, '1']), 'Where the report goes'), '## The notes\n\n- Note 1: dropped — a show reads one entry.\n');
    sim.refuses(['brief', 'phase-review', WU, '1', '--letter', 'a'], new RegExp(`engine verify mutants ${WU} 1 runs it$`));
    sim.run(['verify', 'mutants', WU, '1']);
    for (const letter of ['a', 'b']) landed(placeIn(sim, loop.brief(['phase-review', WU, '1', '--letter', letter]), 'Where your report goes'), PASSED);
    sim.refuses(['render', 'phase-merge-gate', WU, '1'], /a phase's stack merges with no gate/);
    sim.run(['land', 'phase', WU, '1']);
    sim.run(['checklist', 'close', 'phase-close', WU, '1']);

    // The cut through, the review phase is entered in the same conversation.
    assert.strictEqual(sim.run(['enter', 'review', WU]).entered, true);
    assert.strictEqual(sim.env.CLAUDE_CODE_SESSION_ID, conversation, 'no handoff into the review phase');
    assert.deepStrictEqual(Object.fromEntries([...loop.agents].map(([role, named]) => [role, [...named]])), {
      builder: ['leeway-builder'], reviewer: ['leeway-reviewer'], consolidation: ['leeway-consolidation'], 'phase-review': ['leeway-reviewer'],
    }, 'the agents run as defined');
  });
});
