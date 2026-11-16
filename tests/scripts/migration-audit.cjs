'use strict';

// ---------------------------------------------------------------------------
// The migration audit (21.1.1; 2.8.1): whether a project the migration took
// into Leeway migrated cleanly, read and never written — it calls one engine
// verb, boot, which must find nothing left to do, run in no conversation,
// so it marks none in the system config, and its separate Claude call
// pinned to the suite's stub with no login, so the late one-decision check
// boot launches makes no call and writes nothing; and it writes nothing to
// git or the state itself. The old state's files are read from a listing
// taken before the migration (`listOld`): each file under `.workflows/`, by
// its path there, its content's hash, and the text of each document and
// manifest outside the old cache, the old engine's record and the knowledge
// store.
//
// A project migrated cleanly where:
//   - no `.workflows/` is left in its folder;
//   - its migrations record holds every migration installed;
//   - `engine boot` answers `ready`, moving neither branch;
//   - every unit the registry names has a manifest of today's shape: its
//     name its folder's, its type and status today's, its type the
//     registry's, its phases today's, an item's status its phase's, and
//     items in the topics' phases alone;
//   - every topic decided in its discussion has a decision in the ledger,
//     read where every carry took it;
//   - no unit waits on a cut: none in progress has its specs joined and no
//     cut;
//   - each phase of a cut adopted from the tracker holds every task the
//     tracker holds under its parent, open or done, and each phase of the
//     old plan in the tracker is one of the cut's; a tracker that cannot be
//     read for a cut, its parent or its store gone, is a fault of its own;
//   - every file the old state held is placed — a document of the old
//     cache byte for byte in the state's ignored cache, at its path below
//     its unit's folder there under the unit's `earlier/`, or at its path
//     below the old cache under the cache's own, its case aside, unless its
//     unit was retired, its cache purged, or it is a build's fix-tracking
//     report, which 051 moved into the unit's implementation folder, byte
//     for byte anywhere in the state; any other byte for byte anywhere
//     in the state, a manifest where its unit or the project is, or a
//     document one file of the state holds every line of, its headings,
//     link targets, numbering and case aside, and the runs of `../` before
//     an import or an asset, which the move rewrites wherever they stand —
//     or is one the migration rebuilds, never kept: the old cache's other
//     files, the old engine's record, the knowledge store but its config, a
//     unit's `.state/`, the old state's own ignore file, and the tools'
//     sidecars;
//   - every link or embed in a document the migration wrote — no legacy
//     file, kept as it was — and every citation and asset a ledger line
//     names, where its carries moved it, and every roadmap source names a
//     file; a link that names nothing is old only as often as the old
//     documents the file holds held it dead, by its words and target, each
//     occurrence excusing one, and is listed apart, never a fault.
//
// The report, as JSON: `ok`, the `faults`, each its check and what it
// found, and the counts a rehearsal reports — units by type and status,
// decisions, legacy files, the old cache's documents in the cache's
// `earlier/` folders, and the dead links: those of the documents
// outside legacy before the migration and after, those after that are old,
// and those of the legacy files as they stand — with the dead links found
// old listed, each once.
//
// As a command: `node migration-audit.cjs list <project>` prints the
// listing; `node migration-audit.cjs audit <project> <listing.json>`
// prints the report and exits 1 on any fault. It runs only with both
// user-level folders, LEEWAY_CONFIG_DIR and WORKFLOWS_CONFIG_DIR, pinned to
// folders outside `~/.config`, so boot never meets the person's own.
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
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
// The old cache's documents, which the move copies into the state's cache.
const CACHE_REPORT = /^\.cache\/(.+\.md)$/;
// Where the state's cache holds them: a unit's `earlier/`, or the cache's own.
const EARLIER = /^\.cache\/(?:[^/]+\/)?earlier\//;
// A build's fix-tracking report, which 051 moved out of the old cache into
// the unit's committed implementation folder, a project behind it among the
// chain the migration runs.
const FIX_TRACKING = /^[^/]+\/implementation\/[^/]+\/fix-tracking-[^/]*\.md$/;
const TEXT = /\.(?:md|json)$/;
const UNREAD = /^(?:\.cache|\.state|\.knowledge)\//;
const LINK = /(!?)\[([^\]]*)\]\(([^)\s]+)\)/g;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
// The runs of `../` before an import or an asset, which the move rewrites wherever they stand.
const IMPORT_PATH = /(?:\.\.\/)+(?:imports|assets)\//g;
// The separate call's binary boot runs: the suite's stub, which, unarmed, has no login.
const CLAUDE_STUB = path.join(__dirname, 'claude-stub.sh');
const STUB_ARMS = ['CLAUDE_STUB_ANSWERS', 'CLAUDE_STUB_LOG', 'CLAUDE_STUB_MEET'];
// The user-level folders the command runs only with pinned.
const CONFIG_DIRS = ['LEEWAY_CONFIG_DIR', 'WORKFLOWS_CONFIG_DIR'];

