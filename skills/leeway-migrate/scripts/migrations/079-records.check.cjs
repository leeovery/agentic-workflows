'use strict';

//
// The check of directive 079, the records (21.6, 21.10.7): one piece for each
// topic of each unit in the state as the move (078) left it — a name holding
// an item in a unit's discovery, discussion or investigation — done once it
// lacks none of these:
//   - its record carried: what `ledger carry` kept of it in the state's
//     cache (`.cache/migrate/carried/{unit}/{topic}.json`), each entry it
//     names in the ledger;
//   - every entry citing a section that exists: a heading in a file the
//     state holds — the topic's log or brief, an experiment's record, a
//     spec kept in `assets/` — or, cited as `{unit}/spec.md` where the state
//     has none yet, a heading in one of the unit's specs the code branch's
//     HEAD holds under `.workflows/`, which the cut and the merges join into
//     it verbatim (21.8.5);
//   - every subtopic its old discussion map shows decided — in the unit's
//     manifest as HEAD holds it, which the move dropped the map from
//     (21.5.8) — named by an entry's map item (21.12.7), and every one it
//     shows still pending, exploring or converging, too (21.6.7);
//   - every review the old agent store holds that landed and was never
//     folded in — in `.workflows/.cache/`, which the move leaves (21.5.10)
//     — in its log, verbatim (21.5.12);
//   - every import that came in from the topic, as the unit's manifest
//     lists it, linked from one of its entries (21.5.7).
// It reads and changes nothing, and calls no model.
//

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CODE_TREE_STATE = '.workflows';
const TOPIC_PHASES = ['discovery', 'discussion', 'investigation'];
const AGENT_PHASES = ['research', 'discussion', 'investigation'];
const CARRIED = '.cache/migrate/carried';
// What the old map's states say a subtopic is, where an entry must carry it.
const MAP_STATES = { decided: 'decided', pending: 'still open', exploring: 'still open', converging: 'still open' };
const LEDGER = '.ledger.jsonl';
const HEADING = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const FENCE = /^ {0,3}(```|~~~)/;

/** @param {unknown} v @returns {v is Record<string, any>} */
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** @param {string} file @returns {any} */
function readJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** What git's HEAD holds at `rel`, from the project's folder, or null. @param {string} projectDir @param {string[]} args */
function fromHead(projectDir, args) {
  const res = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: projectDir, encoding: 'utf8' });
  return res.status === 0 ? res.stdout : null;
}

/** The headings of a markdown text, fenced blocks aside. @param {string} text @returns {Set<string>} */
function headingsOf(text) {
  const headings = new Set();
  let fenced = false;
  for (const line of text.split('\n')) {
    if (FENCE.test(line)) fenced = !fenced;
    const heading = fenced ? null : HEADING.exec(line);
    if (heading !== null) headings.add(heading[1]);
  }
  return headings;
}

/**
 * A unit as the check reads it: its manifest in the state, and as HEAD held
 * it before the move; and, read once each, the headings of its specs in
 * HEAD.
 * @typedef {{name: string, manifest: Record<string, any>, before: Record<string, any>|null, specHeadings: () => Set<string>}} Unit
 */

/** @param {string} projectDir @param {string} stateDir @param {string} name @returns {Unit} */
function unitOf(projectDir, stateDir, name) {
  const before = fromHead(projectDir, ['show', `HEAD:./${CODE_TREE_STATE}/${name}/manifest.json`]);
  /** @type {Set<string>|null} */
  let specs = null;
  return {
    name,
    manifest: readJson(path.join(stateDir, name, 'manifest.json')),
    before: before === null ? null : JSON.parse(before),
    specHeadings: () => {
      if (specs !== null) return specs;
      const listed = fromHead(projectDir, ['ls-tree', '-r', '--name-only', 'HEAD', '--', `${CODE_TREE_STATE}/${name}/specification/`]) ?? '';
      specs = new Set(listed.split('\n').filter((file) => file.endsWith('/specification.md'))
        .flatMap((file) => [...headingsOf(fromHead(projectDir, ['show', `HEAD:./${file}`]) ?? '')]));
      return specs;
    },
  };
}

/** The topics of a unit's manifest, once each, sorted. @param {Record<string, any>} manifest */
function topicsOf(manifest) {
  return [...new Set(TOPIC_PHASES.flatMap((phase) => Object.keys(isObject(manifest.phases?.[phase]?.items) ? manifest.phases[phase].items : {})))].sort();
}

/** The ledger's lines by id, and its asset links. @param {string} stateDir */
function ledgerOf(stateDir) {
  const file = path.join(stateDir, LEDGER);
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
  return { entries: new Map(lines.map((line) => [line.id, line])), assets: lines.filter((line) => line.event === 'asset') };
}

/** What a cited section lacks, or null. @param {string} stateDir @param {Unit} unit @param {{path: string, section: string}} cite */
function citeProblem(stateDir, unit, cite) {
  const file = path.join(stateDir, cite.path);
  const held = fs.existsSync(file) && fs.statSync(file).isFile();
  const joined = cite.path === `${unit.name}/spec.md` && !held;
  if (!held && !joined) return `cites ${cite.path}, which the state does not hold`;
  const headings = joined ? unit.specHeadings() : headingsOf(fs.readFileSync(file, 'utf8'));
  return headings.has(cite.section) ? null : `cites "${cite.section}" in ${cite.path}, which has no such heading`;
}

/** The reviews of a topic's old agent store that landed and were never folded in, each with its report. @param {string} projectDir @param {string} unit @param {string} topic */
function unfoldedReviews(projectDir, unit, topic) {
  return AGENT_PHASES.flatMap((phase) => {
    const dir = path.join(projectDir, CODE_TREE_STATE, '.cache', unit, phase, topic);
    const store = readJson(path.join(dir, 'state.json'));
    const rows = isObject(store) && isObject(store.agents) ? Object.values(store.agents) : [];
    return rows.filter((row) => isObject(row) && row.kind === 'review' && row.status !== 'incorporated' && typeof row.id === 'string').flatMap((row) => {
      const report = path.join(dir, `${row.id}.md`);
      const text = fs.existsSync(report) ? fs.readFileSync(report, 'utf8').trim() : '';
      return text === '' ? [] : [{ id: row.id, text }];
    });
  });
}

/**
 * What one topic still lacks.
 * @param {{projectDir: string, stateDir: string, ledger: ReturnType<typeof ledgerOf>, unit: Unit, topic: string}} at
 * @returns {string[]}
 */
function topicProblems({ projectDir, stateDir, ledger, unit, topic }) {
  const carried = readJson(path.join(stateDir, CARRIED, unit.name, `${topic}.json`));
  if (carried === null) return ['has no record yet'];
  if (!carried.entries.every(({ id }) => ledger.entries.has(id))) return ['its record never reached the ledger'];
  const cites = carried.entries.flatMap(({ ref, id }) => {
    const { cites: given = [] } = ledger.entries.get(id);
    if (given.length === 0) return [`entry ${ref} cites nothing`];
    return given.map((cite) => citeProblem(stateDir, unit, cite)).filter((problem) => problem !== null).map((problem) => `entry ${ref} ${problem}`);
  });
  const named = new Set(carried.entries.map((entry) => entry.map_item));
  const subtopics = unit.before?.phases?.discussion?.items?.[topic]?.subtopics;
  const mapped = Object.entries(isObject(subtopics) ? subtopics : {})
    .filter(([item, { status }]) => Object.hasOwn(MAP_STATES, status) && !named.has(item))
    .map(([item, { status }]) => `${item} is ${MAP_STATES[status]} on its map, and no entry carries it`);
  const log = path.join(stateDir, unit.name, 'topics', topic, 'log.md');
  const logged = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';
  const reviews = unfoldedReviews(projectDir, unit.name, topic).filter(({ text }) => !logged.includes(text))
    .map(({ id }) => `${id}, a review never folded in, is not in its log`);
  const ids = new Set(carried.entries.map(({ id }) => id));
  const imports = (Array.isArray(unit.manifest.imports) ? unit.manifest.imports : [])
    .filter((entry) => isObject(entry) && typeof entry.origin === 'string' && entry.origin.split('/')[1] === topic)
    .filter((entry) => !ledger.assets.some((asset) => ids.has(asset.entry) && asset.path === `${unit.name}/${entry.path}`))
    .map((entry) => `${unit.name}/${entry.path} came in from ${entry.origin}, and no entry links it`);
  return [...cites, ...mapped, ...reviews, ...imports];
}

module.exports = {
  counts: { one: 'topic', many: 'topics' },
  done: 'have their records',
  /** @param {{projectDir: string, stateDir: string}} dirs */
  check({ projectDir, stateDir }) {
    const ledger = ledgerOf(stateDir);
    const names = fs.readdirSync(stateDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && fs.existsSync(path.join(stateDir, entry.name, 'manifest.json')))
      .map((entry) => entry.name).sort();
    return names.flatMap((name) => {
      const unit = unitOf(projectDir, stateDir, name);
      return topicsOf(unit.manifest).map((topic) => ({ name: `${name}/${topic}`, problems: topicProblems({ projectDir, stateDir, ledger, unit, topic }) }));
    });
  },
};
