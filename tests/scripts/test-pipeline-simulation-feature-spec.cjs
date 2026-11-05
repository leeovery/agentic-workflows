'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's feature scenarios on the spec's side: a feature
// discussed to its decided screen's yes, entered at its spec, the spec
// written from the writer's brief, landed, and reviewed — the first pass
// holding a rewrite and a gap the record answers, declined, so the prose
// incorporates it, the writer taking the rewrite and landing the spec
// unchanged — and cut, then ready to build's pick beginning the build and
// handing off into it, and the position switched after.
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
  Sim, handoff, answerGate, discussed, startUnit, specEntry, passTakenIn, passSurfaced, cutTheSpec, readyToBuild, intoTheBuild,
} = require('./pipeline-world.cjs');
const { standingOn } = require('./board-world.cjs');
const { leaningCall } = require('./ledger-world.cjs');

describe('pipeline simulation: feature, the spec', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('feature: its spec written, landed, reviewed — a rewrite taken by the writer, a gap declined, a gap asked as a question and surfaced with it, the person answering through the raise — and cut, ready to build\'s pick begins the build in step, handing off into it; the position switched to auto after (11.8.1, 11.7.6, 24.S4, 3.3.6)', async () => {
    const wu = 'tally';
    startUnit(sim, 'feature', wu, 'A tally of its own');
    handoff(sim, `/leeway-discussion-process feature ${wu}`);
    const { next } = discussed(sim, wu, wu);
    handoff(sim, [`/${next.skill}`, ...next.args].join(' '));
    specEntry(sim, wu, [wu]);
    const [decision] = JSON.parse(sim.read(['ledger', 'record', wu, wu])).decisions;
    sim.run(['brief', 'spec-writer', wu]);
    sim.write(`.leeway/${wu}/spec.md`, [
      '# Tally', '', '## 1. Counting', '', '### 1.1 The count', '', `1.1.1 The tally counts as decided. [${decision.id}]`, '',
      '## 1-S. Scenarios for §1', '', '1.S1 Given a tally, when it counts, then it counts as decided. (1.1.1)', '',
    ].join('\n'));
    sim.run(['spec', 'land', wu]);
    const findings = /** @type {const} */ ([{ lane: 'rewrite' }, { lane: 'gap', declined: true }, { lane: 'gap' }]);
    const pass = passTakenIn(sim, wu, [...findings]);
    const question = sim.run(['ledger', 'ask', `${wu}.specification`], null, JSON.stringify({ by: 'review', who_moved_whom: 'none', text: 'Does a tally ever reset?' })).id;
    const { raise } = await sim.runAsync(['raise', `${wu}.specification`, '--answers', question], null, JSON.stringify(leaningCall('Never.', 'At each release.')));
    passSurfaced(sim, wu, pass, [...findings], { 2: question });
    const board = (/** @type {string[]} */ args) => JSON.parse(sim.read(['board', sim.env.CLAUDE_CODE_SESSION_ID, ...args]));
    const { tab: { waiting: [asked], ...tab }, ...asking } = standingOn(board, wu);
    assert.deepStrictEqual({ tab, ...asking }, {
      tab: { now: 'specification', state: 'waits', words: '1 section' },
      all: { phase: 'specification', standing: '', waiting: 1, total: 1 },
      banner: { state: 'needs', flagged: ['1 waiting on you'] },
    }, 'S1: a gap waiting holds the specification on the feature\'s tab, All work counting it, as the banner has it');
    assert.ok(asked.startsWith('gap ') && question.startsWith(asked.slice(4)), `the tab lists the gap asked as a question, by its entry: ${asked}`);
    sim.run(['raise', 'answer', raise, '--pick', '1'], null, JSON.stringify({ why: 'A tally counts what was decided.' }));
    sim.run(['brief', 'spec-writer', wu]);
    sim.run(['spec', 'land', wu]);
    cutTheSpec(sim, wu, [{ name: 'Counting', goal: 'The tally counts.', scenarios: ['1.S1'], sections: ['1'], relies_on: [] }]);
    readyToBuild(sim, wu);
    assert.deepStrictEqual(standingOn(board, wu), {
      tab: { now: 'specification', state: 'waits', words: '1 section · 1 build phase', waiting: ['ready ready-to-build'] },
      all: { phase: 'specification', standing: '', waiting: 1, total: 1 },
      banner: { state: 'needs', flagged: ['1 waiting on you'] },
    }, 'S1, N1: ready to build\'s yes holds the specification on the feature\'s tab, listed under what waits, All work counting it, as the banner has it');
    intoTheBuild(sim, wu, sim.run(answerGate(sim, 'ready to build', '--pick', 's').next.argv));
    sim.run(['workunit', 'position', wu, 'auto']);
  });
});
