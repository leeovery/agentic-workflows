'use strict';

// ---------------------------------------------------------------------------
// The layout hook (workflow-engine/scripts/domain/layout-hook.cjs): `engine
// layout guard`, Claude Code's hook before Write, Edit and NotebookEdit, fed
// its JSON on stdin as Claude Code sends it. It refuses a write to the ledger
// with exit 2 and the reason on stderr (5.S7), reached by any route — from
// the main checkout, from a code worktree, through a symbolic link, through
// `..` read from the text, in another case where the filesystem ignores
// case — against the state of the project the target is in, whatever project
// the conversation sits in; refuses a write to every file whose bytes reach
// the trust log — the log, its lock, each conversation's file of events
// waiting for it and that file's lock — the settings file and the record of
// the person in the system config directory, from anywhere, folders named
// with no letters among them (16.13.2); refuses a write to the files of
// Claude Code's own the trust log reads the model from — a conversation's
// transcript, a subagent's transcript and its record (16.4.4). Those are
// judged by the names the target is written with below the nearest folder
// above it that is the guarded directory — by a relative path, through
// `..`, through a link in the guarded directory's own path or one below it,
// through macOS's firmlink, in another case where the filesystem ignores
// case — and a write that reaches one under other names, at the place a
// link leads or through a link to the file, passes, as a write by Bash
// does. Everything else passes silently: the rest of `.leeway/`, of the
// system config directory and of Claude Code's project folders, their
// memory among it, the code tree, and any project with no state. Whether
// the filesystem ignores case is asked once.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const harness = require('./engine-harness.cjs');
const { LEDGER } = require('../../skills/workflow-engine/scripts/domain/ledger-events.cjs');
const { ignoresCase } = require('../../skills/workflow-engine/scripts/kernel/state-root.cjs');

// Whether the filesystem every folder of these tests is on ignores case.
const IGNORES_CASE = ignoresCase(fs.realpathSync(os.tmpdir()));

/** @type {string} */
let dir;
/** @type {string} */
let root;
/** @type {string} */
let ledger;
/** @type {string[]} */
let scratch;

beforeEach(() => {
  dir = fs.realpathSync(harness.setupGitFixture('engine-layout-hook-'));
  root = path.join(dir, '.leeway');
  ledger = path.join(root, LEDGER);
  scratch = [];
});

afterEach(() => {
  for (const d of [dir, ...scratch]) harness.cleanupFixture(d);
});

/** A folder outside the project, removed after the test. @param {string} prefix */
function outside(prefix) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `engine-layout-hook-${prefix}-`)));
  scratch.push(d);
  return d;
}

/** A linked code worktree of the project, on its own branch. */
function codeWorktree() {
  harness.git(dir, ['commit', '-q', '--allow-empty', '-m', 'code']);
  const wt = path.join(dir, 'wt');
  harness.git(dir, ['worktree', 'add', '-q', '-b', 'side', wt]);
  return wt;
}

/**
 * The hook's stdin, as Claude Code writes it before a tool call.
 * @param {string} cwd @param {string} tool @param {Record<string, unknown>} toolInput
 */
function hookInput(cwd, tool, toolInput) {
  return JSON.stringify({
    session_id: 'sess-1', transcript_path: '/t/sess-1.jsonl', cwd, permission_mode: 'default',
    hook_event_name: 'PreToolUse', tool_name: tool, tool_input: toolInput,
  });
}

/**
 * The hook run on a Write of `file` from `cwd`.
 * @param {string} cwd @param {string} file @param {{env?: Record<string, string|undefined>, tool?: string}} [opts]
 */
function guard(cwd, file, { env, tool = 'Write' } = {}) {
  const toolInput = tool === 'NotebookEdit' ? { notebook_path: file, new_source: 'x' }
    : tool === 'Edit' ? { file_path: file, old_string: 'a', new_string: 'b' }
      : { file_path: file, content: 'x' };
  return harness.call(cwd, ['layout', 'guard'], { env, stdin: hookInput(cwd, tool, toolInput) });
}

/**
 * @param {{code: number, stdout: string, stderr: string}} res @param {string} what
 * @param {string} [reason] the ledger's, unless another's
 */
