'use strict';

//
// The check of directive 079, the records (21.6, 21.10.7): one piece for each
// topic of each unit in the state as the move (078) left it — a name holding
// an item in a unit's discovery, discussion or investigation, but a topic an
// epic promoted to a cross-cutting unit, whose record that unit carries —
// done once its record is carried, what `ledger carry` kept of it in the
// state's cache (`.cache/migrate/carried/{unit}/{topic}.json`) each in the
// ledger, and the record keeps the rules.
//
// The rules a topic's record keeps, which `ledger carry` holds a record to
// before it appends a line (ledger-carry.cjs), so a record carried keeps
// them by construction:
//   - a topic whose log holds anything has a record of an entry at least;
//   - every entry cites a section that exists, once: a heading in a file the
//     state holds — the topic's log or brief, an experiment's record, a spec
//     kept in `assets/` — or, cited as `{unit}/spec.md` in a unit whose
//     building started, where the state has none yet, a heading of the
//     unit's specs the code branch's HEAD holds under `.workflows/`, which
//     the cut and the merges join into it verbatim (21.8.5). A heading its
//     file holds more than once names no one section (21.12.7);
//   - every subtopic its old discussion map shows decided — in the unit's
//     manifest as HEAD holds it, which the move dropped the map from
//     (21.5.8) — named by an entry's map item, and every one it shows still
//     pending, exploring, converging or deferred by an open question's: a
//     question of the record no decision of it answers (21.6.7);
//   - every thread of its research the register shows still open or digging,
//     as HEAD holds it, named by an open question's thread;
//   - every review the old agent store holds that landed and was never
//     folded in — in `.workflows/.cache/`, which the move leaves (21.5.10)
//     — in its log, verbatim (21.5.12);
//   - every import that came in from the topic, as the unit's manifest
//     lists it, linked from one of its entries (21.5.7).
// It reads and changes nothing, and calls no model. Beside the check it
// answers a topic's sources as the rules read them, which the per-topic
// agent's brief draws (brief-records.cjs).
//
// Known edges: a review's report the old store holds no row for — a legacy
// `review-*.md` — is not asked for; a unit's manifest left dirty in the
// working tree is moved from there but read here as HEAD holds it; and a
// carried entry's map item and thread are read from the cache file, which
// nothing guards.
//

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CODE_TREE_STATE = '.workflows';
const TOPIC_PHASES = ['discovery', 'discussion', 'investigation'];
const AGENT_PHASES = ['research', 'discussion', 'investigation'];
const CARRIED = '.cache/migrate/carried';
const LEDGER = '.ledger.jsonl';
// What the old map's states say a subtopic still undecided is, where an open question must carry it.
const OPEN_ITEMS = { pending: 'still open', exploring: 'still open', converging: 'still open', deferred: 'deferred' };
const OPEN_THREADS = ['open', 'digging'];
const HEADING = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const FENCE = /^ {0,3}(```|~~~)/;

/** @param {unknown} v @returns {v is Record<string, any>} */
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** @param {unknown} items @returns {Record<string, any>} */
const itemsOf = (items) => (isObject(items) ? items : {});

/** @param {string} file @returns {any} */
function readJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** @param {string} file */
const readText = (file) => (fs.existsSync(file) && fs.statSync(file).isFile() ? fs.readFileSync(file, 'utf8') : null);

/** What git answers from the project's folder, or null. @param {string} projectDir @param {string[]} args */
function fromHead(projectDir, args) {
  const res = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: projectDir, encoding: 'utf8' });
  return res.status === 0 ? res.stdout : null;
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

/** The topics of a unit's manifest the directive carries, once each, sorted. @param {Record<string, any>} manifest @returns {string[]} */
function topicsOf(manifest) {
  const promoted = new Set(Object.entries(itemsOf(manifest.phases?.discussion?.items))
    .filter(([, item]) => isObject(item) && item.status === 'promoted').map(([topic]) => topic));
  return [...new Set(TOPIC_PHASES.flatMap((phase) => Object.keys(itemsOf(manifest.phases?.[phase]?.items))))].filter((topic) => !promoted.has(topic)).sort();
}

/**
 * A unit as the rules read it: its manifest in the state, and as HEAD held
 * it before the move; whether its building started; and, read once, how
 * many times each heading of its specs in HEAD is there, which its spec.md
 * joins.
 * @typedef {{name: string, manifest: Record<string, any>, before: Record<string, any>|null, built: boolean, joined: () => Map<string, number>}} Unit
 */

/** @param {string} projectDir @param {string} stateDir @param {string} name @returns {Unit} */
function unitOf(projectDir, stateDir, name) {
  const held = fromHead(projectDir, ['show', `HEAD:./${CODE_TREE_STATE}/${name}/manifest.json`]);
  const before = held === null ? null : JSON.parse(held);
  /** @type {Map<string, number>|null} */
  let joined = null;
  return {
    name,
    manifest: readJson(path.join(stateDir, name, 'manifest.json')),
    before,
    built: buildingStarted(before),
    joined: () => {
      if (joined !== null) return joined;
      const listed = fromHead(projectDir, ['ls-tree', '-r', '--name-only', 'HEAD', '--', `${CODE_TREE_STATE}/${name}/specification/`]) ?? '';
      joined = headingCounts(listed.split('\n').filter((file) => file.endsWith('/specification.md'))
        .map((file) => fromHead(projectDir, ['show', `HEAD:./${file}`]) ?? '').join('\n'));
      return joined;
    },
  };
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
 * @param {string} stateDir @param {Unit} unit @param {string} topic
 * @returns {{name: string, read: string, cite: string}[]}
 */
function specsOf(stateDir, unit, topic) {
  return Object.entries(itemsOf(unit.before?.phases?.specification?.items))
    .filter(([name, item]) => name === topic || (isObject(item) && sourceNames(item.sources).includes(topic)))
    .flatMap(([name]) => {
      if (unit.built) return [{ name, read: `${CODE_TREE_STATE}/${unit.name}/specification/${name}/specification.md`, cite: `${unit.name}/spec.md` }];
      const kept = `${unit.name}/assets/specs/${name}.md`;
      return fs.existsSync(path.join(stateDir, kept)) ? [{ name, read: kept, cite: kept }] : [];
    });
}

/** The subtopics of the topic's old map, each with its state. @param {Unit} unit @param {string} topic @returns {{item: string, status: string}[]} */
function mapOf(unit, topic) {
  return Object.entries(itemsOf(unit.before?.phases?.discussion?.items?.[topic]?.subtopics))
    .map(([item, row]) => ({ item, status: String(isObject(row) ? row.status : '') }));
}

/** The threads of the topic's research still open or digging. @param {Unit} unit @param {string} topic @returns {{thread: string, status: string, question: string}[]} */
function threadsOf(unit, topic) {
  return Object.entries(itemsOf(unit.before?.phases?.research?.items?.[topic]?.threads))
    .filter(([, row]) => isObject(row) && OPEN_THREADS.includes(row.status))
    .map(([thread, row]) => ({ thread, status: row.status, question: String(row.question ?? '') }));
}

/** The topic's log, or '' where it has none. @param {string} stateDir @param {Unit} unit @param {string} topic */
const logOf = (stateDir, unit, topic) => readText(path.join(stateDir, unit.name, 'topics', topic, 'log.md')) ?? '';

/**
 * The reviews of a topic's old agent store that landed and were never
 * folded in, and are not in its log yet: each its id, its report's path
 * from the project, and its text.
 * @param {string} projectDir @param {string} stateDir @param {Unit} unit @param {string} topic
 * @returns {{id: string, report: string, text: string}[]}
 */
function unfoldedReviews(projectDir, stateDir, unit, topic) {
  const logged = logOf(stateDir, unit, topic);
  return AGENT_PHASES.flatMap((phase) => {
    const dir = path.posix.join(CODE_TREE_STATE, '.cache', unit.name, phase, topic);
    const store = readJson(path.join(projectDir, dir, 'state.json'));
    const rows = isObject(store) && isObject(store.agents) ? Object.values(store.agents) : [];
    return rows.filter((row) => isObject(row) && row.kind === 'review' && row.status !== 'incorporated' && typeof row.id === 'string').flatMap((row) => {
      const report = path.posix.join(dir, `${row.id}.md`);
      const text = (readText(path.join(projectDir, report)) ?? '').trim();
      return text === '' || logged.includes(text) ? [] : [{ id: row.id, report, text }];
    });
  });
}

/** The unit's imports that came in from the topic, each by its path from the state. @param {Unit} unit @param {string} topic @returns {{path: string, origin: string}[]} */
function importsOf(unit, topic) {
  return (Array.isArray(unit.manifest.imports) ? unit.manifest.imports : [])
    .filter((entry) => isObject(entry) && typeof entry.path === 'string' && typeof entry.origin === 'string' && entry.origin.split('/')[1] === topic)
    .map((entry) => ({ path: `${unit.name}/${entry.path}`, origin: entry.origin }));
}

/** What a cited section lacks, or null. @param {string} stateDir @param {Unit} unit @param {{path: string, section: string}} cite */
function citeProblem(stateDir, unit, cite) {
  const text = readText(path.join(stateDir, cite.path));
  const joined = text === null && unit.built && cite.path === `${unit.name}/spec.md`;
  if (text === null && !joined) return `cites ${cite.path}, which the state does not hold`;
  const count = (joined ? unit.joined() : headingCounts(text ?? '')).get(cite.section) ?? 0;
  if (count === 0) return `cites "${cite.section}" in ${cite.path}, which has no such heading`;
  return count === 1 ? null : `cites "${cite.section}" in ${cite.path}, which holds that heading ${count} times — a cite names a heading its file holds once`;
}

/**
 * An entry of a record as the rules read it: its ref, the key its links
 * name it by, its event, the key of the question it answers, its cites, its
 * map item and thread, and the paths of the assets it links.
 * @typedef {{ref: string, key: string, event: string, answers: string|null, cites: {path: string, section: string}[], map_item: string|null, thread: string|null, assets: string[]}} RuleEntry
 */

/**
 * What a topic's record breaks of the rules.
 * @param {{projectDir: string, stateDir: string}} dirs @param {Unit} unit @param {string} topic @param {RuleEntry[]} entries
 * @returns {string[]}
 */
function problemsOf({ projectDir, stateDir }, unit, topic, entries) {
  if (entries.length === 0) return logOf(stateDir, unit, topic).trim() === '' ? [] : ['its record is empty, and its log is not'];
  const cites = entries.flatMap(({ ref, cites: given }) => {
    if (given.length === 0) return [`entry ${ref} cites nothing`];
    return given.map((cite) => citeProblem(stateDir, unit, cite)).filter((problem) => problem !== null).map((problem) => `entry ${ref} ${problem}`);
  });
  const answered = new Set(entries.filter(({ event }) => event === 'decided').map(({ answers }) => answers));
  const open = entries.filter(({ event, key }) => event === 'asked' && !answered.has(key));
  const named = new Set(entries.map((entry) => entry.map_item));
  const openItems = new Set(open.map((entry) => entry.map_item));
  const mapped = mapOf(unit, topic).flatMap(({ item, status }) => {
    if (status === 'decided') return named.has(item) ? [] : [`${item} is decided on its map, and no entry carries it`];
    return Object.hasOwn(OPEN_ITEMS, status) && !openItems.has(item) ? [`${item} is ${OPEN_ITEMS[status]} on its map, and no open question carries it`] : [];
  });
  const openThreads = new Set(open.map((entry) => entry.thread));
  const threads = threadsOf(unit, topic).filter(({ thread }) => !openThreads.has(thread))
    .map(({ thread, status }) => `the thread ${thread} is still ${status} in its research, and no open question carries it`);
  const reviews = unfoldedReviews(projectDir, stateDir, unit, topic).map(({ id }) => `${id}, a review never folded in, is not in its log`);
  const linked = new Set(entries.flatMap(({ assets }) => assets));
  const imports = importsOf(unit, topic).filter((entry) => !linked.has(entry.path))
    .map((entry) => `${entry.path} came in from ${entry.origin}, and no entry links it`);
  return [...cites, ...mapped, ...threads, ...reviews, ...imports];
}

/** The ledger's lines by id, and its asset links by the entry they link from. @param {string} stateDir */
function ledgerOf(stateDir) {
  const file = path.join(stateDir, LEDGER);
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
  /** @type {Map<string, string[]>} */
  const assets = new Map();
  for (const line of lines.filter(({ event }) => event === 'asset')) assets.set(line.entry, [...(assets.get(line.entry) ?? []), line.path]);
  return { entries: new Map(lines.map((line) => [line.id, line])), assets };
}

/**
 * What one topic still lacks: its record carried, in the ledger, keeping
 * the rules.
 * @param {{projectDir: string, stateDir: string}} dirs @param {ReturnType<typeof ledgerOf>} ledger @param {Unit} unit @param {string} topic
 * @returns {string[]}
 */
function topicProblems(dirs, ledger, unit, topic) {
  const carried = readJson(path.join(dirs.stateDir, CARRIED, unit.name, `${topic}.json`));
  if (carried === null) return ['has no record yet'];
  if (!carried.entries.every(({ id }) => ledger.entries.has(id))) return ['its record never reached the ledger'];
  /** @type {RuleEntry[]} */
  const entries = carried.entries.map(({ ref, id, map_item: mapItem = null, thread = null }) => {
    const line = ledger.entries.get(id);
    return { ref, key: id, event: line.event, answers: line.answers ?? null, cites: line.cites ?? [], map_item: mapItem, thread, assets: ledger.assets.get(id) ?? [] };
  });
  return problemsOf(dirs, unit, topic, entries);
}

module.exports = {
  counts: { one: 'topic', many: 'topics' },
  done: 'have their records',
  /** @param {{projectDir: string, stateDir: string}} dirs */
  check(dirs) {
    const ledger = ledgerOf(dirs.stateDir);
    const names = fs.readdirSync(dirs.stateDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && fs.existsSync(path.join(dirs.stateDir, entry.name, 'manifest.json')))
      .map((entry) => entry.name).sort();
    return names.flatMap((name) => {
      const unit = unitOf(dirs.projectDir, dirs.stateDir, name);
      return topicsOf(unit.manifest).map((topic) => ({ name: `${name}/${topic}`, problems: topicProblems(dirs, ledger, unit, topic) }));
    });
  },
  topicsOf,
  /**
   * What a topic's record breaks of the rules, before it is carried.
   * @param {{projectDir: string, stateDir: string, unit: string, topic: string, entries: RuleEntry[]}} at
   */
  recordProblems({ projectDir, stateDir, unit, topic, entries }) {
    return problemsOf({ projectDir, stateDir }, unitOf(projectDir, stateDir, unit), topic, entries);
  },
  /**
   * A topic's sources as the rules read them: its old map, its research's
   * threads still open, its reviews never folded in, its specs, and the
   * imports that came in from it.
   * @param {{projectDir: string, stateDir: string, unit: string, topic: string}} at
   */
  sourcesOf({ projectDir, stateDir, unit: name, topic }) {
    const unit = unitOf(projectDir, stateDir, name);
    return {
      map: mapOf(unit, topic),
      threads: threadsOf(unit, topic),
      reviews: unfoldedReviews(projectDir, stateDir, unit, topic).map(({ id, report }) => ({ id, report })),
      specs: specsOf(stateDir, unit, topic),
      imports: importsOf(unit, topic),
    };
  },
};
