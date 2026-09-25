'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn, spawnSync } = require('child_process');
const { installTmuxStub, tmuxStubEnv, tmuxStubName } = require('./tmux-stub.cjs');
const harness = require('./engine-harness.cjs');

const { git, knowledgeCalls } = harness;
const REAL_SCRIPTS = path.dirname(harness.ENGINE);
const REAL_KNOWLEDGE = path.resolve(REAL_SCRIPTS, '../../workflow-knowledge');

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The session hooks boot keeps in every project's `.claude/settings.json`.
const HOOK_ENGINE = 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs"';
const SESSION_HOOK = { type: 'command', command: `${HOOK_ENGINE} session cleanup` };
const RESUME_HOOK = { type: 'command', command: `${HOOK_ENGINE} session resume` };
const PRESENCE_HOOK = { type: 'command', command: `${HOOK_ENGINE} presence cleanup` };
/** Settings carrying `hooks` in boot's one SessionEnd group, beside `rest`. */
function hooked(hooks, rest = {}) {
  return JSON.stringify({ ...rest, hooks: { SessionEnd: [{ hooks }] } }, null, 2) + '\n';
}
/** The settings a project reaches with labels on: both SessionEnd hooks, and the SessionStart resume hook. */
const LABELS_ON = JSON.stringify({
  hooks: { SessionEnd: [{ hooks: [SESSION_HOOK, PRESENCE_HOOK] }], SessionStart: [{ matcher: 'resume', hooks: [RESUME_HOOK] }] },
}, null, 2) + '\n';

/** The knowledge directory's files, as boot keeps them listed in `.worktreeinclude`. */
const KNOWLEDGE_DIR = '.workflows/.knowledge';
const STORE_FILES = ['store.msp', 'metadata.json', 'config.json'].map((f) => `${KNOWLEDGE_DIR}/${f}`);
const WORKTREE_INCLUDE = STORE_FILES.join('\n') + '\n';

/**
 * A project fixture: a real git repo with a `.workflows/` tree, its
 * settings already carrying the presence sweep and its `.worktreeinclude`
 * already listing the store — the state every booted project reaches, so
 * boot's own plumbing commits never join the history a test reads. A test
 * about either install takes its file away first.
 */
function setupProject(root) {
  const project = path.join(root, 'project');
  fs.mkdirSync(project, { recursive: true });
  git(project, ['init', '-q', '-b', 'main']);
  git(project, ['config', 'user.email', 'test@example.com']);
  git(project, ['config', 'user.name', 'Test']);
  git(project, ['config', 'commit.gpgsign', 'false']);
  writeFile(project, '.workflows/payments/manifest.json', '{"name":"payments"}\n');
  writeFile(project, '.claude/settings.json', hooked([PRESENCE_HOOK]));
  writeFile(project, '.worktreeinclude', WORKTREE_INCLUDE);
  git(project, ['add', '-A']);
  git(project, ['commit', '-q', '-m', 'init']);
  return project;
}

// Stub migrate.cjs: env-driven behaviour, mimicking the real report format
// byte-for-byte (boot parses the report, so the stub must reproduce it).
const STUB_MIGRATE = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
const mode = process.env.STUB_MIGRATE_MODE || '';
let ran = 1;
if (mode === 'update') {
  fs.mkdirSync('.workflows/.state', { recursive: true });
  fs.mkdirSync('.workflows/payments', { recursive: true });
  fs.appendFileSync('.workflows/.state/migrations', '045\\n');
  fs.writeFileSync('.workflows/payments/marker.md', 'migrated\\n');
  process.stdout.write(
    '\\n' +
    '1 migration(s) applied, 2 file(s) updated.\\n' +
    '\\n' +
    '---STOP_GATE: FILES_UPDATED---\\n' +
    'You MUST now follow the migration skill instructions to STOP and let the user review.\\n' +
    'Follow the explicit instructions in the migration skill before proceeding.\\n'
  );
} else if (mode === 'update-config') {
  fs.mkdirSync('.workflows/.state', { recursive: true });
  fs.mkdirSync('.claude', { recursive: true });
  fs.appendFileSync('.workflows/.state/migrations', '046\\n');
  fs.writeFileSync('.claude/settings.json', '{"permissions":{}}\\n');
  fs.appendFileSync('.gitignore', '.DS_Store\\n');
  process.stdout.write(
    '\\n' +
    '1 migration(s) applied, 3 file(s) updated.\\n' +
    '\\n' +
    '---STOP_GATE: FILES_UPDATED---\\n' +
    'You MUST now follow the migration skill instructions to STOP and let the user review.\\n'
  );
} else if (mode === 'record-only') {
  // A migration that ran and found nothing to do: the ledger gains its line,
  // no document changes, no stop gate.
  fs.mkdirSync('.workflows/.state', { recursive: true });
  fs.appendFileSync('.workflows/.state/migrations', '047\\n');
  process.stdout.write('[SKIP] No changes needed\\n');
} else if (mode === 'fail') {
  process.stdout.write('partial output before the failure\\n');
  process.stderr.write('boom: migration 099 exploded\\n');
  process.exit(1);
} else {
  ran = 0;
  process.stdout.write('[SKIP] No changes needed\\n');
}
// The run report every completed run ends with — STUB_MIGRATE_REPORT
// substitutes the payload line, STUB_MIGRATE_NO_REPORT plays a runner from
// before the marker existed.
if (!process.env.STUB_MIGRATE_NO_REPORT) {
  process.stdout.write('---MIGRATIONS_RUN---\\n');
  process.stdout.write(
    (process.env.STUB_MIGRATE_REPORT || JSON.stringify({ ran, tracking: '.workflows/.state/migrations' })) + '\\n'
  );
}
`;

// Stub knowledge CLI: records each invocation to knowledge-calls.log in the
// project cwd; check, bulk index, and compact behaviour is env-driven.
// STUB_CHECK answers each check in turn — `buildable,ready` is a build that
// stood — its last answer repeating.
const STUB_KNOWLEDGE = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
const cmd = process.argv[2] || '';
fs.appendFileSync('knowledge-calls.log', process.argv.slice(2).join(' ') + '\\n');
if (cmd === 'check') {
  if (process.env.STUB_CHECK_EXIT) process.exit(parseInt(process.env.STUB_CHECK_EXIT, 10));
  const answers = (process.env.STUB_CHECK || 'not-ready').split(',');
  const asked = fs.readFileSync('knowledge-calls.log', 'utf8').split('\\n').filter((l) => l === 'check').length;
  process.stdout.write(answers[Math.min(asked, answers.length) - 1] + '\\n');
  process.exit(0);
}
if (cmd === 'index' && process.argv.length === 3) {
  if (process.env.STUB_SYNC_EXIT) {
    process.stderr.write('Failed to index .workflows/a/discussion/b.md: HTTP 400\\n');
    process.exit(parseInt(process.env.STUB_SYNC_EXIT, 10));
  }
  process.exit(0);
}
if (cmd === 'compact') {
  if (process.env.STUB_COMPACT_EXIT) {
    process.stderr.write('compact blew up\\n');
    process.exit(parseInt(process.env.STUB_COMPACT_EXIT, 10));
  }
  process.exit(0);
}
process.exit(1);
`;

/**
 * The engine copied into a temp skills root beside a stub migrate.cjs and a
 * knowledge CLI — the stub, or the real one with its chunking configs —
 * because boot resolves both relative to its own file, so the copy is what
 * exercises that resolution exactly as installed. The tree is never written
 * to during the run, so one serves the whole suite; each test brings its own
 * project.
 * @param {{realKnowledge?: boolean}} [opts]
 */
