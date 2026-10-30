'use strict';

//
// Migration 078: The reshape's move — each unit into the layout in `.leeway/`
//
// Step 3 of the reshape's sequence (21.2, 21.5): the project's state leaves
// `.workflows/` in the main checkout for the state worktree, `.leeway/`, on
// its own branch, `leeway-state`. Written against today's shape: the shape
// the chain up to 072 leaves.
//
// Where it writes: the state worktree, added here on an unborn
// `leeway-state` and locked as the engine locks it. Git 2.40 has no
// `worktree add --orphan`, so the worktree is added detached with nothing
// checked out, and `switch --orphan` empties it onto the unborn branch; every
// git call here runs with hooks off and the caller's repository environment
// cleared. A plain `.leeway/` already there — the runner's migrations record,
// written before this step runs — is set aside while the worktree is added,
// then put back inside it. A `.leeway/` already on `leeway-state` is written
// again: a move cut short is run again from the start. Nothing is committed
// (21.9.3), and nothing is staged: the migration's commit, made at finish,
// takes the whole state. `.workflows/` stays where it is, read as it stands,
// and is never changed; finish drops it from the default branch.
//
// The project: its manifest is carried whole, with the project's id minted
// on it (21.5.20) — kept where a move cut short already minted one — and
// the inbox and the environment setup file carried as they are. The state's
// own `.gitignore` is written as the engine writes it. `.roadmap/`,
// `.baseline/`, the tracker's store and the user-level folder are the
// project-level move's; the old cache, the knowledge store and the old
// migrations record are left where they are (21.5.10).
//
// Each unit, a folder under `.workflows/` holding a manifest:
//   - a topic's log, `topics/{topic}/log.md`, is its research, its discussion
//     and its investigation, each verbatim under a heading of its own, in that
//     order (21.5.2, 21.5.3). A topic is a name the unit's map, discussions or
//     investigations hold, or, for a feature, bugfix or cross-cutting unit,
//     the unit's own name; research under any other name fed the topics it
//     was split into or spawned, and goes to a discovery session of its own,
//     numbered after the unit's last and headed as the migration's, until the
//     cut and the merges place it (21.5.4);
//   - its mail, from every box it had, is one sequence in `topics/{topic}/
//     mail/`, renumbered where it had more than one box (21.5.5); a cancelled
//     topic's mail goes to the inbox instead, each message an idea, its first
//     line the title (21.5.6, 10.1.6);
//   - its brief is `topics/{topic}/brief.md`, and its experiment records sit
//     in `topics/{topic}/experiments/` as they stood (21.5.13);
//   - discovery's sessions are `discovery/session-NNN.md`, numbers kept;
//   - `imports/` is `assets/`, and every moved document's links into it
//     (`../imports/{name}`) are rewritten to the asset's place from the
//     document's own; each `imports[]` entry's path follows its file (21.5.7);
//   - plans go to `assets/plans/{topic}/` and review folders to
//     `assets/reviews/{topic}/`, names kept; a spec goes to
//     `assets/specs/{topic}.md` where the unit's building has not started —
//     an implementation item in progress or completed — and, where it has,
//     stays for the cut and the merges to join into `spec.md` (21.8.5); a
//     quick-fix's spec goes to `assets/specs/` whatever its building, and
//     once the quick-fix is completed its spec is its `summary.md` and its
//     plan goes (21.5.15, 21.5.16);
//   - implementation folders, the unit's `.state/`, and every tracking or
//     analysis file go (21.5.17); seeds stay as they are;
//   - a cancelled unit moves as any other (21.5.14).
//
// The unit's manifest is today's shape, less research and the retired state
// (21.5.8): the research phase goes, a topic whose research joined its log
// and that has no discussion yet taking a discussion item of the research's
// standing; scoping goes; and so do the map's routing, staging, the spec's
// build order and review cycles, and the plan's review tracking and
// dependencies. Everything else carries as it stood, the fields 21.5.9 names
// among them, a brief's path following its brief. Each later reshape of a
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

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const linters = require('./073-environment-linters.cjs');

const CODE_TREE_STATE = '.workflows';
const STATE_DIR = '.leeway';
const SET_ASIDE = '.leeway-set-aside';
const STATE_BRANCH = 'leeway-state';
const STATE_LOCK_REASON = 'leeway state, do not remove';
const STATE_GITIGNORE = ['/.knowledge/', '/.cache/', '/.lock', '/.lock.*', '.manifest.json.*.tmp', '/.ledger.jsonl.*.tmp', ''].join('\n');

