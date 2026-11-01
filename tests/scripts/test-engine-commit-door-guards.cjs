'use strict';

// ---------------------------------------------------------------------------
// The commit door's guards and degrades: the heartbeats the self-referential
// verbs carry, never a code commit on the state branch or inside an
// operation git holds open, a confined commit that does not land leaving the
// index as it found it, the index.lock retry and the commit lock, transaction
// tails committing their own scope, two live sessions on one checkout, a
// push the remote refuses, and the transaction-tail degrade.
//
// Layer: git. World: the project world and its code projects, built once and
// copied (engine-harness.cjs), the commit door's epic over them
// (commit-door-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const harness = require('./engine-harness.cjs');
const { ENGINE, ok, refuses, git, stateGit, commitAll, cleanupFixture, fixtureFrom, setupGitFixture, STATE_DIR_NAME, statePath, layout, createFile, writeState, readState } = harness;
const { headFiles, statusLines, codeHeadFiles, codeStatusLines, holdStateRef, epicManifest, implementing, setupTwoTopicFixture } = require('./commit-door-world.cjs');
const { withCommitLock, commitAcrossRepos, commitPathspecScoped } = require('../../skills/leeway-engine/scripts/domain/commit.cjs');

describe('mechanical heartbeats: the self-referential rule', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  const beatFile = (phase, topic) => statePath(dir, layout.cache('payments', phase, topic, 'presence'));
  const beaten = (phase, topic) => fs.existsSync(beatFile(phase, topic));

  it('the session-cadence commit beats; the conclusion commit clears; --sweep suppresses', () => {
    writeState(dir, layout.doc('payments', 'investigation', 'topic-a'), '# Topic A\nprogress\n');
    ok(dir, ['commit', 'payments', '-m', 'investigation(payments/topic-a): progress', '--topic', 'investigation/topic-a']);
    assert.ok(beaten('investigation', 'topic-a'), 'the cadence commit is the heartbeat');

    // The conclusion: `topic complete` then its commit. The completed item
    // makes that commit a release, so a concluded topic never reads held.
    writeState(dir, layout.doc('payments', 'investigation', 'topic-a'), '# Topic A\nconcluded\n');
    ok(dir, ['topic', 'complete', 'payments', 'investigation', 'topic-a']);
    ok(dir, ['commit', 'payments', '-m', 'investigation(payments): complete topic-a', '--topic', 'investigation/topic-a']);
    assert.ok(!beaten('investigation', 'topic-a'), 'the conclusion commit clears instead of beating');

    // The conclude sweep committing a dead session's leavings must not
    // resurrect the hold it just swept.
    writeState(dir, layout.doc('payments', 'investigation', 'topic-b'), '# Topic B\ndead session leavings\n');
    ok(dir, ['commit', 'payments', '-m', 'chore(payments/topic-b): sweep session leavings', '--topic', 'investigation/topic-b', '--sweep']);
    assert.ok(!beaten('investigation', 'topic-b'), '--sweep never stamps the swept topic');
  });

  it('--sweep leaves a live peer\'s hold as it found it — neither stamped nor cleared', () => {
    // The spec-side resolution edits and reindexes another phase's document;
    // a peer that is alive but idle still holds it.
    const peer = beatFile('investigation', 'topic-b');
    fs.mkdirSync(path.dirname(peer), { recursive: true });
    fs.writeFileSync(peer, JSON.stringify({ pid: 1, pid_start: null, session_id: 'peer' }) + '\n');

    writeState(dir, layout.doc('payments', 'investigation', 'topic-b'), '# Topic B\nresolution landed\n');
    ok(dir, ['commit', 'payments', '-m', 'investigation(payments/topic-b): supersede the decision',
      '--topic', 'investigation/topic-b', '--sweep']);

    assert.ok(beaten('investigation', 'topic-b'), 'the peer\'s hold stands');
    assert.strictEqual(JSON.parse(fs.readFileSync(peer, 'utf8')).session_id, 'peer',
      'and this session\'s identity is never stamped over the peer\'s');
  });

  it('--sweep outranks the terminal-status release too — the live spec-side case', () => {
    // The document a spec sources is `completed`, and its own session may be
    // sitting in it idle-but-alive (a reopen, a correction round). Terminal
    // status releases a slot this session holds; it must never release one
    // this session is only visiting.
    ok(dir, ['topic', 'start', 'payments', 'investigation', 'topic-b']);
    ok(dir, ['topic', 'complete', 'payments', 'investigation', 'topic-b']);
    const peer = beatFile('investigation', 'topic-b');
    fs.mkdirSync(path.dirname(peer), { recursive: true });
    fs.writeFileSync(peer, JSON.stringify({ pid: 1, pid_start: null, session_id: 'peer' }) + '\n');

    writeState(dir, layout.doc('payments', 'investigation', 'topic-b'), '# Topic B\nthe resolution landed\n');
    ok(dir, ['commit', 'payments', '-m', 'investigation(payments/topic-b): supersede the decision',
      '--topic', 'investigation/topic-b', '--sweep']);

    assert.strictEqual(JSON.parse(fs.readFileSync(peer, 'utf8')).session_id, 'peer',
      'a completed topic another session holds is still that session\'s to release');
  });

  it('--sweep still requires a --topic scope', () => {
    assert.match(refuses(dir, ['commit', 'payments', '-m', 'x', '--sweep']).error, /Usage/);
  });

  it('the topic verbs a session runs on its own topic beat — and the reads and a send never create one', () => {
    const me = { CLAUDE_PID: String(process.pid), CLAUDE_CODE_SESSION_ID: 'door-sess' };
    // The mailbox read is reachable for any topic — a session checking a
    // foreign mailbox must not manufacture a hold there.
    ok(dir, ['topic', 'mailbox', 'payments', 'topic-a'], { env: me });
    assert.ok(!beaten('discussion', 'topic-a'), 'a mailbox read never creates a heartbeat');

    ok(dir, ['topic', 'start', 'payments', 'planning', 'topic-a'], { env: me });
    assert.ok(beaten('planning', 'topic-a'), 'start opens the session\'s own topic');

    writeState(dir, layout.mailbox('payments', 'topic-a', '001-first.md'), 'First\n');
    commitAll(dir, 'a delivered message');
    const question = ok(dir, ['ledger', 'ask', 'payments.discussion.topic-a'], { env: me, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'First?' }) }).id;
    assert.ok(!beaten('discussion', 'topic-a'), 'the question itself beats nothing');
    ok(dir, ['topic', 'answered', 'payments', 'topic-a', '001-first', '--entry', question], { env: me });
    assert.ok(beaten('discussion', 'topic-a'), 'answering a message is the session\'s work on its own topic');

    // The per-turn mailbox poll on the session's own topic is turn coverage:
    // it refreshes the hold the write-shaped verbs established.
    const own = beatFile('discussion', 'topic-a');
    const past = new Date(Date.now() - 20 * 60 * 1000);
    fs.utimesSync(own, past, past);
    ok(dir, ['topic', 'mailbox', 'payments', 'topic-a'], { env: me });
    assert.ok(fs.statSync(own).mtimeMs > Date.now() - 60 * 1000, 'the poll keeps the owned hold live');

    // Delivery acts on the TARGET topic from the origin's session — a beat
    // there would manufacture a hold on a topic no session is in.
    writeState(dir, layout.cache('scratch', 'c.md'), 'Q\n');
    ok(dir, ['topic', 'send', 'payments', 'topic-b', '--from', 'topic-a',
      '--content', path.join(STATE_DIR_NAME, layout.cache('scratch', 'c.md')), '--slug', 'q'], { env: me });
    assert.ok(!beaten('discussion', 'topic-b'), 'send never beats the target');
  });

  it('no field write beats — a three-segment set is often a cross-phase write', () => {
    // Storage-path backfills, review's `updated` stamp and the epic menu's
    // unblock all write one phase's item from another phase's session. A beat
    // there mints a hold on a topic nobody is in.
    ok(dir, ['manifest', 'set', 'payments.discussion.topic-a', 'status', 'in-progress']);
    assert.ok(!beaten('discussion', 'topic-a'), 'a field write is not a session claiming the topic');

    ok(dir, ['manifest', 'set', 'payments.discussion', 'gate_mode', 'gated']);
    assert.ok(!beaten('discussion', 'topic-b'), 'a phase-level write names no topic');

    const ops = JSON.stringify([{ op: 'set', path: 'payments.discussion.topic-b', fields: { status: 'in-progress' } }]);
    writeState(dir, layout.cache('scratch', 'ops.json'), ops);
    ok(dir, ['manifest', 'apply', 'payments', '--file', path.join(STATE_DIR_NAME, layout.cache('scratch', 'ops.json'))]);
    assert.ok(!beaten('discussion', 'topic-b'), 'apply writes across topics — the analysis session holds none of them');
  });

  it('the close releases the slot, and every commit after it keeps it released', () => {
    ok(dir, ['topic', 'start', 'payments', 'planning', 'topic-a']);
    assert.ok(beaten('planning', 'topic-a'), 'start opens the topic');

    ok(dir, ['topic', 'complete', 'payments', 'planning', 'topic-a']);
    assert.ok(!beaten('planning', 'topic-a'), 'complete is the release');

    // The conclude-plan commit that follows must not re-take what the close
    // let go — a terminal item is finished, whatever the session does next.
    writeState(dir, layout.plan('payments', 'topic-a'), '# Plan\nconcluded\n');
    ok(dir, ['commit', 'payments', '-m', 'planning(payments): conclude topic-a', '--topic', 'planning/topic-a']);
    assert.ok(!beaten('planning', 'topic-a'), 'a post-completion cadence commit stays released');
  });

  it('the review sequence leaves no held row behind', () => {
    // `topic complete review` then the session's own artifact commit — the
    // shape review's conclusion runs. Under a held row the checkout's code
    // slot would read taken until the process died.
    ok(dir, ['topic', 'start', 'payments', 'review', 'topic-a']);
    assert.ok(beaten('review', 'topic-a'));

    writeState(dir, layout.unit('payments', 'review', 'topic-a', 'report.md'), '# Report\n');
    ok(dir, ['topic', 'complete', 'payments', 'review', 'topic-a']);
    ok(dir, ['commit', 'payments', '-m', 'review(payments): complete topic-a', '--topic', 'review/topic-a']);

    assert.ok(!beaten('review', 'topic-a'), 'the code slot is free the moment review closes');
  });

  it('a reopened item beats again', () => {
    ok(dir, ['topic', 'start', 'payments', 'specification', 'topic-a']);
    writeState(dir, layout.spec('payments', 'topic-a'), '# Spec\n');
    ok(dir, ['topic', 'complete', 'payments', 'specification', 'topic-a']);
    assert.ok(!beaten('specification', 'topic-a'), 'closed and released');

    ok(dir, ['topic', 'reopen', 'payments', 'specification', 'topic-a']);
    writeState(dir, layout.spec('payments', 'topic-a'), '# Spec\nreopened\n');
    ok(dir, ['commit', 'payments', '-m', 'spec(payments/topic-a): reconcile', '--topic', 'specification/topic-a']);
    assert.ok(beaten('specification', 'topic-a'), 'a live item\'s cadence commit is its heartbeat again');
  });

  it('a --topic commit on a topic with no manifest item neither beats nor clears', () => {
    writeState(dir, layout.doc('payments', 'investigation', 'never-registered'), '# Notes\n');
    ok(dir, ['commit', 'payments', '-m', 'investigation(payments/never-registered): notes', '--topic', 'investigation/never-registered']);
    assert.ok(!beaten('investigation', 'never-registered'), 'no item, nothing to hold');
  });

  it('agent-store writes beat the topic they address', () => {
    ok(dir, ['agent', 'dispatch', 'payments', 'discussion', 'topic-b', '--kind', 'review']);
    assert.ok(beaten('discussion', 'topic-b'), 'the dispatching session holds the topic');
  });

  it('a beat never changes a verb\'s answer, and discovery stays out of presence', () => {
    // Discovery carries no heartbeat — its session serialises it
    // engine-side — so the write lands and the beat silently no-ops.
    const res = ok(dir, ['manifest', 'set', 'payments.discovery.topic-a', 'summary', 'Topic A']);
    assert.strictEqual(res.ok, true);
    assert.deepStrictEqual(res.set, { summary: 'Topic A' }, 'the response is the field surface\'s, untouched');
    assert.ok(!fs.existsSync(statePath(dir, layout.cache('payments', 'discovery', 'topic-a', 'presence'))));
  });
});