function stubbedSkillsTree({ realKnowledge = false } = {}) {
  const skills = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-skills-'));
  process.on('exit', () => fs.rmSync(skills, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  fs.cpSync(REAL_SCRIPTS, path.join(skills, 'workflow-engine/scripts'), { recursive: true });
  writeFile(skills, 'workflow-migrate/scripts/migrate.cjs', STUB_MIGRATE);
  if (realKnowledge) {
    fs.cpSync(REAL_KNOWLEDGE, path.join(skills, 'workflow-knowledge'), { recursive: true });
  } else {
    writeFile(skills, 'workflow-knowledge/scripts/knowledge.cjs', STUB_KNOWLEDGE);
  }
  return path.join(skills, 'workflow-engine/scripts/engine.cjs');
}

const STUB_ENGINE = stubbedSkillsTree();
/**
 * The engines a test drives: the stubbed copy, the copy with the real
 * knowledge CLI and no migrations, and the repo's real scripts.
 */
const stubbed = harness.harness(STUB_ENGINE);
const realKnowledge = harness.harness(stubbedSkillsTree({ realKnowledge: true }));
const real = harness;

/** A git-repo project carrying the settings every booted project has. */
function setupFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-'));
  return { root, project: setupProject(root) };
}

/** Run an engine expecting success; returns the parsed JSON response. */
const runEngine = (engine, dir, args, env = {}) => engine.ok(dir, args, { env });

/** Run an engine expecting failure; returns the parsed stderr JSON. */
const runEngineFails = (engine, dir, args, env = {}) => engine.refuses(dir, args, { env });

describe('engine boot', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('happy path: no pending migrations, knowledge ready — the bulk index runs, then compact', () => {
    // TMUX pinned so the label-state leg is deterministic whatever terminal
    // runs the suite; no project manifest makes it `prompt`.
    const res = runEngine(stubbed, fix.project, ['boot'], {
      STUB_CHECK: 'ready',
      TMUX: '/fake/sock,123,7',
    });

    const today = git(fix.project, ['log', '-1', '--format=%cs']).trim();
    assert.deepStrictEqual(res, {
      ok: true,
      migrations: { changed: false, ran: 0, output: '[SKIP] No changes needed', verify: [] },
      knowledge: 'ready',
      indexed: true,
      compacted: true,
      migrations_committed: null,
      warnings: [],
      tmux_labels: 'prompt',
      label_repaired: false,
      session_hooks_installed: false,
      worktree_include_installed: false,
      baseline: 'none',
      walkthrough: 'none',
      // The fixture's one commit carries `.workflows/` — nothing came before,
      // and the tree it arrived into holds no project file.
      baseline_signal: { root_date: today, workflows_date: today, commits_total: 1, commits_before: 0, history_before: [], files_at_arrival: 0, tree_at_arrival: [] },
    });
    assert.deepStrictEqual(knowledgeCalls(fix.project), ['check', 'index', 'compact']);
  });

  it('baseline: reports the project-manifest status; unrecognised or malformed values read none', () => {
    const projManifest = path.join(fix.project, '.workflows/manifest.json');

    for (const status of ['native', 'in-progress', 'completed', 'skipped']) {
      fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, baseline: { status } }));
      const res = runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' });
      assert.strictEqual(res.baseline, status);
      // A recorded verdict is never re-judged, so the signal travels only with `none`.
      assert.ok(!('baseline_signal' in res), `${status}: no signal once a status is recorded`);
    }

    // Unrecognised value → none (the judgment-eligible default), signal attached.
    fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, baseline: { status: 'weird' } }));
    const weird = runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' });
    assert.strictEqual(weird.baseline, 'none');
    assert.strictEqual(weird.baseline_signal.commits_before, 0);

    // An object with nothing recorded → none.
    fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, baseline: {} }));
    assert.strictEqual(runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' }).baseline, 'none');

    // Malformed field shape → none.
    fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, baseline: 'in-progress' }));
    assert.strictEqual(runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' }).baseline, 'none');

    // No project manifest at all → none.
    fs.rmSync(projManifest);
    assert.strictEqual(runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' }).baseline, 'none');
  });

  it('walkthrough: reports the recorded answer; unrecognised or malformed values read none', () => {
    const projManifest = path.join(fix.project, '.workflows/manifest.json');

    for (const status of ['walked', 'skipped']) {
      fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, walkthrough: { status } }));
      assert.strictEqual(runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' }).walkthrough, status);
    }

    for (const walkthrough of [{ status: 'weird' }, {}, 'walked']) {
      fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, walkthrough }));
      assert.strictEqual(runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' }).walkthrough, 'none', JSON.stringify(walkthrough));
    }

    // The two one-time records are independent: a recorded baseline says
    // nothing about the offer, and vice versa.
    fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, baseline: { status: 'native' }, walkthrough: { status: 'skipped' } }));
    const both = runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' });
    assert.strictEqual(both.baseline, 'native');
    assert.strictEqual(both.walkthrough, 'skipped');

    fs.rmSync(projManifest);
    assert.strictEqual(runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' }).walkthrough, 'none');
  });

  /**
   * A scratch repo beside the fixture, hermetic like it, with dated
   * commits. Its settings carry the presence sweep and its
   * `.worktreeinclude` the store from the first commit on, like the
   * fixture's: the history under test is the project's own.
   */
  function scratchRepo(name) {
    const project = path.join(fix.root, name);
    fs.mkdirSync(project, { recursive: true });
    git(project, ['init', '-q', '-b', 'main']);
    git(project, ['config', 'user.email', 'test@example.com']);
    git(project, ['config', 'user.name', 'Test']);
    git(project, ['config', 'commit.gpgsign', 'false']);
    writeFile(project, '.claude/settings.json', hooked([PRESENCE_HOOK]));
    writeFile(project, '.worktreeinclude', WORKTREE_INCLUDE);
    const dated = (date) => ({ GIT_AUTHOR_DATE: `${date}T12:00:00Z`, GIT_COMMITTER_DATE: `${date}T12:00:00Z` });
    const commit = (msg, date) => {
      execFileSync('git', ['add', '-A'], { cwd: project });
      execFileSync('git', ['commit', '-q', '--allow-empty', '-m', msg], { cwd: project, encoding: 'utf8', env: { ...process.env, ...dated(date) } });
    };
    return { project, commit };
  }

  it('baseline_signal: a codebase committed before `.workflows/` arrived reads as history that predates the workflows — as commits and a tree, not a count', () => {
    // A brownfield repo: two commits of code (the skills install beside it,
    // which never counts as project code), then the workflows land.
    const { project, commit } = scratchRepo('brownfield');
    writeFile(project, 'src/app.js', 'export default 1;\n');
    writeFile(project, 'README.md', '# App\n');
    commit('initial', '2025-03-01');
    writeFile(project, 'src/lib.js', 'export const x = 2;\n');
    commit('more code', '2025-06-15');

    // Nothing under `.workflows/` committed yet — the install's first boot,
    // migrations updating files, so the review gate owns the commit and boot
    // leaves the tree alone: the whole history predates the workflows, and
    // the tree is HEAD's.
    writeFile(project, '.workflows/.state/migrations', '');
    let res = runEngine(stubbed, project, ['boot'], { STUB_CHECK: 'ready', STUB_MIGRATE_MODE: 'update' });
    assert.strictEqual(res.baseline, 'none');
    assert.deepStrictEqual(res.baseline_signal, {
      root_date: '2025-03-01', workflows_date: null, commits_total: 2, commits_before: 2,
      history_before: ['2025-03-01  initial', '2025-06-15  more code'],
      files_at_arrival: 3, tree_at_arrival: ['src/ (2)', 'README.md'],
    });

    // The workflows land in a third commit: the two commits before it are
    // the history, and the tree is the one that commit arrived into. (The
    // stub knowledge CLI logs into the project; that is not project code.)
    fs.rmSync(path.join(project, 'knowledge-calls.log'), { force: true });
    commit('add workflows', '2025-09-01');
    res = runEngine(stubbed, project, ['boot'], { STUB_CHECK: 'ready' });
    assert.deepStrictEqual(res.baseline_signal, {
      root_date: '2025-03-01', workflows_date: '2025-09-01', commits_total: 3, commits_before: 2,
      history_before: ['2025-03-01  initial', '2025-06-15  more code'],
      files_at_arrival: 3, tree_at_arrival: ['src/ (2)', 'README.md'],
    });
  });

  it('baseline_signal: the workflows arriving in the root commit report the tree they arrived into — a legacy codebase put under git at install is not a fresh start', () => {
    const { project, commit } = scratchRepo('legacy');
    for (const f of ['app/models/user.rb', 'app/models/order.rb', 'app/controllers/orders.rb', 'config/routes.rb', 'Gemfile']) writeFile(project, f, '# code\n');
    writeFile(project, '.workflows/.state/migrations', '');
    commit('import', '2025-01-01');
    const res = runEngine(stubbed, project, ['boot'], { STUB_CHECK: 'ready' });
    assert.deepStrictEqual(res.baseline_signal, {
      root_date: '2025-01-01', workflows_date: '2025-01-01', commits_total: 1, commits_before: 0, history_before: [],
      files_at_arrival: 5, tree_at_arrival: ['app/ (3)', 'config/ (1)', 'Gemfile'],
    });
  });

  it('baseline_signal: commits before the arrival are its ancestors, never the log listing\'s neighbours', () => {
    // main: root(Jan) → c2(Feb) → arrival(Apr, parent c2) → merge(May) of a
    // side branch cut from root in Mar. Listing order would count the side
    // commit as "before" and read its tree as the parent's.
    const { project, commit } = scratchRepo('branched');
    writeFile(project, 'src/a.js', 'a\n');
    commit('root', '2025-01-01');
    writeFile(project, 'src/b.js', 'b\n');
    writeFile(project, 'src/c.js', 'c\n');
    commit('main work', '2025-02-01');
    git(project, ['checkout', '-q', '-b', 'side', 'HEAD~1']);
    writeFile(project, 'docs/side.md', 'side\n');
    commit('side work', '2025-03-01');
    git(project, ['checkout', '-q', 'main']);
    writeFile(project, '.workflows/.state/migrations', '');
    commit('add workflows', '2025-04-01');
    execFileSync('git', ['merge', '-q', '--no-edit', 'side'], { cwd: project, env: { ...process.env, GIT_AUTHOR_DATE: '2025-05-01T12:00:00Z', GIT_COMMITTER_DATE: '2025-05-01T12:00:00Z' } });
    const res = runEngine(stubbed, project, ['boot'], { STUB_CHECK: 'ready' });
    assert.deepStrictEqual(res.baseline_signal, {
      root_date: '2025-01-01', workflows_date: '2025-04-01', commits_total: 5, commits_before: 2,
      history_before: ['2025-01-01  root', '2025-02-01  main work'],
      files_at_arrival: 3, tree_at_arrival: ['src/ (3)'],
    });
  });

  it('baseline_signal: a long run keeps its head and tail around one elision line, and the tree its largest dozen entries', () => {
    const { project, commit } = scratchRepo('long');
    for (let i = 1; i <= 15; i += 1) {
      writeFile(project, `dir${String(i).padStart(2, '0')}/f.js`, `${i}\n`);
      commit(`commit ${i}`, `2025-01-${String(i).padStart(2, '0')}`);
    }
    writeFile(project, '.workflows/.state/migrations', '');
    commit('add workflows', '2025-02-01');
    const sig = runEngine(stubbed, project, ['boot'], { STUB_CHECK: 'ready' }).baseline_signal;
    assert.strictEqual(sig.commits_before, 15);
    assert.strictEqual(sig.history_before.length, 8 + 1 + 4);
    assert.strictEqual(sig.history_before[8], '… 3 more …');
    assert.strictEqual(sig.history_before[0], '2025-01-01  commit 1');
    assert.strictEqual(sig.history_before[12], '2025-01-15  commit 15');
    assert.strictEqual(sig.files_at_arrival, 15);
    assert.strictEqual(sig.tree_at_arrival.length, 12 + 1);
    assert.strictEqual(sig.tree_at_arrival[12], '… 3 more …');
  });

  it('baseline_signal: reads the same through a signing user\'s `log.showSignature`', () => {
    const { project, commit } = scratchRepo('signed');
    writeFile(project, 'src/a.js', 'a\n');
    commit('root', '2025-01-01');
    writeFile(project, '.workflows/.state/migrations', '');
    commit('add workflows', '2025-02-01');
    const plain = runEngine(stubbed, project, ['boot'], { STUB_CHECK: 'ready' }).baseline_signal;
    git(project, ['config', 'log.showSignature', 'true']);
    const signed = runEngine(stubbed, project, ['boot'], { STUB_CHECK: 'ready' }).baseline_signal;
    assert.deepStrictEqual(signed, plain);
    assert.strictEqual(plain.commits_before, 1);
  });

  it('baseline_signal: no honest history to read — no commits, no repository, a shallow clone — is null, never a failure and never a fresh-start signal', () => {
    const empty = path.join(fix.root, 'empty');
    fs.mkdirSync(empty, { recursive: true });
    git(empty, ['init', '-q', '-b', 'main']);
    // The hooks and the worktree include already there, uncommitted, and no
    // tracking ledger on disk: boot's plumbing installs and its ledger sweep
    // would each otherwise make the root commit — the history this test
    // needs absent.
    writeFile(empty, '.claude/settings.json', hooked([PRESENCE_HOOK]));
    writeFile(empty, '.worktreeinclude', WORKTREE_INCLUDE);
    const res = runEngine(stubbed, empty, ['boot'], { STUB_CHECK: 'ready' });
    assert.strictEqual(res.baseline, 'none');
    assert.strictEqual(res.baseline_signal, null);

    const { baselineSignal } = require(path.join(REAL_SCRIPTS, 'domain/baseline.cjs'));
    const plain = path.join(fix.root, 'plain');
    fs.mkdirSync(plain, { recursive: true });
    assert.strictEqual(baselineSignal(plain), null);

    // A shallow clone of a brownfield history looks like a root-commit
    // arrival; it is truncated, not fresh, so the signal says so.
    const { project, commit } = scratchRepo('deep');
    writeFile(project, 'src/a.js', 'a\n');
    commit('root', '2025-01-01');
    writeFile(project, 'src/b.js', 'b\n');
    commit('more', '2025-02-01');
    writeFile(project, '.workflows/.state/migrations', '');
    commit('add workflows', '2025-03-01');
    const shallow = path.join(fix.root, 'shallow');
    execFileSync('git', ['clone', '-q', '--depth', '1', `file://${project}`, shallow]);
    assert.strictEqual(baselineSignal(shallow), null);
  });

  it('baseline_signal: rides a not-ready boot too — the brownfield first boot returns from the knowledge gate to the judgment on that same response', () => {
    fs.writeFileSync(path.join(fix.project, '.workflows/manifest.json'), JSON.stringify({ work_units: {}, baseline: {} }));
    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'not-ready' });
    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.baseline, 'none');
    assert.strictEqual(res.baseline_signal.commits_before, 0);
  });

  it('baseline: reported on a not-ready boot too — the brownfield first boot is exactly the knowledge-gate path', () => {
    fs.writeFileSync(path.join(fix.project, '.workflows/manifest.json'),
      JSON.stringify({ work_units: {}, baseline: { status: 'in-progress' } }));
    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'not-ready' });
    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.baseline, 'in-progress');
  });

  it('pending migration: changed true, report captured with the stop-gate lines stripped', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], {
      STUB_MIGRATE_MODE: 'update',
      STUB_CHECK: 'ready',
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.migrations.changed, true);
    assert.strictEqual(res.migrations.output, '1 migration(s) applied, 2 file(s) updated.');
    // The migration landed in the project's .workflows tree.
    assert.ok(fs.existsSync(path.join(fix.project, '.workflows/payments/marker.md')));
    assert.match(git(fix.project, ['status', '--porcelain', '--', '.workflows']), /marker\.md/);
  });

  it('a migration touching config files commits settings.json and .gitignore, leaving .workflows to the skill', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'update-config' });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.migrations.changed, true);
    // Boot commits exactly the two config paths the skill's .workflows-scoped
    // migration commit would otherwise leave dirty — then, the migration
    // having rewritten settings.json without the session hooks, puts
    // them back in a commit of their own.
    const subjects = git(fix.project, ['log', '-2', '--pretty=%s']).trim().split('\n');
    assert.deepStrictEqual(subjects, ['chore: install workflow session hooks', 'chore: apply workflow migration config changes']);
    assert.strictEqual(res.session_hooks_installed, true);
    const show = git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD~1']).trim().split('\n').sort();
    assert.deepStrictEqual(show, ['.claude/settings.json', '.gitignore']);
    // The .workflows changes stay uncommitted — the skill's reviewed commit owns them.
    assert.match(git(fix.project, ['status', '--porcelain', '--', '.workflows']), /\.workflows\/\.state/);
  });

  it('no migrations ran: dirty config files are left untouched, never committed by boot', () => {
    // Track a config baseline, then dirty both files with no migration running.
    writeFile(fix.project, '.claude/settings.json', hooked([PRESENCE_HOOK], { permissions: {} }));
    writeFile(fix.project, '.gitignore', 'node_modules\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'config baseline']);
    writeFile(fix.project, '.claude/settings.json', hooked([PRESENCE_HOOK], { permissions: { allow: ['x'] } }));
    writeFile(fix.project, '.gitignore', 'node_modules\n.DS_Store\n');

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.migrations.changed, false);
    // Both stay dirty; HEAD is still the baseline, not a config commit.
    const status = git(fix.project, ['status', '--porcelain']);
    assert.match(status, /\.claude\/settings\.json/);
    assert.match(status, /\.gitignore/);
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'config baseline');
  });

  it('a migration that ran while changing nothing still recorded it — boot commits the ledger line no review gate would sweep', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'record-only' });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.migrations.changed, false);
    assert.strictEqual(res.migrations.ran, 1);
    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(res.migrations_committed, git(fix.project, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'chore: record workflow migrations');
    assert.deepStrictEqual(
      git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n'),
      ['.workflows/.state/migrations']
    );
    assert.strictEqual(git(fix.project, ['status', '--porcelain', '--', '.workflows']).trim(), '', 'nothing left dirty');
  });

  it('a ledger an earlier boot left dirty is committed by the next one, which ran nothing at all', () => {
    // The state this bug leaves behind: a previous boot recorded an ID and
    // never committed it. Those migrations are recorded now, so nothing runs
    // — and the line still has to go.
    writeFile(fix.project, '.workflows/.state/migrations', '045\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'ledger baseline']);
    writeFile(fix.project, '.workflows/.state/migrations', '045\n046\n');

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.migrations.ran, 0, 'nothing ran this boot');
    assert.strictEqual(res.migrations.changed, false);
    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(res.migrations_committed, git(fix.project, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'chore: record workflow migrations');
    assert.strictEqual(git(fix.project, ['status', '--porcelain', '--', '.workflows']).trim(), '');
  });

  it('a run that changed documents leaves the ledger to the reviewed commit — boot never commits it twice', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'update' });

    assert.strictEqual(res.migrations.changed, true);
    assert.strictEqual(res.migrations.ran, 1);
    assert.strictEqual(res.migrations_committed, null);
    // The ledger line waits with the rest of the diff for the skill's
    // `commit --workflows`, which the review gate runs on the user's yes.
    assert.match(git(fix.project, ['status', '--porcelain', '--', '.workflows/.state/migrations']), /migrations/);
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'init');
  });

  it('a ledger with nothing to commit — already clean, or ignored by the project — is null and silent', () => {
    // Clean: the run recorded nothing new (a re-append restoring what HEAD
    // already holds), so the tracked ledger matches HEAD.
    writeFile(fix.project, '.workflows/.state/migrations', '045\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'ledger baseline']);

    const clean = runEngine(stubbed, fix.project, ['boot'], {
      STUB_MIGRATE_REPORT: '{"ran": 2, "tracking": ".workflows/.state/migrations"}',
    });
    assert.strictEqual(clean.migrations.ran, 2);
    assert.strictEqual(clean.migrations_committed, null);
    assert.deepStrictEqual(clean.warnings, []);
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'ledger baseline');

    // Ignored: `git add` would refuse the path outright, so it is never reached.
    git(fix.project, ['rm', '-q', '--', '.workflows/.state/migrations']);
    writeFile(fix.project, '.gitignore', '.workflows/.state/\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'ignore the ledger']);

    const ignored = runEngine(stubbed, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'record-only' });
    assert.strictEqual(ignored.ok, true);
    assert.strictEqual(ignored.migrations_committed, null);
    assert.deepStrictEqual(ignored.warnings, []);
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'ignore the ledger');
  });

  it('a failing ledger commit is a warning, never a block — the ledger is already right on disk', () => {
    const hook = path.join(fix.project, '.git/hooks/pre-commit');
    fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n');
    fs.chmodSync(hook, 0o755);

    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'record-only' });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.migrations.ran, 1);
    assert.strictEqual(res.migrations_committed, null);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /migration ledger commit failed/);
    assert.ok(fs.existsSync(path.join(fix.project, '.workflows/.state/migrations')), 'the recorded run survives');
  });

  it('a run report boot cannot read degrades to a warning — ran 0, no commit, plumbing still stripped', () => {
    for (const payload of ['not json at all', '{"ran": "two", "tracking": ".workflows/.state/migrations"}', '{"ran": 1, "tracking": "/etc/passwd"}']) {
      const res = runEngine(stubbed, fix.project, ['boot'], {
        STUB_MIGRATE_MODE: 'record-only',
        STUB_MIGRATE_REPORT: payload,
      });

      assert.strictEqual(res.ok, true, payload);
      assert.strictEqual(res.migrations_committed, null, payload);
      assert.strictEqual(res.warnings.length, 1, `${payload}: ${JSON.stringify(res.warnings)}`);
      assert.match(res.warnings[0], /^migration run report unreadable: /);
      assert.strictEqual(res.migrations.output, '[SKIP] No changes needed', payload);
      assert.ok(!res.migrations.output.includes('MIGRATIONS_RUN'), payload);
    }
    // A sound `ran` beside an implausible path keeps the count and drops the commit.
    const res = runEngine(stubbed, fix.project, ['boot'], {
      STUB_MIGRATE_MODE: 'record-only',
      STUB_MIGRATE_REPORT: '{"ran": 1, "tracking": "../elsewhere/migrations"}',
    });
    assert.strictEqual(res.migrations.ran, 1);
    assert.strictEqual(res.migrations_committed, null);
  });

  it('a runner that reports nothing reads as no migrations run', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], {
      STUB_MIGRATE_MODE: 'record-only',
      STUB_MIGRATE_NO_REPORT: '1',
    });

    assert.strictEqual(res.migrations.ran, 0);
    assert.strictEqual(res.migrations_committed, null);
    assert.deepStrictEqual(res.warnings, []);
  });

  it('knowledge not-ready is terminal: no init, no commit, setup stays a human choice', () => {
    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.indexed, false);
    assert.strictEqual(res.compacted, false);
    assert.deepStrictEqual(res.warnings, []);
    assert.deepStrictEqual(knowledgeCalls(fix.project), ['check']);
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'init');
  });

  it('a ready store is never committed — the index is the checkout\'s own', () => {
    writeFile(fix.project, '.workflows/.knowledge/store.msp', 'v1\n');
    writeFile(fix.project, '.workflows/.knowledge/metadata.json', '{}\n');

    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' });

    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'init');
    assert.strictEqual(git(fix.project, ['ls-files', '--', '.workflows/.knowledge']).trim(), '');
  });

  it('buildable: a set-up checkout with no store has it built by the bulk index, then compacted', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'buildable,ready' });

    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.indexed, true);
    assert.strictEqual(res.compacted, true);
    assert.deepStrictEqual(res.warnings, []);
    assert.ok(!('system_config' in res), 'a store that stood needs no setup');
    assert.deepStrictEqual(knowledgeCalls(fix.project), ['check', 'index', 'check', 'compact']);
  });

  it('buildable: a build that did not stand is not-ready — no compact, the gate\'s report attached', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'buildable', STUB_SYNC_EXIT: '1' });

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.indexed, false);
    assert.strictEqual(res.compacted, false);
    assert.deepStrictEqual(res.warnings, ['knowledge index failed: Failed to index .workflows/a/discussion/b.md: HTTP 400']);
    assert.ok('system_config' in res);
    assert.deepStrictEqual(knowledgeCalls(fix.project), ['check', 'index', 'check']);
  });

  it('buildable: a store that stood with a file failing is ready, the failure a warning the next start retries', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'buildable,ready', STUB_SYNC_EXIT: '1' });

    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.indexed, false);
    assert.strictEqual(res.compacted, true);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^knowledge index failed: /);
  });

  it('a peer session\'s staged work survives every one of boot\'s commits', () => {
    // Boot runs at `workflow-start`, which is a session opening beside every
    // other one on the checkout. Its commits — the migration config pass,
    // the store's untracking, the session hooks install, and the worktree
    // include — must take their own paths and nothing else, staged peer
    // content included.
    writeFile(fix.project, '.workflows/payments/discussion/topic-a.md', '# Topic A\n');
    writeFile(fix.project, '.workflows/manifest.json', JSON.stringify({ defaults: { tmux_labels: true } }, null, 2) + '\n');
    writeFile(fix.project, '.workflows/.knowledge/store.msp', 'v1\n');
    git(fix.project, ['rm', '-q', '--', '.worktreeinclude']);
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'a peer topic']);
    writeFile(fix.project, '.workflows/payments/discussion/topic-a.md', '# Topic A\nhalf a turn\n');
    git(fix.project, ['add', '--', '.workflows/payments/discussion/topic-a.md']);

    const res = runEngine(stubbed, fix.project, ['boot'], {
      STUB_CHECK: 'ready', STUB_MIGRATE_MODE: 'update-config',
    });

    assert.strictEqual(res.ok, true);
    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(res.worktree_include_installed, true);
    const shas = git(fix.project, ['log', '--format=%H', 'HEAD']).trim().split('\n').slice(0, 4);
    assert.deepStrictEqual(shas.map((sha) => git(fix.project, ['log', '-1', '--pretty=%s', sha]).trim()), [
      'chore: copy the knowledge store into new worktrees',
      'chore: install workflow session hooks',
      'chore(knowledge): stop tracking the store',
      'chore: apply workflow migration config changes',
    ]);
    for (const sha of shas) {
      const files = git(fix.project, ['show', '--name-only', '--pretty=format:', sha]).trim().split('\n').filter(Boolean);
      assert.ok(!files.includes('.workflows/payments/discussion/topic-a.md'),
        `boot swept a peer session's staged file:\n${files.join('\n')}`);
    }
    assert.strictEqual(git(fix.project, ['diff', '--cached', '--name-only']).trim(),
      '.workflows/payments/discussion/topic-a.md', 'and left it staged exactly as it was');
  });

  it('a crashing knowledge check is not-ready — never a crash', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK_EXIT: '2' });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.indexed, false);
    assert.strictEqual(res.compacted, false);
  });

  it('a failing compact is a warning, never a block', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], {
      STUB_CHECK: 'ready',
      STUB_COMPACT_EXIT: '1',
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.indexed, true);
    assert.strictEqual(res.compacted, false);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /knowledge compact failed: compact blew up/);
  });

  it('a failing bulk index is its own warning, carrying its stderr — compact still runs', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], {
      STUB_CHECK: 'ready',
      STUB_SYNC_EXIT: '1',
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.indexed, false);
    assert.strictEqual(res.compacted, true);
    assert.deepStrictEqual(res.warnings, ['knowledge index failed: Failed to index .workflows/a/discussion/b.md: HTTP 400']);
    assert.deepStrictEqual(knowledgeCalls(fix.project), ['check', 'index', 'compact']);
  });

  it('a failing bulk index and a failing compact are two warnings', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], {
      STUB_CHECK: 'ready',
      STUB_SYNC_EXIT: '1',
      STUB_COMPACT_EXIT: '1',
    });

    assert.strictEqual(res.ok, true);
    assert.deepStrictEqual(res.warnings, [
      'knowledge index failed: Failed to index .workflows/a/discussion/b.md: HTTP 400',
      'knowledge compact failed: compact blew up',
    ]);
  });

  it('a failing migrate.cjs is a hard error — ok false, stderr detail, exit 1', () => {
    const err = runEngineFails(stubbed, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'fail' });

    assert.match(err.error, /migrate\.cjs failed/);
    assert.match(err.error, /never half-run silently/);
    assert.match(err.error, /boom: migration 099 exploded/);
    // The knowledge legs never ran.
    assert.deepStrictEqual(knowledgeCalls(fix.project), []);
  });
});

