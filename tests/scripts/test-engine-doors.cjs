'use strict';

// ---------------------------------------------------------------------------
// The doors as one table (2.S1; 2.2.2, 2.2.9): for each contract an engine
// verb holds, each other route Claude could take is refused, and the verb's
// own route lands — an Edit of a unit's manifest, by the layout hook, and a
// shell write to it, by the hook before Bash, where `manifest set` lands; a
// Write to the ledger, by the layout hook, and a shell append to it, by the
// hook before Bash, where a ledger verb lands; a stray file under the
// state, by the state commit, and a raw `git commit` in the state worktree,
// by the hook before Bash, where the state commit lands a file in the
// layout; a raw `git commit` during a build, by the hook before Bash, and a
// code commit naming no task, by the commit door, where `commit --task`
// lands. Each door's own suite proves its details; this one holds the table
// whole. The contracts no verb lands through are proven in their doors'
// suites alone: the files at user level only the engine writes, refused to
// Claude's Write and Edit (test-engine-layout-hook.cjs) and to a shell
// command naming them (test-engine-shell-guard.cjs), and the state worktree
// and its branch, unlocked, removed, deleted or force-pushed by a shell
// command (test-engine-shell-guard.cjs, 4.S7).
//
// Layer: verb. World: a unit with a task written, its discussion under way
// and its code committed; the task started in one conversation; built once
// and copied for each row.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  call, ok, refusedPristine, git, commitAll, fixtureFrom, cleanupFixture, statePath, layout, createFile, readManifest, ledgerEntries, touched, STATE_DIR_NAME,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const UNIT = 'pay';
const BUILDING = 'doors-building';
const AS_BUILDER = Object.freeze({ env: { CLAUDE_CODE_SESSION_ID: BUILDING } });
const CONFIG = /** @type {string} */ (process.env.LEEWAY_CONFIG_DIR);
const CARD = 'src/card.js';
const MESSAGE = 'feat(pay): take a card';
const TASK = [
  '# Take a card', '', '## Type', 'feat', '', '## Problem', 'A card cannot be taken.', '', '## Solution', 'Add the card form.', '',
  '## Outcome', 'A card is taken.', '', '## Acceptance scenarios', '- Given a card, when it is taken, then it is charged.', '', '## Spec reference', '§1',
].join('\n');

const world = fixtureFrom('doors-', (dir) => {
  createManifest(dir, UNIT, { phases: { discussion: { items: { [UNIT]: { status: 'in-progress' } } } } });
  createFile(dir, CARD, 'const card = 1;\n');
  commitAll(dir, 'init');
  ok(dir, ['task', 'phase', UNIT, '1', '--title', 'Cards']);
  const file = path.join(dir, '..', 'doors-task.md');
  fs.writeFileSync(file, TASK);
  ok(dir, ['task', 'create', UNIT, '1', '--file', file]);
  fs.rmSync(file);
  ok(dir, ['task', 'start', UNIT, '1.1'], AS_BUILDER);
});

after(() => fs.rmSync(path.join(CONFIG, 'conversations', BUILDING), { recursive: true, force: true }));

/**
 * The hook `verb` run as Claude Code runs it before `tool`, in the building
 * conversation.
 * @param {string} dir @param {string} verb @param {string} tool @param {Record<string, unknown>} toolInput
 */
function hook(dir, verb, tool, toolInput) {
  const stdin = JSON.stringify({ session_id: BUILDING, cwd: dir, hook_event_name: 'PreToolUse', tool_name: tool, tool_input: toolInput });
  return call(dir, [verb, 'guard'], { stdin });
}

/** A hook's refusal: exit 2, its reason naming `way`, nothing on stdout. @param {{code: number, stdout: string, stderr: string}} res @param {RegExp} way */
function assertBlocked(res, way) {
  assert.deepStrictEqual([res.code, res.stdout], [2, '']);
  assert.match(res.stderr, way);
}

/** The code's HEAD. @param {string} dir */
const codeHead = (dir) => git(dir, ['rev-parse', 'HEAD']).trim();

/** The card's change committed through the door, for the task in flight: the commit's message. @param {string} dir */
function committedForTask(dir) {
  const before = codeHead(dir);
  ok(dir, ['commit', '--paths', CARD, '--task', UNIT, '1.1', '-m', MESSAGE], AS_BUILDER);
  assert.notStrictEqual(codeHead(dir), before);
  return git(dir, ['log', '-1', '--format=%B']);
}

/** `manifest set` on the unit's manifest, landing. @param {string} dir */
function manifestSet(dir) {
  ok(dir, ['manifest', 'set', UNIT, 'description', 'Cards']);
  assert.strictEqual(readManifest(dir, UNIT).description, 'Cards');
}