describe('commit door: never a code commit on the state branch', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture('engine-commit-'); });
  afterEach(() => { cleanupFixture(dir); });

  it('4.S20: refuses a tree that has leeway-state checked out, running nothing there', () => {
    const state = statePath(dir);
    createFile(state, 'stray.md', '# stray\n');
    const before = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    let ran = false;

    assert.throws(() => withCommitLock(state, () => { ran = true; }),
      new RegExp(`^Error: refusing a code commit in ${state}: it has the state branch leeway-state checked out`));
    assert.throws(() => commitAcrossRepos([{ repo: { dir: '', path: state, heldOut: [], submodules: [] }, paths: ['stray.md'] }], 'stray'),
      /leeway-state checked out/);

    assert.strictEqual(ran, false);
    assert.strictEqual(stateGit(dir, ['rev-parse', 'HEAD']).trim(), before, 'nothing committed on the state branch');
    assert.deepStrictEqual(statusLines(dir), ['?? stray.md'], 'nor staged');
  });

  it('commits the owned paths in the main checkout from inside the state worktree', () => {
    createFile(dir, '.claude/settings.json', '{"hooks":{}}\n');
    const stateHead = stateGit(dir, ['rev-parse', 'HEAD']).trim();

    const res = harness.ok(statePath(dir), ['commit', '--migrations', '-m', 'chore: apply workflow migrations']);

    assert.deepStrictEqual(res, { ok: true, committed: null, code_committed: git(dir, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.deepStrictEqual(codeHeadFiles(dir), ['.claude/settings.json']);
    assert.strictEqual(git(dir, ['symbolic-ref', '--short', 'HEAD']).trim(), 'main');
    assert.strictEqual(stateGit(dir, ['rev-parse', 'HEAD']).trim(), stateHead);
    assert.strictEqual(fs.existsSync(statePath(dir, '.claude')), false);
  });
});

describe('commit door: never a code commit inside an operation git holds open', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture('engine-commit-'); });
  afterEach(() => { cleanupFixture(dir); });

  for (const [marker, operation] of [
    ['MERGE_HEAD', 'a merge'], ['CHERRY_PICK_HEAD', 'a cherry-pick'], ['REVERT_HEAD', 'a revert'], ['rebase-merge', 'a rebase'], ['rebase-apply', 'a rebase'],
    ['BISECT_START', 'a bisect'],
  ]) {
    it(`the confined commit refuses while ${operation} is in progress (${marker}), staging nothing`, () => {
      createFile(dir, '.claude/settings.json', '{"hooks":{}}\n');
      const at = path.join(dir, '.git', marker);
      if (marker.startsWith('rebase')) fs.mkdirSync(at);
      else fs.writeFileSync(at, git(dir, ['rev-parse', 'HEAD']));
      const [head, status] = [git(dir, ['rev-parse', 'HEAD']), codeStatusLines(dir)];

      assert.throws(() => commitPathspecScoped(dir, '.claude/settings.json', 'chore: install workflow session hooks'),
        new RegExp(`^Error: ${operation} is in progress \\(${marker}\\) — finish or abort it, then commit again$`));

      assert.strictEqual(git(dir, ['rev-parse', 'HEAD']), head);
      assert.deepStrictEqual(codeStatusLines(dir), status);
      assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), '');
    });
  }
});

