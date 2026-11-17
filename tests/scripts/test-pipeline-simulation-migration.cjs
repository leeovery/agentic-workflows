'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation of the whole migration (21.S1, 21.S3, 27.S1,
// 2.S10): a project on today's shape from 072 boots into the migration —
// the guard passing, the chain and the move run, boot stopping at the
// records directive and then at the cut and the merges', each worked by its
// scripted session, then at the finish, whose review and gate the yes
// commits, the project's code untouched — and the next boot reaches the
// start menu. The migrated state passes the migration audit, its one dead
// link the old state's own, and the oracle's: its state, and the trust log
// of the system config folder the migration ran under, which starts empty,
// learning no call of the decisions the records carried (`given:
// carried`). Then the build of the migrated feature finds its code built
// otherwise than two of those decisions (21.6.5): each a finding relying on
// its decision, saying where the code shows it; the one the work turns on
// raised as the decision's replacement, the person keeping it.
//
// Layer: simulation. World: the project migrated whole (migration-sequence-
// world.cjs), made ready for a sim once per process and copied for each
// scenario; the oracle (pipeline-oracle.cjs) audits the whole state after
// every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { templateFolder, copyWorld } = require('./discovery-test-utils.cjs');
const { migratedProject } = require('./migration-sequence-world.cjs');
const { Sim, readyForSim, startMenu } = require('./pipeline-world.cjs');
const { auditState, auditTrust } = require('./pipeline-oracle.cjs');
const { audit } = require('./migration-audit.cjs');
const { git } = require('./engine-harness.cjs');
const { leaningCall } = require('./ledger-world.cjs');
const { labelAnswers } = require('./labels.cjs');
const { TRUST_LOG } = require('../../skills/ledger-engine/scripts/domain/trust-log.cjs');

/** @type {ReturnType<typeof migratedProject>} */
let made;

/** The migrated project, copied for one sim. */
const migrated = () => copyWorld(made.dir, fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-migration-')));

describe('pipeline simulation: the whole migration', () => {
  /** @type {Sim} */
  let sim;
  before(() => {
    made = migratedProject(templateFolder('pipeline-migration-template-'));
    readyForSim(made.dir);
  });
  beforeEach(() => { sim = new Sim(migrated); });
  afterEach(() => { sim.destroy(); });

  it('21.S1, 21.S3, 27.S1: the project boots into the migration — the guard passing, boot stopping at each directive its session works, then at the finish its yes commits, the project\'s code untouched — and the next boot reaches the start menu, the state passing the migration audit and the oracle\'s, the trust log the migration ran under starting empty, learning no call of a carried decision', () => {
    assert.deepStrictEqual(made.boots, ['directive 079-records', 'directive 080-cut-and-merges', 'finish', 'ready']);
    assert.strictEqual(git(sim.dir, ['diff', 'HEAD~1', 'HEAD', '--', 'README.md']), '', 'the migration\'s commit changes none of the project\'s code');

    const report = audit(sim.dir, made.old);
    assert.deepStrictEqual([report.faults, report.already_dead], [[], ['gateway/topics/auth/log.md: [old RFC](../research/rfc.md)']]);
    auditState(sim.dir, 'the state the migration committed');
    assert.ok(!fs.existsSync(path.join(made.configDir, TRUST_LOG)), 'the trust log starts empty');
    auditTrust({ dir: sim.dir, configDir: made.configDir }, 'the decisions the records carried');

    assert.strictEqual(sim.run(['boot']).go, 'menu');
    assert.deepStrictEqual(startMenu(sim).map(({ head }) => head).filter((head) => head.startsWith('Continue')), ['Continue feature: Memo', 'Continue epic: Gateway']);
  });

  it('21.6.5: the build finds the code built otherwise than two decisions carried over, recording each as a finding relying on it, citing the code — one the work goes on past, nothing asked; the other the work turns on, raised as its replacement, the person\'s keep leaving it standing', async () => {
    sim.run(['boot']);
    const carried = (/** @type {string} */ text) => JSON.parse(sim.read(['ledger', 'record', 'memo', 'memo'])).decisions.find((/** @type {{text: string}} */ d) => d.text === text).id;
    const [oneLine, byLink] = [carried('One line.'), carried('By link.')];
    const found = (/** @type {string} */ decision, /** @type {string} */ text, /** @type {string} */ how) => sim.run(['ledger', 'find', 'memo.implementation', '--relies-on', decision], null,
      JSON.stringify({ text, how, known: 'read', by: 'claude', who_moved_whom: 'none' })).id;
    const lines = () => fs.readFileSync(path.join(sim.dir, '.ledger/.ledger.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));

    found(oneLine, 'A memo takes up to three lines.', 'read in src/memo.js, MAX_LINES');
    assert.deepStrictEqual(JSON.parse(sim.read(['raise', 'waiting', 'memo'])).waiting, [], 'a finding the work goes on past asks nothing');

    const byCode = found(byLink, 'A memo is shared by a code, not a link.', 'read in src/share.js, shareMemo');
    const question = 'Is a memo shared by link or by code?';
    sim.env = { ...sim.env, CLAUDE_STUB_ANSWERS: JSON.stringify({ [question]: labelAnswers('behaviour'), '': 'no-login' }) };
    const raised = await sim.runAsync(['raise', 'memo.implementation', '--replaces', byLink, '--reason', 'new-fact', '--cause', byCode], null,
      JSON.stringify({ ...leaningCall('By code, as built.', 'By link, as decided.'), question }));
    assert.deepStrictEqual([raised.decision, raised.parked], ['ask', 'Q1']);
    const drawn = sim.run(['raise', 'draw', 'memo', 'Q1']);
    sim.run(['raise', 'answer', drawn.raise, '--pick', 'keep'], null, JSON.stringify({ why: 'Links are what the spec promised.' }));

    const findings = lines().filter((e) => e.event === 'found' && e.unit === 'memo');
    const decided = (/** @type {string} */ text) => lines().find((e) => e.event === 'decided' && e.text === text).id;
    assert.deepStrictEqual(findings.map((e) => [e.phase, e.relies_on, e.how]), [
      ['implementation', [decided('One line.')], 'read in src/memo.js, MAX_LINES'],
      ['implementation', [decided('By link.')], 'read in src/share.js, shareMemo'],
    ], 'each finding relies on the decision it is about, saying where the code shows it');
    assert.strictEqual(lines().at(-1).event, 'kept');
    assert.deepStrictEqual([carried('One line.'), carried('By link.')], [oneLine, byLink], 'both decisions still stand');
  });
});
