'use strict';

// ---------------------------------------------------------------------------
// "What have you decided without me?" and "since you last looked"
// (workflow-engine/scripts/domain/ledger-since.cjs): `engine ledger since`,
// Claude's current calls in a unit or on a topic later than the mark of the
// screen showing them, the build's calls among them; `engine ledger shown`,
// the one read that moves the mark, to the newest call it showed on each
// screen it covers, under the mark's own lock; the mark kept on each
// machine in the unit's cache, never committed; and nothing any ledger read
// answers left on disk.
//
// Real repositories in temp folders, each with its state worktree, the work
// unit's manifest written there; a bare remote and a second clone stand for
// another machine.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const { ENGINE, ok, refuses, git, stateGit, statePath, testIdentity, setupGitFixture, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const { createStateBranchFromRemote, addStateWorktree } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { stateRoot } = require(path.join(SCRIPTS, 'kernel/state-root.cjs'));
const { processStartTime } = require(path.join(SCRIPTS, 'kernel/process.cjs'));

const UNIT = 'fumi';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'session-1' });
const MADE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });
const TOPICS = Object.freeze(['note-window', 'space-homing', 'menu-bar']);
const NOTE = `${UNIT}.discussion.note-window`;
const SPACE = `${UNIT}.discussion.space-homing`;

/** @type {string} */
let dir;

beforeEach(() => {
  dir = setupGitFixture('ledger-since-');
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: { discussion: { items: Object.fromEntries(TOPICS.map((topic) => [topic, { status: 'in-progress' }])) } },
  });
});

afterEach(() => {
  cleanupFixture(dir);
});

/** One ledger write in `at` that must succeed: its short id. @param {string} at @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function writeIn(at, verb, address, flags, content) {
  return ok(at, ['ledger', verb, address, ...flags], { env: SESSION, stdin: JSON.stringify(content) }).id;
}

/** A call answering a question asked with it, Claude's unless `by` says whose. @param {string} address @param {string} text @param {string} [by] */
function call(address, text, by = 'claude', at = dir) {
  const question = writeIn(at, 'ask', address, [], { ...MADE, text: `${text}?` });
  return writeIn(at, 'decide', address, ['--answers', question], { by, who_moved_whom: 'none', text, why: `Why: ${text}` });
}

/** The calls a read answers, by id. @param {'since'|'shown'} verb @param {string[]} place */
function calls(verb, ...place) {
  return callsIn(dir, verb, ...place);
}

/** @param {string} at @param {'since'|'shown'} verb @param {string[]} place */
function callsIn(at, verb, ...place) {
  return ok(at, ['ledger', verb, UNIT, ...place]).calls.map((/** @type {{id: string}} */ c) => c.id);
}

/** The ledger's ids, in order. @param {string} at */
function ledgerIds(at) {
  return fs.readFileSync(statePath(at, '.ledger.jsonl'), 'utf8').split('\n').slice(0, -1).map((line) => JSON.parse(line).id);
}

/** The full id a short id shows. @param {string} short */
function full(short) {
  return /** @type {string} */ (ledgerIds(dir).find((id) => id.startsWith(short)));
}

/** The machine's last-looked mark, or null where it keeps none. @param {string} [at] */
function marks(at = dir) {
  const file = statePath(at, '.cache', UNIT, 'last-looked.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** Every file under `root`, git's own aside, by its path from it. @param {string} root @returns {string[]} */
function files(root) {
  return fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)))
    .filter((rel) => rel !== '.git')
    .sort();
}