describe('engine boot: the store leaves git', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  const head = () => git(fix.project, ['rev-parse', 'HEAD']).trim();
  const tracked = () => git(fix.project, ['ls-files', '--', KNOWLEDGE_DIR]).trim().split('\n').filter(Boolean);
  const committedChanges = () => git(fix.project, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim().split('\n').sort();

  /** Commit the store as an earlier version did. */
  function commitStore(files = STORE_FILES) {
    for (const f of files) writeFile(fix.project, f, `${f} v1\n`);
    git(fix.project, ['add', '--', ...files]);
    git(fix.project, ['commit', '-q', '-m', 'chore(knowledge): initialise store']);
  }

  it('one confined commit records the removal; the files stay on disk, a peer\'s staged work stays staged', () => {
    commitStore();
    // The store moved on since its last commit, and a peer staged its own work.
    writeFile(fix.project, STORE_FILES[0], 'v2 — the index this checkout built since\n');
    writeFile(fix.project, '.workflows/payments/discussion/topic-a.md', '# Topic A\n');
    git(fix.project, ['add', '--', '.workflows/payments/discussion/topic-a.md']);

    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' });

    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'chore(knowledge): stop tracking the store');
    assert.deepStrictEqual(committedChanges(), STORE_FILES.map((f) => `D\t${f}`).sort());
    assert.deepStrictEqual(tracked(), []);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, STORE_FILES[0]), 'utf8'), 'v2 — the index this checkout built since\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, STORE_FILES[1]), 'utf8'), `${STORE_FILES[1]} v1\n`);
    assert.strictEqual(git(fix.project, ['diff', '--cached', '--name-only']).trim(),
      '.workflows/payments/discussion/topic-a.md', 'the peer\'s file stays staged, and nothing of the store is');
    assert.ok(!fs.existsSync(path.join(fix.project, '.git/workflows-untrack.index')), 'the scratch index is gone');
  });

  it('needs its scratch index: git\'s own pathspec commit re-reads a file still on disk and records no removal', () => {
    commitStore();
    const before = head();
    git(fix.project, ['rm', '--cached', '-q', '--', ...STORE_FILES]);
    const res = spawnSync('git', ['commit', '-q', '-m', 'untrack', '--', ...STORE_FILES], { cwd: fix.project, encoding: 'utf8' });

    assert.notStrictEqual(res.status, 0, 'nothing to commit — the partial commit took the files back from the working tree');
    assert.strictEqual(head(), before);
    assert.strictEqual(git(fix.project, ['ls-tree', '-r', '--name-only', 'HEAD', '--', ...STORE_FILES]).trim().split('\n').length, STORE_FILES.length);
  });

  it('takes everything tracked under the knowledge directory in one commit — the config and a rebuild backup too', () => {
    const backup = `${KNOWLEDGE_DIR}/store.msp.bak`;
    commitStore([...STORE_FILES, backup]);

    runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' });

    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'chore(knowledge): stop tracking the store');
    assert.deepStrictEqual(committedChanges(), [...STORE_FILES, backup].map((p) => `D\t${p}`).sort());
    assert.deepStrictEqual(tracked(), []);
    for (const p of [...STORE_FILES, backup]) assert.ok(fs.existsSync(path.join(fix.project, p)), `${p} stays on disk`);
  });

  it('untracks whichever of the files git still tracks', () => {
    commitStore([STORE_FILES[1]]);
    runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' });
    assert.deepStrictEqual(committedChanges(), [`D\t${STORE_FILES[1]}`]);
    assert.deepStrictEqual(tracked(), []);
  });

  it('is idempotent — nothing tracked, nothing committed', () => {
    commitStore();
    runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' });
    const after = head();
    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' });
    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(head(), after);

    const clean = setupFixture();
    try {
      const before = git(clean.project, ['rev-parse', 'HEAD']).trim();
      runEngine(stubbed, clean.project, ['boot'], { STUB_CHECK: 'ready' });
      assert.strictEqual(git(clean.project, ['rev-parse', 'HEAD']).trim(), before, 'a project that never tracked the store commits nothing');
    } finally {
      fs.rmSync(clean.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('a store staged but never committed leaves the index with no commit', () => {
    for (const f of STORE_FILES) writeFile(fix.project, f, 'staged\n');
    git(fix.project, ['add', '--', ...STORE_FILES]);
    const before = head();

    runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' });

    assert.strictEqual(head(), before);
    assert.deepStrictEqual(tracked(), []);
    assert.ok(fs.existsSync(path.join(fix.project, STORE_FILES[0])));
  });

  it('holds while the ignore rules are uncommitted — the reviewed migration commit never takes the store back', () => {
    commitStore();
    // What migration 060 leaves in the working tree ahead of the review gate.
    writeFile(fix.project, '.workflows/.gitignore', '.knowledge/\n');

    runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' });
    runEngine(stubbed, fix.project, ['commit', '--workflows', '-m', 'chore: apply workflow migrations']);

    assert.deepStrictEqual(committedChanges(), ['A\t.workflows/.gitignore']);
    assert.deepStrictEqual(tracked(), []);
    assert.strictEqual(git(fix.project, ['status', '--porcelain', '--', '.workflows/.knowledge']).trim(), '');
  });

  it('works from a linked worktree — the scratch index lives in that worktree\'s git dir', () => {
    commitStore();
    const linked = path.join(fix.root, 'linked');
    git(fix.project, ['worktree', 'add', '-q', '-b', 'linked', linked]);

    const res = runEngine(stubbed, linked, ['boot'], { STUB_CHECK: 'ready' });

    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(git(linked, ['log', '-1', '--pretty=%s']).trim(), 'chore(knowledge): stop tracking the store');
    assert.strictEqual(git(linked, ['ls-files', '--', ...STORE_FILES]).trim(), '');
    assert.ok(fs.existsSync(path.join(linked, STORE_FILES[0])));
    assert.strictEqual(git(fix.project, ['ls-files', '--', ...STORE_FILES]).trim().split('\n').length, STORE_FILES.length, 'the main checkout\'s branch is untouched');
  });

  it('waits out a conflicted merge — MERGE_HEAD and the index untouched, a warning naming it, and the next boot finishes it', () => {
    commitStore();
    // A merge that stops on a conflict: both sides edit the same line.
    const conflicted = '.workflows/payments/discussion/topic-a.md';
    writeFile(fix.project, conflicted, 'base\n');
    git(fix.project, ['add', '--', conflicted]);
    git(fix.project, ['commit', '-q', '-m', 'base']);
    git(fix.project, ['checkout', '-q', '-b', 'incoming']);
    writeFile(fix.project, conflicted, 'incoming\n');
    git(fix.project, ['commit', '-q', '-am', 'incoming']);
    git(fix.project, ['checkout', '-q', 'main']);
    writeFile(fix.project, conflicted, 'ours\n');
    git(fix.project, ['commit', '-q', '-am', 'ours']);
    const merge = spawnSync('git', ['merge', '-q', 'incoming'], { cwd: fix.project, encoding: 'utf8' });
    assert.notStrictEqual(merge.status, 0, 'the merge stops on its conflict');
    const mergeHead = fs.readFileSync(path.join(fix.project, '.git/MERGE_HEAD'), 'utf8');
    const index = git(fix.project, ['ls-files', '--stage']);
    const before = head();

    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^knowledge store untracking failed: a merge is in progress \(MERGE_HEAD\)/);
    assert.strictEqual(head(), before, 'no commit — none would have recorded the merge');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.git/MERGE_HEAD'), 'utf8'), mergeHead, 'the merge stays in progress');
    assert.strictEqual(git(fix.project, ['ls-files', '--stage']), index, 'the index, conflict stages included, as it was');

    git(fix.project, ['merge', '--abort']);
    runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' });
    assert.deepStrictEqual(tracked(), []);
  });

  it('a failing commit is a warning — still tracked, the index as it was, and the next boot finishes it', () => {
    commitStore();
    const hook = path.join(fix.project, '.git/hooks/pre-commit');
    fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n');
    fs.chmodSync(hook, 0o755);
    const before = head();

    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^knowledge store untracking failed: /);
    assert.strictEqual(head(), before);
    assert.deepStrictEqual(tracked(), [...STORE_FILES].sort());
    assert.strictEqual(git(fix.project, ['status', '--porcelain']).trim(), '?? knowledge-calls.log', 'nothing staged, nothing moved');
    assert.ok(!fs.existsSync(path.join(fix.project, '.git/workflows-untrack.index')), 'the scratch index is gone');

    fs.unlinkSync(hook);
    runEngine(stubbed, fix.project, ['boot'], { STUB_CHECK: 'ready' });
    assert.deepStrictEqual(tracked(), []);
  });
});

