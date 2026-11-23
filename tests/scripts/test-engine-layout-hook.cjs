'use strict';

// ---------------------------------------------------------------------------
// The layout hook (ledger-engine/scripts/domain/layout-hook.cjs): `engine
// layout guard`, Claude Code's hook before Write, Edit and NotebookEdit, fed
// its JSON on stdin as Claude Code sends it. In the state it refuses, with
// exit 2 and the reason on stderr, a path the layout has no place for (6.S4)
// and a file only the engine writes — the manifests, a unit's
// spec-review.json, a verification run, the ledger and the migrations record — naming the verb that writes it where
// one does, with the mod or without (6.S5, 5.S7); a unit's spec.md once the
// spec is concluded (11.9.1); a place in the layout
// passes, whatever its kind, and in another case where the filesystem
// ignores case (the places themselves are test-engine-layout.cjs's). The
// ledger stands for every refusal in the state, reached by any route — from
// the main checkout, from a code worktree, through a symbolic link, through
// `..` read from the text, in another case where the filesystem ignores
// case — against the state of the project the target is in, whatever
// project the conversation sits in. Everything else passes silently: the
// code tree, the files at user level, and any project with no state.
//
// Layer: process.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const harness = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const { STATE_DIR_NAME, statePath, layout } = harness;
const { ignoresCase } = require('../../skills/ledger-engine/scripts/kernel/state-root.cjs');

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
  root = path.join(dir, STATE_DIR_NAME);
  ledger = path.join(root, layout.ledger);
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

/** The reason a write to the ledger is refused with, named as it lands in the state. @param {string} [name] */
const ledgerReason = (name = layout.ledger) => `the ledger (${name}) changes only through the engine's commands — engine ledger ask|find|decide|replace|hold|move|merge`;

/** Each file in the state only the engine writes, and the reason a write to it is refused with. */
const ENGINE_FILES = Object.freeze({
  [layout.projectManifest]: 'the project manifest (manifest.json) changes only through the engine\'s commands — engine manifest set|push|pull|delete',
  [layout.manifest('pay')]: 'a unit\'s manifest (pay/manifest.json) changes only through the engine\'s commands — engine manifest set|push|pull|delete|apply',
  [layout.unit('pay', 'spec-review.json')]: 'a unit\'s record of the person\'s review of its spec (pay/spec-review.json) changes only through the engine\'s commands',
  [layout.run('pay', '3.S2', '001')]: 'a verification run (pay/build/runs/3.S2/run-001.json) changes only through the engine\'s commands — engine verify',
  [layout.ledger]: ledgerReason(),
  [layout.migrations]: 'the migrations record (.state/migrations) changes only through the engine\'s commands — engine boot|checklist close directive|migrate checked',
});

/** The reason a write to the state-relative `rel` is refused with where the layout has no place for it. @param {string} rel */
const outsideReason = (rel) => `${STATE_DIR_NAME}/${rel} is outside Ledger's layout — the state holds only the places Ledger keeps; scratch goes in ${STATE_DIR_NAME}/.cache/`;

/**
 * @param {{code: number, stdout: string, stderr: string}} res @param {string} what
 * @param {string} [reason] the ledger's, unless another's
 */
