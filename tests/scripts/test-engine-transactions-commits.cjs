'use strict';

// ---------------------------------------------------------------------------
// What the engine's transactions commit and move, apart from the lifecycle
// they change (leeway-engine/scripts/domain/inbox.cjs, commit.cjs, and the
// knowledge changes in transitions.cjs and workunit-lifecycle.cjs):
// `inbox archive|restore|delete`, each set one commit or none, a move that
// throws put back whole (`moveFiles`); `engine commit`, scoped to a unit,
// the inbox or a plan's storage paths, and hardened against a malformed
// plan; the knowledge store never riding a commit; and each transaction's
// knowledge change against a real store, the chunks it must leave alone
// beside it. The lifecycle verbs themselves are test-engine-transactions.cjs's.
//
// Layer: verb. World: each describe's own, built once (`fixtureFrom`).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const harness = require('./engine-harness.cjs');
const { moveFiles } = require('../../skills/leeway-engine/scripts/domain/inbox.cjs');

const { git, stateGit, commitAll, cleanupFixture, createFile: writeFile, lastMessage, ok: engine, refuses: engineFails } = harness;

/** The state branch's head, short. @param {string} dir */
function shortHead(dir) {
  return stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim();
}

/** A world built once from `build`, every test given a copy. @param {(dir: string) => void} build */
const world = (build) => harness.fixtureFrom('engine-tx-commits-', build);

/** A manifest's file text. @param {Record<string, unknown>} manifest */
const json = (manifest) => JSON.stringify(manifest, null, 2) + '\n';

