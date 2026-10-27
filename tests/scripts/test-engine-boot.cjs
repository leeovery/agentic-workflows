'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const { installTmuxStub, tmuxStubEnv, tmuxStubName } = require('./tmux-stub.cjs');
const harness = require('./engine-harness.cjs');

const { git, stateGit, commitAll, setupFixtureAt } = harness;
const REAL_SCRIPTS = path.dirname(harness.ENGINE);
const REAL_ENGINE_SKILL = path.dirname(REAL_SCRIPTS);
const { OWNED_PATHS } = require(path.join(REAL_SCRIPTS, 'domain/commit.cjs'));
const { createState } = require(path.join(REAL_SCRIPTS, 'domain/state-worktree.cjs'));
const { datedAt } = require('./discovery-test-utils.cjs');
const { processStartTime } = require(path.join(REAL_SCRIPTS, 'kernel/process.cjs'));
const store = require(path.join(REAL_SCRIPTS, 'kernel/knowledge/store.cjs'));

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The session hooks boot keeps in every project's `.claude/settings.json`,
// and the function-hooks flag migration 065 takes out of it.
const FLAG = 'CLAUDE_CODE_ENABLE_FUNCTION_HOOKS';
const HOOK_ENGINE = 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs"';
const SESSION_HOOK = { type: 'command', command: `${HOOK_ENGINE} session cleanup` };
const RESUME_HOOK = { type: 'command', command: `${HOOK_ENGINE} session resume` };
const PRESENCE_HOOK = { type: 'command', command: `${HOOK_ENGINE} presence cleanup` };
const END_HOOK = { type: 'command', command: `${HOOK_ENGINE} conversation end` };
/** The workflows' own SessionEnd hooks, in every project whatever the label choice. */
const WORKFLOW_HOOKS = [PRESENCE_HOOK, END_HOOK];
/** Settings as boot leaves a project the mod cannot run in: `rest`, then `hooks` in boot's one SessionEnd group. */
function hooked(hooks, rest = {}) {
  return JSON.stringify({ ...rest, hooks: { SessionEnd: [{ hooks }] } }, null, 2) + '\n';
}
/** The settings such a project reaches with labels on: every SessionEnd hook and the SessionStart resume hook. */
const LABELS_ON = JSON.stringify({
  hooks: { SessionEnd: [{ hooks: [SESSION_HOOK, ...WORKFLOW_HOOKS] }], SessionStart: [{ matcher: 'resume', hooks: [RESUME_HOOK] }] },
}, null, 2) + '\n';

/** The knowledge directory's files, from the project root. */
const KNOWLEDGE_DIR = '.leeway/.knowledge';
const STORE_FILES = ['store.bin', 'metadata.json', 'config.json'].map((f) => `${KNOWLEDGE_DIR}/${f}`);

/**
 * A project fixture: a real git repo with its state worktree at `.leeway/`,
 * its settings already carrying the workflows' own hooks — the state every
 * booted project reaches, so boot's own plumbing commits never join the
 * history a test reads. A test about the install takes the hooks away first.
 * The gate mod is not installed, so boot reports it unavailable; a test
 * about the mod installs it.
 */
/**
 * A project still on the layout before the state worktree: its `.workflows/`
 * in the code tree, committed there, for the legacy fleet to upgrade.
 * @param {string} project
 */
function legacyLayout(project) {
  writeFile(project, '.workflows/payments/manifest.json', '{"name":"payments"}\n');
  git(project, ['add', '--', '.workflows']);
  git(project, ['commit', '-q', '-m', 'the old layout']);
}

function setupProject(root) {
  const project = setupFixtureAt(path.join(root, 'project'));
  writeFile(project, '.leeway/payments/manifest.json', '{"name":"payments"}\n');
  writeFile(project, '.claude/settings.json', hooked(WORKFLOW_HOOKS));
  commitAll(project, 'init');
  return project;
}

