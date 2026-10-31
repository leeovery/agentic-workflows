'use strict';

//
// The check of directive 079, the records (21.6, 21.10.7): one piece for each
// topic of each unit in the state as the move (078) left it — a name holding
// an item in a unit's discovery, discussion or investigation, but a topic an
// epic promoted to a cross-cutting unit, whose record that unit carries —
// done once its record is carried and keeps the rules. It rests on two
// things alone, both frozen with 079: the record `ledger carry` kept of the
// topic in the state's cache (`.cache/migrate/carried/{unit}/{topic}.json`),
// and each id it gave the record's entries standing in the ledger.
//
// The rules a topic's record keeps, which `ledger carry` holds a record to
// before it appends a line (ledger-carry.cjs), so a record carried keeps
// them by construction:
//   - a topic whose log holds anything has a record of an entry at least;
//   - every entry cites a section that exists, once, in a file of the topic's
//     own or the unit's: the topic's log or brief or one of its experiments'
//     records, or a file of the unit's `assets/` — a spec kept there, an
//     import — or, cited as `{unit}/spec.md` in a unit whose building
//     started, where the state has none yet, a heading of the unit's specs
//     the code branch's HEAD holds under `.workflows/`, which the cut and
//     the merges join into it verbatim (21.8.5); nothing in the cache, and
//     nothing of another topic's. A heading its file holds more than once
//     names no one section (21.12.7);
//   - every subtopic its old discussion map shows decided — in the unit's
//     manifest as HEAD holds it, which the move dropped the map from
//     (21.5.8) — named by an entry's map item, and every one it shows still
//     pending, exploring, converging or deferred by an open question's: a
//     question of the record no decision of it answers (21.6.7); an entry's
//     map item is a subtopic's name, or a list of them where one entry
//     settles several;
//   - every thread of its research the register shows still open or digging,
//     as HEAD holds it, named by an open question's thread, a name or a list;
//   - every import that came in from the topic, as the unit's manifest
//     lists it, whose file the state holds, linked from one of its entries
//     (21.5.7), a record of none included — in a unit of one topic that is
//     no epic, an import from its discovery, `discovery`, being the topic's.
// A record of no entries keeps every rule but the cites: its old map, its
// threads and its imports are asked of it as of any. A topic promoted to a
// cross-cutting unit took only its discussion there: its research's threads
// stay with the unit it came from, and are read from there. Its reviews
// never folded in are in its log already, where the move folded them
// (078), cited as any section of it is.
//
// Beside the check, the points to raise (21.6.10): each question of a
// carried record marked to raise, on a topic still live — its unit and its
// item neither cancelled nor postponed — and started, which the engine
// answers, once the check passes, where it has no raise yet. A topic never
// started is carried in discovery, where nothing is decided (8.3.4): its
// points stay open questions on it, which its first opening reads.
//
// `.workflows/` is read where the move read it: the project's folder in the
// repository's main checkout, whichever checkout the session runs in (4.1.4).
// It reads and changes nothing, and calls no model. Beside the check it
// answers a topic's sources as the rules read them, which the per-topic
// agent's brief draws (brief-records.cjs).
//
// Known edges: a unit's manifest left dirty in the working tree is moved
// from there but read here as HEAD holds it; a log with CRLF endings has no
// heading this reads, nor does a fence nested in a four-backtick block end
// where it should; the joined spec's headings are counted over every
// `specification.md` HEAD holds for the unit, superseded and cancelled ones
// among them, as the cut and the merges (080) are to join them; the carried
// file sits in the cache, where a per-topic agent, which may write files,
// could overwrite it; and an epic's imports from its discovery as a whole,
// `discovery`, are owed by no topic, staying in `assets/` unlinked until a
// topic links one.
//

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CODE_TREE_STATE = '.workflows';
const TOPIC_PHASES = ['discovery', 'discussion', 'investigation'];
const CARRIED = '.cache/migrate/carried';
const LEDGER = '.ledger.jsonl';
// What the old map's states say a subtopic still undecided is, where an open question must carry it.
const OPEN_ITEMS = { pending: 'still open', exploring: 'still open', converging: 'still open', deferred: 'deferred' };
const OPEN_THREADS = ['open', 'digging'];
const SET_ASIDE = ['cancelled', 'postponed'];
const HEADING = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const FENCE = /^ {0,3}(```|~~~)/;

/** @param {unknown} v @returns {v is Record<string, any>} */
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** @param {unknown} items @returns {Record<string, any>} */
const itemsOf = (items) => (isObject(items) ? items : {});

/** A name or a list of them, as a list. @param {unknown} named @returns {string[]} */
const namesOf = (named) => (Array.isArray(named) ? named : named === null || named === undefined ? [] : [named]).map(String);

/** @param {string} file @returns {any} */
function readJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** @param {string} file */
const isFile = (file) => fs.statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;

/** @param {string} file */
const readText = (file) => (isFile(file) ? fs.readFileSync(file, 'utf8') : null);

/** What git answers from `dir`, or null. @param {string} dir @param {string[]} args */
function git(dir, args) {
  const res = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: dir, encoding: 'utf8' });
  return res.status === 0 ? res.stdout : null;
}

/**
 * The project's folder in the repository's main checkout, where the move
 * found `.workflows/` (078), from the folder a session runs in: a linked
 * worktree's folder is not it.
 * @param {string} projectDir
 */
function mainProject(projectDir) {
  const common = git(projectDir, ['rev-parse', '--git-common-dir']);
  if (common === null) return projectDir;
  const dir = fs.realpathSync(path.resolve(projectDir, common.trim()));
  if (path.basename(dir) !== '.git') return projectDir;
  return path.resolve(path.dirname(dir), (git(projectDir, ['rev-parse', '--show-prefix']) ?? '').trim());
}

/** How many times each heading of a markdown text is there, fenced blocks aside. @param {string} text @returns {Map<string, number>} */
function headingCounts(text) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  let fenced = false;
  for (const line of text.split('\n')) {
    if (FENCE.test(line)) fenced = !fenced;
    const heading = fenced ? null : HEADING.exec(line);
    if (heading !== null) counts.set(heading[1], (counts.get(heading[1]) ?? 0) + 1);
  }
  return counts;
}

/** Whether a unit's building started, as the move (078) decides it. @param {Record<string, any>|null} manifest */
function buildingStarted(manifest) {
  return Object.values(itemsOf(manifest?.phases?.implementation?.items))
    .some((item) => isObject(item) && (item.status === 'in-progress' || item.status === 'completed'));
}

/** Whether a unit's manifest holds the topic in the phase. @param {Record<string, any>} manifest @param {string} phase @param {string} topic */
const holds = (manifest, phase, topic) => TOPIC_PHASES.includes(phase) && isObject(itemsOf(manifest.phases?.[phase]?.items)[topic]);

/** The topics of a unit's manifest the directive carries, once each, sorted. @param {Record<string, any>} manifest @returns {string[]} */
function topicsOf(manifest) {
  const promoted = new Set(Object.entries(itemsOf(manifest.phases?.discussion?.items))
    .filter(([, item]) => isObject(item) && item.status === 'promoted').map(([topic]) => topic));
  return [...new Set(TOPIC_PHASES.flatMap((phase) => Object.keys(itemsOf(manifest.phases?.[phase]?.items))))].filter((topic) => !promoted.has(topic)).sort();
}

/**
 * The project as the rules read it: its folder in the main checkout, the
 * state, and each unit's manifest as HEAD holds it, read once.
 * @typedef {{dir: string, stateDir: string, before: (name: string) => Record<string, any>|null, headUnits: () => string[]}} Project
 */

/** @param {string} projectDir @param {string} stateDir @returns {Project} */
function projectOf(projectDir, stateDir) {
  const dir = mainProject(projectDir);
  /** @type {Map<string, Record<string, any>|null>} */
  const befores = new Map();
  /** @type {string[]|null} */
  let units = null;
  return {
    dir,
    stateDir,
    before: (name) => {
      if (!befores.has(name)) {
        const held = git(dir, ['show', `HEAD:./${CODE_TREE_STATE}/${name}/manifest.json`]);
        befores.set(name, held === null ? null : JSON.parse(held));
      }
      return befores.get(name) ?? null;
    },
    headUnits: () => {
      units ??= (git(dir, ['ls-tree', '--name-only', 'HEAD', `${CODE_TREE_STATE}/`]) ?? '').split('\n').filter(Boolean).map((entry) => path.posix.basename(entry));
      return units;
    },
  };
}

/**
 * A unit as the rules read it: its manifest in the state, and as HEAD held
 * it before the move; whether its building started; and, read once, how
 * many times each heading of its specs in HEAD is there, which its spec.md
 * joins.
 * @typedef {{name: string, manifest: Record<string, any>, before: Record<string, any>|null, built: boolean, joined: () => Map<string, number>}} Unit
 */

/** @param {Project} project @param {string} name @returns {Unit} */
function unitOf(project, name) {
  const before = project.before(name);
  /** @type {Map<string, number>|null} */
  let joined = null;
  return {
    name,
    manifest: readJson(path.join(project.stateDir, name, 'manifest.json')),
    before,
    built: buildingStarted(before),
    joined: () => {
      if (joined !== null) return joined;
      const listed = git(project.dir, ['ls-tree', '-r', '--name-only', 'HEAD', '--', `${CODE_TREE_STATE}/${name}/specification/`]) ?? '';
      joined = headingCounts(listed.split('\n').filter((file) => file.endsWith('/specification.md'))
        .map((file) => git(project.dir, ['show', `HEAD:./${file}`]) ?? '').join('\n'));
      return joined;
    },
  };
}

/**
 * The units a topic's research is read from: its own, and each unit HEAD
 * shows promoted the topic to it, which kept it (078).
 * @param {Project} project @param {Unit} unit @param {string} topic @returns {string[]}
 */
function homesOf(project, unit, topic) {
  const from = project.headUnits().filter((name) => name !== unit.name && project.before(name)?.phases?.discussion?.items?.[topic]?.promoted_to === unit.name);
  return [unit.name, ...from];
}

/** The names a spec item's sources give, in their map form or the legacy list. @param {unknown} sources @returns {string[]} */
function sourceNames(sources) {
  if (Array.isArray(sources)) return sources.filter(isObject).map((row) => String(row.name ?? ''));
  return Object.keys(itemsOf(sources));
}

/**
 * The topic's specs, as HEAD's manifest names them — each whose sources
 * name the topic, or that bears its name: where the state keeps it, in
 * `assets/specs/`, while the unit's building has not started, or the code
 * branch's file, cited as `{unit}/spec.md`, once it has.
 * @param {Project} project @param {Unit} unit @param {string} topic
 * @returns {{name: string, read: string, cite: string}[]}
 */
function specsOf(project, unit, topic) {
  return Object.entries(itemsOf(unit.before?.phases?.specification?.items))
    .filter(([name, item]) => name === topic || (isObject(item) && sourceNames(item.sources).includes(topic)))
    .flatMap(([name]) => {
      if (unit.built) return [{ name, read: `${CODE_TREE_STATE}/${unit.name}/specification/${name}/specification.md`, cite: `${unit.name}/spec.md` }];
      const kept = `${unit.name}/assets/specs/${name}.md`;
      return fs.existsSync(path.join(project.stateDir, kept)) ? [{ name, read: kept, cite: kept }] : [];
    });
}

/** The subtopics of the topic's old map, each with its state. @param {Unit} unit @param {string} topic @returns {{item: string, status: string}[]} */
function mapOf(unit, topic) {
  return Object.entries(itemsOf(unit.before?.phases?.discussion?.items?.[topic]?.subtopics))
    .map(([item, row]) => ({ item, status: String(isObject(row) ? row.status : '') }));
}

/**
 * The threads of the topic's research still open or digging, wherever it
 * stayed.
 * @param {Project} project @param {Unit} unit @param {string} topic @returns {{thread: string, status: string, question: string}[]}
 */
function threadsOf(project, unit, topic) {
  return homesOf(project, unit, topic).flatMap((home) => Object.entries(itemsOf(project.before(home)?.phases?.research?.items?.[topic]?.threads))
    .filter(([, row]) => isObject(row) && OPEN_THREADS.includes(row.status))
    .map(([thread, row]) => ({ thread, status: row.status, question: String(row.question ?? '') })));
}

/** The topic's log, or '' where it has none. @param {Project} project @param {Unit} unit @param {string} topic */
const logOf = (project, unit, topic) => readText(path.join(project.stateDir, unit.name, 'topics', topic, 'log.md')) ?? '';

/** Whether a topic is still live: its unit and its item neither cancelled nor postponed. @param {Record<string, any>} manifest @param {string} topic */
const isLive = (manifest, topic) => !SET_ASIDE.includes(manifest.status)
  && TOPIC_PHASES.every((phase) => !SET_ASIDE.includes(itemsOf(manifest.phases?.[phase]?.items)[topic]?.status));

/** The topic an import's origin names: its own, or a unit of one topic that is no epic's from its discovery. @param {Unit} unit @param {unknown} origin @returns {string|null} */
function ownerOf(unit, origin) {
  if (typeof origin !== 'string') return null;
  if (origin !== 'discovery') return origin.split('/')[1] ?? null;
  const topics = topicsOf(unit.manifest);
  return unit.manifest.work_type !== 'epic' && topics.length === 1 ? topics[0] : null;
}

/**
 * The unit's imports, each by its path from the state, with where it came
 * in from, the topic owing its link, and whether the state holds its file.
 * @param {Project} project @param {Unit} unit @returns {{path: string, origin: string|null, owner: string|null, held: boolean}[]}
 */
function importsOf(project, unit) {
  return (Array.isArray(unit.manifest.imports) ? unit.manifest.imports : []).filter((entry) => isObject(entry) && typeof entry.path === 'string').map((entry) => {
    const at = `${unit.name}/${entry.path}`;
    return { path: at, origin: typeof entry.origin === 'string' ? entry.origin : null, owner: ownerOf(unit, entry.origin), held: isFile(path.join(project.stateDir, at)) };
  });
}

/** Whether a cite's path is a file of the topic's own or the unit's. @param {Unit} unit @param {string} topic @param {string} cited */
function citable(unit, topic, cited) {
  const own = `${unit.name}/topics/${topic}/`;
  return [`${own}log.md`, `${own}brief.md`, `${unit.name}/spec.md`].includes(cited) || cited.startsWith(`${own}experiments/`) || cited.startsWith(`${unit.name}/assets/`);
}

/** What a cited section lacks, or null. @param {Project} project @param {Unit} unit @param {string} topic @param {{path: string, section: string}} cite */
function citeProblem(project, unit, topic, cite) {
  if (typeof cite.path !== 'string' || !citable(unit, topic, cite.path)) return `cites ${cite.path}, which is none of its topic's log, brief or experiments, nor the unit's assets or spec.md`;
  const text = readText(path.join(project.stateDir, cite.path));
  const joined = text === null && unit.built && cite.path === `${unit.name}/spec.md`;
  if (text === null && !joined) return `cites ${cite.path}, which the state does not hold`;
  const count = (joined ? unit.joined() : headingCounts(text ?? '')).get(cite.section) ?? 0;
  if (count === 0) return `cites "${cite.section}" in ${cite.path}, which has no such heading`;
  return count === 1 ? null : `cites "${cite.section}" in ${cite.path}, which holds that heading ${count} times — a cite names a heading its file holds once`;
}

/**
 * What a topic's record breaks of the rules: the record as `ledger carry`
 * takes it, `{"entries": [...]}`, each entry its ref, event, the ref of the
 * question it answers, its cites, its map item and thread, each a name or a
 * list, and its assets.
 * @param {Project} project @param {Unit} unit @param {string} topic @param {Record<string, any>[]} record
 * @returns {string[]}
 */
function problemsOf(project, unit, topic, record) {
  const imports = importsOf(project, unit).filter((entry) => entry.owner === topic && entry.held)
    .filter((entry) => !record.some(({ assets }) => Array.isArray(assets) && assets.some((asset) => isObject(asset) && asset.path === entry.path)))
    .map((entry) => `${entry.path} came in from ${entry.origin}, and no entry links it`);
  const empty = record.length === 0 && logOf(project, unit, topic).trim() !== '' ? ['its record is empty, and its log is not'] : [];
  const cites = record.flatMap(({ ref, cites: given }) => {
    if (!Array.isArray(given) || given.length === 0) return [`entry ${ref} cites nothing`];
    return given.map((cite) => citeProblem(project, unit, topic, cite)).filter((problem) => problem !== null).map((problem) => `entry ${ref} ${problem}`);
  });
  const answered = new Set(record.filter(({ event }) => event === 'decided').map(({ answers }) => answers));
  const open = record.filter(({ event, ref }) => event === 'asked' && !answered.has(ref));
  const named = new Set(record.flatMap((entry) => namesOf(entry.map_item)));
  const openItems = new Set(open.flatMap((entry) => namesOf(entry.map_item)));
  const mapped = mapOf(unit, topic).flatMap(({ item, status }) => {
    if (status === 'decided') return named.has(item) ? [] : [`${item} is decided on its map, and no entry carries it`];
    return Object.hasOwn(OPEN_ITEMS, status) && !openItems.has(item) ? [`${item} is ${OPEN_ITEMS[status]} on its map, and no open question carries it`] : [];
  });
  const openThreads = new Set(open.flatMap((entry) => namesOf(entry.thread)));
  const threads = threadsOf(project, unit, topic).filter(({ thread }) => !openThreads.has(thread))
    .map(({ thread, status }) => `the thread ${thread} is still ${status} in its research, and no open question carries it`);
  return [...empty, ...cites, ...mapped, ...threads, ...imports];
}

/** The ids the ledger's lines were given. @param {string} stateDir @returns {Set<string>} */
function ledgerIds(stateDir) {
  const file = path.join(stateDir, LEDGER);
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean) : [];
  return new Set(lines.map((line) => JSON.parse(line).id));
}

/** Each unit of the state, by its name, sorted. @param {Project} project @returns {Unit[]} */
function unitsOf(project) {
  return fs.readdirSync(project.stateDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && fs.existsSync(path.join(project.stateDir, entry.name, 'manifest.json')))
    .map((entry) => entry.name).sort().map((name) => unitOf(project, name));
}

/** What `ledger carry` kept of a topic, or null. @param {Project} project @param {Unit} unit @param {string} topic */
const carriedOf = (project, unit, topic) => readJson(path.join(project.stateDir, CARRIED, unit.name, `${topic}.json`));

/**
 * What one topic still lacks: its record carried, each of its ids in the
 * ledger, the record keeping the rules.
 * @param {Project} project @param {Set<string>} ids @param {Unit} unit @param {string} topic
 * @returns {string[]}
 */
function topicProblems(project, ids, unit, topic) {
  const carried = carriedOf(project, unit, topic);
  if (carried === null) return ['has no record yet'];
  if (!carried.entries.every(({ id }) => ids.has(id))) return ['its record never reached the ledger'];
  return problemsOf(project, unit, topic, carried.record.entries);
}

module.exports = {
  counts: { one: 'topic', many: 'topics' },
  done: 'have their records',
  /** @param {{projectDir: string, stateDir: string}} dirs */
  check({ projectDir, stateDir }) {
    const project = projectOf(projectDir, stateDir);
    const ids = ledgerIds(stateDir);
    return unitsOf(project).flatMap((unit) => topicsOf(unit.manifest).map((topic) => ({ name: `${unit.name}/${topic}`, problems: topicProblems(project, ids, unit, topic) })));
  },
  /**
   * The points to raise: each question a carried record marks `raise`, on a
   * topic still live and started — its place, the question's id and its
   * text.
   * @param {{projectDir: string, stateDir: string}} dirs
   * @returns {{place: string, answers: string, text: string}[]}
   */
  raises({ projectDir, stateDir }) {
    const project = projectOf(projectDir, stateDir);
    return unitsOf(project).flatMap((unit) => topicsOf(unit.manifest).filter((topic) => isLive(unit.manifest, topic)).flatMap((topic) => {
      const carried = carriedOf(project, unit, topic);
      if (carried === null || carried.phase === 'discovery') return [];
      const ids = new Map(carried.entries.map(({ ref, id }) => [ref, id]));
      return carried.record.entries.filter((entry) => entry.raise === true)
        .map((entry) => ({ place: `${unit.name}.${carried.phase}.${topic}`, answers: ids.get(entry.ref), text: entry.text }));
    }));
  },
  phases: TOPIC_PHASES,
  holds,
  topicsOf,
  /**
   * What a topic's record breaks of the rules, before it is carried.
   * @param {{projectDir: string, stateDir: string, unit: string, topic: string, entries: Record<string, any>[]}} at
   */
  recordProblems({ projectDir, stateDir, unit, topic, entries }) {
    const project = projectOf(projectDir, stateDir);
    return problemsOf(project, unitOf(project, unit), topic, entries);
  },
  /**
   * A topic's sources as the rules read them: the project's folder they are
   * read in, its old map, its research's threads still open, its specs, and
   * the unit's imports, each with the topic owing its link and whether the
   * state holds its file.
   * @param {{projectDir: string, stateDir: string, unit: string, topic: string}} at
   */
  sourcesOf({ projectDir, stateDir, unit: name, topic }) {
    const project = projectOf(projectDir, stateDir);
    const unit = unitOf(project, name);
    return {
      project: project.dir,
      map: mapOf(unit, topic),
      threads: threadsOf(project, unit, topic),
      specs: specsOf(project, unit, topic),
      imports: importsOf(project, unit),
    };
  },
};
