'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation of the whole migration (21.S1, 21.S3, 27.S1,
// 2.S10): a project on today's shape from 072 boots into the migration —
// the guard passing, the chain and the move run, boot stopping at the
// records directive and then at the cut and the merges', each met as the
// migration at work, its screen drawn, and each worked by its
// scripted session, then at the finish, whose review and gate the yes
// commits, the project's code untouched — and the next boot reaches the
// start menu. The migrated state passes the migration audit, its one dead
// link the old state's own, and the oracle's: its state, and the trust log
// of the system config folder the migration ran under, which starts empty,
// learning no call of the decisions the records carried (`given:
// carried`). Then the build of the migrated feature, its entry naming the
// reference on decisions from before Ledger, finds its code built otherwise
// than two of its decisions, each marked the migration's (21.6.16), the
// second the person's by its line: each a finding relying on its decision,
// saying where the code shows it. Where
// the code plainly stands, the decision's replacement is raised without the
// mark and goes through the ask rule, landing as Claude's call, its finding
// left unaffected; where either could stand, it is raised under the mark
// that always asks for the mark, never for being the person's, the task
// that would change the code parked and Claude leaning to keep, and the
// person keeps it, its row saying the build changes the code to match, the
// finding replaced once the code matches.
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
const { labelling } = require('./labels.cjs');
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
    assert.deepStrictEqual(made.boots, ['directive-arrival 079-records', 'directive-arrival 080-cut-and-merges', 'finish', 'ready']);
    assert.strictEqual(git(sim.dir, ['diff', 'HEAD~1', 'HEAD', '--', 'README.md']), '', 'the migration\'s commit changes none of the project\'s code');

    const report = audit(sim.dir, made.old);
    assert.deepStrictEqual([report.faults, report.already_dead], [[], ['gateway/topics/auth/log.md: [old RFC](../research/rfc.md)']]);
    auditState(sim.dir, 'the state the migration committed');
    assert.ok(!fs.existsSync(path.join(made.configDir, TRUST_LOG)), 'the trust log starts empty');
    auditTrust({ dir: sim.dir, configDir: made.configDir }, 'the decisions the records carried');

    assert.strictEqual(sim.run(['boot']).go, 'menu');
    assert.deepStrictEqual(startMenu(sim).map(({ head }) => head).filter((head) => head.startsWith('Continue')), ['Continue feature: Memo', 'Continue epic: Gateway']);
  });

  it('21.6.16: the build\'s entry names the reference on decisions from before Ledger, the unit holding two from before Ledger, the second the person\'s by its line; finding the code built otherwise than each, it records each as a finding relying on it, citing the code — on one the code plainly stands, and the decision\'s replacement, raised without the mark, goes through the ask rule and lands as Claude\'s call, the finding that caused it not affected; on the other either could stand, so it is raised under the mark that always asks, asking for the mark, the task that would change the code parked and Claude leaning to keep: the person keeps it, its row saying the build changes the code to match, and once it does the finding is replaced with what the code does then', async () => {
    sim.run(['boot']);
    sim.run(['enter', 'implementation', 'memo']);
    assert.match(sim.sections, /^decisions from before: \S+\/ledger-shared\/references\/decisions-from-before\.md — /m, 'the build\'s entry names the reference');
    const record = () => JSON.parse(sim.read(['ledger', 'record', 'memo', 'memo'])).decisions;
    const decision = (/** @type {string} */ text) => record().find((/** @type {{text: string}} */ d) => d.text === text);
    assert.deepStrictEqual([decision('One line.').session, decision('By link.').session], ['migration', 'migration'], 'the record shows each decision the migration\'s');
    const [oneLine, byLink] = [decision('One line.').id, decision('By link.').id];
    const lines = () => fs.readFileSync(path.join(sim.dir, '.ledger/.ledger.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    const found = (/** @type {string} */ id, /** @type {Record<string, string>} */ finding) => sim.run(['ledger', 'find', 'memo.implementation', '--relies-on', id], null, JSON.stringify({ ...finding, known: 'read', by: 'claude', who_moved_whom: 'none' })).id;
    const replacing = (/** @type {string} */ id, /** @type {string} */ cause) => ['raise', 'memo.implementation', '--replaces', id, '--reason', 'new-fact', '--cause', cause];

    const longer = found(oneLine, { text: 'A memo takes up to three lines.', how: 'read in src/memo.js, MAX_LINES' });
    const threeLines = { ...leaningCall('Up to three lines.', 'Two lines.'), question: 'How long is a memo?', sort: 'one' };
    const call = await sim.runAsync(replacing(oneLine, longer), labelling(threeLines.question, 'behaviour'), JSON.stringify(threeLines));
    assert.strictEqual(call.decision, 'proceed', 'the code plainly standing, the replacement goes through the ask rule and lands as Claude\'s call');

    const shared = { text: 'A memo is shared by a code, not a link.', how: 'read in src/share.js, shareMemo' };
    const byCode = found(byLink, shared);
    const sharing = { ...leaningCall('By code.', 'By email.'), question: 'How is a memo shared?', lean: 'keep' };
    const raised = await sim.runAsync([...replacing(byLink, byCode), '--always', 'built-otherwise', '--parks', '2.1'], null, JSON.stringify(sharing));
    assert.deepStrictEqual([raised.decision, raised.reason, raised.task], ['ask', 'The code was built otherwise than a decision from before Ledger, so it always comes to you.', '2.1'], 'under the mark it asks, parking the task that would change the code');

    const kept = sim.run(['raise', 'draw', 'memo', raised.parked]);
    assert.ok(sim.sections.includes('Keep it as decided: the build changes the code to match'), 'keeping the decision says the build changes the code');
    assert.ok(sim.sections.includes('I lean: By link.'), 'Claude leans to keep it');
    sim.run(['raise', 'answer', kept.raise, '--pick', 'keep'], null, JSON.stringify({ why: 'Links are what the spec promised.' }));
    const now = { text: 'A memo is shared by a link.', how: 'read in src/share.js, shareMemo' };
    sim.run(['ledger', 'replace', 'memo.implementation', '--replaces', byCode, '--reason', 'was-wrong', '--relies-on', byLink], null, JSON.stringify({ ...now, drops: [shared.text], known: 'read', by: 'claude', who_moved_whom: 'none' }));

    const decided = (/** @type {string} */ text) => lines().find((e) => e.event === 'decided' && e.text === text).id;
    assert.deepStrictEqual(lines().filter((e) => ['found', 'replaced'].includes(e.event) && e.of !== 'decision' && e.unit === 'memo').map((e) => [e.text, e.relies_on, e.how]), [
      ['A memo takes up to three lines.', [decided('One line.')], 'read in src/memo.js, MAX_LINES'],
      [shared.text, [decided('By link.')], shared.how],
      [now.text, [decided('By link.')], now.how],
    ], 'each finding relies on the decision it is about, saying where the code shows it, the kept one\'s replaced once the code matches');
    assert.deepStrictEqual(lines().filter((e) => e.event === 'kept').map((e) => e.who_moved_whom), ['none'], 'the keep took Claude\'s lean');
    assert.deepStrictEqual(record().map((/** @type {{text: string}} */ d) => d.text).sort(), ['By link.', 'Up to three lines.'], 'the code\'s way taken on one, the other kept');
    assert.strictEqual(decision('Up to three lines.').by, 'claude', 'the code\'s way taken as Claude\'s call');
    assert.deepStrictEqual(JSON.parse(sim.read(['ledger', 'affected', 'memo'])).affected, [], 'the finding the replacement was made for is not affected by it');
  });
});
