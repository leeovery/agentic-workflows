'use strict';

// ---------------------------------------------------------------------------
// What the quick-fix suites share (test-engine-quick-fix*.cjs,
// test-engine-landing-conformance-quick-fix*.cjs, and a landing driver's own
// quick-fix suites): the quick-fix, made through `workunit create` from an
// inbox note, or from none, its code and its skill committed, and a feature beside
// it (`quickFix`); its one branch (`BRANCH`), which every fix of it commits
// on; a fix's task file, fix `n` naming its one scenario `{n}.S1`
// (`fixFile`), and its creation through the tracker's verb (`createFix`); a
// fix's change made as its builder makes one — started, putting the
// checkout on the quick-fix's branch, its change committed through the
// door (`fixChanged`) — and the fix built, the quick-fix's pull request
// then opened, or its commit pushed to it, its pair's pass and its account
// taken, and the fix done (`fixBuilt`), or any task of it so ended
// (`fixDone`); its short record's file (`recordFile`), fixes 1.1 and 1.2's
// as Claude writes them (`RECORDS`); three fixes' titles, files and texts
// (`SET`); the quick-fix entered by a conversation gone since, the set's
// first two fixes built (`twoFixesBuilt`); what a quick-fix conformance
// suite reads a landing driver by (`quickFixConformance`), and one across
// nested repositories (`quickFixNestedConformance`); the knowledge base's
// chunks of `summary.md` (`summaryChunks`); a git command run as
// Claude runs one in the conversation, the shell guard asked first
// (`guardedGit`); a commit of the person's own (`ownCommit`), on a branch
// of the quick-fix's name they made (`ownBranchCommit`); finish's checklist
// worked and closed (`checklistClosed`), the fixes recorded before it
// (`fixesRecorded`), and the close's yes as its menu words it (`closeYes`);
// and a world built by a conversation gone since, its records in a config
// folder of its own, removed once the world is built (`asGone`).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { afterEach } = require('node:test');
const {
  call, ok, okSections, output, sectionOf, writeState, createFile, commitAll, commitCode, git, statePath, layout, fixtureFrom, folderFrom, setupFixtureAt, initRepo, addSubmodule, cleanupFixture, accountTaken, GIT_TIMEOUT_MS,
} = require('./engine-harness.cjs');
const { createManifest, useTempFolder } = require('./discovery-test-utils.cjs');
const { NESTED } = require('./landing-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const store = require(path.join(SCRIPTS, 'kernel/knowledge/store.cjs'));
const { knowledgeFiles } = require(path.join(SCRIPTS, 'kernel/knowledge/files.cjs'));
const { quickFixBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));

const UNIT = 'typo';
const PLACE = `${UNIT}.implementation`;
const DESCRIPTION = 'The --color flag is spelt --colour';
const NOTE = layout.inbox('quickfixes', '2026-06-03--colour-flag.md');
const FLAG = 'Spell the flag --colour';
const HELP = 'Spell the help --colour';
const BRANCH = quickFixBranch(UNIT);

/** Three fixes' titles, the file each changes and its text there, built one after another. */
const SET = Object.freeze([
  { title: FLAG, file: 'src/flag.js', text: 'const flag = \'colour\';\n' },
  { title: HELP, file: 'src/help.js', text: 'const help = \'--colour\';\n' },
  { title: 'Spell the docs --colour', file: 'docs/flags.md', text: '# Flags\n\n--colour\n' },
]);

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

/** The quick-fix made from its inbox note, or where `seeded` is false from none, beside a feature, the code committed. @param {string} dir @param {{seeded?: boolean}} [options] */
function quickFix(dir, { seeded = true } = {}) {
  createFile(dir, 'src/flag.js', 'const flag = \'color\';\n');
  createFile(dir, '.claude/skills/leeway-quick-fix-process/SKILL.md', '# Quick-Fix\n');
  writeState(dir, NOTE, '# The colour flag\n');
  createManifest(dir, 'other', {});
  commitAll(dir, 'init');
  const log = writeState(dir, layout.cache(UNIT, 'session-001.md'), '# Discovery Session 001\n');
  ok(dir, ['workunit', 'create', UNIT, 'quick-fix', '--description', DESCRIPTION, '--session-log-file', log, ...(seeded ? ['--seed', `.leeway/${NOTE}`] : [])]);
}