function assertRefused(res, what, reason = ledgerReason()) {
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

describe('the layout, held (6.2.1, 6.2.3)', () => {
  /** The session without the mod and with it: the hook is the project's, so the two answer alike (6.2.2). */
  const SURFACES = Object.freeze({ 'the mod off': {}, 'the mod on': { LEDGER_GATE_SURFACE: '1' } });

  it('6.S4: a Write to a folder of its own in a unit is refused, naming the path and where scratch goes, and a Write to a topic\'s log goes through — with the mod off and on', () => {
    const [scratchNotes, topicLog] = [layout.unit('pay', 'scratch', 'notes.md'), layout.unit('pay', 'topics', 'auth', 'log.md')];
    for (const [mod, env] of Object.entries(SURFACES)) {
      assertRefused(guard(dir, path.join(root, scratchNotes), { env }), `${scratchNotes}, ${mod}`, outsideReason(scratchNotes));
      assertAllowed(guard(dir, path.join(root, topicLog), { env }), `${topicLog}, ${mod}`);
    }
  });

  it('6.S5: an Edit of the project manifest, a unit\'s manifest, its spec-review.json, a verification run (6.2.3, 15.4.2), the ledger and the migrations record (29.17.6) is refused, each naming the engine verb that writes it where one does — with the mod off and on', () => {
    for (const [mod, env] of Object.entries(SURFACES)) {
      for (const [rel, reason] of Object.entries(ENGINE_FILES)) assertRefused(guard(dir, path.join(root, rel), { env, tool: 'Edit' }), `${rel}, ${mod}`, reason);
    }
  });

  it('11.9.1: a Write or Edit of a unit\'s spec.md is refused once its spec is concluded — the build begun on it — and goes through while it is only written', () => {
    const spec = path.join(root, layout.unit('pay', 'spec.md'));
    createManifest(dir, 'pay', {});
    fs.writeFileSync(spec, '## 1. Cards\n');
    const written = guard(dir, spec, { tool: 'Edit' });
    createManifest(dir, 'pay', { build: { position: 'auto' } });

    assertAllowed(written, 'a written spec');
    for (const tool of ['Write', 'Edit']) {
      assertRefused(guard(dir, spec, { tool }), `a concluded spec, ${tool}`, `${STATE_DIR_NAME}/${layout.unit('pay', 'spec.md')} is pay's concluded spec, never corrected — a later change replaces its entry on the ledger`);
    }
  });

  it('a place in the layout passes silently whatever its kind — a file, a log, a free folder\'s contents at any depth, one of today\'s places', () => {
    for (const rel of [layout.unit('pay', 'spec.md'), layout.unit('pay', 'build', 'log.md'), layout.unit('pay', 'assets', 'mockups', 'home.png'), layout.cache('x'), layout.doc('pay', 'discussion', 'auth')]) {
      assertAllowed(guard(dir, path.join(root, rel)), rel);
    }
  });

  it('a file place\'s `.txt` beside it — a build agent\'s two-step write of a report or an account — passes as the place, and a `.txt` beside no file place is outside the layout', () => {
    for (const rel of [
      layout.unit('pay', 'build', 'tasks', '1.2.txt'), layout.unit('pay', 'build', 'tasks', '1.2', 'round-1-a.txt'),
      layout.unit('pay', 'build', 'phases', 'phase-1', 'review-b.txt'), layout.unit('pay', 'build', 'phases', 'phase-1', 'consolidation.txt'),
    ]) assertAllowed(guard(dir, path.join(root, rel)), rel);
    for (const rel of [layout.unit('pay', 'build', 'tasks', '1.2', 'notes.txt'), layout.unit('pay', 'build', 'notes.txt'), layout.unit('pay', 'manifest.txt')]) {
      assertRefused(guard(dir, path.join(root, rel)), rel, outsideReason(rel));
    }
  });

  it('a stray file in the review phase\'s folder is outside the layout — no place there takes a name a round\'s reports are not', () => {
    for (const rel of [layout.unit('pay', 'review', 'round-1', 'stray.md'), layout.unit('pay', 'review', 'auth', 'report.md')]) {
      assertRefused(guard(dir, path.join(root, rel)), rel, outsideReason(rel));
    }
  });

  it('a place named in another case is that place where the filesystem ignores case, and a path the layout has no place for where it keeps it', () => {
    const rel = layout.unit('PAY', 'Topics', 'auth', 'LOG.md');
    const res = guard(dir, path.join(root, rel));
    if (IGNORES_CASE) assertAllowed(res, rel);
    else assertRefused(res, rel, outsideReason(rel));
  });
});

describe('the ledger, refused (5.S7, 5.1.9, 5.4.2)', () => {
  it('Write, Edit and NotebookEdit on .ledger/.ledger.jsonl are refused with exit 2 — the code Claude Code blocks on — the reason on stderr, the ledger untouched', () => {
    fs.writeFileSync(ledger, '{"id":"e1"}\n');
    for (const tool of ['Write', 'Edit', 'NotebookEdit']) assertRefused(guard(dir, ledger, { tool }), tool);
    assert.strictEqual(fs.readFileSync(ledger, 'utf8'), '{"id":"e1"}\n');
  });

  it('is refused before the ledger exists, and by a relative path from the main checkout', () => {
    assertRefused(guard(dir, ledger), 'absent');
    assertRefused(guard(dir, `${STATE_DIR_NAME}/${layout.ledger}`), 'relative');
    assertRefused(guard(root, layout.ledger), 'from inside the state');
  });

  it('is refused through `..`', () => {
    assertRefused(guard(dir, path.join(root, 'pay') + `/../${layout.ledger}`), 'through a folder that does not exist');
    fs.mkdirSync(path.join(dir, 'src'));
    assertRefused(guard(dir, `src/../${STATE_DIR_NAME}/./${layout.ledger}`), 'through the code tree');
  });

  it('from a code worktree, the main checkout\'s ledger is refused, absolute or relative — the worktree\'s own path of that name is not the state', () => {
    const wt = codeWorktree();
    assertRefused(guard(wt, ledger), 'absolute');
    assertRefused(guard(wt, `../${STATE_DIR_NAME}/${layout.ledger}`), 'relative');
    assertAllowed(guard(wt, path.join(wt, STATE_DIR_NAME, layout.ledger)), 'the worktree holds no state');
  });

  it('through a symbolic link: to the state folder — a path the layout has no place for among them — to the ledger itself — dangling until the ledger is written — by a relative link read from the folder it sits in, and to the project', () => {
    const elsewhere = outside('links');
    fs.symlinkSync(root, path.join(elsewhere, 'state'));
    fs.symlinkSync(ledger, path.join(elsewhere, 'ledger'));
    fs.symlinkSync(path.relative(elsewhere, ledger), path.join(elsewhere, 'relative'));
    fs.symlinkSync(dir, path.join(elsewhere, 'project'));

    assertRefused(guard(dir, path.join(elsewhere, 'state', layout.ledger)), 'a link to the state folder');
    const scratchNotes = layout.unit('pay', 'scratch', 'notes.md');
    assertRefused(guard(dir, path.join(elsewhere, 'state', scratchNotes)), 'outside the layout, through a link to the state folder', outsideReason(scratchNotes));
    assertRefused(guard(dir, path.join(elsewhere, 'ledger')), 'a dangling link to the ledger');
    assertRefused(guard(dir, path.join(elsewhere, 'relative')), 'a relative link to the ledger');
    assertRefused(guard(path.join(elsewhere, 'project'), `${STATE_DIR_NAME}/${layout.ledger}`), 'from the project reached through a link');
  });

  it('a `..` is read from the path\'s text before any link is followed, as Claude Code\'s tools read it', () => {
    const elsewhere = outside('away');
    fs.symlinkSync(elsewhere, path.join(root, 'away'));
    fs.mkdirSync(path.join(root, 'pay'));
    fs.symlinkSync(path.join(root, 'pay'), path.join(elsewhere, 'unit'));
    assertRefused(guard(dir, `${path.join(root, 'away', 'sub')}/../../${layout.ledger}`), 'the text climbs back to the state root');
    assertAllowed(guard(dir, `${path.join(elsewhere, 'unit')}/../${layout.ledger}`), 'the text climbs out of the link, beside it');
  });

  it('in any case the filesystem reads as the ledger\'s — the ledger there or not yet written, the refusal naming it as written until it is, then as it is on disk — and only there: where it keeps case, another name in the state is outside the layout', () => {
    const check = (/** @type {string} */ what, /** @type {boolean} */ written) => {
      for (const name of ['.LEDGER.jsonl', '.ledger.JSONL']) {
        assertRefused(guard(dir, path.join(root, name)), `${name} ${what}`, IGNORES_CASE ? ledgerReason(written ? layout.ledger : name) : outsideReason(name));
      }
      assertRefusedInAnotherCase(guard(dir, path.join(dir, '.Ledger', layout.ledger)), `.Ledger/${layout.ledger} ${what}`);
    };
    check('before the ledger is written', false);
    fs.writeFileSync(ledger, '{"id":"e1"}\n');
    check('over the ledger', true);
    assertAllowed(guard(dir, path.join(root, layout.cache('Ledger.JSONL'))), 'another file in another case');
  });

  it('the state is the target\'s own project\'s: a conversation sitting in another project with state, or out of every project, is refused this one\'s ledger', () => {
    const other = fs.realpathSync(harness.setupGitFixture('engine-layout-hook-other-'));
    scratch.push(other);
    assertRefused(guard(other, ledger), 'from another project');
    assertRefused(guard(dir, statePath(other, layout.ledger)), 'the other project\'s, from this one');
    assertAllowed(guard(other, statePath(other, layout.unit('pay', 'spec.md'))), 'a place in the other project\'s layout');
    assertRefused(guard(outside('drifted'), ledger), 'from a folder in no project');
  });

  it('a relative target with no folder in the input is read from CLAUDE_PROJECT_DIR where the hook runs outside the project', () => {
    const stdin = JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: `${STATE_DIR_NAME}/${layout.ledger}`, content: 'x' } });
    assertRefused(harness.call(outside('drifted'), ['layout', 'guard'], { env: { CLAUDE_PROJECT_DIR: dir }, stdin }), 'relative');
  });
});

