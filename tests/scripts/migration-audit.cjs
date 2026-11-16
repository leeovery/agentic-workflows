'use strict';

// ---------------------------------------------------------------------------
// The migration audit (21.1.1, 21.1.4, 21.1.5; 2.8.1): whether a project the
// migration took into Leeway migrated cleanly, read and never written — it
// calls one engine verb, boot, which must find nothing left to do, and
// writes nothing to git or the state itself. The old state's files are
// read from a listing taken before the migration (`listOld`): each file
// under `.workflows/`, by its path there, its content's hash, and the text
// of each document and manifest outside the old cache, the old engine's
// record and the knowledge store.
//
// A project migrated cleanly where:
//   - no `.workflows/` is left in its folder;
//   - its migrations record holds every migration installed;
//   - `engine boot` answers `ready`, moving neither branch;
//   - every unit the registry names has a manifest of today's shape: its
//     name its folder's, its type and status today's, its type the
//     registry's, its phases today's, an item's status its phase's, and
//     items in the topics' phases alone — but a quick-fix's building, its
//     own; a unit the old registry already named with no manifest is listed
//     apart, never a fault;
//   - every topic decided in its discussion has a decision in the ledger,
//     read where every carry took it;
//   - no unit waits on a cut: none in progress has its specs joined and no
//     cut;
//   - each phase of a cut adopted from the tracker holds every task the
//     tracker holds under its parent, open or done, and each phase of the
//     old plan in the tracker is one of the cut's;
//   - every file the old state held is placed — byte for byte anywhere in
//     the state, a manifest where its unit or the project is, or a
//     document whose every line is kept, its headings, link targets and
//     case aside — or is one the migration rebuilds, never kept: the old
//     cache's other files, the old engine's record, the knowledge store but
//     its config, a unit's `.state/`, the old state's own ignore file, and
//     the tools' sidecars;
//   - every link or embed in a document the migration wrote — no legacy
//     file, kept as it was — and every citation and asset a ledger line
//     names, where its carries moved it, and every roadmap source names a
//     file; a link already dead in the old state, by its words and target,
//     is listed apart, never a fault.
//
// The report, as JSON: `ok`, the `faults`, each its check and what it
// found, and the counts a rehearsal reports — units by type and status,
// decisions, legacy files, and dead links before the migration and after,
// those after split into the old ones and the migration's — with the dead
// links and the units registered with no manifest the old state already
// held, each listed.
//
// As a command: `node migration-audit.cjs list <project>` prints the
// listing; `node migration-audit.cjs audit <project> <listing.json>`
// prints the report and exits 1 on any fault. The caller pins the
// environment boot runs in.
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(ROOT, 'skills/leeway-engine/scripts');
const ENGINE = path.join(SCRIPTS, 'engine.cjs');
const MIGRATIONS = path.join(ROOT, 'skills/leeway-migrate/scripts/migrations');
const schema = require(path.join(SCRIPTS, 'kernel/manifest-schema.cjs'));
const { SIDECAR_NAME } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { rehomedPlaces, asRehomed } = require(path.join(SCRIPTS, 'domain/ledger-rehomed.cjs'));
const { chosenDriver } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));

const OLD = '.workflows';
const STATE = '.leeway';
const LEGACY = /(?:^|\/)assets\/legacy\//;
const REBUILT = [/^\.cache\/(?!.*\.md$)/, /^\.state\//, /^\.knowledge\/(?!config\.json$)/, /^\.gitignore$/, /^[^/]+\/\.state\//];
const TEXT = /\.(?:md|json)$/;
const UNREAD = /^(?:\.cache|\.state|\.knowledge)\//;
const LINK = /(!?)\[([^\]]*)\]\(([^)\s]+)\)/g;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** @typedef {{sha: string, text?: string}} OldFile */
/** @typedef {{files: Record<string, OldFile>}} Listing */
/** @typedef {{check: string, found: string}} Fault */

/** @param {Buffer|string} bytes */
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

/** Every file below `dir`, by its path from it, `.git` left out. @param {string} dir @returns {string[]} */
function filesBelow(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath ?? entry.path, entry.name)))
    .filter((rel) => !rel.split(path.sep).includes('.git'));
}