describe('engine inbox archive / restore / delete', () => {
  const inbox = world((dir) => {
    writeFile(dir, '.leeway/.inbox/ideas/2026-06-01--smart-retry.md', '# Smart Retry\n');
    writeFile(dir, '.leeway/.inbox/bugs/2026-06-02--login-loop.md', '# Login Loop\n');
    commitAll(dir, 'init');
  });
  let dir;
  beforeEach(() => { dir = inbox(); });
  afterEach(() => { cleanupFixture(dir); });

  it('archives a single item — file moved to its source folder under .archived, slug commit message', () => {
    const res = engine(dir, ['inbox', 'archive', '.leeway/.inbox/ideas/2026-06-01--smart-retry.md']);

    assert.deepStrictEqual(res.archived, [path.join(dir, '.leeway/.inbox/.archived/ideas/2026-06-01--smart-retry.md')]);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.ok(!fs.existsSync(path.join(dir, '.leeway/.inbox/ideas/2026-06-01--smart-retry.md')));
    assert.ok(fs.existsSync(path.join(dir, '.leeway/.inbox/.archived/ideas/2026-06-01--smart-retry.md')));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): archive smart-retry');
  });

  it('archives a multi-item set in one commit with the N-items message form', () => {
    const res = engine(dir, [
      'inbox', 'archive',
      '.leeway/.inbox/ideas/2026-06-01--smart-retry.md',
      '.leeway/.inbox/bugs/2026-06-02--login-loop.md',
    ]);

    assert.deepStrictEqual(res.archived, [
      path.join(dir, '.leeway/.inbox/.archived/ideas/2026-06-01--smart-retry.md'),
      path.join(dir, '.leeway/.inbox/.archived/bugs/2026-06-02--login-loop.md'),
    ]);
    assert.ok(fs.existsSync(path.join(dir, '.leeway/.inbox/.archived/bugs/2026-06-02--login-loop.md')));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): archive 2 items');
    // One commit for the whole set.
    assert.strictEqual(stateGit(dir, ['log', '-1', '--pretty=%s', 'HEAD~1']).trim(), 'init');
  });

  it('a set whose move throws midway puts back what moved — every file where it was, nothing committed', () => {
    // A file where the archive's bugs folder belongs: the idea moves, the bug cannot.
    writeFile(dir, '.leeway/.inbox/.archived/bugs', 'in the way\n');
    const head = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    engineFails(dir, [
      'inbox', 'archive',
      '.leeway/.inbox/ideas/2026-06-01--smart-retry.md',
      '.leeway/.inbox/bugs/2026-06-02--login-loop.md',
    ]);
    assert.ok(fs.existsSync(path.join(dir, '.leeway/.inbox/ideas/2026-06-01--smart-retry.md')));
    assert.ok(fs.existsSync(path.join(dir, '.leeway/.inbox/bugs/2026-06-02--login-loop.md')));
    assert.ok(!fs.existsSync(path.join(dir, '.leeway/.inbox/.archived/ideas/2026-06-01--smart-retry.md')));
    assert.strictEqual(stateGit(dir, ['rev-parse', 'HEAD']).trim(), head);
  });

  it('restores an archived item back to its live folder', () => {
    engine(dir, ['inbox', 'archive', '.leeway/.inbox/ideas/2026-06-01--smart-retry.md']);
    const res = engine(dir, ['inbox', 'restore', '.leeway/.inbox/.archived/ideas/2026-06-01--smart-retry.md']);

    assert.deepStrictEqual(res.restored, [path.join(dir, '.leeway/.inbox/ideas/2026-06-01--smart-retry.md')]);
    assert.ok(fs.existsSync(path.join(dir, '.leeway/.inbox/ideas/2026-06-01--smart-retry.md')));
    assert.ok(!fs.existsSync(path.join(dir, '.leeway/.inbox/.archived/ideas/2026-06-01--smart-retry.md')));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): restore smart-retry');
  });

  it('deletes an archived item via git rm', () => {
    engine(dir, ['inbox', 'archive', '.leeway/.inbox/ideas/2026-06-01--smart-retry.md']);
    const res = engine(dir, ['inbox', 'delete', '.leeway/.inbox/.archived/ideas/2026-06-01--smart-retry.md']);

    assert.deepStrictEqual(res.deleted, [path.join(dir, '.leeway/.inbox/.archived/ideas/2026-06-01--smart-retry.md')]);
    assert.ok(!fs.existsSync(path.join(dir, '.leeway/.inbox/.archived/ideas/2026-06-01--smart-retry.md')));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): delete smart-retry');
    assert.strictEqual(stateGit(dir, ['status', '--porcelain']).trim(), '');
  });

  it('deletes the archived item named, never a sibling its name would match as a pattern', () => {
    const archived = path.join(dir, '.leeway/.inbox/.archived/ideas');
    fs.mkdirSync(archived, { recursive: true });
    fs.writeFileSync(path.join(archived, '2026-06-01--retry[s].md'), '# Retry\n');
    fs.writeFileSync(path.join(archived, '2026-06-01--retrys.md'), '# Retrys\n');
    commitAll(dir, 'archive two');

    const res = engine(dir, ['inbox', 'delete', '.leeway/.inbox/.archived/ideas/2026-06-01--retry[s].md']);

    assert.deepStrictEqual(res.deleted, [path.join(dir, '.leeway/.inbox/.archived/ideas/2026-06-01--retry[s].md')]);
    assert.ok(!fs.existsSync(path.join(archived, '2026-06-01--retry[s].md')));
    assert.ok(fs.existsSync(path.join(archived, '2026-06-01--retrys.md')));
    assert.deepStrictEqual(stateGit(dir, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n'),
      ['.inbox/.archived/ideas/2026-06-01--retry[s].md']);
  });

  it('rejects invalid paths strictly, before anything moves', () => {
    // Outside the inbox entirely.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.leeway/payments/manifest.json']).error,
      /not a live inbox path/);
    // Unknown folder.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.leeway/.inbox/notes/2026-06-01--x.md']).error,
      /not a live inbox path/);
    // Traversal.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.leeway/.inbox/ideas/../../../etc/passwd.md']).error,
      /not a live inbox path|without ".."/);
    // Archived path passed to archive.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.leeway/.inbox/.archived/ideas/2026-06-01--x.md']).error,
      /not a live inbox path/);
    // Live path passed to delete.
    assert.match(
      engineFails(dir, ['inbox', 'delete', '.leeway/.inbox/ideas/2026-06-01--smart-retry.md']).error,
      /not an archived inbox path/);
    // Live path passed to restore.
    assert.match(
      engineFails(dir, ['inbox', 'restore', '.leeway/.inbox/ideas/2026-06-01--smart-retry.md']).error,
      /not an archived inbox path/);
    // Missing file.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.leeway/.inbox/ideas/2026-06-01--ghost.md']).error,
      /not found/);
    // One bad path poisons the whole set — the good file did not move.
    engineFails(dir, [
      'inbox', 'archive',
      '.leeway/.inbox/ideas/2026-06-01--smart-retry.md',
      '.leeway/.inbox/ideas/2026-06-01--ghost.md',
    ]);
    assert.ok(fs.existsSync(path.join(dir, '.leeway/.inbox/ideas/2026-06-01--smart-retry.md')));
    assert.match(engineFails(dir, ['inbox', 'archive']).error, /Usage: engine inbox/);
  });

  it('refuses a duplicate path in the set before any move — no half-applied state', () => {
    const err = engineFails(dir, [
      'inbox', 'archive',
      '.leeway/.inbox/ideas/2026-06-01--smart-retry.md',
      '.leeway/.inbox/ideas/2026-06-01--smart-retry.md',
    ]);
    assert.match(err.error, /duplicate inbox path/);
    // The one real file never moved — the transaction refused up front.
    assert.ok(fs.existsSync(path.join(dir, '.leeway/.inbox/ideas/2026-06-01--smart-retry.md')));
    assert.ok(!fs.existsSync(path.join(dir, '.leeway/.inbox/.archived/ideas/2026-06-01--smart-retry.md')));
    assert.strictEqual(stateGit(dir, ['status', '--porcelain']).trim(), '');
  });
});

