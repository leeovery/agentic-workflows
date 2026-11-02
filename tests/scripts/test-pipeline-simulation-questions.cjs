'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's scenario of the build's questions: a task
// parking on a question only the person can answer while the others carry
// on, and another task meeting it joining it; the questions waiting listed;
// one drawn when the person is ready and answered for its task; another set
// aside and still waiting, answered through its raise alone; Claude's calls
// made for a task; and a replacement of one proposed for its task, parking
// it, raised outside the build refused and kept through its raise — each
// landing in the ledger and the trust log as the command that writes it.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { Sim, sessionLog, startNew, writePhaseTasks } = require('./pipeline-world.cjs');
const { leaningCall } = require('./ledger-world.cjs');

describe('pipeline simulation: the build\'s questions', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('a task parks on a question while the others carry on, and another meeting it joins it; the questions waiting listed oldest first; one drawn and answered for its task, which builds again; another set aside, still waiting, answered through its raise alone, freeing both its tasks; Claude\'s calls made for a task, a replacement of one parking it, kept through its raise alone', async () => {
    const wu = 'ledger';
    startNew(sim, 'feature');
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'A ledger', '--session-log-file', sessionLog(sim, wu)]);
    writePhaseTasks(sim, wu, 1, 'The ledger', [{ title: 'Write the ledger' }, { title: 'Read the ledger' }, { title: 'Fold the ledger' }, { title: 'Index the ledger' }]);
    const build = `${wu}.implementation`;
    const made = { by: 'claude', who_moved_whom: 'none' };
    /** A question asked for `task`: its short id. @param {string} text @param {string} task */
    const asked = (text, task) => sim.run(['ledger', 'ask', build, '--task', task], null, JSON.stringify({ ...made, text })).id;
    /** Claude's call on the question `id`, asking `text`, raised for `task` — which the person must answer: its answer. @param {string} id @param {string} text @param {string} task */
    const raised = (id, text, task) => sim.runAsync(['raise', build, '--answers', id, '--parks', task], null, JSON.stringify({ ...leaningCall('Yes.', 'No.'), question: text }));

    const locking = asked('Does a read lock the ledger?', '1.1');
    const parked = await raised(locking, 'Does a read lock the ledger?', '1.1');
    assert.deepStrictEqual([parked.decision, parked.parked, parked.task], ['ask', 'Q1', '1.1'], 'the question parks its task, numbered');
    assert.strictEqual(parked.line, 'Task 1.1 parks on Q1, waiting for you: Does a read lock the ledger? The other tasks carry on.');
    const ordering = asked('Does a fold keep the ledger\'s order?', '1.2');
    await raised(ordering, 'Does a fold keep the ledger\'s order?', '1.2');
    // Task 1.3's builder meets the same question: its task joins Q2.
    assert.deepStrictEqual((await raised(ordering, 'Must a fold keep the order?', '1.3')).parked, 'Q2', 'a task meeting a question waiting joins it');

    const waiting = () => sim.run(['raise', 'waiting', wu]).waiting.map((/** @type {{question: string, parks: string[]}} */ q) => [q.question, q.parks]);
    assert.deepStrictEqual(waiting(), [['Q1', ['1.1']], ['Q2', ['1.2', '1.3']]], 'the questions waiting, oldest first, with the tasks they park');

    // Claude carries on with the task nothing parks, its calls made for it.
    const indexing = asked('Does the index hold every entry?', '1.4');
    const indexed = sim.run(['ledger', 'decide', build, '--answers', indexing, '--task', '1.4'], null, JSON.stringify({ ...made, text: 'The index holds every entry.', why: 'Every event counts.' })).id;

    // The person, ready, takes Q1: drawn from its park, not followed at first, answered against the lean.
    const drawn = sim.run(['raise', 'draw', wu, 'Q1']);
    assert.deepStrictEqual([drawn.question, drawn.parks], ['Q1', ['1.1']], 'the question is drawn from its park');
    assert.strictEqual(sim.run(['raise', 'answer', drawn.raise, '--didnt-follow']).receipt, 'Q1 still open, explained again · still waiting · 2 waiting on you');
    const answered = sim.run(['raise', 'answer', drawn.raise, '--pick', '2'], null, JSON.stringify({ why: 'Readers never wait on a writer.' }));
    assert.strictEqual(answered.receipt, 'Q1 answered · task 1.1 builds again · 1 waiting on you');

    // Q2 set aside stays waiting, and is answered through its raise alone.
    assert.strictEqual(sim.run(['raise', 'aside', wu, 'Q2']).receipt, 'Q2 set aside · still waiting · 1 waiting on you');
    assert.deepStrictEqual(waiting(), [['Q2', ['1.2', '1.3']]], 'a question set aside still waits');
    sim.refuses(['ledger', 'decide', build, '--answers', ordering], /the person answers it through the raise alone: raise draw ledger Q2$/, null,
      JSON.stringify({ by: 'person', text: 'A fold keeps the order.', why: 'Order is the history.' }));
    const later = sim.run(['raise', 'draw', wu, 'Q2']);
    assert.strictEqual(sim.run(['raise', 'answer', later.raise, '--pick', '1'], null, JSON.stringify({ why: 'Order is the history.' })).receipt,
      'Q2 answered · their tasks build again · nothing waiting on you');
    assert.deepStrictEqual(waiting(), [], 'a question answered waits no longer');

    // Task 1.4's builder finds its call wrong: the replacement it proposes parks it, kept through its raise alone.
    const replacing = { ...leaningCall('The index holds the live entries.', 'The index holds the entries a read asks for.'), question: 'Should the index drop dead entries?' };
    const proposed = await sim.runAsync(['raise', build, '--replaces', indexed, '--reason', 'was-wrong', '--parks', '1.4'], null, JSON.stringify(replacing));
    assert.deepStrictEqual([proposed.parked, proposed.task], ['Q3', '1.4'], 'a replacement proposed parks its task');
    await sim.refusesAsync(['raise', `${wu}.specification`, '--replaces', indexed, '--reason', 'was-wrong'], /the person answers it through the raise alone: raise draw ledger Q3$/, null, JSON.stringify(replacing));
    const kept = sim.run(['raise', 'draw', wu, 'Q3']);
    assert.strictEqual(sim.run(['raise', 'answer', kept.raise, '--pick', 'keep'], null, JSON.stringify({ why: 'Dead entries are history too.' })).receipt,
      'Q3 answered · task 1.4 builds again · nothing waiting on you');
  });
});