describe('since you last looked (5.8.7, 5.8.14, 5.8.15)', () => {
  it('lists Claude\'s calls on a topic since its map last showed: a plain read moves nothing, as opening the board is not looking, and `ledger shown` moves the mark to the newest call it showed (5.S30)', () => {
    const first = call(NOTE, 'A note is a panel.');
    call(NOTE, 'A note keeps its size.', 'person');
    const second = call(NOTE, 'A note has no title bar.');
    call(SPACE, 'A note opens on the active Space.');

    assert.deepStrictEqual(calls('shown', 'note-window'), [first, second]);
    assert.deepStrictEqual(marks(), { topics: { 'note-window': full(second) }, spec: null });

    const third = call(NOTE, 'A note snaps to the grid.');
    assert.deepStrictEqual(calls('since', 'note-window'), [third]);
    assert.deepStrictEqual(calls('since', 'note-window'), [third], 'a plain read moved the mark');
    assert.deepStrictEqual(calls('shown', 'note-window'), [third]);
    assert.deepStrictEqual(calls('since', 'note-window'), []);
    assert.deepStrictEqual(calls('shown', 'note-window'), []);
    assert.deepStrictEqual(marks(), { topics: { 'note-window': full(third) }, spec: null });
  });

  it('answers "what have you decided without me?" across the unit, a discussion\'s calls and the build\'s alike, each counted from the mark of the screen showing it, its topic\'s or the spec\'s (5.S19)', () => {
    const noted = call(NOTE, 'A note is a panel.');
    const homed = call(SPACE, 'A note opens on the active Space.');
    const built = call(`${UNIT}.implementation`, 'The panel is an NSPanel.');

    const res = ok(dir, ['ledger', 'since', UNIT]);
    assert.deepStrictEqual(res.calls.map((/** @type {Record<string, any>} */ c) => [c.id, c.by, c.phase, c.standing]), [
      [noted, 'claude', 'discussion', { unit: UNIT, topic: 'note-window' }],
      [homed, 'claude', 'discussion', { unit: UNIT, topic: 'space-homing' }],
      [built, 'claude', 'implementation', { unit: UNIT, topic: null }],
    ]);

    assert.deepStrictEqual(calls('shown', 'note-window'), [noted]);
    assert.deepStrictEqual(calls('since'), [homed, built]);
    assert.deepStrictEqual(calls('shown'), [homed, built]);
    assert.deepStrictEqual(marks(), { topics: { 'note-window': full(noted), 'space-homing': full(homed) }, spec: full(built) });
    assert.deepStrictEqual(calls('since'), []);

    const file = statePath(dir, '.cache', UNIT, 'last-looked.json');
    fs.writeFileSync(file, JSON.stringify({ topics: { 'note-window': 'NoSuchEntry0000000000' }, spec: full(built) }));
    assert.deepStrictEqual(calls('since'), [noted, homed], 'a mark naming no entry did not count every call new');
  });

  it('keeps the mark on each machine, off the state branch: a look makes no commit, and each of two clones counts from its own look (5.S33)', () => {
    const world = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-since-machines-')));
    try {
      const bare = path.join(world, 'fumi.git');
      git(world, ['init', '-q', '--bare', '--initial-branch=main', bare]);
      git(dir, ['remote', 'add', 'origin', bare]);
      git(dir, ['push', '-q', 'origin', 'main']);
      stateGit(dir, ['add', '-A']);
      stateGit(dir, ['commit', '-q', '-m', 'state: the unit']);
      stateGit(dir, ['push', '-q', 'origin', 'leeway-state']);
      const first = call(NOTE, 'A note is a panel.');
      const second = call(NOTE, 'A note has no title bar.');
      const other = path.join(world, 'other-machine');
      git(world, ['clone', '-q', bare, other]);
      testIdentity(other);
      createStateBranchFromRemote(stateRoot(other));
      addStateWorktree(stateRoot(other));
      const branch = () => [stateGit(dir, ['rev-list', '--count', 'leeway-state']).trim(), git(bare, ['rev-parse', 'leeway-state']).trim()];
      const before = branch();

      assert.deepStrictEqual(calls('shown', 'note-window'), [first, second]);

      assert.deepStrictEqual(branch(), before, 'a look made a commit');
      assert.strictEqual(stateGit(dir, ['status', '--porcelain', '--untracked-files=all']), '');
      assert.deepStrictEqual(marks(), { topics: { 'note-window': full(second) }, spec: null });
      assert.deepStrictEqual([callsIn(other, 'since', 'note-window'), marks(other)], [[first, second], null]);

      const third = call(NOTE, 'A note snaps to the grid.');
      assert.deepStrictEqual(callsIn(other, 'shown', 'note-window'), [first, second]);
      assert.deepStrictEqual([calls('since', 'note-window'), callsIn(other, 'since', 'note-window')], [[third], []]);
    } finally {
      fs.rmSync(world, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('moves each topic\'s mark under the mark\'s own lock: looks made at once wait on it, and each lands, none lost to another', async () => {
    const made = TOPICS.map((topic) => call(`${UNIT}.discussion.${topic}`, `A call on ${topic}.`));
    const lock = statePath(dir, '.cache', UNIT, 'last-looked.json.lock');
    fs.mkdirSync(path.dirname(lock), { recursive: true });
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, pid_start: processStartTime(process.pid) }));
    const looks = TOPICS.map((topic) => {
      const child = spawn('node', [ENGINE, 'ledger', 'shown', UNIT, topic], { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      return new Promise((resolve) => child.on('close', (code) => resolve({ code, stderr })));
    });
    const raced = await Promise.race([Promise.all(looks).then(() => 'exited'), new Promise((resolve) => setTimeout(() => resolve('waiting'), 1500))]);
    assert.strictEqual(raced, 'waiting', 'the looks did not wait on the mark\'s lock');

    fs.unlinkSync(lock);

    for (const outcome of /** @type {{code: number, stderr: string}[]} */ (await Promise.all(looks))) assert.strictEqual(outcome.code, 0, outcome.stderr);
    assert.deepStrictEqual(marks(), { topics: Object.fromEntries(TOPICS.map((topic, i) => [topic, full(made[i])])), spec: null });
  });

  it('refuses a read naming no unit, a topic the unit does not have, or a mark it cannot read', () => {
    assert.match(refuses(dir, ['ledger', 'since']).error, /^Usage: engine ledger since <work-unit> \[<topic>\]$/);
    assert.match(refuses(dir, ['ledger', 'shown', UNIT, 'dock']).error, /^ledger shown: fumi has no topic "dock"$/);
    const file = statePath(dir, '.cache', UNIT, 'last-looked.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{"topics":');
    assert.match(refuses(dir, ['ledger', 'since', UNIT]).error, new RegExp(`^the last-looked mark at ${file} is no JSON — `));
    fs.writeFileSync(file, '{"spec":null}');
    assert.strictEqual(refuses(dir, ['ledger', 'shown', UNIT]).error, `the last-looked mark at ${file} holds no topics`);
  });
});

describe('nothing on disk (4.11.9)', () => {
  it('leaves no record, map, product record, list of calls or list of what a replacement affects on the state branch or in the unit\'s folder, a look\'s mark in the cache alone (4.S24, 5.S18)', () => {
    const relied = call(NOTE, 'A note is a panel.');
    writeIn(dir, 'find', SPACE, ['--relies-on', relied], { ...MADE, text: 'A panel takes no focus.', how: 'a spike', product_wide: true });
    writeIn(dir, 'replace', NOTE, ['--replaces', relied, '--reason', 'changed-mind'], { ...MADE, drops: ['a panel'], text: 'A frameless window.', why: 'Lighter.' });
    stateGit(dir, ['add', '-A']);
    stateGit(dir, ['commit', '-q', '-m', 'state: the unit']);
    const tree = () => stateGit(dir, ['ls-tree', '-r', '--name-only', 'leeway-state']).trim().split('\n');
    const branch = tree();
    const head = stateGit(dir, ['rev-parse', 'leeway-state']);
    const onDisk = files(statePath(dir));

    const answers = [
      ok(dir, ['ledger', 'record', UNIT]).decisions, ok(dir, ['ledger', 'record', UNIT, 'note-window']).decisions,
      ok(dir, ['ledger', 'map', UNIT, 'note-window']).questions, ok(dir, ['ledger', 'product']).findings,
      ok(dir, ['ledger', 'affected', UNIT]).affected, ok(dir, ['ledger', 'since', UNIT]).calls, ok(dir, ['ledger', 'shown', UNIT]).calls,
    ];

    assert.ok(answers.every((answer) => answer.length > 0), 'a read answered nothing, so proves nothing');
    assert.deepStrictEqual(branch, ['.gitignore', '.ledger.jsonl', `${UNIT}/manifest.json`]);
    assert.deepStrictEqual([tree(), stateGit(dir, ['rev-parse', 'leeway-state'])], [branch, head], 'a read committed');
    assert.deepStrictEqual(files(statePath(dir)), [...onDisk, `.cache/${UNIT}/last-looked.json`].sort());
    assert.deepStrictEqual(fs.readdirSync(statePath(dir, UNIT)), ['manifest.json']);
    assert.strictEqual(stateGit(dir, ['status', '--porcelain', '--untracked-files=all']), '');
  });
});
