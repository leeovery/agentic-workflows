'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's epic scenario on the spec's side: with the
// other topic postponed, the last decided going into the spec, entered at
// the unit, its checklist saying where it stands, the spec written from the
// writer's brief and landed citing what was decided, its review's one pass
// settling it, the spec cut into phases through the cut's corridor, the cut
// staged taken with no file named, and ready to build closed, its review
// row building the page, published, its marks read back to the file the
// publishing names, the wording agreed briefed to the writer and re-landed
// onto the open page — the close voided and the review reopened until a
// pass on the re-land and the checklist closed again — the marks read back
// and stored before the screen is drawn, then the pick taking them read
// back fresh, the build begun and handed off into, and its position
// switched; then a builder's question parking its task, counted on the
// epic's start menu row in a new session, read from the ledger, and the
// epic's Continue opening on its menu with the question first. The sweep
// before the spec is test-pipeline-simulation-epic-sweep.cjs's.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; it replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  Sim, discussed, mappedEpic, specEntry, handoff, answerGate, specReviewed, cutTheSpec, readyToBuild, intoTheBuild,
  buildEntry, writePhaseTasks, startPhase, startRow, continueUnit, epicKey,
} = require('./pipeline-world.cjs');
const { leaningCall } = require('./ledger-world.cjs');

