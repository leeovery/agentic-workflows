'use strict';

//
// Tests for migration 064: untrack-knowledge-store (.cjs)
//
// Against real git: the removal staged with the files left on disk and
// nothing committed, content staged over a tracked file, a store staged but
// never committed, a project nested in a larger repository, the rest of the
// index left as it was, the skips (nothing tracked, not a repository, git
// unavailable), idempotency, and — end to end with 060 — the reviewed
// migration commit recording the removal.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const harness = require('./engine-harness.cjs');
const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/064-untrack-knowledge-store.cjs');
const IGNORE_MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/060-ignore-knowledge-store.cjs');

const { git, setupGitFixture, cleanupFixture } = harness;

const KNOWLEDGE_DIR = '.workflows/.knowledge';
const STORE_FILES = ['store.bin', 'metadata.json', 'config.json'].map((f) => `${KNOWLEDGE_DIR}/${f}`);

let dir, updates, skips;

function run(projectDir = dir, migration = MIGRATION) {
  migration.run({ projectDir, reportUpdate: () => { updates++; }, reportSkip: () => { skips++; } });
}
function write(rel, content, root = dir) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function read(rel, root = dir) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function commit(files, message, root = dir) {
  git(root, ['add', '--', ...files]);
  git(root, ['commit', '-q', '-m', message]);
}
function commitStore(files = STORE_FILES, root = dir) {
  for (const f of files) write(f, `${f} committed\n`, root);
  commit(files, 'chore(knowledge): initialise store', root);
}
const tracked = (root = dir) => git(root, ['ls-files', '--', KNOWLEDGE_DIR]).trim().split('\n').filter(Boolean);
const staged = (root = dir) => git(root, ['diff', '--cached', '--name-status']).trim().split('\n').filter(Boolean).sort();
const head = (root = dir) => git(root, ['rev-parse', 'HEAD']).trim();

