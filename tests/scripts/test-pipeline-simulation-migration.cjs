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
// otherwise than two of its decisions, each marked the migration's
// (21.6.16): each a finding relying on its decision, saying where the code
// shows it, then raised as the decision's replacement under the mark that
// always asks — the person taking the code's way on one, its finding left
// unaffected, and keeping the other, its row saying the build changes the
// code to match.
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

  it('21.6.16: the build finds the code built otherwise than two decisions from before Ledger, each marked the migration\'s, and records each as a finding relying on it, citing the code; the build turning on which stands, each is raised as the decision\'s replacement, always asking for the mark — the person takes the code\'s way on one, the finding that caused it not affected, and keeps the other, its row saying the build changes the code to match', async () => {
    sim.run(['boot']);
    const record = () => JSON.parse(sim.read(['ledger', 'record', 'memo', 'memo'])).decisions;
    const decision = (/** @type {string} */ text) => record().find((/** @type {{text: string}} */ d) => d.text === text);
    assert.deepStrictEqual([decision('One line.').session, decision('By link.').session], ['migration', 'migration'], 'the record shows each decision the migration\'s');
    const [oneLine, byLink] = [decision('One line.').id, decision('By link.').id];
    const lines = () => fs.readFileSync(path.join(sim.dir, '.ledger/.ledger.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    const builtOtherwise = async (/** @type {string} */ id, /** @type {string} */ text, /** @type {string} */ how, /** @type {Record<string, unknown>} */ call) => {
      const cause = sim.run(['ledger', 'find', 'memo.implementation', '--relies-on', id], null, JSON.stringify({ text, how, known: 'read', by: 'claude', who_moved_whom: 'none' })).id;
      const raised = await sim.runAsync(['raise', 'memo.implementation', '--replaces', id, '--reason', 'new-fact', '--cause', cause, '--always', 'built-otherwise'], null, JSON.stringify(call));
      assert.deepStrictEqual([raised.decision, raised.reason], ['ask', 'The code was built otherwise than a decision from before Ledger, so it always comes to you.']);
      return { cause, parked: raised.parked };
    };

    const longer = await builtOtherwise(oneLine, 'A memo takes up to three lines.', 'read in src/memo.js, MAX_LINES', { ...leaningCall('Up to three lines.', 'Two lines.'), question: 'How long is a memo?' });
    const byCode = await builtOtherwise(byLink, 'A memo is shared by a code, not a link.', 'read in src/share.js, shareMemo', { ...leaningCall('By code.', 'By email.'), question: 'How is a memo shared?' });

    const drawn = sim.run(['raise', 'draw', 'memo', longer.parked]);
    assert.ok(sim.sections.includes('Keep it as decided: the build changes the code to match'), 'keeping the decision says the build changes the code');
    sim.run(['raise', 'answer', drawn.raise, '--pick', '1'], null, JSON.stringify({ why: 'Three lines is what people use.' }));
    sim.run(['raise', 'answer', sim.run(['raise', 'draw', 'memo', byCode.parked]).raise, '--pick', 'keep'], null, JSON.stringify({ why: 'Links are what the spec promised.' }));

    const decided = (/** @type {string} */ text) => lines().find((e) => e.event === 'decided' && e.text === text).id;
    assert.deepStrictEqual(lines().filter((e) => e.event === 'found' && e.unit === 'memo').map((e) => [e.relies_on, e.how]), [
      [[decided('One line.')], 'read in src/memo.js, MAX_LINES'],
      [[decided('By link.')], 'read in src/share.js, shareMemo'],
    ], 'each finding relies on the decision it is about, saying where the code shows it');
    assert.deepStrictEqual(record().map((/** @type {{text: string}} */ d) => d.text).sort(), ['By link.', 'Up to three lines.'], 'the person took the code\'s way on one and kept the other');
    assert.deepStrictEqual(JSON.parse(sim.read(['ledger', 'affected', 'memo'])).affected, [], 'the finding the replacement was made for is not affected by it');
  });
});
