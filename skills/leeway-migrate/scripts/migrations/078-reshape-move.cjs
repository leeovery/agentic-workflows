'use strict';

//
// Migration 078: The reshape's move — the project into the layout in `.leeway/`
//
// Step 3 of the reshape's sequence (21.2, 21.5): the project's state leaves
// `.workflows/` for the state worktree, `.leeway/`, in the repository's main
// checkout, on its own branch, `leeway-state`. Written against today's
// shape: the shape the chain up to 072 leaves.
//
// What it reads: `.workflows/` in the project's folder — the runner's,
// nested in its repository or at the top — as the main checkout holds it,
// the copy `.workflows/` leaves the default branch from (21.5.11). Run from
// a linked worktree whose copy differs, the verification addendum says
// which copy was moved. A rebase, merge, cherry-pick, revert or bisect
// stopped in the main checkout aborts the run, unrecorded and with nothing
// written, until it is finished or aborted, as boot waits these out.
//
// Where it writes: the state worktree, added here on an unborn
// `leeway-state` and locked as the engine locks it. Git 2.40 has no
// `worktree add --orphan`, so the worktree is added detached with nothing
// checked out, and `switch --orphan` empties it onto the unborn branch; every
// git call here runs with hooks off and the caller's repository environment
// cleared. A plain `.leeway/` already there — the runner's migrations record,
// written before this step runs — is set aside while the worktree is added,
// then put back inside it. A `.leeway/` already on `leeway-state` is written
// again, and locked where it was left unlocked; a registration a removed
// `.leeway/` left behind is cleared first: a move cut short is run again
// from the start, the project manifest written whole or not at all.
//
// The project's own files, in its folder in the main checkout, are taken to
// the new names and staged for the migration's commit (21.5.19, 21.9.2):
// `.gitignore`, where boot keeps the line, gains `.leeway/` at once — an
// unignored worktree with no commit checked out refuses `git add -A`; each
// settings hook naming the engine at `.claude/skills/workflow-engine/`
// names it at `.claude/skills/leeway-engine/`; and `.worktreeinclude` loses
// the lines naming `.workflows/`, the file going where it holds nothing
// else. Nothing is committed (21.9.3), and nothing in the state is staged:
// the migration's commit, made at finish, takes the whole state.
// `.workflows/` and the tracker's store stay where they are, read as they
// stand, and are never changed; finish drops them from the default branch.
//
// The project: its manifest is carried, with the project's id minted on it
// (21.5.20) — kept where a move cut short already minted one — less the
// baseline's status fields, a recorded `native`, `skipped` or `completed`
// kept as `brownfield_offer`, the brownfield offer's remembered answer, in
// today's words — the offer is made once per project, and a completed
// assessment was offered it — and one still under way kept as nothing, so
// the offer is made again (21.11.1, 21.11.2, 8.12.11); each roadmap item's sources follow their files, once
// each, and the roadmap's imports' paths follow theirs. The inbox and the
// environment setup file are carried as they are, but for an inbox file
// whose name is no item's (`{ideas,bugs,quickfixes}/{YYYY-MM-DD}--{slug}.md`,
// archived or not), left behind. `.roadmap/` is `.product/` (21.5.7): its
// sessions as they are, each note out of its kind's folder under its inbox
// name, and `imports/` as `assets/`, the documents' links to an import
// rewritten as a unit's are. `.baseline/`'s docs are reference in
// `.product/assets/baseline/`, names kept, its `.state/` of dossiers and
// agendas going as tracking and analysis (21.11.1, 4.10.3). The tracker's
// store, wherever the task driver the project names, or the default, says
// it lives, is carried into the state as it is (21.5.18), and the files its
// tool keeps local are ignored in the state's own `.gitignore`, written
// otherwise as the engine writes it (7.5.4). The user-level folder's
// contents, `WORKFLOWS_CONFIG_DIR` or `~/.config/workflows/`, move to the
// engine's, `LEEWAY_CONFIG_DIR` or `~/.config/leeway/`, unchanged, merged
// into what is there already, and a link to it is left in its place, so a
// project on the machine still on today's skills keeps its settings,
// credentials and conversations; a later project's move finds the link and
// does nothing (21.5.19, P7). A file both folders hold stays in the old one,
// which is then not linked, and the verification addendum names it; a
// sidecar both hold is dropped. The old cache, the knowledge store and the
// old migrations record are left where they are (21.5.10).
//
// Each unit, a folder under `.workflows/` holding a manifest:
//   - a topic's log, `topics/{topic}/log.md`, is its research, its discussion
//     and its investigation, each verbatim under a heading of its own, in that
//     order (21.5.2, 21.5.3). A topic is a name the unit's map, discussions or
//     investigations hold, or, for a feature, bugfix or cross-cutting unit,
//     the unit's own name; research under any other name fed the topics it
//     was split into or spawned, and goes to a discovery session of its own,
//     numbered after the unit's last and headed as the migration's, until the
//     cut and the merges place it (21.5.4). A topic promoted to a
//     cross-cutting unit took only its discussion there, so its research
//     joins that unit's log for it, ahead of the discussion;
//   - its mail, from every box it had, is one sequence in `topics/{topic}/
//     mail/`, renumbered where it had more than one box (21.5.5); the mail of
//     a cancelled topic, or of a name no topic holds, goes to the inbox
//     instead, each message an idea, its first line the title (21.5.6,
//     10.1.6);
//   - its brief is `topics/{topic}/brief.md`, and its experiment records sit
//     in `topics/{topic}/experiments/` as they stood (21.5.13);
//   - nothing lands in a topic's folder no topic owns: a brief, experiment
//     records, a discussion or an investigation under any other name is left
//     behind, and the experiments' manifest items with them;
//   - discovery's sessions are `discovery/session-NNN.md`, numbers kept;
//   - `imports/` is `assets/`, and every moved document's links to a file
//     there (`../imports/{name}`, the name one `imports/` holds) are
//     rewritten to the asset's place from the document's own; each
//     `imports[]` entry's path follows its file (21.5.7);
//   - plans go to `assets/plans/{topic}/` and review folders to
//     `assets/reviews/{topic}/`, names kept; a spec goes to
//     `assets/specs/{topic}.md` where the unit's building has not started —
//     an implementation item in progress or completed — and, where it has,
//     stays for the cut and the merges to join into `spec.md` (21.8.5); a
//     quick-fix's spec goes to `assets/specs/` whatever its building, and
//     once the quick-fix is completed its spec is its `summary.md` and its
//     plan goes, its spec and plan items with them (21.5.15, 21.5.16);
//   - implementation folders and the unit's `.state/` go whole, holding
//     tracking and analysis files only, and so do the spec and plan reviews'
//     tracking files, each matched by its whole name as those reviews write
//     it, never by a fragment a topic's or a section's slug can hold
//     (21.5.17); seeds stay as they are;
//   - the files the person's tools leave beside theirs (`.DS_Store` and the
//     rest of the engine's list) are neither carried nor named;
//   - a cancelled unit moves as any other (21.5.14).
//
// The unit's manifest is today's shape, less research and the retired state
// (21.5.8): the research phase goes, a topic whose research joined its log
// and that has no discussion yet taking a discussion item of the research's
// standing, and its discussion taking the research's wait on its
// experiments; scoping goes; and so do the map's routing, a discussion's
// subtopics, staging, the spec's build order (a cancelled spec's stashed one
// too) and its review cycles and baseline, the plan's review tracking and
// dependencies, and the caches of the discovery gap analysis and the
// discussion analysis, whose files go with them (21.5.17), and a discussion's
// own wait on research, a phase gone. Everything else carries as it stood,
// the fields 21.5.9 names among them, a brief's path following its brief.
// Each later reshape of a
// manifest updates this move until it is released (E4): the reshape's own
// steps written for `.leeway/` before this one — 073's linters — find
// nothing there when a project comes from `.workflows/`, so this move runs
// them over what it wrote.
//
// A file the move has no place for is left in `.workflows/` and named in
// the verification addendum. A project with no `.workflows/`, or in no
// repository, has nothing to move, and a state branch with a commit already
// is never written over.
//
// Known edges, not built:
//   - a second clone holding `origin/leeway-state` but no local branch is
//     moved into a state of its own (only the local branch is read);
//   - the state worktree's HEAD log records the code HEAD it was added at,
//     which boot's repair of a lost branch would read — 29.17's wiring of the
//     unborn branch;
//   - `worktree add` failing, or a kill between it and `switch`, strands the
//     set-aside folder or the registered worktree;
//   - staging `.gitignore` takes the person's own unstaged edits to it too;
//   - a research item and its topic's discussion both waiting on
//     experiments keep only the discussion's wait;
//   - a branch's `.workflows/` work not on the main checkout is not moved;
//   - two Leeway projects nested in one repository share the one state; while
//     the branch is unborn, the second move overwrites the first's registry;
//   - the same message sent to two cancelled topics becomes one inbox idea;
//   - a bare repository, with no main checkout to hold the state, is skipped;
//   - a symlinked folder under `.workflows/` aborts the run, unrecorded;
//   - research left unstarted with mail under a discussion already decided
//     folds into a decided topic holding mail, as reopened research does;
//   - a settings hook naming the old engine fails on every tool call between
//     the skills' update and `/leeway`, where the move renames it — the
//     guard (29.17) runs first;
//   - staging the settings or `.worktreeinclude` takes the person's own
//     unstaged edits to them too, and an untracked one ignored by the code
//     tree aborts the run;
//   - the tracker's store is read from the project folder, never from a
//     folder above it a walk up would find;
//   - two notes of one name under different kinds keep the first, the second
//     left behind and named;
//   - a roadmap source naming a file the move dropped or left behind keeps
//     its old path;
//   - the user-level folders on two filesystems abort the run at the move,
//     which a run again meets the same way; a kill between the move and the
//     link leaves the old folder gone and no link, so a project still on
//     today's skills starts without its settings.
//

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const linters = require('./073-environment-linters.cjs');
const { listDrivers, loadDriver, defaultDriver, settingOf } = require('../../../leeway-engine/scripts/domain/drivers.cjs');

