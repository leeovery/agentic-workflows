'use strict';

// `engine workunit import` — the mid-session landing: a file the user shares
// after the opener, copied into the work unit's one imports home with the
// origin of the session that took it, indexed when it is markdown, committed
// confined to the imports directory and the manifest.

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  git, bareRepo, stateGit, commitAll, setupFixtureAt, ok, refuses, keywordOnlyKnowledge, unreadableKnowledge, indexedFiles,
} = require('./engine-harness.cjs');

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

/** The importing work unit: a feature mid-research. */
function featureManifest(overrides = {}) {
  return {
    name: 'ledger',
    work_type: 'feature',
    status: 'in-progress',
    created: '2026-06-01',
    description: 'ledger work',
    phases: { research: { items: { ledger: { status: 'in-progress' } } } },
    ...overrides,
  };
}

/** The same unit sitting in `phase` instead — one item, live. */
function featureIn(phase, status = 'in-progress') {
  return featureManifest({ phases: { [phase]: { items: { ledger: { status } } } } });
}

/** An epic sitting in `phase` under a topic of its own, never the unit's name. */
function epicIn(phase, topic = 'onboarding') {
  return featureManifest({
    work_type: 'epic',
    phases: { [phase]: { items: { [topic]: { status: 'in-progress' } } } },
  });
}

function setupFixture({ feature = featureManifest() } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-wu-import-'));
  const project = setupFixtureAt(path.join(root, 'project'));
  keywordOnlyKnowledge(project);
  writeFile(project, '.leeway/manifest.json', JSON.stringify({
    work_units: { [feature.name]: { work_type: feature.work_type } },
  }, null, 2) + '\n');
  writeFile(project, `.leeway/${feature.name}/manifest.json`, JSON.stringify(feature, null, 2) + '\n');
  commitAll(project, 'init');

  return {
    root,
    project,
    init: stateGit(project, ['rev-parse', 'HEAD']).trim(),
    env: { CLAUDE_CODE_SESSION_ID: 'import-session', CLAUDE_PID: String(process.pid) },
  };
}