// Stub migrate.cjs: env-driven behaviour, mimicking the real report format
// byte-for-byte (boot parses the report, so the stub must reproduce it).
const STUB_MIGRATE = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const mode = process.env.STUB_MIGRATE_MODE || '';
const ledger = process.argv[process.argv.indexOf('--ledger') + 1];
let ran = 1;
if (mode === 'update') {
  fs.mkdirSync(path.dirname(ledger), { recursive: true });
  fs.mkdirSync('.leeway/payments', { recursive: true });
  fs.appendFileSync(ledger, '045\\n');
  fs.writeFileSync('.leeway/payments/marker.md', 'migrated\\n');
  process.stdout.write(
    '\\n' +
    '1 migration(s) applied, 2 file(s) updated.\\n' +
    '\\n' +
    '---STOP_GATE: FILES_UPDATED---\\n' +
    'You MUST now follow the migration skill instructions to STOP and let the user review.\\n' +
    'Follow the explicit instructions in the migration skill before proceeding.\\n'
  );
} else if (mode === 'update-config') {
  fs.mkdirSync(path.dirname(ledger), { recursive: true });
  fs.mkdirSync('.claude', { recursive: true });
  fs.appendFileSync(ledger, '046\\n');
  fs.writeFileSync('.claude/settings.json', process.env.STUB_MIGRATE_SETTINGS || '{"permissions":{}}\\n');
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
  fs.mkdirSync(path.dirname(ledger), { recursive: true });
  fs.appendFileSync(ledger, '047\\n');
  process.stdout.write('[SKIP] No changes needed\\n');
} else if (mode === 'fail') {
  process.stdout.write('partial output before the failure\\n');
  process.stderr.write('boom: migration 099 exploded\\n');
  process.exit(1);
} else {
  ran = 0;
  process.stdout.write('[SKIP] No changes needed\\n');
}
// STUB_MIGRATE_NOTICES is the notices payload line, emitted under its marker.
if (process.env.STUB_MIGRATE_NOTICES) {
  process.stdout.write('---MIGRATION_NOTICES---\\n' + process.env.STUB_MIGRATE_NOTICES + '\\n');
}
// The run report every completed run ends with — STUB_MIGRATE_REPORT
// substitutes the payload line, STUB_MIGRATE_NO_REPORT plays a runner from
// before the marker existed.
if (!process.env.STUB_MIGRATE_NO_REPORT) {
  process.stdout.write('---MIGRATIONS_RUN---\\n');
  process.stdout.write(
    (process.env.STUB_MIGRATE_REPORT || JSON.stringify({ ran })) + '\\n'
  );
}
`;

/**
 * The engine copied into a temp skills root beside a stub migrate.cjs —
 * boot resolves the migration runner relative to its own file, so the copy
 * is what exercises that resolution exactly as installed. The knowledge base
 * runs in the copy's own process, its chunking configs copied with it. The
 * tree is never written to during the run, so one serves the whole suite;
 * each test brings its own project.
 */
function stubbedSkillsTree() {
  const skills = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-skills-'));
  process.on('exit', () => fs.rmSync(skills, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  fs.cpSync(REAL_ENGINE_SKILL, path.join(skills, 'workflow-engine'), { recursive: true });
  writeFile(skills, 'workflow-migrate/scripts/migrate.cjs', STUB_MIGRATE);
  return path.join(skills, 'workflow-engine/scripts/engine.cjs');
}

const STUB_ENGINE = stubbedSkillsTree();
/** The engines a test drives: the copy with the stub migrations, and the repo's real scripts. */
const stubbed = harness.harness(STUB_ENGINE);
const real = harness;

/**
 * The vector fill's launches from the stubbed copy recorded, not spawned.
 * @param {import('node:test').TestContext} t @returns {string[]}
 */
function recordStubbedLaunches(t) {
  const { launcher } = require(path.join(path.dirname(STUB_ENGINE), 'domain/knowledge/vectors.cjs'));
  /** @type {string[]} */
  const launched = [];
  t.mock.method(launcher, 'launch', (/** @type {string} */ root) => { launched.push(root); });
  return launched;
}

/**
 * The checkout set up keyword-only with an empty store — a knowledge base
 * that reads ready.
 * @param {string} project @param {Record<string, unknown>} [settings]  over the keyword-only pin
 */
function readyKnowledge(project, settings = {}) {
  writeFile(project, '.leeway/.knowledge/config.json', JSON.stringify({ knowledge: { provider: null, ...settings } }) + '\n');
  store.saveStore(store.createStore(), path.join(project, '.leeway/.knowledge/store.bin'));
  store.writeMetadata(path.join(project, '.leeway/.knowledge/metadata.json'), { last_indexed: null });
}

/**
 * A feature with one completed discussion holding `body` — something for
 * boot's index to take in.
 * @param {string} project @param {string} body
 */
function completedDiscussion(project, body) {
  writeFile(project, '.leeway/manifest.json', JSON.stringify({ work_units: { payments: { work_type: 'feature' } } }, null, 2) + '\n');
  writeFile(project, '.leeway/payments/manifest.json', JSON.stringify({
    name: 'payments', work_type: 'feature', status: 'in-progress', created: '2026-01-01',
    phases: { discussion: { items: { payments: { status: 'completed' } } } },
  }, null, 2) + '\n');
  writeFile(project, '.leeway/payments/discussion/payments.md', body);
}

/** A git-repo project carrying the settings every booted project has. */
function setupFixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-')));
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

  it('happy path: no pending migrations, knowledge ready — the store brought in line, then compacted', () => {
    readyKnowledge(fix.project);
    // TMUX pinned so the label-state leg is deterministic whatever terminal
    // runs the suite; no project manifest makes it `prompt`.
    const res = runEngine(stubbed, fix.project, ['boot'], { TMUX: '/fake/sock,123,7' });

    assert.deepStrictEqual(res, {
      ok: true,
      state: 'ready',
      migrations: { changed: false, ran: 0, output: '[SKIP] No changes needed', verify: [], notices: [] },
      knowledge: 'ready',
      indexed: true,
      compacted: true,
      migrations_committed: null,
      warnings: [],
      tmux_labels: 'prompt',
      label_repaired: false,
      session_hooks_installed: false,
      gate_surface: 'unavailable',
      baseline: 'none',
      walkthrough: 'none',
      github_rule_offer: false,
      // The state arrived beside the fixture's first code commit, its
      // `.gitignore`: that commit came before it, and the rest after.
      baseline_signal: {
        root_date: '2026-01-01', workflows_date: '2026-01-01', commits_total: 2, commits_before: 1,
        history_before: ['2026-01-01  ignore the state'], files_at_arrival: 1, tree_at_arrival: ['.gitignore'],
      },
    });
  });

  it('baseline: reports the project-manifest status; unrecognised or malformed values read none', () => {
    const projManifest = path.join(fix.project, '.leeway/manifest.json');

    for (const status of ['native', 'in-progress', 'completed', 'skipped']) {
      fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, baseline: { status } }));
      const res = runEngine(stubbed, fix.project, ['boot']);
      assert.strictEqual(res.baseline, status);
      // A recorded verdict is never re-judged, so the signal travels only with `none`.
      assert.ok(!('baseline_signal' in res), `${status}: no signal once a status is recorded`);
    }

    // Unrecognised value → none (the judgment-eligible default), signal attached.
    fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, baseline: { status: 'weird' } }));
    const weird = runEngine(stubbed, fix.project, ['boot']);
    assert.strictEqual(weird.baseline, 'none');
    assert.strictEqual(weird.baseline_signal.commits_before, 1);

    // An object with nothing recorded → none.
    fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, baseline: {} }));
    assert.strictEqual(runEngine(stubbed, fix.project, ['boot']).baseline, 'none');

    // Malformed field shape → none.
    fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, baseline: 'in-progress' }));
    assert.strictEqual(runEngine(stubbed, fix.project, ['boot']).baseline, 'none');

    // No project manifest at all → none.
    fs.rmSync(projManifest);
    assert.strictEqual(runEngine(stubbed, fix.project, ['boot']).baseline, 'none');
  });

  it('walkthrough: reports the recorded answer; unrecognised or malformed values read none', () => {
    const projManifest = path.join(fix.project, '.leeway/manifest.json');

    for (const status of ['walked', 'skipped']) {
      fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, walkthrough: { status } }));
      assert.strictEqual(runEngine(stubbed, fix.project, ['boot']).walkthrough, status);
    }

    for (const walkthrough of [{ status: 'weird' }, {}, 'walked']) {
      fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, walkthrough }));
      assert.strictEqual(runEngine(stubbed, fix.project, ['boot']).walkthrough, 'none', JSON.stringify(walkthrough));
    }

    // The two one-time records are independent: a recorded baseline says
    // nothing about the offer, and vice versa.
    fs.writeFileSync(projManifest, JSON.stringify({ work_units: {}, baseline: { status: 'native' }, walkthrough: { status: 'skipped' } }));
    const both = runEngine(stubbed, fix.project, ['boot']);
    assert.strictEqual(both.baseline, 'native');
    assert.strictEqual(both.walkthrough, 'skipped');

    fs.rmSync(projManifest);
    assert.strictEqual(runEngine(stubbed, fix.project, ['boot']).walkthrough, 'none');
  });

  /**
   * A scratch repo beside the fixture, hermetic like it, with dated
   * commits and the state arriving on a date of the test's choosing. From
   * the first commit on, its settings carry the workflows' own hooks, like
   * the fixture's, and its `.worktreeinclude` the knowledge files an earlier
   * boot listed there; its `.gitignore` names the state, as boot keeps it,
   * held out of the history by its own exclude: the history under test is
   * the project's own.
   */
  function scratchRepo(name) {
    const project = harness.initRepo(path.join(fix.root, name));
    fs.appendFileSync(path.join(project, '.git/info/exclude'), '.gitignore\n');
    writeFile(project, '.gitignore', '.leeway/\n');
    writeFile(project, '.claude/settings.json', hooked(WORKFLOW_HOOKS));
    writeFile(project, '.worktreeinclude', STORE_FILES.join('\n') + '\n');
    const at = (date) => `${date}T12:00:00Z`;
    const commit = (msg, date) => {
      execFileSync('git', ['add', '-A'], { cwd: project });
      execFileSync('git', ['commit', '-q', '--allow-empty', '-m', msg], { cwd: project, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_DATE: at(date), GIT_COMMITTER_DATE: at(date) } });
    };
    const arrive = (date) => datedAt(at(date), () => createState(path.join(project, '.leeway')));
    return { project, commit, arrive };
  }

  it('baseline_signal: a codebase committed before `.leeway/` arrived reads as history that predates the workflows — as commits and a tree, not a count', () => {
    // A brownfield repo: two commits of code (the skills install and an
    // earlier boot's `.worktreeinclude` beside it, which never count as
    // project code), then the workflows land.
    const { project, commit, arrive } = scratchRepo('brownfield');
    writeFile(project, 'src/app.js', 'export default 1;\n');
    writeFile(project, 'README.md', '# App\n');
    commit('initial', '2025-03-01');
    writeFile(project, 'src/lib.js', 'export const x = 2;\n');
    commit('more code', '2025-06-15');

    // No state yet — the workflows arriving now: the whole history predates
    // them, and the tree is HEAD's.
    const { baselineSignal } = require(path.join(REAL_SCRIPTS, 'domain/baseline.cjs'));
    assert.deepStrictEqual(baselineSignal(project), {
      root_date: '2025-03-01', workflows_date: null, commits_total: 2, commits_before: 2,
      history_before: ['2025-03-01  initial', '2025-06-15  more code'],
      files_at_arrival: 3, tree_at_arrival: ['src/ (2)', 'README.md'],
    });

    // The state lands, and the code goes on: the two commits before its first
    // commit are the history, and the tree is the one it arrived into.
    arrive('2025-09-01');
    writeFile(project, 'src/later.js', 'export const y = 3;\n');
    commit('after the workflows', '2025-10-01');
    const res = runEngine(stubbed, project, ['boot']);
    assert.strictEqual(res.baseline, 'none');
    assert.deepStrictEqual(res.baseline_signal, {
      root_date: '2025-03-01', workflows_date: '2025-09-01', commits_total: 3, commits_before: 2,
      history_before: ['2025-03-01  initial', '2025-06-15  more code'],
      files_at_arrival: 3, tree_at_arrival: ['src/ (2)', 'README.md'],
    });
  });

  it('baseline_signal: the workflows arriving with the codebase\'s first commit report the tree they arrived into — a legacy codebase put under git at install is not a fresh start', () => {
    const { project, commit, arrive } = scratchRepo('legacy');
    for (const f of ['app/models/user.rb', 'app/models/order.rb', 'app/controllers/orders.rb', 'config/routes.rb', 'Gemfile']) writeFile(project, f, '# code\n');
    commit('import', '2025-01-01');
    arrive('2025-01-01');
    const res = runEngine(stubbed, project, ['boot']);
    assert.deepStrictEqual(res.baseline_signal, {
      root_date: '2025-01-01', workflows_date: '2025-01-01', commits_total: 1, commits_before: 1, history_before: ['2025-01-01  import'],
      files_at_arrival: 5, tree_at_arrival: ['app/ (3)', 'config/ (1)', 'Gemfile'],
    });
  });

  it('baseline_signal: the code before the arrival is the default branch\'s as it stood, never a side branch merged after', () => {
    // main: root(Jan) → c2(Feb), the state arriving in Apr, then a merge(May)
    // of a side branch cut from root in Mar. Its commit is older than the
    // arrival, but main never held it until the merge.
    const { project, commit, arrive } = scratchRepo('branched');
    writeFile(project, 'src/a.js', 'a\n');
    commit('root', '2025-01-01');
    writeFile(project, 'src/b.js', 'b\n');
    writeFile(project, 'src/c.js', 'c\n');
    commit('main work', '2025-02-01');
    git(project, ['checkout', '-q', '-b', 'side', 'HEAD~1']);
    writeFile(project, 'docs/side.md', 'side\n');
    commit('side work', '2025-03-01');
    git(project, ['checkout', '-q', 'main']);
    arrive('2025-04-01');
    execFileSync('git', ['merge', '-q', '--no-edit', 'side'], { cwd: project, env: { ...process.env, GIT_AUTHOR_DATE: '2025-05-01T12:00:00Z', GIT_COMMITTER_DATE: '2025-05-01T12:00:00Z' } });
    const res = runEngine(stubbed, project, ['boot']);
    assert.deepStrictEqual(res.baseline_signal, {
      root_date: '2025-01-01', workflows_date: '2025-04-01', commits_total: 4, commits_before: 2,
      history_before: ['2025-01-01  root', '2025-02-01  main work'],
      files_at_arrival: 3, tree_at_arrival: ['src/ (3)'],
    });
  });

  it('baseline_signal: a long run keeps its head and tail around one elision line, and the tree its largest dozen entries', () => {
    const { project, commit, arrive } = scratchRepo('long');
    for (let i = 1; i <= 15; i += 1) {
      writeFile(project, `dir${String(i).padStart(2, '0')}/f.js`, `${i}\n`);
      commit(`commit ${i}`, `2025-01-${String(i).padStart(2, '0')}`);
    }
    arrive('2025-02-01');
    const sig = runEngine(stubbed, project, ['boot']).baseline_signal;
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
    const { project, commit, arrive } = scratchRepo('signed');
    writeFile(project, 'src/a.js', 'a\n');
    commit('root', '2025-01-01');
    arrive('2025-02-01');
    const plain = runEngine(stubbed, project, ['boot']).baseline_signal;
    git(project, ['config', 'log.showSignature', 'true']);
    const signed = runEngine(stubbed, project, ['boot']).baseline_signal;
    assert.deepStrictEqual(signed, plain);
    assert.strictEqual(plain.commits_before, 1);
  });

  it('baseline_signal: a boot from inside the state worktree reads the code history, never the state branch\'s', () => {
    const fromRoot = runEngine(stubbed, fix.project, ['boot']).baseline_signal;
    const fromState = runEngine(stubbed, path.join(fix.project, '.leeway'), ['boot']).baseline_signal;

    assert.deepStrictEqual(fromState, fromRoot);
    assert.deepStrictEqual(fromState.history_before, ['2026-01-01  ignore the state']);
  });

  it('baseline_signal: no honest history to read — no commits, no repository, a shallow clone — is null, never a failure and never a fresh-start signal', () => {
    const empty = harness.initRepo(path.join(fix.root, 'empty'));
    createState(path.join(empty, '.leeway'));
    // The hooks and the state's ignore line already there, uncommitted:
    // boot's plumbing would otherwise make the root commit — the history
    // this test needs absent.
    writeFile(empty, '.claude/settings.json', hooked(WORKFLOW_HOOKS));
    writeFile(empty, '.gitignore', '.leeway/\n');
    const res = runEngine(stubbed, empty, ['boot']);
    assert.strictEqual(res.baseline, 'none');
    assert.strictEqual(res.baseline_signal, null);

    const { baselineSignal } = require(path.join(REAL_SCRIPTS, 'domain/baseline.cjs'));
    const plain = path.join(fix.root, 'plain');
    fs.mkdirSync(plain, { recursive: true });
    assert.strictEqual(baselineSignal(plain), null);

    // A shallow clone of a brownfield history looks like a root-commit
    // arrival; it is truncated, not fresh, so the signal says so.
    const { project, commit, arrive } = scratchRepo('deep');
    writeFile(project, 'src/a.js', 'a\n');
    commit('root', '2025-01-01');
    writeFile(project, 'src/b.js', 'b\n');
    commit('more', '2025-02-01');
    arrive('2025-03-01');
    const shallow = path.join(fix.root, 'shallow');
    execFileSync('git', ['clone', '-q', '--depth', '1', `file://${project}`, shallow]);
    assert.strictEqual(baselineSignal(shallow), null);
  });

  it('baseline_signal: rides a not-ready boot too — the brownfield first boot returns from the knowledge gate to the judgment on that same response', () => {
    fs.writeFileSync(path.join(fix.project, '.leeway/manifest.json'), JSON.stringify({ work_units: {}, baseline: {} }));
    const res = runEngine(stubbed, fix.project, ['boot']);
    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.baseline, 'none');
    assert.strictEqual(res.baseline_signal.commits_before, 1, 'the fixture\'s first code commit');
  });

  it('baseline: reported on a not-ready boot too — the brownfield first boot is exactly the knowledge-gate path', () => {
    fs.writeFileSync(path.join(fix.project, '.leeway/manifest.json'),
      JSON.stringify({ work_units: {}, baseline: { status: 'in-progress' } }));
    const res = runEngine(stubbed, fix.project, ['boot']);
    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.baseline, 'in-progress');
  });

  it('pending migration: changed true, report captured with the stop-gate lines stripped', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'update' });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.migrations.changed, true);
    assert.strictEqual(res.migrations.output, '1 migration(s) applied, 2 file(s) updated.');
    // The migration landed in the project's .leeway tree.
    assert.ok(fs.existsSync(path.join(fix.project, '.leeway/payments/marker.md')));
    assert.match(stateGit(fix.project, ['status', '--porcelain']), /marker\.md/);
  });

  it('carries the run\'s notices for the person, stripped from the report', () => {
    const notices = [{ id: '067', description: 'a removal', notice: 'Removed a setting — add it back if you want it.' }];
    const res = runEngine(stubbed, fix.project, ['boot'], {
      STUB_MIGRATE_MODE: 'update',
      STUB_MIGRATE_NOTICES: JSON.stringify(notices),
    });

    assert.deepStrictEqual(res.migrations.notices, notices);
    assert.deepStrictEqual(res.migrations.verify, []);
    assert.strictEqual(res.migrations.output, '1 migration(s) applied, 2 file(s) updated.');
    assert.deepStrictEqual(res.warnings, []);
  });

  it('notices boot cannot read degrade to a warning and an empty list', () => {
    for (const payload of ['not json', '{"notice": "not a list"}']) {
      const res = runEngine(stubbed, fix.project, ['boot'], { STUB_MIGRATE_NOTICES: payload });
      assert.deepStrictEqual(res.migrations.notices, [], payload);
      assert.strictEqual(res.warnings.length, 1, payload);
      assert.match(res.warnings[0], /^migration notices unreadable: /, payload);
      assert.ok(!res.migrations.output.includes('MIGRATION_NOTICES'), payload);
    }
  });

  it('a migration touching config files commits none of them — the reviewed commit takes them with the rest', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], {
      STUB_MIGRATE_MODE: 'update-config',
      STUB_MIGRATE_SETTINGS: hooked(WORKFLOW_HOOKS, { permissions: {} }),
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.migrations.changed, true);
    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'init');
    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'init');
    assert.deepStrictEqual(
      git(fix.project, ['status', '--porcelain', '--', ...OWNED_PATHS]).split('\n').filter(Boolean).sort(),
      [' M .claude/settings.json', ' M .gitignore']);
    assert.deepStrictEqual(stateGit(fix.project, ['status', '--porcelain']).split('\n').filter(Boolean), ['?? .state/']);

    runEngine(stubbed, fix.project, ['commit', '--migrations', '-m', 'chore: apply workflow migrations']);

    assert.deepStrictEqual(
      git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').sort(),
      ['.claude/settings.json', '.gitignore']);
    assert.deepStrictEqual(
      stateGit(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n'),
      ['.state/migrations']);
  });

  it('while a reviewed migration commit follows, boot\'s settings write rides it — a confined commit would carry the migration\'s edit of the same file past the review', () => {
    writeFile(fix.project, '.leeway/manifest.json', JSON.stringify({ defaults: { tmux_labels: true } }, null, 2) + '\n');
    commitAll(fix.project, 'labels on');
    const codeHead = git(fix.project, ['rev-parse', 'HEAD']).trim();

    const res = runEngine(stubbed, fix.project, ['boot'], {
      STUB_MIGRATE_MODE: 'update-config',
      STUB_MIGRATE_SETTINGS: hooked(WORKFLOW_HOOKS, { permissions: {} }),
    });

    assert.strictEqual(res.migrations.changed, true);
    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(git(fix.project, ['rev-parse', 'HEAD']).trim(), codeHead, 'no commit of boot\'s');
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8')),
      { permissions: {}, ...JSON.parse(LABELS_ON) }, 'the migration\'s edit and the hooks, side by side');

    runEngine(stubbed, fix.project, ['commit', '--migrations', '-m', 'chore: apply workflow migrations']);

    assert.deepStrictEqual(
      git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').sort(),
      ['.claude/settings.json', '.gitignore']);
    assert.deepStrictEqual(
      stateGit(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n'),
      ['.state/migrations']);
    assert.strictEqual(git(fix.project, ['status', '--porcelain', '--', ...OWNED_PATHS]).trim(), '', 'the reviewed commit took it all');
  });

  it('no migrations ran: dirty config files are left untouched, never committed by boot', () => {
    // Track a config baseline, then dirty both files with no migration running.
    writeFile(fix.project, '.claude/settings.json', hooked(WORKFLOW_HOOKS, { permissions: {} }));
    writeFile(fix.project, '.gitignore', '.leeway/\nnode_modules\n');
    commitAll(fix.project, 'config baseline');
    writeFile(fix.project, '.claude/settings.json', hooked(WORKFLOW_HOOKS, { permissions: { allow: ['x'] } }));
    writeFile(fix.project, '.gitignore', '.leeway/\nnode_modules\n.DS_Store\n');

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
    assert.strictEqual(res.migrations_committed, stateGit(fix.project, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'chore: record workflow migrations');
    assert.deepStrictEqual(
      stateGit(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n'),
      ['.state/migrations']
    );
    assert.strictEqual(stateGit(fix.project, ['status', '--porcelain']).trim(), '', 'nothing left dirty');
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'init', 'and nothing on the code side');
  });

  it('a ledger an earlier boot left dirty is committed by the next one, which ran nothing at all', () => {
    // The state this bug leaves behind: a previous boot recorded an ID and
    // never committed it. Those migrations are recorded now, so nothing runs
    // — and the line still has to go.
    writeFile(fix.project, '.leeway/.state/migrations', '045\n');
    commitAll(fix.project, 'ledger baseline');
    writeFile(fix.project, '.leeway/.state/migrations', '045\n046\n');

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.migrations.ran, 0, 'nothing ran this boot');
    assert.strictEqual(res.migrations.changed, false);
    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(res.migrations_committed, stateGit(fix.project, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'chore: record workflow migrations');
    assert.strictEqual(stateGit(fix.project, ['status', '--porcelain']).trim(), '');
  });

  it('a run that changed documents leaves the ledger to the reviewed commit — boot never commits it twice', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'update' });

    assert.strictEqual(res.migrations.changed, true);
    assert.strictEqual(res.migrations.ran, 1);
    assert.strictEqual(res.migrations_committed, null);
    // The ledger line waits with the rest of the diff for the skill's
    // `commit --migrations`, which the review gate runs on the user's yes.
    assert.match(stateGit(fix.project, ['status', '--porcelain', '--', '.state/migrations']), /migrations/);
    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'init');
  });

  it('a ledger with nothing to commit — already clean — is null and silent', () => {
    // Clean: the run recorded nothing new (a re-append restoring what HEAD
    // already holds), so the tracked ledger matches HEAD.
    writeFile(fix.project, '.leeway/.state/migrations', '045\n');
    commitAll(fix.project, 'ledger baseline');

    const clean = runEngine(stubbed, fix.project, ['boot'], { STUB_MIGRATE_REPORT: '{"ran": 2}' });
    assert.strictEqual(clean.migrations.ran, 2);
    assert.strictEqual(clean.migrations_committed, null);
    assert.deepStrictEqual(clean.warnings, []);
    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'ledger baseline');
  });

  it('a failing ledger commit is a warning, never a block — the ledger is already right on disk', () => {
    // Another git process holding the state branch's ref lock.
    fs.writeFileSync(path.join(fix.project, '.git/refs/heads/leeway-state.lock'), '');

    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'record-only' });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.migrations.ran, 1);
    assert.strictEqual(res.migrations_committed, null);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /migration ledger commit failed/);
    assert.ok(fs.existsSync(path.join(fix.project, '.leeway/.state/migrations')), 'the recorded run survives');
  });

  it('a run report boot cannot read degrades to a warning — ran 0, the ledger still committed, plumbing still stripped', () => {
    for (const payload of ['not json at all', '{"ran": "two"}', '{"ran": -1}']) {
      const res = runEngine(stubbed, fix.project, ['boot'], {
        STUB_MIGRATE_MODE: 'record-only',
        STUB_MIGRATE_REPORT: payload,
      });

      assert.strictEqual(res.ok, true, payload);
      assert.strictEqual(res.migrations.ran, 0, payload);
      assert.strictEqual(res.migrations_committed, stateGit(fix.project, ['rev-parse', '--short', 'HEAD']).trim(), payload);
      assert.strictEqual(res.warnings.length, 1, `${payload}: ${JSON.stringify(res.warnings)}`);
      assert.match(res.warnings[0], /^migration run report unreadable: /);
      assert.strictEqual(res.migrations.output, '[SKIP] No changes needed', payload);
      assert.ok(!res.migrations.output.includes('MIGRATIONS_RUN'), payload);
    }
  });

  it('a runner that reports nothing reads as no migrations run — the ledger it wrote still committed', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], {
      STUB_MIGRATE_MODE: 'record-only',
      STUB_MIGRATE_NO_REPORT: '1',
    });

    assert.strictEqual(res.migrations.ran, 0);
    assert.strictEqual(res.migrations_committed, stateGit(fix.project, ['rev-parse', '--short', 'HEAD']).trim());
    assert.deepStrictEqual(res.warnings, []);
  });

  it('knowledge not-ready is terminal: no init, no commit, setup stays a human choice', () => {
    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.indexed, false);
    assert.strictEqual(res.compacted, false);
    assert.deepStrictEqual(res.warnings, []);
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/.knowledge')), 'nothing set up');
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'init');
  });

  it('a ready store is never committed — the index is the checkout\'s own', () => {
    readyKnowledge(fix.project);
    completedDiscussion(fix.project, '# Payments\n\nCards ship first.\n');

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.indexed, true);
    assert.deepStrictEqual(harness.indexedFiles(fix.project), ['payments/discussion/payments.md']);
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'init');
    assert.strictEqual(stateGit(fix.project, ['ls-files', '--', '.knowledge']).trim(), '');
  });

  it('buildable: a set-up checkout with no store has it built by the keyword side, then compacted', () => {
    writeFile(fix.project, '.leeway/.knowledge/config.json', '{ "knowledge": { "provider": null } }\n');
    completedDiscussion(fix.project, '# Payments\n\nCards ship first.\n');

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.indexed, true);
    assert.strictEqual(res.compacted, true);
    assert.deepStrictEqual(res.warnings, []);
    assert.ok(!('system_config' in res), 'a store that stood needs no setup');
    assert.deepStrictEqual(harness.indexedFiles(fix.project), ['payments/discussion/payments.md']);
  });

  it('buildable: a build that did not stand is not-ready — no compact, the gate\'s report attached', () => {
    writeFile(fix.project, '.leeway/.knowledge/config.json', '{ "knowledge": { "provider": null } }\n');
    writeFile(fix.project, '.leeway/manifest.json', '{ not json');

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.indexed, false);
    assert.strictEqual(res.compacted, false);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^knowledge index failed: manifest read failed: project manifest at .* is not valid JSON/);
    assert.ok('system_config' in res);
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/.knowledge/store.bin')));
  });

  it('buildable: a store that stood with a file failing is ready, the failure a warning the next start retries', () => {
    writeFile(fix.project, '.leeway/.knowledge/config.json', '{ "knowledge": { "provider": null } }\n');
    completedDiscussion(fix.project, '');

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.indexed, false);
    assert.strictEqual(res.compacted, true);
    assert.strictEqual(res.warnings.length, 1);
    const file = path.join(fix.project, '.leeway/payments/discussion/payments.md');
    assert.ok(res.warnings[0].startsWith(`knowledge index failed: Failed to index ${file}: No chunks produced from ${file}.`), res.warnings[0]);
  });

  it('a peer session\'s staged work survives every one of boot\'s commits', () => {
    // Boot runs at `workflow-start`, which is a session opening beside every
    // other one on the checkout. Its commits — the migration ledger and the
    // project settings sync — must take their own paths and nothing else,
    // staged peer content included.
    writeFile(fix.project, '.leeway/payments/discussion/topic-a.md', '# Topic A\n');
    writeFile(fix.project, '.leeway/manifest.json', JSON.stringify({ defaults: { tmux_labels: true } }, null, 2) + '\n');
    commitAll(fix.project, 'a peer topic');
    writeFile(fix.project, '.leeway/payments/discussion/topic-a.md', '# Topic A\nhalf a turn\n');
    stateGit(fix.project, ['add', '--', 'payments/discussion/topic-a.md']);

    const res = runEngine(stubbed, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'record-only' });

    assert.strictEqual(res.ok, true);
    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(res.session_hooks_installed, true);
    assert.deepStrictEqual(git(fix.project, ['log', '-2', '--pretty=%s']).trim().split('\n'), [
      'chore: install workflow session hooks',
      'init',
    ]);
    assert.deepStrictEqual(stateGit(fix.project, ['log', '-2', '--pretty=%s']).trim().split('\n'), [
      'chore: record workflow migrations',
      'a peer topic',
    ]);
    const files = stateGit(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean);
    assert.deepStrictEqual(files, ['.state/migrations'], 'boot swept nothing of a peer session\'s staged state');
    assert.strictEqual(stateGit(fix.project, ['diff', '--cached', '--name-only']).trim(),
      'payments/discussion/topic-a.md', 'and left it staged exactly as it was');
  });

  it('a check that cannot read the knowledge config is not-ready — never a crash', () => {
    fs.mkdirSync(path.join(fix.project, '.leeway/.knowledge/config.json'), { recursive: true });

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.indexed, false);
    assert.strictEqual(res.compacted, false);
  });

  it('a mistake in the knowledge config is named, never a block — compact prunes at the default floor in its place', () => {
    // S0 0.05: 'buried', two completions behind, sits at R ≈ 0.015 — below the
    // default floor 0.05 — and 'recent', one behind, at R ≈ 0.12, above it.
    const completions = [['buried', '2024-01-01'], ['recent', '2024-06-01'], ['frontier', '2024-12-01']];
    writeFile(fix.project, '.leeway/manifest.json', JSON.stringify({
      work_units: Object.fromEntries(completions.map(([name]) => [name, { work_type: 'feature' }])),
    }, null, 2) + '\n');
    for (const [name, completedAt] of completions) {
      writeFile(fix.project, `.leeway/${name}/manifest.json`, JSON.stringify({
        name, work_type: 'feature', status: 'completed', created: '2024-01-01', completed_at: completedAt,
        phases: name === 'frontier' ? {} : { discussion: { items: { [name]: { status: 'completed' } } } },
      }, null, 2) + '\n');
      if (name !== 'frontier') writeFile(fix.project, `.leeway/${name}/discussion/${name}.md`, `# ${name}\n\nCards ship first.\n`);
    }
    readyKnowledge(fix.project, { decay_prune_below: false, decay_base_stability: 0.05 });
    runEngine(stubbed, fix.project, ['boot']);
    assert.deepStrictEqual(harness.indexedFiles(fix.project), ['buried/discussion/buried.md', 'recent/discussion/recent.md']);

    const configFile = path.join(fix.project, '.leeway/.knowledge/config.json');
    writeFile(fix.project, '.leeway/.knowledge/config.json', JSON.stringify({
      knowledge: { provider: null, decay_prune_below: 7, decay_base_stability: 0.05, strategy: 'hybrid' },
    }) + '\n');
    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.indexed, true);
    assert.strictEqual(res.compacted, true);
    assert.deepStrictEqual(res.warnings, [
      `knowledge config: decay_prune_below in ${configFile} is ignored: 7 is not false or a number from 0 to 1`,
      `knowledge config: strategy in ${configFile} is ignored: not a knowledge setting`,
    ]);
    assert.deepStrictEqual(harness.indexedFiles(fix.project), ['recent/discussion/recent.md']);
  });

  it('a file the index cannot take is its own warning — compact still runs', () => {
    readyKnowledge(fix.project);
    completedDiscussion(fix.project, '');

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.indexed, false);
    assert.strictEqual(res.compacted, true);
    assert.strictEqual(res.warnings.length, 1);
    const file = path.join(fix.project, '.leeway/payments/discussion/payments.md');
    assert.ok(res.warnings[0].startsWith(`knowledge index failed: Failed to index ${file}: No chunks produced from ${file}.`), res.warnings[0]);
  });

  it('a failing index and a failing compact are two warnings, never a block', () => {
    readyKnowledge(fix.project);
    writeFile(fix.project, '.leeway/manifest.json', '{ not json');

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.indexed, false);
    assert.strictEqual(res.compacted, false);
    assert.strictEqual(res.warnings.length, 2);
    assert.match(res.warnings[0], /^knowledge index failed: manifest read failed: /);
    assert.match(res.warnings[1], /^knowledge compact failed: /);
  });

  it('a failing migrate.cjs is a hard error — ok false, stderr detail, exit 1', () => {
    readyKnowledge(fix.project);
    completedDiscussion(fix.project, '# Payments\n\nCards ship first.\n');
    const knowledge = path.join(fix.project, '.leeway/.knowledge');
    const before = Object.fromEntries(fs.readdirSync(knowledge).map((f) => [f, fs.readFileSync(path.join(knowledge, f), 'utf8')]));

    const err = runEngineFails(stubbed, fix.project, ['boot'], { STUB_MIGRATE_MODE: 'fail' });

    assert.match(err.error, /migrate\.cjs failed/);
    assert.match(err.error, /never half-run silently/);
    assert.match(err.error, /boom: migration 099 exploded/);
    // The knowledge legs never ran: a ready store with a completed
    // discussion awaiting its index is left exactly as it stood.
    const after = Object.fromEntries(fs.readdirSync(knowledge).map((f) => [f, fs.readFileSync(path.join(knowledge, f), 'utf8')]));
    assert.deepStrictEqual(after, before);
    assert.deepStrictEqual(harness.indexedFiles(fix.project), []);
  });
});

