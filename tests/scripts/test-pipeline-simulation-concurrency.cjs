'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's concurrent sessions on one checkout, interleaved:
// an investigation and a discussion whose commits stay confined, the
// discussion's log riding along with every state commit; the code slot
// taken at the build's entry and freed as its conversation ends; a dead peer's
// leavings swept; and the terminal clear that frees a finished topic's slot.
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
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '../..');
const { git, stateGit } = require('./engine-harness.cjs');
const { STATE_DIR_NAME } = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/state-root.cjs'));
const { Sim, mappedEpic, decideTopic, discussed, specToBuild, sessionLog } = require('./pipeline-world.cjs');

describe('pipeline simulation: concurrency', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  // -------------------------------------------------------------------------
  // Concurrency — several sessions on one checkout, interleaved.
  //
  // Every engine call is atomic under its own locks (the manifest lock, the
  // commit lock), so a sequential interleave IS the correctness test: what a
  // real concurrent run can produce is some ordering of these calls, and the
  // question a scenario has to answer is whether any ordering lets one
  // session's commit take another's paths. The invariant this pins is the
  // whole programme in one line: no commit ever contains a foreign session's
  // path (design/concurrent-phases.md).
  // -------------------------------------------------------------------------

  it('concurrent sessions: interleaved commits stay confined, the code slot holds, a dead peer is swept', () => {
    const wu = 'relay';
    const bug = 'replay-crash';
    const built = 'dispatch';

    // --- the work the sessions inherit -------------------------------------
    mappedEpic(sim, wu, ['ranking', 'metrics']);
    sim.run(['workunit', 'create', bug, 'bugfix', '--description', 'Replay crashes', '--session-log-file', sessionLog(sim, bug)]);
    sim.run(['workunit', 'create', built, 'feature', '--description', 'Dispatch events', '--session-log-file', sessionLog(sim, built)]);
    discussed(sim, built, built);
    specToBuild(sim, built, [built]);
    sim.run(['commit', wu, '-m', `workflow(${wu}): set the board`]);

    // The setup ran as one session: its entries and starts beat and its
    // closes cleared, so the scenario opens on a checkout nobody holds.
    assert.deepStrictEqual(sim.run(['presence', 'scan', wu]).sessions, [],
      'the board starts with no session holding anything');

    /** A pid that is certainly not running: a child spawned and reaped. */
    const reapedPid = () => {
      const res = spawnSync('node', ['-e', '']);
      assert.ok(res.pid, 'could not mint a dead pid');
      return res.pid;
    };

    const docSession = sim.session('investigation-session', process.ppid);
    const talkSession = sim.session('discussion-session', 1);
    const codeSession = sim.session('code-session');
    const secondCoder = sim.session('review-session', reapedPid());

    const DOC_FILE = `.leeway/${bug}/investigation/${bug}.md`;
    const TALK_FILE = `.leeway/${wu}/topics/ranking/log.md`;
    const CODE_FILE = 'src/relay/dispatch.js';
    const lines = (out) => out.split('\n').filter(Boolean);
    /** The paths the head commit on a branch carries, named from the project. */
    const committedPaths = (state) => (state
      ? lines(stateGit(sim.dir, ['show', '--name-only', '--pretty=format:', 'HEAD'])).map((l) => `${STATE_DIR_NAME}/${l.trim()}`)
      : lines(git(sim.dir, ['show', '--name-only', '--pretty=format:', 'HEAD'])).map((l) => l.trim()));
    /** Both trees' dirt, named from the project. */
    const dirty = () => [
      ...lines(git(sim.dir, ['status', '--porcelain', '-uall'])).map((l) => l.slice(3).trim()),
      ...lines(stateGit(sim.dir, ['status', '--porcelain', '-uall'])).map((l) => `${STATE_DIR_NAME}/${l.slice(3).trim()}`),
    ];
    /** No commit ever contains a foreign session's path. */
    const confined = (label, own, foreign) => {
      const paths = committedPaths(own[0].startsWith(`${STATE_DIR_NAME}/`));
      assert.ok(paths.length > 0, `[${label}] committed nothing`);
      for (const p of paths) {
        assert.ok(own.some((o) => p === o || p.startsWith(`${o}/`)),
          `[${label}] committed ${p}, outside the action's own scope`);
      }
      for (const f of foreign) {
        assert.ok(!paths.includes(f), `[${label}] swept a peer's path: ${f}`);
      }
    };
    const docScope = [DOC_FILE, `.leeway/${bug}/topics/${bug}/mail`, `.leeway/${bug}/manifest.json`];
    const talkScope = [TALK_FILE, `${STATE_DIR_NAME}/.ledger.jsonl`, `.leeway/${wu}/topics/ranking/mail`, `.leeway/${wu}/manifest.json`];
    const claudes = { by: 'claude', who_moved_whom: 'none' };
    /** A question the discussion session asks, its commit the ledger's own. @param {string} text */
    const talkAsks = (text) => talkSession.run(['ledger', 'ask', `${wu}.discussion.ranking`], JSON.stringify({ ...claudes, text })).id;

    // --- B1 · A1 · A2 · B2: a document session and a discussion, alternating
    // A: an investigation session on a bugfix. B: a discussion session on
    // ranking, whose writes are the ledger's, each committing itself. Neither
    // knows the other exists; neither commit takes the other's document —
    // save B's log, which rides along with every state commit.
    docSession.run(['topic', 'start', bug, 'investigation', bug]);
    talkSession.run(['enter', 'discussion', wu, 'ranking']);

    docSession.write(DOC_FILE, '# Investigation — Replay Crash\n\n## Symptoms\n\n- Batch intake stalls.\n');
    talkSession.write(TALK_FILE, '# Discussion — Ranking\n\n## Context\n\nOrdering under replay.\n');

    // B's question lands with A's half-written document sitting dirty beside it.
    const replayOrder = talkAsks('What orders a replay?');
    confined('B1', talkScope, [DOC_FILE]);
    assert.ok(dirty().includes(DOC_FILE), "the peer's uncommitted document survives B's commit");

    // A commits next, and B's log is already landed — so A's confinement is
    // proven by what its commit does NOT reach for, not by what is dirty.
    docSession.run(['commit', bug, '-m', `investigation(${bug}): symptoms`, '--topic', `investigation/${bug}`]);
    confined('A1', docScope, [TALK_FILE]);

    // Round two, both sessions still live, both amending their own document:
    // A's commit carries B's changed log along, and nothing else of B's.
    docSession.write(DOC_FILE, '# Investigation — Replay Crash\n\n## Symptoms\n\n- Batch intake stalls.\n- Replay is not idempotent.\n');
    talkSession.write(TALK_FILE, '# Discussion — Ranking\n\n## Context\n\nOrdering under replay.\n\n## Decisions\n\n- Order by sequence number.\n');
    docSession.run(['commit', bug, '-m', `investigation(${bug}): replay`, '--topic', `investigation/${bug}`]);
    confined('A2', [...docScope, TALK_FILE], []);
    assert.ok(committedPaths(true).includes(TALK_FILE), "every changed log rides along with a state commit, the peer's among them");
    talkSession.run(['ledger', 'decide', `${wu}.discussion.ranking`, '--answers', replayOrder],
      JSON.stringify({ ...claudes, text: 'The sequence number.', why: 'Replay must reproduce the original order.' }));
    confined('B2', talkScope, [DOC_FILE]);

    // Both artifacts survive intact — each holds its own session's words, and
    // neither lost a write to the other's commit.
    assert.match(fs.readFileSync(path.join(sim.dir, DOC_FILE), 'utf8'), /Replay is not idempotent/);
    assert.match(fs.readFileSync(path.join(sim.dir, TALK_FILE), 'utf8'), /Order by sequence number/);
    assert.deepStrictEqual(dirty().filter((p) => p === DOC_FILE || p === TALK_FILE), [],
      'both sessions committed their own work in full');

    // --- presence through the interleave -----------------------------------
    const rowOf = (scan, phase, topic) => scan.sessions.find((r) => r.phase === phase && r.topic === topic);
    const interleaved = sim.run(['presence', 'scan']);
    const docRow = rowOf(interleaved, 'investigation', bug);
    const talkRow = rowOf(interleaved, 'discussion', 'ranking');
    assert.strictEqual(docRow.session_id, 'investigation-session', "A's heartbeat carries A's identity");
    assert.strictEqual(talkRow.session_id, 'discussion-session', "B's heartbeat carries B's identity");
    assert.ok(docRow.held && talkRow.held, 'both document sessions read held');
    assert.deepStrictEqual([sim.run(['presence', 'scan', bug]), sim.run(['presence', 'scan', wu])].map((scan) => [scan.held, scan.held_sources]), [[1, 0], [1, 1]],
      'only the discussion counts as a source — a held investigation session defers no analysis');
    assert.ok(sim.sections.includes('=== DISPLAY: presence deferral') && sim.sections.replace(/\n +/g, ' ').includes('discussion/ranking (last active'),
      `the deferral section rides the scan the dispatch prose reads it from: ${sim.sections}`);

    // --- the code slot ------------------------------------------------------
    // The slot is taken at the build's entry, not at the first commit: the
    // entry that finds it free claims it, so the window between entering the
    // phase and writing anything is not a window.
    const codeSlot = path.join(sim.dir, '.leeway/.cache', built, 'implementation', built, 'presence');
    assert.ok(!fs.existsSync(codeSlot), 'nobody holds the code slot before anyone enters');
    assert.strictEqual(codeSession.run(['enter', 'implementation', built]).entered, true);
    assert.strictEqual(JSON.parse(fs.readFileSync(codeSlot, 'utf8')).session_id, 'code-session',
      "the entry is the claim");

    // A second code entrant — a different session, a different pid — is
    // gated; the holder entering again is not gated against itself.
    assert.strictEqual(secondCoder.run(['enter', 'implementation', built]).entered, false);
    assert.match(sim.sections, /Another session is implementing "Dispatch" \(dispatch\)/,
      'the gate names who holds the slot, where, and for how long');
    assert.match(sim.sections, /Code phases run one at a time/);
    // Backing out of the gate on a feature leaves the build to that session.
    assert.deepStrictEqual(secondCoder.run(['gate', 'code gate', '--pick', 'b']).next, { kind: 'continue' });
    assert.strictEqual(codeSession.run(['enter', 'implementation', built]).entered, true);

    // --- a document session commits while the code session holds ------------
    // The doc commit never takes code dirt: each half of the checkout is the
    // other's business, and both are running at once.
    sim.write(CODE_FILE, "export function dispatch(event) { return sink.write(event); }\n");
    talkSession.write(TALK_FILE, '# Discussion — Ranking\n\n## Context\n\nOrdering under replay.\n\n## Decisions\n\n- Order by sequence number.\n- Ties break on arrival.\n');
    const ties = talkAsks('How do ties break?');
    confined('B3', talkScope, [CODE_FILE]);
    assert.ok(dirty().includes(CODE_FILE), "the code session's dirt survives a doc session's commit");
    docSession.write(DOC_FILE, '# Investigation — Replay Crash\n\n## Symptoms\n\n- Batch intake stalls.\n- Replay is not idempotent.\n- Ties break on arrival.\n');
    docSession.run(['commit', bug, '-m', `investigation(${bug}): tie-break`, '--topic', `investigation/${bug}`]);
    confined('A3', docScope, [CODE_FILE, TALK_FILE]);

    // Three sessions hold, one of them code; the source count is unmoved.
    const holding = sim.run(['presence', 'scan']);
    assert.strictEqual(holding.held, 3, 'two document sessions and one code session hold');
    assert.strictEqual(sim.run(['presence', 'scan', wu]).held_sources, 1, 'a held code session defers no analysis either');
    assert.strictEqual(rowOf(holding, 'implementation', built).session_id, 'code-session');

    // --- the dead peer's leavings ------------------------------------------
    // A discussion session died mid-write: its log is uncommitted and its
    // heartbeat names a process that is gone. A concluding session sweeps it.
    const ghostPid = reapedPid();
    const ghostLog = `.leeway/${wu}/topics/metrics/log.md`;
    sim.run(['enter', 'discussion', wu, 'metrics']);
    sim.write(ghostLog, '# Discussion — Metrics\n\nHalf a paragraph.\n');
    sim.write(`.leeway/.cache/${wu}/discussion/metrics/presence`,
      JSON.stringify({ pid: ghostPid, pid_start: null, session_id: 'ghost-session' }) + '\n');
    const beforeSweep = rowOf(sim.run(['presence', 'scan', wu]), 'discussion', 'metrics');
    assert.strictEqual(beforeSweep.held, false, 'a heartbeat whose process is gone reads unheld');

    talkSession.run(['commit', wu, '--topic', 'discussion/metrics', '--sweep',
      '-m', `chore(${wu}/metrics): sweep session leavings`]);
    confined('sweep', [ghostLog, `.leeway/${wu}/topics/metrics/mail`, `.leeway/${wu}/manifest.json`],
      [DOC_FILE, TALK_FILE, CODE_FILE]);
    assert.ok(!dirty().includes(ghostLog), "the dead session's log is committed");

    // The sweeper never stamps its identity on the topic it just cleaned —
    // a beat there would resurrect a hold nobody holds.
    const afterSweep = rowOf(sim.run(['presence', 'scan', wu]), 'discussion', 'metrics');
    assert.strictEqual(afterSweep.session_id, 'ghost-session', 'the sweep left the dead record alone');
    assert.strictEqual(afterSweep.held, false, 'the swept topic is not resurrected');

    // The suppression is what did it: the same commit without `--sweep` beats.
    sim.write(ghostLog, '# Discussion — Metrics\n\nHalf a paragraph.\n\nPicked back up.\n');
    talkSession.run(['commit', wu, '--topic', 'discussion/metrics',
      '-m', `discussion(${wu}/metrics): pick the thread back up`]);
    const adopted = rowOf(sim.run(['presence', 'scan', wu]), 'discussion', 'metrics');
    assert.strictEqual(adopted.session_id, 'discussion-session', 'a session-cadence commit stamps the caller');
    assert.strictEqual(adopted.held, true);

    // --- the terminal clear -------------------------------------------------
    // The decided yes drops the heartbeat, and a commit after it, over the
    // decided item, clears instead of beating, or the topic would read held
    // forever after its session ended.
    talkSession.run(['ledger', 'decide', `${wu}.discussion.ranking`, '--answers', ties],
      JSON.stringify({ ...claudes, text: 'On arrival.', why: 'Arrival is the only order left.' }));
    decideTopic(sim, wu, 'ranking');
    talkSession.run(['commit', wu, '--topic', 'discussion/ranking',
      '-m', `discussion(${wu}): ranking decided`]);
    assert.strictEqual(rowOf(sim.run(['presence', 'scan', wu]), 'discussion', 'ranking'), undefined,
      'the terminal commit leaves the heartbeat dropped');
    assert.ok(rowOf(sim.run(['presence', 'scan']), 'investigation', bug),
      "and leaves every peer session's hold standing");

    // --- the code slot's release -------------------------------------------
    // The code session's conversation ends, and the session-end sweep frees
    // the checkout's one code slot with it, not when the process dies.
    codeSession.run(['presence', 'cleanup', 'code-session']);
    assert.strictEqual(rowOf(sim.run(['presence', 'scan', built]), 'implementation', built), undefined,
      'the conversation\'s end released the slot');
    assert.strictEqual(
      require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/presence.cjs')).heldCodeSessions(sim.dir).length, 0,
      'so the next code session walks straight in');
  });
});