describe('engine boot: the worktree include', () => {
  let fix;
  beforeEach(() => {
    fix = setupFixture();
    git(fix.project, ['rm', '-q', '--', '.worktreeinclude']);
    git(fix.project, ['commit', '-q', '-m', 'no worktree include']);
  });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  const include = () => fs.readFileSync(path.join(fix.project, '.worktreeinclude'), 'utf8');
  const head = () => git(fix.project, ['rev-parse', 'HEAD']).trim();

  it('creates the file listing the knowledge files, committed confined — and a second boot changes nothing', () => {
    writeFile(fix.project, '.workflows/payments/discussion/topic-a.md', '# Topic A\n');
    git(fix.project, ['add', '--', '.workflows/payments/discussion/topic-a.md']);

    const first = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(first.worktree_include_installed, true);
    assert.deepStrictEqual(first.warnings, []);
    assert.strictEqual(include(), WORKTREE_INCLUDE);
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'chore: copy the knowledge store into new worktrees');
    assert.deepStrictEqual(git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n'), ['.worktreeinclude']);
    assert.strictEqual(git(fix.project, ['diff', '--cached', '--name-only']).trim(), '.workflows/payments/discussion/topic-a.md', 'a peer\'s staged work stays staged');

    const after = head();
    const second = runEngine(stubbed, fix.project, ['boot']);
    assert.strictEqual(second.worktree_include_installed, false);
    assert.strictEqual(head(), after);
    assert.strictEqual(include(), WORKTREE_INCLUDE);
  });

  it('appends to the user\'s own file, every existing line left as it was', () => {
    writeFile(fix.project, '.worktreeinclude', '# local env\n.env\n\n.env.local');

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.worktree_include_installed, true);
    assert.strictEqual(include(), `# local env\n.env\n\n.env.local\n${WORKTREE_INCLUDE}`);
  });

  it('appends only what is missing', () => {
    writeFile(fix.project, '.worktreeinclude', `node_modules/\n${STORE_FILES[1]}\n`);

    runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(include(), `node_modules/\n${STORE_FILES[1]}\n${STORE_FILES[0]}\n${STORE_FILES[2]}\n`);
  });

  it('a file already listing the knowledge files is left alone', () => {
    const content = `${STORE_FILES[1]}\n  ${STORE_FILES[0]}  \nnode_modules/\n${STORE_FILES[2]}\n`;
    writeFile(fix.project, '.worktreeinclude', content);
    git(fix.project, ['add', '--', '.worktreeinclude']);
    git(fix.project, ['commit', '-q', '-m', 'the user\'s include']);
    const before = head();

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.worktree_include_installed, false);
    assert.strictEqual(include(), content);
    assert.strictEqual(head(), before);
  });

  it('a commit that fails is a warning — the file is written, the next boot finds it listed', () => {
    const hook = path.join(fix.project, '.git/hooks/pre-commit');
    fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n');
    fs.chmodSync(hook, 0o755);

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.worktree_include_installed, true);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^worktree include commit failed: /);
    assert.strictEqual(include(), WORKTREE_INCLUDE);
  });

  it('a path that cannot be written is a warning, never a block', () => {
    fs.mkdirSync(path.join(fix.project, '.worktreeinclude'));

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.worktree_include_installed, false);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^worktree include not written: \.worktreeinclude — /);
  });
});

