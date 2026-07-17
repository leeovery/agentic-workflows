'use strict';

// ---------------------------------------------------------------------------
// Domain ring: absorb — merge a feature into an in-progress epic as a new
// topic, then delete the feature, as ONE transaction. The judgment (choosing
// the feature, the epic, and the topic name; collision conversation with the
// user) stays in the calling prose — this verb takes decided inputs.
//
// Validation is complete before any mutation: on failure both work units are
// byte-identical to before the call — no crash window between the feature's
// deletion and the commit. The manifest writes are the source of truth; the
// knowledge base is a derived index (warn-don't-block); one multi-pathspec
// commit covers the feature's deletion, the epic, and the project manifest.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { loadWorkUnitManifest, saveWorkUnitManifest } = require('../kernel/manifest.cjs');
const { commitScoped } = require('../kernel/git.cjs');
const { knowledge, INDEXED_ARTIFACTS } = require('./kb.cjs');
const { dedupe, readProjectManifest, writeProjectManifestAtomic } = require('./workunit-create.cjs');
const { addItem } = require('./discovery-map.cjs');

// A feature with any of these phases has moved past discussion — absorption
// would orphan the downstream artifacts, so the guard refuses.
const SPEC_OR_BEYOND = ['specification', 'planning', 'implementation', 'review'];

/**
 * @typedef {object} WorkUnitAbsorbResult
 * @property {string} feature   the absorbed (deleted) work unit
 * @property {string} epic      the target work unit
 * @property {string} topic     the new topic's name in the epic
 * @property {{path: string, status: string}} discussion  the moved discussion (epic-relative path)
 * @property {{from: string, topic: string, status: string}[]} research  moved research items
 * @property {{path: string}[]} imports  moved import entries (epic-relative)
 * @property {{path: string, source: string}[]} seeds  moved seed entries (epic-relative)
 * @property {string} routing   the map item's routing (research when the feature did research, else discussion)
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]    set when committed is null
 * @property {string[]} warnings non-blocking failures (knowledge-base sync)
 */

/** The phase's items record, or {}. @param {object} manifest @param {string} phase @returns {Record<string, any>} */
function phaseItems(manifest, phase) {
  const phases = manifest.phases && typeof manifest.phases === 'object' ? manifest.phases : {};
  const ph = phases[phase];
  const items = ph && typeof ph === 'object' ? ph.items : undefined;
  return items && typeof items === 'object' ? items : {};
}

/**
 * Validate a tracked file entry (`imports[]`/`seeds[]`) and plan its move.
 * Shape-invalid entries are refused, not skipped — the feature directory is
 * deleted afterwards, so a silently skipped file would be lost.
 * @param {string} cwd @param {string} feature @param {string} epic
 * @param {string} field  `imports` | `seeds`
 * @param {unknown[]} entries
 * @returns {{entry: Record<string, any>, basename: string, dest: string}[]}
 */
function planTrackedMoves(cwd, feature, epic, field, entries) {
  const shape = new RegExp(`^${field}/[^./][^/]*\\.md$`);
  const destDir = path.join(cwd, '.workflows', epic, field);
  /** @type {Set<string>} */
  const taken = new Set();
  /** @type {{entry: Record<string, any>, basename: string, dest: string}[]} */
  const moves = [];
  for (const entry of entries) {
    const rel = entry && typeof entry === 'object' ? /** @type {Record<string, any>} */ (entry).path : null;
    if (typeof rel !== 'string' || !shape.test(rel)) {
      throw new Error(`feature "${feature}" has a malformed ${field} entry (${JSON.stringify(rel)}) — fix the manifest before absorbing`);
    }
    if (!fs.existsSync(path.join(cwd, '.workflows', feature, rel))) {
      throw new Error(`feature "${feature}" ${field} file missing on disk: ${rel}`);
    }
    const basename = rel.slice(field.length + 1);
    const dest = dedupe(basename, destDir, taken);
    taken.add(dest);
    moves.push({ entry: /** @type {Record<string, any>} */ (entry), basename, dest });
  }
  return moves;
}

/**
 * Absorb a feature into an in-progress epic as `topic`: move the discussion
 * (and any research, imports, and seeds) into the epic — manifest entries
 * carry their original timestamps, filename collisions suffix like create
 * does, research-topic collisions suffix `-{feature}` — mirror each phase
 * item's status onto the epic, register the topic on the discovery map with
 * backfill semantics, remove the feature's knowledge-base chunks and index
 * the moved artifacts at their epic identities (warn-don't-block), delete the
 * feature (directory and project-manifest registration), and commit all three
 * pathspecs at once. Git history serves as provenance.
 * @param {string} cwd project root
 * @param {string} feature
 * @param {{into: string, topic: string}} opts
 * @returns {WorkUnitAbsorbResult}
 */