function assertRefused(res, what, reason = `the ledger (${LEDGER}) changes only through the engine's commands`) {
  assert.deepStrictEqual({ code: res.code, stdout: res.stdout, stderr: res.stderr }, { code: 2, stdout: '', stderr: `${reason}\n` }, what);
}

/** @param {{code: number, stdout: string, stderr: string}} res @param {string} what */
function assertAllowed(res, what) {
  assert.deepStrictEqual({ code: res.code, stdout: res.stdout, stderr: res.stderr }, { code: 0, stdout: '', stderr: '' }, what);
}

/**
 * A write to a refused file named in another case: refused where the
 * filesystem ignores case, and another file, allowed, where it keeps it.
 * @param {{code: number, stdout: string, stderr: string}} res @param {string} what @param {string} [reason]
 */
function assertRefusedInAnotherCase(res, what, reason) {
  if (IGNORES_CASE) assertRefused(res, what, reason);
  else assertAllowed(res, `${what}: another file on a filesystem that keeps case`);
}

describe('the ledger, refused (5.S7, 5.1.9, 5.4.2)', () => {
  it('Write, Edit and NotebookEdit on .leeway/.ledger.jsonl are refused with exit 2 — the code Claude Code blocks on — the reason on stderr, the ledger untouched', () => {
    fs.writeFileSync(ledger, '{"id":"e1"}\n');
    for (const tool of ['Write', 'Edit', 'NotebookEdit']) assertRefused(guard(dir, ledger, { tool }), tool);
    assert.strictEqual(fs.readFileSync(ledger, 'utf8'), '{"id":"e1"}\n');
  });

  it('is refused before the ledger exists, and by a relative path from the main checkout', () => {
    assertRefused(guard(dir, ledger), 'absent');
    assertRefused(guard(dir, `.leeway/${LEDGER}`), 'relative');
    assertRefused(guard(root, LEDGER), 'from inside the state');
  });

  it('is refused through `..`', () => {
    assertRefused(guard(dir, path.join(root, 'pay') + `/../${LEDGER}`), 'through a folder that does not exist');
    fs.mkdirSync(path.join(dir, 'src'));
    assertRefused(guard(dir, `src/../.leeway/./${LEDGER}`), 'through the code tree');
  });

  it('from a code worktree, the main checkout\'s ledger is refused, absolute or relative — the worktree\'s own path of that name is not the state', () => {
    const wt = codeWorktree();
    assertRefused(guard(wt, ledger), 'absolute');
    assertRefused(guard(wt, `../.leeway/${LEDGER}`), 'relative');
    assertAllowed(guard(wt, path.join(wt, '.leeway', LEDGER)), 'the worktree holds no state');
  });

  it('through a symbolic link: to the state folder, to the ledger itself — dangling until the ledger is written — by a relative link read from the folder it sits in, and to the project', () => {
    const elsewhere = outside('links');
    fs.symlinkSync(root, path.join(elsewhere, 'state'));
    fs.symlinkSync(ledger, path.join(elsewhere, 'ledger'));
    fs.symlinkSync(path.relative(elsewhere, ledger), path.join(elsewhere, 'relative'));
    fs.symlinkSync(dir, path.join(elsewhere, 'project'));

    assertRefused(guard(dir, path.join(elsewhere, 'state', LEDGER)), 'a link to the state folder');
    assertRefused(guard(dir, path.join(elsewhere, 'ledger')), 'a dangling link to the ledger');
    assertRefused(guard(dir, path.join(elsewhere, 'relative')), 'a relative link to the ledger');
    assertRefused(guard(path.join(elsewhere, 'project'), `.leeway/${LEDGER}`), 'from the project reached through a link');
  });

  it('a `..` is read from the path\'s text before any link is followed, as Claude Code\'s tools read it', () => {
    const elsewhere = outside('away');
    fs.symlinkSync(elsewhere, path.join(root, 'away'));
    fs.mkdirSync(path.join(root, 'pay'));
    fs.symlinkSync(path.join(root, 'pay'), path.join(elsewhere, 'unit'));
    assertRefused(guard(dir, `${path.join(root, 'away', 'sub')}/../../${LEDGER}`), 'the text climbs back to the state root');
    assertAllowed(guard(dir, `${path.join(elsewhere, 'unit')}/../${LEDGER}`), 'the text climbs out of the link, beside it');
  });

  it('in any case the filesystem reads as the ledger\'s — the ledger there or not yet written — and only there', () => {
    const variants = [`.leeway/.LEDGER.jsonl`, `.Leeway/${LEDGER}`, `.leeway/.ledger.JSONL`];
    const check = (/** @type {string} */ what) => {
      for (const rel of variants) assertRefusedInAnotherCase(guard(dir, path.join(dir, rel)), `${rel} ${what}`);
    };
    check('before the ledger is written');
    fs.writeFileSync(ledger, '{"id":"e1"}\n');
    check('over the ledger');
    assertAllowed(guard(dir, path.join(root, 'Manifest.JSON')), 'another file in another case');
  });

  it('the state is the target\'s own project\'s: a conversation sitting in another project with state, or out of every project, is refused this one\'s ledger', () => {
    const other = fs.realpathSync(harness.setupGitFixture('engine-layout-hook-other-'));
    scratch.push(other);
    assertRefused(guard(other, ledger), 'from another project');
    assertRefused(guard(dir, path.join(other, '.leeway', LEDGER)), 'the other project\'s, from this one');
    assertAllowed(guard(other, path.join(other, '.leeway', 'manifest.json')), 'the other project\'s manifest');
    assertRefused(guard(outside('drifted'), ledger), 'from a folder in no project');
  });

  it('a relative target with no folder in the input is read from CLAUDE_PROJECT_DIR where the hook runs outside the project', () => {
    const stdin = JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: `.leeway/${LEDGER}`, content: 'x' } });
    assertRefused(harness.call(outside('drifted'), ['layout', 'guard'], { env: { CLAUDE_PROJECT_DIR: dir }, stdin }), 'relative');
  });
});