describe('inbox moveFiles rollback', () => {
  let dir;
  let realRename;
  const A = { from: 'in/a.md', to: 'out/a.md' };
  const B = { from: 'in/b.md', to: 'out/b.md' };
  const C = { from: 'in/c.md', to: 'out/c.md' };
  const files = world((dir) => {
    for (const name of ['a', 'b', 'c']) writeFile(dir, `.leeway/in/${name}.md`, `# ${name}\n`);
  });
  beforeEach(() => {
    dir = files();
    realRename = fs.renameSync;
  });
  afterEach(() => {
    fs.renameSync = realRename;
    cleanupFixture(dir);
  });

  // Fails every rename whose source ends with one of `failing`, recording
  // each rename attempted.
  function failRenames(failing) {
    const attempted = [];
    fs.renameSync = (from, to) => {
      const rel = path.relative(path.join(dir, '.leeway'), String(from));
      attempted.push(rel);
      const hit = failing.find((f) => rel === f);
      if (hit) throw new Error(`cannot rename ${hit}`);
      return realRename(from, to);
    };
    return attempted;
  }

  const at = (rel) => fs.existsSync(path.join(dir, '.leeway', rel));
  const absolute = (rel) => path.join(dir, '.leeway', rel);

  it('the second of three moves throws and its reversal throws too: the original error surfaces, the stranded file attached', () => {
    const attempted = failRenames(['in/b.md', 'out/a.md']);
    let caught;
    try { moveFiles(dir, [A, B, C]); } catch (err) { caught = err; }
    assert.ok(caught instanceof Error);
    assert.strictEqual(caught.message,
      `cannot rename in/b.md — and a file could not be put back: "${absolute('out/a.md')}" (belongs at "${absolute('in/a.md')}")`);
    assert.deepStrictEqual(caught.stranded.map(({ from, to }) => ({ from, to })), [{ from: absolute(A.from), to: absolute(A.to) }]);
    assert.match(caught.stranded[0].error.message, /cannot rename out\/a\.md/);
    assert.deepStrictEqual(attempted, ['in/a.md', 'in/b.md', 'out/a.md'], 'c never moved; a\'s reversal was attempted');
    assert.ok(at('out/a.md') && at('in/b.md') && at('in/c.md'));
  });

  it('a reversal that throws never stops the ones after it', () => {
    const attempted = failRenames(['in/c.md', 'out/b.md']);
    let caught;
    try { moveFiles(dir, [A, B, C]); } catch (err) { caught = err; }
    assert.ok(caught.message.startsWith(`cannot rename in/c.md — and a file could not be put back: "${absolute('out/b.md')}"`), caught.message);
    assert.deepStrictEqual(attempted.slice(3), ['out/b.md', 'out/a.md'], 'both reversals attempted, latest first');
    assert.ok(at('in/a.md'), 'the reversal after the failing one put a back');
    assert.ok(at('out/b.md') && at('in/c.md'));
  });

  it('a clean rollback rethrows the original error untouched', () => {
    failRenames(['in/c.md']);
    let caught;
    try { moveFiles(dir, [A, B, C]); } catch (err) { caught = err; }
    assert.strictEqual(caught.message, 'cannot rename in/c.md');
    assert.strictEqual(caught.stranded, undefined);
    assert.ok(at('in/a.md') && at('in/b.md') && at('in/c.md'));
  });
});