/** Fix `n` made through the tracker's verb. @param {string} dir @param {number} n @param {string} title @param {As} [as] */
const createFix = (dir, n, title, as) => ok(dir, ['task', 'create', UNIT, '1', '--file', writeState(dir, layout.cache(`fix-${n}.md`), fixFile(n, title))], as);

/**
 * Fix `n`'s change made in the conversation `as` names: the fix made,
 * started — the checkout put on the quick-fix's branch — and `file` written
 * with `text` and committed through the door.
 * @param {string} dir @param {number} n @param {string} title @param {string} file @param {string} text @param {As} as
 */
function fixChanged(dir, n, title, file, text, as) {
  createFix(dir, n, title, as);
  ok(dir, ['task', 'start', UNIT, `1.${n}`], as);
  createFile(dir, file, text);
  ok(dir, ['commit', '--paths', file, '--task', UNIT, `1.${n}`, '-m', `fix(${UNIT}): ${title.toLowerCase()}`], as);
}

/**
 * Fix `n` built in the conversation `as` names: its change made
 * (`fixChanged`), the quick-fix's pull request opened, or the commit pushed
 * to it, its pair's pass and its account taken, and done.
 * @param {string} dir @param {number} n @param {string} title @param {string} file @param {string} text @param {As} as
 */
function fixBuilt(dir, n, title, file, text, as) {
  fixChanged(dir, n, title, file, text, as);
  const opened = ok(dir, ['land', 'open', UNIT, `1.${n}`], as);
  fixDone(dir, `1.${n}`, as);
  return opened;
}

/** The quick-fix's task, shown, passed by its pair, its account taken, and done. @param {string} dir @param {string} task @param {As} [as] */
function fixDone(dir, task, as) {
  accountTaken(dir, UNIT, task);
  return ok(dir, ['task', 'done', UNIT, task], as);
}

/** A fix's short record, as Claude writes it: its file, absolute. @param {string} dir @param {number} n @param {{changed: string, why: string, leaves: string}} record */
const recordFile = (dir, n, { changed, why, leaves }) => writeState(dir, layout.cache(`record-${n}.md`), ['## What changed', changed, '', '## Why', why, '', '## Leaves out', leaves, ''].join('\n'));

/**
 * The quick-fix entered by a conversation gone since, the set's fixes 1.1
 * and 1.2 each built (`fixBuilt`): `ready` run on the project once the
 * quick-fix is made, as a driver's side readies it, and every call made
 * with `env` beside the conversation's.
 * @param {string} dir @param {{ready?: (dir: string) => void, env?: Record<string, string|undefined>}} [options]
 */
function twoFixesBuilt(dir, { ready = () => {}, env = {} } = {}) {
  quickFix(dir);
  ready(dir);
  asGone((as) => {
    entered(dir, as);
    SET.slice(0, 2).forEach(({ title, file, text }, at) => fixBuilt(dir, at + 1, title, file, text, as));
  }, env);
}

/**
 * What a quick-fix conformance suite reads a landing driver by: its side
 * (tests/drivers/{name}/landing.cjs); the calls' options under the side's
 * environment, in the suite's conversation; a copy at each call of the
 * quick-fix readied for the driver, its code tagged `landing-base`, built
 * once per process, entered — every copy removed after its test; fix `n`
 * of `SET` changed (`fixChanged`) and recorded; what the default branch
 * gained, each landing by its subject and the paths it changed; and fixes
 * 1.1 and 1.2 recorded and the close made, landing them.
 * @param {string} name the driver's @param {string} prefix the copies' temp-directory prefix
 */