const REPOSITORY_ENV = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_CONFIG', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS', 'GIT_DIR',
  'GIT_IMPLICIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_NAMESPACE', 'GIT_OBJECT_DIRECTORY', 'GIT_PREFIX', 'GIT_WORK_TREE',
];

const SINGLE_TOPIC_TYPES = ['feature', 'bugfix', 'cross-cutting'];
const LOG_PHASES = ['research', 'discussion', 'investigation'];
const LOG_HEADINGS = { research: 'Research', discussion: 'Discussion', investigation: 'Investigation' };
const STAGING = ['staging', 'analysis_staging'];
const RETIRED_PHASES = ['research', 'scoping'];
const RETIRED_PHASE_FIELDS = { specification: ['build_order_stale'] };
const RETIRED_ITEM_FIELDS = {
  discovery: ['routing'],
  specification: ['order', 'review_cycle', 'tracking'],
  planning: ['review_cycle', 'review_baseline_words', 'approvals', 'tracking', 'external_dependencies'],
};
const RESEARCH_STANDING = { unstarted: 'unstarted', cancelled: 'cancelled', postponed: 'postponed' };

const DELIVERY_PHASES = ['specification', 'planning', 'review'];
// Folders carried whole under a name of the layout's, their files as they are.
const CARRIED = { imports: 'assets', seeds: 'seeds' };
const DROP = Symbol('drop');
const STAYS = Symbol('stays');

const IMPORT_LINK = /(?:\.\.\/)+imports\/([A-Za-z0-9._-]+)/g;
const MAILBOX_MESSAGE = /^(research|discussion|investigation)\/\.mailbox\/([^/]+)\/([^/]+\.md)$/;
const SESSION = /^discovery\/sessions\/(session-([0-9]{3,})\.md)$/;
const TRACKING_OR_ANALYSIS = /(?:^|-)(?:tracking|analysis)(?:-|\.)/;

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

/** @param {string} cwd @param {string[]} args @returns {{ok: boolean, stdout: string, stderr: string}} */
function git(cwd, args) {
  const env = { ...process.env };
  for (const name of REPOSITORY_ENV) delete env[name];
  const res = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd, env, encoding: 'utf8' });
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

/**
 * The state worktree at `.leeway/` on an unborn `leeway-state`, locked —
 * added, with whatever a plain folder there held put back inside it, or the
 * one a move cut short already added.
 * @param {string} main @returns {string}
 */
function placeStateWorktree(main) {
  const root = path.join(main, STATE_DIR);
  if (onStateBranch(root)) return root;
  const aside = path.join(main, SET_ASIDE);
  const held = fs.existsSync(root);
  if (held) fs.renameSync(root, aside);
  mustGit(main, ['worktree', 'add', '--quiet', '--detach', '--no-checkout', STATE_DIR, 'HEAD']);
  mustGit(root, ['switch', '--quiet', '--orphan', STATE_BRANCH]);
  mustGit(main, ['worktree', 'lock', '--reason', STATE_LOCK_REASON, STATE_DIR]);
  if (held) {
    for (const name of fs.readdirSync(aside)) fs.renameSync(path.join(aside, name), path.join(root, name));
    fs.rmdirSync(aside);
  }
  return root;
}

