'use strict';

// ---------------------------------------------------------------------------
// What the quick-fix suites share (test-engine-quick-fix.cjs,
// test-engine-quick-fix-close.cjs, test-engine-landing-conformance-quick-fix.cjs):
// the quick-fix, made through `workunit create` from an inbox note, its code
// and the build's skill committed, and a feature beside it (`quickFix`); a
// fix's task file, fix `n` naming its one scenario `{n}.S1` (`fixFile`), and
// its creation through the tracker's verb (`createFix`); a fix built as
// Claude builds one in the conversation — started, putting the checkout on
// its branch, its change committed through the door, its pull request
// opened and the fix done (`fixBuilt`); its short record's file
// (`recordFile`); and a world built by a conversation gone since, its
// records in a config folder of its own, removed once the world is built
// (`asGone`).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { ok, okSections, writeState, createFile, commitAll, layout } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const UNIT = 'typo';
const PLACE = `${UNIT}.implementation`;
const DESCRIPTION = 'The --color flag is spelt --colour';
const NOTE = layout.inbox('quickfixes', '2026-06-03--colour-flag.md');

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
 * Fix `n` built as Claude builds one in the conversation `as` names: made,
 * started — the checkout put on its branch — `file` written with `text` and
 * committed through the door, its pull request opened, and done.
 * @param {string} dir @param {number} n @param {string} title @param {string} file @param {string} text @param {As} as
 */
function fixBuilt(dir, n, title, file, text, as) {
  const task = `1.${n}`;
  createFix(dir, n, title, as);
  ok(dir, ['task', 'start', UNIT, task], as);
  createFile(dir, file, text);
  ok(dir, ['commit', '--paths', file, '--task', UNIT, task, '-m', `fix(${UNIT}): ${title.toLowerCase()}`], as);
  const opened = ok(dir, ['land', 'open', UNIT, task], as);
  ok(dir, ['task', 'done', UNIT, task], as);
  return opened;
}

/** A fix's short record, as Claude writes it: its file, absolute. @param {string} dir @param {number} n @param {{changed: string, why: string, leaves: string}} record */
const recordFile = (dir, n, { changed, why, leaves }) => writeState(dir, layout.cache(`record-${n}.md`), ['## What changed', changed, '', '## Why', why, '', '## Leaves out', leaves, ''].join('\n'));

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

module.exports = { UNIT, PLACE, DESCRIPTION, NOTE, fixFile, quickFix, createFix, fixBuilt, recordFile, asGone, entered };