function quickFixConformance(name, prefix) {
  /** @type {import('./landing-world.cjs').DriverSide} */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const config = useTempFolder(`${prefix}config-`);
  const world = fixtureFrom(prefix, (dir) => {
    quickFix(dir);
    git(dir, ['tag', 'landing-base']);
    side.prepare(dir);
  });
  /** @type {string[]} */
  let made = [];
  afterEach(() => {
    made.forEach(cleanupFixture);
    made = [];
  });
  /** @returns {As} */
  const as = () => ({ env: { ...side.env, LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });
  /** @param {string} at @param {number} n */
  const record = (at, n) => ok(at, ['quick-fix', 'record', UNIT, `1.${n}`, '--file', recordFile(at, n, { changed: `${SET[n - 1].title}.`, why: 'It was spelt the American way.', leaves: 'Nothing.' })], as());
  return {
    side,
    as,
    record,
    /** A copy of the world, the quick-fix entered by the suite's conversation. */
    project: () => {
      const dir = world();
      made.push(dir);
      entered(dir, as());
      return dir;
    },
    /** Fix `n` of the set changed in the suite's conversation. @param {string} at @param {number} n */
    changed: (at, n) => fixChanged(at, n, SET[n - 1].title, SET[n - 1].file, SET[n - 1].text, as()),
    /** Fix `n` of the set built in the suite's conversation (`fixBuilt`). @param {string} at @param {number} n */
    built: (at, n) => fixBuilt(at, n, SET[n - 1].title, SET[n - 1].file, SET[n - 1].text, as()),
    /** What the default branch gained, each landing by its subject and the paths it changed. @param {string} at */
    landed: (at) => side.landed(at).map((/** @type {any} */ { subject, paths }) => [subject, paths]),
    /** Fixes 1.1 and 1.2 recorded and the close made, landing them. @param {string} at */
    closed: (at) => {
      record(at, 1);
      record(at, 2);
      checklistClosed(at, as());
      ok(at, ['finish', 'yes', UNIT], as());
    },
  };
}

/** A copy of the quick-fix nesting repositories: the project, and its submodule's and clone's checkouts. @typedef {{dir: string, ext: string, lib: string}} NestedQuickFix */

/**
 * What a quick-fix suite across nested repositories reads a landing driver
 * by (7.2.24): its side; the calls' options in the suite's conversation; a
 * copy at each call of the quick-fix in a project nesting a submodule and a
 * clone (landing-world.cjs's `NESTED`), each repository's code tagged
 * `landing-base` and readied for the driver, built once per process,
 * entered — every copy removed after its test; fix `n` opened through the
 * door from the files it writes, each by its path in the project —
 * started, committed and opened, the opening's answer; ended, done and
 * recorded; and built, both, the opening's answer; the close made, its
 * answer; what each repository's default branch gained, each landing by
 * its task and the paths it changed; and a nested repository's branch gone
 * here — its checkout put on the branch it lands on, the branch and its
 * remote's copy here deleted — or, as a second clone of it has it, with
 * no commit of the branch's left in a reflog either.
 * @param {string} name the driver's @param {string} prefix the copies' temp-directory prefix
 */
function quickFixNestedConformance(name, prefix) {
  /** @type {import('./landing-world.cjs').DriverSide} */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const config = useTempFolder(`${prefix}config-`);
  const world = folderFrom(prefix, (folder) => {
    const dir = setupFixtureAt(path.join(folder, 'project'));
    const upstream = initRepo(path.join(folder, NESTED.ext.folder));
    createFile(upstream, 'ext.txt', 'ext\n');
    commitCode(upstream, 'the ext');
    const ext = addSubmodule(dir, NESTED.ext.folder, upstream);
    git(ext, ['remote', 'remove', 'origin']);
    const lib = initRepo(path.join(dir, NESTED.lib.folder));
    git(lib, ['symbolic-ref', 'HEAD', `refs/heads/${NESTED.lib.into}`]);
    git(lib, ['config', 'init.defaultBranch', NESTED.lib.into]);
    createFile(lib, 'lib.txt', 'lib\n');
    commitCode(lib, 'the lib');
    fs.mkdirSync(path.join(dir, '.git', 'info'), { recursive: true });
    fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), `/${NESTED.lib.folder}/\n`);
    quickFix(dir);
    for (const repo of [dir, ext, lib]) git(repo, ['tag', 'landing-base']);
    side.prepare(dir);
    for (const { folder: at, into } of Object.values(NESTED)) side.nest(path.join(dir, at), into);
  });
  /** @type {string[]} */
  let made = [];
  afterEach(() => {
    made.forEach(cleanupFixture);
    made = [];
  });
  /** @returns {As} */
  const as = () => ({ env: { ...side.env, LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });
  return {
    side,
    as,
    /** A copy of the world, the quick-fix entered by the suite's conversation. @returns {NestedQuickFix} */
    project: () => {
      const folder = world(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
      made.push(folder);
      const dir = path.join(folder, 'project');
      entered(dir, as());
      return { dir, ext: path.join(dir, NESTED.ext.folder), lib: path.join(dir, NESTED.lib.folder) };
    },
    opened,
    ended,
    /**
     * Fix `n` built from `files`, by their paths in the project, its record written: the opening's answer.
     * @param {NestedQuickFix} at @param {number} n @param {Record<string, string>} files
     */
    built: (at, n, files) => {
      const answer = opened(at, n, files);
      ended(at, n);
      return answer;
    },
    /** The close made, its answer. @param {NestedQuickFix} at */
    closed: (at) => {
      checklistClosed(at.dir, as());
      return ok(at.dir, ['finish', 'yes', UNIT], as());
    },
    /** What each repository's default branch gained, each landing by its task and the paths it changed. @param {NestedQuickFix} at */
    landed: (at) => Object.fromEntries([['.', at.dir, 'main'], ['ext', at.ext, NESTED.ext.into], ['lib', at.lib, NESTED.lib.into]]
      .map(([repo, dir, into]) => [repo, side.landed(dir, into).map(({ task, paths }) => [task, paths])])),
    gone,
    /** The nested repository at `dir` as a second clone of it has it: its branch gone here, and in every reflog. @param {string} dir @param {string} into */
    secondClone: (dir, into) => {
      gone(dir, into);
      git(dir, ['reflog', 'expire', '--expire=now', '--all']);
    },
  };

  /**
   * Fix `n` started, committed from `files`, by their paths in the project, and opened: the opening's answer.
   * @param {NestedQuickFix} at @param {number} n @param {Record<string, string>} files
   */
  function opened(at, n, files) {
    createFix(at.dir, n, SET[n - 1].title, as());
    ok(at.dir, ['task', 'start', UNIT, `1.${n}`], as());
    for (const [file, text] of Object.entries(files)) createFile(at.dir, file, text);
    ok(at.dir, ['commit', '--paths', ...Object.keys(files), '--task', UNIT, `1.${n}`, '-m', `fix(${UNIT}): ${SET[n - 1].title.toLowerCase()}`], as());
    return ok(at.dir, ['land', 'open', UNIT, `1.${n}`], as());
  }

  /** Fix `n` passed by its pair, its account taken, done and its record written. @param {NestedQuickFix} at @param {number} n */
  function ended(at, n) {
    fixDone(at.dir, `1.${n}`, as());
    ok(at.dir, ['quick-fix', 'record', UNIT, `1.${n}`, '--file', recordFile(at.dir, n, { changed: `${SET[n - 1].title}.`, why: 'It was spelt the American way.', leaves: 'Nothing.' })], as());
  }

  /** The nested repository at `dir`'s branch gone here: its checkout put on `into`, the branch, where it is here, and its remote's copy here deleted. @param {string} dir @param {string} into */
  function gone(dir, into) {
    git(dir, ['switch', '-q', into]);
    if (git(dir, ['branch', '--list', BRANCH]).trim() !== '') git(dir, ['branch', '-q', '-D', BRANCH]);
    git(dir, ['update-ref', '-d', `refs/remotes/origin/${BRANCH}`]);
  }
}

/** The knowledge base's chunks of the unit's `summary.md`, each by the heading it sits under. @param {string} dir */
const summaryChunks = (dir) => store.allChunks(store.loadStore(knowledgeFiles(statePath(dir)).store))
  .filter((chunk) => chunk.source_file === layout.unit(UNIT, 'summary.md'))
  .map((chunk) => chunk.heading_path);

/**
 * Refuse a git command Claude would run in the conversation `as` names that
 * the shell guard refuses, as Claude Code asks it before the command,
 * failing the test in the guard's words.
 * @param {string} dir @param {string[]} args git's @param {As} as
 */
function askGuard(dir, args, as) {
  const command = ['git', ...args].join(' ');
  const asked = call(dir, ['shell', 'guard'], {
    env: as.env,
    stdin: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: dir, session_id: as.env.CLAUDE_CODE_SESSION_ID, tool_name: 'Bash', tool_input: { command } }),
  });
  if (asked.code !== 0) throw new Error(`the shell guard refuses \`${command}\`: ${asked.stderr.trim()}`);
}

