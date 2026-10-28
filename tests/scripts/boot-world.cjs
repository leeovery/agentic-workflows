'use strict';

// The world the boot suites share (test-engine-boot-*.cjs): the project
// fixture, a git repository with its state worktree and the workflows' own
// hooks in its settings, made once per process and copied (`setupFixture`,
// `setupProject`); the engine copied beside a stand-in migrate.cjs whose
// behaviour STUB_MIGRATE_MODE and its siblings pick (`stubbed`), and the
// repo's real scripts (`real`); the hooks boot installs, as settings read;
// a knowledge base that reads ready, a completed discussion to index, and
// the vector fill's launches recorded; and the session-hook helpers over a
// describe's own fixture (`hookHelpers`).

require('./hermetic-env.cjs');

const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { git, commitAll, fixtureFrom } = harness;
const REAL_SCRIPTS = path.dirname(harness.ENGINE);
const REAL_ENGINE_SKILL = path.dirname(REAL_SCRIPTS);
const { templateFolder } = require('./discovery-test-utils.cjs');
const store = require(path.join(REAL_SCRIPTS, 'kernel/knowledge/store.cjs'));

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

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
/** The layout hook's group, before every write, in every project whatever the label choice. */
const LAYOUT_GROUP = { matcher: 'Write|Edit|NotebookEdit', hooks: [{ type: 'command', command: `${HOOK_ENGINE} layout guard` }] };
/** The workflows' own hooks by event, as boot installs them. */
const OWN_HOOKS = { SessionEnd: [{ hooks: WORKFLOW_HOOKS }], PreToolUse: [LAYOUT_GROUP] };
/** Settings as boot leaves a project the mod cannot run in: `rest`, then `hooks` in boot's one SessionEnd group, and the layout hook. */
function hooked(hooks, rest = {}) {
  return JSON.stringify({ ...rest, hooks: { SessionEnd: [{ hooks }], PreToolUse: [LAYOUT_GROUP] } }, null, 2) + '\n';
}
/** The settings such a project reaches with labels on: every SessionEnd hook, the SessionStart resume hook, and the layout hook. */
const LABELS_ON = JSON.stringify({
  hooks: { SessionEnd: [{ hooks: [SESSION_HOOK, ...WORKFLOW_HOOKS] }], SessionStart: [{ matcher: 'resume', hooks: [RESUME_HOOK] }], PreToolUse: [LAYOUT_GROUP] },
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
 * about the mod installs it. Made once per process, copied for each test.
 */
const projectWorld = fixtureFrom('engine-boot-project-', (project) => {
  writeFile(project, '.leeway/payments/manifest.json', '{"name":"payments"}\n');
  writeFile(project, '.claude/settings.json', hooked(WORKFLOW_HOOKS));
  commitAll(project, 'init');
});

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

/** The project fixture at `{root}/project`. @param {string} root */
function setupProject(root) {
  return projectWorld(path.join(root, 'project'));
}

// Stub migrate.cjs: env-driven behaviour, mimicking the real report format
// byte-for-byte (boot parses the report, so the stub must reproduce it).
const STUB_MIGRATE = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const mode = process.env.STUB_MIGRATE_MODE || '';
const record = process.argv[process.argv.indexOf('--record') + 1];
let ran = 1;
if (mode === 'update') {
  fs.mkdirSync(path.dirname(record), { recursive: true });
  fs.mkdirSync('.leeway/payments', { recursive: true });
  fs.appendFileSync(record, '045\\n');
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
  fs.mkdirSync(path.dirname(record), { recursive: true });
  fs.mkdirSync('.claude', { recursive: true });
  fs.appendFileSync(record, '046\\n');
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
  // A migration that ran and found nothing to do: the record gains its line,
  // no document changes, no stop gate.
  fs.mkdirSync(path.dirname(record), { recursive: true });
  fs.appendFileSync(record, '047\\n');
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
  const skills = templateFolder('engine-boot-skills-');
  fs.cpSync(REAL_ENGINE_SKILL, path.join(skills, 'workflow-engine'), { recursive: true });
  writeFile(skills, 'workflow-migrate/scripts/migrate.cjs', STUB_MIGRATE);
  return path.join(skills, 'workflow-engine/scripts/engine.cjs');
}

const STUB_ENGINE = stubbedSkillsTree();
/** The engines a test drives: the copy with the stub migrations, and the repo's real scripts. */
const stubbed = harness.harness(STUB_ENGINE);
const real = harness;

/**
 * The vector fill's launches from the stubbed copy recorded, not spawned;
 * any other detached job's launch dropped, never spawned either.
 * @param {import('node:test').TestContext} t @returns {string[]}
 */
function recordStubbedLaunches(t) {
  const { launcher } = require(path.join(path.dirname(STUB_ENGINE), 'kernel/call.cjs'));
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
    writeFile(fix().project, '.claude/settings.json', content);
    git(fix().project, ['add', '--', '.claude/settings.json']);
    git(fix().project, ['commit', '-q', '-m', 'settings']);
  }

  /** Boot with the tmux identity pinned; `tmux` absent unless given; `env` layered over the process's own. */
  function bootWith({ tmux = false, holdSettings = false, env: extra = {} } = {}) {
    const env = {
      ...extra,
      TMUX: tmux ? '/fake/sock,123,7' : undefined,
      WORKFLOWS_HOLD_PROJECT_SETTINGS: holdSettings ? '1' : undefined,
    };
    return runEngine(stubbed, fix().project, ['boot'], env);
  }

  function settings() {
    return JSON.parse(fs.readFileSync(path.join(fix().project, '.claude/settings.json'), 'utf8'));
  }

  return { dropSettings, commitSettings, bootWith, settings };
}

module.exports = {
  hookHelpers, writeFile, FLAG, WORKFLOW_HOOKS, OWN_HOOKS, hooked, LABELS_ON, KNOWLEDGE_DIR, STORE_FILES, legacyLayout, setupProject, stubbed, real, recordStubbedLaunches, readyKnowledge, completedDiscussion, setupFixture, runEngine, runEngineFails,
};