describe('engine commit', () => {
  const unit = world((dir) => {
    writeFile(dir, '.leeway/payments/manifest.json', '{"name":"payments"}\n');
    writeFile(dir, '.leeway/.inbox/ideas/2026-06-01--x.md', '# X\n');
    commitAll(dir, 'init');
  });
  let dir;
  beforeEach(() => { dir = unit(); });
  afterEach(() => { cleanupFixture(dir); });

  it('stages the work-unit scope and commits with the given message', () => {
    writeFile(dir, '.leeway/payments/topics/auth/log.md', '# Auth\n');
    writeFile(dir, 'unrelated.txt', 'outside the scope\n');

    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/auth): document decision']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.strictEqual(lastMessage(dir), 'discussion(payments/auth): document decision');
    // Scoped: the unrelated file stays uncommitted.
    assert.match(git(dir, ['status', '--porcelain']), /\?\? unrelated\.txt/);
  });

  it('a clean tree is fine: committed null, nothing-to-commit note, exit 0', () => {
    const res = engine(dir, ['commit', 'payments', '-m', 'noop']);
    assert.deepStrictEqual(res, { ok: true, committed: null, note: 'nothing to commit' });
  });

  it('--inbox commits the inbox scope', () => {
    writeFile(dir, '.leeway/.inbox/ideas/2026-06-02--y.md', '# Y\n');
    const res = engine(dir, ['commit', '--inbox', '-m', 'workflow(inbox): capture y']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): capture y');
  });

  it('--plan stages the recorded storage paths and the project manifest alongside the work unit', () => {
    const m = JSON.parse(fs.readFileSync(path.join(dir, '.leeway/payments/manifest.json'), 'utf8'));
    m.phases = { ...(m.phases || {}), planning: { items: { auth: { status: 'in-progress', storage_paths: ['.tracker/'] } } } };
    fs.writeFileSync(path.join(dir, '.leeway/payments/manifest.json'), JSON.stringify(m, null, 2) + '\n');
    writeFile(dir, '.tracker/tasks-auth.jsonl', '{"id":"auth-1-1"}\n');
    writeFile(dir, '.leeway/manifest.json', JSON.stringify({ work_units: { payments: { work_type: 'epic' } }, defaults: { plan_format: 'x' } }) + '\n');
    writeFile(dir, 'unrelated.txt', 'outside the scope\n');

    const res = engine(dir, ['commit', 'payments', '-m', 'planning(payments): author task auth-1-1', '--plan', 'auth']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.strictEqual(res.code_committed, git(dir, ['rev-parse', '--short', 'HEAD']).trim());
    assert.deepStrictEqual(stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').sort(),
      ['manifest.json', 'payments/manifest.json']);
    assert.deepStrictEqual(git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n'), ['.tracker/tasks-auth.jsonl']);
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'planning(payments): author task auth-1-1');
    assert.match(git(dir, ['status', '--porcelain']), /\?\? unrelated\.txt/, 'code never rides a --plan commit');
  });

  it('--plan with empty storage_paths is the plain scoped commit plus project manifest', () => {
    const m = JSON.parse(fs.readFileSync(path.join(dir, '.leeway/payments/manifest.json'), 'utf8'));
    m.phases = { ...(m.phases || {}), planning: { items: { auth: { status: 'in-progress', storage_paths: [] } } } };
    fs.writeFileSync(path.join(dir, '.leeway/payments/manifest.json'), JSON.stringify(m, null, 2) + '\n');
    const res = engine(dir, ['commit', 'payments', '-m', 'planning(payments): initialize plan', '--plan', 'auth']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.strictEqual(res.code_committed, null);
  });

  it('--plan stages tracked deletions of a storage path removed from disk (restart cleanup)', () => {
    const m = JSON.parse(fs.readFileSync(path.join(dir, '.leeway/payments/manifest.json'), 'utf8'));
    m.phases = { ...(m.phases || {}), planning: { items: { auth: { status: 'in-progress', storage_paths: ['.tracker/'] } } } };
    fs.writeFileSync(path.join(dir, '.leeway/payments/manifest.json'), JSON.stringify(m, null, 2) + '\n');
    writeFile(dir, '.tracker/tasks-auth.jsonl', '{"id":"auth-1-1"}\n');
    commitAll(dir, 'seed the tracker storage');
    fs.rmSync(path.join(dir, '.tracker'), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

    const res = engine(dir, ['commit', 'payments', '-m', 'planning(payments): restart plan', '--plan', 'auth']);
    assert.strictEqual(res.committed, null, 'the plan\'s state was already committed');
    assert.strictEqual(res.code_committed, git(dir, ['rev-parse', '--short', 'HEAD']).trim());
    assert.match(git(dir, ['show', '--name-status', 'HEAD']), /^D\t\.tracker\/tasks-auth\.jsonl$/m, 'deletion staged');
    assert.strictEqual(git(dir, ['status', '--porcelain']).trim() + stateGit(dir, ['status', '--porcelain']).trim(), '', 'no stray dirt');
  });

  it('--plan is loud on a missing planning item, missing storage_paths, and illegal entries', () => {
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--plan', 'ghost']).error, /no planning item "ghost"/);
    const m = JSON.parse(fs.readFileSync(path.join(dir, '.leeway/payments/manifest.json'), 'utf8'));
    m.phases = { ...(m.phases || {}), planning: { items: { auth: { status: 'in-progress' } } } };
    fs.writeFileSync(path.join(dir, '.leeway/payments/manifest.json'), JSON.stringify(m, null, 2) + '\n');
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--plan', 'auth']).error, /has no storage_paths — record the format/);
    m.phases.planning.items.auth.storage_paths = ['../evil'];
    fs.writeFileSync(path.join(dir, '.leeway/payments/manifest.json'), JSON.stringify(m, null, 2) + '\n');
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--plan', 'auth']).error, /illegal storage_paths entry/);
  });

  it('rejects a missing message, missing scope, and bad work unit names', () => {
    assert.match(engineFails(dir, ['commit', 'payments']).error, /Usage: engine commit/);
    assert.match(engineFails(dir, ['commit', '-m', 'msg']).error, /Usage: engine commit/);
    assert.match(engineFails(dir, ['commit', 'payments', '--inbox', '-m', 'msg']).error, /Usage: engine commit/);
    assert.match(engineFails(dir, ['commit', '../escape', '-m', 'msg']).error, /invalid work unit name/);
    assert.match(engineFails(dir, ['commit', 'ghost', '-m', 'msg']).error, /no work unit directory/);
  });
});

describe('the knowledge store never rides an engine commit', () => {
  const dirty = world((dir) => {
    writeFile(dir, '.leeway/payments/manifest.json', json({
      name: 'payments', work_type: 'epic', status: 'in-progress',
      phases: { discovery: { items: { 'auth-flow': { source: 'discovery' } } } },
    }));
    commitAll(dir, 'init');
    // Store dirt beside the work — what a transaction's index or remove
    // leaves.
    writeFile(dir, '.leeway/.knowledge/store.bin', 'v1\n');
  });
  let dir;
  beforeEach(() => { dir = dirty(); });
  afterEach(() => { cleanupFixture(dir); });

  function committedFiles() {
    return stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').sort();
  }

  it('engine commit <wu> takes the work unit and nothing of the store', () => {
    writeFile(dir, '.leeway/payments/topics/auth/log.md', '# Auth\n');
    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/auth): note']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.deepStrictEqual(committedFiles(), ['payments/topics/auth/log.md']);
  });

  it('a transaction commit takes its own paths and nothing of the store', () => {
    const res = engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'auth-flow']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.deepStrictEqual(committedFiles(), ['payments/manifest.json']);
    assert.strictEqual(stateGit(dir, ['status', '--porcelain', '--ignored', '--', '.knowledge']).trim(), '!! .knowledge/', 'the store stays out of the state');
  });
});