/**
 * A git command run in the project as Claude runs one in the conversation
 * `as` names: the shell guard asked first (`askGuard`), and the command run
 * once it passes, its output taken as Claude Code takes it — the command
 * failing, failing the test in git's words. Its output.
 * @param {string} dir @param {string[]} args git's, none holding a space @param {As} as
 */
function guardedGit(dir, args, as) {
  askGuard(dir, args, as);
  const ran = spawnSync('git', args, { cwd: dir, encoding: 'utf8', timeout: GIT_TIMEOUT_MS });
  if (ran.status !== 0) throw new Error(`\`${['git', ...args].join(' ')}\` failed: ${ran.stderr.trim()}`);
  return ran.stdout;
}

/** A commit of the person's own in the repository at `dir`, writing `mine.txt` on the branch its checkout has out, made in their terminal. @param {string} dir @param {string} subject */
function ownCommit(dir, subject) {
  createFile(dir, 'mine.txt', 'mine\n');
  git(dir, ['add', 'mine.txt']);
  git(dir, ['commit', '-q', '-m', subject]);
}

/** A commit of the person's own (`ownCommit`) on a branch of the quick-fix's name made in the repository at `dir`. @param {string} dir @param {string} subject */
function ownBranchCommit(dir, subject) {
  git(dir, ['switch', '-q', '-c', BRANCH]);
  ownCommit(dir, subject);
}