describe('the files at user level the engine alone writes, refused (16.13.2)', () => {
  /** Each, from the system config directory, and what it is in the reason it is refused with. */
  const USER_FILES = Object.freeze({
    'trust.jsonl': 'the trust log',
    'trust.jsonl.lock': 'the trust log\'s lock',
    'conversations/0001-0002/trust-pending.jsonl': 'a conversation\'s file of events waiting for the trust log',
    'conversations/0001-0002/trust-pending.jsonl.lock': 'the lock on a conversation\'s events waiting for the trust log',
    'conversations/0001-0002/gate-shown.json': 'the record of the gate a conversation was shown',
    'conversations/0001-0002/pressed.json': 'the gate mod\'s record of a conversation\'s last press',
    'conversations/0001-0002/raise-shown.json': 'a conversation\'s sealed raises',
    'config.json': 'the settings file',
    'person.md': 'the record of the person',
  });

  /** The reason a write to `rel` is refused with. @param {keyof typeof USER_FILES} rel */
  const reasonFor = (rel) => `${USER_FILES[rel]} (${path.basename(rel)}) changes only through the engine's commands`;

  /** @type {string} */
  let config;
  /** @type {{env: Record<string, string>}} */
  let inConfig;
  beforeEach(() => {
    config = path.join(outside('config'), '2026');
    fs.mkdirSync(config);
    inConfig = { env: { WORKFLOWS_CONFIG_DIR: config } };
  });

  it('Write, Edit and NotebookEdit on each in the system config directory — every file whose bytes reach the trust log, the gate\'s record a gate event is built from, and the raises sealed before the person answers, among them — are refused with its reason, there or not yet written, from a project or from a folder in none', () => {
    fs.writeFileSync(path.join(config, 'trust.jsonl'), '{"v":1}\n');
    const elsewhere = outside('drifted');
    for (const rel of /** @type {(keyof typeof USER_FILES)[]} */ (Object.keys(USER_FILES))) {
      const file = path.join(config, rel);
      for (const tool of ['Write', 'Edit', 'NotebookEdit']) assertRefused(guard(dir, file, { ...inConfig, tool }), `${rel} ${tool}`, reasonFor(rel));
      assertRefused(guard(elsewhere, file, inConfig), `${rel} from a folder in no project`, reasonFor(rel));
    }
    assert.strictEqual(fs.readFileSync(path.join(config, 'trust.jsonl'), 'utf8'), '{"v":1}\n');
  });

  it('each by its names: a relative path, `..`, a symbolic link to the folder, the system config directory named through a link — one to a folder not made yet among them — and another case where the filesystem ignores case, a folder\'s before it is made among them — in folders named with no letters; a link to the file, named otherwise, passes, as a write by Bash does', () => {
    const elsewhere = outside('links');
    fs.symlinkSync(config, path.join(elsewhere, 'config'));
    const pending = /** @type {const} */ ('conversations/0001-0002/trust-pending.jsonl');
    assertRefusedInAnotherCase(guard(dir, path.join(config, pending.toUpperCase()), inConfig), `${pending} before its folders are made`, reasonFor(pending));
    fs.symlinkSync(path.join(elsewhere, 'later'), path.join(elsewhere, 'dangling'));
    const dangling = { env: { WORKFLOWS_CONFIG_DIR: path.join(elsewhere, 'dangling') } };
    assertRefused(guard(dir, path.join(elsewhere, 'later', 'trust.jsonl'), dangling), 'trust.jsonl where the system config directory, a link to a folder not made yet, leads', reasonFor('trust.jsonl'));
    fs.mkdirSync(path.join(config, 'conversations', '0001-0002'), { recursive: true });
    const throughLink = { env: { WORKFLOWS_CONFIG_DIR: path.join(elsewhere, 'config') } };
    for (const rel of /** @type {(keyof typeof USER_FILES)[]} */ (Object.keys(USER_FILES))) {
      const [file, reason, link] = [path.join(config, rel), reasonFor(rel), path.join(elsewhere, `link-${path.basename(rel)}`)];
      fs.symlinkSync(file, link);

      assertRefused(guard(path.dirname(file), path.basename(rel), inConfig), `${rel} relative`, reason);
      assertRefused(guard(dir, `${path.join(config, 'conversations', 'sess-1', 'deeper')}/../../../${rel}`, inConfig), `${rel} through ..`, reason);
      assertRefused(guard(dir, path.join(elsewhere, 'config', rel), inConfig), `${rel} through a link to the folder`, reason);
      assertAllowed(guard(dir, link, inConfig), `${rel} through a link to the file: the Bash class`);
      assertRefused(guard(dir, file, throughLink), `${rel} with the system config directory named through a link`, reason);
      assertRefusedInAnotherCase(guard(dir, path.join(config, rel.toUpperCase()), inConfig), `${rel} in another case`, reason);
    }
  });

  it('in a conversation\'s folder that is itself a link, the files that feed the trust log are refused named through the link, and pass where it leads, as a write by Bash does', () => {
    const real = outside('real-conversation');
    fs.mkdirSync(path.join(config, 'conversations'));
    fs.symlinkSync(real, path.join(config, 'conversations', 'linked'));
    for (const rel of /** @type {const} */ (['conversations/0001-0002/trust-pending.jsonl', 'conversations/0001-0002/trust-pending.jsonl.lock', 'conversations/0001-0002/gate-shown.json', 'conversations/0001-0002/pressed.json', 'conversations/0001-0002/raise-shown.json'])) {
      const name = path.basename(rel);
      assertRefused(guard(dir, path.join(config, 'conversations', 'linked', name), inConfig), `${name} through the link`, reasonFor(rel));
      assertAllowed(guard(dir, path.join(real, name), inConfig), `${name} where the link leads: the Bash class`);
    }
  });

  it('the system config directory is the folder the engine writes in: a `..` after a link in its path is read from the text, and before it is made, every name below the nearest folder made counts, that folder where a link in its path leads', () => {
    const out = outside('roots');
    fs.mkdirSync(path.join(out, 'real', 'inner'), { recursive: true });
    fs.mkdirSync(path.join(out, 'real', 'cfg'));
    fs.mkdirSync(path.join(out, 'cfg'));
    fs.symlinkSync(path.join(out, 'real', 'inner'), path.join(out, 'lnk'));
    const climbing = { env: { WORKFLOWS_CONFIG_DIR: `${path.join(out, 'lnk')}/../cfg` } };
    assertRefused(guard(dir, path.join(out, 'cfg', 'trust.jsonl'), climbing), 'trust.jsonl where the engine writes it, the `..` read from the text', reasonFor('trust.jsonl'));
    const unmade = { env: { WORKFLOWS_CONFIG_DIR: path.join(out, 'a', 'workflows') } };
    assertRefused(guard(dir, path.join(out, 'a', 'workflows', 'config.json'), unmade), 'config.json two folders below the nearest made', reasonFor('config.json'));
    assertAllowed(guard(dir, path.join(out, 'b', 'workflows', 'config.json'), unmade), 'another folder of that name, not made either');
    const linked = { env: { WORKFLOWS_CONFIG_DIR: path.join(out, 'lnk', 'fresh') } };
    assertRefused(guard(dir, path.join(out, 'real', 'inner', 'fresh', 'trust.jsonl'), linked), 'trust.jsonl where the link in its path leads', reasonFor('trust.jsonl'));
  });

  it('through macOS\'s firmlink, where it has one, the system config directory is known made or not — /Users, on the data volume on every Mac — and nothing is made there: the hook only stats', () => {
    const firm = (/** @type {string} */ at) => path.join('/System/Volumes/Data', at);
    let same = false;
    try {
      const [own, other] = [fs.statSync('/Users'), fs.statSync(firm('/Users'))];
      same = own.dev === other.dev && own.ino === other.ino;
    } catch { /* no firmlink names /Users */ }
    const listed = () => (same ? fs.readdirSync('/Users') : []);
    const before = listed();
    for (const root of ['/Users', `/Users/never-made-${Math.random().toString(36).slice(2)}`]) {
      const res = guard(dir, firm(path.join(root, 'trust.jsonl')), { env: { WORKFLOWS_CONFIG_DIR: root } });
      if (same) assertRefused(res, `${root}/trust.jsonl through the firmlink`, reasonFor('trust.jsonl'));
      else assertAllowed(res, `${root}/trust.jsonl under a path that names no folder, on a system with no firmlink`);
    }
    assert.deepStrictEqual(listed(), before, 'nothing made under /Users');
  });

  it('the rest of the system config directory passes, and so does a file of the same name anywhere else', () => {
    for (const rel of ['credentials.json', 'conversations/sess-1/position.json', 'brief-refusals.jsonl', 'nested/trust.jsonl', 'conversations/trust-pending.jsonl', 'conversations/sess-1/nested/trust-pending.jsonl']) {
      assertAllowed(guard(dir, path.join(config, rel), inConfig), rel);
    }
    for (const name of Object.keys(USER_FILES)) {
      assertAllowed(guard(dir, path.join(root, name), inConfig), `${name} in the state`);
      assertAllowed(guard(dir, path.join(dir, name), inConfig), `${name} in the code tree`);
    }
  });
});