/** @typedef {{sha: string, text?: string}} OldFile */
/** @typedef {{files: Record<string, OldFile>}} Listing */
/** @typedef {{check: string, found: string}} Fault */
/** A text file, of the old state or the state: its path, its hash, its text and the lines placement compares. @typedef {{rel: string, sha: string, text: string, lines: string[]}} Doc */

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

/** A line as placement compares it: its heading marks, link targets, import paths, numbering and case aside. @param {string} line */
const comparable = (line) => line.trim().replace(/^#+\s*/, '').replace(/\]\([^)]*\)/g, ']').replace(IMPORT_PATH, 'assets/').replace(/^\d+\.\s+/, '')
  .replace(/^(?:specification|discussion|research|investigation|plan):\s*/i, '').toLowerCase();

/** The lines of a document placement asks to be kept: none blank, no fence, no sender's line. @param {string} text */
const keptLines = (text) => text.split('\n').map(comparable).filter((line) => line !== '' && !/^(?:`{3,}|~{3,})/.test(line) && !/^\*from: /.test(line));

/** @param {string} rel @param {Buffer} bytes @returns {Doc} */
const docOf = (rel, bytes) => ({ rel, sha: sha(bytes), text: bytes.toString('utf8'), lines: keptLines(bytes.toString('utf8')) });

/** The state as the audit reads it: its files, its documents, its manifests and its ledger. @param {string} project */
function readState(project) {
  const root = path.join(project, STATE);
  const files = filesBelow(root).filter((rel) => !rel.startsWith('.cache/') && !/^\.knowledge\/(?!config\.json$)/.test(rel));
  const ledgerFile = path.join(root, '.ledger.jsonl');
  const lines = fs.existsSync(ledgerFile) ? fs.readFileSync(ledgerFile, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
  const places = rehomedPlaces(lines.filter(({ event }) => event === 'rehomed'));
  const bytes = new Map(files.map((rel) => [rel, fs.readFileSync(path.join(root, rel))]));
  const earlier = filesBelow(path.join(root, '.cache')).map((rel) => `.cache/${rel}`).filter((rel) => EARLIER.test(rel));
  return {
    root,
    files,
    earlier: new Map(earlier.map((rel) => [rel.toLowerCase(), sha(fs.readFileSync(path.join(root, rel)))])),
    shas: new Set([...bytes.values()].map(sha)),
    docs: files.filter((rel) => TEXT.test(rel)).map((rel) => docOf(rel, /** @type {Buffer} */ (bytes.get(rel)))),
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

/** The environment boot runs in: no conversation's, and the separate call's binary the suite's stub, unarmed. */
function bootEnv() {
  /** @type {Record<string, string|undefined>} */
  const env = { ...process.env, LEEWAY_CLAUDE: CLAUDE_STUB };
  for (const name of ['CLAUDE_CODE_SESSION_ID', ...STUB_ARMS]) delete env[name];
  return env;
}

/** @param {string} project @param {State} state @returns {Fault[]} */
function bootReady(project, state) {
  const heads = () => [gitRead(project, ['rev-parse', 'HEAD']), gitRead(state.root, ['rev-parse', 'HEAD'])];
  const before = heads();
  const run = spawnSync(process.execPath, [ENGINE, 'boot'], { cwd: project, encoding: 'utf8', input: '\n', env: bootEnv() });
  const answer = parsed(run.stdout);
  /** @type {Fault[]} */
  const faults = [];
  if (answer?.state !== 'ready') faults.push({ check: 'boot-ready', found: `boot answered ${answer?.state ?? `nothing: ${run.stderr.trim()}`}` });
  if (heads().join() !== before.join()) faults.push({ check: 'boot-ready', found: 'boot committed: the migration left work behind it' });
  return faults;
}

/** The phases past the topics' a unit keeps items in. @param {any} manifest @returns {string[]} */
const strayItems = (manifest) => Object.entries(manifest?.phases ?? {})
  .filter(([phase, data]) => !schema.isTopicPhase(phase) && Object.keys(data?.items ?? {}).length > 0).map(([phase]) => phase);

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

/** @param {State} state @param {Map<string, any>} units @returns {Fault[]} */
function manifestsValid(state, units) {
  const registry = state.project.work_units ?? {};
  return [
    ...Object.keys(registry).filter((name) => !units.has(name)).map((name) => `${name} is registered and has no manifest`),
    ...[...units].flatMap(([name, manifest]) => manifestFaults(name, manifest, registry[name]).map((fault) => `${name}: ${fault}`)),
  ].map((found) => ({ check: 'manifests-valid', found }));
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

/**
 * What a cut lacks of the tracker: each task the tracker holds under an
 * adopted phase's parent, and each old plan's phase the cut adopted none
 * of; or why the tracker could not be read for it.
 * @param {State} state @param {string} name @param {any} manifest @param {Listing} old @returns {string[]}
 */
function cutShortOf(state, name, manifest, old) {
  /** @type {{tracker?: string}[]} */
  const phases = manifest.cut.phases;
  const adopted = phases.flatMap(({ tracker }, at) => (tracker === undefined ? [] : [{ phase: at + 1, parent: tracker }]));
  try {
    const { driver } = chosenDriver(path.dirname(state.root), 'task');
    const lost = driver.adoption(state.root, name, adopted).flatMap(({ phase, tasks }) => {
      const cut = new Set((driver.tasks(state.root, name, phase) ?? []).map(({ ref }) => `${ref.phase}.${ref.n}`));
      return tasks.filter(({ ref }) => !cut.has(`${ref.phase}.${ref.n}`)).map(({ title, status }) => `${name}'s phase ${phase} lacks "${title}", ${status} in the tracker`);
    });
    const trackers = new Set(adopted.map(({ parent }) => parent));
    return [...lost, ...oldPlanPhases(old, name).filter((parent) => !trackers.has(parent)).map((parent) => `${name}'s cut lacks the old plan's phase ${parent}`)];
  } catch (err) {
    return [`${name}'s cut cannot be read against the tracker: ${err instanceof Error ? err.message : String(err)}`];
  }
}