describe('engine boot: a set-up checkout with no store', () => {
  let fix;
  let sysDir;
  beforeEach(() => {
    fix = setupFixture();
    sysDir = path.join(fix.root, 'system-config');
    fs.mkdirSync(sysDir, { recursive: true });
    // A feature with one completed discussion — something for a build to index.
    writeFile(fix.project, '.workflows/manifest.json', JSON.stringify({ work_units: { payments: { work_type: 'feature' } } }, null, 2) + '\n');
    writeFile(fix.project, '.workflows/payments/manifest.json', JSON.stringify({
      name: 'payments', work_type: 'feature', status: 'in-progress', created: '2026-01-01',
      phases: { discussion: { items: { payments: { status: 'completed' } } } },
    }, null, 2) + '\n');
    writeFile(fix.project, '.workflows/payments/discussion/payments.md', '# Payments\n\n## Card first\n\nCards ship first; wallets follow.\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'the project']);
    // This checkout is set up — its local knowledge config — with no store.
    writeFile(fix.project, CONFIG, '{ "knowledge": {} }\n');
  });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  const bootWith = (systemConfig, extra = {}) => {
    if (systemConfig !== null) writeFile(sysDir, 'config.json', JSON.stringify(systemConfig));
    return runEngine(realKnowledge, fix.project, ['boot'], { WORKFLOWS_CONFIG_DIR: sysDir, ...extra });
  };
  const CONFIG = STORE_FILES[2];
  const storePath = () => path.join(fix.project, STORE_FILES[0]);
  const metadata = () => JSON.parse(fs.readFileSync(path.join(fix.project, STORE_FILES[1]), 'utf8'));

  it('a provider whose key resolves builds a full store, indexed and out of git', () => {
    const head = git(fix.project, ['rev-parse', 'HEAD']).trim();

    const res = bootWith({ knowledge: { provider: 'stub', dimensions: 8 } });

    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.indexed, true);
    assert.strictEqual(res.compacted, true);
    assert.deepStrictEqual(res.warnings, []);
    assert.ok(!('system_config' in res));
    const meta = metadata();
    assert.strictEqual(meta.provider, 'stub');
    assert.strictEqual(meta.dimensions, 8);
    assert.ok(meta.last_indexed, 'the discussion was indexed into it');
    assert.strictEqual(git(fix.project, ['rev-parse', 'HEAD']).trim(), head, 'the build commits nothing');
    assert.strictEqual(git(fix.project, ['ls-files', '--', KNOWLEDGE_DIR]).trim(), '');
  });

  it('keyword-only chosen outright in the system config builds a keyword-only store', () => {
    const res = bootWith({ knowledge: {} });

    assert.strictEqual(res.knowledge, 'ready');
    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(metadata().provider, null);
    assert.ok(metadata().last_indexed);
  });

  it('keyword-only pinned by the project config builds keyword-only, whatever the machine lacks', () => {
    writeFile(fix.project, CONFIG, '{ "knowledge": { "provider": null } }\n');

    const res = bootWith(null);

    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(metadata().provider, null);
  });

  it('no system config is not-ready — nothing built, the gate runs as for any unready store', () => {
    const res = bootWith(null);

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.indexed, false);
    assert.deepStrictEqual(res.warnings, []);
    assert.deepStrictEqual(res.system_config, { status: 'absent', provider: null, model: null });
    assert.ok(!fs.existsSync(storePath()));
  });

  it('an invalid system config is not-ready — nothing built', () => {
    writeFile(sysDir, 'config.json', 'not json');
    const res = bootWith(null);

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.system_config.status, 'invalid');
    assert.ok(!fs.existsSync(storePath()));
  });

  it('a provider whose key cannot be resolved is not-ready — never a keyword-only store in its place', () => {
    const res = bootWith({ knowledge: { provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536 } });

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.deepStrictEqual(res.warnings, []);
    assert.deepStrictEqual(res.system_config, { status: 'valid', provider: 'openai', model: 'text-embedding-3-small' });
    assert.ok(!fs.existsSync(storePath()));
  });

  it('a checkout never set up is not-ready whatever the machine says — boot sets nothing up', () => {
    fs.rmSync(path.join(fix.project, KNOWLEDGE_DIR), { recursive: true, force: true });

    const res = bootWith({ knowledge: { provider: 'stub', dimensions: 8 } });

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.system_config.status, 'valid');
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/.knowledge')));
  });
});