const CODE_TREE_STATE = '.workflows';
const STATE_DIR = '.leeway';
const SET_ASIDE = '.leeway-set-aside';
const STATE_BRANCH = 'leeway-state';
const STATE_LOCK_REASON = 'leeway state, do not remove';
const STATE_GITIGNORE = ['/.knowledge/', '/.cache/', '/.lock', '/.lock.*', '.manifest.json.*.tmp', '/.ledger.jsonl.*.tmp', ''].join('\n');
const CODE_GITIGNORE = '.gitignore';
const STATE_IGNORE_LINE = `${STATE_DIR}/`;
const SETTINGS = '.claude/settings.json';
const WORKTREE_INCLUDE = '.worktreeinclude';
const WORKFLOWS_LINE = /^\/?\.workflows(?:\/|$)/;
const OLD_ENGINE = '.claude/skills/workflow-engine/scripts/engine.cjs';
const NEW_ENGINE = '.claude/skills/leeway-engine/scripts/engine.cjs';

const ROADMAP = '.roadmap';
const PRODUCT = '.product';
const BASELINE = '.baseline';
const ROADMAP_SESSION = /^sessions\/session-[0-9]{3,}\.md$/;
const ROADMAP_NOTE = /^notes\/(?:ideas|bugs|quickfixes)\/([0-9]{4}-[0-9]{2}-[0-9]{2}--[a-z0-9]+(?:-[a-z0-9]+)*\.md)$/;
// The baseline's answers the brownfield offer remembers (21.11.2).
const BROWNFIELD_ANSWERS = ['native', 'skipped', 'completed'];

const REPOSITORY_ENV = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_CONFIG', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS', 'GIT_DIR',
  'GIT_GRAFT_FILE', 'GIT_IMPLICIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_NAMESPACE', 'GIT_NO_REPLACE_OBJECTS', 'GIT_OBJECT_DIRECTORY',
  'GIT_PREFIX', 'GIT_QUARANTINE_PATH', 'GIT_REPLACE_REF_BASE', 'GIT_SHALLOW_FILE', 'GIT_WORK_TREE',
];
const HOOKS_OFF = ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor='];
// The marker each stopped operation leaves in the git directory, as the engine reads them.
const OPERATION_MARKERS = [
  ['MERGE_HEAD', 'a merge'], ['CHERRY_PICK_HEAD', 'a cherry-pick'], ['REVERT_HEAD', 'a revert'],
  ['rebase-merge', 'a rebase'], ['rebase-apply', 'a rebase'], ['BISECT_START', 'a bisect'],
];

const SINGLE_TOPIC_TYPES = ['feature', 'bugfix', 'cross-cutting'];
const LOG_PHASES = ['research', 'discussion', 'investigation'];
const LOG_HEADINGS = { research: 'Research', discussion: 'Discussion', investigation: 'Investigation' };
const STAGING = ['staging', 'analysis_staging'];
const RETIRED_PHASES = ['research', 'scoping'];
const RETIRED_PHASE_FIELDS = {
  discovery: ['gap_analysis_cache'],
  discussion: ['analysis_cache'],
  specification: ['build_order_stale'],
};
const RETIRED_ITEM_FIELDS = {
  discovery: ['routing'],
  discussion: ['subtopics'],
  specification: ['order', 'previous_order', 'review_cycle', 'review_baseline_words', 'tracking'],
  planning: ['review_cycle', 'review_baseline_words', 'approvals', 'tracking', 'external_dependencies'],
};
const RESEARCH_STANDING = { unstarted: 'unstarted', cancelled: 'cancelled', postponed: 'postponed' };
// A research item's wait on its experiments, carried to its topic's discussion.
const RESEARCH_WAITS = ['awaiting_experiments', 'reconcile_needed'];

// A completed quick-fix's spec and plan, gone with their files.
const QUICK_FIX_SPENT = ['specification', 'planning'];

const DELIVERY_PHASES = ['specification', 'planning', 'review'];
// Folders carried whole under a name of the layout's, their files as they are.
const CARRIED = { imports: 'assets', seeds: 'seeds' };
const DROP = Symbol('drop');
const STAYS = Symbol('stays');