/** @param {State} state @param {Map<string, any>} units @param {Listing} old @returns {Fault[]} */
function cutsHoldTracker(state, units, old) {
  return [...units].filter(([, manifest]) => Array.isArray(manifest?.cut?.phases))
    .flatMap(([name, manifest]) => cutShortOf(state, name, manifest, old).map((found) => ({ check: 'cut-holds-tracker', found })));
}

/** The old state's text files as documents, by their paths in `.workflows/`. @param {Listing} old @returns {Doc[]} */
const oldDocs = (old) => Object.entries(old.files).flatMap(([rel, { sha: hash, text }]) => (text === undefined ? [] : [{ rel, sha: hash, text, lines: keptLines(text) }]));

/**
 * Where each old document is held in the state: each document holding
 * every one of its lines, read through its rarest line — a copy byte for
 * byte among them — or, for one with no line to keep, each copy.
 * @param {State} state @returns {(doc: Doc) => Doc[]}
 */
function holdersIn(state) {
  /** @type {Map<string, Doc[]>} */
  const bySha = new Map();
  /** @type {Map<string, Set<Doc>>} */
  const byLine = new Map();
  const linesOf = new Map(state.docs.map((doc) => [doc, new Set(doc.lines)]));
  for (const doc of state.docs) {
    bySha.set(doc.sha, [...(bySha.get(doc.sha) ?? []), doc]);
    for (const line of doc.lines) byLine.set(line, (byLine.get(line) ?? new Set()).add(doc));
  }
  return (doc) => {
    if (doc.lines.length === 0) return bySha.get(doc.sha) ?? [];
    const seeds = doc.lines.map((line) => byLine.get(line) ?? new Set()).reduce((rarest, held) => (held.size < rarest.size ? held : rarest));
    return [...seeds].filter((held) => doc.lines.every((line) => /** @type {Set<string>} */ (linesOf.get(held)).has(line)));
  };
}

