'use strict';

// ---------------------------------------------------------------------------
// Domain ring: absorb — merge a feature into an in-progress epic as a new
// topic, then delete the feature, as ONE transaction (18.3.5). The judgment
// (choosing the feature, the epic, and the topic name; collision
// conversation with the user) stays in the calling prose — this verb takes
// decided inputs.
//
// - The writer lock is held around the whole of it: the feature's ledger
//   lines read, the manifests, the moves and the carry's append. The
//   feature's last-looked mark joins the epic's and goes, each under the
//   mark's own lock, taken inside it (ledger-since.cjs).
// - Validation is complete before any mutation: on failure both work units
//   are byte-identical to before the call.
// - What moves: the feature's topic folder whole — its log, brief, mail and
//   experiments — to the epic topic's (4.11.5); its seeds and assets into
//   the epic's, each under the landing's dedupe; its spikes into
//   the epic's, a slug the epic's spikes hold already suffixed `-2`, `-3`,
//   so no two spikes share one, each spike's twin in the cache with it; each
//   phase item whole; and a map row with the summary and description
//   Claude drafted, in the same save as the items. A dot-named asset is tooling state, never material. The
//   feature's discovery logs go with it.
// - The link rewrite: the engine rewrites only a path its own rename broke,
//   in a document its own move relocated — a seed's, an asset's or a
//   spike's the dedupe renamed, in each markdown file of the
//   moved topic folder.
// - The ledger (5.8.18): one carry at the epic's topic,
//   `{epic}.discussion.{topic}`, listing by id every line made at a place of
//   the feature — its unit's level, its discussion and its experiments —
//   and, as `[from, to]`, each file those lines cite or link that the move
//   took elsewhere, so every read takes them as the epic topic's, naming
//   the files where they went (ledger-rehomed.cjs). It lands once the epic's
//   manifest holds the topic, so no read meets the lines on a topic the
//   epic lacks, and before the feature is deleted. A feature holding none
//   writes no line.
// - The manifest writes are the source of truth; the knowledge base is a
//   derived index (warn-don't-block). One state commit covers the feature's
//   deletion, the epic, the project manifest and the ledger. The record
//   copies follow, rendered and indexed as after any command that changes
//   what is live (ledger-copies.cjs): the feature's removed, the epic
//   topic's written.
// - Known edges:
//   - A kill between the epic's save and the carry's append — the ledger's
//     check, its copy, the rename — leaves the topic in the epic and the
//     lines in the feature, whose log has moved, so the absorb refuses to
//     run again. A kill between the carry and the commit leaves boot to
//     commit the carry alone, the manifests uncommitted.
//   - The verb takes a feature whatever its status; the manage flow offers
//     the absorb for one in progress alone.
//   - A file in the moved folder that is not markdown — an experiment's
//     harness script — keeps a link a rename broke.
//   - A line another clone writes at the feature after the absorb is no
//     line the carry lists: merged in, it stands in a unit that is gone, or
//     in one made later under the name.
// ---------------------------------------------------------------------------

