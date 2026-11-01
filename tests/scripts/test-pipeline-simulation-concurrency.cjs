'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's concurrent sessions on one checkout, interleaved:
// a specification session and a discussion whose commits stay confined, the
// discussion's log riding along with every state commit; the code slot
// taken at its entry and held through its commits; a dead peer's leavings
// swept; and the terminal clears that free a finished topic's slot.
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
const { Sim, mappedEpic, handoff, decideTopic, discussed } = require('./pipeline-world.cjs');

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

    // --- the map both sessions inherit -------------------------------------
    mappedEpic(sim, wu, ['ingest', 'ranking', 'metrics', 'dispatch']);

    // ingest is discussed and ready to specify; dispatch is built out to the
    // edge of implementation. Both were finished before this scenario opens.
    discussed(sim, wu, 'ingest', { question: 'How do events arrive?', answer: 'Batch intake.' });
    discussed(sim, wu, 'dispatch');
    sim.run(['topic', 'start', wu, 'specification', 'dispatch']);
    sim.run(['topic', 'complete', wu, 'specification', 'dispatch']);
    sim.run(['topic', 'start', wu, 'planning', 'dispatch']);
    sim.run(['manifest', 'set', `${wu}.planning.dispatch`,
      'format=local-markdown', 'task_list_gate_mode=gated', 'author_gate_mode=gated',
      'finding_gate_mode=gated', 'review_cycle=0', 'phase=1', 'task=~',
      'task_map.dispatch-1-1=dispatch-1-1', 'storage_paths=[]']);
    sim.run(['topic', 'complete', wu, 'planning', 'dispatch']);
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

    const specSession = sim.session('spec-session', process.ppid);
    const talkSession = sim.session('discussion-session', 1);
    const codeSession = sim.session('code-session');
    const secondCoder = sim.session('review-session', reapedPid());

    const SPEC_FILE = `.leeway/${wu}/specification/ingest/specification.md`;
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
    const specScope = [`.leeway/${wu}/specification/ingest`, `.leeway/${wu}/manifest.json`];
    const talkScope = [TALK_FILE, `${STATE_DIR_NAME}/.ledger.jsonl`, `.leeway/${wu}/topics/ranking/mail`, `.leeway/${wu}/manifest.json`];
    const claudes = { by: 'claude', who_moved_whom: 'none' };
    /** A question the discussion session asks, its commit the ledger's own. @param {string} text */
    const talkAsks = (text) => talkSession.run(['ledger', 'ask', `${wu}.discussion.ranking`], JSON.stringify({ ...claudes, text })).id;

    // --- B1 · A1 · A2 · B2: a document session and a discussion, alternating
    // A: a specification session on ingest. B: a discussion session on
    // ranking, whose writes are the ledger's, each committing itself. Neither
    // knows the other exists; neither commit takes the other's document —
    // save B's log, which rides along with every state commit.
    specSession.run(['topic', 'start', wu, 'specification', 'ingest']);
    talkSession.run(['enter', 'discussion', wu, 'ranking']);

    specSession.write(SPEC_FILE, '# Specification — Ingest\n\n## Requirements\n\n- Batch intake.\n');
    specSession.run(['manifest', 'set', `${wu}.specification.ingest`, 'sources.ingest.status', 'pending']);
    talkSession.write(TALK_FILE, '# Discussion — Ranking\n\n## Context\n\nOrdering under replay.\n');

    // B's question lands with A's half-written document sitting dirty beside it.
    const replayOrder = talkAsks('What orders a replay?');
    confined('B1', talkScope, [SPEC_FILE]);
    assert.ok(dirty().includes(SPEC_FILE), "the peer's uncommitted document survives B's commit");

    // A commits next, and B's log is already landed — so A's confinement is
    // proven by what its commit does NOT reach for, not by what is dirty.
    specSession.run(['commit', wu, '-m', `spec(${wu}/ingest): construct`, '--topic', 'specification/ingest']);
    confined('A1', specScope, [TALK_FILE]);

    // Round two, both sessions still live, both amending their own document:
    // A's commit carries B's changed log along, and nothing else of B's.
    specSession.write(SPEC_FILE, '# Specification — Ingest\n\n## Requirements\n\n- Batch intake.\n- Replay is idempotent.\n');
    talkSession.write(TALK_FILE, '# Discussion — Ranking\n\n## Context\n\nOrdering under replay.\n\n## Decisions\n\n- Order by sequence number.\n');
    specSession.run(['commit', wu, '-m', `spec(${wu}/ingest): idempotent replay`, '--topic', 'specification/ingest']);
    confined('A2', [...specScope, TALK_FILE], []);
    assert.ok(committedPaths(true).includes(TALK_FILE), "every changed log rides along with a state commit, the peer's among them");
    talkSession.run(['ledger', 'decide', `${wu}.discussion.ranking`, '--answers', replayOrder],
      JSON.stringify({ ...claudes, text: 'The sequence number.', why: 'Replay must reproduce the original order.' }));
    confined('B2', talkScope, [SPEC_FILE]);

    // Both artifacts survive intact — each holds its own session's words, and
    // neither lost a write to the other's commit.
    assert.match(fs.readFileSync(path.join(sim.dir, SPEC_FILE), 'utf8'), /Replay is idempotent/);
    assert.match(fs.readFileSync(path.join(sim.dir, TALK_FILE), 'utf8'), /Order by sequence number/);
    assert.deepStrictEqual(dirty().filter((p) => p === SPEC_FILE || p === TALK_FILE), [],
      'both sessions committed their own work in full');

    // --- presence through the interleave -----------------------------------
    const rowOf = (scan, phase, topic) => scan.sessions.find((r) => r.phase === phase && r.topic === topic);
    const interleaved = sim.run(['presence', 'scan', wu]);
    const specRow = rowOf(interleaved, 'specification', 'ingest');
    const talkRow = rowOf(interleaved, 'discussion', 'ranking');
    assert.strictEqual(specRow.session_id, 'spec-session', "A's heartbeat carries A's identity");
    assert.strictEqual(talkRow.session_id, 'discussion-session', "B's heartbeat carries B's identity");
    assert.ok(specRow.held && talkRow.held, 'both document sessions read held');
    assert.strictEqual(interleaved.held_sources, 1,
      'only the discussion counts as a source — a held spec session defers no analysis');
    assert.ok(sim.sections.includes('=== DISPLAY: presence deferral') && sim.sections.replace(/\n +/g, ' ').includes('discussion/ranking (last active'),
      `the deferral section rides the scan the dispatch prose reads it from: ${sim.sections}`);

    // --- the code slot ------------------------------------------------------
    // The slot is taken at the entry chokepoint, not at the first commit:
    // reading a free slot is how a code session claims it, so the window
    // between entering the phase and writing anything is not a window.
    const codeSlot = path.join(sim.dir, '.leeway/.cache', wu, 'implementation/dispatch/presence');
    assert.ok(!fs.existsSync(codeSlot), 'nobody holds the code slot before anyone enters');
    codeSession.render(['code-gate', `${wu}.implementation.dispatch`], { expect: 'empty' });
    assert.strictEqual(JSON.parse(fs.readFileSync(codeSlot, 'utf8')).session_id, 'code-session',
      'the entry-gate render is the claim');

    codeSession.run(['task', 'init', wu, 'dispatch']);
    codeSession.run(['task', 'start', wu, 'dispatch', 'dispatch-1-1']);
    sim.write(CODE_FILE, "export function dispatch(event) { return sink.write(event); }\n");
    // And the code commit beats it too: `--for` names the code topic, and
    // code is the one scope no layout derives.
    const firstCode = codeSession.run(['commit', '--paths', CODE_FILE, '-m', 'feat(relay): dispatch events',
      '--for', wu, 'implementation/dispatch']);
    assert.deepStrictEqual(firstCode.left_dirty, [], 'the task committed everything it touched');
    assert.strictEqual(JSON.parse(fs.readFileSync(codeSlot, 'utf8')).session_id, 'code-session',
      'the cadence commit keeps the hold alive');
    confined('C1', [CODE_FILE], [SPEC_FILE, TALK_FILE]);

    // A second code entrant — a different session, a different pid — is
    // gated; the holder reading the same surface is not gated against itself.
    const gate = secondCoder.render(['code-gate', `${wu}.review.dispatch`], { expect: 'content' });
    assert.match(gate, /Another session is implementing "Dispatch" \(relay\)/,
      'the gate names who holds the slot, where, and for how long');
    assert.match(gate, /Code phases run one at a time/);
    // Backing out of the gate on an epic hands the work to the epic menu.
    handoff(sim, `/leeway-continue-epic ${wu}`);
    codeSession.render(['code-gate', `${wu}.implementation.dispatch`], { expect: 'empty' });

    // --- a document session commits while the code session holds ------------
    // The doc commit never takes code dirt, and the code commit's left_dirty
    // never names workflow dirt: each half of the checkout is the other's
    // business, and both are running at once.
    sim.write(CODE_FILE, "export function dispatch(event) { return sink.write(event); }\nexport const ORDERED = true;\n");
    sim.write('src/relay/sink.js', '// a file the task forgot to name\n');
    talkSession.write(TALK_FILE, '# Discussion — Ranking\n\n## Context\n\nOrdering under replay.\n\n## Decisions\n\n- Order by sequence number.\n- Ties break on arrival.\n');
    const ties = talkAsks('How do ties break?');
    confined('B3', talkScope, [CODE_FILE, 'src/relay/sink.js']);
    assert.ok(dirty().includes(CODE_FILE), "the code session's dirt survives a doc session's commit");

    // Now the reverse, with a document session's dirt sitting on the tree.
    specSession.write(SPEC_FILE, '# Specification — Ingest\n\n## Requirements\n\n- Batch intake.\n- Replay is idempotent.\n- Ties break on arrival.\n');
    const secondCode = codeSession.run(['commit', '--paths', CODE_FILE, '-m', 'feat(relay): ordered dispatch',
      '--for', wu, 'implementation/dispatch']);
    confined('C2', [CODE_FILE], [SPEC_FILE, TALK_FILE]);
    assert.deepStrictEqual(secondCode.left_dirty, ['src/relay/sink.js'],
      'the forgotten code path comes back, and nothing under .leeway ever does');
    assert.ok(dirty().includes(SPEC_FILE), "the doc session's dirt is not the code session's to commit");
    specSession.run(['commit', wu, '-m', `spec(${wu}/ingest): tie-break`, '--topic', 'specification/ingest']);
    codeSession.run(['commit', '--paths', 'src/relay/sink.js', '-m', 'chore(relay): the rest',
      '--for', wu, 'implementation/dispatch']);

    // Three sessions hold, one of them code; the source count is unmoved.
    const holding = sim.run(['presence', 'scan', wu]);
    assert.strictEqual(holding.held, 3, 'two document sessions and one code session hold');
    assert.strictEqual(holding.held_sources, 1, 'a held code session defers no analysis either');
    assert.strictEqual(rowOf(holding, 'implementation', 'dispatch').session_id, 'code-session');

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
      [SPEC_FILE, TALK_FILE, CODE_FILE]);
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
    assert.ok(rowOf(sim.run(['presence', 'scan', wu]), 'specification', 'ingest'),
      "and leaves every peer session's hold standing");

    // --- the code slot's release -------------------------------------------
    // Review closes its topic and commits the report; the checkout's one code
    // slot must be free the moment the topic is finished, not when the
    // process eventually dies.
    codeSession.run(['topic', 'complete', wu, 'implementation', 'dispatch']);
    codeSession.write(`.leeway/${wu}/implementation/dispatch/report.md`, '# Implementation — Dispatch\n\nDone.\n');
    codeSession.run(['commit', wu, '--topic', 'implementation/dispatch',
      '-m', `impl(${wu}): conclude dispatch`]);
    assert.strictEqual(rowOf(sim.run(['presence', 'scan', wu]), 'implementation', 'dispatch'), undefined,
      'the close released the slot, and the commit after it did not take it back');
    assert.strictEqual(
      require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/presence.cjs')).heldCodeSessions(sim.dir).length, 0,
      'so the next code session walks straight in');
  });
});
