'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's assets scenarios: a discussion's spike, and the
// files its entries link through the asset verbs, each link committing the
// ledger on the state branch; and the legacy files the migration kept,
// pointed out on the start menu and the epic's menu and sorted by the pass
// (legacy-files.md).
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { Sim, mappedEpic, enterEntry, startMenu, startPick, continueEpic, epicMenuAt, answerGate, shownRows } = require('./pipeline-world.cjs');

describe('pipeline simulation: assets', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('spikes and assets: a discussion enters, starts a spike and writes its code there, links Claude\'s call to it as evidence and to the file the person shared, the shared file\'s status changed and the spike\'s code lifted into the product; the call shows its files in "what have you decided without me?", and a later entry reads the spike', () => {
    const wu = 'fumi';
    const made = { by: 'claude', who_moved_whom: 'none' };
    const note = `${wu}.discussion.note-window`;
    const mock = `${wu}/assets/note-mock.png`;
    const lifted = 'Sources/Note/Frame.swift';
    mappedEpic(sim, wu, ['note-window']);
    enterEntry(sim, wu, 'discussion', 'note-window');

    const spike = sim.run(['asset', 'spike', wu, 'frame']);
    const frame = `${spike.path}/Frame.swift`;
    sim.write(`.leeway/${frame}`, 'struct Frame {}\n');
    const look = sim.run(['ledger', 'ask', note], null, JSON.stringify({ ...made, text: 'What does a note look like?' })).id;
    const call = sim.run(['ledger', 'decide', note, '--answers', look], null, JSON.stringify({ ...made, text: 'A frameless panel.', why: 'Lighter on the desk.' })).id;
    sim.run(['asset', 'add', wu, frame, '--entry', call]);
    sim.write(`.leeway/${mock}`, 'a mock the person shared\n');
    sim.run(['asset', 'add', wu, mock, '--entry', call, '--status', 'reference']);
    sim.run(['asset', 'status', wu, mock, 'canonical']);
    sim.write(lifted, 'struct Frame {}\n');
    sim.run(['asset', 'lift', wu, frame, '--into', lifted, '--entry', call]);

    const [shown] = sim.run(['ledger', 'since', wu, 'note-window']).calls;
    assert.deepStrictEqual([shown.id, shown.assets], [call, [{ path: frame, status: 'reference', into: lifted }, { path: mock, status: 'canonical', into: null }]]);
    enterEntry(sim, wu, 'discussion', 'note-window');
    assert.match(sim.sections, new RegExp(`^spike: ${spike.folder}$`, 'm'));
  });

  it('legacy files: an epic holding files the migration kept, its topic in discussion; the start menu\'s row leading to each place\'s folders, the epic\'s menu\'s to its files; the pass keeps one, records what it holds at the place\'s findings_at, citing it where it moved, and sends the question it leaves open to the topic in discussion, the send reported; keeps a folder whole and discards one; the finding read at the topic\'s opening, the message raised first', () => {
    const wu = 'fumi';
    const legacy = `${wu}/assets/legacy`;
    mappedEpic(sim, wu, ['note-window', 'spaces']);
    enterEntry(sim, wu, 'discussion', 'note-window');
    sim.run(['presence', 'cleanup', sim.env.CLAUDE_CODE_SESSION_ID]);
    sim.handOver();
    const productNotes = '.product/assets/legacy/notes.md';
    for (const file of ['plan.md', 'research/sketch.png', 'scratch.md']) sim.write(`.leeway/${legacy}/${file}`, `${file}\n`);
    sim.write(`.leeway/${productNotes}`, 'notes\n');
    sim.run(['commit', '--workflows', '-m', 'the migration']);

    const row = startMenu(sim).find(({ next }) => next?.kind === 'engine' && next.argv.join(' ') === 'asset legacy');
    assert.deepStrictEqual(startPick(sim, row.key).places, [
      { place: wu, work_type: 'epic', status: 'in-progress', in_discussion: [{ topic: 'note-window', title: 'Note Window' }], count: 3, folders: [{ path: legacy, count: 2, named: 0 }, { path: `${legacy}/research`, count: 1, named: 0 }] },
      { place: 'product', work_type: null, status: null, in_discussion: [], count: 1, folders: [{ path: '.product/assets/legacy', count: 1, named: 0 }] },
    ]);
    assert.strictEqual(sim.run(['asset', 'keep', wu, `${legacy}/research`, 'product', productNotes]).kept, 2);
    continueEpic(sim, wu);
    epicMenuAt(sim, wu);
    const { key } = shownRows(sim).find(({ next }) => next?.kind === 'engine' && next.argv.join(' ') === `asset legacy ${wu}`);
    const { findings_at: findingsAt, in_discussion: discussing } = sim.run(answerGate(sim, 'epic menu', '--pick', key).next.argv);
    assert.deepStrictEqual(discussing, [{ topic: 'note-window', title: 'Note Window' }]);

    const { to } = sim.run(['asset', 'keep', wu, `${legacy}/plan.md`]);
    const finding = 'The old plan ships notes before spaces.';
    sim.run(['ledger', 'find', findingsAt], null, JSON.stringify({ text: finding, how: 'read in the old plan', known: 'documented', cites: [{ path: to, section: 'plan.md' }], by: 'claude', who_moved_whom: 'none' }));
    const [{ topic }] = discussing;
    const message = sim.write(`.leeway/.cache/${wu}/discovery/${wu}/message-old-plan.md`, 'The old plan\n\nIt leaves open whether a note opens in its own window.\n');
    const sent = sim.run(['topic', 'send', wu, topic, '--from', `${wu}.discovery`, '--content', message, '--slug', 'old-plan']);
    assert.match(sim.render(['send-report', `${wu}.${topic}`, '--sent', sent.message_path], { expect: 'content' }), /^Sent to Note Window, on Fumi$/m);
    const { files } = sim.run(['asset', 'legacy', wu]);
    assert.deepStrictEqual(files, [{ path: `${legacy}/scratch.md`, named: 0, dead: 0 }]);
    sim.run(['asset', 'discard', wu, `${legacy}/scratch.md`]);

    const { discovery } = JSON.parse(sim.read(['ledger', 'product', wu, topic]));
    assert.deepStrictEqual(discovery.map((/** @type {{text: string, cites: unknown}} */ { text, cites }) => [text, cites]), [[finding, [{ path: to, section: 'plan.md' }]]]);
    sim.handOver();
    enterEntry(sim, wu, 'discussion', topic);
    assert.match(sim.sections, /^=== DISPLAY: waiting mail [^\n]*\n1 message waiting — raised before anything else\n\nFrom Discovery · \d{1,2} [A-Z][a-z]{2}\nThe old plan\n/);
  });
});
