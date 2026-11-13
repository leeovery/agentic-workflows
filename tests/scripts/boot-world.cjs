'use strict';

// The world the boot suites share (test-engine-boot-*.cjs): the project
// fixture, a git repository with its state worktree and the workflows' own
// hooks in its settings, made once per process and copied (`bootProject`,
// `setupProject`); a real project on the layout before Leeway's, with no
// `.leeway/` (`legacyProject`); the library's stub engine, whose migration runner
// STUB_MIGRATE_MODE and its siblings drive (`stubbed`), and the repo's real
// scripts (`real`); the hooks boot installs, as settings read;
// a knowledge base that reads ready, a short record to index, and
// the vector fill's launches recorded; and the session-hook helpers over a
// describe's own fixture (`hookHelpers`).

require('./hermetic-env.cjs');

const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { git, commitAll, fixtureFrom, folderFrom, layout, statePath, writeState, engineHook, WORKFLOW_HOOKS, GUARD_GROUPS, hooked } = harness;
const { createFile } = require('./discovery-test-utils.cjs');
const store = require(path.join(path.dirname(harness.ENGINE), 'kernel/knowledge/store.cjs'));

// The function-hooks flag migration 065 takes out of a project's settings,
// and the session-label hooks boot adds where labels are on.
const FLAG = 'CLAUDE_CODE_ENABLE_FUNCTION_HOOKS';
const SESSION_HOOK = engineHook('session cleanup');
const RESUME_HOOK = engineHook('session resume');
/** The settings such a project reaches with labels on: every SessionEnd hook, the SessionStart resume hook, and the guard groups. */
const LABELS_ON = JSON.stringify({
  hooks: { SessionEnd: [{ hooks: [SESSION_HOOK, ...WORKFLOW_HOOKS] }], SessionStart: [{ matcher: 'resume', hooks: [RESUME_HOOK] }], PreToolUse: GUARD_GROUPS },
}, null, 2) + '\n';

/** The knowledge directory's files a checkout sets up, state-relative. */
const STORE_FILES = ['store.bin', 'metadata.json', 'config.json'].map((name) => layout.knowledge(name));

/**
 * A project fixture: a real git repo with its state worktree at `.leeway/`,
 * its settings already carrying the workflows' own hooks — the state every
 * booted project reaches, so boot's own plumbing commits never join the
 * history a test reads. A test about the install takes the hooks away first.
 * The gate mod is not installed, so boot reports it unavailable; a test
 * about the mod installs it. Made once per process, copied for each test.
 */
const projectWorld = fixtureFrom('engine-boot-project-', (project) => {
  writeState(project, layout.manifest('payments'), '{"name":"payments"}\n');
  createFile(project, '.claude/settings.json', hooked(WORKFLOW_HOOKS));
  commitAll(project, 'init');
});

/**
 * A project still on the layout before the state worktree: its `.workflows/`
 * in the code tree, committed there, for the legacy fleet to upgrade.
 * @param {string} project
 */
function legacyLayout(project) {
  createFile(project, '.workflows/payments/manifest.json', '{"name":"payments"}\n');
  git(project, ['add', '--', '.workflows']);
  git(project, ['commit', '-q', '-m', 'the old layout']);
}

/** The project fixture at `{root}/project`. @param {string} root */
function setupProject(root) {
  return projectWorld(path.join(root, 'project'));
}

/** The migrations a project at 070 had run, as its old record lists them. */
const MIGRATED_TO_070 = [...new Set(fs.readdirSync(path.join(path.dirname(harness.ENGINE), '../../leeway-migrate/scripts/migrations'))
  .filter((name) => /^[0-9]+-/.test(name) && !name.endsWith('.check.cjs'))
  .map((name) => name.slice(0, name.indexOf('-'))))].filter((id) => Number(id) <= 70).sort();

/**
 * A real project on the layout before Leeway's, no `.leeway/` in it: its
 * `.workflows/` committed on `main` as the chain up to 070 left it — its
 * cache ignored there, its old migrations record at 070, a roadmap item with
 * no kind, and a feature mid-discussion — beside the workflows' own hooks.
 */
const legacyWorld = folderFrom('engine-boot-legacy-', (folder) => {
  const project = harness.initRepo(path.join(folder, 'project'));
  createFile(project, 'README.md', '# Project\n');
  createFile(project, '.claude/settings.json', hooked(WORKFLOW_HOOKS));
  createFile(project, '.workflows/.gitignore', '.cache/\n');
  createFile(project, '.workflows/.state/migrations', MIGRATED_TO_070.map((id) => `${id}\n`).join(''));
  createFile(project, '.workflows/manifest.json', JSON.stringify({ roadmap: { items: { 'dark-mode': { title: 'Dark mode', state: 'waiting', horizon: null, sources: [] } } } }, null, 2) + '\n');
  createFile(project, '.workflows/payments/manifest.json', JSON.stringify({
    name: 'payments', work_type: 'feature', status: 'in-progress', created: '2026-01-01', phases: { discussion: { items: { payments: { status: 'in-progress' } } } },
  }, null, 2) + '\n');
  createFile(project, '.workflows/payments/discussion/payments.md', '# Payments\n\nHow refunds settle.\n');
  harness.commitCode(project, 'the old layout');
});