describe('commit door: a confined commit that does not land leaves the index as it found it', () => {
  const setup = fixtureFrom('engine-commit-', (at) => {
    createFile(at, 'a.txt', 'one\n');
    commitAll(at, 'a');
  });
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a commit a hook refuses unstages what it staged and puts back what the person had staged — on its own paths and elsewhere', () => {
    createFile(dir, 'a.txt', 'staged\n');
    createFile(dir, 'c.txt', 'elsewhere\n');
    git(dir, ['add', 'a.txt', 'c.txt']);
    createFile(dir, 'a.txt', 'on disk\n');
    createFile(dir, 'b.txt', 'new\n');
    createFile(dir, '.git/hooks/pre-commit', '#!/bin/sh\nexit 1\n');
    fs.chmodSync(path.join(dir, '.git/hooks/pre-commit'), 0o755);
    const [head, index] = [git(dir, ['rev-parse', 'HEAD']), git(dir, ['ls-files', '--stage'])];

    assert.throws(() => commitPathspecScoped(dir, ['a.txt', 'b.txt'], 'chore: refused'), /git commit failed/);

    assert.strictEqual(git(dir, ['rev-parse', 'HEAD']), head);
    assert.strictEqual(git(dir, ['ls-files', '--stage']), index);
    assert.strictEqual(git(dir, ['show', ':a.txt']), 'staged\n');
    assert.deepStrictEqual(git(dir, ['diff', '--cached', '--name-only']).trim().split('\n'), ['a.txt', 'c.txt']);
    assert.strictEqual(fs.readFileSync(path.join(dir, 'a.txt'), 'utf8'), 'on disk\n');
  });

  it('paths that turn out clean leave the person\'s staged change to them as it was', () => {
    createFile(dir, 'a.txt', 'staged\n');
    git(dir, ['add', 'a.txt']);
    createFile(dir, 'a.txt', 'one\n');

    assert.strictEqual(commitPathspecScoped(dir, 'a.txt', 'chore: nothing'), null);

    assert.strictEqual(git(dir, ['show', ':a.txt']), 'staged\n');
  });
});

