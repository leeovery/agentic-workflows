'use strict';

// ---------------------------------------------------------------------------
// What the quick-fix suites share (test-engine-quick-fix.cjs,
// test-engine-quick-fix-record.cjs, test-engine-quick-fix-end.cjs,
// test-engine-quick-fix-close.cjs, test-engine-landing-conformance-quick-fix.cjs,
// tests/drivers/github/test-landing-quick-fix.cjs): the quick-fix, made through
// `workunit create` from an inbox note, its code and the build's skill
// committed, and a feature beside it (`quickFix`); a fix's task file, fix
// `n` naming its one scenario `{n}.S1` (`fixFile`), and its creation
// through the tracker's verb (`createFix`); a fix's change made as Claude
// makes one in the conversation — started, putting the checkout on its
// branch, its change committed through the door (`fixChanged`) — and the
// fix built, its pull request then opened and the fix done (`fixBuilt`);
// its short record's file (`recordFile`), fixes 1.1 and 1.2's as Claude
// writes them (`RECORDS`); the quick-fix entered by a conversation gone
// since, those two fixes built, 1.2 laid on 1.1 (`twoFixesBuilt`); the
// knowledge base's chunks of `summary.md` (`summaryChunks`); a git command
// run as Claude runs one in the conversation, the shell guard asked first
// (`guardedGit`); finish's checklist worked and closed (`checklistClosed`);
// and a world built by a conversation gone since, its records in a config
// folder of its own, removed once the world is built (`asGone`).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { call, ok, okSections, writeState, createFile, commitAll, statePath, layout, GIT_TIMEOUT_MS } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const store = require(path.join(SCRIPTS, 'kernel/knowledge/store.cjs'));
const { knowledgeFiles } = require(path.join(SCRIPTS, 'kernel/knowledge/files.cjs'));

const UNIT = 'typo';
const PLACE = `${UNIT}.implementation`;
const DESCRIPTION = 'The --color flag is spelt --colour';
const NOTE = layout.inbox('quickfixes', '2026-06-03--colour-flag.md');
const FLAG = 'Spell the flag --colour';
const HELP = 'Spell the help --colour';

/** Fixes 1.1 and 1.2's short records, as Claude writes them. */
const RECORDS = Object.freeze({
  1: { changed: 'The flag parser reads --colour.', why: 'The flag was spelt the American way.', leaves: 'Old scripts passing --color.' },
  2: { changed: 'The help page names --colour.\nIts example uses it too.', why: 'The help matched the old flag.', leaves: 'The man page.' },
});

/** A call's options for a conversation: its session and config folder, and any environment beside. @typedef {{env: Record<string, string|undefined>}} As */

/** Fix `n`'s task file, titled `title`, its one scenario `{n}.S1`. @param {number} n @param {string} title */
const fixFile = (n, title) => [
  `# ${title}`, '', '## Type', 'fix', '', '## Problem', 'The flag reads --color.', '', '## Solution', 'Rename the flag.', '',
  '## Outcome', 'The flag reads --colour.', '', '## Acceptance scenarios', `- ${n}.S1 Given the help, when it is read, then it names --colour.`, '', '## Spec reference', 'none',
].join('\n');

/** The quick-fix made from its inbox note, beside a feature, the code committed. @param {string} dir */
function quickFix(dir) {
  createFile(dir, 'src/flag.js', 'const flag = \'color\';\n');
  createFile(dir, '.claude/skills/leeway-implementation-process/SKILL.md', '# The build\n');
  writeState(dir, NOTE, '# The colour flag\n');
  createManifest(dir, 'other', {});
  commitAll(dir, 'init');
  const log = writeState(dir, layout.cache(UNIT, 'session-001.md'), '# Discovery Session 001\n');
  ok(dir, ['workunit', 'create', UNIT, 'quick-fix', '--description', DESCRIPTION, '--session-log-file', log, '--seed', `.leeway/${NOTE}`]);
}

/** Fix `n` made through the tracker's verb. @param {string} dir @param {number} n @param {string} title @param {As} [as] */
const createFix = (dir, n, title, as) => ok(dir, ['task', 'create', UNIT, '1', '--file', writeState(dir, layout.cache(`fix-${n}.md`), fixFile(n, title))], as);

/**
 * Fix `n`'s change made in the conversation `as` names: the fix made,
 * started — the checkout put on its branch — and `file` written with
 * `text` and committed through the door.
 * @param {string} dir @param {number} n @param {string} title @param {string} file @param {string} text @param {As} as
 */
function fixChanged(dir, n, title, file, text, as) {
  createFix(dir, n, title, as);
  ok(dir, ['task', 'start', UNIT, `1.${n}`], as);
  createFile(dir, file, text);
  ok(dir, ['commit', '--paths', file, '--task', UNIT, `1.${n}`, '-m', `fix(${UNIT}): ${title.toLowerCase()}`], as);
}