/** Finish's checklist worked and closed in the conversation `as` names, the build's log written. @param {string} dir @param {As} as */
function checklistClosed(dir, as) {
  writeState(dir, layout.unit(UNIT, 'build', 'log.md'), '# The fixes\n');
  for (const key of ['inbox-closed', 'build-log-closed']) ok(dir, ['checklist', 'done', 'finish', UNIT, key], as);
  ok(dir, ['checklist', 'close', 'finish', UNIT], as);
}

/**
 * Fixes 1.1 to `last` recorded in the conversation `as` names — each past
 * the two `RECORDS` holds under a record of its own — and finish's
 * checklist closed.
 * @param {string} dir @param {number} last @param {As} as
 */
function fixesRecorded(dir, last, as) {
  for (let n = 1; n <= last; n += 1) {
    const record = RECORDS[n] ?? { changed: `Fix ${n}'s change.`, why: 'It was spelt the American way.', leaves: 'Nothing.' };
    ok(dir, ['quick-fix', 'record', UNIT, `1.${n}`, '--file', recordFile(dir, n, record)], as);
  }
  checklistClosed(dir, as);
}

/** The close's yes, as finish's menu words it in the conversation `as` names, its lines joined. @param {string} dir @param {As} as */
const closeYes = (dir, as) => /\*\*`y\/yes`\*\* {4}→ ([^*]*?)\s*\*\*/.exec(sectionOf(output(dir, ['render', 'finish', UNIT], as), 'MENU: finish'))?.[1].replace(/\s+/g, ' ');

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
  UNIT, PLACE, DESCRIPTION, NOTE, FLAG, HELP, BRANCH, RECORDS, SET, fixFile, quickFix, createFix, fixChanged, fixBuilt, fixDone, recordFile, twoFixesBuilt, quickFixConformance, quickFixNestedConformance, summaryChunks,
  guardedGit, ownCommit, ownBranchCommit, checklistClosed, fixesRecorded, closeYes, asGone, entered,
};