/** Every file under `dir`, as posix paths relative to it. @param {string} dir @param {string} [at] @returns {string[]} */
function filesUnder(dir, at = '') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(path.join(dir, at), { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((entry) => {
      const rel = at === '' ? entry.name : `${at}/${entry.name}`;
      return entry.isDirectory() ? filesUnder(dir, rel) : [rel];
    });
}

/** @param {string} file @param {string|Buffer} content */
function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/** @param {string} file @returns {any} */
function readManifest(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`the move cannot read ${file} — fix it, then run again: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * A document's links into its unit's imports, pointed at the assets from
 * the place it now sits, both state-relative.
 * @param {string} text @param {string} at @param {string} unit
 */
function relinked(text, at, unit) {
  const hops = path.posix.relative(path.posix.dirname(at), `${unit}/assets`);
  return text.replace(IMPORT_LINK, (_link, name) => `${hops}/${name}`);
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
 * research joined its log and that has no discussion yet.
 * @param {Record<string, any>} manifest @param {Set<string>} topics
 */
function foldResearch(manifest, topics) {
  const discussion = itemsOf(manifest, 'discussion');
  for (const [topic, item] of Object.entries(itemsOf(manifest, 'research'))) {
    if (!topics.has(topic) || Object.hasOwn(discussion, topic) || !isObject(item)) continue;
    discussion[topic] = { status: standingOf(item.status), ...('previous_status' in item ? { previous_status: standingOf(item.previous_status) } : {}) };
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

/**
 * The unit's manifest less research and the retired state, each import's
 * path following its file.
 * @param {Record<string, any>} manifest @param {Set<string>} topics
 * @returns {Record<string, any>}
 */
function reshapedManifest(manifest, topics) {
  const out = structuredClone(manifest);
  if (isObject(out.phases)) {
    foldResearch(out, topics);
    dropRetired(out.phases);
  }
  if (Array.isArray(out.imports)) {
    out.imports = out.imports.map((entry) => (isObject(entry) && typeof entry.path === 'string' && entry.path.startsWith('imports/')
      ? { ...entry, path: `assets/${entry.path.slice('imports/'.length)}` }
      : entry));
  }
  return out;
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
 * One unit's move: where its files come from and go, which of them are
 * accounted for, and what decides each one's place.
 * @typedef {{
 *   unit: string,
 *   from: string,
 *   state: string,
 *   files: string[],
 *   accounted: Set<string>,
 *   topics: Set<string>,
 *   cancelled: Set<string>,
 *   quickFix: boolean,
 *   quickFixDone: boolean,
 *   built: boolean,
 * }} UnitMove
 */

/** A file of the unit's, accounted for. @param {UnitMove} move @param {string} rel @returns {Buffer} */
function take(move, rel) {
  move.accounted.add(rel);
  return fs.readFileSync(path.join(move.from, rel));
}

/** A document of the unit's, accounted for, its links pointed from `at`, state-relative. @param {UnitMove} move @param {string} rel @param {string} at */
function takeDocument(move, rel, at) {
  return relinked(take(move, rel).toString('utf8'), at, move.unit);
}

/** @param {UnitMove} move @param {string} at unit-relative @param {string|Buffer} content */
function put(move, at, content) {
  writeFile(path.join(move.state, move.unit, at), content);
}

/**
 * Each topic's log, its research, discussion and investigation each under
 * its own heading; and research no topic of its name holds, in a discovery
 * session of the migration's, numbered after the unit's last.
 * @param {UnitMove} move
 */
function moveLogs(move) {
  /** @type {Map<string, string[]>} */
  const logs = new Map();
  /** @type {string[]} */
  const spread = [];
  for (const phase of LOG_PHASES) {
    for (const rel of move.files.filter((f) => path.posix.dirname(f) === phase && f.endsWith('.md'))) {
      const topic = path.posix.basename(rel, '.md');
      if (phase === 'research' && !move.topics.has(topic)) {
        spread.push(`## Research: ${topic}\n\n${endLine(takeDocument(move, rel, `${move.unit}/discovery/session.md`))}`);
        continue;
      }
      const part = `## ${LOG_HEADINGS[phase]}\n\n${endLine(takeDocument(move, rel, `${move.unit}/topics/${topic}/log.md`))}`;
      logs.set(topic, [...(logs.get(topic) ?? []), part]);
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
  put(move, `discovery/session-${number}.md`, [...head, '', ...spread].join('\n'));
}

/**
 * A cancelled topic's message as an idea in the inbox, its first line the
 * title — written once, a move run again finding it there.
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
    if (!fs.existsSync(file)) return writeFile(file, content);
    if (fs.readFileSync(file, 'utf8') === content) return undefined;
  }
}

/**
 * Each topic's mail, from every box it had, as one sequence in its own
 * folder — renumbered where it had more than one box — or, for a cancelled
 * topic, ideas in the inbox.
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
      if (move.cancelled.has(topic)) return messageToInbox(move, rel, name);
      const renamed = box.size > 1 ? `${String(i + 1).padStart(3, '0')}${name.replace(/^[0-9]+/, '')}` : name;
      const at = `topics/${topic}/mail/${renamed}`;
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
  if (TRACKING_OR_ANALYSIS.test(path.posix.basename(below))) return DROP;
  if (top === 'planning') return move.quickFixDone ? DROP : `assets/plans/${topic}/${below}`;
  if (top === 'review') return `assets/reviews/${topic}/${below}`;
  if (below !== 'specification.md') return null;
  if (move.quickFixDone) return 'summary.md';
  return move.built && !move.quickFix ? STAYS : `assets/specs/${topic}.md`;
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
  if (top === 'experiment') return `topics/${topic}/experiments/${inside.join('/')}`;
  if (top === 'discovery') return topic === 'briefs' && inside.length === 1 && inside[0].endsWith('.md') ? `topics/${inside[0].slice(0, -3)}/brief.md` : null;
  return DELIVERY_PHASES.includes(top) ? deliveryPlace(move, top, topic, inside.join('/')) : null;
}

/**
 * Move one unit into the layout — every file placed, dropped, or left
 * behind — then its manifest.
 * @param {string} from @param {string} state @param {string} unit
 * @returns {string[]} the files left behind, unit-relative
 */