/** @param {{root: string}} fix */
function removeFixture(fix) {
  fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

/** Run the engine expecting success; returns the parsed JSON response. */
const engine = (fix, args, env = {}) => ok(fix.project, args, { env: { ...fix.env, ...env } });

/** Run the engine expecting failure; returns the parsed stderr JSON. */
const engineFails = (fix, args, env = {}) => refuses(fix.project, args, { env: { ...fix.env, ...env } });

function readManifest(fix, wu) {
  return JSON.parse(fs.readFileSync(path.join(fix.project, '.leeway', wu, 'manifest.json'), 'utf8'));
}

function shortHead(fix) {
  return stateGit(fix.project, ['rev-parse', '--short', 'HEAD']).trim();
}

/** The state commits made since the fixture's own. */
function commitsSinceInit(fix) {
  return stateGit(fix.project, ['rev-list', '--count', `${fix.init}..HEAD`]).trim();
}

/** A landed import's absolute path, as the response names it. @param {string} name */
function landed(fix, name) {
  return path.join(fix.project, '.leeway', 'ledger', 'imports', name);
}

const ISO_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const FROM_RESEARCH = ['--from', 'research/ledger'];

describe('engine workunit import — happy path', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); });
  afterEach(() => { removeFixture(fix); });

  it('lands a binary and a markdown source, records the origin, indexes the markdown alone, commits once', () => {
    writeFile(fix.project, 'shots/Dockset 05 Material.JPEG', 'jpeg bytes\n');
    writeFile(fix.project, 'notes/Onboarding Notes.txt', 'plain notes\n');
    const res = engine(fix, ['workunit', 'import', 'ledger',
      'shots/Dockset 05 Material.JPEG', 'notes/Onboarding Notes.txt', ...FROM_RESEARCH]);

    assert.deepStrictEqual(res, {
      ok: true,
      op: 'import',
      imports: [
        { path: landed(fix, 'dockset-05-material.jpeg'), origin: 'research/ledger' },
        { path: landed(fix, 'onboarding-notes.md'), origin: 'research/ledger' },
      ],
      skipped_imports: [],
      committed: shortHead(fix),
    });

    const entries = readManifest(fix, 'ledger').imports;
    assert.deepStrictEqual(Object.keys(entries[0]), ['path', 'imported_at', 'origin']);
    assert.match(entries[0].imported_at, ISO_SECONDS);
    assert.deepStrictEqual(entries.map((e) => e.origin), ['research/ledger', 'research/ledger']);

    // Copied, source untouched, mode pinned.
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.leeway/ledger/imports/dockset-05-material.jpeg'), 'utf8'), 'jpeg bytes\n');
    assert.ok(fs.existsSync(path.join(fix.project, 'shots/Dockset 05 Material.JPEG')));

    // Only the markdown landing is knowledge-base material.
    assert.deepStrictEqual(indexedFiles(fix.project), ['ledger/imports/onboarding-notes.md']);

    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'workflow(ledger): import 2 file(s) for research/ledger');
  });

  it('lands an absolute source from outside the project', () => {
    const outside = path.join(fix.root, 'downloads/Field Notes.PNG');
    fs.mkdirSync(path.dirname(outside), { recursive: true });
    fs.writeFileSync(outside, 'png bytes\n');
    const res = engine(fix, ['workunit', 'import', 'ledger', outside, ...FROM_RESEARCH]);

    assert.deepStrictEqual(res.imports, [{ path: landed(fix, 'field-notes.png'), origin: 'research/ledger' }]);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.leeway/ledger/imports/field-notes.png'), 'utf8'), 'png bytes\n');
    assert.ok(fs.existsSync(outside), 'the source outside the project is copied, never moved');
  });

  it('lands every copy 0644, whatever the source carried', () => {
    writeFile(fix.project, 'shots/locked.png', 'png bytes\n');
    fs.chmodSync(path.join(fix.project, 'shots/locked.png'), 0o600);
    engine(fix, ['workunit', 'import', 'ledger', 'shots/locked.png', ...FROM_RESEARCH]);

    const mode = fs.statSync(path.join(fix.project, '.leeway/ledger/imports/locked.png')).mode & 0o777;
    assert.strictEqual(mode, 0o644, `landed mode ${mode.toString(8)}`);
  });

  it('a bare discovery origin lands the same way', () => {
    writeFile(fix.project, 'notes/brief.md', '# Brief\n');
    const res = engine(fix, ['workunit', 'import', 'ledger', 'notes/brief.md', '--from', 'discovery']);

    assert.deepStrictEqual(res.imports, [{ path: landed(fix, 'brief.md'), origin: 'discovery' }]);
    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'workflow(ledger): import 1 file(s) for discovery');
  });

  it('commits the imports directory and the manifest and nothing else dirty', () => {
    writeFile(fix.project, 'notes/brief.md', '# Brief\n');
    writeFile(fix.project, 'unrelated.txt', 'outside the scope\n');
    writeFile(fix.project, '.leeway/ledger/research/ledger.md', '# Research — a peer session mid-write\n');
    engine(fix, ['workunit', 'import', 'ledger', 'notes/brief.md', ...FROM_RESEARCH]);

    const staged = stateGit(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.deepStrictEqual(staged.sort(), ['ledger/imports/brief.md', 'ledger/manifest.json']);
    assert.match(git(fix.project, ['status', '--porcelain']), /\?\? unrelated\.txt/);
    assert.match(stateGit(fix.project, ['status', '--porcelain']), /\?\? ledger\/research\//);
  });

  it('appends to an existing imports array across calls', () => {
    writeFile(fix.project, 'notes/one.md', 'one\n');
    writeFile(fix.project, 'notes/two.png', 'two\n');
    engine(fix, ['workunit', 'import', 'ledger', 'notes/one.md', '--from', 'discovery']);
    engine(fix, ['workunit', 'import', 'ledger', 'notes/two.png', ...FROM_RESEARCH]);

    assert.deepStrictEqual(readManifest(fix, 'ledger').imports.map((e) => [e.path, e.origin]), [
      ['imports/one.md', 'discovery'],
      ['imports/two.png', 'research/ledger'],
    ]);
  });
});

