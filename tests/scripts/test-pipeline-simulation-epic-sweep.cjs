'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's epic scenarios for the sweep before the spec:
// with both topics decided, the sweep briefed and taken before the spec is
// written — its message reopening a decided topic and its candidates taken
// or struck at approve the map, whose yes hands back to the menu; or the
// empty sweep, after which the spec lands.
//
// Layer: simulation. World: an epic, `tessera`, its topics `alpha` and
// `beta` each discussed to its decided screen's yes, handed on to the spec
// — built once through the verbs and copied (`worldFrom`, pipeline-
// world.cjs); each replays the engine calls the skill prose makes, in prose
// order, and the oracle (pipeline-oracle.cjs) audits the whole state after
// every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const {
  Sim, worldFrom, discussed, mappedEpic, arrive, specEntry, handoff, answerGate,
} = require('./pipeline-world.cjs');
const { standingOn } = require('./board-world.cjs');

const WU = 'tessera';

// The epic both of whose topics are decided, handed on to its spec.
const bothDecided = worldFrom('pipeline-sim-tessera-', (sim) => {
  mappedEpic(sim, WU, ['alpha', 'beta']);
  discussed(sim, WU, 'alpha');
  const { next } = discussed(sim, WU, 'beta');
  handoff(sim, [`/${next.skill}`, ...next.args].join(' '));
});

describe('pipeline simulation: epic, the sweep before the spec', () => {
  let sim;
  beforeEach(() => { sim = new Sim(bothDecided); });
  afterEach(() => { sim.destroy(); });

  it('epic: at the spec, before it is written, the sweep is briefed and taken — its message reopening a decided topic, its candidates coming to approve the map, one struck — whose yes hands back to the menu (8.10.3, 8.10.9, 8.S50)', () => {
    specEntry(sim, WU, ['alpha', 'beta']);
    const sweep = JSON.parse(sim.read(['checklist', 'show', 'ready-to-build', WU])).items.find((/** @type {{key: string}} */ item) => item.key === 'sweep-run');
    assert.strictEqual(sweep.state, 'open', 'two live topics owe the sweep, so it goes first');
    sim.run(['brief', 'sweep', WU]);
    sim.write(`.leeway/.cache/${WU}/specification/sweep.json`, {
      candidates: [
        { name: 'gamma', reason: 'Alpha and beta each lean on an export neither owns.', brief: '# Gamma\n\nThe export both lean on.\n' },
        { name: 'delta', reason: 'Nothing decides who cleans up.', brief: '# Delta\n\nThe clean-up.\n' },
      ],
      messages: [{ topic: 'beta', text: 'Alpha settled the order\n\nBeta takes it in.' }],
      builder_calls: [{ call: 'The export file name.', why: 'The person would leave it.' }],
    });
    const taken = sim.run(['sweep', 'take', WU]);
    assert.deepStrictEqual(taken.next, { kind: 'engine', argv: ['render', 'approve-map', WU, '--sweep'] });
    sim.render(taken.next.argv.slice(1), { expect: 'content' });
    const board = (/** @type {string[]} */ args) => JSON.parse(sim.read(['board', sim.env.CLAUDE_CODE_SESSION_ID, ...args]));
    assert.deepStrictEqual([standingOn(board, WU), board(['--tab', 'unit']).view.waiting.map((/** @type {{text: string}} */ { text }) => text)], [{
      tab: { now: 'discussion', spec: 'waits', build: 'waits', waiting: ['map approve-the-map'] },
      all: { phase: 'discussion', standing: '1 of 2 topics decided', waiting: 1, total: 1 },
      banner: { state: 'needs', waits: ['⚑ the map waits on you'] },
    }, ['Approve the map: 2 candidates the sweep found, to take or strike']], 'S1: the sweep\'s candidates wait on the person at approve the map on every view that reads the epic — its message having reopened beta, back in discussion — as the banner has it');
    sim.render(answerGate(sim, 'approve the map', '--pick', 's').next.argv.slice(1), { expect: 'content' });
    sim.render(sim.run(answerGate(sim, 'approve the map strike', '--pick', '2').next.argv).next.argv.slice(1), { expect: 'content' });
    const yes = sim.run(answerGate(sim, 'approve the map', '--pick', 'y').next.argv);
    assert.deepStrictEqual(yes.next, { kind: 'handoff', skill: 'leeway-continue-epic', args: [WU] });
    handoff(sim, `/leeway-continue-epic ${WU}`);
    arrive(sim, WU);
  });

  it('epic: the empty sweep taken, the spec carries on and lands (8.10.3, 11.S3)', () => {
    specEntry(sim, WU, ['alpha', 'beta']);
    sim.run(['brief', 'sweep', WU]);
    sim.write(`.leeway/.cache/${WU}/specification/sweep.json`, { candidates: [], messages: [], builder_calls: [] });
    assert.deepStrictEqual(sim.run(['sweep', 'take', WU]).next, { kind: 'continue' });
    sim.run(['brief', 'spec-writer', WU]);
    const [alpha] = JSON.parse(sim.read(['ledger', 'record', WU, 'alpha'])).decisions;
    const [beta] = JSON.parse(sim.read(['ledger', 'record', WU, 'beta'])).decisions;
    sim.write(`.leeway/${WU}/spec.md`, [
      '# Tessera', '', '## 1. Settling', '',
      '### 1.1 What was decided', '', `1.1.1 It settles as alpha decided. [${alpha.id}]`, '', `1.1.2 It holds as beta decided. [${beta.id}]`, '',
      '## 1-S. Scenarios for §1', '', '1.S1 Given the epic, when it settles, then it holds as decided. (1.1.1, 1.1.2)', '',
    ].join('\n'));
    sim.run(['spec', 'land', WU]);
  });
});