/** A finding the ledger verb writes, landing. @param {string} dir */
function ledgerFind(dir) {
  ok(dir, ['ledger', 'find', `${UNIT}.discussion.${UNIT}`], { ...AS_BUILDER, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Cards settle in a day.', how: 'The processor\'s terms', known: 'documented' }) });
  assert.deepStrictEqual(ledgerEntries(statePath(dir)).map(({ event, text }) => [event, text]), [['found', 'Cards settle in a day.']]);
}

/** A file in the layout committed by the state commit's verb, landing. @param {string} dir */
function stateCommitted(dir) {
  const brief = layout.topic(UNIT, UNIT, 'brief.md');
  createFile(statePath(dir), brief, '# pay\n');
  const { committed } = ok(dir, ['commit', UNIT, '-m', 'discussion(pay): notes']);
  assert.deepStrictEqual(touched(statePath(dir), committed), [`A\t${brief}`]);
}

/**
 * Each contract: a route around its verb, refused, and the verb's own,
 * landing — each on its own copy of the world.
 * @type {{contract: string, refused: (dir: string) => void, lands: (dir: string) => void}[]}
 */
const DOORS = [
  {
    contract: 'a unit\'s manifest: an Edit, by the layout hook; `manifest set` lands',
    refused: (dir) => assertBlocked(
      hook(dir, 'layout', 'Edit', { file_path: statePath(dir, layout.manifest(UNIT)), old_string: 'Test: pay', new_string: 'Cards' }),
      /engine manifest set/,
    ),
    lands: manifestSet,
  },
  {
    contract: 'a unit\'s manifest: a shell write, by the hook before Bash; `manifest set` lands',
    refused: (dir) => assertBlocked(
      hook(dir, 'shell', 'Bash', { command: `sed -i '' 's/"in-progress"/"completed"/' ${STATE_DIR_NAME}/${layout.manifest(UNIT)}` }),
      /engine manifest set/,
    ),
    lands: manifestSet,
  },
  {
    contract: 'the ledger: a Write, by the layout hook; a ledger verb lands',
    refused: (dir) => assertBlocked(
      hook(dir, 'layout', 'Write', { file_path: statePath(dir, layout.ledger), content: '{}\n' }),
      /engine ledger ask\|find\|decide/,
    ),
    lands: ledgerFind,
  },
  {
    contract: 'the ledger: a shell append, by the hook before Bash; a ledger verb lands',
    refused: (dir) => assertBlocked(
      hook(dir, 'shell', 'Bash', { command: `echo '{"event":"found","text":"Cards settle in a day."}' >> ${STATE_DIR_NAME}/${layout.ledger}` }),
      /engine ledger ask\|find\|decide/,
    ),
    lands: ledgerFind,
  },
  {
    contract: 'the layout: a stray file under the state, by the state commit; a file in the layout lands',
    refused: (dir) => {
      createFile(statePath(dir), layout.unit(UNIT, 'tmp', 'x.md'), 'scratch\n');
      assert.match(refusedPristine(dir, ['commit', UNIT, '-m', 'discussion(pay): notes']).error, /outside the workflows' layout/);
    },
    lands: (dir) => {
      fs.rmSync(statePath(dir, layout.unit(UNIT, 'tmp')), { recursive: true });
      stateCommitted(dir);
    },
  },
  {
    contract: 'a state commit: a raw `git commit` in the state worktree, by the hook before Bash; the state commit lands',
    refused: (dir) => assertBlocked(hook(dir, 'shell', 'Bash', { command: `git -C ${STATE_DIR_NAME} commit -am "discussion(pay): notes"` }), /every state commit is the engine's/),
    lands: stateCommitted,
  },
  {
    contract: 'a code commit during a build: a raw `git commit`, by the hook before Bash; `commit --task` lands',
    refused: (dir) => assertBlocked(hook(dir, 'shell', 'Bash', { command: `git commit -m "${MESSAGE}" ${CARD}` }), /engine commit --paths <file>… --task pay 1\.1/),
    lands: (dir) => assert.match(committedForTask(dir), /\nLeeway-Task: pay-1-1\n/),
  },
  {
    contract: 'a code commit\'s task: one naming no task, by the commit door; `commit --task` lands',
    refused: (dir) => {
      assert.match(refusedPristine(dir, ['commit', '--paths', CARD, '-m', MESSAGE], AS_BUILDER).error, /^Usage: engine commit /);
      assert.strictEqual(git(dir, ['status', '--porcelain', '--', CARD]), ` M ${CARD}\n`, 'the card stays uncommitted');
    },
    lands: (dir) => assert.match(committedForTask(dir), /\nLeeway-Task: pay-1-1\n/),
  },
];

describe('the doors (2.S1)', () => {
  for (const { contract, refused, lands } of DOORS) {
    it(`${contract} (2.S1)`, (t) => {
      const dir = world();
      t.after(() => cleanupFixture(dir));
      createFile(dir, CARD, 'const card = 2;\n');

      refused(dir);
      lands(dir);
    });
  }
});