const IMPORT_LINK = /(?:\.\.\/)+imports\/([A-Za-z0-9._-]+)/g;
const MAILBOX_MESSAGE = /^(research|discussion|investigation)\/\.mailbox\/([^/]+)\/([^/]+\.md)$/;
const SESSION = /^discovery\/sessions\/(session-([0-9]{3,})\.md)$/;
const INBOX_ITEM = /^(?:\.archived\/)?(?:ideas|bugs|quickfixes)\/[0-9]{4}-[0-9]{2}-[0-9]{2}--[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
// The review tracking files today's spec and plan reviews write at the top
// of their folders, each named whole: a topic's or a section's slug never
// makes one of these.
const TRACKING_FILES = {
  specification: /^review-(?:input|gap-analysis|claims)-tracking-c[0-9]+\.md$/,
  planning: /^review-(?:traceability|integrity)-tracking-c[0-9]+\.md$/,
};
// The files the person's tools leave beside theirs, by base name, `*` any
// run of characters, as the engine lists them (TOOL_SIDECARS): never carried,
// never named as left behind.
const TOOL_SIDECARS = [
  '.DS_Store', 'Thumbs.db', 'desktop.ini', '._*',
  '.*.swp', '.*.swo', '.*.swx',
  '*~', '#*#', '.#*',
  '*___jb_tmp___', '*___jb_old___',
];
const SIDECAR_NAME = new RegExp(`^(?:${TOOL_SIDECARS.map((glob) => glob.replace(/[^\w*]/g, '\\$&').replace(/\*/g, '.*')).join('|')})$`);

const ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 21;

/** @param {unknown} v @returns {v is Record<string, any>} */
function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** @param {unknown} data */
function jsonText(data) {
  return JSON.stringify(data, null, 2) + '\n';
}

/** A project id, as the engine mints one: 21 of the 62 letters and digits, drawn without bias. */
function newId() {
  const below = 256 - (256 % ID_ALPHABET.length);
  let id = '';
  while (id.length < ID_LENGTH) {
    for (const byte of crypto.randomBytes(ID_LENGTH * 2)) {
      if (byte >= below) continue;
      id += ID_ALPHABET[byte % ID_ALPHABET.length];
      if (id.length === ID_LENGTH) break;
    }
  }
  return id;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * `fn` run with the variables that point git at a repository cleared from
 * the process, then put back: every git call the move makes, 073's among
 * them, names its repository by its folder alone.
 * @template T @param {() => T} fn @returns {T}
 */
function withoutRepositoryEnv(fn) {
  const held = REPOSITORY_ENV.filter((name) => name in process.env).map((name) => [name, process.env[name]]);
  for (const [name] of held) delete process.env[name];
  try {
    return fn();
  } finally {
    for (const [name, value] of held) process.env[name] = value;
  }
}

/** A git call with hooks off. @param {string} cwd @param {string[]} args @returns {{ok: boolean, stdout: string, stderr: string}} */
function git(cwd, args) {
  const res = spawnSync('git', [...HOOKS_OFF, ...args], { cwd, encoding: 'utf8' });
  return { ok: !res.error && res.status === 0, stdout: res.stdout || '', stderr: res.stderr || '' };
}

/** @param {string} cwd @param {string[]} args */
function mustGit(cwd, args) {
  const res = git(cwd, args);
  if (!res.ok) throw new Error(`git ${args.slice(0, 2).join(' ')} failed: ${res.stderr.trim()}`);
}

/** The main checkout of the repository `projectDir` is in, or null where it is in none. @param {string} projectDir */
function mainCheckout(projectDir) {
  const res = git(projectDir, ['rev-parse', '--git-common-dir']);
  if (!res.ok) return null;
  const common = fs.realpathSync(path.resolve(projectDir, res.stdout.trim()));
  return path.basename(common) === '.git' ? path.dirname(common) : null;
}

/** The project's folder as the main checkout holds it. @param {string} projectDir @param {string} main */
function projectInMain(projectDir, main) {
  return path.resolve(main, git(projectDir, ['rev-parse', '--show-prefix']).stdout.trim());
}

/**
 * The operation git has stopped in the middle of at `cwd`, or null: the
 * markers boot waits out before it stages a file there.
 * @param {string} cwd @returns {string|null}
 */
function stoppedOperation(cwd) {
  const res = git(cwd, ['rev-parse', ...OPERATION_MARKERS.flatMap(([marker]) => ['--git-path', marker])]);
  const paths = res.stdout.trim().split('\n');
  const open = OPERATION_MARKERS.find((_, i) => res.ok && fs.existsSync(path.resolve(cwd, paths[i])));
  return open === undefined ? null : `${open[1]} (${open[0]})`;
}

/** Whether the state branch has a commit: a state the move never writes over. @param {string} main */
function stateBorn(main) {
  return git(main, ['rev-parse', '--verify', '--quiet', `refs/heads/${STATE_BRANCH}`]).ok;
}

/** @param {string} root */
function onStateBranch(root) {
  if (!fs.existsSync(path.join(root, '.git'))) return false;
  const res = git(root, ['symbolic-ref', '--quiet', 'HEAD']);
  return res.ok && res.stdout.trim() === `refs/heads/${STATE_BRANCH}`;
}

/** Git's record of the worktree at `root`, or null where it holds none. @param {string} main @param {string} root */
function registration(main, root) {
  return git(main, ['worktree', 'list', '--porcelain']).stdout.split('\n\n').find((entry) => entry.startsWith(`worktree ${root}\n`)) ?? null;
}

/** @param {string} main @param {string} root */
const locked = (main, root) => /^locked(?: |$)/m.test(registration(main, root) ?? '');

/**
 * The state worktree added at `root` on an unborn `leeway-state`, whatever
 * a plain folder there held put back inside it, and a registration a
 * removed folder left there cleared first.
 * @param {string} main @param {string} root
 */
function addStateWorktree(main, root) {
  const aside = path.join(main, SET_ASIDE);
  const held = fs.existsSync(root);
  if (held) fs.renameSync(root, aside);
  if (registration(main, root) !== null) mustGit(main, ['worktree', 'remove', '--force', '--force', STATE_DIR]);
  mustGit(main, ['worktree', 'add', '--quiet', '--detach', '--no-checkout', STATE_DIR, 'HEAD']);
  mustGit(root, ['switch', '--quiet', '--orphan', STATE_BRANCH]);
  if (!held) return;
  for (const name of fs.readdirSync(aside)) fs.renameSync(path.join(aside, name), path.join(root, name));
  fs.rmdirSync(aside);
}

/**
 * The state worktree at `.leeway/` on an unborn `leeway-state`, locked as
 * the engine locks it: added, or the one a move cut short already added.
 * @param {string} main @returns {string}
 */
function placeStateWorktree(main) {
  const root = path.join(main, STATE_DIR);
  if (!onStateBranch(root)) addStateWorktree(main, root);
  if (!locked(main, root)) mustGit(main, ['worktree', 'lock', '--reason', STATE_LOCK_REASON, STATE_DIR]);
  return root;
}

/** Every file under `dir`, the tools' sidecars aside, as posix paths relative to it. @param {string} dir @param {string} [at] @returns {string[]} */
function filesUnder(dir, at = '') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(path.join(dir, at), { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((entry) => {
      const rel = at === '' ? entry.name : `${at}/${entry.name}`;
      if (entry.isDirectory()) return filesUnder(dir, rel);
      return SIDECAR_NAME.test(entry.name) ? [] : [rel];
    });
}

/** @param {string} file @param {string|Buffer} content @param {number} [mode] */
function writeFile(file, content, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  if (mode !== undefined) fs.chmodSync(file, mode);
}

/**
 * A file a move run again reads back, written whole or not at all: through
 * a scratch file in the state's ignored cache, renamed into place.
 * @param {string} state @param {string} file @param {string} content
 */
function writeWhole(state, file, content) {
  const scratch = path.join(state, '.cache', `move-${process.pid}-${path.basename(file)}`);
  writeFile(scratch, content);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.renameSync(scratch, file);
}

/** @param {string} file */
const modeOf = (file) => fs.statSync(file).mode & 0o7777;

/** @param {string} file @returns {any} */
function readManifest(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`the move cannot read ${file} — fix it, then run again: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * A document's links to its unit's imports, each naming a file `imported`
 * holds, pointed at the assets from the place it now sits, state-relative;
 * a link to any other name is left as written.
 * @param {string} text @param {string} at @param {string} unit @param {Set<string>} imported
 */
function relinked(text, at, unit, imported) {
  const hops = path.posix.relative(path.posix.dirname(at), `${unit}/assets`);
  return text.replace(IMPORT_LINK, (link, named) => {
    const name = named.replace(/\.+$/, '');
    return imported.has(name) ? `${hops}/${name}${named.slice(name.length)}` : link;
  });
}

/** @param {Record<string, any>} manifest @param {string} phase @returns {Record<string, any>} */
function itemsOf(manifest, phase) {
  const entry = isObject(manifest.phases) ? manifest.phases[phase] : null;
  return isObject(entry) && isObject(entry.items) ? entry.items : {};
}

/** @param {Record<string, any>} manifest @param {string} unit @returns {Set<string>} */
function topicNames(manifest, unit) {
  const names = new Set(['discovery', 'discussion', 'investigation'].flatMap((phase) => Object.keys(itemsOf(manifest, phase))));
  if (SINGLE_TOPIC_TYPES.includes(manifest.work_type)) names.add(unit);
  return names;
}

/** @param {Record<string, any>} manifest */
function buildingStarted(manifest) {
  return Object.values(itemsOf(manifest, 'implementation'))
    .some((item) => isObject(item) && (item.status === 'in-progress' || item.status === 'completed'));
}

/** A topic's standing in discussion, from its research's. @param {unknown} status @returns {string} */
const standingOf = (status) => RESEARCH_STANDING[String(status)] ?? 'in-progress';

/**
 * A discussion item, of its research's standing, for each topic whose
 * research joined its log and that has no discussion yet; a discussion's
 * own wait on research, a phase gone, dropped; and the research's wait on
 * its experiments carried onto its topic's discussion, where the discussion
 * has none of its own.
 * @param {Record<string, any>} manifest @param {Set<string>} topics
 */
function foldResearch(manifest, topics) {
  const discussion = itemsOf(manifest, 'discussion');
  for (const item of Object.values(discussion)) if (isObject(item) && item.reconcile_needed === 'research') delete item.reconcile_needed;
  for (const [topic, item] of Object.entries(itemsOf(manifest, 'research'))) {
    if (!topics.has(topic) || !isObject(item)) continue;
    if (!Object.hasOwn(discussion, topic)) {
      discussion[topic] = { status: standingOf(item.status), ...('previous_status' in item ? { previous_status: standingOf(item.previous_status) } : {}) };
    }
    const target = discussion[topic];
    if (!isObject(target)) continue;
    for (const field of RESEARCH_WAITS) if (field in item && !(field in target)) target[field] = item[field];
  }
  if (Object.keys(discussion).length > 0) manifest.phases.discussion = { ...manifest.phases.discussion, items: discussion };
}

/** Each phase's retired fields and its items', a brief's path following its brief. @param {Record<string, any>} phases */
function dropRetired(phases) {
  for (const phase of RETIRED_PHASES) delete phases[phase];
  for (const [phase, entry] of Object.entries(phases)) {
    if (!isObject(entry)) continue;
    for (const field of [...STAGING, ...(RETIRED_PHASE_FIELDS[phase] ?? [])]) delete entry[field];
    const retired = [...STAGING, ...(RETIRED_ITEM_FIELDS[phase] ?? [])];
    for (const [topic, item] of Object.entries(isObject(entry.items) ? entry.items : {})) {
      if (!isObject(item)) continue;
      for (const field of retired) delete item[field];
      if (phase === 'discovery' && item.brief_path === `discovery/briefs/${topic}.md`) item.brief_path = `topics/${topic}/brief.md`;
    }
  }
}

/** @param {Record<string, any>} manifest */
const isQuickFix = (manifest) => manifest.work_type === 'quick-fix';

/** @param {Record<string, any>} manifest */
const quickFixDone = (manifest) => isQuickFix(manifest) && manifest.status === 'completed';

/**
 * The unit's manifest less research and the retired state: the experiments
 * of names no topic holds going with their records' place, a completed
 * quick-fix's spec and plan with their files; each import's path following
 * its file.
 * @param {Record<string, any>} manifest @param {Set<string>} topics
 * @returns {Record<string, any>}
 */
function reshapedManifest(manifest, topics) {
  const out = structuredClone(manifest);
  if (isObject(out.phases)) {
    foldResearch(out, topics);
    dropRetired(out.phases);
    const experiments = itemsOf(out, 'experiment');
    for (const name of Object.keys(experiments)) if (!topics.has(name)) delete experiments[name];
    if (quickFixDone(manifest)) for (const phase of QUICK_FIX_SPENT) delete out.phases[phase];
  }
  if (Array.isArray(out.imports)) out.imports = out.imports.map(asAsset);
  return out;
}

/** An `imports[]` entry, its path following its file into `assets/`. @param {unknown} entry */
function asAsset(entry) {
  return isObject(entry) && typeof entry.path === 'string' && entry.path.startsWith('imports/')
    ? { ...entry, path: `assets/${entry.path.slice('imports/'.length)}` }
    : entry;
}

/** @param {Record<string, any>} manifest @returns {Set<string>} */
function cancelledTopics(manifest) {
  const cancelled = new Set(Object.entries(itemsOf(manifest, 'discovery')).filter(([, item]) => isObject(item) && item.cancelled === true).map(([topic]) => topic));
  for (const phase of ['discussion', 'investigation']) {
    for (const [topic, item] of Object.entries(itemsOf(manifest, phase))) if (isObject(item) && item.status === 'cancelled') cancelled.add(topic);
  }
  return cancelled;
}

/** @param {string} text @returns {string} */
function slugOf(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** @param {string} text */
const endLine = (text) => (text.endsWith('\n') ? text : `${text}\n`);

/**
 * Where each moved file went, `.workflows/`-relative to state-relative: what
 * a roadmap item's sources follow (21.5.7).
 * @typedef {Map<string, string>} Relocations
 */

/**
 * One unit's move: where its files come from and go, which of them are
 * accounted for, where each went, and what decides each one's place; a
 * topic whose research went with it, to the unit it went to.
 * @typedef {{
 *   unit: string,
 *   from: string,
 *   state: string,
 *   files: string[],
 *   imported: Set<string>,
 *   accounted: Set<string>,
 *   relocations: Relocations,
 *   topics: Set<string>,
 *   cancelled: Set<string>,
 *   quickFix: boolean,
 *   quickFixDone: boolean,
 *   built: boolean,
 *   incoming: {topic: string, text: string}[],
 *   outgoing: Map<string, string>,
 * }} UnitMove
 */

/**
 * A topic promoted to a cross-cutting unit, which took only its discussion:
 * the unit it came from, whose research for it joins the log the topic has
 * in the unit it went to.
 * @typedef {{source: string, target: string, topic: string}} Promoted
 */

/** A file of the unit's, accounted for. @param {UnitMove} move @param {string} rel @returns {Buffer} */
function take(move, rel) {
  move.accounted.add(rel);
  return fs.readFileSync(path.join(move.from, rel));
}

/** A document of the unit's, accounted for, its links pointed from `at`, state-relative. @param {UnitMove} move @param {string} rel @param {string} at */
function takeDocument(move, rel, at) {
  return relinked(take(move, rel).toString('utf8'), at, move.unit, move.imported);
}

/** @param {UnitMove} move @param {string} at unit-relative @param {string|Buffer} content @param {number} [mode] */
function put(move, at, content, mode) {
  writeFile(path.join(move.state, move.unit, at), content, mode);
}

/** A file of the unit's gone to `to`, state-relative. @param {UnitMove} move @param {string} rel @param {string} to */
function relocate(move, rel, to) {
  move.relocations.set(`${move.unit}/${rel}`, to);
}

/** @param {string} phase @param {string} text */
const logPart = (phase, text) => `## ${LOG_HEADINGS[phase]}\n\n${endLine(text)}`;

/**
 * Each topic's log, its research, discussion and investigation each under
 * its own heading, a promoted topic's research coming from the unit it was
 * promoted from; and research no topic of its name holds, in a discovery
 * session of the migration's, numbered after the unit's last. A discussion
 * or an investigation no topic holds is left behind.
 * @param {UnitMove} move
 */
function moveLogs(move) {
  /** @type {Map<string, string[]>} */
  const logs = new Map(move.incoming.map(({ topic, text }) => [topic, [logPart('research', text)]]));
  /** @type {{rel: string, text: string}[]} */
  const spread = [];
  for (const phase of LOG_PHASES) {
    for (const rel of move.files.filter((f) => path.posix.dirname(f) === phase && f.endsWith('.md'))) {
      const topic = path.posix.basename(rel, '.md');
      const promotedTo = phase === 'research' ? move.outgoing.get(topic) : undefined;
      if (promotedTo !== undefined) {
        take(move, rel);
        relocate(move, rel, `${promotedTo}/topics/${topic}/log.md`);
        continue;
      }
      if (!move.topics.has(topic)) {
        if (phase === 'research') spread.push({ rel, text: `## Research: ${topic}\n\n${endLine(takeDocument(move, rel, `${move.unit}/discovery/session.md`))}` });
        continue;
      }
      logs.set(topic, [...(logs.get(topic) ?? []), logPart(phase, takeDocument(move, rel, `${move.unit}/topics/${topic}/log.md`))]);
      relocate(move, rel, `${move.unit}/topics/${topic}/log.md`);
    }
  }
  for (const [topic, parts] of logs) put(move, `topics/${topic}/log.md`, parts.join('\n'));
  if (spread.length === 0) return;
  const last = Math.max(0, ...move.files.map((f) => SESSION.exec(f)).filter((m) => m !== null).map((m) => Number(m[2])));
  const number = String(last + 1).padStart(3, '0');
  const head = [
    `# Discovery Session ${number}`, '', `Date: ${today()}`, `Work unit: ${move.unit}`, '',
    'Written by the migration: the research below fed several topics, so it is kept here, on the unit\'s discovery log, until the cut and the merges place it where it bears.',
  ];
  put(move, `discovery/session-${number}.md`, [...head, '', ...spread.map(({ text }) => text)].join('\n'));
  for (const { rel } of spread) relocate(move, rel, `${move.unit}/discovery/session-${number}.md`);
}

/**
 * A message for a topic cancelled or none holds, as an idea in the inbox,
 * its first line the title — written once, a move run again finding it there.
 * @param {UnitMove} move @param {string} rel @param {string} name
 */
function messageToInbox(move, rel, name) {
  const [first, ...rest] = takeDocument(move, rel, '.inbox/ideas/idea.md').split('\n');
  const named = name.replace(/^[0-9]+-/, '').replace(/\.md$/, '');
  const title = first.replace(/^#+\s*/, '').trim() || named;
  const content = [`# ${title}`, ...rest].join('\n');
  const base = path.join(move.state, '.inbox', 'ideas', `${today()}--${slugOf(title) || slugOf(named)}`);
  for (let n = 1; ; n += 1) {
    const file = `${base}${n === 1 ? '' : `-${n}`}.md`;
    if (!fs.existsSync(file)) return writeWhole(move.state, file, content);
    if (fs.readFileSync(file, 'utf8') === content) return undefined;
  }
}

/**
 * Each topic's mail, from every box it had, as one sequence in its own
 * folder — renumbered where it had more than one box — or, for a topic
 * cancelled or none holds, ideas in the inbox.
 * @param {UnitMove} move
 */
function moveMail(move) {
  /** @type {Map<string, Map<string, {rel: string, name: string}[]>>} */
  const boxes = new Map();
  for (const rel of move.files) {
    const match = MAILBOX_MESSAGE.exec(rel);
    if (match === null) continue;
    const [, phase, topic, name] = match;
    const box = boxes.get(topic) ?? new Map();
    box.set(phase, [...(box.get(phase) ?? []), { rel, name }]);
    boxes.set(topic, box);
  }
  for (const [topic, box] of boxes) {
    LOG_PHASES.flatMap((phase) => box.get(phase) ?? []).forEach(({ rel, name }, i) => {
      if (move.cancelled.has(topic) || !move.topics.has(topic)) return messageToInbox(move, rel, name);
      const renamed = box.size > 1 ? `${String(i + 1).padStart(3, '0')}${name.replace(/^[0-9]+/, '')}` : name;
      const at = `topics/${topic}/mail/${renamed}`;
      relocate(move, rel, `${move.unit}/${at}`);
      return put(move, at, takeDocument(move, rel, `${move.unit}/${at}`));
    });
  }
}

/**
 * Where a spec, a plan or a review folder's file goes, unit-relative; DROP
 * for one that goes, STAYS for a spec left for the cut and the merges, or
 * null for one the layout has no place for.
 * @param {UnitMove} move @param {string} top @param {string} topic @param {string} below
 * @returns {string|symbol|null}
 */
function deliveryPlace(move, top, topic, below) {
  if (Object.hasOwn(TRACKING_FILES, top) && TRACKING_FILES[top].test(below)) return DROP;
  if (top === 'planning') return move.quickFixDone ? DROP : `assets/plans/${topic}/${below}`;
  if (top === 'review') return `assets/reviews/${topic}/${below}`;
  if (below !== 'specification.md') return null;
  if (move.quickFixDone) return 'summary.md';
  return move.built && !move.quickFix ? STAYS : `assets/specs/${topic}.md`;
}

/**
 * Where a brief goes, unit-relative: its topic's folder, or null where no
 * topic holds its name.
 * @param {UnitMove} move @param {string} folder @param {string[]} inside
 * @returns {string|null}
 */
function briefPlace(move, folder, inside) {
  const topic = inside.length === 1 && inside[0].endsWith('.md') ? inside[0].slice(0, -3) : null;
  return folder === 'briefs' && topic !== null && move.topics.has(topic) ? `topics/${topic}/brief.md` : null;
}

/**
 * Where a file of the unit's goes, unit-relative, by its place today: DROP,
 * STAYS, or null as `deliveryPlace` says.
 * @param {UnitMove} move @param {string} rel
 * @returns {string|symbol|null}
 */
function placeOf(move, rel) {
  const [top, ...below] = rel.split('/');
  const session = SESSION.exec(rel);
  if (session !== null) return `discovery/${session[1]}`;
  if (below.length === 0) return null;
  if (top === 'implementation' || top === '.state') return DROP;
  if (Object.hasOwn(CARRIED, top)) return `${CARRIED[top]}/${below.join('/')}`;
  const [topic, ...inside] = below;
  if (inside.length === 0) return null;
  if (top === 'experiment') return move.topics.has(topic) ? `topics/${topic}/experiments/${inside.join('/')}` : null;
  if (top === 'discovery') return briefPlace(move, topic, inside);
  return DELIVERY_PHASES.includes(top) ? deliveryPlace(move, top, topic, inside.join('/')) : null;
}

/** The names of the files a unit's `imports/` holds. @param {string} unitDir @returns {Set<string>} */
const importedNames = (unitDir) => new Set(filesUnder(path.join(unitDir, 'imports')).filter((f) => !f.includes('/')));

/**
 * Each topic promoted to a cross-cutting unit that holds it, whose research
 * stayed behind in the unit it came from.
 * @param {string} workflows @param {Map<string, Record<string, any>>} manifests @returns {Promoted[]}
 */
function promotedResearch(workflows, manifests) {
  return [...manifests].flatMap(([source, manifest]) => Object.entries(itemsOf(manifest, 'discussion')).flatMap(([topic, item]) => {
    const target = isObject(item) ? item.promoted_to : undefined;
    const holder = typeof target === 'string' ? manifests.get(target) : undefined;
    const held = holder !== undefined && topicNames(holder, target).has(topic) && fs.existsSync(path.join(workflows, source, 'research', `${topic}.md`));
    return held ? [{ source, target, topic }] : [];
  }));
}

/**
 * A promoted topic's research, its links to the imports of the unit it came
 * from pointed from the log it joins.
 * @param {string} workflows @param {Promoted} promoted @returns {{topic: string, text: string}}
 */
function promotedText(workflows, { source, target: unit, topic }) {
  const text = fs.readFileSync(path.join(workflows, source, 'research', `${topic}.md`), 'utf8');
  return { topic, text: relinked(text, `${unit}/topics/${topic}/log.md`, source, importedNames(path.join(workflows, source))) };
}

/**
 * Move one unit into the layout — every file placed, its place recorded in
 * `relocations`, dropped, or left behind — then its manifest.
 * @param {string} workflows @param {string} state @param {string} unit @param {Record<string, any>} manifest @param {Promoted[]} promoted
 * @param {Relocations} relocations
 * @returns {string[]} the files left behind, unit-relative
 */
function moveUnit(workflows, state, unit, manifest, promoted, relocations) {
  const from = path.join(workflows, unit);
  const topics = topicNames(manifest, unit);
  const reshaped = reshapedManifest(manifest, topics);
  /** @type {UnitMove} */
  const move = {
    unit,
    from,
    state,
    files: filesUnder(from),
    imported: importedNames(from),
    accounted: new Set(['manifest.json']),
    relocations,
    topics,
    cancelled: cancelledTopics(reshaped),
    quickFix: isQuickFix(manifest),
    quickFixDone: quickFixDone(manifest),
    built: buildingStarted(manifest),
    incoming: promoted.filter(({ target }) => target === unit).map((entry) => promotedText(workflows, entry)),
    outgoing: new Map(promoted.filter(({ source }) => source === unit).map(({ topic, target }) => [topic, target])),
  };
  moveLogs(move);
  moveMail(move);
  for (const rel of move.files.filter((f) => !move.accounted.has(f))) {
    const at = placeOf(move, rel);
    if (at === null) continue;
    const mode = modeOf(path.join(from, rel));
    if (typeof at === 'symbol') {
      move.accounted.add(rel);
      continue;
    }
    if (!rel.endsWith('.md') || Object.hasOwn(CARRIED, rel.split('/')[0])) put(move, at, take(move, rel), mode);
    else put(move, at, takeDocument(move, rel, `${unit}/${at}`), mode);
    relocate(move, rel, `${unit}/${at}`);
  }
  put(move, 'manifest.json', jsonText(reshaped));
  return move.files.filter((f) => !move.accounted.has(f));
}

/**
 * The project folder's `.gitignore` ignoring the state folder, as boot keeps
 * it — the line added where none ignores it whole — and staged for the
 * migration's commit: a worktree with no commit checked out, unignored,
 * refuses `git add -A`.
 * @param {string} project
 */
function ignoreState(project) {
  const file = path.join(project, CODE_GITIGNORE);
  const held = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const ignored = held.split('\n').some((line) => !line.trim().startsWith('!') && [STATE_DIR, STATE_IGNORE_LINE].includes(line.trim().replace(/^\//, '')));
  if (!ignored) writeFile(file, `${held}${held === '' || held.endsWith('\n') ? '' : '\n'}${STATE_IGNORE_LINE}\n`);
  stage(project, CODE_GITIGNORE);
}

/**
 * A file of the project folder's staged as it now stands — written, changed
 * or gone — for the migration's commit; one neither on disk nor tracked has
 * nothing to stage.
 * @param {string} project @param {string} rel
 */
function stage(project, rel) {
  const tracked = git(project, ['ls-files', '--', rel]).stdout !== '';
  if (tracked || fs.existsSync(path.join(project, rel))) mustGit(project, ['add', '-A', '--', rel]);
}

/** Each hook a settings document holds. @param {unknown} settings @returns {Record<string, any>[]} */
function hooksIn(settings) {
  return Object.values(isObject(settings) && isObject(settings.hooks) ? settings.hooks : {})
    .flatMap((groups) => (Array.isArray(groups) ? groups : []))
    .flatMap((group) => (isObject(group) && Array.isArray(group.hooks) ? group.hooks : []))
    .filter(isObject);
}

/**
 * The project's settings hooks naming the engine by its new name, staged
 * (21.5.19); or, where the file does not parse, the sentence saying its
 * hooks were left as they were.
 * @param {string} project
 * @returns {string|null}
 */
function renameEngineHooks(project) {
  const file = path.join(project, SETTINGS);
  if (!fs.existsSync(file)) return null;
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return `${path.join(project, SETTINGS)} does not parse, so its hooks were left naming the engine at ${OLD_ENGINE}: once it parses, name ${NEW_ENGINE} in each.`;
  }
  const named = hooksIn(settings).filter((hook) => typeof hook.command === 'string' && hook.command.includes(OLD_ENGINE));
  if (named.length === 0) return null;
  for (const hook of named) hook.command = hook.command.split(OLD_ENGINE).join(NEW_ENGINE);
  writeFile(file, jsonText(settings), modeOf(file));
  stage(project, SETTINGS);
  return null;
}

/**
 * The workflows' lines gone from the project's `.worktreeinclude`, the file
 * with them where it holds nothing else, staged: every worktree reads the
 * one state, so nothing is copied into a worktree (21.5.19, 4.1.4).
 * @param {string} project
 */
function dropIncludeLines(project) {
  const file = path.join(project, WORKTREE_INCLUDE);
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const kept = lines.filter((line) => !WORKFLOWS_LINE.test(line.trim()));
  if (kept.length === lines.length) return;
  if (kept.every((line) => line.trim() === '')) fs.unlinkSync(file);
  else writeFile(file, kept.join('\n'), modeOf(file));
  stage(project, WORKTREE_INCLUDE);
}

/**
 * The task driver the project's setting names, or its kind's default: what
 * says where the tracker's store lives, so the move names no tracker
 * (7.1.10).
 * @param {Record<string, any>} project the project manifest
 */
function taskDriver(project) {
  const set = settingOf(project, 'task');
  return /** @type {import('../../../leeway-engine/scripts/domain/drivers.cjs').TaskDriver} */ (
    set === null ? defaultDriver('task', listDrivers('task'), null) : loadDriver('task', set));
}

/**
 * The tracker's store, where the project folder holds one, carried into the
 * state as it is (21.5.18); finish drops it from the default branch.
 * @param {string} project @param {string} state @param {Record<string, any>} manifest the project's
 * @returns {string[]} the files its tool keeps local, for the state to ignore beside the store (7.5.4); none where there is no store
 */
function moveStore(project, state, manifest) {
  const driver = taskDriver(manifest);
  const files = driver.storeFiles().filter((rel) => fs.existsSync(path.join(project, rel)));
  for (const rel of files) {
    const file = path.join(project, rel);
    writeFile(path.join(state, rel), fs.readFileSync(file), modeOf(file));
  }
  return files.length === 0 ? [] : driver.localFiles();
}

/**
 * The inbox, the environment setup and the state's own ignore file, with
 * `ignored` added to it.
 * @param {string} from @param {string} state @param {string[]} ignored
 * @returns {string[]} the inbox's files left behind, named as no item is
 */
function moveProjectFiles(from, state, ignored) {
  const inbox = filesUnder(path.join(from, '.inbox'));
  for (const rel of inbox.filter((f) => INBOX_ITEM.test(f))) {
    const item = path.join(from, '.inbox', rel);
    writeFile(path.join(state, '.inbox', rel), fs.readFileSync(item), modeOf(item));
  }
  const setup = path.join(from, '.state', 'environment-setup.md');
  if (fs.existsSync(setup)) writeFile(path.join(state, '.state', 'environment-setup.md'), fs.readFileSync(setup));
  writeFile(path.join(state, '.gitignore'), ignored.length === 0 ? STATE_GITIGNORE : `${STATE_GITIGNORE}${ignored.join('\n')}\n`);
  return inbox.filter((f) => !INBOX_ITEM.test(f)).map((f) => `.inbox/${f}`);
}

/**
 * Where a file of `.roadmap/` goes, `.product/`-relative: a session as it
 * is, a note out of its kind's folder, its inbox name kept, an import into
 * the assets; or null where the layout has no place for it.
 * @param {string} rel
 * @returns {string|null}
 */
function productPlace(rel) {
  if (ROADMAP_SESSION.test(rel)) return rel;
  const note = ROADMAP_NOTE.exec(rel);
  if (note !== null) return `notes/${note[1]}`;
  return rel.startsWith('imports/') ? `assets/${rel.slice('imports/'.length)}` : null;
}

/**
 * `.roadmap/` as `.product/`, its documents' links to its imports pointed at
 * the assets (21.5.7), and `.baseline/`'s docs in `.product/assets/baseline/`
 * as reference, its working files gone with the tracking and analysis
 * (21.11.1, 4.10.3): each file's place recorded in `relocations`. A note
 * whose name another kind's note took is left behind.
 * @param {string} from @param {string} state @param {Relocations} relocations
 * @returns {string[]} the files left behind, `.workflows/`-relative
 */
function moveProduct(from, state, relocations) {
  const roadmap = path.join(from, ROADMAP);
  const imported = importedNames(roadmap);
  const files = [
    ...filesUnder(roadmap).map((rel) => ({ source: `${ROADMAP}/${rel}`, at: productPlace(rel), relink: rel.endsWith('.md') && !rel.startsWith('imports/') })),
    ...filesUnder(path.join(from, BASELINE)).filter((rel) => !rel.startsWith('.state/'))
      .map((rel) => ({ source: `${BASELINE}/${rel}`, at: `assets/baseline/${rel}`, relink: false })),
  ];
  /** @type {Set<string>} */
  const taken = new Set();
  return files.flatMap(({ source, at, relink }) => {
    if (at === null || taken.has(at)) return [source];
    taken.add(at);
    const file = path.join(from, source);
    const to = `${PRODUCT}/${at}`;
    writeFile(path.join(state, to), relink ? relinked(fs.readFileSync(file, 'utf8'), to, PRODUCT, imported) : fs.readFileSync(file), modeOf(file));
    relocations.set(source, to);
    return [];
  });
}

/**
 * The project manifest less the baseline's status fields, a recorded
 * `native`, `skipped` or `completed` kept as the brownfield offer's answer
 * (21.11.1, 21.11.2); each roadmap item's sources following their files, once each,
 * and the roadmap's imports' paths into its assets (21.5.7).
 * @param {Record<string, any>} project @param {Relocations} relocations
 * @returns {Record<string, any>}
 */
function reshapedProject(project, relocations) {
  const { baseline, ...out } = structuredClone(project);
  const answer = isObject(baseline) ? baseline.status : undefined;
  if (BROWNFIELD_ANSWERS.includes(answer)) out.brownfield_offer = answer;
  const roadmap = isObject(out.roadmap) ? out.roadmap : {};
  for (const item of Object.values(isObject(roadmap.items) ? roadmap.items : {})) {
    if (isObject(item) && Array.isArray(item.sources)) item.sources = [...new Set(item.sources.map((source) => relocations.get(source) ?? source))];
  }
  if (Array.isArray(roadmap.imports)) roadmap.imports = roadmap.imports.map(asAsset);
  return out;
}

/**
 * The project's manifest reshaped, with its id minted first — kept where a
 * move cut short already minted one.
 * @param {string} state @param {Record<string, any>} project @param {Relocations} relocations
 */
function writeProjectManifest(state, project, relocations) {
  const moved = path.join(state, 'manifest.json');
  const minted = fs.existsSync(moved) ? readManifest(moved).project_id : undefined;
  writeWhole(state, moved, jsonText({ project_id: typeof minted === 'string' ? minted : newId(), ...reshapedProject(project, relocations) }));
}

/** The user-level folder today's skills read. */
const oldUserFolder = () => process.env.WORKFLOWS_CONFIG_DIR || path.join(os.homedir(), '.config', 'workflows');

/** The user-level folder the engine reads. */
const userFolder = () => process.env.LEEWAY_CONFIG_DIR || path.join(os.homedir(), '.config', 'leeway');

/** @param {string} at @returns {fs.Stats|null} */
function lstatOf(at) {
  try {
    return fs.lstatSync(at);
  } catch {
    return null;
  }
}

/** A folder, never a link to one. @param {string} at */
const isFolder = (at) => lstatOf(at)?.isDirectory() === true;

/**
 * What `from` holds moved into `to` as it is: an entry `to` lacks moved
 * whole, a folder both hold merged, a tools' sidecar both hold dropped from
 * `from`, and a folder of `from`'s emptied gone.
 * @param {string} from @param {string} to @param {string} [at] `from`'s place, for what is kept
 * @returns {string[]} what both held, left in `from`
 */
function mergeInto(from, to, at = '') {
  if (lstatOf(to) === null) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
    return [];
  }
  if (!isFolder(from) && SIDECAR_NAME.test(path.basename(from))) {
    fs.rmSync(from);
    return [];
  }
  if (!isFolder(from) || !isFolder(to)) return [at];
  const kept = fs.readdirSync(from).sort().flatMap((name) => mergeInto(path.join(from, name), path.join(to, name), at === '' ? name : `${at}/${name}`));
  if (kept.length === 0) fs.rmdirSync(from);
  return kept;
}

/**
 * The user-level folder's contents moved to the engine's unchanged, and a
 * link to it left in its place, so a project on the machine still on
 * today's skills keeps its settings, credentials and conversations (21.5.19,
 * P7): once per machine, a later project finding the link. Where both
 * folders held a file, the old one stays, the folder is not linked, and the
 * sentence says so; else null.
 * @returns {string|null}
 */
function moveUserFolder() {
  const from = oldUserFolder();
  const to = userFolder();
  if (!isFolder(from)) return null;
  const kept = mergeInto(from, to);
  if (kept.length === 0) {
    fs.symlinkSync(to, from);
    return null;
  }
  return `${to} already held its own of these, so they stay in ${from}, which is left as a folder rather than a link to ${to}: ${kept.join(', ')}. `
    + `Once each is settled, ${from} can go and a link to ${to} take its place.`;
}

/**
 * Where the move ran from a linked worktree whose `.workflows/` differs from
 * the main checkout's, the sentence saying which copy was moved; or null.
 * @param {string} here @param {string} project
 * @returns {string|null}
 */
function copyNote(here, project) {
  if (here === project) return null;
  if (git(project, ['diff', '--no-index', '--quiet', '--', path.join(project, CODE_TREE_STATE), path.join(here, CODE_TREE_STATE)]).ok) return null;
  const branch = git(here, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const on = branch.ok ? `on ${branch.stdout.trim()}` : 'on a detached HEAD';
  return `The move took ${CODE_TREE_STATE}/ from the main checkout, ${project}, the copy it leaves the default branch from; `
    + `the worktree it ran in, ${here}, ${on}, holds a ${CODE_TREE_STATE}/ that differs, and what differs there was not moved.`;
}

/**
 * The move of the project at `projectDir` — its own folder, nested in its
 * repository or at the top, as the main checkout holds it — into the state
 * worktree at the repository's main checkout.
 * @param {string} projectDir @param {() => void} reportUpdate @param {() => void} reportSkip
 * @returns {{verify: string}|undefined}
 */
function move(projectDir, reportUpdate, reportSkip) {
  const here = path.resolve(projectDir);
  const main = mainCheckout(here);
  const project = main === null ? here : projectInMain(here, main);
  const from = path.join(project, CODE_TREE_STATE);
  if (main === null || !fs.existsSync(from) || stateBorn(main)) {
    reportSkip();
    return undefined;
  }
  const stopped = stoppedOperation(project);
  if (stopped !== null) {
    throw new Error(`${stopped} is stopped in ${project}, where the move stages the ${STATE_IGNORE_LINE} line — finish or abort it, then start again`);
  }
  const state = placeStateWorktree(main);
  ignoreState(project);
  const settingsNote = renameEngineHooks(project);
  dropIncludeLines(project);
  const manifestFile = path.join(from, 'manifest.json');
  const projectManifest = fs.existsSync(manifestFile) ? readManifest(manifestFile) : {};
  /** @type {Relocations} */
  const relocations = new Map();
  const projectLeft = [
    ...moveProjectFiles(from, state, moveStore(project, state, projectManifest)),
    ...moveProduct(from, state, relocations),
  ];
  reportUpdate();
  const folders = fs.readdirSync(from, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'manifest.json' && !SIDECAR_NAME.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const manifests = new Map(folders.filter((name) => fs.existsSync(path.join(from, name, 'manifest.json')))
    .map((name) => [name, readManifest(path.join(from, name, 'manifest.json'))]));
  const promoted = promotedResearch(from, manifests);
  const unitsLeft = folders.flatMap((name) => {
    const manifest = manifests.get(name);
    if (manifest === undefined) return [name];
    const unitLeft = moveUnit(from, state, name, manifest, promoted, relocations);
    reportUpdate();
    return unitLeft.map((rel) => `${name}/${rel}`);
  });
  writeProjectManifest(state, projectManifest, relocations);
  const userNote = moveUserFolder();
  const left = [...projectLeft, ...unitsLeft];
  const carried = linters.run({ projectDir, reportUpdate: () => {}, reportSkip: () => {} });
  const copied = copyNote(fs.realpathSync(here), project);
  const notes = [
    copied,
    left.length === 0 ? null : `These were not carried into ${STATE_DIR}/, the layout having no place for them: ${left.map((rel) => `${CODE_TREE_STATE}/${rel}`).join(', ')}. Each stays in ${CODE_TREE_STATE}/ until the migration's commit; move any still wanted into its unit's assets/, or the product's.`,
    settingsNote,
    userNote,
    carried && carried.verify ? carried.verify : null,
  ].filter((note) => note !== null);
  return notes.length === 0 ? undefined : { verify: notes.join(' ') };
}

module.exports = {
  id: '078',
  description: 'move the project from .workflows/ into the layout in .leeway/, the state worktree on an unborn leeway-state — each topic\'s log, mail, brief and experiments in its own folder, imports as assets, plans, specs and reviews as reference, the retired state dropped; the roadmap as the product, the baseline docs as its assets, the tracker\'s store in the state, the user-level folder to ~/.config/leeway/, and the project\'s files to the new names',
  info: 'The reshape moves the project\'s state out of .workflows/ into .leeway/, a worktree of its own unborn branch, leeway-state, committing nothing. Each topic\'s research, discussion and investigation become its log, its mail one sequence in its own folder, a cancelled topic\'s mail ideas in the inbox; research feeding several topics goes to a discovery session of the migration\'s; imports become assets, with the documents\' links rewritten; plans, reviews and specs not yet built become reference assets, a completed quick-fix\'s spec its summary; implementation folders, the reviews\' tracking files and the retired manifest state go. The roadmap becomes .product/, its imports its assets and its items\' sources following their files; the baseline docs become reference in .product/assets/baseline/, a native, skipped or completed baseline remembered as the brownfield offer\'s answer; the tracker\'s store is carried into the state. The user-level folder moves to ~/.config/leeway/, a link to it left in its place for projects still on today\'s skills. The code tree\'s .gitignore gains .leeway/, the settings hooks name the engine\'s new path, and .worktreeinclude loses the workflows\' lines, all staged. .workflows/ and the tracker\'s store are left as they are until the migration\'s commit.',
  run({ projectDir, reportUpdate, reportSkip }) {
    return withoutRepositoryEnv(() => move(projectDir, reportUpdate, reportSkip));
  },
};
