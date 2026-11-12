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
// entered in the same conversation (24.S7). And, the decision point forced
// to draw blind, a builder's calls cheap to undo going ahead for its task
// while their questions wait, naming it and parking none, each drawn with
// its rows in the order its question's id gives them; the person, ready,
// keeping one, the task standing as built, replacing another for the task,
// the task built again on their answer and what relied on the call
// affected (16.S53), and leaving the third to Claude, its call standing as
// built, the builder's, nothing revealed. And a call of the other task's
// going ahead so, the task held open once its pair passes it — its account
// refused, the first task landing, the stop report putting the question,
// the board showing the task waiting on it — until the person answers as
// Claude did, the task building again as built, merging the chain's tip
// back, and landing (16.17.6).
//
// Layer: simulation. World: this file's own, built once on the named world
// `worlds.specToBuild`, itself built once per run (pipeline-world.cjs) — a
// feature through its spec to ready to build's pick in auto — its one phase
// written and started; a copy per scenario, which replays the engine calls
// the build's prose makes, in order, the oracle (pipeline-oracle.cjs)
// auditing the whole state after every mutation. A phase's fix round and
// its nit are test-pipeline-simulation-build.cjs's.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { git } = require('./engine-harness.cjs');
const {
  Sim, worldFrom, worlds, SPEC_TO_BUILD_UNIT, buildEntry, startPhase, writeTasks, briefOf, landed, placeIn, buildLoop, VERIFY_FILES,
} = require('./pipeline-world.cjs');
const { leaningCall } = require('./ledger-world.cjs');
const { labelAnswers } = require('./labels.cjs');

const { taskBranch } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/landing-names.cjs'));
const { manageUnitScreen } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/projections/manage.cjs'));
const decisionPoint = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/decision-point.cjs'));
const { RAISE_SHOWN } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/gate.cjs'));

const WU = SPEC_TO_BUILD_UNIT;
const PASSED = '## Findings\n\nNone.\n\nVerdict: pass\n';

