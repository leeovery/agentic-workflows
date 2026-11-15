'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's assets scenarios: a discussion's spike, and the
// files its entries link through the asset verbs, each link committing the
// ledger on the state branch; and the legacy files the migration kept,
// pointed out on the start menu and sorted by the pass (legacy-files.md).
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { Sim, mappedEpic, enterEntry, startMenu, startPick } = require('./pipeline-world.cjs');

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

  it('legacy files: an epic holding files the migration kept, the start menu\'s row leading to their read; the pass keeps one and records what it holds at the place\'s findings_at, citing it where it moved, read at its topic\'s opening; keeps one whole and discards one', () => {
    const wu = 'fumi';
    const legacy = `${wu}/assets/legacy`;
    mappedEpic(sim, wu, ['note-window']);
    for (const file of ['plan.md', 'research/sketch.png', 'scratch.md']) sim.write(`.leeway/${legacy}/${file}`, `${file}\n`);
    sim.run(['commit', wu, '-m', 'the migration']);

    const row = startMenu(sim).find(({ next }) => next?.kind === 'engine' && next.argv.join(' ') === 'asset legacy');
    const [{ findings_at: findingsAt }] = startPick(sim, row.key).places;
    const [{ to }] = sim.run(['asset', 'keep', wu, `${legacy}/plan.md`]).moved;
    const finding = 'The old plan ships notes before spaces.';
    sim.run(['ledger', 'find', findingsAt], null, JSON.stringify({ text: finding, how: 'read in the old plan', known: 'documented', cites: [{ path: to, section: 'plan.md' }], by: 'claude', who_moved_whom: 'none' }));
    sim.run(['asset', 'keep', wu, `${legacy}/research`]);
    sim.run(['asset', 'discard', wu, `${legacy}/scratch.md`]);

    const { discovery } = JSON.parse(sim.read(['ledger', 'product', wu, 'note-window']));
    assert.deepStrictEqual(discovery.map((/** @type {{text: string, cites: unknown}} */ { text, cites }) => [text, cites]), [[finding, [{ path: to, section: 'plan.md' }]]]);
  });
});