function absorbWorkUnit(cwd, feature, { into, topic }) {
  // -- validate everything before any mutation --------------------------------
  if (feature === into) {
    throw new Error(`cannot absorb "${feature}" into itself`);
  }
  const featureManifest = loadWorkUnitManifest(cwd, feature);
  if (featureManifest.work_type !== 'feature') {
    throw new Error(`work unit "${feature}" is not a feature (work_type: ${featureManifest.work_type ?? 'none'}) — only features absorb into epics`);
  }
  const epicManifest = loadWorkUnitManifest(cwd, into);
  if (epicManifest.work_type !== 'epic') {
    throw new Error(`work unit "${into}" is not an epic (work_type: ${epicManifest.work_type ?? 'none'})`);
  }
  if (epicManifest.status !== 'in-progress') {
    throw new Error(`epic "${into}" is not in-progress (status: ${epicManifest.status ?? 'none'})`);
  }
  // Same structural rule every topic name lives under.
  if (!topic || /[./]/.test(topic)) {
    throw new Error(`"${topic}" is not a legal topic name — dots and slashes break manifest addressing`);
  }

  // The feature must have a discussion (item + file) and no spec-or-beyond
  // work.
  const discussionItem = phaseItems(featureManifest, 'discussion')[feature];
  if (!discussionItem || typeof discussionItem !== 'object' || typeof discussionItem.status !== 'string') {
    throw new Error(`feature "${feature}" has no discussion — absorb moves the discussion in as the epic topic`);
  }
  const discussionSrc = `.workflows/${feature}/discussion/${feature}.md`;
  if (!fs.existsSync(path.join(cwd, discussionSrc))) {
    throw new Error(`discussion file missing on disk: ${discussionSrc}`);
  }
  for (const phase of SPEC_OR_BEYOND) {
    if (featureManifest.phases && typeof featureManifest.phases === 'object' && featureManifest.phases[phase]) {
      throw new Error(`feature "${feature}" has ${phase} work — absorb is only for features before specification`);
    }
  }

  // The topic must be free in the epic: map, dismissed list, discussion item,
  // discussion file.
  const epicDiscovery = epicManifest.phases && typeof epicManifest.phases === 'object' && epicManifest.phases.discovery && typeof epicManifest.phases.discovery === 'object'
    ? epicManifest.phases.discovery
    : {};
  const epicMapItems = epicDiscovery.items && typeof epicDiscovery.items === 'object' ? epicDiscovery.items : {};
  if (epicMapItems[topic]) {
    throw new Error(`"${topic}" is already on ${into}'s discovery map — pick a different name`);
  }
  if (Array.isArray(epicDiscovery.dismissed) && epicDiscovery.dismissed.includes(topic)) {
    throw new Error(`"${topic}" was dismissed from ${into}'s discovery map — pick a different name, or re-add it from a discovery session first`);
  }
  if (phaseItems(epicManifest, 'discussion')[topic]) {
    throw new Error(`discussion topic "${topic}" already exists in ${into} — pick a different name`);
  }
  const discussionDest = `.workflows/${into}/discussion/${topic}.md`;
  if (fs.existsSync(path.join(cwd, discussionDest))) {
    throw new Error(`${discussionDest} already exists — pick a different name`);
  }

  // Research moves: every item's file must exist; target names dodge the
  // epic's items, its files on disk, and the batch — `-{feature}` first, then
  // numbered.
  const featureResearch = phaseItems(featureManifest, 'research');
  const epicResearch = phaseItems(epicManifest, 'research');
  const epicResearchDir = path.join(cwd, '.workflows', into, 'research');
  /** @type {Set<string>} */
  const takenResearch = new Set();
  /** @param {string} name @returns {string} */
  const researchTarget = (name) => {
    /** @param {string} n */
    const clashes = (n) => takenResearch.has(n)
      || Object.prototype.hasOwnProperty.call(epicResearch, n)
      || fs.existsSync(path.join(epicResearchDir, `${n}.md`));
    if (!clashes(name)) return name;
    const suffixed = `${name}-${feature}`;
    if (!clashes(suffixed)) return suffixed;
    for (let i = 2; ; i++) {
      if (!clashes(`${suffixed}-${i}`)) return `${suffixed}-${i}`;
    }
  };
  /** @type {{from: string, target: string, status: string}[]} */
  const researchMoves = [];
  for (const [name, item] of Object.entries(featureResearch)) {
    const src = `.workflows/${feature}/research/${name}.md`;
    if (!fs.existsSync(path.join(cwd, src))) {
      throw new Error(`research file missing on disk: ${src}`);
    }
    const status = item && typeof item === 'object' && typeof item.status === 'string' ? item.status : null;
    if (status === null) {
      throw new Error(`research item "${name}" in "${feature}" has no status — fix the manifest before absorbing`);
    }
    const target = researchTarget(name);
    takenResearch.add(target);
    researchMoves.push({ from: name, target, status });
  }

  const importMoves = planTrackedMoves(cwd, feature, into, 'imports', Array.isArray(featureManifest.imports) ? featureManifest.imports : []);
  const seedMoves = planTrackedMoves(cwd, feature, into, 'seeds', Array.isArray(featureManifest.seeds) ? featureManifest.seeds : []);

  // Read (and refuse corrupt JSON) before anything mutates.
  const projectManifestFile = path.join(cwd, '.workflows', 'manifest.json');
  const projectManifest = readProjectManifest(projectManifestFile);

  const routing = researchMoves.length > 0 ? 'research' : 'discussion';

  // -- mutate: files, then the manifests, then KB, then one commit ------------
  fs.mkdirSync(path.join(cwd, '.workflows', into, 'discussion'), { recursive: true });
  fs.renameSync(path.join(cwd, discussionSrc), path.join(cwd, discussionDest));
  if (researchMoves.length > 0) fs.mkdirSync(epicResearchDir, { recursive: true });
  for (const move of researchMoves) {
    fs.renameSync(
      path.join(cwd, '.workflows', feature, 'research', `${move.from}.md`),
      path.join(epicResearchDir, `${move.target}.md`));
  }
  /** @param {string} field @param {{basename: string, dest: string}[]} moves */
  const moveTrackedFiles = (field, moves) => {
    if (moves.length === 0) return;
    fs.mkdirSync(path.join(cwd, '.workflows', into, field), { recursive: true });
    for (const move of moves) {
      fs.renameSync(
        path.join(cwd, '.workflows', feature, field, move.basename),
        path.join(cwd, '.workflows', into, field, move.dest));
    }
  };
  moveTrackedFiles('imports', importMoves);
  moveTrackedFiles('seeds', seedMoves);

  // Epic manifest: phase items mirror the feature's statuses; tracked entries
  // carry their original timestamps (and seed provenance) with new paths.
  if (!epicManifest.phases || typeof epicManifest.phases !== 'object') epicManifest.phases = {};
  if (!epicManifest.phases.discussion || typeof epicManifest.phases.discussion !== 'object') epicManifest.phases.discussion = {};
  if (!epicManifest.phases.discussion.items || typeof epicManifest.phases.discussion.items !== 'object') epicManifest.phases.discussion.items = {};
  epicManifest.phases.discussion.items[topic] = { status: discussionItem.status };
  if (researchMoves.length > 0) {
    if (!epicManifest.phases.research || typeof epicManifest.phases.research !== 'object') epicManifest.phases.research = {};
    if (!epicManifest.phases.research.items || typeof epicManifest.phases.research.items !== 'object') epicManifest.phases.research.items = {};
    for (const move of researchMoves) {
      epicManifest.phases.research.items[move.target] = { status: move.status };
    }
  }
  for (const move of importMoves) {
    if (!Array.isArray(epicManifest.imports)) epicManifest.imports = [];
    epicManifest.imports.push({ ...move.entry, path: `imports/${move.dest}` });
  }
  for (const move of seedMoves) {
    if (!Array.isArray(epicManifest.seeds)) epicManifest.seeds = [];
    epicManifest.seeds.push({ ...move.entry, path: `seeds/${move.dest}` });
  }
  saveWorkUnitManifest(cwd, into, epicManifest);

  // The absorbed topic joins the map (routing per the work done, no summary/
  // description — the next epic entry's summary-backfill drafts them).
  addItem(cwd, into, topic, { routing, backfill: true });

  if (projectManifest.work_units && typeof projectManifest.work_units === 'object') {
    delete projectManifest.work_units[feature];
  }
  writeProjectManifestAtomic(projectManifestFile, projectManifest);

  fs.rmSync(path.join(cwd, '.workflows', feature), { recursive: true, force: true });

  // KB: drop the feature's chunks, index the moved artifacts at their epic
  // identities (completed phase artifacts; imports and seeds always).
  /** @type {string[]} */
  const warnings = [];
  knowledge(cwd, ['remove', '--work-unit', feature], 'knowledge remove', warnings);
  if (discussionItem.status === 'completed') {
    knowledge(cwd, ['index', INDEXED_ARTIFACTS.discussion(into, topic)], `knowledge index (discussion/${topic})`, warnings);
  }
  for (const move of researchMoves) {
    if (move.status === 'completed') {
      knowledge(cwd, ['index', INDEXED_ARTIFACTS.research(into, move.target)], `knowledge index (research/${move.target})`, warnings);
    }
  }
  for (const move of importMoves) {
    knowledge(cwd, ['index', `.workflows/${into}/imports/${move.dest}`], `knowledge index (imports/${move.dest})`, warnings);
  }
  for (const move of seedMoves) {
    knowledge(cwd, ['index', `.workflows/${into}/seeds/${move.dest}`], `knowledge index (seeds/${move.dest})`, warnings);
  }

  const committed = commitScoped(
    cwd,
    [`.workflows/${feature}`, `.workflows/${into}`, '.workflows/manifest.json'],
    `workflow(${feature}): absorb into ${into}`);

  /** @type {WorkUnitAbsorbResult} */
  const result = {
    feature,
    epic: into,
    topic,
    discussion: { path: `discussion/${topic}.md`, status: discussionItem.status },
    research: researchMoves.map((move) => ({ from: move.from, topic: move.target, status: move.status })),
    imports: importMoves.map((move) => ({ path: `imports/${move.dest}` })),
    seeds: seedMoves.map((move) => ({ path: `seeds/${move.dest}`, source: move.entry.source })),
    routing,
    committed,
    warnings,
  };
  if (committed === null) result.note = 'nothing to commit';
  return result;
}

module.exports = { absorbWorkUnit };