describe('engine commit --plan — hardening', () => {
  const feature = world((dir) => {
    writeFile(dir, '.leeway/auth-flow/manifest.json', json({ name: 'auth-flow', work_type: 'feature', status: 'in-progress', phases: {} }));
    commitAll(dir, 'init');
  });
  let dir;
  beforeEach(() => { dir = feature(); });
  afterEach(() => { cleanupFixture(dir); });

  function planWith(storage) {
    const m = JSON.parse(fs.readFileSync(path.join(dir, '.leeway/auth-flow/manifest.json'), 'utf8'));
    m.phases = { ...(m.phases || {}), planning: { items: { 'auth-flow': { status: 'in-progress', ...(storage !== undefined ? { storage_paths: storage } : {}) } } } };
    fs.writeFileSync(path.join(dir, '.leeway/auth-flow/manifest.json'), JSON.stringify(m, null, 2) + '\n');
  }

  it('a dangling --plan is a usage error, not a ghost lookup', () => {
    assert.match(engineFails(dir, ['commit', 'auth-flow', '-m', 'x', '--plan']).error, /Usage: engine commit/);
  });

  it('malformed storage_paths gets its own message — never the missing-field repair', () => {
    planWith([123]);
    const err = engineFails(dir, ['commit', 'auth-flow', '-m', 'x', '--plan', 'auth-flow']);
    assert.match(err.error, /malformed storage_paths/);
    assert.ok(!err.error.includes('record the format'), 'present-but-wrong is not missing');
  });

  it('the missing-field repair names the exact command', () => {
    planWith(undefined);
    const err = engineFails(dir, ['commit', 'auth-flow', '-m', 'x', '--plan', 'auth-flow']);
    assert.match(err.error, /engine manifest set auth-flow\.planning\.auth-flow storage_paths/);
  });

  it('multiple storage paths all stage', () => {
    planWith(['.tracker/', 'docs-tasks/']);
    writeFile(dir, '.tracker/t.jsonl', '{}\n');
    writeFile(dir, 'docs-tasks/a.md', 'task\n');
    engine(dir, ['commit', 'auth-flow', '-m', 'planning(auth-flow): author', '--plan', 'auth-flow']);
    const staged = git(dir, ['show', '--name-only', 'HEAD']);
    assert.match(staged, /\.tracker\/t\.jsonl/);
    assert.match(staged, /docs-tasks\/a\.md/);
  });
});

