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
// them by construction. Each keeps the ledger whole — a ref that resolves,
// nothing the sources hold lost — and none judges what the record says,
// which the directive gives the composer and its verifier to judge:
//   - a topic whose log or brief holds text past its headings has a record
//     of an entry at least;
//   - every entry cites a section, a heading its file holds, in a file
//     that stays where the cite names it wherever the entry goes: its
//     topic's own, which move with its entries, but its mail, whose
//     messages go once read; or one of the unit's beside its topics — its
//     assets, its `spec.md`, its specs joined there where its building
//     started (21.8.5, 078) — which stay with the unit, or move with every
//     entry of it. Never the cache, which is purged, another topic's
//     folder, which a split may take from under the cite, nor another
//     unit's, which its retiring may (21.7). A heading its file holds more
//     than once still names a section of it;
//   - every subtopic its old discussion map holds — in the unit's manifest
//     under `.workflows/`, which the move dropped the map from (21.5.8) —
//     named by an entry's map item, a subtopic's name or a list of them
//     where one entry carries several; whether the entry is a decision, an
//     open question or a finding is what the sources say of it;
//   - every thread of its research the register shows still open or digging
//     named by an entry's thread, a name or a list: an open question where
//     no source answers it, the entry answering it where a later one does;
//   - every import that came in from the topic, as the unit's manifest
//     lists it, whose file the state holds, linked from one of its entries
//     (21.5.7), a record of none included — in a unit of one topic that is
//     no epic, an import from its discovery, `discovery`, being the topic's;
//   - a record carried in discovery, an epic's topic never started, holds no
//     decision and nothing product-wide: nothing is decided in discovery
//     (8.3.4, 8.9.6), so what its research concluded is a finding;
//   - a cross-cutting unit's findings and decisions are every one
//     product-wide: the cut and the merges keep the unit as the product's
//     reference (21.7.3).
// And a unit's: once every topic of it has a record composed or carried,
// every section of its approved specs holding text — a spec kept in its
// assets, or its `spec.md` where its specs were joined — cited by one of
// its records, or marked by the session as holding no decision of a
// topic's (`.cache/migrate/records/{unit}.sections.json`, `{"{path}":
// ["{section}", …]}`): a decision made at the spec stage on a subject no log
// discusses exists nowhere else (21.6.4), and the session sends each such
// section to the topic it belongs to. It is named on each topic drawing on
// it — in a joined spec, each whose part holds it, any section outside the
// parts every topic's of the spec — and asks no composer for an entry.
// A record of no entries keeps every rule but the cites: its old map, its
// threads and its imports are asked of it as of any. A topic promoted to a
// cross-cutting unit took only its discussion there: its research's threads
// stay with the unit it came from, and are read from there. Its reviews
// never folded in are in its log already, where the move folded them
// (078), cited as any section of it is.
//
// The sections of the directive its agents' briefs draw, `briefed`: the
// topic's sources and its record, never the session's own work.
//
// Beside the check, the points to raise (21.6.10): each question of a
// carried record marked to raise, on a topic still live — its unit and its
// item neither cancelled nor postponed — and started, which the engine
// answers, once the check passes, where it has no raise yet: raised at the
// topic, or at the unit's specification where the unit has its spec — its
// `spec.md`, or its specs joined — past which a topic takes no raise. A topic never
// started is carried in discovery, where nothing is decided (8.3.4): its
// points stay open questions on it, which its first opening reads. A
// cross-cutting unit's record is the product's: its points stay open
// questions, the product's once the cut and the merges retire the unit
// (21.7.5), which the product's conversation opens on.
//
// `.workflows/` is read where the move read it: the working tree of the
// project's folder in the repository's main checkout, whichever checkout
// the session runs in (4.1.4), which holds what the old chain and the split
// changed there in the same run, none of it committed (21.5.8). It reads
// and changes nothing, and calls no model. Beside the check it answers a
// topic's sources as the rules read them, which the per-topic agent's
// brief draws (brief-records.cjs).
//
// Known edges: a log with CRLF endings has no heading this reads, nor does
// a fence nested in a four-backtick block end where it should; the carried
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
const COMPOSED = '.cache/migrate/records';
const LEDGER = '.ledger.jsonl';
const OPEN_THREADS = ['open', 'digging'];
const SET_ASIDE = ['cancelled', 'postponed'];
// A spec item the person approved, in the old manifest.
const APPROVED_SPEC = 'completed';
// The spec a building unit's specs are joined into (078).
const JOINED_SPEC = 'spec.md';
// The sections of the directive its agents' briefs draw.
const BRIEFED = ["A Topic's Sources", "A Topic's Record"];
const HEADING = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const FENCE = /^ {0,3}(```|~~~)/;
const PART = /^ {0,3}##[ \t]/;

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

/** The headings of a markdown text, fenced blocks aside. @param {string} text @returns {Set<string>} */
function headingsOf(text) {
  /** @type {Set<string>} */
  const headings = new Set();
  let fenced = false;
  for (const line of text.split('\n')) {
    if (FENCE.test(line)) fenced = !fenced;
    const heading = fenced ? null : HEADING.exec(line);
    if (heading !== null) headings.add(heading[1]);
  }
  return headings;
}

/** Whether a unit's manifest holds the topic in the phase. @param {Record<string, any>} manifest @param {string} phase @param {string} topic */
const holds = (manifest, phase, topic) => TOPIC_PHASES.includes(phase) && isObject(itemsOf(manifest.phases?.[phase]?.items)[topic]);

/**
 * Each section of a markdown text holding text of its own — lines past its
 * heading before the next, fenced blocks among them — by its heading, and
 * the part it is in: the heading at level two over it, or its own at that
 * level, null where none is.
 * @param {string} text @returns {{section: string, part: string|null}[]}
 */
function textSections(text) {
  /** @type {{section: string, part: string|null}[]} */
  const held = [];
  let fenced = false;
  /** @type {{section: string, part: string|null}|null} */
  let open = null;
  /** @type {string|null} */
  let part = null;
  for (const line of text.split('\n')) {
    const fence = FENCE.test(line);
    const heading = fenced || fence ? null : HEADING.exec(line);
    if (fence) fenced = !fenced;
    if (heading !== null) {
      if (PART.test(line)) part = heading[1];
      open = { section: heading[1], part };
    } else if (open !== null && line.trim() !== '') {
      held.push(open);
      open = null;
    }
  }
  return held;
}

/** Whether a text holds anything past its headings and blank lines. @param {string} text */
const holdsText = (text) => text.split('\n').some((line) => line.trim() !== '' && (FENCE.test(line) || HEADING.exec(line) === null));

/** The topics of a unit's manifest the directive carries, once each, sorted. @param {Record<string, any>} manifest @returns {string[]} */
function topicsOf(manifest) {
  const promoted = new Set(Object.entries(itemsOf(manifest.phases?.discussion?.items))
    .filter(([, item]) => isObject(item) && item.status === 'promoted').map(([topic]) => topic));
  return [...new Set(TOPIC_PHASES.flatMap((phase) => Object.keys(itemsOf(manifest.phases?.[phase]?.items))))].filter((topic) => !promoted.has(topic)).sort();
}

/** The folders in `dir`, by name, sorted; none where it is no folder. @param {string} dir @returns {string[]} */
const foldersIn = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort() : []);

/**
 * The project as the rules read it: its folder in the main checkout, the
 * state, and, read once, the units `.workflows/` holds there and each one's
 * manifest.
 * @typedef {{dir: string, stateDir: string, before: (name: string) => Record<string, any>|null, oldUnits: () => string[]}} Project
 */

/** @param {string} projectDir @param {string} stateDir @returns {Project} */
function projectOf(projectDir, stateDir) {
  const dir = mainProject(projectDir);
  const old = path.join(dir, CODE_TREE_STATE);
  /** @type {Map<string, Record<string, any>|null>} */
  const befores = new Map();
  /** @type {string[]|null} */
  let units = null;
  return {
    dir,
    stateDir,
    before: (name) => {
      if (!befores.has(name)) befores.set(name, readJson(path.join(old, name, 'manifest.json')));
      return befores.get(name) ?? null;
    },
    oldUnits: () => {
      units ??= foldersIn(old);
      return units;
    },
  };
}

/**
 * A unit as the rules read it: its manifest in the state, and as
 * `.workflows/` holds it, from before the move.
 * @typedef {{name: string, manifest: Record<string, any>, before: Record<string, any>|null}} Unit
 */

/** @param {Project} project @param {string} name @returns {Unit} */
function unitOf(project, name) {
  return { name, manifest: readJson(path.join(project.stateDir, name, 'manifest.json')), before: project.before(name) };
}

/**
 * The units a topic's research is read from: its own, and each unit
 * `.workflows/` shows promoted the topic to it, which kept it (078).
 * @param {Project} project @param {Unit} unit @param {string} topic @returns {string[]}
 */
function homesOf(project, unit, topic) {
  const from = project.oldUnits().filter((name) => name !== unit.name && project.before(name)?.phases?.discussion?.items?.[topic]?.promoted_to === unit.name);
  return [unit.name, ...from];
}

/** The names a spec item's sources give, in their map form or the legacy list. @param {unknown} sources @returns {string[]} */
function sourceNames(sources) {
  if (Array.isArray(sources)) return sources.filter(isObject).map((row) => String(row.name ?? ''));
  return Object.keys(itemsOf(sources));
}

/**
 * The part of the unit's `spec.md` a spec joined there makes: its area's
 * heading, numbered as the move numbered it (078), or null where the file
 * heads no such part.
 * @param {Project} project @param {Unit} unit @param {string} name
 * @returns {string|null}
 */
function joinedPart(project, unit, name) {
  const number = unit.manifest.spec.joined.indexOf(name) + 1;
  const text = readText(path.join(project.stateDir, unit.name, JOINED_SPEC)) ?? '';
  return text.split('\n').map((line) => /^## (.*\S)\s*$/.exec(line)?.[1]).find((heading) => heading?.startsWith(`${number}. `)) ?? null;
}

/**
 * The topic's specs, as the unit's manifest under `.workflows/` names them —
 * each whose sources name the topic, or that bears its name: where the state
 * keeps it, in `assets/specs/`, or joined into the unit's `spec.md` (078,
 * the topics `spec.joined` names), the part of it it makes; and whether it
 * was approved, its item completed, or is a draft.
 * @param {Project} project @param {Unit} unit @param {string} topic
 * @returns {{name: string, path: string, part: string|null, approved: boolean}[]}
 */
function specsOf(project, unit, topic) {
  return Object.entries(itemsOf(unit.before?.phases?.specification?.items))
    .filter(([name, item]) => name === topic || (isObject(item) && sourceNames(item.sources).includes(topic)))
    .flatMap(([name, item]) => {
      const approved = isObject(item) && item.status === APPROVED_SPEC;
      const kept = `${unit.name}/assets/specs/${name}.md`;
      if (fs.existsSync(path.join(project.stateDir, kept))) return [{ name, path: kept, part: null, approved }];
      if (!Array.isArray(unit.manifest.spec?.joined) || !unit.manifest.spec.joined.includes(name)) return [];
      return [{ name, path: `${unit.name}/${JOINED_SPEC}`, part: joinedPart(project, unit, name), approved }];
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

/** A file of the topic's own, or '' where it has none. @param {Project} project @param {Unit} unit @param {string} topic @param {string} file */
const ownOf = (project, unit, topic, file) => readText(path.join(project.stateDir, unit.name, 'topics', topic, file)) ?? '';

/** Whether the unit has its spec, past which a point is raised at its specification: its `spec.md`, or its specs joined. @param {Project} project @param {Unit} unit */
const hasSpec = (project, unit) => Array.isArray(unit.manifest?.spec?.joined) || isFile(path.join(project.stateDir, unit.name, JOINED_SPEC));

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

/**
 * Whether a cite's path stays where it names wherever the entry goes: a
 * file of the topic's own but its mail, or of the unit's beside its topics.
 * @param {Unit} unit @param {string} topic @param {string} cited
 */
function lasting(unit, topic, cited) {
  const own = `${unit.name}/topics/${topic}/`;
  if (cited.startsWith(own)) return !cited.startsWith(`${own}mail/`);
  return cited.startsWith(`${unit.name}/`) && !cited.startsWith(`${unit.name}/topics/`);
}

/** What a cited section lacks, or null. @param {Project} project @param {Unit} unit @param {string} topic @param {Record<string, unknown>} cite */
function citeProblem(project, unit, topic, { path: cited, section }) {
  if (typeof cited !== 'string' || !lasting(unit, topic, cited)) {
    return `cites ${cited}, which is neither its topic's own, but its mail, nor the unit's beside its topics — a cite names a file that stays with its entry`;
  }
  const text = readText(path.join(project.stateDir, cited));
  if (text === null) return `cites ${cited}, which the state does not hold`;
  return headingsOf(text).has(String(section)) ? null : `cites "${section}" in ${cited}, which has no such heading`;
}

/**
 * What a record carried in discovery holds that nothing there may: a
 * decision, or an entry marked product-wide.
 * @param {Record<string, any>[]} record @returns {string[]}
 */
function undecidedProblems(record) {
  return record.flatMap(({ ref, event, product_wide: wide }) => {
    if (event === 'decided') return [`entry ${ref} decides, and nothing is decided in discovery — what its sources settle is a finding, what they leave open a question`];
    return wide === true ? [`entry ${ref} is product-wide, and nothing found in discovery is product-wide — a line for the product record is decided in the first topic it bears on`] : [];
  });
}

/**
 * What a cross-cutting unit's record holds that is not the product's: a
 * finding or decision not marked product-wide.
 * @param {Record<string, any>[]} record @returns {string[]}
 */
function narrowProblems(record) {
  return record.filter(({ event, product_wide: wide }) => event !== 'asked' && wide !== true)
    .map(({ ref }) => `entry ${ref} is not product-wide, and a cross-cutting unit's findings and decisions all are — the reshape keeps the unit as the product's`);
}

/**
 * What a topic's record breaks of the rules, carried in `phase`: the record
 * as `ledger carry` takes it, `{"entries": [...]}`, each entry its ref,
 * event, the ref of the question it answers, its cites, its map item and
 * thread, each a name or a list, and its assets.
 * @param {Project} project @param {Unit} unit @param {string} topic @param {string} phase @param {Record<string, any>[]} record
 * @returns {string[]}
 */
function problemsOf(project, unit, topic, phase, record) {
  const imports = importsOf(project, unit).filter((entry) => entry.owner === topic && entry.held)
    .filter((entry) => !record.some(({ assets }) => Array.isArray(assets) && assets.some((asset) => isObject(asset) && asset.path === entry.path)))
    .map((entry) => `${entry.path} came in from ${entry.origin}, and no entry links it`);
  const empty = record.length === 0 && ['log.md', 'brief.md'].some((file) => holdsText(ownOf(project, unit, topic, file))) ? ['its record is empty, and its log or brief holds text past its headings'] : [];
  const undecided = phase === 'discovery' ? undecidedProblems(record) : [];
  const narrow = unit.manifest?.work_type === 'cross-cutting' ? narrowProblems(record) : [];
  const cites = record.flatMap(({ ref, cites: given }) => {
    if (!Array.isArray(given) || given.length === 0) return [`entry ${ref} cites nothing`];
    return given.filter(isObject).map((cite) => citeProblem(project, unit, topic, cite)).filter((problem) => problem !== null).map((problem) => `entry ${ref} ${problem}`);
  });
  const items = new Set(record.flatMap((entry) => namesOf(entry.map_item)));
  const mapped = mapOf(unit, topic).filter(({ item }) => !items.has(item))
    .map(({ item, status }) => `${item} is on its old map, ${status}, and no entry names it as its map_item`);
  const threads = new Set(record.flatMap((entry) => namesOf(entry.thread)));
  const open = threadsOf(project, unit, topic).filter(({ thread }) => !threads.has(thread))
    .map(({ thread, status }) => `the thread ${thread} is still ${status} in its research, and no entry names it as its thread`);
  return [...empty, ...undecided, ...narrow, ...cites, ...mapped, ...open, ...imports];
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

/** The sections of the unit's specs the session marked as holding no topic's decision, from the state's folder. @param {string} unit */
const sectionsMarked = (unit) => `${COMPOSED}/${unit}.sections.json`;

/**
 * A topic's record as carried or, before that, as composed: its entries,
 * or null where it has none yet, or none that reads.
 * @param {Project} project @param {Unit} unit @param {string} topic @returns {Record<string, any>[]|null}
 */
function recordOf(project, unit, topic) {
  const carried = carriedOf(project, unit, topic);
  if (carried !== null) return carried.record.entries;
  try {
    const composed = readJson(path.join(project.stateDir, COMPOSED, unit.name, `${topic}.json`));
    return isObject(composed) && Array.isArray(composed.entries) ? composed.entries.filter(isObject) : null;
  } catch {
    return null;
  }
}

/** What the session marked of the unit's specs, by each spec's path: nothing where its file will not read. @param {Project} project @param {Unit} unit @returns {Record<string, any>} */
function marksOf(project, unit) {
  try {
    return itemsOf(readJson(path.join(project.stateDir, sectionsMarked(unit.name))));
  } catch {
    return {};
  }
}

/** A key of a spec's path and a name in it. @param {string} at @param {string|null} name */
const specKey = (at, name) => `${at}\n${name ?? ''}`;

/** `topic` added to those `key` holds. @param {Map<string, Set<string>>} map @param {string} key @param {Iterable<string>} topics */
const drawnBy = (map, key, topics) => map.set(key, new Set([...(map.get(key) ?? []), ...topics]));

/**
 * The sections of a unit's approved specs holding text that none of its
 * records cites, nor the session marked as holding no topic's decision —
 * each with the topics drawing on it: in a joined spec, those whose part
 * holds it, any other section the spec's every topic's — once every topic
 * of it has a record composed or carried; none before.
 * @param {Project} project @param {Unit} unit @returns {{path: string, section: string, topics: string[]}[]}
 */
function uncitedOf(project, unit) {
  const topics = topicsOf(unit.manifest);
  const records = topics.map((topic) => recordOf(project, unit, topic));
  if (records.some((record) => record === null)) return [];
  const cited = new Set(records.flatMap((record) => /** @type {Record<string, any>[]} */ (record).flatMap(({ cites }) => (Array.isArray(cites) ? cites.filter(isObject) : []))
    .map(({ path: at, section }) => specKey(at, section))));
  const marked = marksOf(project, unit);
  /** @type {Map<string, Set<string>>} */
  const bySpec = new Map();
  /** @type {Map<string, Set<string>>} */
  const byPart = new Map();
  for (const topic of topics) {
    for (const spec of specsOf(project, unit, topic).filter(({ approved }) => approved)) {
      drawnBy(bySpec, spec.path, [topic]);
      if (spec.part !== null) drawnBy(byPart, specKey(spec.path, spec.part), [topic]);
    }
  }
  /** @type {Map<string, Set<string>>} */
  const uncited = new Map();
  for (const [at, drawn] of bySpec) {
    const settled = new Set(namesOf(marked[at]));
    for (const { section, part } of textSections(readText(path.join(project.stateDir, at)) ?? '')) {
      if (cited.has(specKey(at, section)) || settled.has(section)) continue;
      drawnBy(uncited, specKey(at, section), byPart.get(specKey(at, part)) ?? drawn);
    }
  }
  return [...uncited].map(([key, drawn]) => {
    const [at, section] = key.split('\n');
    return { path: at, section, topics: [...drawn] };
  });
}

/** What a section no record cites lacks, as the topics drawing on its spec are told it. @param {Unit} unit @param {{path: string, section: string}} uncited */
const uncitedProblem = (unit, { path: at, section }) => `"${section}" in ${at}, an approved spec, holds text no record of ${unit.name} cites — a decision made at the spec stage is carried by the topic it belongs to; one it holds none of is marked in ${sectionsMarked(unit.name)}`;

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
  return problemsOf(project, unit, topic, carried.phase, carried.record.entries);
}

module.exports = {
  counts: { one: 'topic', many: 'topics' },
  done: 'have their records',
  /** @param {{projectDir: string, stateDir: string}} dirs */
  check({ projectDir, stateDir }) {
    const project = projectOf(projectDir, stateDir);
    const ids = ledgerIds(stateDir);
    return unitsOf(project).flatMap((unit) => {
      const uncited = uncitedOf(project, unit);
      return topicsOf(unit.manifest).map((topic) => ({
        name: `${unit.name}/${topic}`,
        problems: [...topicProblems(project, ids, unit, topic), ...uncited.filter(({ topics }) => topics.includes(topic)).map((each) => uncitedProblem(unit, each))],
      }));
    });
  },
  /**
   * The points to raise: each question a carried record marks `raise`, on a
   * topic still live and started, of a unit not cross-cutting — its place,
   * the topic's or, where the unit has its spec, its specification's, the
   * question's id and its text.
   * @param {{projectDir: string, stateDir: string}} dirs
   * @returns {{place: string, answers: string, text: string}[]}
   */
  raises({ projectDir, stateDir }) {
    const project = projectOf(projectDir, stateDir);
    return unitsOf(project).filter((unit) => unit.manifest?.work_type !== 'cross-cutting').flatMap((unit) => topicsOf(unit.manifest).filter((topic) => isLive(unit.manifest, topic)).flatMap((topic) => {
      const carried = carriedOf(project, unit, topic);
      if (carried === null || carried.phase === 'discovery') return [];
      const ids = new Map(carried.entries.map(({ ref, id }) => [ref, id]));
      const place = hasSpec(project, unit) ? `${unit.name}.specification` : `${unit.name}.${carried.phase}.${topic}`;
      return carried.record.entries.filter((entry) => entry.raise === true).map((entry) => ({ place, answers: ids.get(entry.ref), text: entry.text }));
    }));
  },
  briefed: BRIEFED,
  phases: TOPIC_PHASES,
  holds,
  topicsOf,
  /**
   * What a topic's record breaks of the rules, before it is carried in
   * `phase`.
   * @param {{projectDir: string, stateDir: string, unit: string, topic: string, phase: string, entries: Record<string, any>[]}} at
   */
  recordProblems({ projectDir, stateDir, unit, topic, phase, entries }) {
    const project = projectOf(projectDir, stateDir);
    return problemsOf(project, unitOf(project, unit), topic, phase, entries);
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