describe('Claude Code\'s own files the trust log reads the model from, refused (16.4.4)', () => {
  /** Each, from Claude Code's config directory, and what it is in the reason it is refused with. */
  const CLAUDE_FILES = Object.freeze({
    'projects/-Users-me-app/sess-1.jsonl': 'a conversation\'s transcript',
    'projects/-Users-me-app/sess-1/subagents/agent-a1.jsonl': 'a subagent\'s transcript',
    'projects/-Users-me-app/sess-1/subagents/agent-a1.meta.json': 'a subagent\'s record',
  });

  /** The reason a write to a file named `name` that is `what` is refused with. @param {string} what @param {string} name */
  const reasonFor = (what, name) => `${what} (${name}) is Claude Code's own: the trust log reads the model from it`;

  /** @type {string} */
  let claude;
  /** @type {{env: Record<string, string>}} */
  let inClaude;
  beforeEach(() => {
    claude = outside('claude');
    inClaude = { env: { CLAUDE_CONFIG_DIR: claude } };
  });

  it('a conversation\'s transcript, and a subagent\'s transcript and record, in any project folder of its projects directory: Write and Edit refused, by a relative path, through a link, with Claude Code\'s config directory named through a link, and in another case where the filesystem ignores case', () => {
    fs.mkdirSync(path.join(claude, 'projects', '-Users-me-app', 'sess-1', 'subagents'), { recursive: true });
    const elsewhere = outside('claude-links');
    fs.symlinkSync(path.join(claude, 'projects'), path.join(elsewhere, 'projects'));
    fs.symlinkSync(claude, path.join(elsewhere, 'claude'));
    const throughLink = { env: { CLAUDE_CONFIG_DIR: path.join(elsewhere, 'claude') } };
    for (const [rel, what] of Object.entries(CLAUDE_FILES)) {
      const [file, reason] = [path.join(claude, rel), reasonFor(what, path.basename(rel))];
      for (const tool of ['Write', 'Edit']) assertRefused(guard(dir, file, { ...inClaude, tool }), `${rel} ${tool}`, reason);
      assertRefused(guard(path.dirname(file), path.basename(rel), inClaude), `${rel} relative`, reason);
      assertRefused(guard(dir, path.join(elsewhere, rel), inClaude), `${rel} through a link`, reason);
      assertRefused(guard(dir, file, throughLink), `${rel} with Claude Code's config directory named through a link`, reason);
      assertRefusedInAnotherCase(guard(dir, path.join(claude, rel.toUpperCase()), inClaude), `${rel} in another case`, reasonFor(what, path.basename(rel).toUpperCase()));
    }
  });

  it('the names are read from the nearest folder above the target that is the projects directory: through a link in a project folder that leads back to it, another project\'s transcript is refused', () => {
    const projects = path.join(claude, 'projects');
    fs.mkdirSync(path.join(projects, '-Users-me-app'), { recursive: true });
    fs.mkdirSync(path.join(projects, '-Users-me-other'));
    fs.symlinkSync(projects, path.join(projects, '-Users-me-app', 'up'));
    const transcript = 'projects/-Users-me-app/sess-1.jsonl';
    assertRefused(guard(dir, path.join(projects, '-Users-me-app', 'up', '-Users-me-other', 'sess-1.jsonl'), inClaude), 'through the link', reasonFor(CLAUDE_FILES[transcript], 'sess-1.jsonl'));
  });

  it('in a conversation\'s or a project\'s folder that is itself a link, the files the trust log reads are refused named through the link, and pass where it leads, as a write by Bash does', () => {
    const [realProject, realConversation] = [outside('real-project'), outside('real-conversation')];
    fs.mkdirSync(path.join(claude, 'projects', '-Users-me-app'), { recursive: true });
    fs.symlinkSync(realProject, path.join(claude, 'projects', '-Users-me-linked'));
    fs.symlinkSync(realConversation, path.join(claude, 'projects', '-Users-me-app', 'sess-2'));
    const record = CLAUDE_FILES['projects/-Users-me-app/sess-1/subagents/agent-a1.meta.json'];
    const routes = [
      ['projects/-Users-me-app/sess-2/subagents/agent-a1.meta.json', path.join(realConversation, 'subagents', 'agent-a1.meta.json'), record],
      ['projects/-Users-me-app/sess-2/subagents/agent-a1.jsonl', path.join(realConversation, 'subagents', 'agent-a1.jsonl'), CLAUDE_FILES['projects/-Users-me-app/sess-1/subagents/agent-a1.jsonl']],
      ['projects/-Users-me-linked/sess-3.jsonl', path.join(realProject, 'sess-3.jsonl'), CLAUDE_FILES['projects/-Users-me-app/sess-1.jsonl']],
      ['projects/-Users-me-linked/sess-3/subagents/agent-a1.meta.json', path.join(realProject, 'sess-3', 'subagents', 'agent-a1.meta.json'), record],
    ];
    for (const [rel, real, what] of routes) {
      assertRefused(guard(dir, path.join(claude, rel), inClaude), `${rel} through the link`, reasonFor(what, path.basename(rel)));
      assertAllowed(guard(dir, real, inClaude), `${rel} where the link leads: the Bash class`);
    }
  });

  it('the rest passes — a project folder\'s memory, a conversation\'s other files, a record\'s name at a project folder\'s top, a file of that name outside a project folder — and so does a transcript\'s name anywhere else', () => {
    for (const rel of [
      'projects/-Users-me-app/memory/MEMORY.md', 'projects/-Users-me-app/memory/notes.jsonl', 'projects/-Users-me-app/memory/team/notes.jsonl', 'projects/-Users-me-app/notes.md', 'projects/-Users-me-app/sess-1.meta.json',
      'projects/-Users-me-app/sess-1/tool-results/out.txt', 'projects/-Users-me-app/sess-1/subagents/deeper/agent-a1.jsonl', 'projects/-Users-me-app/sess-1/subagents/notes.txt',
      'projects/sess-1.jsonl', 'settings.json',
    ]) assertAllowed(guard(dir, path.join(claude, rel), inClaude), rel);
    assertAllowed(guard(dir, path.join(dir, 'sess-1.jsonl'), inClaude), 'in the code tree');
  });
});