/**
 * Whether the state's cache holds a document of the old cache byte for
 * byte where the move copies it, its case aside: a unit's in the unit's
 * `earlier/`, any other in the cache's own.
 * @param {State} state @param {Listing} old @param {string} report its path below the old cache @param {OldFile} file
 */
function earlierHeld(state, old, report, file) {
  const [unit, ...below] = report.split('/');
  const at = `${unit}/manifest.json` in old.files ? `.cache/${unit}/earlier/${below.join('/')}` : `.cache/earlier/${report}`;
  return state.earlier.get(at.toLowerCase()) === file.sha;
}

/** @param {State} state @param {Map<string, any>} units @param {Listing} old @param {Doc[]} olds @param {(doc: Doc) => Doc[]} holders */
function filesPlaced(state, units, old, olds, holders) {
  const docs = new Map(olds.map((doc) => [doc.rel, doc]));
  const retired = (/** @type {string} */ unit) => state.files.includes(`.product/assets/${unit.toLowerCase()}/manifest.json`);
  /** @param {string} rel @param {OldFile} file */
  const placed = (rel, file) => {
    const report = CACHE_REPORT.exec(rel)?.[1];
    if (report !== undefined) return earlierHeld(state, old, report, file) || retired(report.split('/')[0]) || (FIX_TRACKING.test(report) && state.shas.has(file.sha));
    if (state.shas.has(file.sha)) return true;
    if (rel === 'manifest.json') return state.files.includes('manifest.json');
    const unit = /^([^/]+)\/manifest\.json$/.exec(rel)?.[1];
    if (unit !== undefined) return units.has(unit.toLowerCase()) || retired(unit);
    const doc = docs.get(rel);
    return doc !== undefined && (doc.lines.length === 0 || holders(doc).length > 0);
  };
  const rebuilt = (/** @type {string} */ rel) => REBUILT.some((rule) => rule.test(rel)) || SIDECAR_NAME.test(path.basename(rel));
  return Object.entries(old.files).sort(([a], [b]) => a.localeCompare(b)).filter(([rel, file]) => !rebuilt(rel) && !placed(rel, file))
    .map(([rel]) => ({ check: 'files-placed', found: `${OLD}/${rel} is ${CACHE_REPORT.test(rel) ? 'not in the cache\'s earlier/ as it was' : 'neither placed nor kept as legacy'}` }));
}

/** Each relative link and embed of a document, `[words](target)` as written, with its target. @param {string} text */
function linksIn(text) {
  return [...text.matchAll(LINK)].map(([written, , , target]) => ({ written, target }))
    .filter(({ target }) => !SCHEME.test(target) && !target.startsWith('#') && !target.startsWith('/'));
}