// Each transaction's knowledge change against a real keyword-only store that
// also holds chunks the change must leave alone — a sibling topic, the same
// topic's other phase, another work unit — so a change that wiped too much
// fails as surely as one that took too little.
describe('the transactions\' knowledge changes — a real store, its other chunks alongside', () => {
  const SPEC = 'payments/specification/session-model/specification.md';
  const OTHER_SPEC = 'payments/specification/fee-model/specification.md';
  const OTHER_UNIT = 'billing/specification/billing/specification.md';
  // An epic with a topic still in discussion, a specification in progress
  // and one completed, each from its own discussion; and a finished
  // cross-cutting unit beside it.
  const indexedWorld = world((dir) => {
    writeFile(dir, '.leeway/payments/manifest.json', json({
      name: 'payments', work_type: 'epic', status: 'in-progress',
      phases: {
        discovery: { items: { 'auth-flow': { source: 'discovery', order: 1 }, 'session-model': { source: 'discovery', order: 2 }, 'fee-model': { source: 'discovery', order: 3 } } },
        discussion: { items: { 'auth-flow': { status: 'in-progress' }, 'session-model': { status: 'completed' }, 'fee-model': { status: 'completed' } } },
        specification: {
          items: {
            'session-model': { status: 'in-progress', order: 1, sources: { 'session-model': { status: 'incorporated' } } },
            'fee-model': { status: 'completed', order: 2, sources: { 'fee-model': { status: 'incorporated' } } },
          },
        },
      },
    }));
    writeFile(dir, '.leeway/billing/manifest.json', json({
      name: 'billing', work_type: 'cross-cutting', status: 'in-progress',
      phases: { discussion: { items: { billing: { status: 'completed' } } }, specification: { items: { billing: { status: 'completed' } } } },
    }));
    for (const file of [SPEC, OTHER_SPEC, OTHER_UNIT]) writeFile(dir, `.leeway/${file}`, `# ${path.basename(file, '.md')}\n\nIts decision.\n`);
    commitAll(dir, 'init');
    harness.keywordOnlyKnowledge(dir);
    for (const file of [SPEC, OTHER_SPEC, OTHER_UNIT]) harness.output(dir, ['knowledge', 'index', path.join(dir, '.leeway', file)]);
  });
  let dir;
  beforeEach(() => { dir = indexedWorld(); });
  afterEach(() => { cleanupFixture(dir); });

  const indexed = () => harness.indexedFiles(dir);

  it('a Discovery-unit cancel leaves the store as it stands — a conversation indexes no artifact', () => {
    assert.deepStrictEqual(engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'auth-flow']).warnings, []);
    assert.deepStrictEqual(indexed(), [OTHER_UNIT, OTHER_SPEC, SPEC]);
  });

  it('a Definition-unit cancel takes the specification alone', () => {
    assert.deepStrictEqual(engine(dir, ['topic', 'cancel', 'payments', 'specification', 'session-model']).warnings, []);
    assert.deepStrictEqual(indexed(), [OTHER_UNIT, OTHER_SPEC]);
  });

  it('a supersede takes the superseded specification alone', () => {
    assert.deepStrictEqual(engine(dir, ['topic', 'supersede', 'payments', 'specification', 'session-model', '--by', 'fee-model']).warnings, []);
    assert.deepStrictEqual(indexed(), [OTHER_UNIT, OTHER_SPEC]);
  });

  it('a work-unit cancel takes the unit\'s chunks, and a reactivate brings back its completed artifacts — another unit\'s untouched', () => {
    assert.deepStrictEqual(engine(dir, ['workunit', 'cancel', 'payments']).warnings, []);
    assert.deepStrictEqual(indexed(), [OTHER_UNIT]);
    assert.deepStrictEqual(engine(dir, ['workunit', 'reactivate', 'payments']).warnings, []);
    assert.deepStrictEqual(indexed(), [OTHER_UNIT, OTHER_SPEC]);
  });

  it('a work-unit complete leaves the store as it stands', () => {
    const before = fs.readFileSync(path.join(dir, '.leeway/.knowledge/store.bin'));
    assert.deepStrictEqual(engine(dir, ['workunit', 'complete', 'payments', '-m', 'workflow(payments): complete']).warnings, []);
    assert.deepStrictEqual(fs.readFileSync(path.join(dir, '.leeway/.knowledge/store.bin')), before);
  });

  it('a work-unit complete over a cancelled, finished unit re-indexes it — another unit\'s untouched', () => {
    engine(dir, ['workunit', 'cancel', 'billing']);
    assert.ok(!indexed().includes(OTHER_UNIT));
    assert.deepStrictEqual(engine(dir, ['workunit', 'complete', 'billing', '-m', 'workflow(billing): complete']).warnings, []);
    assert.deepStrictEqual(indexed(), [OTHER_UNIT, OTHER_SPEC, SPEC]);
  });
});