describe('engine workunit import — from a code worktree (4.S1)', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); });
  afterEach(() => { removeFixture(fix); });

  // One worktree sits inside the main checkout, as Claude Code places them,
  // and one beside it, where no folder above holds `.leeway/`: the state is
  // found through the common directory from both.
  it('lands in the main checkout\'s one state, answers its absolute path, pushes the state branch, and leaves every code branch as it was', () => {
    const remote = bareRepo(path.join(fix.root, 'remote.git'));
    git(fix.project, ['remote', 'add', 'origin', remote]);
    const worktrees = [
      { branch: 'inside', wt: path.join(fix.project, '.claude', 'worktrees', 'inside'), name: 'inside' },
      { branch: 'beside', wt: path.join(fix.root, 'beside'), name: 'beside' },
    ];
    for (const { branch, wt } of worktrees) git(fix.project, ['worktree', 'add', '-q', '-b', branch, wt]);
    const codeHeads = () => ['main', ...worktrees.map((w) => w.branch)].map((branch) => git(fix.project, ['rev-parse', branch]).trim());
    const before = codeHeads();

    worktrees.forEach(({ wt, name }, i) => {
      writeFile(wt, `notes/${name} notes.md`, `# ${name}\n`);

      const res = ok(wt, ['workunit', 'import', 'ledger', `notes/${name} notes.md`, ...FROM_RESEARCH], { env: fix.env });

      assert.deepStrictEqual(res, {
        ok: true,
        op: 'import',
        imports: [{ path: landed(fix, `${name}-notes.md`), origin: 'research/ledger' }],
        skipped_imports: [],
        committed: shortHead(fix),
      }, name);
      assert.strictEqual(fs.readFileSync(landed(fix, `${name}-notes.md`), 'utf8'), `# ${name}\n`, name);
      assert.ok(!fs.existsSync(path.join(wt, '.leeway')), `the ${name} worktree holds no state of its own`);
      assert.strictEqual(commitsSinceInit(fix), String(i + 1), name);
      assert.strictEqual(git(remote, ['rev-parse', 'refs/heads/leeway-state']).trim(), stateGit(fix.project, ['rev-parse', 'HEAD']).trim(),
        `the state commit from ${name} is on the remote`);
    });
    assert.ok(!fs.existsSync(path.join(fix.root, '.leeway')), 'nothing beside the checkout');
    assert.deepStrictEqual(codeHeads(), before, 'no code branch takes a state commit');
  });
});

describe('engine workunit import — names', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); });
  afterEach(() => { removeFixture(fix); });

  it('dedupes against the directory and the batch, suffixing the stem', () => {
    writeFile(fix.project, 'a/shot.png', 'one\n');
    writeFile(fix.project, 'b/SHOT.png', 'two\n');
    const first = engine(fix, ['workunit', 'import', 'ledger', 'a/shot.png', 'b/SHOT.png', ...FROM_RESEARCH]);
    assert.deepStrictEqual(first.imports.map((i) => i.path), [landed(fix, 'shot.png'), landed(fix, 'shot-2.png')]);

    writeFile(fix.project, 'c/shot.png', 'three\n');
    const second = engine(fix, ['workunit', 'import', 'ledger', 'c/shot.png', ...FROM_RESEARCH]);
    assert.deepStrictEqual(second.imports.map((i) => i.path), [landed(fix, 'shot-3.png')]);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.leeway/ledger/imports/shot.png'), 'utf8'), 'one\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.leeway/ledger/imports/shot-3.png'), 'utf8'), 'three\n');
  });

  it('skips a dotfile source and reports it; a call whose every source skips refuses', () => {
    writeFile(fix.project, 'notes/.env', 'SECRET=1\n');
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    const res = engine(fix, ['workunit', 'import', 'ledger', 'notes/.env', 'notes/good.md', ...FROM_RESEARCH]);
    assert.deepStrictEqual(res.skipped_imports, ['notes/.env']);
    assert.deepStrictEqual(res.imports, [{ path: landed(fix, 'good.md'), origin: 'research/ledger' }]);

    const err = engineFails(fix, ['workunit', 'import', 'ledger', 'notes/.env', ...FROM_RESEARCH]);
    assert.match(err.error, /nothing to land/);
    assert.strictEqual(readManifest(fix, 'ledger').imports.length, 1, 'the refused call recorded nothing');
  });

  it('skips a dotfile whatever follows the dot — a named extension does not make it material', () => {
    writeFile(fix.project, 'notes/.hidden.md', 'hidden prose\n');
    writeFile(fix.project, 'notes/.eslintrc.json', '{}\n');
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    const res = engine(fix, ['workunit', 'import', 'ledger',
      'notes/.hidden.md', 'notes/.eslintrc.json', 'notes/good.md', ...FROM_RESEARCH]);

    assert.deepStrictEqual(res.skipped_imports, ['notes/.hidden.md', 'notes/.eslintrc.json']);
    assert.deepStrictEqual(res.imports, [{ path: landed(fix, 'good.md'), origin: 'research/ledger' }]);
    assert.deepStrictEqual(fs.readdirSync(path.join(fix.project, '.leeway/ledger/imports')), ['good.md']);
  });
});