/** The legacy project at `{root}/project`. @param {string} root */
function legacyProject(root) {
  return path.join(legacyWorld(root), 'project');
}

/** The engines a test drives: the copy beside the stand-in migration runner, and the repo's real scripts. */
const stubbed = harness.stubEngine();
const real = harness;

/**
 * The vector fill's launches from the stubbed copy recorded, not spawned;
 * any other detached job's launch dropped, never spawned either.
 * @param {import('node:test').TestContext} t @returns {string[]}
 */
function recordStubbedLaunches(t) {
  const { launcher } = require(path.join(path.dirname(stubbed.path), 'kernel/call.cjs'));
  /** @type {string[]} */
  const launched = [];
  t.mock.method(launcher, 'launch', (/** @type {string} */ root, /** @type {string[]} */ argv) => {
    if (argv.join(' ') === 'knowledge fill') launched.push(root);
  });
  return launched;
}

/**
 * The checkout set up keyword-only with an empty store — a knowledge base
 * that reads ready.
 * @param {string} project @param {Record<string, unknown>} [settings]  over the keyword-only pin
 */
function readyKnowledge(project, settings = {}) {
  const [storeFile, metadata, config] = STORE_FILES;
  writeState(project, config, JSON.stringify({ knowledge: { provider: null, ...settings } }) + '\n');
  store.saveStore(store.createStore(), statePath(project, storeFile));
  store.writeMetadata(statePath(project, metadata), { last_indexed: null });
}

/**
 * A quick-fix whose short record holds `body` — something for boot's index
 * to take in.
 * @param {string} project @param {string} body
 */
function recordedQuickFix(project, body) {
  writeState(project, layout.projectManifest, JSON.stringify({ work_units: { payments: { work_type: 'quick-fix' } } }, null, 2) + '\n');
  writeState(project, layout.manifest('payments'), JSON.stringify({
    name: 'payments', work_type: 'quick-fix', status: 'in-progress', created: '2026-01-01', phases: {},
  }, null, 2) + '\n');
  writeState(project, layout.summary('payments'), body);
}

/** A git-repo project carrying the settings every booted project has. */
function bootProject() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engine-boot-')));
  return { root, project: setupProject(root) };
}

/** Run an engine expecting success; returns the parsed JSON response. */
const runEngine = (engine, dir, args, env = {}) => engine.ok(dir, args, { env });

/** Run an engine expecting failure; returns the parsed stderr JSON. */
const runEngineFails = (engine, dir, args, env = {}) => engine.refuses(dir, args, { env });

/**
 * The session-hook suites' helpers over the project `fix()` answers, the
 * describe's own fixture.
 * @param {() => {root: string, project: string}} fix
 */
function hookHelpers(fix) {
  /** Take the fixture's settings away — a project the hooks have never reached. */
  function dropSettings() {
    git(fix().project, ['rm', '-q', '--', '.claude/settings.json']);
    git(fix().project, ['commit', '-q', '-m', 'no settings']);
  }

  /** Commit `content` as the project's settings. */
  function commitSettings(content) {
    createFile(fix().project, '.claude/settings.json', content);
    git(fix().project, ['add', '--', '.claude/settings.json']);
    git(fix().project, ['commit', '-q', '-m', 'settings']);
  }

  /** Boot with the tmux identity pinned; `tmux` absent unless given; `env` layered over the process's own. */
  function bootWith({ tmux = false, holdSettings = false, env: extra = {} } = {}) {
    const env = {
      ...extra,
      TMUX: tmux ? '/fake/sock,123,7' : undefined,
      LEEWAY_HOLD_PROJECT_SETTINGS: holdSettings ? '1' : undefined,
    };
    return runEngine(stubbed, fix().project, ['boot'], env);
  }

  function settings() {
    return JSON.parse(fs.readFileSync(path.join(fix().project, '.claude/settings.json'), 'utf8'));
  }

  return { dropSettings, commitSettings, bootWith, settings };
}

module.exports = {
  hookHelpers, FLAG, LABELS_ON, STORE_FILES, MIGRATED_TO_070, legacyLayout, setupProject, legacyProject, stubbed, real, recordStubbedLaunches, readyKnowledge, recordedQuickFix, bootProject, runEngine, runEngineFails,
};