describe('everything else, allowed', () => {
  it('the rest of .leeway/ — the layout hook\'s to refuse in a later step — passes silently', () => {
    for (const rel of ['manifest.json', 'pay/manifest.json', 'pay/discussion/pay.md', `pay/${LEDGER}`, `${LEDGER}.bak`, '.cache/x']) {
      assertAllowed(guard(dir, path.join(root, rel)), rel);
    }
  });

  it('the code tree, and a folder outside the project, pass silently', () => {
    assertAllowed(guard(dir, path.join(dir, 'src/app.js')), 'code');
    assertAllowed(guard(dir, path.join(outside('elsewhere'), LEDGER)), 'outside');
  });

  it('a project with no state passes every write, its .leeway/.ledger.jsonl among them — and so does a folder in no repository', () => {
    const fresh = harness.initRepo(outside('fresh'));
    assertAllowed(guard(fresh, path.join(fresh, '.leeway', LEDGER)), 'no state');
    const bare = outside('no-repo');
    assertAllowed(guard(bare, path.join(bare, '.leeway', LEDGER)), 'no repository');
  });

  it('input naming no file, or none at all, passes', () => {
    for (const stdin of ['', '{not json', '[]', JSON.stringify({ tool_name: 'Write' }), hookInput(dir, 'Write', { content: 'x' })]) {
      assertAllowed(harness.call(dir, ['layout', 'guard'], { stdin }), stdin);
    }
  });

  it('writes nothing — the project, the state and the conversation\'s folder as they were', () => {
    const config = outside('config');
    guard(dir, ledger, { env: { CLAUDE_CODE_SESSION_ID: 'sess-1', WORKFLOWS_CONFIG_DIR: config } });
    guard(dir, path.join(root, 'manifest.json'), { env: { CLAUDE_CODE_SESSION_ID: 'sess-1', WORKFLOWS_CONFIG_DIR: config } });
    assert.strictEqual(harness.git(dir, ['status', '--porcelain', '--untracked-files=all']), '');
    assert.strictEqual(harness.stateGit(dir, ['status', '--porcelain', '--untracked-files=all', '--ignored']), '');
    assert.deepStrictEqual(fs.readdirSync(config), [], 'a hook target never marks the conversation');
  });
});

describe('the shell door', () => {
  it('a spawned hook refuses with exit 2 and allows with exit 0, nothing on stdout either way', () => {
    const engine = harness.ENGINE;
    const run = (/** @type {string} */ file) => spawnSync('node', [engine, 'layout', 'guard'], { cwd: dir, encoding: 'utf8', input: hookInput(dir, 'Write', { file_path: file, content: 'x' }) });
    const refused = run(ledger);
    assert.deepStrictEqual([refused.status, refused.stdout], [2, '']);
    assert.match(refused.stderr, /changes only through the engine's commands/);
    const allowed = run(path.join(dir, 'src/app.js'));
    assert.deepStrictEqual([allowed.status, allowed.stdout, allowed.stderr], [0, '', '']);
  });

  it('a stray argument is a usage error', () => {
    const res = harness.call(dir, ['layout', 'guard', 'extra'], { stdin: hookInput(dir, 'Write', { file_path: ledger }) });
    assert.strictEqual(res.code, 1);
    assert.match(res.stderr, /^Usage: engine layout guard/);
  });
});