describe('commit door: index.lock retry and the commit lock', () => {
  const setup = fixtureFrom('engine-commit-', implementing);
  let dir;
  beforeEach(() => {
    dir = setup();
    createFile(dir, 'src/app.js', 'const x = 2;\n');
  });
  afterEach(() => { cleanupFixture(dir); });

  const task = ['commit', '--paths', 'src/app.js', '-m', 'feat(topic-a): the task', '--for', 'payments', 'implementation/topic-a'];

  it('retries through transient index.lock contention', () => {
    const indexLock = path.join(dir, '.git', 'index.lock');
    fs.writeFileSync(indexLock, '');
    // A detached deleter releases git's own lock mid-retry.
    spawn('node', ['-e', `setTimeout(() => require('fs').unlinkSync(${JSON.stringify(indexLock)}), 400)`], {
      detached: true, stdio: 'ignore',
    }).unref();

    const res = ok(dir, task);

    assert.deepStrictEqual(res.committed, [{ repo: '.', sha: git(dir, ['rev-parse', '--short', 'HEAD']).trim() }]);
  });

  it('surfaces the git error once the retry budget is exhausted, and releases the commit lock', () => {
    fs.writeFileSync(path.join(dir, '.git', 'index.lock'), '');

    const res = refuses(dir, task, { env: { LEEWAY_GIT_LOCK_BUDGET_MS: '200' } });

    assert.match(res.error, /index\.lock/);
    assert.ok(!fs.existsSync(path.join(dir, '.git', 'leeway-commit.lock')), 'commit lock released on failure');
  });

  it('breaks a stale commit lock left by a crashed process', () => {
    const lock = path.join(dir, '.git', 'leeway-commit.lock');
    fs.writeFileSync(lock, '99999');
    const past = new Date(Date.now() - 360000);
    fs.utimesSync(lock, past, past);

    const res = ok(dir, task);

    assert.strictEqual(res.committed.length, 1);
    assert.ok(!fs.existsSync(lock), 'stale lock cleared');
  });

  it('a state commit never takes the code tree\'s index — a peer\'s hold there blocks nothing', () => {
    fs.writeFileSync(path.join(dir, '.git', 'index.lock'), '');
    writeState(dir, layout.doc('payments', 'investigation', 'topic-a'), '# Topic A\nprogress\n');

    const res = ok(dir, ['commit', 'payments', '-m', 'investigation(payments/topic-a): progress', '--topic', 'investigation/topic-a'], { env: { LEEWAY_GIT_LOCK_BUDGET_MS: '200' } });

    assert.strictEqual(res.committed, stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim());
  });
});