describe('engine workunit import — refusals leave nothing behind', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); });
  afterEach(() => { removeFixture(fix); });

  it('a missing path fails the whole call with missing_imports — nothing copied', () => {
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    const err = engineFails(fix, ['workunit', 'import', 'ledger', 'notes/good.md', 'notes/ghost.png', ...FROM_RESEARCH]);

    assert.match(err.error, /import path\(s\) not found/);
    assert.deepStrictEqual(err.missing_imports, ['notes/ghost.png']);
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/ledger/imports')));
    assert.strictEqual(readManifest(fix, 'ledger').imports, undefined);
    assert.strictEqual(commitsSinceInit(fix), '0');
    assert.deepStrictEqual(indexedFiles(fix.project), []);
  });

  it('a directory among the paths refuses before any copy — no half-landed batch', () => {
    writeFile(fix.project, 'shots/one.png', 'one\n');
    fs.mkdirSync(path.join(fix.project, 'shots/album'), { recursive: true });
    const err = engineFails(fix, ['workunit', 'import', 'ledger', 'shots/one.png', 'shots/album', ...FROM_RESEARCH]);

    assert.match(err.error, /import path\(s\) not found, not a file, or unreadable: shots\/album/);
    assert.deepStrictEqual(err.missing_imports, ['shots/album']);
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/ledger/imports')),
      'the file named before the directory never landed');
    assert.strictEqual(readManifest(fix, 'ledger').imports, undefined);
    assert.strictEqual(commitsSinceInit(fix), '0');
  });

  it('refuses an origin naming a phase item the work unit does not have — nothing lands, nothing is held', () => {
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    const err = engineFails(fix, ['workunit', 'import', 'ledger', 'notes/good.md', '--from', 'research/ghost']);

    assert.match(err.error, /^no research item "ghost" in "ledger" — check the --from origin$/);
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/ledger/imports')));
    assert.strictEqual(readManifest(fix, 'ledger').imports, undefined);
    assert.strictEqual(commitsSinceInit(fix), '0');
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/.cache/ledger')),
      'a mistyped topic mints no hold');

    // A leading dash is a legal topic name (absorb can write one), so the
    // vocabulary passes it and the item check is what refuses it.
    assert.match(engineFails(fix, ['workunit', 'import', 'ledger', 'notes/good.md', '--from', 'research/-leading']).error,
      /^no research item "-leading" in "ledger" — check the --from origin$/);
  });

  it('refuses an unknown work unit', () => {
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    assert.match(engineFails(fix, ['workunit', 'import', 'ghost-unit', 'notes/good.md', ...FROM_RESEARCH]).error,
      /manifest not found/);
  });

  it('refuses a work unit that is not in-progress', () => {
    removeFixture(fix);
    fix = setupFixture({ feature: featureManifest({ status: 'completed' }) });
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    assert.match(engineFails(fix, ['workunit', 'import', 'ledger', 'notes/good.md', ...FROM_RESEARCH]).error,
      /not in-progress \(status: completed\) — imports land in active work/);
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/ledger/imports')));
  });

  it('refuses an origin outside the vocabulary', () => {
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    for (const origin of ['planning/ledger', 'research', 'research/led.ger', 'research/a/b', 'research/']) {
      assert.match(engineFails(fix, ['workunit', 'import', 'ledger', 'notes/good.md', '--from', origin]).error,
        /is not a work-unit import origin/, `origin "${origin}" was not refused`);
    }
    // An empty `--from` never reaches the vocabulary: the dispatch has no origin.
    assert.match(engineFails(fix, ['workunit', 'import', 'ledger', 'notes/good.md', '--from', '']).error,
      /Usage: engine workunit import/);
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/ledger/imports')));
  });

  it("refuses roadmap — the product layer's origin is not a work unit's", () => {
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    assert.match(engineFails(fix, ['workunit', 'import', 'ledger', 'notes/good.md', '--from', 'roadmap']).error,
      /is not a work-unit import origin .*roadmap is the product layer's own — engine roadmap import/);
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/ledger/imports')));
    assert.strictEqual(readManifest(fix, 'ledger').imports, undefined);
  });

  it('refuses missing arguments with usage', () => {
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    const usage = /Usage: engine workunit import/;
    assert.match(engineFails(fix, ['workunit', 'import']).error, usage);
    assert.match(engineFails(fix, ['workunit', 'import', 'ledger']).error, usage);
    assert.match(engineFails(fix, ['workunit', 'import', 'ledger', 'notes/good.md']).error, usage);
  });

  it('refuses a malformed imports node before any file is copied', () => {
    removeFixture(fix);
    fix = setupFixture({ feature: featureManifest({ imports: 'corrupt' }) });
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    assert.match(engineFails(fix, ['workunit', 'import', 'ledger', 'notes/good.md', ...FROM_RESEARCH]).error,
      /imports is malformed/);
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/ledger/imports')));
  });
});