function moveUnit(from, state, unit) {
  const manifest = readManifest(path.join(from, 'manifest.json'));
  const topics = topicNames(manifest, unit);
  const reshaped = reshapedManifest(manifest, topics);
  /** @type {UnitMove} */
  const move = {
    unit,
    from,
    state,
    files: filesUnder(from),
    accounted: new Set(['manifest.json']),
    topics,
    cancelled: cancelledTopics(reshaped),
    quickFix: manifest.work_type === 'quick-fix',
    quickFixDone: manifest.work_type === 'quick-fix' && manifest.status === 'completed',
    built: buildingStarted(manifest),
  };
  moveLogs(move);
  moveMail(move);
  for (const rel of move.files.filter((f) => !move.accounted.has(f))) {
    const at = placeOf(move, rel);
    if (at === null) continue;
    if (typeof at === 'symbol') move.accounted.add(rel);
    else if (!rel.endsWith('.md') || Object.hasOwn(CARRIED, rel.split('/')[0])) put(move, at, take(move, rel));
    else put(move, at, takeDocument(move, rel, `${unit}/${at}`));
  }
  put(move, 'manifest.json', jsonText(reshaped));
  return move.files.filter((f) => !move.accounted.has(f));
}

/**
 * The project's manifest, its id minted, the inbox, the environment setup
 * and the state's own ignore file.
 * @param {string} from @param {string} state
 */
function moveProject(from, state) {
  const file = path.join(from, 'manifest.json');
  const project = fs.existsSync(file) ? readManifest(file) : {};
  const moved = path.join(state, 'manifest.json');
  const minted = fs.existsSync(moved) ? readManifest(moved).project_id : undefined;
  writeFile(moved, jsonText({ project_id: typeof minted === 'string' ? minted : newId(), ...project }));
  for (const rel of filesUnder(path.join(from, '.inbox'))) writeFile(path.join(state, '.inbox', rel), fs.readFileSync(path.join(from, '.inbox', rel)));
  const setup = path.join(from, '.state', 'environment-setup.md');
  if (fs.existsSync(setup)) writeFile(path.join(state, '.state', 'environment-setup.md'), fs.readFileSync(setup));
  writeFile(path.join(state, '.gitignore'), STATE_GITIGNORE);
}

module.exports = {
  id: '078',
  description: 'move the project from .workflows/ into the layout in .leeway/, the state worktree on an unborn leeway-state — each topic\'s log, mail, brief and experiments in its own folder, imports as assets, plans, specs and reviews as reference, the retired state dropped',
  info: 'The reshape moves the project\'s state out of .workflows/ into .leeway/, a worktree of its own unborn branch, leeway-state, committing nothing. Each topic\'s research, discussion and investigation become its log, its mail one sequence in its own folder, a cancelled topic\'s mail ideas in the inbox; research feeding several topics goes to a discovery session of the migration\'s; imports become assets, with the documents\' links rewritten; plans, reviews and specs not yet built become reference assets, a completed quick-fix\'s spec its summary; implementation folders, tracking and analysis files and the retired manifest state go. .workflows/ is left as it is until the migration\'s commit.',
  run({ projectDir, reportUpdate, reportSkip }) {
    const main = mainCheckout(projectDir);
    if (main === null || !fs.existsSync(path.join(main, CODE_TREE_STATE)) || stateBorn(main)) {
      reportSkip();
      return undefined;
    }
    const from = path.join(main, CODE_TREE_STATE);
    const state = placeStateWorktree(main);
    moveProject(from, state);
    reportUpdate();
    const left = fs.readdirSync(from, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'manifest.json')
      .map((entry) => entry.name)
      .sort()
      .flatMap((name) => {
        if (!fs.existsSync(path.join(from, name, 'manifest.json'))) return [name];
        const unitLeft = moveUnit(path.join(from, name), state, name);
        reportUpdate();
        return unitLeft.map((rel) => `${name}/${rel}`);
      });
    const carried = linters.run({ projectDir, reportUpdate: () => {}, reportSkip: () => {} });
    const notes = [
      ...(left.length === 0 ? [] : [`These were not carried into ${STATE_DIR}/, the layout having no place for them: ${left.map((rel) => `${CODE_TREE_STATE}/${rel}`).join(', ')}. Each stays in ${CODE_TREE_STATE}/ until the migration's commit; move any still wanted into its unit's assets/.`]),
      ...(carried && carried.verify ? [carried.verify] : []),
    ];
    return notes.length === 0 ? undefined : { verify: notes.join(' ') };
  },
};