describe('commit door: transaction tails commit their own scope', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a deletion that empties its scope still commits (inbox delete)', () => {
    writeState(dir, layout.archived('ideas', '2026-10-30--a-thought.md'), '# A thought\n');
    commitAll(dir, 'an archived idea');
    writeState(dir, layout.doc('payments', 'investigation', 'topic-b'), '# Topic B\npeer dirt\n');

    const res = ok(dir, ['inbox', 'delete', path.join(STATE_DIR_NAME, layout.archived('ideas', '2026-10-30--a-thought.md'))]);

    assert.match(res.committed, /^[0-9a-f]+$/, 'the staged deletion commits even though nothing is left on disk');
    assert.ok(headFiles(dir).includes(layout.archived('ideas', '2026-10-30--a-thought.md')), 'the deletion is in the commit');
    assert.deepStrictEqual(statusLines(dir), [` M ${layout.doc('payments', 'investigation', 'topic-b')}`], 'the live session\'s dirt is untouched');
  });

  it('the inbox scope commits the inbox alone — dirt outside it that the state does not ignore stays out', () => {
    writeState(dir, layout.inbox('ideas', '2026-10-30--a-thought.md'), '# A thought\n');
    writeState(dir, layout.doc('payments', 'investigation', 'topic-b'), '# Topic B\npeer dirt\n');

    ok(dir, ['commit', '--inbox', '-m', 'chore(inbox): capture an idea']);

    assert.deepStrictEqual(headFiles(dir), [layout.inbox('ideas', '2026-10-30--a-thought.md')]);
    assert.deepStrictEqual(statusLines(dir), [` M ${layout.doc('payments', 'investigation', 'topic-b')}`], 'the live session\'s dirt is untouched');
  });

  it('a topic cancel commits the manifest write alone', () => {
    writeState(dir, layout.doc('payments', 'investigation', 'topic-a'), '# Topic A\nlive session dirt\n');

    const res = ok(dir, ['topic', 'cancel', 'payments', 'discovery', 'topic-b']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.deepStrictEqual(headFiles(dir), [layout.manifest('payments')],
      'a cancel from the epic menu takes nothing a session is holding');
    assert.deepStrictEqual(statusLines(dir), [` M ${layout.doc('payments', 'investigation', 'topic-a')}`]);
  });

  it('the discovery session close commits the discovery scope, not the work unit', () => {
    const manifest = epicManifest();
    manifest.phases.discovery.active_session = '001';
    writeState(dir, layout.manifest('payments'), JSON.stringify(manifest, null, 2) + '\n');
    writeState(dir, layout.session('payments', '001'), '# Session 001\n');
    commitAll(dir, 'an open session');

    writeState(dir, layout.session('payments', '001'), '# Session 001\n\n## Conclusion\n');
    writeState(dir, layout.doc('payments', 'investigation', 'topic-a'), '# Topic A\na peer session mid-turn\n');

    const res = ok(dir, ['discovery-session', 'close', 'payments', '-m', 'discovery(payments): synthesise 1 topic']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    const files = headFiles(dir);
    assert.ok(files.includes(layout.session('payments', '001')));
    assert.ok(!files.includes(layout.doc('payments', 'investigation', 'topic-a')), 'the peer\'s half-written document stays uncommitted');
  });
});