describe('engine workunit import — the derived tail', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); });
  afterEach(() => { removeFixture(fix); });

  it('a knowledge failure warns and the commit still lands', () => {
    unreadableKnowledge(fix.project);
    writeFile(fix.project, 'notes/brief.md', '# Brief\n');
    const res = engine(fix, ['workunit', 'import', 'ledger', 'notes/brief.md', ...FROM_RESEARCH]);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^knowledge index \(imports\/brief\.md\) failed: loadStore: corrupted store file at /);
    assert.strictEqual(res.committed, shortHead(fix));
    assert.strictEqual(readManifest(fix, 'ledger').imports.length, 1, 'the manifest write is the source of truth');
  });

  it("beats presence on the origin's topic — a bare discovery origin beats nothing", () => {
    writeFile(fix.project, 'notes/brief.md', '# Brief\n');
    writeFile(fix.project, 'notes/other.md', '# Other\n');
    engine(fix, ['workunit', 'import', 'ledger', 'notes/brief.md', ...FROM_RESEARCH]);
    assert.ok(fs.existsSync(path.join(fix.project, '.leeway/.cache/ledger/research/ledger/presence')),
      "the landing session's own topic is beaten");

    fs.rmSync(path.join(fix.project, '.leeway/.cache/ledger'), { recursive: true, force: true });
    engine(fix, ['workunit', 'import', 'ledger', 'notes/other.md', '--from', 'discovery']);
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/.cache/ledger')),
      'discovery names no topic — nothing to beat');
  });

  it('every phase the vocabulary carries lands and beats the origin topic, never the work unit', () => {
    for (const phase of ['research', 'discussion', 'investigation']) {
      removeFixture(fix);
      fix = setupFixture({ feature: epicIn(phase) });
      writeFile(fix.project, 'notes/brief.md', '# Brief\n');
      const res = engine(fix, ['workunit', 'import', 'ledger', 'notes/brief.md', '--from', `${phase}/onboarding`]);

      assert.deepStrictEqual(res.imports, [{ path: landed(fix, 'brief.md'), origin: `${phase}/onboarding` }]);
      assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(),
        `workflow(ledger): import 1 file(s) for ${phase}/onboarding`);
      assert.ok(fs.existsSync(path.join(fix.project, `.leeway/.cache/ledger/${phase}/onboarding/presence`)),
        `${phase} did not beat the origin's topic`);
      assert.deepStrictEqual(fs.readdirSync(path.join(fix.project, `.leeway/.cache/ledger/${phase}`)), ['onboarding'],
        `${phase} beat a row of the work unit's name`);
    }
  });

  it('a terminal item takes the landing and leaves the row exactly as it found it', () => {
    for (const status of ['completed', 'cancelled', 'superseded', 'promoted']) {
      removeFixture(fix);
      fix = setupFixture({ feature: featureIn('research', status) });
      writeFile(fix.project, 'notes/brief.md', '# Brief\n');
      // A row left by the session that closed the topic: the landing neither
      // beats it nor clears it.
      const row = path.join(fix.project, '.leeway/.cache/ledger/research/ledger/presence');
      writeFile(fix.project, '.leeway/.cache/ledger/research/ledger/presence', 'stale-row\n');
      const before = fs.readFileSync(row, 'utf8');
      const res = engine(fix, ['workunit', 'import', 'ledger', 'notes/brief.md', ...FROM_RESEARCH]);

      assert.deepStrictEqual(res.imports, [{ path: landed(fix, 'brief.md'), origin: 'research/ledger' }]);
      assert.strictEqual(fs.readFileSync(row, 'utf8'), before, `a ${status} item's row was rewritten`);
    }
  });

  it('a blocked commit saves the state and names the imports scope in its retry', () => {
    writeFile(fix.project, 'notes/brief.md', '# Brief\n');
    // Git cannot take the state branch's ref lock.
    fs.writeFileSync(path.join(fix.project, '.git', 'refs', 'heads', 'leeway-state.lock'), '');
    const res = engine(fix, ['workunit', 'import', 'ledger', 'notes/brief.md', ...FROM_RESEARCH]);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.committed, null);
    assert.strictEqual(res.note, 'commit pending — state saved; retry with: engine commit ledger --imports -m "<message>"');
    assert.ok(res.warnings.some((w) => w.includes('commit failed')), JSON.stringify(res.warnings));
    assert.strictEqual(readManifest(fix, 'ledger').imports.length, 1, 'the manifest write is the source of truth');
  });
});