describe('migration 064: untrack the knowledge directory', () => {
  beforeEach(() => {
    dir = setupGitFixture('migration-064-');
    write('.workflows/payments/manifest.json', '{"name":"payments"}\n');
    commit(['.workflows/payments/manifest.json'], 'init');
    updates = 0;
    skips = 0;
  });
  afterEach(() => { cleanupFixture(dir); });

  it('stages the removal of every tracked file under the directory — one update, the files on disk, nothing committed', () => {
    const backup = `${KNOWLEDGE_DIR}/store.bin.bak`;
    commitStore([...STORE_FILES, backup]);
    write(STORE_FILES[0], 'the store this checkout built since\n');
    const before = head();

    run();

    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
    assert.deepStrictEqual(tracked(), []);
    assert.deepStrictEqual(staged(), [...STORE_FILES, backup].map((f) => `D\t${f}`).sort());
    assert.strictEqual(read(STORE_FILES[0]), 'the store this checkout built since\n');
    for (const f of [...STORE_FILES.slice(1), backup]) assert.strictEqual(read(f), `${f} committed\n`);
    assert.strictEqual(head(), before, 'a migration never commits');
  });

  it('content staged over a tracked file, and changed again on disk since, is untracked all the same — the file as it is on disk', () => {
    commitStore();
    write(STORE_FILES[0], 'staged\n');
    git(dir, ['add', '--', STORE_FILES[0]]);
    write(STORE_FILES[0], 'rebuilt since\n');

    run();

    assert.strictEqual(updates, 1);
    assert.deepStrictEqual(tracked(), []);
    assert.deepStrictEqual(staged(), STORE_FILES.map((f) => `D\t${f}`).sort());
    assert.strictEqual(read(STORE_FILES[0]), 'rebuilt since\n');
  });

  it('a store staged but never committed leaves the index — nothing staged for it, the files on disk', () => {
    for (const f of STORE_FILES) write(f, 'staged\n');
    git(dir, ['add', '--', ...STORE_FILES]);

    run();

    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
    assert.deepStrictEqual(tracked(), []);
    assert.deepStrictEqual(staged(), []);
    for (const f of STORE_FILES) assert.strictEqual(read(f), 'staged\n');
  });

  it('leaves the rest of the index as it was — other staged changes staged, other tracked files tracked, a near name untouched', () => {
    commitStore();
    write('src/app.js', 'const x = 1;\n');
    write('.workflows/.knowledge-notes.md', '# notes\n');
    commit(['src/app.js', '.workflows/.knowledge-notes.md'], 'code and notes');
    write('.workflows/payments/manifest.json', '{"name":"payments","v":2}\n');
    write('src/new.js', 'const n = 1;\n');
    git(dir, ['add', '--', '.workflows/payments/manifest.json', 'src/new.js']);
    write('src/app.js', 'const x = 2;\n');

    run();

    assert.deepStrictEqual(staged(), [
      ...STORE_FILES.map((f) => `D\t${f}`),
      'A\tsrc/new.js',
      'M\t.workflows/payments/manifest.json',
    ].sort());
    assert.deepStrictEqual(git(dir, ['ls-files']).trim().split('\n').sort(), [
      '.workflows/.knowledge-notes.md',
      '.workflows/payments/manifest.json',
      'src/app.js',
      'src/new.js',
    ]);
    assert.strictEqual(git(dir, ['diff', '--name-only']).trim(), 'src/app.js', 'the unstaged edit stays unstaged');
  });

  it('a project nested in a larger repository untracks its own directory alone', () => {
    const project = 'apps/web';
    commitStore(STORE_FILES.map((f) => `${project}/${f}`));
    commitStore();

    run(path.join(dir, project));

    assert.strictEqual(updates, 1);
    assert.deepStrictEqual(tracked(path.join(dir, project)), []);
    assert.deepStrictEqual(tracked(), [...STORE_FILES].sort(), 'the repository root\'s own directory stays tracked');
    assert.deepStrictEqual(staged(), STORE_FILES.map((f) => `D\t${project}/${f}`).sort());
  });

  it('nothing tracked under the directory — a skip, the index untouched, the files on disk', () => {
    for (const f of STORE_FILES) write(f, 'local\n');
    write('src/app.js', 'const x = 1;\n');
    git(dir, ['add', '--', 'src/app.js']);

    run();

    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    assert.deepStrictEqual(staged(), ['A\tsrc/app.js']);
    for (const f of STORE_FILES) assert.strictEqual(read(f), 'local\n');
  });

  it('not a git repository — a skip, never a throw, the files on disk', () => {
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-064-plain-'));
    try {
      for (const f of STORE_FILES) write(f, 'local\n', plain);

      run(plain);

      assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
      for (const f of STORE_FILES) assert.strictEqual(read(f, plain), 'local\n');
    } finally {
      cleanupFixture(plain);
    }
  });

  it('git unavailable — a skip, never a throw, still tracked', () => {
    commitStore();
    const emptyPath = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-064-path-'));
    const saved = process.env.PATH;
    try {
      process.env.PATH = emptyPath;
      run();
    } finally {
      process.env.PATH = saved;
      cleanupFixture(emptyPath);
    }

    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    assert.deepStrictEqual(tracked(), [...STORE_FILES].sort());
  });

  it('idempotency — a second run finds nothing tracked and leaves the staged removal as it was', () => {
    commitStore();

    run();
    const after = staged();
    updates = 0;
    skips = 0;
    run();

    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    assert.deepStrictEqual(staged(), after);
  });

  it('end to end with 060 — the reviewed migration commit records the removal beside the ignore rule, and the files stay out of git on disk', () => {
    write('.workflows/.gitignore', '.cache/\n');
    commit(['.workflows/.gitignore'], 'the rules before the knowledge directory was ignored');
    commitStore();
    const bytes = STORE_FILES.map((f) => read(f));

    run(dir, IGNORE_MIGRATION);
    run();
    const res = harness.ok(dir, ['commit', '--migrations', '-m', 'chore: apply workflow migrations']);

    assert.strictEqual(res.committed, git(dir, ['rev-parse', '--short', 'HEAD']).trim());
    assert.deepStrictEqual(
      git(dir, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim().split('\n').sort(),
      [...STORE_FILES.map((f) => `D\t${f}`), 'M\t.workflows/.gitignore'].sort());
    assert.deepStrictEqual(read('.workflows/.gitignore').split('\n').filter(Boolean), ['.cache/', '.knowledge/']);
    assert.deepStrictEqual(tracked(), []);
    assert.deepStrictEqual(STORE_FILES.map((f) => read(f)), bytes, 'the files stay on disk, byte for byte');
    assert.strictEqual(git(dir, ['status', '--porcelain', '--untracked-files=all']).trim(), '', 'ignored — nothing left to stage');
    assert.deepStrictEqual(harness.ok(dir, ['commit', '--migrations', '-m', 'noop']),
      { ok: true, committed: null, note: 'nothing to commit' });
  });
});