describe('commit door: two live sessions on one checkout', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  // One session's turn loop: write its own topic file, commit it, repeat —
  // the cadence a document's session runs.
  const SESSION = [
    "const fs = require('fs');",
    "const { execFileSync } = require('child_process');",
    'const [engine, dir, topic, turns, file] = process.argv.slice(1);',
    'for (let i = 1; i <= Number(turns); i++) {',
    '  fs.writeFileSync(file, "# " + topic + "\\n" + Array.from({length: i}, (_, n) => "line " + (n + 1)).join("\\n") + "\\n");',
    '  execFileSync("node", [engine, "commit", "payments", "-m",',
    '    "investigation(payments/" + topic + "): turn " + i, "--topic", "investigation/" + topic],',
    '    { cwd: dir, encoding: "utf8" });',
    '}',
  ].join('\n');

  /** @param {string} topic @param {number} turns */
  function session(dir, topic, turns) {
    const proc = spawn('node', ['-e', SESSION, ENGINE, dir, topic, String(turns), statePath(dir, layout.doc('payments', 'investigation', topic))], { cwd: dir });
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk; });
    return new Promise((resolve) => proc.on('exit', (code) => resolve({ code, stderr })));
  }

  it('no commit ever contains a foreign session\'s path, and nothing is lost', async () => {
    const turns = 6;
    const results = await Promise.all([session(dir, 'topic-a', turns), session(dir, 'topic-b', turns)]);
    for (const r of results) assert.strictEqual(r.code, 0, `a session crashed: ${r.stderr}`);

    // Every commit either session made, message and file list together.
    const log = stateGit(dir, ['log', '--format=%H%x00%s', '--name-only', '-z', 'HEAD']);
    const commits = stateGit(dir, ['log', '--format=%H', 'HEAD']).trim().split('\n');
    assert.ok(commits.length >= 2 * turns, `expected a commit per turn, got ${commits.length - 1}`);

    for (const sha of commits) {
      const subject = stateGit(dir, ['log', '--format=%s', '-1', sha]).trim();
      if (!subject.startsWith('investigation(payments/')) continue;
      const mine = subject.slice('investigation(payments/'.length).split(')')[0];
      const foreign = mine === 'topic-a' ? 'topic-b' : 'topic-a';
      const files = stateGit(dir, ['show', '--name-only', '--pretty=format:', sha]).trim().split('\n').filter(Boolean);
      assert.ok(!files.includes(layout.doc('payments', 'investigation', foreign)),
        `${subject} (${sha}) swept a foreign session's file:\n${files.join('\n')}\n${log}`);
      assert.deepStrictEqual(files, [layout.doc('payments', 'investigation', mine)],
        `${subject} committed more than its own action`);
    }

    // Both sessions' last turn is in HEAD, and the tree is clean.
    for (const topic of ['topic-a', 'topic-b']) {
      const committed = stateGit(dir, ['show', `HEAD:payments/investigation/${topic}.md`]);
      assert.strictEqual(committed, fs.readFileSync(statePath(dir, layout.doc('payments', 'investigation', topic)), 'utf8'),
        `${topic}'s last turn never reached a commit`);
      assert.ok(committed.trim().endsWith(`line ${turns}`), `${topic} lost a turn`);
    }
    assert.deepStrictEqual(statusLines(dir), [], 'nothing left dirty');
  });
});