/**
 * Fix `n` built as Claude builds one in the conversation `as` names: its
 * change made (`fixChanged`), its pull request opened, and done.
 * @param {string} dir @param {number} n @param {string} title @param {string} file @param {string} text @param {As} as
 */
function fixBuilt(dir, n, title, file, text, as) {
  fixChanged(dir, n, title, file, text, as);
  const opened = ok(dir, ['land', 'open', UNIT, `1.${n}`], as);
  ok(dir, ['task', 'done', UNIT, `1.${n}`], as);
  return opened;
}

/** A fix's short record, as Claude writes it: its file, absolute. @param {string} dir @param {number} n @param {{changed: string, why: string, leaves: string}} record */
const recordFile = (dir, n, { changed, why, leaves }) => writeState(dir, layout.cache(`record-${n}.md`), ['## What changed', changed, '', '## Why', why, '', '## Leaves out', leaves, ''].join('\n'));

/**
 * The quick-fix entered by a conversation gone since, fixes 1.1 and 1.2 —
 * 1.2 laid on 1.1 — each built (`fixBuilt`): `ready` run on the project
 * once the quick-fix is made, as a driver's side readies it, and every call
 * made with `env` beside the conversation's.
 * @param {string} dir @param {{ready?: (dir: string) => void, env?: Record<string, string|undefined>}} [options]
 */
function twoFixesBuilt(dir, { ready = () => {}, env = {} } = {}) {
  quickFix(dir);
  ready(dir);
  asGone((as) => {
    entered(dir, as);
    fixBuilt(dir, 1, FLAG, 'src/flag.js', 'const flag = \'colour\';\n', as);
    fixBuilt(dir, 2, HELP, 'src/help.js', 'const help = \'--colour\';\n', as);
  }, env);
}

/** The knowledge base's chunks of the unit's `summary.md`, each by the heading it sits under. @param {string} dir */
const summaryChunks = (dir) => store.allChunks(store.loadStore(knowledgeFiles(statePath(dir)).store))
  .filter((chunk) => chunk.source_file === layout.unit(UNIT, 'summary.md'))
  .map((chunk) => chunk.heading_path);

/**
 * A git command run in the project as Claude runs one in the conversation
 * `as` names: the shell guard asked first, as Claude Code asks it before the
 * command, and the command run once it passes, its output taken as Claude
 * Code takes it — a refusal, or the command failing, failing the test in
 * the guard's words or git's. Its output.
 * @param {string} dir @param {string[]} args git's, none holding a space @param {As} as
 */
function guardedGit(dir, args, as) {
  const command = ['git', ...args].join(' ');
  const asked = call(dir, ['shell', 'guard'], {
    env: as.env,
    stdin: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: dir, session_id: as.env.CLAUDE_CODE_SESSION_ID, tool_name: 'Bash', tool_input: { command } }),
  });
  if (asked.code !== 0) throw new Error(`the shell guard refuses \`${command}\`: ${asked.stderr.trim()}`);
  const ran = spawnSync('git', args, { cwd: dir, encoding: 'utf8', timeout: GIT_TIMEOUT_MS });
  if (ran.status !== 0) throw new Error(`\`${command}\` failed: ${ran.stderr.trim()}`);
  return ran.stdout;
}

/** Finish's checklist worked and closed in the conversation `as` names, the build's log written. @param {string} dir @param {As} as */
function checklistClosed(dir, as) {
  writeState(dir, layout.unit(UNIT, 'build', 'log.md'), '# The fixes\n');
  for (const key of ['inbox-closed', 'build-log-closed']) ok(dir, ['checklist', 'done', 'finish', UNIT, key], as);
  ok(dir, ['checklist', 'close', 'finish', UNIT], as);
}

/**
 * `build` run as a conversation gone since: its options, its records in a
 * config folder of its own, removed once it ends.
 * @param {(as: As) => void} build @param {Record<string, string|undefined>} [env] beside the conversation's
 */
function asGone(build, env = {}) {
  const gone = fs.mkdtempSync(path.join(os.tmpdir(), 'quick-fix-gone-'));
  try {
    build({ env: { ...env, LEEWAY_CONFIG_DIR: gone, CLAUDE_CODE_SESSION_ID: 'gone', TMUX: undefined, TMUX_PANE: undefined } });
  } finally {
    fs.rmSync(gone, { recursive: true, force: true });
  }
}

/** The quick-fix entered by the conversation `as` names, its fixes begun, and its presence there cleared. @param {string} dir @param {As} as */
function entered(dir, as) {
  okSections(dir, ['enter', 'implementation', UNIT], as);
  ok(dir, ['presence', 'clear', UNIT, 'implementation', UNIT], as);
}

module.exports = {
  UNIT, PLACE, DESCRIPTION, NOTE, FLAG, HELP, RECORDS, fixFile, quickFix, createFix, fixChanged, fixBuilt, recordFile, twoFixesBuilt, summaryChunks, guardedGit, checklistClosed, asGone, entered,
};