describe('engine boot system-config detection', () => {
  let fix;
  let home;
  beforeEach(() => {
    fix = setupFixture();
    // Hermetic home: system-config detection resolves ~ via $HOME, so the
    // developer's real ~/.config/workflows never leaks into assertions.
    home = path.join(fix.root, 'home');
    fs.mkdirSync(home, { recursive: true });
  });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  function writeSystemConfig(content) {
    writeFile(home, '.config/workflows/config.json', content);
  }

  // The suite's hermetic config directory answers ahead of $HOME, so it comes
  // off every child environment here — this describe is about the ~ path.
  const underHome = (extra = {}) => ({ HOME: home, WORKFLOWS_CONFIG_DIR: undefined, ...extra });

  it('not-ready with no system config reports absent', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], underHome());

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.deepStrictEqual(res.system_config, { status: 'absent', provider: null, model: null });
  });

  it('not-ready with a valid provider config reports provider and model — never key material', () => {
    writeSystemConfig(JSON.stringify({
      knowledge: { provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536 },
    }));
    // Both key sources present on disk/env — neither may reach the response.
    writeFile(home, '.config/workflows/credentials.json', JSON.stringify({
      credentials: { openai: { api_key: 'sk-STORED-SECRET' } },
    }));

    const res = runEngine(stubbed, fix.project, ['boot'], underHome({ OPENAI_API_KEY: 'sk-ENV-SECRET' }));

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.deepStrictEqual(res.system_config, {
      status: 'valid',
      provider: 'openai',
      model: 'text-embedding-3-small',
    });
    assert.ok(!JSON.stringify(res).includes('SECRET'));
  });

  it('not-ready with a valid providerless config reports valid with nulls (keyword-only)', () => {
    writeSystemConfig(JSON.stringify({ knowledge: {} }));

    const res = runEngine(stubbed, fix.project, ['boot'], underHome());

    assert.deepStrictEqual(res.system_config, { status: 'valid', provider: null, model: null });
  });

  it('not-ready with an unparseable or wrongly-shaped config reports invalid', () => {
    writeSystemConfig('not json at all');
    const res1 = runEngine(stubbed, fix.project, ['boot'], underHome());
    assert.deepStrictEqual(res1.system_config, { status: 'invalid', provider: null, model: null });

    writeSystemConfig(JSON.stringify({ knowledge: 'not-an-object' }));
    const res2 = runEngine(stubbed, fix.project, ['boot'], underHome());
    assert.deepStrictEqual(res2.system_config, { status: 'invalid', provider: null, model: null });
  });

  it('not-ready with a knowledge-less shared config file reports absent', () => {
    writeSystemConfig(JSON.stringify({ session: { tmux_labels: true } }));
    const res = runEngine(stubbed, fix.project, ['boot'], underHome());
    assert.deepStrictEqual(res.system_config, { status: 'absent', provider: null, model: null });
  });

  it('ready responses carry no system_config field', () => {
    writeSystemConfig(JSON.stringify({ knowledge: { provider: 'openai', model: 'm' } }));

    const res = runEngine(stubbed, fix.project, ['boot'], underHome({ STUB_CHECK: 'ready' }));

    assert.strictEqual(res.knowledge, 'ready');
    assert.ok(!('system_config' in res));
  });
});

