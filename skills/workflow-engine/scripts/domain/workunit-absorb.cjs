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
// Each manifest's read-modify-write runs under its own lock (epic, then the
// map add's own, then the project lock — one at a time, never nested, so the
// multi-manifest transaction cannot deadlock); the feature manifest is only
// read, and its directory is deleted, so it takes no lock.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const {
  loadWorkUnitManifest,
  saveWorkUnitManifest,
  withWorkUnitLock,
  readProjectManifest,
  writeProjectManifestAtomic,
  withProjectLock,
  ensureContainer,
} = require('../kernel/manifest.cjs');
const { commitTailWithKb, noteCommitOutcome } = require('./commit.cjs');
const { purgeWorkUnitCache } = require('./cache.cjs');
const { knowledge, INDEXED_ARTIFACTS } = require('./kb.cjs');
const { dedupe } = require('./workunit-create.cjs');
const { addItem } = require('./discovery-map.cjs');
const { reaimJoins } = require('./roadmap.cjs');

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
 * @property {{path: string, status: string, experiments: string[]}} [experiment]  the moved experiment series (epic-relative path), when the feature had one
 * @property {{path: string}[]} imports  moved import entries (epic-relative)
 * @property {{path: string, source: string}[]} seeds  moved seed entries (epic-relative)
 * @property {string} routing   the map item's routing (research when the feature did research, else discussion)
 * @property {string[]} [roadmap_reaimed]  roadmap items whose joins now name the epic topic
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
 * (and any research, experiment series, imports, and seeds) into the epic —
 * manifest entries carry their original timestamps, imports/seeds filename
 * collisions suffix like create does, the research lands at the topic name
 * (a collision refuses like the discussion's), the experiment item and its
 * records travel whole with any live evidence
 * wait riding its holder — mirror each phase item's status onto the epic,
 * register the topic on the discovery map with backfill semantics, remove
 * the feature's knowledge-base chunks and index the moved artifacts of the
 * indexed phases at their epic identities (warn-don't-block), delete the
 * feature (directory
 * and project-manifest registration), and commit all three pathspecs at
 * once. Git history serves as provenance.
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
  const { discussionStatus, researchMoves, importMoves, seedMoves, experimentMove, routing } = withWorkUnitLock(cwd, into, () => {
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

    // A feature's phase items are single and self-named — discussion,
    // research, and experiment alike. A foreign-named item refuses rather
    // than skips: the feature directory is deleted afterwards, so silently
    // skipped material would be lost.
    for (const phase of ['discussion', 'research', 'experiment']) {
      for (const name of Object.keys(phaseItems(featureManifest, phase))) {
        if (name !== feature) {
          throw new Error(`feature "${feature}" has a ${phase} item "${name}" not named after it — a feature's ${phase} is single and self-named; fix the manifest before absorbing`);
        }
      }
    }

    // The topic must be free in the epic: map, dismissed list, discussion
    // item, discussion file.
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

    // The research lands at the topic name — the same landing the discussion
    // and the series take, so the map row, the artifact, and every
    // experiment join share one name.
    const featureResearch = phaseItems(featureManifest, 'research');
    if (featureResearch[feature] !== undefined) {
      if (phaseItems(epicManifest, 'research')[topic]) {
        throw new Error(`research topic "${topic}" already exists in ${into} — pick a different name`);
      }
      if (fs.existsSync(path.join(cwd, '.workflows', into, 'research', `${topic}.md`))) {
        throw new Error(`.workflows/${into}/research/${topic}.md already exists — pick a different name`);
      }
    }

    // The experiment series (when the feature ran one) travels whole — item,
    // records, and directory. Same freedom checks as the discussion.
    const experimentItem = phaseItems(featureManifest, 'experiment')[feature];
    if (experimentItem) {
      if (phaseItems(epicManifest, 'experiment')[topic]) {
        throw new Error(`experiment topic "${topic}" already exists in ${into} — pick a different name`);
      }
      const experimentDest = `.workflows/${into}/experiment/${topic}`;
      if (fs.existsSync(path.join(cwd, experimentDest))) {
        throw new Error(`${experimentDest} already exists — pick a different name`);
      }
    }

    // The research move: the file must exist before anything mutates.
    const epicResearchDir = path.join(cwd, '.workflows', into, 'research');
    /** @type {{from: string, target: string, status: string, dismissed_grounds?: string[], awaiting_experiments?: string[], reconcile_needed?: string}[]} */
    const researchPlan = [];
    const researchItem = featureResearch[feature];
    if (researchItem !== undefined) {
      const src = `.workflows/${feature}/research/${feature}.md`;
      if (!fs.existsSync(path.join(cwd, src))) {
        throw new Error(`research file missing on disk: ${src}`);
      }
      const status = researchItem && typeof researchItem === 'object' && typeof researchItem.status === 'string' ? researchItem.status : null;
      if (status === null) {
        throw new Error(`research item "${feature}" in "${feature}" has no status — fix the manifest before absorbing`);
      }
      researchPlan.push({
        from: feature,
        target: topic,
        status,
        ...(researchItem.dismissed_grounds !== undefined ? { dismissed_grounds: researchItem.dismissed_grounds } : {}),
        ...(researchItem.awaiting_experiments !== undefined ? { awaiting_experiments: researchItem.awaiting_experiments } : {}),
        ...(researchItem.reconcile_needed !== undefined ? { reconcile_needed: researchItem.reconcile_needed } : {}),
      });
    }

    const importPlan = planTrackedMoves(cwd, feature, into, 'imports', Array.isArray(featureManifest.imports) ? featureManifest.imports : []);
    const seedPlan = planTrackedMoves(cwd, feature, into, 'seeds', Array.isArray(featureManifest.seeds) ? featureManifest.seeds : []);

    // Read (and refuse corrupt JSON) before anything mutates; the
    // registration removal re-reads under the project lock after the epic
    // lands.
    readProjectManifest(cwd);

    // -- mutate: files, then the epic manifest ---------------------------------
    fs.mkdirSync(path.join(cwd, '.workflows', into, 'discussion'), { recursive: true });
    fs.renameSync(path.join(cwd, discussionSrc), path.join(cwd, discussionDest));
    if (researchPlan.length > 0) fs.mkdirSync(epicResearchDir, { recursive: true });
    for (const move of researchPlan) {
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
    moveTrackedFiles('imports', importPlan);
    moveTrackedFiles('seeds', seedPlan);
    // The series directory moves whole — record dirs, data extracts, harness
    // scripts, nested sub-experiments. A series whose spawn crashed before
    // the problem statement landed may have no directory yet.
    if (experimentItem && fs.existsSync(path.join(cwd, '.workflows', feature, 'experiment', feature))) {
      fs.mkdirSync(path.join(cwd, '.workflows', into, 'experiment'), { recursive: true });
      fs.renameSync(
        path.join(cwd, '.workflows', feature, 'experiment', feature),
        path.join(cwd, '.workflows', into, 'experiment', topic));
    }

    // Epic manifest: phase items mirror the feature's statuses; tracked
    // entries carry their original timestamps (and seed provenance) with new
    // paths.
    const epicPhases = ensureContainer(epicManifest, 'phases', 'phases');
    const discussion = ensureContainer(epicPhases, 'discussion', 'phases.discussion');
    // A live reconcile flag travels with the topic: research, experiments,
    // and discussion move together, so "the upstream input moved beneath
    // this discussion" stays true in the epic — the map row cues it and the
    // discussion's next entry clears it, same as any epic topic. The topic's
    // dismissed grounds travel too: they are the user's standing
    // do-not-report calls on this material, and the material is what moved —
    // dropping them re-raises findings the user already turned down. A live
    // evidence wait travels with its holder: the series it waits on moves in
    // the same transaction, ids intact and topic-keyed alongside it, so the
    // engine's completion refusal and release edges keep holding in the epic.
    ensureContainer(discussion, 'items', 'phases.discussion.items')[topic] = {
      status: discussionItem.status,
      ...(discussionItem.reconcile_needed !== undefined ? { reconcile_needed: discussionItem.reconcile_needed } : {}),
      ...(discussionItem.dismissed_grounds !== undefined ? { dismissed_grounds: discussionItem.dismissed_grounds } : {}),
      ...(discussionItem.awaiting_experiments !== undefined ? { awaiting_experiments: discussionItem.awaiting_experiments } : {}),
    };
    if (experimentItem) {
      const experiment = ensureContainer(epicPhases, 'experiment', 'phases.experiment');
      // The item travels whole — derived status and every series record
      // (slug, status, verdict, reason) — the register is the record.
      ensureContainer(experiment, 'items', 'phases.experiment.items')[topic] =
        JSON.parse(JSON.stringify(experimentItem));
    }
    if (researchPlan.length > 0) {
      const research = ensureContainer(epicPhases, 'research', 'phases.research');
      const researchItems = ensureContainer(research, 'items', 'phases.research.items');
      for (const move of researchPlan) {
        researchItems[move.target] = {
          status: move.status,
          ...(move.dismissed_grounds !== undefined ? { dismissed_grounds: move.dismissed_grounds } : {}),
          ...(move.awaiting_experiments !== undefined ? { awaiting_experiments: move.awaiting_experiments } : {}),
          ...(move.reconcile_needed !== undefined ? { reconcile_needed: move.reconcile_needed } : {}),
        };
      }
    }
    for (const move of importPlan) {
      if (!Array.isArray(epicManifest.imports)) epicManifest.imports = [];
      epicManifest.imports.push({ ...move.entry, path: `imports/${move.dest}` });
    }
    for (const move of seedPlan) {
      if (!Array.isArray(epicManifest.seeds)) epicManifest.seeds = [];
      epicManifest.seeds.push({ ...move.entry, path: `seeds/${move.dest}` });
    }
    saveWorkUnitManifest(cwd, into, epicManifest);

    return {
      discussionStatus: discussionItem.status,
      researchMoves: researchPlan,
      importMoves: importPlan,
      seedMoves: seedPlan,
      experimentMove: experimentItem
        ? { status: experimentItem.status, ids: Object.keys(experimentItem.experiments || {}) }
        : null,
      routing: researchPlan.length > 0 ? 'research' : 'discussion',
    };
  });

  // The absorbed topic joins the map (routing per the work done, no summary/
  // description — the next epic entry's summary-backfill drafts them). Its
  // own locked read-modify-write.
  addItem(cwd, into, topic, { routing, backfill: true });

  // Registration removal — a fresh read under the project lock.
  withProjectLock(cwd, () => {
    const projectManifest = readProjectManifest(cwd);
    if (projectManifest.work_units && typeof projectManifest.work_units === 'object') {
      delete projectManifest.work_units[feature];
    }
    writeProjectManifestAtomic(cwd, projectManifest);
  });

  // Roadmap joins follow the material: an item pulled into the feature is
  // now delivered by the epic topic it became — re-aim, never orphan (the
  // un-pull is cancel's move; this work did not stop, it moved). Its own
  // lock hold; the project manifest already rides this transaction's commit.
  const reaimed = reaimJoins(cwd, feature, { into, topic });

  fs.rmSync(path.join(cwd, '.workflows', feature), { recursive: true, force: true });

  // KB: drop the feature's chunks, index the moved artifacts at their epic
  // identities (completed phase artifacts; imports and seeds always).
  /** @type {string[]} */
  const warnings = [];
  knowledge(cwd, ['remove', '--work-unit', feature], 'knowledge remove', warnings);
  if (discussionStatus === 'completed') {
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

  const cacheSpec = purgeWorkUnitCache(cwd, feature);
  const outcome = commitTailWithKb(
    cwd,
    [`.workflows/${feature}`, `.workflows/${into}`, '.workflows/manifest.json', ...(cacheSpec ? [cacheSpec] : [])],
    `workflow(${feature}): absorb into ${into}`, warnings);

  /** @type {WorkUnitAbsorbResult} */
  const result = {
    feature,
    epic: into,
    topic,
    discussion: { path: `discussion/${topic}.md`, status: discussionStatus },
    research: researchMoves.map((move) => ({ from: move.from, topic: move.target, status: move.status })),
    imports: importMoves.map((move) => ({ path: `imports/${move.dest}` })),
    seeds: seedMoves.map((move) => ({ path: `seeds/${move.dest}`, source: move.entry.source })),
    routing,
    committed: outcome.committed,
    warnings,
  };
  if (experimentMove) {
    result.experiment = { path: `experiment/${topic}`, status: experimentMove.status, experiments: experimentMove.ids };
  }
  if (reaimed.length > 0) result.roadmap_reaimed = reaimed;
  noteCommitOutcome(result, outcome);
  return result;
}

module.exports = { absorbWorkUnit };