/** A feature in auto, its one phase written and started. */
const showingWorld = worldFrom('pipeline-build-park-', (sim) => {
  buildEntry(sim, WU);
  sim.run(['task', 'phase', WU, '1', '--title', 'Showing']);
  sim.run(['brief', 'task-writer', WU, '1']);
  writeTasks(sim, WU, 1, [{ title: 'Show an entry', scenarios: ['1.S1'] }, { title: 'Check the hash on show' }]);
  startPhase(sim, WU, 1);
}, worlds.specToBuild);

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

  it('13.S16, 12.S44, 12.1.4, 24.S7, 18.S68: two tasks side by side — a stopped builder sent back in with what the task lacked, a decision replaced at the build\'s place parking the other task, the stop report, the person answering against the lean so the task\'s pair reads it again — and on into the review phase with no handoff', async () => {
    const conversation = sim.env.CLAUDE_CODE_SESSION_ID;
    const handedOff = sim.handoffs.length;
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
    assert.deepStrictEqual([sim.manifest(WU).phases.discussion.items[WU].status, manageUnitScreen(sim.dir, sim.manifest(WU)).rows.map(({ key }) => key)], ['completed', ['c']],
      '18.S68: the decision settled in the build, the feature never back to its discussion, and manage offers it cancel alone');
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
    assert.deepStrictEqual(sim.handoffs.slice(handedOff), [], 'no handoff into the review phase');
    assert.deepStrictEqual(Object.fromEntries([...loop.agents].map(([role, named]) => [role, [...named]])), {
      builder: ['leeway-builder'], reviewer: ['leeway-reviewer'], consolidation: ['leeway-consolidation'], 'phase-review': ['leeway-reviewer'],
    }, 'the agents run as defined');
  });

  it('16.S53, 16.17.6: blind questions mid-build — the decision point forced to draw them — on calls cheap to undo let the builder\'s calls go ahead for its task while the questions wait, naming it and parking none; the person, ready, keeps one call, the task standing as built, replaces another for the task, the task built again on their answer and what relied on the call affected, and leaves the third to Claude, its call standing as built, the builder\'s, nothing revealed', async (t) => {
    t.mock.method(decisionPoint, 'decide', () => ({ decision: 'blind', reason: 'Asked cold.' }));
    const asks = { id: 'Should a show print the entry\'s id?', hash: 'Should a show print the entry\'s hash?', time: 'Should a show print when the entry landed?' };
    sim.env = { ...sim.env, CLAUDE_STUB_ANSWERS: JSON.stringify({ [asks.id]: labelAnswers('behaviour'), [asks.hash]: labelAnswers('look'), [asks.time]: labelAnswers('behaviour'), '': 'no-login' }) };
    sim.run(['task', 'start', WU, '1.1']);
    loop.brief(['builder', WU, '1.1']);
    const made = { by: 'claude', who_moved_whom: 'none' };
    /** A question the builder asks for 1.1, answered by its call going ahead while it waits: the call's id. @param {string} question @param {string} lean @param {string} other */
    const wentAhead = async (question, lean, other) => {
      const asked = sim.run(['ledger', 'ask', `${WU}.implementation`, '--task', '1.1'], null, JSON.stringify({ ...made, text: question })).id;
      const drawn = await sim.runAsync(['raise', `${WU}.implementation`, '--answers', asked, '--parks', '1.1'], null, JSON.stringify({ ...leaningCall(lean, other), question }));
      assert.deepStrictEqual([drawn.decision, drawn.task], ['blind', null], 'the call goes ahead, its question parking no task');
      return drawn.landed.id;
    };
    await wentAhead(asks.id, 'A show prints the id.', 'A show hides the id.');
    const hash = await wentAhead(asks.hash, 'A show prints the hash.', 'A show hides the hash.');
    await wentAhead(asks.time, 'A show prints the time.', 'A show hides the time.');
    const sized = sim.run(['ledger', 'ask', `${WU}.implementation`, '--task', '1.1'], null, JSON.stringify({ ...made, text: 'How wide is a shown hash?' })).id;
    sim.run(['ledger', 'decide', `${WU}.implementation`, '--answers', sized, '--relies-on', hash, '--task', '1.1'], null, JSON.stringify({ ...made, text: 'Eight characters.', why: 'Short hashes read well.' }));
    sim.read(['raise', 'waiting', WU]);

    const seals = () => JSON.parse(fs.readFileSync(path.join(sim.configDir, 'conversations', sim.env.CLAUDE_CODE_SESSION_ID, RAISE_SHOWN), 'utf8'));
    /** The person's answer to the question `question`: a pick of the row whose answer is `text`, wherever its question's id put it. @param {string} question @param {string} text */
    const picked = (question, text) => {
      const { raise } = sim.run(['raise', 'draw', WU, question]);
      const { key } = seals()[raise].call.rows.find((/** @type {{text: string}} */ row) => row.text === text);
      const { receipt } = sim.run(['raise', 'answer', raise, '--pick', key], null, JSON.stringify({ why: 'The person said why.' }));
      assert.match(sim.sections, /^=== DISPLAY: blind question revealed /, 'the answer reveals Claude\'s');
      return receipt;
    };
    assert.match(picked('Q1', 'A show prints the id.'), /^Q1 answered · task 1\.1 stands as built · /);
    assert.match(picked('Q2', 'A show hides the hash.'), /^Q2 answered · task 1\.1 is built again on your answer · /);
    const { receipt } = sim.run(['raise', 'answer', sim.run(['raise', 'draw', WU, 'Q3']).raise, '--dont-care']);
    assert.match(receipt, /^Q3 answered · my answer stands as the builder's: A show prints the time\. · task 1\.1 stands as built · /);
    assert.doesNotMatch(sim.sections, /blind question revealed/, 'a "don\'t care" reveals nothing');
    assert.strictEqual(JSON.parse(sim.read(['ledger', 'affected', WU])).affected.length, 1, 'what relied on the replaced call is affected');
  });

  it('16.17.6: a task whose builder\'s call went ahead while its blind question waits is held open once its pair passes it — its account refused, naming the question, the other task building and landing; nothing left, the stop report puts the question, the board showing the task waiting on it; the person answering as Claude did, the task builds again as built, its builder merging the chain\'s tip back and writing its account, and it lands', async (t) => {
    t.mock.method(decisionPoint, 'decide', () => ({ decision: 'blind', reason: 'Asked cold.' }));
    const question = 'Should a show print the hash it checked?';
    sim.env = { ...sim.env, CLAUDE_STUB_ANSWERS: JSON.stringify({ [question]: labelAnswers('behaviour'), '': 'no-login' }) };
    const conversation = sim.env.CLAUDE_CODE_SESSION_ID;
    for (const task of ['1.1', '1.2']) sim.run(['task', 'start', WU, task]);
    const showingBrief = loop.brief(['builder', WU, '1.1']);
    const showing = loop.isolated('1.1');
    loop.brief(['builder', WU, '1.2']);
    const hashing = loop.isolated('1.2');

    // 1.2's builder makes a call cheap to undo: it goes ahead while its
    // blind question waits, parking nothing, and the task's pair passes it.
    const asked = sim.run(['ledger', 'ask', `${WU}.implementation`, '--task', '1.2'], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: question })).id;
    const drawn = await sim.runAsync(['raise', `${WU}.implementation`, '--answers', asked, '--parks', '1.2'], null, JSON.stringify({ ...leaningCall('A show prints the hash.', 'A show hides the hash.'), question }));
    assert.deepStrictEqual([drawn.decision, drawn.task], ['blind', null], 'the call goes ahead, its question parking no task');
    loop.committed(hashing, '1.2', { 'src/hash.js': 'export const hash = 1;\n' });
    loop.pairRound('1.2');

    // Held open at its done point: its account refused, naming the
    // question; 1.1 goes on and lands.
    sim.refuses(['task', 'account', WU, '1.2'], new RegExp(`task 1\\.2 of ${WU} waits on Q1, parked for the person`));
    loop.committed(showing, '1.1', { ...VERIFY_FILES, 'src/show.js': 'export const show = 1;\n' });
    loop.setUp(showing, showingBrief, '1.S1');
    loop.pairRound('1.1');
    loop.accounted('1.1', ['Passed.']);
    loop.landedTask('1.1');

    // Nothing left goes on: the stop report puts the question, and the
    // board shows 1.2 waiting on it, its phase not yet in review.
    assert.match(sim.render(['build-stop', WU], { expect: 'content' }), /Q1/);
    const [phase] = sim.run(['board', conversation]).view.phases;
    const held = phase.tasks.find((/** @type {{task: string}} */ line) => line.task === '1.2');
    assert.deepStrictEqual([held.state, held.on, phase.state === 'in-review'], ['waits', ['Q1'], false]);

    // The person answers as Claude did: the task builds again as built.
    const seals = () => JSON.parse(fs.readFileSync(path.join(sim.configDir, 'conversations', conversation, RAISE_SHOWN), 'utf8'));
    const { raise } = sim.run(['raise', 'draw', WU, 'Q1']);
    const { key } = seals()[raise].call.rows.find((/** @type {{text: string}} */ row) => row.text === 'A show prints the hash.');
    assert.strictEqual(sim.run(['raise', 'answer', raise, '--pick', key], null, JSON.stringify({ why: 'The person said why.' })).receipt,
      'Q1 answered · task 1.2 builds again as built · nothing waiting on you');

    // Its builder merges the chain's tip back, then writes its account,
    // and the task lands.
    const tip = taskBranch({ unit: WU, phase: 1, n: 1 }, 'feat', 'Show an entry');
    assert.match(briefOf(sim, loop.brief(['builder', WU, '1.2'])), /# Where your branch stands\n\nYour phase's chain has moved on past your branch\./);
    git(hashing, ['merge', '-q', '--no-ff', '--no-commit', tip]);
    sim.runIn(hashing, ['commit', '--paths', 'src/show.js', '--task', WU, '1.2', '-m', `merge(${WU}): the chain's tip back`]);
    loop.accounted('1.2', ['Passed.']);
    loop.landedTask('1.2');
    assert.strictEqual(sim.run(['task', 'show', WU, '1.2']).status, 'done');
  });
});
