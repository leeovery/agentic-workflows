'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's scenario for the ledger's second version: who
// decided each decision, how each finding is known, the sections an entry
// cites and a question moved to the roadmap, written through the verbs and
// read back by the record, the map, `since` and the copy.
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
const ROOT = path.join(__dirname, '../..');
const { statePath } = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/state-root.cjs'));
const { Sim, mappedEpic } = require('./pipeline-world.cjs');

describe('pipeline simulation: the ledger\'s second version', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('the ledger\'s second version: who decided each decision — the person\'s own scope call, and their "your call" and "don\'t care" Claude\'s calls — how each finding is known, a measurement with the command run and its result, the sections an entry cites, and a question moved to the roadmap as later, each written through the verbs and read back by the record, the map, `since`, the trust log and the copy', () => {
    const wu = 'fumi';
    mappedEpic(sim, wu, ['note-window']);
    sim.run(['topic', 'start', wu, 'discussion', 'note-window']);
    const note = `${wu}.discussion.note-window`;
    const made = { by: 'claude', who_moved_whom: 'none' };
    /** One write, its content on stdin: its short id. @param {string[]} args @param {Record<string, unknown>} content */
    const ledger = (args, content) => sim.run(['ledger', ...args], null, JSON.stringify(content)).id;
    /** Claude's answer to a question of its own, given as `given` says. @param {string} text @param {string} answer @param {string} given */
    const call = (text, answer, given) => ledger(['decide', note, '--answers', ledger(['ask', note], { ...made, text })], { ...made, text: answer, why: 'Tidy.', given });
    const cites = [{ path: `${wu}/discussion/note-window.md`, section: 'Session 1' }];

    const scope = ledger(['ask', note], { ...made, text: 'What does the note window cover?', cites });
    const scoped = ledger(['decide', note, '--answers', scope], { by: 'person', who_moved_whom: 'none', text: 'The window and its frame.', why: 'Where it opens is space homing\'s.', kind: 'scope', cites });
    const handed = call('Does a note snap to the grid?', 'Notes snap to an 8-point grid.', 'your-call');
    const builders = call('What radius are a note\'s corners?', 'Ten points.', 'dont-care');
    const measured = ledger(['find', note], { ...made, text: 'A panel opens in 4 ms.', how: 'timed the open', known: 'measured', command: 'swift run bench open', result: 'median 4.1 ms', cites });
    const exploratory = ledger(['find', note], { ...made, text: 'A sheet opens in 9 ms.', how: 'timed once in the conversation', known: 'exploratory', command: 'swift run bench sheet', result: '9.3 ms' });
    const syncing = ledger(['ask', note], { ...made, text: 'Do notes sync across Macs?' });
    sim.run(['roadmap', 'add', 'sync', '--horizon', 'v2', '--summary', 'Notes sync across Macs']);
    ledger(['move', note, '--question', syncing, '--to', 'roadmap:sync'], made);

    const record = sim.run(['ledger', 'record', wu, 'note-window']);
    assert.deepStrictEqual(record.decisions.map((/** @type {Record<string, unknown>} */ d) => [d.id, d.by, d.given, d.kind]), [
      [scoped, 'person', 'own', 'scope'], [handed, 'claude', 'your-call', null], [builders, 'claude', 'dont-care', null],
    ]);
    assert.deepStrictEqual(record.findings.map((/** @type {Record<string, unknown>} */ f) => [f.id, f.known, f.command, f.result, f.cites]), [
      [measured, 'measured', 'swift run bench open', 'median 4.1 ms', cites], [exploratory, 'exploratory', 'swift run bench sheet', '9.3 ms', []],
    ]);
    assert.deepStrictEqual([record.questions[0].cites, record.decisions[0].cites], [cites, cites]);
    const later = sim.run(['ledger', 'map', wu, 'note-window']).questions.find((/** @type {{id: string}} */ q) => q.id === syncing);
    assert.deepStrictEqual([later.stands, later.moved_to, later.answers], ['later', 'roadmap:sync', []]);
    assert.deepStrictEqual(sim.run(['ledger', 'since', wu, 'note-window']).calls.map((/** @type {{id: string}} */ c) => c.id), [handed, builders]);
    const copy = fs.readFileSync(statePath(sim.dir, '.knowledge', 'records', wu, 'note-window.md'), 'utf8');
    for (const line of ['Decided by the person', 'Decided by Claude, the person\'s "your call"', 'Left to the builder, the person\'s "don\'t care"',
      'How it is known: measured, timed the open', 'Command: swift run bench open', 'Later: moved to the roadmap, roadmap:sync.']) {
      assert.ok(copy.includes(line), `the copy does not say "${line}"`);
    }
  });
});