describe('commit door: a push the remote refuses (4.S4)', () => {
  let dir;
  let bare;
  beforeEach(() => {
    dir = setupTwoTopicFixture();
    bare = harness.bareRepo(fs.mkdtempSync(path.join(os.tmpdir(), 'engine-commit-remote-')));
    git(dir, ['remote', 'add', 'origin', bare]);
    git(dir, ['push', '-q', 'origin', 'leeway-state']);
    fs.writeFileSync(path.join(bare, 'hooks', 'pre-receive'), '#!/bin/sh\necho "no pushes today" >&2\nexit 1\n', { mode: 0o755 });
  });
  afterEach(() => {
    cleanupFixture(dir);
    fs.rmSync(bare, { recursive: true, force: true });
  });

  it('a verb\'s commit stands, its response carries the warning, and it answers ok with exit 0', () => {
    const pushed = git(bare, ['rev-parse', 'leeway-state']).trim();

    const res = ok(dir, ['topic', 'cancel', 'payments', 'discovery', 'topic-b']);

    assert.strictEqual(res.status, 'cancelled');
    assert.strictEqual(res.committed, stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(), 'the commit stands on leeway-state');
    assert.deepStrictEqual(headFiles(dir), [layout.manifest('payments')]);
    assert.strictEqual(git(bare, ['rev-parse', 'leeway-state']).trim(), pushed, 'the remote refused it');
    assert.strictEqual(res.warnings.length, 1, JSON.stringify(res.warnings));
  });
});