describe('everything else, allowed', () => {
  it('the code tree, and a folder outside the project, pass silently', () => {
    assertAllowed(guard(dir, path.join(dir, 'src/app.js')), 'code');
    assertAllowed(guard(dir, path.join(outside('elsewhere'), layout.ledger)), 'outside');
  });

  it('a file at user level passes — the trust log, a conversation\'s brief', () => {
    const config = outside('config');
    for (const rel of ['trust.jsonl', 'conversations/sess-1/briefs/b1.md']) {
      assertAllowed(guard(dir, path.join(config, rel), { env: { LEDGER_CONFIG_DIR: config } }), rel);
    }
  });

  it('a project with no state passes every write, its .ledger/.ledger.jsonl among them — and so does a folder in no repository', () => {
    const fresh = harness.initRepo(outside('fresh'));
    assertAllowed(guard(fresh, statePath(fresh, layout.ledger)), 'no state');
    const bare = outside('no-repo');
    assertAllowed(guard(bare, path.join(bare, STATE_DIR_NAME, layout.ledger)), 'no repository');
  });

  it('input naming no file, or none at all, passes', () => {
    for (const stdin of ['', '{not json', '[]', JSON.stringify({ tool_name: 'Write' }), hookInput(dir, 'Write', { content: 'x' })]) {
      assertAllowed(harness.call(dir, ['layout', 'guard'], { stdin }), stdin);
    }
  });

  it('writes nothing — the project, the state and the conversation\'s folder as they were', () => {
    const config = outside('config');
    guard(dir, ledger, { env: { CLAUDE_CODE_SESSION_ID: 'sess-1', LEDGER_CONFIG_DIR: config } });
    guard(dir, path.join(root, layout.projectManifest), { env: { CLAUDE_CODE_SESSION_ID: 'sess-1', LEDGER_CONFIG_DIR: config } });
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