/** @param {string} target */
const fileOf = (target) => decodeURIComponent(target.replace(/[#?].*$/, ''));

/** Each link of the old document at `rel` naming nothing there, as written, once for each time it is. @param {string} project @param {Listing} old @param {Doc} doc */
function deadInOld(project, old, doc) {
  return linksIn(doc.text).filter(({ target }) => {
    const at = path.posix.normalize(path.posix.join(OLD, path.posix.dirname(doc.rel), fileOf(target)));
    return at.startsWith(`${OLD}/`) ? !(at.slice(OLD.length + 1) in old.files) : !fs.existsSync(path.join(project, at));
  }).map(({ written }) => written);
}

/** Each link of the state's document naming nothing, as written, once for each time it is. @param {State} state @param {Doc} doc */
const deadInState = (state, doc) => linksIn(doc.text).filter(({ target }) => !fs.existsSync(path.resolve(state.root, path.dirname(doc.rel), fileOf(target)))).map(({ written }) => written);

/** @param {string[]} words */
function tally(words) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return counts;
}

/**
 * The links of the state's documents that name nothing, each old as often
 * as the old documents its file holds held it dead: the new ones faults,
 * the old ones listed, each once; and the counts, the documents outside
 * legacy before and after, and the legacy files as they stand.
 * @param {string} project @param {State} state @param {Listing} old @param {Doc[]} olds @param {(doc: Doc) => Doc[]} holders
 */
function deadLinks(project, state, old, olds, holders) {
  const isDocument = (/** @type {Doc} */ doc) => doc.rel.endsWith('.md');
  /** The links each of the state's documents' old documents held dead. @type {Map<Doc, string[]>} */
  const deadBefore = new Map();
  let before = 0;
  for (const doc of olds.filter(isDocument)) {
    const dead = deadInOld(project, old, doc);
    const held = holders(doc).filter(isDocument);
    for (const holder of held) deadBefore.set(holder, [...(deadBefore.get(holder) ?? []), ...dead]);
    if (held.some(({ rel }) => !LEGACY.test(rel))) before += dead.length;
  }
  /** @type {Set<string>} */
  const found = new Set();
  /** @type {Set<string>} */
  const already = new Set();
  let after = 0;
  let oldAfter = 0;
  let legacy = 0;
  for (const doc of state.docs.filter(isDocument)) {
    const dead = deadInState(state, doc);
    if (LEGACY.test(doc.rel)) {
      legacy += dead.length;
      continue;
    }
    after += dead.length;
    const excused = tally(deadBefore.get(doc) ?? []);
    for (const written of dead) {
      const left = excused.get(written) ?? 0;
      if (left === 0) {
        found.add(`${doc.rel} links ${written}, which names nothing`);
        continue;
      }
      excused.set(written, left - 1);
      oldAfter += 1;
      already.add(`${doc.rel}: ${written}`);
    }
  }
  return { faults: [...found].sort(), counts: { before, after, after_already_dead: oldAfter, legacy }, already: [...already].sort() };
}

/** @param {string} project @param {State} state @param {Listing} old @param {Doc[]} olds @param {(doc: Doc) => Doc[]} holders */
function namesResolve(project, state, old, olds, holders) {
  const exists = (/** @type {string} */ rel) => fs.existsSync(path.join(state.root, rel));
  const dead = deadLinks(project, state, old, olds, holders);
  /** @type {Fault[]} */
  const faults = [
    ...dead.faults.map((found) => ({ check: 'names-resolve', found })),
    ...state.ledger.flatMap((line) => [...(line.cites ?? []).map(({ path: cited }) => cited), ...(line.event === 'asset' ? [line.path] : [])]
      .filter((cited) => !exists(cited)).map((cited) => ({ check: 'names-resolve', found: `ledger line ${line.id} names ${cited}, which is not there` }))),
    ...Object.entries(state.project.roadmap?.items ?? {}).flatMap(([item, { sources = [] }]) => sources
      .filter((/** @type {string} */ source) => !exists(source)).map((/** @type {string} */ source) => ({ check: 'names-resolve', found: `roadmap item ${item} names ${source}, which is not there` }))),
  ];
  return { faults, counts: dead.counts, already: dead.already };
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
  const olds = oldDocs(old);
  const holders = holdersIn(state);
  const names = namesResolve(project, state, old, olds, holders);
  const faults = [
    ...oldStateGone(project),
    ...migrationsRecorded(state),
    ...bootReady(project, state),
    ...manifestsValid(state, units),
    ...decisionsCarried(state, units),
    ...noCutWaiting(units),
    ...cutsHoldTracker(state, units, old),
    ...filesPlaced(state, units, old, olds, holders),
    ...names.faults,
  ];
  return {
    ok: faults.length === 0,
    faults,
    counts: {
      units: unitCounts(units),
      decisions: state.ledger.filter(({ event }) => event === 'decided').length,
      legacy_files: state.files.filter((rel) => LEGACY.test(rel)).length,
      earlier: state.earlier.size,
      dead_links: names.counts,
    },
    already_dead: names.already,
  };
}

/**
 * The user-level folders the command would run with unpinned: unset, or
 * inside `~/.config`, where the person's own live.
 * @param {Record<string, string|undefined>} env @returns {string[]}
 */
function unpinned(env) {
  const config = path.join(os.homedir(), '.config');
  return CONFIG_DIRS.filter((name) => {
    const dir = env[name];
    if (dir === undefined || dir === '') return true;
    const rel = path.relative(config, path.resolve(dir));
    return rel === '' || !(rel.startsWith('..') || path.isAbsolute(rel));
  });
}

module.exports = { listOld, audit };

if (require.main === module) {
  const [verb, project, listing] = process.argv.slice(2);
  const loose = unpinned(process.env);
  if (loose.length > 0) {
    process.stderr.write(`Refused: pin ${loose.join(' and ')} to a folder outside ~/.config, so boot never meets the person's own.\n`);
    process.exitCode = 2;
  } else if (verb === 'list' && project !== undefined) {
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