describe('engine boot: no worktree include', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('writes none — a project without one stays without one, and the user\'s own is left as it was', () => {
    const include = path.join(fix.project, '.worktreeinclude');
    const head = git(fix.project, ['rev-parse', 'HEAD']).trim();

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual('worktree_include_installed' in res, false);
    assert.strictEqual(fs.existsSync(include), false);
    writeFile(fix.project, '.worktreeinclude', '# local env\n.env\n');
    runEngine(stubbed, fix.project, ['boot']);
    assert.strictEqual(fs.readFileSync(include, 'utf8'), '# local env\n.env\n');
    assert.strictEqual(git(fix.project, ['rev-parse', 'HEAD']).trim(), head, 'and commits nothing on the code branch');
  });
});

describe('engine boot: the conversation folders', () => {
  let fix;
  let config;
  beforeEach(() => {
    fix = setupFixture();
    config = path.join(fix.root, 'config');
  });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  const folder = (/** @type {string} */ id) => path.join(config, 'conversations', id);

  /** A conversation's folder holding `files`, by name. */
  function conversation(/** @type {string} */ id, /** @type {Record<string, string>} */ files) {
    for (const [name, content] of Object.entries(files)) writeFile(folder(id), name, content);
  }

  /** Boot in `project`, the system config directory this test's own. */
  const boot = (/** @type {string} */ project, env = {}) => runEngine(stubbed, project, ['boot'], { WORKFLOWS_CONFIG_DIR: config, ...env });

  /** The path of `id`'s transcript in project folder `key` of this test's own directory of Claude Code projects. */
  const transcriptPath = (/** @type {string} */ key, /** @type {string} */ id) => path.join(fix.root, 'projects', key, `${id}.jsonl`);

  /** `id`'s transcript, made in project folder `key`. */
  function transcript(/** @type {string} */ key, /** @type {string} */ id) {
    const file = transcriptPath(key, id);
    writeFile(path.dirname(file), path.basename(file), '');
    return file;
  }

  it('deletes each folder whose transcript is gone, whatever it holds — one whose transcript is there, or that names none, stays', () => {
    const live = transcript('app', 'live');
    conversation('gone', { workflow: '', transcript: transcriptPath('app', 'gone'), 'position.json': '{"name":"pay"}', 'gate.json': 'null' });
    conversation('live', { workflow: '', transcript: live });
    conversation('unnamed', { workflow: '' });

    boot(fix.project);

    assert.ok(!fs.existsSync(folder('gone')));
    assert.deepStrictEqual(fs.readdirSync(folder('live')).sort(), ['transcript', 'workflow']);
    assert.deepStrictEqual(fs.readdirSync(folder('unnamed')), ['workflow']);
  });

  it('a boot in any project tidies every conversation\'s folder, whichever project marked it — the transcript found by its name, whichever project folder the hook named', () => {
    // Resumed from another checkout, the conversation ends with a path under
    // that checkout's key, while its transcript stays where it began.
    const file = transcript('app', 'sess-1');
    const env = { WORKFLOWS_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'sess-1' };
    runEngine(stubbed, fix.project, ['session', 'repair'], env);
    stubbed.ok(fix.project, ['conversation', 'end'], { env, stdin: JSON.stringify({ session_id: 'sess-1', transcript_path: transcriptPath('app-wt', 'sess-1') }) });
    assert.deepStrictEqual(fs.readdirSync(folder('sess-1')).sort(), ['transcript', 'workflow']);

    const other = setupProject(path.join(fix.root, 'other'));
    boot(other);
    assert.ok(fs.existsSync(folder('sess-1')), 'kept while its transcript is there');

    fs.unlinkSync(file);
    boot(other);
    assert.ok(!fs.existsSync(folder('sess-1')));
  });

  it('the boot\'s own conversation is marked after the tidy — a folder the tidy takes comes back holding the mark', () => {
    conversation('sess-1', { workflow: '', transcript: transcriptPath('app', 'sess-1') });

    boot(fix.project, { CLAUDE_CODE_SESSION_ID: 'sess-1' });

    assert.deepStrictEqual(fs.readdirSync(folder('sess-1')), ['workflow']);
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
    writeFile(fix.project, '.leeway/manifest.json', JSON.stringify({ work_units: { payments: { work_type: 'feature' } } }, null, 2) + '\n');
    writeFile(fix.project, '.leeway/payments/manifest.json', JSON.stringify({
      name: 'payments', work_type: 'feature', status: 'in-progress', created: '2026-01-01',
      phases: { discussion: { items: { payments: { status: 'completed' } } } },
    }, null, 2) + '\n');
    writeFile(fix.project, '.leeway/payments/discussion/payments.md', '# Payments\n\n## Card first\n\nCards ship first; wallets follow.\n');
    commitAll(fix.project, 'the project');
    // This checkout is set up — its local knowledge config — with no store.
    writeFile(fix.project, CONFIG, '{ "knowledge": {} }\n');
  });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  const bootWith = (systemConfig, extra = {}) => {
    if (systemConfig !== null) writeFile(sysDir, 'config.json', JSON.stringify(systemConfig));
    return runEngine(stubbed, fix.project, ['boot'], { WORKFLOWS_CONFIG_DIR: sysDir, ...extra });
  };
  const CONFIG = STORE_FILES[2];
  const storePath = () => path.join(fix.project, STORE_FILES[0]);
  const metadata = () => JSON.parse(fs.readFileSync(path.join(fix.project, STORE_FILES[1]), 'utf8'));

  it('a provider whose key resolves builds the store by keyword, out of git, and hands its vectors to the fill', (t) => {
    const launched = recordStubbedLaunches(t);
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
    assert.strictEqual(store.chunksWithoutVector(store.loadStore(storePath())).length, 1, 'its vector awaits the fill');
    assert.deepStrictEqual(launched, [path.join(fix.project, '.leeway')]);
    assert.strictEqual(git(fix.project, ['rev-parse', 'HEAD']).trim(), head, 'the build commits nothing');
    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'the project', 'on either side');
    assert.strictEqual(stateGit(fix.project, ['ls-files', '--', '.knowledge']).trim(), '');
  });

  it('boot never waits on embedding: an endpoint that never answers is never asked', async (t) => {
    const launched = recordStubbedLaunches(t);
    let requests = 0;
    const silent = require('http').createServer(() => { requests += 1; });
    await new Promise((resolve) => silent.listen(0, '127.0.0.1', () => resolve(undefined)));
    const { port } = /** @type {import('net').AddressInfo} */ (silent.address());
    try {
      const res = bootWith({ knowledge: { provider: 'openai-compatible', base_url: `http://127.0.0.1:${port}/v1`, model: 'm', dimensions: 8 } });

      assert.strictEqual(res.knowledge, 'ready');
      assert.strictEqual(res.indexed, true);
      assert.deepStrictEqual(res.warnings, []);
      assert.strictEqual(requests, 0);
      assert.strictEqual(metadata().provider, 'openai-compatible', 'the store is built, its vectors awaited');
      assert.deepStrictEqual(launched, [path.join(fix.project, '.leeway')]);
    } finally {
      silent.closeAllConnections();
      await new Promise((resolve) => silent.close(() => resolve(undefined)));
    }
  });

  it('a store whose provider key does not resolve warns naming the key, and launches no fill', (t) => {
    const launched = recordStubbedLaunches(t);
    const openai = { provider: 'openai', model: 'text-embedding-3-small', dimensions: 8 };
    store.saveStore(store.createStore(), storePath());
    store.writeMetadata(path.join(fix.project, STORE_FILES[1]), { ...openai, last_indexed: null });
    writeFile(fix.project, CONFIG, JSON.stringify({ knowledge: openai }));

    const res = bootWith(null);

    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.indexed, true);
    assert.deepStrictEqual(res.warnings, [
      'knowledge vectors wait: the openai API key could not be resolved; export OPENAI_API_KEY, or run node .claude/skills/workflow-engine/scripts/engine.cjs knowledge setup --key-only',
    ]);
    assert.deepStrictEqual(harness.indexedFiles(fix.project), ['payments/discussion/payments.md'], 'the keyword side still lands');
    assert.deepStrictEqual(launched, []);
  });

  it('a vector fill that fell short is the next start\'s warning — and the fill goes again', (t) => {
    const launched = recordStubbedLaunches(t);
    bootWith({ knowledge: { provider: 'stub', dimensions: 8 } });
    store.writeMetadata(path.join(fix.project, STORE_FILES[1]), { ...metadata(), fill_failure: 'payments/discussion/payments.md: out of quota' });

    const res = bootWith({ knowledge: { provider: 'stub', dimensions: 8 } });

    assert.deepStrictEqual(res.warnings, ['knowledge vector fill fell short: payments/discussion/payments.md: out of quota']);
    assert.deepStrictEqual(launched, [path.join(fix.project, '.leeway'), path.join(fix.project, '.leeway')]);
  });

  it('a fill\'s shortfall stays quiet once nothing awaits a vector — its chunks since retired', (t) => {
    recordStubbedLaunches(t);
    writeFile(fix.project, CONFIG, '{ "knowledge": { "provider": null } }\n');
    bootWith(null);
    store.writeMetadata(path.join(fix.project, STORE_FILES[1]), { ...metadata(), fill_failure: 'payments/discussion/payments.md: out of quota' });
    const unit = path.join(fix.project, '.leeway/payments/manifest.json');
    fs.writeFileSync(unit, JSON.stringify({ ...JSON.parse(fs.readFileSync(unit, 'utf8')), status: 'cancelled' }));

    const res = bootWith(null);

    assert.deepStrictEqual(res.warnings, []);
    assert.doesNotMatch(harness.output(fix.project, ['knowledge', 'status']), /fell short/);
  });

  it('a metadata file that does not parse is a warning, never a block', () => {
    writeFile(fix.project, CONFIG, '{ "knowledge": { "provider": null } }\n');
    bootWith(null);
    writeFile(fix.project, STORE_FILES[1], '{ not json');

    const res = bootWith(null);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.knowledge, 'ready');
    assert.ok(res.warnings.length > 0);
    for (const warning of res.warnings) assert.match(warning, /^knowledge .* failed: readMetadata: invalid JSON at /);
  });

  it('a keyword-only store launches no fill', (t) => {
    const launched = recordStubbedLaunches(t);
    writeFile(fix.project, CONFIG, '{ "knowledge": { "provider": null } }\n');

    const res = bootWith(null);

    assert.strictEqual(res.knowledge, 'ready');
    assert.deepStrictEqual(launched, []);
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
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/.knowledge')));
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
    writeSystemConfig(JSON.stringify({ editor: { theme: 'dark' } }));
    const res = runEngine(stubbed, fix.project, ['boot'], underHome());
    assert.deepStrictEqual(res.system_config, { status: 'absent', provider: null, model: null });
  });

  it('ready responses carry no system_config field', () => {
    writeSystemConfig(JSON.stringify({ knowledge: { provider: 'openai', model: 'm' } }));
    readyKnowledge(fix.project);

    const res = runEngine(stubbed, fix.project, ['boot'], underHome());

    assert.strictEqual(res.knowledge, 'ready');
    assert.ok(!('system_config' in res));
  });
});