describe('commit door: transaction-tail degrade', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a tail-committing verb saves state and degrades to a pending note when git is blocked', () => {
    holdStateRef(dir);

    const res = ok(dir, ['topic', 'cancel', 'payments', 'discovery', 'topic-b']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'cancelled');
    assert.strictEqual(res.committed, null);
    assert.strictEqual(res.note,
      'commit pending — state saved; retry with engine commit',
      'the cancel wrote the manifest alone — narrower than the work unit\'s state scope, so the retry stays generic');
    assert.ok(res.warnings.some((w) => w.includes('commit failed')), `warnings carry the git error: ${JSON.stringify(res.warnings)}`);
    const manifest = JSON.parse(fs.readFileSync(statePath(dir, layout.manifest('payments')), 'utf8'));
    assert.strictEqual(manifest.phases.discussion.items['topic-b'].status, 'cancelled', 'state landed despite the failed commit');
  });

  it('a foreign-topic tail prescribes a retry in the target\'s scope, as a sweep that beats no more than the verb did, and the retry commits what it left', () => {
    // The notes are contract surface: a session follows the command verbatim,
    // so a delivery's retry must carry the same suppression the delivery has.
    writeState(dir, layout.cache('scratch', 'c.md'), 'Q\n');
    holdStateRef(dir);
    const delivered = ok(dir, ['topic', 'send', 'payments', 'topic-b', '--from', 'topic-a',
      '--content', path.join(STATE_DIR_NAME, layout.cache('scratch', 'c.md')), '--slug', 'q']);
    assert.strictEqual(delivered.committed, null);
    assert.match(delivered.note, /retry with: engine commit payments --topic discussion\/topic-b --sweep -m /, 'the delivery\'s retry is a sweep of the target, so it never beats it');
    fs.unlinkSync(path.join(dir, '.git/refs/heads/leeway-state.lock'));
    ok(dir, ['commit', 'payments', '--topic', 'investigation/topic-b', '--sweep', '-m', 'the retry']);
    assert.deepStrictEqual(headFiles(dir), [layout.mailbox('payments', 'topic-b', '001-q.md')]);
  });

  it('every narrowed tail prescribes its own scope, never a work-unit sweep', () => {
    const manifest = epicManifest();
    manifest.phases.discovery.active_session = '001';
    manifest.phases.specification = { items: {
      'topic-a': { status: 'in-progress', sources: [] },
      'topic-b': { status: 'in-progress', sources: [] },
    } };
    writeState(dir, layout.manifest('payments'), JSON.stringify(manifest, null, 2) + '\n');
    writeState(dir, layout.session('payments', '001'), '# Session 001\n');
    writeState(dir, layout.projectManifest, JSON.stringify({ ...JSON.parse(readState(dir, layout.projectManifest)), product_session: '001' }, null, 2));
    writeState(dir, layout.productSession('001'), '# Product session 001\n');
    commitAll(dir, 'a discovery session, the product\'s, and two specs');
    ok(dir, ['topic', 'cancel', 'payments', 'discovery', 'topic-b']);
    holdStateRef(dir);

    const reactivated = ok(dir, ['topic', 'reactivate', 'payments', 'discovery', 'topic-b']);
    assert.strictEqual(reactivated.note, 'commit pending — state saved; retry with engine commit',
      'reactivate wrote the manifest alone, like the cancel it undoes — narrower than the state scope, so its retry stays generic');

    const sequenced = ok(dir, ['build-order', 'sequence', 'payments', 'topic-a=1', 'topic-b=2']);
    assert.match(sequenced.note, /engine commit payments --state -m/,
      'build-order writes the manifest alone — the work unit\'s state scope covers it');

    const mapped = ok(dir, ['topic', 'order', 'payments', 'topic-a=1']);
    assert.match(mapped.note, /engine commit payments --discovery -m/, 'the map lives in the discovery scope');

    const closed = ok(dir, ['discovery-session', 'close', 'payments', '-m', 'discovery(payments): close']);
    assert.match(closed.note, /engine commit payments --discovery -m/, 'so does the session log it just finalised');

    const product = ok(dir, ['discovery-session', 'close', 'product', '-m', 'product: close']);
    assert.match(product.note, /engine commit --product -m/, 'the product\'s close names its own scope');
  });
});
