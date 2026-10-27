'use strict';

// ---------------------------------------------------------------------------
// The layout hook (workflow-engine/scripts/domain/layout-hook.cjs): `engine
// layout guard`, Claude Code's hook before Write, Edit and NotebookEdit, fed
// its JSON on stdin as Claude Code sends it. It refuses a write to the ledger
// with exit 2 and the reason on stderr (5.S7), reached by any route — from
// the main checkout, from a code worktree, through a symbolic link, through
// `..` read from the text, in another case where the filesystem ignores
// case — against the state of the project the target is in, whatever project
// the conversation sits in; and allows everything else silently: the rest of
// `.leeway/`, the code tree, and any project with no state.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const harness = require('./engine-harness.cjs');
const { LEDGER } = require('../../skills/workflow-engine/scripts/domain/state-merge-rules.cjs');
const { ignoresCase } = require('../../skills/workflow-engine/scripts/kernel/state-root.cjs');

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

/** @param {{code: number, stdout: string, stderr: string}} res @param {string} what */
function assertRefused(res, what) {
  assert.deepStrictEqual(
    { code: res.code, stdout: res.stdout, stderr: res.stderr },
    { code: 2, stdout: '', stderr: `the ledger (${LEDGER}) changes only through the engine's commands\n` },
    what,
  );
}

/** @param {{code: number, stdout: string, stderr: string}} res @param {string} what */
function assertAllowed(res, what) {
  assert.deepStrictEqual({ code: res.code, stdout: res.stdout, stderr: res.stderr }, { code: 0, stdout: '', stderr: '' }, what);
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
      for (const rel of variants) {
        const res = guard(dir, path.join(dir, rel));
        if (ignoresCase(root)) assertRefused(res, `${rel} ${what}`);
        else assertAllowed(res, `${rel} ${what}: another file on a filesystem that keeps case`);
      }
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