describe('engine boot: the project\'s session hooks, and the gate mod', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  /** Stamp the label choice on the project manifest and commit it, so boot's only new dirt is its own. */
  function recordChoice(value) {
    writeFile(fix.project, '.leeway/manifest.json', JSON.stringify({ defaults: { tmux_labels: value } }, null, 2) + '\n');
    commitAll(fix.project, 'record the defaults');
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
  function bootWith({ tmux = false, holdSettings = false, env: extra = {} } = {}) {
    const env = {
      ...extra,
      TMUX: tmux ? '/fake/sock,123,7' : undefined,
      WORKFLOWS_HOLD_PROJECT_SETTINGS: holdSettings ? '1' : undefined,
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

  it('drops the calling conversation\'s own position, labels off, and leaves another\'s — the start menu is no position', () => {
    recordChoice(false);
    const config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-config-'));
    try {
      const as = (id) => ({ WORKFLOWS_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: id });
      const positionOf = (id) => path.join(config, 'conversations', id, 'position.json');
      for (const id of ['sess-1', 'sess-2']) runEngine(stubbed, fix.project, ['session', 'label', 'payments', 'discussion', 'payments'], as(id));
      assert.ok(fs.existsSync(positionOf('sess-1')) && fs.existsSync(positionOf('sess-2')));
      assert.strictEqual(bootWith({ env: as('sess-1') }).label_repaired, false);
      assert.ok(!fs.existsSync(positionOf('sess-1')), 'boot took the calling conversation\'s own off');
      assert.ok(fs.existsSync(positionOf('sess-2')), 'and left another\'s');
    } finally {
      fs.rmSync(config, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('drops the calling conversation\'s own position before its migrations run — a boot that fails leaves none', () => {
    const config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-config-'));
    try {
      const as = { WORKFLOWS_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'sess-1' };
      const position = path.join(config, 'conversations', 'sess-1', 'position.json');
      runEngine(stubbed, fix.project, ['session', 'label', 'payments', 'discussion', 'payments'], as);
      assert.ok(fs.existsSync(position));
      assert.match(runEngineFails(stubbed, fix.project, ['boot'], { ...as, STUB_MIGRATE_MODE: 'fail' }).error, /migrate\.cjs failed/);
      assert.ok(!fs.existsSync(position), 'the failed boot left no position');
    } finally {
      fs.rmSync(config, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('a boot from inside the state worktree installs into the main checkout — its settings, committed on its branch — and the state branch gains nothing', () => {
    dropSettings();
    const state = path.join(fix.project, '.leeway');
    const stateHead = stateGit(fix.project, ['rev-parse', 'HEAD']).trim();

    const res = runEngine(stubbed, state, ['boot']);

    assert.strictEqual(res.session_hooks_installed, true);
    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8'), hooked(WORKFLOW_HOOKS));
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s', 'main']).trim(), 'chore: install workflow session hooks');
    assert.deepStrictEqual(git(fix.project, ['show', '--name-only', '--pretty=format:', 'main']).trim().split('\n'), ['.claude/settings.json']);
    assert.strictEqual(stateGit(fix.project, ['rev-parse', 'HEAD']).trim(), stateHead, 'no commit on leeway-state');
    assert.strictEqual(fs.existsSync(path.join(state, '.claude')), false);
    assert.strictEqual(fs.existsSync(path.join(state, '.worktreeinclude')), false);
    assert.strictEqual(stateGit(fix.project, ['status', '--porcelain']), '', 'nothing written into the state worktree');
  });

  it('a project with no settings gets the workflows\' own hooks installed — `presence cleanup` and `conversation end` — committed confined, and a second boot changes nothing', () => {
    dropSettings();
    const first = bootWith();
    assert.strictEqual(first.session_hooks_installed, true);
    assert.deepStrictEqual(first.warnings, []);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8'), hooked(WORKFLOW_HOOKS));
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'chore: install workflow session hooks');
    assert.deepStrictEqual(git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n'), ['.claude/settings.json']);
    const head = git(fix.project, ['rev-parse', 'HEAD']);

    const second = bootWith();
    assert.strictEqual(second.session_hooks_installed, false);
    assert.strictEqual(git(fix.project, ['rev-parse', 'HEAD']), head, 'nothing new to commit');
    assert.strictEqual(git(fix.project, ['status', '--porcelain', '--', '.claude', '.leeway']).trim(), '', 'and no new dirt');
  });

  it('labels on adds `session cleanup` beside the workflows\' own, in one group, and a SessionStart `session resume` matched to resume — one commit', () => {
    recordChoice(true);
    const res = bootWith();
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8'), LABELS_ON);
    assert.deepStrictEqual(git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n'), ['.claude/settings.json']);
    assert.strictEqual(bootWith().session_hooks_installed, false);
  });

  it('labels off wants the workflows\' own alone — a `session cleanup` and a `session resume` left behind come back out', () => {
    recordChoice(false);
    commitSettings(LABELS_ON);
    const res = bootWith();
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8'), hooked(WORKFLOW_HOOKS));
  });

  it('labels never asked wants the workflows\' own alone too — stale label hooks come back out', () => {
    assert.strictEqual(bootWith().session_hooks_installed, false, 'the fixture already carries it');
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/manifest.json')), 'no choice recorded');
    commitSettings(LABELS_ON);
    const res = bootWith();
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8'), hooked(WORKFLOW_HOOKS));
  });

  it('the hook sync waits on a live writer lock — the opt-in read and the write are one hold', async () => {
    dropSettings();
    // Held by this test's own process: alive, and never the child's.
    const lock = path.join(fix.project, '.leeway', '.lock');
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, pid_start: processStartTime(process.pid) }));
    const env = { ...process.env };
    delete env.TMUX;
    delete env.WORKFLOWS_HOLD_PROJECT_SETTINGS;
    const child = spawn('node', [STUB_ENGINE, 'boot'], { cwd: fix.project, env });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    // 'close', not 'exit': stdout must be fully flushed before it is parsed.
    const exit = new Promise((resolve) => child.on('close', resolve));

    const raced = await Promise.race([exit.then(() => 'exited'), sleep(1500).then(() => 'waiting')]);
    assert.strictEqual(raced, 'waiting', 'boot must wait on a live writer lock');
    assert.ok(!fs.existsSync(path.join(fix.project, '.claude/settings.json')), 'no settings write while the lock is held');

    fs.unlinkSync(lock);
    assert.strictEqual(await exit, 0);
    const res = JSON.parse(stdout.trim());
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8'), hooked(WORKFLOW_HOOKS));
  });

  it('installs into existing settings without disturbing them', () => {
    commitSettings(JSON.stringify({ permissions: { allow: ['Bash(ls)'] } }, null, 2) + '\n');
    assert.strictEqual(bootWith().session_hooks_installed, true);
    assert.deepStrictEqual(settings(), {
      permissions: { allow: ['Bash(ls)'] },
      hooks: { SessionEnd: [{ hooks: WORKFLOW_HOOKS }] },
    });
  });

  it('WORKFLOWS_HOLD_PROJECT_SETTINGS=1 — the test harness\'s switch — never touches settings, labels on or off', () => {
    dropSettings();
    assert.strictEqual(bootWith({ holdSettings: true }).session_hooks_installed, false);
    assert.ok(!fs.existsSync(path.join(fix.project, '.claude/settings.json')));
    recordChoice(true);
    assert.strictEqual(bootWith({ holdSettings: true }).session_hooks_installed, false);
    assert.ok(!fs.existsSync(path.join(fix.project, '.claude/settings.json')));
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'no settings', 'no commit of boot\'s');
    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'record the defaults', 'no commit of boot\'s');
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

  /** The fixture's own settings, as boot leaves every project. */
  const HOOKS_ONLY = { hooks: { SessionEnd: [{ hooks: WORKFLOW_HOOKS }] } };
  /** @param {object} value */
  const json = (value) => JSON.stringify(value, null, 2) + '\n';
  /** Claude Code's terminal app, at the oldest version the mod runs on. */
  const TERMINAL = { CLAUDE_CODE_ENTRYPOINT: 'cli', AI_AGENT: 'claude-code_2-1-287_agent', CLAUDE_CODE_REMOTE: undefined };
  /** HEAD's subject and the sorted paths it touched. */
  function head() {
    return {
      subject: git(fix.project, ['log', '-1', '--pretty=%s']).trim(),
      files: git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean).sort(),
    };
  }
  /** Install the mod where an install puts it, committed, so boot's commits are the only new ones. */
  function installMod() {
    writeFile(fix.project, '.claude/skills/workflow-gates/.claude-plugin/plugin.json', '{"name":"workflow-gates"}\n');
    commitAll(fix.project, 'install the mod');
  }
  /** The fixture's Claude Code config directory, and a home holding no `.claude` — neither made unless a test makes it. */
  const claudeDir = () => path.join(fix.root, 'claude-config');
  const homeDir = () => path.join(fix.root, 'home');
  const userSettingsFile = () => path.join(claudeDir(), 'settings.json');
  const projectSettingsText = () => fs.readFileSync(path.join(fix.project, '.claude/settings.json'), 'utf8');
  /** Boot in the terminal app under the fixture's Claude Code config and home, `env` layered over it. */
  const bootTerminal = (env = {}) => bootWith({ env: { ...TERMINAL, CLAUDE_CONFIG_DIR: claudeDir(), HOME: homeDir(), ...env } });

  it('where the mod can run and is not running, boot reports not-running and writes no Claude Code settings — the user\'s file stays absent, the project untouched, nothing committed', () => {
    installMod();
    const project = projectSettingsText();
    for (const configDir of [claudeDir(), undefined]) {
      const res = bootTerminal({ CLAUDE_CONFIG_DIR: configDir });
      assert.strictEqual(res.gate_surface, 'not-running', String(configDir));
      assert.deepStrictEqual(res.warnings, []);
    }
    assert.ok(!fs.existsSync(claudeDir()), 'the config directory not made');
    assert.ok(!fs.existsSync(homeDir()), 'nor ~/.claude');
    assert.strictEqual(projectSettingsText(), project);
    assert.strictEqual(head().subject, 'install the mod', 'no commit of boot\'s');
    assert.strictEqual(git(fix.project, ['status', '--porcelain']).trim(), '');
  });

  it('a user settings file is left byte-for-byte as found, whatever it holds — a function-hooks flag of any value, or a file that does not parse', () => {
    installMod();
    const contents = [
      '{"env":{"CLAUDE_CODE_ENABLE_FUNCTION_HOOKS":"1"}}',
      '{"model":"opus","env":{"CLAUDE_CODE_ENABLE_FUNCTION_HOOKS":"0","EDITOR":"vim"}}\n',
      '{not json',
    ];
    for (const content of contents) {
      writeFile(claudeDir(), 'settings.json', content);
      fs.chmodSync(userSettingsFile(), 0o600);
      const before = fs.statSync(userSettingsFile());
      const res = bootTerminal();
      assert.strictEqual(res.gate_surface, 'not-running', content);
      assert.deepStrictEqual(res.warnings, [], content);
      assert.strictEqual(fs.readFileSync(userSettingsFile(), 'utf8'), content);
      const after = fs.statSync(userSettingsFile());
      assert.strictEqual(after.mtimeMs, before.mtimeMs, `${content}: never rewritten`);
      assert.strictEqual(after.mode & 0o777, 0o600);
    }
  });

  it('the mod announced in boot\'s environment reports on — only `1` is the announcement', () => {
    installMod();
    assert.strictEqual(bootTerminal({ WORKFLOWS_GATE_SURFACE: '1' }).gate_surface, 'on');
    assert.strictEqual(bootTerminal({ WORKFLOWS_GATE_SURFACE: '0' }).gate_surface, 'not-running');
    assert.ok(!fs.existsSync(claudeDir()), 'nothing made either way');
  });

  it('a readable release before 2.1.287 reports outdated — announced or not — and touches no file', () => {
    installMod();
    for (const version of ['2-1-286', '2-1-282', '2-0-999', '1-9-999']) {
      const res = bootTerminal({ AI_AGENT: `claude-code_${version}_agent` });
      assert.strictEqual(res.gate_surface, 'outdated', version);
    }
    assert.strictEqual(bootTerminal({ AI_AGENT: 'claude-code_2-1-286_agent', WORKFLOWS_GATE_SURFACE: '1' }).gate_surface, 'outdated');
    assert.ok(!fs.existsSync(claudeDir()), 'nothing made');
    assert.ok(!fs.existsSync(homeDir()), 'nor ~/.claude');
  });

  it('every version from 2.1.287 on is one the mod runs on', () => {
    installMod();
    for (const version of ['2-1-287', '2-1-300', '2-2-0', '3-0-0']) {
      assert.strictEqual(bootTerminal({ AI_AGENT: `claude-code_${version}_agent` }).gate_surface, 'not-running', version);
      assert.strictEqual(bootTerminal({ AI_AGENT: `claude-code_${version}_agent`, WORKFLOWS_GATE_SURFACE: '1' }).gate_surface, 'on', version);
    }
  });

  it('the Desktop app\'s Code tab is where the mod runs too — on Anthropic\'s API or a third-party provider: on, not-running, outdated, touching no file', () => {
    installMod();
    for (const entrypoint of ['claude-desktop', 'claude-desktop-3p']) {
      const desktop = { CLAUDE_CODE_ENTRYPOINT: entrypoint };
      assert.strictEqual(bootTerminal(desktop).gate_surface, 'not-running', entrypoint);
      assert.strictEqual(bootTerminal({ ...desktop, WORKFLOWS_GATE_SURFACE: '1' }).gate_surface, 'on', entrypoint);
      assert.strictEqual(bootTerminal({ ...desktop, AI_AGENT: 'claude-code_2-1-286_agent' }).gate_surface, 'outdated', entrypoint);
    }
    assert.ok(!fs.existsSync(claudeDir()), 'nothing made');
    assert.ok(!fs.existsSync(homeDir()), 'nor ~/.claude');
    assert.strictEqual(head().subject, 'install the mod', 'no commit of boot\'s');
  });

  it('where the mod cannot run, boot touches no file and reports unavailable', () => {
    const old = { AI_AGENT: 'claude-code_2-1-286_agent' };
    assert.strictEqual(bootTerminal().gate_surface, 'unavailable', 'the mod not installed in the project');
    assert.strictEqual(bootTerminal(old).gate_surface, 'unavailable', 'the mod not installed, whatever the version');
    installMod();
    const elsewhere = [
      ['Claude Code on the web', { CLAUDE_CODE_REMOTE: 'true' }],
      ['on the web at an older release', { CLAUDE_CODE_REMOTE: 'true', ...old }],
      ['the VS Code extension', { CLAUDE_CODE_ENTRYPOINT: 'claude-vscode' }],
      ['the VS Code extension, announced', { CLAUDE_CODE_ENTRYPOINT: 'claude-vscode', WORKFLOWS_GATE_SURFACE: '1' }],
      ['a Desktop cloud session', { CLAUDE_CODE_ENTRYPOINT: 'remote_desktop' }],
      ['a Desktop cloud session, flagged remote', { CLAUDE_CODE_ENTRYPOINT: 'remote_desktop', CLAUDE_CODE_REMOTE: 'true' }],
      ['the Desktop app on the web', { CLAUDE_CODE_ENTRYPOINT: 'claude-desktop', CLAUDE_CODE_REMOTE: 'true' }],
      ['another entrypoint', { CLAUDE_CODE_ENTRYPOINT: 'sdk-cli' }],
      ['no entrypoint', { CLAUDE_CODE_ENTRYPOINT: undefined }],
      ['no version', { AI_AGENT: undefined }],
      ['a version that does not parse', { AI_AGENT: 'claude-code_2-1_agent' }],
      ['an identity in another shape', { AI_AGENT: 'claude-code_2-1-300_sdk' }],
      ['another agent', { AI_AGENT: 'cursor' }],
    ];
    for (const [where, env] of elsewhere) {
      const res = bootTerminal(env);
      assert.strictEqual(res.gate_surface, 'unavailable', where);
    }
    assert.ok(!fs.existsSync(claudeDir()), 'nothing made');
    assert.strictEqual(head().subject, 'install the mod', 'no commit of boot\'s');
  });

  it('the harness switch holds the project\'s settings file alone — the gate surface reports as it would without it', () => {
    installMod();
    dropSettings();
    for (const [version, status] of [['2-1-287', 'not-running'], ['2-1-286', 'outdated']]) {
      const res = bootWith({ holdSettings: true, env: { ...TERMINAL, CLAUDE_CONFIG_DIR: claudeDir(), HOME: homeDir(), AI_AGENT: `claude-code_${version}_agent` } });
      assert.strictEqual(res.gate_surface, status, version);
      assert.strictEqual(res.session_hooks_installed, false);
    }
    assert.ok(!fs.existsSync(path.join(fix.project, '.claude/settings.json')), 'the project\'s settings held');
    assert.ok(!fs.existsSync(claudeDir()));
    assert.strictEqual(head().subject, 'no settings', 'no commit of boot\'s');
  });

  it('a flag in the project\'s settings is neither read nor written — the mod\'s own announcement alone decides', () => {
    installMod();
    for (const value of ['1', '0']) {
      const project = json({ ...HOOKS_ONLY, env: { [FLAG]: value } });
      commitSettings(project);
      assert.strictEqual(bootTerminal().gate_surface, 'not-running', `a project flag of ${value}`);
      assert.strictEqual(bootTerminal({ WORKFLOWS_GATE_SURFACE: '1' }).gate_surface, 'on', `a project flag of ${value}`);
      assert.strictEqual(projectSettingsText(), project, 'left as found');
    }
  });

  it('a hook sync in a boot where the mod can run — the project commit carries the hooks alone', () => {
    installMod();
    dropSettings();
    const res = bootTerminal();
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(res.gate_surface, 'not-running');
    assert.strictEqual(projectSettingsText(), hooked(WORKFLOW_HOOKS));
    assert.deepStrictEqual(head(), { subject: 'chore: install workflow session hooks', files: ['.claude/settings.json'] });
  });

  it('a project settings file the hook sync rewrites keeps its permission mode', () => {
    for (const mode of [0o600, 0o644]) {
      commitSettings(json({ model: 'opus' }));
      fs.chmodSync(path.join(fix.project, '.claude/settings.json'), mode);
      assert.strictEqual(bootWith().session_hooks_installed, true, mode.toString(8));
      assert.strictEqual(projectSettingsText(), json({ model: 'opus', ...HOOKS_ONLY }));
      assert.strictEqual(fs.statSync(path.join(fix.project, '.claude/settings.json')).mode & 0o777, mode, mode.toString(8));
    }
  });

  it('a symlinked project settings file gets the hooks at the file it names — the link stands, an existing target or one not yet made', () => {
    const link = path.join(fix.project, '.claude/settings.json');
    const permissions = { allow: ['Bash(ls)'] };
    for (const [name, before, after] of [
      ['shared-settings.json', json({ permissions }), json({ permissions, ...HOOKS_ONLY })],
      ['fresh-settings.json', null, hooked(WORKFLOW_HOOKS)],
    ]) {
      const target = path.join(fix.root, 'shared', name);
      if (before !== null) writeFile(fix.root, `shared/${name}`, before);
      fs.rmSync(link, { force: true });
      fs.symlinkSync(target, link);
      const res = bootWith();
      assert.strictEqual(res.session_hooks_installed, true, name);
      assert.deepStrictEqual(res.warnings, [], name);
      assert.ok(fs.lstatSync(link).isSymbolicLink(), `${name}: still a link`);
      assert.strictEqual(fs.readlinkSync(link), target, name);
      assert.strictEqual(fs.readFileSync(target, 'utf8'), after, name);
    }
  });

  it('a session-hooks commit git refuses is a warning, never a block — the hooks are on disk', () => {
    dropSettings();
    writeFile(fix.project, '.git/hooks/pre-commit', '#!/bin/sh\nexit 1\n');
    fs.chmodSync(path.join(fix.project, '.git/hooks/pre-commit'), 0o755);
    const res = bootWith();
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^project settings commit failed: /);
    assert.strictEqual(projectSettingsText(), hooked(WORKFLOW_HOOKS));
    assert.strictEqual(head().subject, 'no settings', 'nothing landed');
  });
});

describe('engine boot (real scripts)', () => {
  let root;
  let project;
  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-real-')));
    project = setupProject(root);
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('runs the real migrate.cjs and knowledge base against an isolated project', () => {
    const settingsBefore = fs.readFileSync(path.join(project, '.claude/settings.json'), 'utf8');
    const codeHead = git(project, ['rev-parse', 'HEAD']).trim();
    const first = runEngine(real, project, ['boot']);
    assert.strictEqual(first.ok, true);
    assert.strictEqual(first.migrations.changed, false);
    assert.strictEqual(typeof first.migrations.output, 'string');
    assert.deepStrictEqual(first.migrations.verify, []);
    assert.deepStrictEqual(first.migrations.notices, []);
    // The trimmed report never leaks the prose stop-gate lines or the machine blocks.
    assert.ok(!first.migrations.output.includes('STOP_GATE'));
    assert.ok(!first.migrations.output.includes('VERIFY_ADDENDA'));
    assert.ok(!first.migrations.output.includes('MIGRATIONS_RUN'));
    // The code-tree fleet has no `.workflows/` to upgrade: every one is
    // recorded unrun, none creates the folder, and the settings stay as found.
    assert.strictEqual(first.migrations.ran, 0);
    const fleet = fs.readdirSync(path.join(REAL_ENGINE_SKILL, '..', 'workflow-migrate/scripts/migrations'))
      .map((f) => (f.match(/^[0-9]+/) || [''])[0]).filter(Boolean).sort();
    assert.deepStrictEqual(fs.readFileSync(path.join(project, '.leeway/.state/migrations'), 'utf8').trim().split('\n').sort(), fleet);
    assert.ok(!fs.existsSync(path.join(project, '.workflows')), 'no legacy state folder made from nothing');
    assert.strictEqual(fs.readFileSync(path.join(project, '.claude/settings.json'), 'utf8'), settingsBefore);
    // The ledger, the only dirt, committed on the state branch — the code
    // branch takes none of it.
    assert.strictEqual(first.migrations_committed, stateGit(project, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(stateGit(project, ['log', '-1', '--pretty=%s']).trim(), 'chore: record workflow migrations');
    assert.strictEqual(git(project, ['rev-parse', 'HEAD']).trim(), codeHead);
    // No knowledge store in the fixture — the hard stop: nothing is created.
    assert.strictEqual(first.knowledge, 'not-ready');
    assert.strictEqual(first.indexed, false);
    assert.strictEqual(first.compacted, false);
    assert.ok(!fs.existsSync(path.join(project, '.leeway/.knowledge')));

    // The user runs knowledge setup outside the session — simulated here by
    // writing what setup writes: a keyword-only config and a real store file
    // the readiness check loads.
    writeFile(project, '.leeway/.knowledge/config.json', '{"knowledge":{}}\n');
    writeFile(project, '.leeway/.knowledge/metadata.json', '{"provider":null}\n');
    store.saveStore(store.createStore(), path.join(project, '.leeway/.knowledge/store.bin'));

    // …and the restart's boot finds the store ready and leaves the whole
    // directory out of git: the state's own ignore rule keeps it out.
    const second = runEngine(real, project, ['boot']);
    assert.strictEqual(second.ok, true);
    assert.strictEqual(second.migrations.changed, false);
    assert.strictEqual(second.migrations.ran, 0);
    assert.strictEqual(second.migrations_committed, null);
    assert.strictEqual(second.knowledge, 'ready');
    assert.strictEqual(second.indexed, true);
    assert.strictEqual(second.compacted, true);
    assert.strictEqual(stateGit(project, ['status', '--porcelain', '--untracked-files=all', '--', '.knowledge']).trim(), '');

    // Third boot: nothing new to commit, the ledger included — an index and
    // a compact with nothing to do write nothing.
    const third = runEngine(real, project, ['boot']);
    assert.strictEqual(third.knowledge, 'ready');
    assert.deepStrictEqual(third.warnings, []);
    assert.strictEqual(third.migrations_committed, null);
  });

  it('a project carrying the function-hooks flag the workflows wrote has it taken out by the migrations, the hook sync beside it — boot commits neither, and the reviewed migration commit records both', () => {
    legacyLayout(project);
    writeFile(project, '.leeway/manifest.json', JSON.stringify({ defaults: { tmux_labels: true } }, null, 2) + '\n');
    writeFile(project, '.claude/settings.json', JSON.stringify({ hooks: { SessionEnd: [{ hooks: WORKFLOW_HOOKS }] }, env: { [FLAG]: '1' } }, null, 2) + '\n');
    commitAll(project, 'labels on, the flag in the project');
    const before = git(project, ['rev-parse', 'HEAD']).trim();

    const res = runEngine(real, project, ['boot']);

    assert.strictEqual(res.migrations.changed, true, 'the review gate owns the commit');
    assert.strictEqual(res.session_hooks_installed, true);
    assert.strictEqual(git(project, ['rev-parse', 'HEAD']).trim(), before, 'boot commits none of it');
    const migrated = fs.readFileSync(path.join(project, '.claude/settings.json'), 'utf8');
    assert.ok(!('env' in JSON.parse(migrated)), 'the flag out, and env with it');
    assert.deepStrictEqual(JSON.parse(migrated).hooks, JSON.parse(LABELS_ON).hooks, 'the label hooks in');

    runEngine(real, project, ['commit', '--migrations', '-m', 'chore: apply workflow migrations']);

    assert.strictEqual(git(project, ['show', 'HEAD:.claude/settings.json']), migrated);
    assert.strictEqual(git(project, ['status', '--porcelain', '--', '.claude']).trim(), '');
  });
});

describe('engine boot verification addenda (real scripts)', () => {
  let root;
  let project;
  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-verify-')));
    project = setupProject(root);
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('carries an executed migration\'s checks in migrations.verify, stripped from the report', () => {
    legacyLayout(project);
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

  it('hands back 054\'s check and then 071\'s, naming the mailbox, where one boot runs both over a straggler 054 cannot convert', () => {
    legacyLayout(project);
    writeFile(project, '.workflows/payments/discussion/alpha.md',
      '# D\n\n## Triage:\n\n### Parked\n*From: x · discussion · d*\n\nBody.\n');

    const res = runEngine(real, project, ['boot']);

    assert.strictEqual(res.ok, true);
    const addenda = res.migrations.verify.filter((v) => v.id === '054' || v.id === '071');
    assert.deepStrictEqual(addenda.map((v) => v.id), ['054', '071'], JSON.stringify(res.migrations.verify));
    assert.ok(addenda[1].verify.includes('.workflows/{wu}/{phase}/.mailbox/{topic}/'), addenda[1].verify);
    assert.ok(addenda[1].verify.includes('Nothing goes into a .triage/ directory'), addenda[1].verify);
  });
});

describe('engine boot migration notices (real scripts)', () => {
  let root;
  let project;
  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-notices-')));
    project = setupProject(root);
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('tells the person of a plan-mode setting the project had committed, once', () => {
    legacyLayout(project);
    writeFile(project, '.claude/settings.json', hooked(WORKFLOW_HOOKS, { showClearContextOnPlanAccept: true }));
    git(project, ['commit', '-q', '-am', 'plan mode on']);

    const res = runEngine(real, project, ['boot']);

    assert.strictEqual(res.ok, true);
    assert.deepStrictEqual(res.migrations.notices.map((n) => n.id), ['067']);
    assert.match(res.migrations.notices[0].notice, /^Removed `showClearContextOnPlanAccept` from `\.claude\/settings\.json`/);
    assert.ok(!res.migrations.output.includes('MIGRATION_NOTICES'), 'plumbing stripped from the report');
    assert.strictEqual(res.migrations.changed, true);
    assert.ok(!('showClearContextOnPlanAccept' in JSON.parse(fs.readFileSync(path.join(project, '.claude/settings.json'), 'utf8'))));
    // Second boot: recorded — nothing re-fires.
    assert.deepStrictEqual(runEngine(real, project, ['boot']).migrations.notices, []);
  });
});

describe('engine commit --workflows', () => {
  let root;
  let project;
  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-commit-')));
    project = setupProject(root);
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('stages the whole state — many work units plus .state — and commits it on the state branch', () => {
    writeFile(project, '.leeway/payments/manifest.json', '{"name":"payments","v":2}\n');
    writeFile(project, '.leeway/auth-flow/manifest.json', '{"name":"auth-flow"}\n');
    writeFile(project, '.leeway/.state/migrations', '045\n');
    writeFile(project, 'unrelated.txt', 'outside the scope\n');

    const res = runEngine(real, project, ['commit', '--workflows', '-m', 'chore: apply workflow migrations']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.committed, stateGit(project, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(stateGit(project, ['log', '-1', '--pretty=%s']).trim(), 'chore: apply workflow migrations');
    // Everything in the state landed in the one commit, on the state branch…
    const show = stateGit(project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').sort();
    assert.deepStrictEqual(show, [
      '.state/migrations',
      'auth-flow/manifest.json',
      'payments/manifest.json',
    ]);
    assert.strictEqual(git(project, ['log', '-1', '--pretty=%s']).trim(), 'init', 'none on the code side');
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