/** @param {string} text @returns {any} */
function parsed(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** @param {string} file @returns {any} */
const readJson = (file) => (fs.existsSync(file) ? parsed(fs.readFileSync(file, 'utf8')) : null);

/**
 * The old state's listing, taken before the migration (the header's).
 * @param {string} project @returns {Listing}
 */
function listOld(project) {
  const old = path.join(project, OLD);
  return {
    files: Object.fromEntries(filesBelow(old).map((rel) => {
      const bytes = fs.readFileSync(path.join(old, rel));
      return [rel, TEXT.test(rel) && !UNREAD.test(rel) ? { sha: sha(bytes), text: bytes.toString('utf8') } : { sha: sha(bytes) }];
    })),
  };
}

/** The state as the audit reads it: its files, its manifests and its ledger. @param {string} project */
function readState(project) {
  const root = path.join(project, STATE);
  const files = filesBelow(root).filter((rel) => !rel.startsWith('.cache/') && !/^\.knowledge\/(?!config\.json$)/.test(rel));
  const ledgerFile = path.join(root, '.ledger.jsonl');
  const lines = fs.existsSync(ledgerFile) ? fs.readFileSync(ledgerFile, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
  const places = rehomedPlaces(lines.filter(({ event }) => event === 'rehomed'));
  return {
    root,
    files,
    project: readJson(path.join(root, 'manifest.json')) ?? {},
    ledger: lines.filter(({ event }) => event !== 'rehomed').map((line) => asRehomed(places, line)),
  };
}

/** @typedef {ReturnType<typeof readState>} State */

/** The units of the state: each folder holding a manifest, by name, with it. @param {State} state @returns {Map<string, any>} */
function unitsOf(state) {
  const names = state.files.filter((rel) => /^[^./][^/]*\/manifest\.json$/.test(rel)).map((rel) => rel.split('/')[0]);
  return new Map(names.map((name) => [name, readJson(path.join(state.root, name, 'manifest.json'))]));
}

/** The migration ids the migrate skill installs. */
function installedMigrations() {
  return [...new Set(fs.readdirSync(MIGRATIONS).filter((name) => /^\d+-/.test(name) && !name.endsWith('.check.cjs')).map((name) => name.slice(0, name.indexOf('-'))))];
}

/** @param {string} project @returns {Fault[]} */
function oldStateGone(project) {
  return fs.existsSync(path.join(project, OLD)) ? [{ check: 'old-state-gone', found: `${OLD}/ is still in the project's folder` }] : [];
}

/** @param {State} state @returns {Fault[]} */
function migrationsRecorded(state) {
  const record = path.join(state.root, '.state/migrations');
  const held = new Set((fs.existsSync(record) ? fs.readFileSync(record, 'utf8') : '').split('\n').map((line) => line.split(' ')[0]));
  return installedMigrations().filter((id) => !held.has(id)).map((id) => ({ check: 'migrations-recorded', found: `migration ${id} is not in the record` }));
}

/** @param {string} dir @param {string[]} args */
const gitRead = (dir, args) => (fs.existsSync(dir) ? spawnSync('git', args, { cwd: dir, encoding: 'utf8' }).stdout.trim() : '');

/** @param {string} project @param {State} state @returns {Fault[]} */
function bootReady(project, state) {
  const heads = () => [gitRead(project, ['rev-parse', 'HEAD']), gitRead(state.root, ['rev-parse', 'HEAD'])];
  const before = heads();
  const run = spawnSync(process.execPath, [ENGINE, 'boot'], { cwd: project, encoding: 'utf8', input: '\n' });
  const answer = parsed(run.stdout);
  /** @type {Fault[]} */
  const faults = [];
  if (answer?.state !== 'ready') faults.push({ check: 'boot-ready', found: `boot answered ${answer?.state ?? `nothing: ${run.stderr.trim()}`}` });
  if (heads().join() !== before.join()) faults.push({ check: 'boot-ready', found: 'boot committed: the migration left work behind it' });
  return faults;
}

/** The phases whose items a unit keeps: the topics', and a quick-fix's building besides. @param {any} manifest */
const keepsItems = (manifest) => [...schema.TOPIC_PHASES, ...(manifest.work_type === 'quick-fix' ? schema.BUILD_PHASES : [])];

/** The phases past the topics' a unit keeps items in. @param {any} manifest @returns {string[]} */
const strayItems = (manifest) => Object.entries(manifest?.phases ?? {})
  .filter(([phase, data]) => !keepsItems(manifest).includes(phase) && Object.keys(data?.items ?? {}).length > 0).map(([phase]) => phase);

/** What a unit's manifest gets wrong. @param {string} name @param {any} manifest @param {any} registered @returns {string[]} */
function manifestFaults(name, manifest, registered) {
  if (manifest === null) return ['its manifest does not read'];
  const phases = manifest.phases ?? {};
  return [
    ...strayItems(manifest).map((phase) => `it keeps ${phase} items, which no phase past the topics' keeps`),
    manifest.name === name ? null : `it names itself ${JSON.stringify(manifest.name)}`,
    schema.VALID_WORK_TYPES.includes(manifest.work_type) ? null : `its type ${JSON.stringify(manifest.work_type)} is not today's`,
    registered?.work_type === manifest.work_type ? null : `the registry holds it as ${JSON.stringify(registered?.work_type)}`,
    schema.VALID_WORK_UNIT_STATUSES.includes(manifest.status) ? null : `its status ${JSON.stringify(manifest.status)} is not today's`,
    ...Object.keys(phases).filter((phase) => !schema.VALID_PHASES.includes(phase)).map((phase) => `its phase ${phase} is not today's`),
    ...Object.entries(phases).filter(([phase]) => schema.VALID_PHASES.includes(phase)).flatMap(([phase, data]) => Object.entries(data?.items ?? {})
      .filter(([, item]) => (phase === 'discovery' ? 'status' in item : !schema.VALID_PHASE_STATUSES[phase].includes(item.status)))
      .map(([topic, item]) => `its ${phase} item ${topic} reads ${JSON.stringify(item.status)}`)),
  ].filter((fault) => fault !== null);
}

/** The units the old registry named with no manifest. @param {Listing} old @returns {Set<string>} */
function unregisteredBefore(old) {
  const registry = parsed(old.files['manifest.json']?.text ?? '')?.work_units ?? {};
  return new Set(Object.keys(registry).filter((name) => !(`${name}/manifest.json` in old.files)));
}

/** @param {State} state @param {Map<string, any>} units @param {Set<string>} before @returns {{faults: Fault[], old: string[]}} */
function manifestsValid(state, units, before) {
  const registry = state.project.work_units ?? {};
  const missing = Object.keys(registry).filter((name) => !units.has(name));
  return {
    faults: [
      ...missing.filter((name) => !before.has(name)).map((name) => `${name} is registered and has no manifest`),
      ...[...units].flatMap(([name, manifest]) => manifestFaults(name, manifest, registry[name]).map((fault) => `${name}: ${fault}`)),
    ].map((found) => ({ check: 'manifests-valid', found })),
    old: missing.filter((name) => before.has(name)),
  };
}

/** @param {State} state @param {Map<string, any>} units @returns {Fault[]} */
function decisionsCarried(state, units) {
  const decided = new Set(state.ledger.filter(({ event }) => event === 'decided').map(({ unit, topic }) => `${unit}/${topic}`));
  return [...units].flatMap(([name, manifest]) => Object.entries(manifest?.phases?.discussion?.items ?? {})
    .filter(([topic, item]) => item.status === 'completed' && !decided.has(`${name}/${topic}`))
    .map(([topic]) => ({ check: 'decisions-carried', found: `${name}/${topic} is decided and the ledger holds no decision of it` })));
}

/** @param {Map<string, any>} units @returns {Fault[]} */
function noCutWaiting(units) {
  return [...units].filter(([, manifest]) => manifest?.status === 'in-progress' && manifest.spec?.joined !== undefined && manifest.cut === undefined)
    .map(([name]) => ({ check: 'no-cut-waiting', found: `${name} has its specs joined and no cut` }));
}

/** The tracker parents of each old plan's phases a unit kept, from its old manifest. @param {Listing} old @param {string} unit @returns {string[]} */
function oldPlanPhases(old, unit) {
  const manifest = JSON.parse(old.files[`${unit}/manifest.json`]?.text ?? '{}');
  return Object.entries(manifest.phases?.planning?.items ?? {}).flatMap(([topic, item]) => Object.entries(item?.task_map ?? {})
    .filter(([id]) => new RegExp(`^${topic}-\\d+$`).test(id)).map(([, parent]) => /** @type {string} */ (parent)));
}

/** @param {State} state @param {Map<string, any>} units @param {Listing} old @returns {Fault[]} */
function cutsHoldTracker(state, units, old) {
  const built = [...units].filter(([, manifest]) => Array.isArray(manifest?.cut?.phases));
  if (built.length === 0) return [];
  const { driver } = chosenDriver(path.dirname(state.root), 'task');
  return built.flatMap(([name, manifest]) => {
    /** @type {{tracker?: string}[]} */
    const phases = manifest.cut.phases;
    const adopted = phases.flatMap(({ tracker }, at) => (tracker === undefined ? [] : [{ phase: at + 1, parent: tracker }]));
    const held = driver.adoption(state.root, name, adopted);
    const lost = held.flatMap(({ phase, tasks }) => {
      const cut = new Set((driver.tasks(state.root, name, phase) ?? []).map(({ ref }) => `${ref.phase}.${ref.n}`));
      return tasks.filter(({ ref }) => !cut.has(`${ref.phase}.${ref.n}`)).map(({ title, status }) => `${name}'s phase ${phase} lacks "${title}", ${status} in the tracker`);
    });
    const trackers = new Set(adopted.map(({ parent }) => parent));
    const uncut = oldPlanPhases(old, name).filter((parent) => !trackers.has(parent)).map((parent) => `${name}'s cut lacks the old plan's phase ${parent}`);
    return [...lost, ...uncut].map((found) => ({ check: 'cut-holds-tracker', found }));
  });
}

/** A line as placement compares it: its heading marks, link targets, numbering and case aside. @param {string} line */
const comparable = (line) => line.trim().replace(/^#+\s*/, '').replace(/\]\([^)]*\)/g, ']').replace(/^\d+\.\s+/, '').replace(/^(?:specification|discussion|research|investigation|plan):\s*/i, '').toLowerCase();

/** The lines of a document placement asks to be kept: none blank, no fence, no sender's line. @param {string} text */
const keptLines = (text) => text.split('\n').map(comparable).filter((line) => line !== '' && !/^(?:`{3,}|~{3,})/.test(line) && !/^\*from: /.test(line));

/** @param {State} state @param {Map<string, any>} units @param {Listing} old */
function filesPlaced(state, units, old) {
  const shas = new Set(state.files.map((rel) => sha(fs.readFileSync(path.join(state.root, rel)))));
  const lines = new Set(state.files.filter((rel) => TEXT.test(rel)).flatMap((rel) => keptLines(fs.readFileSync(path.join(state.root, rel), 'utf8'))));
  const retired = (/** @type {string} */ unit) => state.files.includes(`.product/assets/${unit}/manifest.json`);
  /** @param {string} rel @param {OldFile} file */
  const placed = (rel, file) => {
    if (shas.has(file.sha)) return true;
    if (rel === 'manifest.json') return state.files.includes('manifest.json');
    const unit = /^([^/]+)\/manifest\.json$/.exec(rel)?.[1];
    if (unit !== undefined) return units.has(unit.toLowerCase()) || retired(unit);
    return file.text !== undefined && keptLines(file.text).every((line) => lines.has(line));
  };
  const rebuilt = (/** @type {string} */ rel) => REBUILT.some((rule) => rule.test(rel)) || SIDECAR_NAME.test(path.basename(rel));
  return Object.entries(old.files).filter(([rel, file]) => !rebuilt(rel) && !placed(rel, file))
    .map(([rel]) => ({ check: 'files-placed', found: `${OLD}/${rel} is neither placed nor kept as legacy` }));
}

/** Each relative link and embed of a document, `[words](target)` as written, with its target. @param {string} text */
function linksIn(text) {
  return [...text.matchAll(LINK)].map(([written, , , target]) => ({ written, target }))
    .filter(({ target }) => !SCHEME.test(target) && !target.startsWith('#') && !target.startsWith('/'));
}

/** @param {string} target */
const fileOf = (target) => decodeURIComponent(target.replace(/[#?].*$/, ''));

/** The links already dead in the old state, as written. @param {string} project @param {Listing} old @returns {Set<string>} */
function deadBefore(project, old) {
  return new Set(Object.entries(old.files).filter(([rel, { text }]) => text !== undefined && rel.endsWith('.md')).flatMap(([rel, { text }]) => linksIn(/** @type {string} */ (text))
    .filter(({ target }) => {
      const at = path.posix.normalize(path.posix.join(OLD, path.posix.dirname(rel), fileOf(target)));
      return at.startsWith(`${OLD}/`) ? !(at.slice(OLD.length + 1) in old.files) : !fs.existsSync(path.join(project, at));
    })
    .map(({ written }) => written)));
}

/** @param {State} state @param {Set<string>} before */
function namesResolve(state, before) {
  const exists = (/** @type {string} */ rel) => fs.existsSync(path.join(state.root, rel));
  const documents = state.files.filter((rel) => rel.endsWith('.md') && !LEGACY.test(rel));
  const dead = documents.flatMap((rel) => linksIn(fs.readFileSync(path.join(state.root, rel), 'utf8'))
    .filter(({ target }) => !fs.existsSync(path.resolve(state.root, path.dirname(rel), fileOf(target))))
    .map(({ written }) => ({ rel, written })));
  const old = dead.filter(({ written }) => before.has(written));
  /** @type {Fault[]} */
  const faults = [
    ...dead.filter(({ written }) => !before.has(written)).map(({ rel, written }) => ({ check: 'names-resolve', found: `${rel} links ${written}, which names nothing` })),
    ...state.ledger.flatMap((line) => [...(line.cites ?? []).map(({ path: cited }) => cited), ...(line.event === 'asset' ? [line.path] : [])]
      .filter((cited) => !exists(cited)).map((cited) => ({ check: 'names-resolve', found: `ledger line ${line.id} names ${cited}, which is not there` }))),
    ...Object.entries(state.project.roadmap?.items ?? {}).flatMap(([item, { sources = [] }]) => sources
      .filter((/** @type {string} */ source) => !exists(source)).map((/** @type {string} */ source) => ({ check: 'names-resolve', found: `roadmap item ${item} names ${source}, which is not there` }))),
  ];
  return { faults, dead: dead.length, old: old.map(({ rel, written }) => `${rel}: ${written}`) };
}

/** Units by type and by status. @param {Map<string, any>} units */
function unitCounts(units) {
  /** @type {Record<string, Record<string, number>>} */
  const counts = {};
  for (const manifest of units.values()) {
    const byType = (counts[manifest?.work_type] ??= {});
    byType[manifest?.status] = (byType[manifest?.status] ?? 0) + 1;
  }
  return counts;
}

/**
 * The audit of the project at `project`, against the listing `old` taken
 * before its migration (the header's).
 * @param {string} project @param {Listing} old
 */
function audit(project, old) {
  const state = readState(project);
  const units = unitsOf(state);
  const before = deadBefore(project, old);
  const names = namesResolve(state, before);
  const manifests = manifestsValid(state, units, unregisteredBefore(old));
  const faults = [
    ...oldStateGone(project),
    ...migrationsRecorded(state),
    ...bootReady(project, state),
    ...manifests.faults,
    ...decisionsCarried(state, units),
    ...noCutWaiting(units),
    ...cutsHoldTracker(state, units, old),
    ...filesPlaced(state, units, old),
    ...names.faults,
  ];
  return {
    ok: faults.length === 0,
    faults,
    counts: {
      units: unitCounts(units),
      decisions: state.ledger.filter(({ event }) => event === 'decided').length,
      legacy_files: state.files.filter((rel) => LEGACY.test(rel)).length,
      dead_links: { before: before.size, after: names.dead, after_already_dead: names.old.length },
    },
    already_dead: names.old,
    already_unregistered: manifests.old,
  };
}

module.exports = { listOld, audit };

if (require.main === module) {
  const [verb, project, listing] = process.argv.slice(2);
  if (verb === 'list' && project !== undefined) {
    process.stdout.write(`${JSON.stringify(listOld(path.resolve(project)))}\n`);
  } else if (verb === 'audit' && project !== undefined && listing !== undefined) {
    const report = audit(path.resolve(project), JSON.parse(fs.readFileSync(listing, 'utf8')));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.ok ? 0 : 1;
  } else {
    process.stderr.write('Usage: node migration-audit.cjs list <project> | audit <project> <listing.json>\n');
    process.exitCode = 2;
  }
}