describe('engine boot session hooks', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  /** Stamp the label choice on the project manifest and commit it, so boot's only new dirt is its own. */
  function recordChoice(value) {
    writeFile(fix.project, '.workflows/manifest.json', JSON.stringify({ defaults: { tmux_labels: value } }, null, 2) + '\n');
    git(fix.project, ['add', '--', '.workflows/manifest.json']);
    git(fix.project, ['commit', '-q', '-m', 'record the defaults']);
  }

  /** Take the fixture's settings away — a project the hooks have never reached. */
  function dropSettings() {
    git(fix.project, ['rm', '-q', '--', '.claude/settings.json']);
    git(fix.project, ['commit', '-q', '-m', 'no settings']);
  }

  /** Commit `content` as the project's settings. */
  function commitSettings(content) {
    writeFile(fix.project, '.claude/settings.json', content);
    git(fix.project, ['add', '--', '.claude/settings.json']);
    git(fix.project, ['commit', '-q', '-m', 'settings']);
  }

  /** Boot with the tmux identity pinned; `tmux` absent unless given; `env` layered over the process's own. */
  function bootWith({ tmux = false, skipHooks = false, env: extra = {} } = {}) {
    const env = {
      ...extra,
      TMUX: tmux ? '/fake/sock,123,7' : undefined,
      WORKFLOWS_SKIP_SESSION_HOOKS: skipHooks ? '1' : undefined,
    };
    return runEngine(stubbed, fix.project, ['boot'], env);
  }

  function settings() {
    return JSON.parse(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8'));
  }

  it('reports no-tmux outside tmux regardless of the recorded choice', () => {
    recordChoice(true);
    assert.strictEqual(bootWith({ tmux: false }).tmux_labels, 'no-tmux');
  });

  it('reports prompt in tmux when never recorded', () => {
    assert.strictEqual(bootWith({ tmux: true }).tmux_labels, 'prompt');
  });

  it('reports on/off in tmux from the project manifest', () => {
    recordChoice(true);
    assert.strictEqual(bootWith({ tmux: true }).tmux_labels, 'on');
    recordChoice(false);
    assert.strictEqual(bootWith({ tmux: true }).tmux_labels, 'off');
  });

  it('label_repaired is true when this session\'s own label is on the terminal — the start menu is the original name', () => {
    recordChoice(true);
    const stub = installTmuxStub();
    try {
      const identity = { ...tmuxStubEnv(stub), TMUX_PANE: '%3', CLAUDE_CODE_SESSION_ID: 'sess-1', CLAUDE_PID: String(process.pid) };
      runEngine(stubbed, fix.project, ['session', 'label', 'payments', 'discussion', 'payments'], { ...identity, TMUX: '/fake/sock,123,7' });
      assert.strictEqual(tmuxStubName(stub), 'proj-abc · payments · discussion');
      assert.strictEqual(bootWith({ tmux: true, env: identity }).label_repaired, true);
      assert.strictEqual(tmuxStubName(stub), 'proj-abc');
      assert.strictEqual(bootWith({ tmux: true, env: identity }).label_repaired, false, 'nothing left to repair');
    } finally {
      fs.rmSync(stub, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('a project with no settings gets `presence cleanup` installed, committed confined — and a second boot changes nothing', () => {
    dropSettings();
    const first = bootWith();
    assert.strictEqual(first.session_hooks_installed, true);
    assert.deepStrictEqual(first.warnings, []);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8'), hooked([PRESENCE_HOOK]));
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'chore: install workflow session hooks');
    assert.deepStrictEqual(git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n'), ['.claude/settings.json']);
    const head = git(fix.project, ['rev-parse', 'HEAD']);

    const second = bootWith();
    assert.strictEqual(second.session_hooks_installed, false);
    assert.strictEqual(git(fix.project, ['rev-parse', 'HEAD']), head, 'nothing new to commit');
    assert.strictEqual(git(fix.project, ['status', '--porcelain', '--', '.claude', '.workflows']).trim(), '', 'and no new dirt');
  });

  it('labels on adds `session cleanup` beside `presence cleanup`, in one group, and a SessionStart `session resume` matched to resume — one commit', () => {
    recordChoice(true);
    const res = bootWith();
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8'), LABELS_ON);
    assert.deepStrictEqual(git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n'), ['.claude/settings.json']);
    assert.strictEqual(bootWith().session_hooks_installed, false);
  });

  it('labels off wants `presence cleanup` alone — a `session cleanup` and a `session resume` left behind come back out', () => {
    recordChoice(false);
    commitSettings(LABELS_ON);
    const res = bootWith();
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8'), hooked([PRESENCE_HOOK]));
  });

  it('labels never asked wants `presence cleanup` alone too — stale label hooks come back out', () => {
    assert.strictEqual(bootWith().session_hooks_installed, false, 'the fixture already carries it');
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/manifest.json')), 'no choice recorded');
    commitSettings(LABELS_ON);
    const res = bootWith();
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8'), hooked([PRESENCE_HOOK]));
  });

  it('the hook sync waits on a live project lock — the opt-in read and the write are one hold', async () => {
    dropSettings();
    const lock = path.join(fix.project, '.workflows', '.project-lock');
    fs.writeFileSync(lock, '12345'); // fresh — never broken as stale
    const env = { ...process.env };
    delete env.TMUX;
    delete env.WORKFLOWS_SKIP_SESSION_HOOKS;
    const child = spawn('node', [STUB_ENGINE, 'boot'], { cwd: fix.project, env });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    // 'close', not 'exit': stdout must be fully flushed before it is parsed.
    const exit = new Promise((resolve) => child.on('close', resolve));

    const raced = await Promise.race([exit.then(() => 'exited'), sleep(1500).then(() => 'waiting')]);
    assert.strictEqual(raced, 'waiting', 'boot must wait on a live project lock');
    assert.ok(!fs.existsSync(path.join(fix.project, '.claude/settings.json')), 'no settings write while the lock is held');

    fs.unlinkSync(lock);
    assert.strictEqual(await exit, 0);
    const res = JSON.parse(stdout.trim());
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8'), hooked([PRESENCE_HOOK]));
  });

  it('installs into existing settings without disturbing them', () => {
    commitSettings(JSON.stringify({ permissions: { allow: ['Bash(ls)'] } }, null, 2) + '\n');
    assert.strictEqual(bootWith().session_hooks_installed, true);
    assert.deepStrictEqual(settings(), {
      permissions: { allow: ['Bash(ls)'] },
      hooks: { SessionEnd: [{ hooks: [PRESENCE_HOOK] }] },
    });
  });

  it('WORKFLOWS_SKIP_SESSION_HOOKS=1 — the test harness\'s switch — never touches settings, labels on or off', () => {
    dropSettings();
    assert.strictEqual(bootWith({ skipHooks: true }).session_hooks_installed, false);
    assert.ok(!fs.existsSync(path.join(fix.project, '.claude/settings.json')));
    recordChoice(true);
    assert.strictEqual(bootWith({ skipHooks: true }).session_hooks_installed, false);
    assert.ok(!fs.existsSync(path.join(fix.project, '.claude/settings.json')));
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'record the defaults', 'no commit of boot\'s');
  });

  it('a settings file that does not parse is a warning, never a block — left as found', () => {
    recordChoice(true);
    writeFile(fix.project, '.claude/settings.json', '{not json');
    const res = bootWith();
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.session_hooks_installed, false);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /session hooks not installed: \.claude\/settings\.json is not valid JSON/);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8'), '{not json');
  });
});

describe('engine boot (real scripts)', () => {
  let root;
  let project;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-real-'));
    project = setupProject(root);
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('runs the real migrate.cjs and knowledge CLI against an isolated project', async () => {
    const first = runEngine(real, project, ['boot']);
    assert.strictEqual(first.ok, true);
    assert.strictEqual(typeof first.migrations.changed, 'boolean');
    assert.strictEqual(typeof first.migrations.output, 'string');
    // No work-unit artifacts in the fixture — no migration hands over checks.
    assert.deepStrictEqual(first.migrations.verify, []);
    // The trimmed report never leaks the prose stop-gate lines or the machine blocks.
    assert.ok(!first.migrations.output.includes('STOP_GATE'));
    assert.ok(!first.migrations.output.includes('VERIFY_ADDENDA'));
    assert.ok(!first.migrations.output.includes('MIGRATIONS_RUN'));
    // The whole fleet ran against the fresh fixture.
    assert.ok(first.migrations.ran > 0, `migrations ran: ${first.migrations.ran}`);
    // No knowledge store in the fixture — the hard stop: nothing is created.
    assert.strictEqual(first.knowledge, 'not-ready');
    assert.strictEqual(first.indexed, false);
    assert.strictEqual(first.compacted, false);
    assert.ok(!fs.existsSync(path.join(project, '.workflows/.knowledge')));
    // The tracking file landed in the fixture, not the repo.
    assert.ok(fs.existsSync(path.join(project, '.workflows/.state/migrations')));

    // The user runs knowledge setup outside the session — simulated here by
    // writing what setup writes: a keyword-only config and a real store file
    // (created by the same store module the CLI bundles, so the real `check`
    // loads it).
    writeFile(project, '.workflows/.knowledge/config.json', '{"knowledge":{}}\n');
    writeFile(project, '.workflows/.knowledge/metadata.json', '{"provider":null}\n');
    const store = require('../../src/knowledge/store.js');
    await store.createStore(3).then((db) => store.saveStore(db, path.join(project, '.workflows/.knowledge/store.msp')));

    // …and the restart's boot finds the store ready and leaves the whole
    // directory out of git: the first boot's migrations ignore it.
    const second = runEngine(real, project, ['boot']);
    assert.strictEqual(second.ok, true);
    assert.strictEqual(second.migrations.changed, false);
    // Everything is recorded, so nothing ran — and the ledger the first boot
    // left for a review gate that the user never reached is swept up here.
    assert.strictEqual(second.migrations.ran, 0);
    assert.strictEqual(second.migrations_committed, git(project, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(git(project, ['log', '-1', '--pretty=%s']).trim(), 'chore: record workflow migrations');
    assert.strictEqual(second.knowledge, 'ready');
    assert.strictEqual(second.indexed, true);
    assert.strictEqual(second.compacted, true);
    assert.strictEqual(git(project, ['status', '--porcelain', '--untracked-files=all', '--', '.workflows/.knowledge']).trim(), '');

    // Third boot: nothing new to commit, the ledger included — a bulk index
    // and a compact with nothing to do write nothing.
    const third = runEngine(real, project, ['boot']);
    assert.strictEqual(third.knowledge, 'ready');
    assert.deepStrictEqual(third.warnings, []);
    assert.strictEqual(third.migrations_committed, null);
  });

  it('a store an earlier version committed leaves git at the first boot — before, and without, the migration commit that ignores it', async () => {
    writeFile(project, '.workflows/.knowledge/config.json', '{"knowledge":{}}\n');
    writeFile(project, '.workflows/.knowledge/metadata.json', '{"provider":null}\n');
    const store = require('../../src/knowledge/store.js');
    await store.createStore(3).then((db) => store.saveStore(db, path.join(project, '.workflows/.knowledge/store.msp')));
    git(project, ['add', '-A']);
    git(project, ['commit', '-q', '-m', 'chore(knowledge): initialise store']);
    const storeBytes = fs.readFileSync(path.join(project, '.workflows/.knowledge/store.msp'));

    const res = runEngine(real, project, ['boot']);

    assert.strictEqual(res.knowledge, 'ready');
    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(res.migrations.changed, true, 'the review gate owns the ignore rules\' commit');
    assert.strictEqual(git(project, ['log', '-1', '--pretty=%s']).trim(), 'chore(knowledge): stop tracking the store');
    assert.deepStrictEqual(
      git(project, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim().split('\n').sort(),
      STORE_FILES.map((f) => `D\t${f}`).sort());
    assert.strictEqual(git(project, ['ls-files', '--', ...STORE_FILES]).trim(), '');
    assert.ok(fs.readFileSync(path.join(project, '.workflows/.knowledge/store.msp')).equals(storeBytes), 'the store stays on disk, byte for byte');
    assert.match(git(project, ['status', '--porcelain', '--', '.workflows/.gitignore']), /\.workflows\/\.gitignore/, 'the rules are not committed yet');

    // The skill's reviewed migration commit takes the whole tree — and the
    // store stays out of it.
    const committed = runEngine(real, project, ['commit', '--workflows', '-m', 'chore: apply workflow migrations']);
    assert.ok(committed.committed);
    const files = git(project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(files.includes('.workflows/.gitignore'));
    assert.ok(!files.some((f) => STORE_FILES.includes(f)), `the store rode the migration commit:\n${files.join('\n')}`);
    assert.strictEqual(git(project, ['ls-files', '--', ...STORE_FILES]).trim(), '');
    assert.ok(fs.existsSync(path.join(project, '.workflows/.knowledge/store.msp')));

    const head = git(project, ['rev-parse', 'HEAD']).trim();
    const again = runEngine(real, project, ['boot']);
    assert.deepStrictEqual(again.warnings, []);
    assert.strictEqual(git(project, ['rev-parse', 'HEAD']).trim(), head, 'nothing left to untrack');
  });
});

describe('engine boot verification addenda (real scripts)', () => {
  let root;
  let project;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-verify-'));
    project = setupProject(root);
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('carries an executed migration\'s checks in migrations.verify, stripped from the report', () => {
    writeFile(project, '.workflows/payments/discussion/alpha.md',
      '# D\n\n## Triage\n\n### Parked\n*From: x · discussion · d*\n\nBody.\n');

    const res = runEngine(real, project, ['boot']);

    assert.strictEqual(res.ok, true);
    const entry = res.migrations.verify.find((v) => v.id === '054');
    assert.ok(entry, `054 addendum present: ${JSON.stringify(res.migrations.verify)}`);
    assert.match(entry.verify, /Converted entries from: payments\/discussion\/alpha\.md/);
    assert.match(entry.info, /triage queue/);
    assert.ok(!res.migrations.output.includes('VERIFY_ADDENDA'), 'plumbing stripped from the report');
    // Second boot: recorded — nothing re-fires.
    const second = runEngine(real, project, ['boot']);
    assert.deepStrictEqual(second.migrations.verify, []);
  });
});

describe('engine commit --workflows', () => {
  let root;
  let project;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-commit-'));
    project = setupProject(root);
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('stages the whole .workflows tree — many work units plus .state — and commits', () => {
    writeFile(project, '.workflows/payments/manifest.json', '{"name":"payments","v":2}\n');
    writeFile(project, '.workflows/auth-flow/manifest.json', '{"name":"auth-flow"}\n');
    writeFile(project, '.workflows/.state/migrations', '045\n');
    writeFile(project, 'unrelated.txt', 'outside the scope\n');

    const res = runEngine(real, project, ['commit', '--workflows', '-m', 'chore: apply workflow migrations']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.committed, git(project, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(git(project, ['log', '-1', '--pretty=%s']).trim(), 'chore: apply workflow migrations');
    // Everything under .workflows landed in the one commit…
    const show = git(project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').sort();
    assert.deepStrictEqual(show, [
      '.workflows/.state/migrations',
      '.workflows/auth-flow/manifest.json',
      '.workflows/payments/manifest.json',
    ]);
    // …and the unrelated file stays uncommitted.
    assert.match(git(project, ['status', '--porcelain']), /\?\? unrelated\.txt/);
  });

  it('a clean tree is fine: committed null, nothing-to-commit note, exit 0', () => {
    const res = runEngine(real, project, ['commit', '--workflows', '-m', 'noop']);
    assert.deepStrictEqual(res, { ok: true, committed: null, note: 'nothing to commit' });
  });

  it('rejects mixed scopes — exactly one of {wu, --inbox, --workflows}', () => {
    assert.match(
      runEngineFails(real, project, ['commit', '--workflows', 'payments', '-m', 'msg']).error,
      /Usage: engine commit/);
    assert.match(
      runEngineFails(real, project, ['commit', '--workflows', '--inbox', '-m', 'msg']).error,
      /Usage: engine commit/);
    assert.match(
      runEngineFails(real, project, ['commit', '--workflows']).error,
      /Usage: engine commit/);
  });
});