describe('pipeline simulation: epic, the spec', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('epic: with the other topic postponed, the last decided goes into the spec, entered at the unit, the writer\'s spec lands citing what was decided, the review\'s one pass settles it, it is cut into phases and ready to build is closed, whose review row builds the page, its marks read back, the wording agreed re-landed onto the open page — voiding the close and reopening the review until a pass and a close again — and the pick over the open page begins the build, handing off into it, its position switched after (24.S3, 24.S4, 11.S1, 11.S2, 11.S3, 11.S11, 11.S5, 11.S33, 11.S26, 3.S14); a builder\'s question waiting there shows in a new session on the start menu and first on the epic\'s menu (5.S23, 18.S3, 18.2.4)', async () => {
    const wu = 'ledgerly';
    mappedEpic(sim, wu, ['alpha', 'beta']);
    sim.run(['topic', 'postpone', wu, 'beta', '--horizon', 'next']);
    const next = discussed(sim, wu, 'alpha').next;
    assert.deepStrictEqual(next, { kind: 'handoff', skill: 'leeway-specification-process', args: ['epic', wu] });
    handoff(sim, [`/${next.skill}`, ...next.args].join(' '));
    specEntry(sim, wu, ['alpha']);
    const ready = () => Object.fromEntries(JSON.parse(sim.read(['checklist', 'show', 'ready-to-build', wu])).items.map((/** @type {{key: string, state: string}} */ item) => [item.key, item.state]));
    const entered = ready();
    assert.deepStrictEqual([entered['topics-settled'], entered['statements-traced'], entered['sweep-run']], ['done', 'open', undefined], 'one live topic owes no sweep, so the writer goes first');
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
    assert.strictEqual(specReviewed(sim, wu).id, 'spec-review-001');
    assert.strictEqual(ready()['review-settled'], 'done');
    // The cut's corridor: a cut `cut` refuses goes back to the agent in a
    // fresh brief, and the one it writes again lands on the manifest.
    const settle = { name: 'Settling', goal: 'The epic settles as alpha decided.', scenarios: ['1.S1'], sections: ['1.1'], relies_on: [] };
    sim.write(`.leeway/.cache/${wu}/specification/cut.json`, { phases: [{ ...settle, scenarios: [] }] });
    sim.refuses(['cut', wu], /^cut: scenario 1\.S1 is in no phase$/);
    assert.strictEqual(cutTheSpec(sim, wu, [settle]).phases, 1);
    assert.deepStrictEqual(sim.manifest(wu).cut, { phases: [settle] });
    // Ready to build, closed, offers the review page; its row builds it.
    readyToBuild(sim, wu, ['--page']);
    const review = answerGate(sim, 'ready to build', '--pick', 'r');
    assert.deepStrictEqual(review.next, { kind: 'engine', argv: ['spec', 'page', wu] });
    const { batches } = sim.run(review.next.argv);
    const { read_back: readBack } = sim.run(['spec', 'published', wu, 'https://claude.ai/public/artifacts/ledgerly']);
    /** The page's marks, read back to the file the publishing named. @param {Record<string, unknown>} marks */
    const readBackAs = (marks) => fs.writeFileSync(readBack, JSON.stringify(marks));
    // The person comments; Claude answers beneath the line, and the wording
    // agreed goes to the writer, never the ledger, and lands, the open page
    // brought up to it.
    readBackAs({ s1: { m: { '1-1-1': { s: 'comment', t: { p1000: { by: 'p', x: 'Say it holds?' } } } } } });
    const marks = sim.run(['spec', 'marks', wu, '--file', readBack]);
    assert.deepStrictEqual(marks.waiting.map(({ number }) => number), ['1.1.1']);
    const store = `.leeway/.cache/${wu}/specification/store`;
    for (const { collection, doc_id: doc, file_path: file } of batches.flatMap((/** @type {string} */ batch) => JSON.parse(fs.readFileSync(batch, 'utf8')))) {
      sim.write(`${store}/${collection}/${doc}.json`, fs.readFileSync(file, 'utf8'));
    }
    const wording = `.leeway/.cache/${wu}/specification/wording.md`;
    sim.write(wording, '1.1.1: It settles as alpha decided, and holds.\n');
    sim.run(['brief', 'spec-writer', wu, '--wording', wording]);
    spec('It settles as alpha decided, and holds.');
    sim.run(['spec', 'land', wu]);
    const pushed = sim.run(['spec', 'push', wu, '--reason', 'Alpha holds once settled.', '--store', path.join(sim.dir, store), '--from', '1.1.1']);
    assert.deepStrictEqual(pushed.change.reworded, ['1-1-1']);
    // The re-land after the close voids it and reopens the review: a pass on
    // the re-land, and the checklist worked afresh and closed again.
    sim.refuses(['render', 'ready-to-build', wu], /a land after the close voids it/);
    assert.strictEqual(ready()['review-settled'], 'open');
    specReviewed(sim, wu);
    // The page open, its marks are read back and stored before the screen is
    // drawn — the comment answered, none waits — and the pick hands on them
    // read back fresh; the yes records the review and begins the build,
    // handing off into it.
    const answered = { s1: { m: { '1-1-1': { s: 'comment', t: { p1000: { by: 'p', x: 'Say it holds?' }, c3000: { by: 'c', x: 'It holds now.' } } } } } };
    readBackAs(answered);
    assert.deepStrictEqual(sim.run(['spec', 'marks', wu, '--file', readBack]).waiting, []);
    readyToBuild(sim, wu, ['--page']);
    readBackAs(answered);
    const picked = answerGate(sim, 'ready to build', '--pick', 'a');
    assert.deepStrictEqual(picked.next.argv.slice(-2), ['--marks', readBack]);
    assert.strictEqual(intoTheBuild(sim, wu, sim.run(picked.next.argv)).record, `${wu}/spec-review.json`);
    sim.run(['workunit', 'position', wu, 'step']);

    // A builder's question parks its task; in a new session the start menu
    // counts it on the epic's row, read from the ledger, and the epic's
    // Continue opens on its menu with the question first.
    buildEntry(sim, wu);
    writePhaseTasks(sim, wu, 1, 'The work', [{ title: 'Keep the ledger', scenarios: ['1.S1'] }]);
    startPhase(sim, wu, 1);
    sim.run(['task', 'start', wu, '1.1']);
    const asks = 'Is the ledger signed?';
    const question = sim.run(['ledger', 'ask', `${wu}.implementation`, '--task', '1.1'], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: asks })).id;
    await sim.runAsync(['raise', `${wu}.implementation`, '--answers', question, '--parks', '1.1'], null, JSON.stringify({ ...leaningCall('Yes.', 'No.'), question: asks }));
    sim.handOver();
    assert.match(startRow(sim, wu), /1 question waiting for you$/);
    assert.strictEqual(continueUnit(sim, wu).text, `Invoke \`/leeway-continue-epic ${wu}\`.`);
    sim.handOver();
    const first = epicKey(sim, wu, '1');
    assert.deepStrictEqual([first.head, first.recommended], [asks, true]);
  });
});
