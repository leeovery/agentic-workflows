'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's epic scenarios on the spec's side: with the
// other topic postponed, the last decided going into the spec, entered at
// the unit, the spec written from the writer's brief and landed citing what
// was decided, its review's one pass settling it, its review page built and
// published, its marks read back, a re-land planned for the open page,
// and the spec cut into phases through the cut's corridor; and, with both
// topics decided, the sweep before the spec is written — briefed and taken,
// its message reopening a decided topic and its candidates taken or struck
// at approve the map, whose yes hands back to the menu; or the empty sweep,
// after which the spec lands.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario, and for the sweep an epic,
// `tessera`, its topics `alpha` and `beta` each discussed to its decided
// screen's yes, handed on to the spec — built once through the verbs and
// copied (`worldFrom`); each replays the engine calls the skill prose
// makes, in prose order, and the oracle (pipeline-oracle.cjs) audits the
// whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  Sim, worldFrom, discussed, mappedEpic, arrive, specEntry, handoff, answerGate, cutTheSpec,
} = require('./pipeline-world.cjs');

const WU = 'tessera';

// The epic both of whose topics are decided, handed on to its spec.
const bothDecided = worldFrom('pipeline-sim-tessera-', (sim) => {
  mappedEpic(sim, WU, ['alpha', 'beta']);
  discussed(sim, WU, 'alpha');
  const { next } = discussed(sim, WU, 'beta');
  handoff(sim, [`/${next.skill}`, ...next.args].join(' '));
});

describe('pipeline simulation: epic, the spec', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('epic: with the other topic postponed, the last decided goes into the spec, entered at the unit, the writer\'s spec lands citing what was decided, the review\'s one pass settles it, its review page is built, its marks are read back, a re-land is planned for the open page, and it is cut into phases (24.S3, 11.S1, 11.S2, 11.S3, 11.S11, 11.S5, 11.S33)', () => {
    const wu = 'ledgerly';
    mappedEpic(sim, wu, ['alpha', 'beta']);
    sim.run(['topic', 'postpone', wu, 'beta', '--horizon', 'next']);
    const next = discussed(sim, wu, 'alpha').next;
    assert.deepStrictEqual(next, { kind: 'handoff', skill: 'leeway-specification-process', args: ['epic', wu] });
    handoff(sim, [`/${next.skill}`, ...next.args].join(' '));
    specEntry(sim, wu, ['alpha']);
    const [decision] = JSON.parse(sim.read(['ledger', 'record', wu, 'alpha'])).decisions;
    const spec = (/** @type {string} */ statement) => sim.write(`.leeway/${wu}/spec.md`, [
      '# Ledgerly', '', '## 1. Settling', '',
      '### 1.1 What alpha decided', '', `1.1.1 ${statement} [${decision.id}]`, '',
      '## 1-S. Scenarios for §1', '', '1.S1 Given the epic, when it settles, then it holds as alpha decided. (1.1.1)', '',
    ].join('\n'));
    sim.run(['brief', 'spec-writer', wu]);
    spec('It settles as alpha decided.');
    const landed = sim.run(['spec', 'land', wu]);
    assert.deepStrictEqual([landed.statements, landed.invented], [1, []]);
    const pass = sim.run(['agent', 'dispatch', wu, 'specification', wu, '--kind', 'spec-review']);
    sim.run(['brief', 'spec-reviewer', wu, '--agent', pass.id]);
    fs.writeFileSync(pass.file, '# Spec Review — spec-review-001\n\n## Findings\n\nNone identified.\n');
    sim.run(['agent', 'scan', wu, 'specification', wu]);
    sim.run(['agent', 'ack', wu, 'specification', wu, pass.id, '--clean']);
    const ready = JSON.parse(sim.read(['checklist', 'show', 'ready-to-build', wu]));
    assert.strictEqual(ready.items.find((/** @type {{key: string}} */ item) => item.key === 'review-settled').state, 'done');
    const { batches } = sim.run(['spec', 'page', wu]);
    sim.run(['spec', 'published', wu, 'https://claude.ai/public/artifacts/ledgerly']);
    const marks = sim.run(['spec', 'marks', wu, '--file', sim.write(`.leeway/.cache/${wu}/specification/read-back.json`, { s1: { m: { '1-1-1': { s: 'comment', t: { p1000: { by: 'p', x: 'Why alpha?' } } } } } })]);
    assert.deepStrictEqual(marks.waiting.map(({ number }) => number), ['1.1.1']);
    const store = `.leeway/.cache/${wu}/specification/store`;
    for (const { collection, doc_id: doc, file_path: file } of batches.flatMap((/** @type {string} */ batch) => JSON.parse(fs.readFileSync(batch, 'utf8')))) {
      sim.write(`${store}/${collection}/${doc}.json`, fs.readFileSync(file, 'utf8'));
    }
    spec('It settles as alpha decided, and holds.');
    sim.run(['spec', 'land', wu]);
    const pushed = sim.run(['spec', 'push', wu, '--reason', 'Alpha holds once settled.', '--store', path.join(sim.dir, store), '--from', '1.1.1']);
    assert.deepStrictEqual(pushed.change.reworded, ['1-1-1']);
    // The cut's corridor: a cut `cut` refuses goes back to the agent in a
    // fresh brief, and the one it writes again lands on the manifest.
    const settle = { name: 'Settling', goal: 'The epic settles as alpha decided.', scenarios: ['1.S1'], sections: ['1.1'], relies_on: [] };
    const staged = sim.write(`.leeway/.cache/${wu}/specification/cut.json`, { phases: [{ ...settle, scenarios: [] }] });
    sim.refuses(['cut', wu, '--file', staged], /^cut: scenario 1\.S1 is in no phase$/);
    assert.strictEqual(cutTheSpec(sim, wu, [settle]).phases, 1);
    assert.deepStrictEqual(sim.manifest(wu).cut, { phases: [settle] });
  });
});

describe('pipeline simulation: epic, the sweep before the spec', () => {
  let sim;
  beforeEach(() => { sim = new Sim(bothDecided); });
  afterEach(() => { sim.destroy(); });

  it('epic: at the spec, before it is written, the sweep is briefed and taken — its message reopening a decided topic, its candidates coming to approve the map, one struck — whose yes hands back to the menu (8.10.3, 8.10.9, 8.S50)', () => {
    specEntry(sim, WU, ['alpha', 'beta']);
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