const fs = require('fs');
const {
  loadWorkUnitManifest,
  saveWorkUnitManifest,
  withWorkUnitLock,
  readProjectManifest,
  writeProjectManifestAtomic,
  withProjectLock,
  ensureContainer,
  copyWhole,
} = require('../kernel/manifest.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { purgeWorkUnitCache } = require('./cache.cjs');
const { carryMarks } = require('./ledger-since.cjs');
const { appendEntry, commitLedger } = require('./ledger.cjs');
const { foldLedger } = require('./ledger-fold.cjs');
const { syncKnowledge } = require('./knowledge/sync.cjs');
const { dedupe, homeLinkPattern } = require('./import-landing.cjs');
const { addBatchTo, arrivingEntry, topicNameRefusal } = require('./discovery-map.cjs');
const { topicLog } = require('./topic-log.cjs');
const { reaimAbsorbed, landingOf } = require('./roadmap.cjs');
const { topicDir, mailboxDir, mailboxDepth, briefFile } = require('./derivations.cjs');
const { seriesDir } = require('./experiment-paths.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { filesUnder } = require('./review-phase.cjs');
const { SPIKE_FOLDER, spikesOf } = require('./asset.cjs');
const { assertBeforeSpec } = require('./spec-standing.cjs');

/**
 * @typedef {object} WorkUnitAbsorbResult
 * @property {string} feature   the absorbed (deleted) work unit
 * @property {string} epic      the target work unit
 * @property {string} topic     the new topic's name in the epic
 * @property {{path: string, status: string}} discussion  the moved discussion's log (absolute path)
 * @property {{path: string, status: string, experiments: string[]}} [experiment]  the moved experiment series (absolute path), when the feature had one
 * @property {{path: string}[]} assets  moved assets (absolute)
 * @property {{from: string, to: string}[]} renamed_assets  assets the dedupe renamed, links rewritten in the moved topic folder
 * @property {{path: string}[]} spikes  moved spikes' folders (absolute)
 * @property {{from: string, to: string}[]} renamed_spikes  spikes whose slug the epic's spikes held, links rewritten in the moved topic folder
 * @property {{path: string, source: string}[]} seeds  moved seed entries (absolute)
 * @property {{path: string, count: number}} [mail_moved]  the messages waiting for the feature's topic, moved to the new topic's mailbox (absolute)
 * @property {string[]} [roadmap_reaimed]  roadmap items whose joins now name the epic topic
 * @property {{item: string, from: string, to: string}[]} [roadmap_sources_rewritten]  roadmap sources that followed a moved file
 * @property {{item: string, source: string}[]} [roadmap_sources_dropped]  roadmap sources deleted with the feature
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]    set when committed is null
 * @property {string[]} warnings non-blocking failures (knowledge-base sync)
 */

/** A file or folder planned into the epic: its name in the feature, and the name it lands under. @typedef {{basename: string, dest: string}} Move */

/** The phase's items record, or {}. @param {object} manifest @param {string} phase @returns {Record<string, any>} */
function phaseItems(manifest, phase) {
  const phases = manifest.phases && typeof manifest.phases === 'object' ? manifest.phases : {};
  const ph = phases[phase];
  const items = ph && typeof ph === 'object' ? ph.items : undefined;
  return items && typeof items === 'object' ? items : {};
}

/**
 * Validate the feature's `seeds[]` entries and plan their moves.
 * Shape-invalid entries are refused, not skipped — the feature directory is
 * deleted afterwards, so a silently skipped file would be lost.
 * @param {string} cwd @param {string} feature @param {string} epic
 * @param {unknown[]} entries
 * @returns {(Move & {entry: Record<string, any>})[]}
 */
function planSeeds(cwd, feature, epic, entries) {
  // The first character guards dotfiles and traversal, and the single
  // segment refuses a subdirectory.
  const shape = /^seeds\/[^./][^/]*\.[^./]+$/;
  const destDir = statePath(cwd, epic, 'seeds');
  /** @type {Set<string>} */
  const taken = new Set();
  /** @type {(Move & {entry: Record<string, any>})[]} */
  const moves = [];
  for (const entry of entries) {
    const rel = entry && typeof entry === 'object' ? /** @type {Record<string, any>} */ (entry).path : null;
    if (typeof rel !== 'string' || !shape.test(rel)) {
      throw new Error(`feature "${feature}" has a malformed seeds entry (${JSON.stringify(rel)}) — fix the manifest before absorbing`);
    }
    if (!fs.existsSync(statePath(cwd, feature, rel))) {
      throw new Error(`feature "${feature}" seeds file missing on disk: ${statePath(cwd, feature, rel)}`);
    }
    const basename = rel.slice('seeds/'.length);
    const dest = dedupe(basename, destDir, taken);
    taken.add(dest);
    moves.push({ entry: /** @type {Record<string, any>} */ (entry), basename, dest });
  }
  return moves;
}

/**
 * The files and folders at the top of the feature's assets the absorb
 * moves: all but a dot-named one, which is tooling state and goes with the
 * feature.
 * @param {string} cwd @param {string} feature
 * @returns {string[]}
 */
function assetNames(cwd, feature) {
  const from = statePath(cwd, feature, 'assets');
  return fs.existsSync(from) ? fs.readdirSync(from).filter((name) => !name.startsWith('.')).sort() : [];
}

/**
 * The feature's assets planned into the epic's under the dedupe.
 * @param {string} cwd @param {string} feature @param {string} epic
 * @returns {Move[]}
 */
function planAssets(cwd, feature, epic) {
  const destDir = statePath(cwd, epic, 'assets');
  /** @type {Set<string>} */
  const taken = new Set();
  return assetNames(cwd, feature).map((basename) => {
    const dest = dedupe(basename, destDir, taken);
    taken.add(dest);
    return { basename, dest };
  });
}

/**
 * The feature's spikes, each planned into the epic's under its own number,
 * its slug suffixed `-2`, `-3`, … where one of the epic's spikes, or one
 * planned before it, holds it.
 * @param {string} root @param {string} feature @param {string} epic
 * @returns {Move[]}
 */
function planSpikes(root, feature, epic) {
  const slugOf = (/** @type {string} */ folder) => /** @type {RegExpExecArray} */ (SPIKE_FOLDER.exec(folder))[2];
  const taken = new Set(spikesOf(root, epic).map(slugOf));
  return spikesOf(root, feature).map((basename) => {
    const [, number, slug] = /** @type {RegExpExecArray} */ (SPIKE_FOLDER.exec(basename));
    let free = slug;
    for (let n = 2; taken.has(free); n++) free = `${slug}-${n}`;
    taken.add(free);
    return { basename, dest: `${number}-${free}` };
  });
}

/** The moves the dedupe renamed. @param {Move[]} moves @returns {{from: string, to: string}[]} */
function renamesOf(moves) {
  return moves.filter((move) => move.basename !== move.dest).map((move) => ({ from: move.basename, to: move.dest }));
}

/**
 * Rewrite the links into `home` this absorb's dedupe broke, in one moved
 * document. One pass over every rename at once — a sequential pass would
 * re-rename a link the previous rename had just produced. A link matches
 * only where the old basename ends (a following name character means a
 * different file), so the substitution is exact and a re-run changes
 * nothing.
 * @param {string} file absolute path to the moved document
 * @param {string} home the home moved: `seeds`, `assets` or `spikes`
 * @param {{from: string, to: string}[]} renames
 */
function rewriteLinks(file, home, renames) {
  if (renames.length === 0) return;
  const pattern = homeLinkPattern(home, renames.map((r) => r.from));
  const byName = new Map(renames.map((r) => [r.from, r.to]));
  const before = fs.readFileSync(file, 'utf8');
  const after = before.replace(pattern, (_match, hops, name) => `${hops}${home}/${byName.get(name)}`);
  if (after !== before) fs.writeFileSync(file, after);
}

/**
 * Every line made at a place of `unit` that `keeps` takes, in the
 * ledger's order — a carry made there, which lists lines and is none,
 * never: their ids, and each file they name — a citation's, an asset
 * link's — once.
 * @param {string} root @param {string} unit @param {string[]} warnings
 * @param {(event: Record<string, unknown>) => boolean} [keeps]
 * @returns {{ids: string[], files: Set<string>}}
 */
function linesOf(root, unit, warnings, keeps = () => true) {
  return foldLedger(root, {
    start: () => ({ ids: /** @type {string[]} */ ([]), files: /** @type {Set<string>} */ (new Set()) }),
    step: (lines, event) => {
      if (event.unit !== unit || event.event === 'rehomed' || !keeps(event)) return;
      lines.ids.push(/** @type {string} */ (event.id));
      if (Array.isArray(event.cites)) for (const cite of event.cites) lines.files.add(cite.path);
      if (event.event === 'asset') lines.files.add(/** @type {string} */ (event.path));
    },
  }, warnings);
}

/**
 * Each of `files` the absorb's `relocations` moved, `[from, to]`.
 * @param {Set<string>} files @param {[string, string][]} relocations
 * @returns {[string, string][]}
 */
function movedFiles(files, relocations) {
  /** @type {[string, string][]} */
  const moved = [];
  for (const file of files) {
    const to = landingOf(file, relocations);
    if (to !== null) moved.push([file, to]);
  }
  return moved;
}

/**
 * Refuse a topic the epic cannot take, before anything moves: a name that
 * is no topic's (the map's own rule), one on the map, struck from it, or
 * another topic goes by, and an item or a folder at it.
 * @param {string} cwd @param {Record<string, any>} epicManifest @param {string} into @param {string} topic @param {boolean} series whether an experiment series moves
 */
function refuseTopic(cwd, epicManifest, into, topic, series) {
  const misnamed = topicNameRefusal(topic);
  if (misnamed !== null) throw new Error(misnamed);
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
  if (series && phaseItems(epicManifest, 'experiment')[topic]) {
    throw new Error(`experiment topic "${topic}" already exists in ${into} — pick a different name`);
  }
  const folder = statePath(cwd, topicDir(into, topic));
  if (fs.existsSync(folder)) throw new Error(`${folder} already exists — pick a different name`);
}

/** Only a feature absorbs. @param {string} feature @param {Record<string, any>} featureManifest */
function assertFeature(feature, featureManifest) {
  if (featureManifest.work_type !== 'feature') {
    throw new Error(`work unit "${feature}" is not a feature (work_type: ${featureManifest.work_type ?? 'none'}) — only features absorb into epics`);
  }
}

/**
 * Refuse a feature that cannot be absorbed, whatever the epic: one of
 * another type, one with no discussion — its item and its log — and one
 * past its spec, whose topic is gone and the spec its record (4.11.2).
 * Answers its discussion's item.
 * @param {string} cwd @param {string} feature @param {Record<string, any>} featureManifest
 * @returns {Record<string, any>}
 */
function absorbableFeature(cwd, feature, featureManifest) {
  assertFeature(feature, featureManifest);
  const discussionItem = phaseItems(featureManifest, 'discussion')[feature];
  if (!discussionItem || typeof discussionItem !== 'object' || typeof discussionItem.status !== 'string') {
    throw new Error(`feature "${feature}" has no discussion — absorb moves the discussion in as the epic topic`);
  }
  const discussionSrc = statePath(cwd, topicLog(feature, feature));
  if (!fs.existsSync(discussionSrc)) {
    throw new Error(`discussion log missing on disk: ${discussionSrc}`);
  }
  assertBeforeSpec(cwd, featureManifest, 'ownWork');
  return discussionItem;
}

/**
 * Refuse an absorb of `feature` into `into` as `topic` that cannot run,
 * before anything moves (the header's): the feature as `absorbableFeature`
 * refuses it, the epic not an epic in progress before its spec, a phase
 * item of the feature's not named after it, and a topic the epic cannot
 * take. Answers the feature's discussion and experiment items.
 * @param {string} cwd @param {string} feature @param {Record<string, any>} featureManifest
 * @param {string} into @param {Record<string, any>} epicManifest @param {string} topic
 * @returns {{discussionItem: Record<string, any>, experimentItem: Record<string, any>|undefined}}
 */
function refuseAbsorb(cwd, feature, featureManifest, into, epicManifest, topic) {
  if (feature === into) {
    throw new Error(`cannot absorb "${feature}" into itself`);
  }
  assertFeature(feature, featureManifest);
  if (epicManifest.work_type !== 'epic') {
    throw new Error(`work unit "${into}" is not an epic (work_type: ${epicManifest.work_type ?? 'none'})`);
  }
  if (epicManifest.status !== 'in-progress') {
    throw new Error(`epic "${into}" is not in-progress (status: ${epicManifest.status ?? 'none'})`);
  }
  assertBeforeSpec(cwd, epicManifest, 'absorbInto');
  const discussionItem = absorbableFeature(cwd, feature, featureManifest);
  // A feature's phase items are single and self-named — discussion and
  // experiment alike. A foreign-named item refuses rather than skips: the
  // feature directory is deleted afterwards, so silently skipped material
  // would be lost.
  for (const phase of ['discussion', 'experiment']) {
    for (const name of Object.keys(phaseItems(featureManifest, phase))) {
      if (name !== feature) {
        throw new Error(`feature "${feature}" has a ${phase} item "${name}" not named after it — a feature's ${phase} is single and self-named; fix the manifest before absorbing`);
      }
    }
  }
  const experimentItem = phaseItems(featureManifest, 'experiment')[feature];
  refuseTopic(cwd, epicManifest, into, topic, Boolean(experimentItem));
  return { discussionItem, experimentItem };
}

/**
 * Whether the absorb would run as given, read off both units' manifests
 * and writing nothing — refused as the absorb refuses (`refuseAbsorb`).
 * @param {string} cwd @param {string} feature @param {{into: string, topic: string}} opts
 */
function absorbStands(cwd, feature, { into, topic }) {
  refuseAbsorb(cwd, feature, loadWorkUnitManifest(cwd, feature), into, loadWorkUnitManifest(cwd, into), topic);
}

/**
 * Absorb a feature into an in-progress epic as `topic`: move its topic
 * folder, seeds, assets and spikes into the epic — manifest entries
 * carrying their original timestamps, filename collisions suffixed on the
 * shared landing discipline (a renamed file or spike has its links
 * rewritten in the moved topic folder) — carry each phase item whole onto the epic beside
 * its map row, carry the feature's ledger lines to the epic topic, remove
 * the feature's knowledge-base chunks (warn-don't-block), delete the feature (directory
 * and project-manifest registration), and commit it all at once. Git
 * history serves as provenance. The topic's map row carries the summary
 * and description Claude drafted from its record and its log (18.3.7).
 * @param {string} cwd project root
 * @param {string} feature
 * @param {{into: string, topic: string, summary?: string, description?: string}} opts
 * @returns {WorkUnitAbsorbResult}
 */
function absorbWorkUnit(cwd, feature, { into, topic, summary, description }) {
  const entry = arrivingEntry(topic, { summary, description }, 'workunit absorb');
  const root = stateRoot(cwd);
  return withStateLock(root, () => {
    const featureManifest = loadWorkUnitManifest(cwd, feature);
    /** @type {string[]} */
    const warnings = [];
    const moved = withWorkUnitLock(cwd, into, () => {
      const epicManifest = loadWorkUnitManifest(cwd, into);
      const { discussionItem, experimentItem } = refuseAbsorb(cwd, feature, featureManifest, into, epicManifest, topic);
      addBatchTo(epicManifest, [entry], null);

      const seedPlan = planSeeds(cwd, feature, into, Array.isArray(featureManifest.seeds) ? featureManifest.seeds : []);
      const assetPlan = planAssets(cwd, feature, into);
      const spikePlan = planSpikes(root, feature, into);
      /** @type {[string, Move[]][]} */
      const homes = [['seeds', seedPlan], ['assets', assetPlan], ['spikes', spikePlan]];
      const waiting = mailboxDepth(root, feature, feature);

      // Read (and refuse corrupt JSON) before anything mutates; the
      // registration removal re-reads it.
      readProjectManifest(cwd);
      const lines = linesOf(root, feature, warnings);
      const session = handedSession();
      if (lines.ids.length > 0 && session === null) {
        throw new Error(`feature "${feature}" holds ledger entries, which the absorb carries to the epic topic in this conversation — Claude Code hands every command it runs a session id, and this one has none`);
      }

      // -- mutate: files, then the epic manifest, then the ledger --------------
      const landed = statePath(cwd, topicDir(into, topic));
      fs.mkdirSync(statePath(cwd, into, 'topics'), { recursive: true });
      fs.renameSync(statePath(cwd, topicDir(feature, feature)), landed);
      const documents = filesUnder(landed).filter((rel) => rel.endsWith('.md')).map((rel) => `${landed}/${rel}`);
      for (const [home, moves] of homes) {
        if (moves.length > 0) fs.mkdirSync(statePath(cwd, into, home), { recursive: true });
        for (const move of moves) fs.renameSync(statePath(cwd, feature, home, move.basename), statePath(cwd, into, home, move.dest));
        for (const document of documents) rewriteLinks(document, home, renamesOf(moves));
      }
      for (const move of spikePlan) {
        const twin = statePath(cwd, '.cache', feature, 'spikes', move.basename);
        if (!fs.existsSync(twin)) continue;
        fs.mkdirSync(statePath(cwd, '.cache', into, 'spikes'), { recursive: true });
        fs.renameSync(twin, statePath(cwd, '.cache', into, 'spikes', move.dest));
      }

      // Every move above, as state-relative `[from, to]`: the topic folder,
      // each file and folder of a home, then each home that moved anything,
      // so a source naming the folder itself follows it.
      /** @type {[string, string][]} */
      const relocations = [[topicDir(feature, feature), topicDir(into, topic)]];
      for (const [home, moves] of homes) {
        for (const move of moves) relocations.push([`${feature}/${home}/${move.basename}`, `${into}/${home}/${move.dest}`]);
      }
      for (const [home, moves] of homes) if (moves.length > 0) relocations.push([`${feature}/${home}`, `${into}/${home}`]);

      // The items travel whole — the discussion's dismissed grounds and any
      // evidence wait, the experiment's derived status and every record —
      // since a field list is how state gets dropped; tracked entries carry
      // their original timestamps (and seed provenance) with new paths.
      const epicPhases = ensureContainer(epicManifest, 'phases', 'phases');
      const discussion = ensureContainer(epicPhases, 'discussion', 'phases.discussion');
      ensureContainer(discussion, 'items', 'phases.discussion.items')[topic] = copyWhole(discussionItem);
      if (experimentItem) {
        const experiment = ensureContainer(epicPhases, 'experiment', 'phases.experiment');
        ensureContainer(experiment, 'items', 'phases.experiment.items')[topic] = copyWhole(experimentItem);
      }
      for (const move of seedPlan) {
        if (!Array.isArray(epicManifest.seeds)) epicManifest.seeds = [];
        epicManifest.seeds.push({ ...move.entry, path: `seeds/${move.dest}` });
      }
      saveWorkUnitManifest(cwd, into, epicManifest);
      if (lines.ids.length > 0) {
        appendEntry(root, {
          event: 'rehomed', unit: into, topic, phase: 'discussion', session, lines: lines.ids, files: movedFiles(lines.files, relocations),
        }, warnings);
      }

      return {
        discussionStatus: discussionItem.status,
        seedPlan,
        assetPlan,
        spikePlan,
        experimentMove: experimentItem
          ? { status: experimentItem.status, ids: Object.keys(experimentItem.experiments || {}) }
          : null,
        waiting,
        relocations,
        carried: lines.ids.length > 0,
      };
    });

    withProjectLock(cwd, () => {
      const projectManifest = readProjectManifest(cwd);
      if (projectManifest.work_units && typeof projectManifest.work_units === 'object') {
        delete projectManifest.work_units[feature];
      }
      writeProjectManifestAtomic(cwd, projectManifest);
    });

    // The roadmap follows the material: an item pulled into the feature is now
    // delivered by the epic topic it became — re-aim, never orphan (the
    // un-pull is cancel's move; this work did not stop, it moved) — and a
    // source into the feature names where its file landed, or goes with the
    // feature where nothing moved it. The project manifest rides this
    // transaction's commit.
    const roadmap = reaimAbsorbed(cwd, feature, { into, topic, relocations: moved.relocations });

    fs.rmSync(statePath(cwd, feature), { recursive: true, force: true });

    syncKnowledge(cwd, [{ remove: { workUnit: feature } }], warnings);

    purgeWorkUnitCache(cwd, feature);
    carryMarks(root, feature, into, warnings);
    const paths = [feature, into, 'manifest.json'];
    const message = `workflow(${feature}): absorb into ${into}`;
    const outcome = moved.carried ? commitLedger(cwd, message, warnings, paths) : commitStateTail(cwd, paths, message, warnings);

    /** @type {WorkUnitAbsorbResult} */
    const result = {
      feature,
      epic: into,
      topic,
      discussion: { path: statePath(cwd, topicLog(into, topic)), status: moved.discussionStatus },
      assets: moved.assetPlan.map((move) => ({ path: statePath(cwd, into, 'assets', move.dest) })),
      renamed_assets: renamesOf(moved.assetPlan),
      spikes: moved.spikePlan.map((move) => ({ path: statePath(cwd, into, 'spikes', move.dest) })),
      renamed_spikes: renamesOf(moved.spikePlan),
      seeds: moved.seedPlan.map((move) => ({ path: statePath(cwd, into, 'seeds', move.dest), source: move.entry.source })),
      committed: outcome.committed,
      warnings,
    };
    if (moved.experimentMove) {
      result.experiment = { path: statePath(cwd, seriesDir(into, topic)), status: moved.experimentMove.status, experiments: moved.experimentMove.ids };
    }
    if (moved.waiting > 0) result.mail_moved = { path: statePath(cwd, mailboxDir(into, topic)), count: moved.waiting };
    if (roadmap.reaimed.length > 0) result.roadmap_reaimed = roadmap.reaimed;
    if (roadmap.rewritten.length > 0) result.roadmap_sources_rewritten = roadmap.rewritten;
    if (roadmap.dropped.length > 0) result.roadmap_sources_dropped = roadmap.dropped;
    noteCommitOutcome(result, outcome);
    return result;
  });
}

/**
 * What the absorb moves of the feature's own besides its manifest's
 * entries: whether its topic holds a brief, the messages waiting for it,
 * and how many assets and spikes it holds.
 * @param {string} cwd @param {string} feature
 * @returns {{brief: boolean, mail: number, assets: number, spikes: number}}
 */
function absorbedMaterial(cwd, feature) {
  const root = stateRoot(cwd);
  return {
    brief: fs.existsSync(statePath(cwd, briefFile(feature, feature))),
    mail: mailboxDepth(root, feature, feature),
    assets: assetNames(cwd, feature).length,
    spikes: spikesOf(root, feature).length,
  };
}

module.exports = { absorbWorkUnit, absorbStands, absorbableFeature, absorbedMaterial, linesOf, movedFiles };
