'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's oracle (tests/README.md §11): the audit `Sim`
// (pipeline-world.cjs) runs over the whole state after every mutation a
// scenario makes —
//   - every manifest parses and is schema-valid (statuses in vocabulary,
//     discovery items status-less, no phase-named shadow roots), the
//     project's keeping the project_id setup gave it,
//   - every derivation (lifecycle, phaseStatus, next-phase) computes without
//     throwing for every item,
//   - every navigation gateway (start, the continue menus, bridge) reads
//     and renders the state without throwing — the epic's specification
//     menu among its views,
//   - every menu a gateway draws, and every menu a render draws, states
//     itself whole in its gate payload once the gate surface is announced,
//     and the gate a render's menu states is the one its conversation was
//     shown, which an answer through `gate` adds one line to the trust log
//     for,
//   - the ledger's projections and its copies hold to the events,
//   - the trust log holds a line for each call, raise, reversal and verdict
//     the ledger and the verdicts given call for, every verdict on a
//     departure it holds, and nothing waits in a conversation, after a
//     refusal too (auditTrust).
// This is the detector for the silent class of bug: state that writes fine,
// raises nothing, and only breaks a menu three phases later.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const engine = require(path.join(ROOT, 'skills/leeway-engine/scripts/engine.cjs'));
const schema = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/manifest-schema.cjs'));
const derivations = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/derivations.cjs'));
const { roadmapState } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/roadmap.cjs'));
const { mapState } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/discussion-map.cjs'));
const { registerState } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/research-threads.cjs'));
const {
  RECORDS_DIR, PRODUCT_FILE, knowledgeFiles,
} = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/knowledge/files.cjs'));
const knowledgeStore = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/knowledge/store.cjs'));
const chunker = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/knowledge/chunker.cjs'));
const RECORD_CHUNKING = JSON.parse(fs.readFileSync(path.join(ROOT, 'skills/leeway-engine/content/knowledge/chunking/record.json'), 'utf8'));
const { LEDGER, ROADMAP } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/ledger-events.cjs'));
const { isId } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/ledger-ids.cjs'));
const START_GATEWAY = require(path.join(ROOT, 'skills/leeway/scripts/gateway.cjs'));
const EPIC_GATEWAY = require(path.join(ROOT, 'skills/leeway-continue-epic/scripts/gateway.cjs'));
const LINEAR_GATEWAY = require(path.join(ROOT, 'skills/leeway-continue-linear/scripts/gateway.cjs'));
const BRIDGE = require(path.join(ROOT, 'skills/leeway-bridge/scripts/gateway.cjs'));
const LIB = require(path.join(ROOT, 'skills/leeway-engine/scripts/lib.cjs'));
const {
  specificationDiscovery, specificationDetail,
} = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/specification.cjs'));
const { openGate } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/surfaces.cjs'));
const {
  resolveHandoff, HANDOFF_TARGETS,
} = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/handoff.cjs'));
const { announced, auditGate } = require('./gate-audit.cjs');
const { ledgerEntries } = require('./engine-harness.cjs');
const { statePath } = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/state-root.cjs'));
const { SHOWN } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/gate.cjs'));
const { TRUST_LOG, PENDING } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/trust-log.cjs'));

// The same per-type pipeline the start dashboard derives from (start.cjs
// pipelineOf): the schema's one home for pipeline order.
function pipelineOf(workType) {
  return schema.WORK_TYPE_PIPELINES[workType] || schema.VALID_PHASES.filter((p) => p !== 'discovery');
}

// The epic specification menu's detail — the spec boundary's derived view.
function specDetail(dir, workUnit) {
  return specificationDetail(workUnit, specificationDiscovery(dir, workUnit));
}

// The words a shell makes of a route written into a command: split at spaces,
// a double-quoted span one word without its quotes.
/** @param {string} route @returns {string[]} */
function shellWords(route) {
  return [...route.matchAll(/"([^"]*)"|\S+/g)].map((m) => m[1] ?? m[0]);
}

// ---------------------------------------------------------------------------
// State audit — the invariants run after every mutation
// ---------------------------------------------------------------------------

function listWorkUnits(dir) {
  const wf = path.join(dir, '.leeway');
  if (!fs.existsSync(wf)) return [];
  return fs.readdirSync(wf, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .filter((e) => fs.existsSync(path.join(wf, e.name, 'manifest.json')))
    .map((e) => e.name);
}

// The project_id each project's state was minted with, by its folder, while
// the state lasts.
/** @type {Map<string, string>} */
const mintedIds = new Map();

function auditState(dir, label) {
  const ctx = (msg) => `[${label}] ${msg}`;

  // Project manifest parses, and wherever the state is keeps the id the
  // trust log knows the project by (16.13.5), the one it was minted with: a
  // writer that rewrote it whole would drop it, and one that set it would
  // change it. A state started again mints its own.
  const projPath = path.join(dir, '.leeway', 'manifest.json');
  const project = fs.existsSync(projPath) ? JSON.parse(fs.readFileSync(projPath, 'utf8')) : null;
  if (fs.existsSync(path.join(dir, '.leeway'))) {
    assert.ok(isId(project?.project_id), ctx(`the project manifest's project_id is ${JSON.stringify(project?.project_id)}`));
    if (!mintedIds.has(dir)) mintedIds.set(dir, project.project_id);
    assert.strictEqual(project.project_id, mintedIds.get(dir), ctx('the project manifest\'s project_id is not the one it was minted with'));
  } else {
    mintedIds.delete(dir);
  }

  // The roadmap always derives — every item's state lands in vocabulary
  // (lifecycle by join: never stored, so it must always be computable).
  const rm = roadmapState(dir);
  for (const row of rm.items) {
    assert.ok(['waiting', 'in-flight', 'shipped', 'orphaned'].includes(row.state),
      ctx(`roadmap item ${row.name}: state "${row.state}" not in vocabulary`));
    assert.ok(['idea', 'bug', 'quick-fix'].includes(row.kind),
      ctx(`roadmap item ${row.name}: kind ${JSON.stringify(row.kind)} not in vocabulary`));
    // A source is recorded only once it is on disk, and whatever moves the
    // file carries the pointer with it.
    for (const source of row.sources) {
      assert.ok(fs.existsSync(path.join(dir, '.leeway', source)),
        ctx(`roadmap item ${row.name}: source ${source} is not on disk`));
    }
  }

  // Every import entry, wherever it lives, keeps the one shape the schema
  // requires: a flat landing under the owner's `imports/`, and an origin that
  // names a real door.
  /** @param {unknown[]|undefined} entries @param {string} owner */
  const auditImports = (entries, owner) => {
    for (const entry of entries || []) {
      assert.ok(entry && typeof entry === 'object', ctx(`${owner}: an imports[] entry is not an object`));
      const e = /** @type {Record<string, unknown>} */ (entry);
      assert.ok(typeof e.path === 'string' && /^imports\/[^/]+$/.test(e.path),
        ctx(`${owner}: import path ${JSON.stringify(e.path)} is not imports/{name}`));
      assert.ok(typeof e.origin === 'string' && schema.isImportOrigin(e.origin),
        ctx(`${owner}: import ${e.path} carries origin ${JSON.stringify(e.origin)}, outside the vocabulary`));
    }
  };
  if (project) auditImports(project.roadmap && project.roadmap.imports, 'roadmap');

  // The ledger reads whole: it starts byte for byte with the one the state
  // branch last committed, and every line is an event of its version's shape.
  // Its projections show what is current in it.
  if (fs.existsSync(statePath(dir, LEDGER))) {
    assert.doesNotThrow(() => ledgerEntries(statePath(dir)), ctx('the ledger does not read'));
    auditLedger(dir, ctx);
  }

  for (const wu of listWorkUnits(dir)) {
    const raw = fs.readFileSync(path.join(dir, '.leeway', wu, 'manifest.json'), 'utf8');
    let manifest;
    try {
      manifest = JSON.parse(raw);
    } catch (e) {
      assert.fail(ctx(`${wu}/manifest.json does not parse: ${e.message}`));
    }

    // Root schema.
    assert.ok(schema.VALID_WORK_TYPES.includes(manifest.work_type),
      ctx(`${wu}: work_type "${manifest.work_type}" not in schema`));
    assert.ok(schema.VALID_WORK_UNIT_STATUSES.includes(manifest.status),
      ctx(`${wu}: status "${manifest.status}" not in schema`));

    auditImports(manifest.imports, wu);

    // No phase-named shadow roots beside `phases`.
    for (const key of Object.keys(manifest)) {
      assert.ok(!schema.VALID_PHASES.includes(key),
        ctx(`${wu}: root key "${key}" shadows a phase — writes are landing outside phases.*`));
    }

    // Phase tree schema.
    const phases = manifest.phases || {};
    for (const [phase, data] of Object.entries(phases)) {
      assert.ok(schema.VALID_PHASES.includes(phase), ctx(`${wu}: unknown phase "${phase}"`));
      const items = (data && data.items) || {};
      for (const [topic, item] of Object.entries(items)) {
        assert.ok(item && typeof item === 'object' && !Array.isArray(item),
          ctx(`${wu}.${phase}.${topic}: item is not an object`));
        const vocab = schema.VALID_PHASE_STATUSES[phase];
        if (phase === 'discovery') {
          assert.ok(!('status' in item),
            ctx(`${wu}.discovery.${topic}: map items carry no status field`));
        } else if ('status' in item) {
          assert.ok(vocab.includes(item.status),
            ctx(`${wu}.${phase}.${topic}: status "${item.status}" not in ${phase} vocabulary`));
        }
        // A research item's thread register derives: every row in
        // vocabulary, every parent top-level, a note on a parked row alone.
        if (phase === 'research') {
          assert.doesNotThrow(() => registerState(manifest, topic), ctx(`${wu}.research.${topic}: thread register`));
        }
        // A discussion item's map derives the same way: every subtopic in vocabulary.
        if (phase === 'discussion') {
          assert.doesNotThrow(() => mapState(manifest, topic), ctx(`${wu}.discussion.${topic}: discussion map`));
        }
      }
      // Derivation must hold for every phase present.
      derivations.phaseStatus(manifest, phase);
    }

    // Every discovery item derives a lifecycle and a next action.
    const mapItems = (phases.discovery && phases.discovery.items) || {};
    for (const topic of Object.keys(mapItems)) {
      const life = derivations.computeTopicLifecycle(manifest, topic);
      assert.ok(life && typeof life.lifecycle === 'string' && life.lifecycle.length > 0,
        ctx(`${wu}.discovery.${topic}: lifecycle did not derive`));
    }

    // Unit-level derivations never throw on legal state.
    derivations.computeNextPhase(manifest);
    derivations.computeUnitPhaseState(manifest, pipelineOf(manifest.work_type));

    // Every agent-state store (one per topic, colocated) is schema-valid.
    const cacheRoot = path.join(dir, '.leeway', '.cache', wu);
    if (fs.existsSync(cacheRoot)) {
      for (const ph of fs.readdirSync(cacheRoot, { withFileTypes: true }).filter((e) => e.isDirectory())) {
        const phDir = path.join(cacheRoot, ph.name);
        for (const tp of fs.readdirSync(phDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
          const storePath = path.join(phDir, tp.name, 'state.json');
          if (!fs.existsSync(storePath)) continue;
          const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
          for (const [key, row] of Object.entries(store.agents || {})) {
            assert.ok(['in-flight', 'pending', 'acknowledged', 'incorporated'].includes(row.status),
              ctx(`agent ${ph.name}/${tp.name}/${key}: status "${row.status}" not in vocabulary`));
            assert.ok(row.surfaced.every((f) => row.findings.includes(f)),
              ctx(`agent ${ph.name}/${tp.name}/${key}: surfaced ids must be recorded findings`));
            if (ph.name === 'research') {
              assert.strictEqual(row.kind, 'deep-dive',
                ctx(`agent ${ph.name}/${tp.name}/${key}: research carries the deep dive alone — a "${row.kind}" row has no reader there`));
            }
            if (ph.name === 'discussion' && row.kind === 'review') {
              assert.ok(row.map_snapshot && typeof row.map_snapshot === 'object',
                ctx(`agent ${ph.name}/${tp.name}/${key}: a discussion review row must carry its dispatch-time map_snapshot — a stampless dispatch degrades to permanent permissive arming`));
            }
          }
        }
      }
    }

    // The bridge can always read the unit, and the linear continue menu
    // renders it — its view, or the not-found display for an epic or a
    // closed unit.
    const bridged = BRIDGE.discover(dir, wu);
    assert.ok(!bridged.error, ctx(`${wu}: bridge gateway errored: ${bridged.error}`));
    BRIDGE.format(bridged);
    LINEAR_GATEWAY.view(dir, wu);
  }

  // Every navigation surface renders without throwing — the menus must
  // render whatever state the pipeline is in — and, announced, states each
  // menu it draws as the gate beside it. The start's head insert is never a
  // gate. Every route a view builds into a skill is one the handoff takes as
  // it stands, or a move between menus.
  assert.doesNotMatch(START_GATEWAY.format(START_GATEWAY.discover(dir)), /^=== MENU/m, ctx('the start head insert carries a gate'));
  for (const [name, views] of Object.entries(VIEW_MENUS)) {
    for (const [gate, view] of views(dir)) {
      auditGate(announcedRender(() => LIB.gateway.menuBlock(gate, view().rendered)), `${label} — ${name} view`);
      auditRoutes(dir, view().keys, `${label} — ${name} view`);
    }
  }
}

// The ledger's projections, held to properties the events and the manifests
// settle whatever the fold does inside, both read here directly: a unit is
// live while its manifest is there and not cancelled, a topic while its map
// row is neither cancelled nor postponed; an event is in a live place while
// the unit and topic it was made on are live — a move while its unit is, a
// question's wording made on the topic the last move its unit made of the
// question to a topic in a live place took it to; a move to the roadmap
// leaves it where it stands. A question's line is the wordings
// of its chain in a live place, in the ledger's order: the last is the
// question's wording, the rest earlier ones, and a wording reads as the
// nearest wording in a live place it grew from, down its chain. An entry
// stands where the earliest entry of its chain in a live place was made —
// a question where the first wording of its line was — or where the first
// was when none is; it is placed where it stands, and where it was made
// where that differs (5.8.19). Current is what the records show. Every
// entry in a live place is shown, or leads to a shown entry down its live
// replacements — a question's wording, to the next on its line — or, with
// none, its live merges; a shown entry is in a live place, no live
// replacement names it, no live merge that would still lead to a shown
// entry took it as a duplicate, a question is the last wording of its
// line, and it shows exactly once in its unit's record and once in its
// topic's. A question answers to every wording of its chain, the first and
// each replacement since, on its line or not: each map shows each question
// on one row, never two wordings of one, and never open while a shown entry
// answers any wording of it; it holds a row for each shown question
// standing on the topic — answered by the shown entries answering any
// wording of it and those the leading merges of any wording lead to, merged
// while one leads, later where the last live move the map's unit made of it
// took it to the roadmap and it is neither, moved in from where the last
// live move to a topic the map's unit made of it was made, while that is
// live, and waiting on the last experiment of the unit not abandoned that
// names any wording of it while it is open; a row for
// each shown question standing on another topic of the map's unit that the
// unit moved away from the topic by a live move, leading to where it stands
// now; and a row for each other shown question placed on the topic or with
// an answer placed there, saying where it stands. A row of a
// question standing off the topic shows its answers placed on the topic
// that no question standing there shows; and a row of its own for each
// shown answer placed on the topic that answers no shown question, saying
// where it stands where that is another place. Each record shows its maps'
// answers, with exactly the entries standing elsewhere that were made
// there, that its entries rely on, its leading merges went into or that
// answer its questions; its live moves and merges, a merge's duplicate
// where it is live and whether the merge leads; each entry's live
// confirmations, for each file linked from it, in the order each was
// first linked, the latest live status and apart from it the latest live
// lift, what the late one-decision check last found of it where it found
// anything, and its chain down to the first entry not in a live place — a
// question's, the earlier wordings of its line. A place that is not live
// shows nothing; the product record holds the shown entries marked
// product-wide.
/** @param {string} dir @param {(msg: string) => string} ctx */
function auditLedger(dir, ctx) {
  const root = statePath(dir);
  /** @type {Record<string, any>[]} */
  const events = fs.readFileSync(path.join(root, LEDGER), 'utf8').split('\n').slice(0, -1).map((line) => JSON.parse(line));
  const byId = new Map(events.map((e) => [e.id, e]));
  /** @param {string} short */
  const full = (short) => /** @type {Record<string, any>} */ (events.find((e) => e.id.startsWith(short))).id;
  /** @type {Map<string, Record<string, any>|null>} */
  const manifests = new Map();
  /** @param {string} unit @param {string|null} topic */
  const placeLive = (unit, topic) => {
    if (!manifests.has(unit)) {
      const file = path.join(root, unit, 'manifest.json');
      manifests.set(unit, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);
    }
    const manifest = manifests.get(unit);
    const row = topic === null ? undefined : manifest?.phases?.discovery?.items?.[topic];
    return manifest != null && manifest.status !== 'cancelled' && row?.cancelled !== true && row?.postponed !== true;
  };
  const ENTRIES = ['asked', 'found', 'decided', 'replaced'];
  /** The entry `id` replaced, or null. @param {string} id @returns {string|null} */
  const replacedBy = (id) => (byId.get(id).event === 'replaced' ? byId.get(id).replaces : null);
  /** @param {string} id @returns {string[]} the entry and every earlier one of its chain */
  const chainOf = (id) => (replacedBy(id) === null ? [id] : [id, ...chainOf(/** @type {string} */ (replacedBy(id)))]);
  /** @param {string} id @returns {Record<string, any>} */
  const firstOf = (id) => byId.get(/** @type {string} */ (chainOf(id).at(-1)));
  /** @param {Record<string, any>} e */
  const isQuestion = (e) => e.event === 'asked' || e.of === 'question';
  const moves = events.filter((e) => e.event === 'moved' && placeLive(e.unit, null));
  /** Whether a move took its question to a topic, not to the roadmap. @param {Record<string, any>} m */
  const toTopic = (m) => !m.to.startsWith(ROADMAP);
  /** The moves in a live place `unit` made of `id`'s question, in the ledger's order. @param {string} id @param {string} unit */
  const movesOf = (id, unit) => moves.filter((m) => m.unit === unit && firstOf(m.question).id === firstOf(id).id);
  /** @type {Map<string, string|null>} */
  const madeOn = new Map();
  /** The topic `id` was made on: a question's, the one the last move its unit made of it in a live place took it to, if any. @param {string} id */
  const topicOf = (id) => {
    if (!madeOn.has(id)) {
      const e = byId.get(id);
      const move = isQuestion(e) ? movesOf(id, e.unit).filter(toTopic).at(-1) : undefined;
      madeOn.set(id, move === undefined ? e.topic : move.to);
    }
    return /** @type {string|null} */ (madeOn.get(id));
  };
  /** @param {string} id */
  const inLivePlace = (id) => placeLive(byId.get(id).unit, topicOf(id));
  /** Each question's line, by its chain's first wording: its wordings in a live place, in the ledger's order. @type {Map<string, string[]>} */
  const lines = new Map();
  for (const e of events.filter((ev) => isQuestion(ev) && inLivePlace(ev.id))) lines.set(firstOf(e.id).id, [...(lines.get(firstOf(e.id).id) ?? []), e.id]);
  /** @param {string} id */
  const lineOf = (id) => lines.get(firstOf(id).id) ?? [];
  const position = new Map(events.map((e, at) => [e.id, at]));
  /** The wordings of `id`'s line after the nearest wording in a live place it grew from; the whole line where none is. @param {string} id */
  const wordingsAfter = (id) => {
    const from = chainOf(id).find(inLivePlace);
    return from === undefined ? lineOf(id) : lineOf(id).filter((wording) => position.get(wording) > position.get(from));
  };
  /** @param {string} id @returns {{unit: string, topic: string|null}} */
  const standing = (id) => {
    const earliest = isQuestion(byId.get(id)) ? lineOf(id)[0] : chainOf(id).filter(inLivePlace).at(-1);
    const at = /** @type {string} */ (earliest ?? chainOf(id).at(-1));
    return { unit: byId.get(at).unit, topic: topicOf(at) };
  };
  /** Where `id` is placed: where it stands, and where it was made where that differs. @param {string} id */
  const placed = (id) => {
    const at = standing(id);
    const made = { unit: byId.get(id).unit, topic: topicOf(id) };
    return at.unit === made.unit && at.topic === made.topic ? [at] : [at, made];
  };
  const liveEvents = (/** @type {string} */ event) => events.filter((e) => e.event === event && inLivePlace(e.id));
  const replacements = liveEvents('replaced');
  const merges = liveEvents('merged');
  const confirmations = liveEvents('still-holds');
  const keeps = liveEvents('kept');
  const links = liveEvents('asset');
  /** The files linked from `id`, in the order each was first linked: for each, the latest live status and, apart from it, the latest live lift. @param {string} id */
  const assetsOf = (id) => {
    /** @type {Map<string, {path: string, status: string|null, into: string|null}>} */
    const files = new Map();
    for (const { path: file, status, into } of links.filter((a) => a.entry === id)) {
      const was = files.get(file) ?? { path: file, status: null, into: null };
      files.set(file, { path: file, status: status ?? was.status, into: into ?? was.into });
    }
    return [...files.values()];
  };
  /** The roadmap `id`'s question went to as later, where the last live move its unit made of it went there: `roadmap:{item}`, or null. @param {string} id */
  const laterOf = (id) => {
    const last = movesOf(id, standing(id).unit).at(-1);
    return last === undefined || toTopic(last) ? null : last.to;
  };
  /** The last experiment of `unit` not abandoned that names any wording of `id`'s question, or null. @param {string} unit @param {string} id */
  const waitingOn = (unit, id) => {
    const items = manifests.get(unit)?.phases?.experiment?.items ?? {};
    const named = Object.values(items).flatMap((item) => Object.entries(item?.experiments ?? {}))
      .filter(([, r]) => byId.has(r.question) && r.status !== 'abandoned' && firstOf(r.question).id === firstOf(id).id);
    return named.at(-1)?.[0] ?? null;
  };
  /** What the late check last found of each entry it judged. @type {Map<string, string>} */
  const lateChecks = new Map(events.filter((e) => e.event === 'checked').map((e) => [e.entry, e.rules]));

  /** @param {string[]} args */
  const ledger = (args) => {
    const res = engine.run(['ledger', ...args], { cwd: dir });
    assert.strictEqual(res.code, 0, ctx(`ledger ${args.join(' ')} does not read: ${res.stderr}`));
    return JSON.parse(res.stdout);
  };
  const units = [...new Set(events.flatMap((e) => [e.unit, standing(e.id).unit]))];
  const topics = [...new Set(events.flatMap((e) => [[e.unit, e.topic], [standing(e.id).unit, standing(e.id).topic], ...(e.event === 'moved' && toTopic(e) ? [[e.unit, e.to]] : [])])
    .filter(([, topic]) => topic !== null).map((pair) => pair.join('\0')))].map((key) => key.split('\0'));
  /** @type {Map<string, Record<string, any>>} */
  const records = new Map([...units.map((unit) => [`${unit}\0`, ledger(['record', unit])]), ...topics.map(([unit, topic]) => [`${unit}\0${topic}`, ledger(['record', unit, topic])])]);
  const maps = new Map(topics.map(([unit, topic]) => [`${unit}\0${topic}`, ledger(['map', unit, topic])]));
  /** @param {Record<string, any>} record @returns {Record<string, any>[]} */
  const main = (record) => [...record.questions, ...record.findings, ...record.decisions];
  /** @type {Map<string, string[]>} */
  const shownAt = new Map();
  for (const [place, record] of records) for (const e of main(record)) shownAt.set(full(e.id), [...(shownAt.get(full(e.id)) ?? []), place]);
  const shown = (/** @type {string} */ id) => shownAt.has(id);

  /** Where `id` leads while not shown: a question's wording, the next on its line; its live replacements, or, with none, the entries its live merges went into. @param {string} id */
  const next = (id) => {
    if (isQuestion(byId.get(id))) return wordingsAfter(id).slice(0, 1);
    const replacers = replacements.filter((r) => r.replaces === id).map((r) => r.id);
    return replacers.length > 0 ? replacers : merges.filter((m) => m.duplicate === id).map((m) => m.into);
  };
  /** The shown entries `id` leads to, never through `avoid`. @param {string} id @param {string|null} [avoid] @returns {string[]} */
  const reach = (id, avoid = null) => {
    const seen = new Set([avoid]);
    /** @type {Set<string>} */
    const found = new Set();
    const walk = (/** @type {string} */ at) => {
      if (seen.has(at)) return;
      seen.add(at);
      if (shown(at)) found.add(at);
      else next(at).forEach(walk);
    };
    walk(id);
    return [...found].sort();
  };
  /** Whether a merge leads somewhere: its duplicate, if any, is not shown, and what it went into leads to a shown entry. @param {Record<string, any>} m */
  const leads = (m) => (m.duplicate === null || !shown(m.duplicate)) && reach(m.into, m.duplicate).length > 0;
  /** The shown entries answering any wording of `question`'s chain. @param {string} question */
  const answering = (question) => events.filter((e) => typeof e.answers === 'string' && firstOf(e.answers).id === firstOf(question).id && shown(e.id)).map((e) => e.id);
  /** @param {string} question */
  const answersOf = (question) => {
    const own = answering(question);
    const leading = merges.filter((m) => firstOf(m.question).id === firstOf(question).id && leads(m));
    return { answers: [...new Set([...own, ...leading.flatMap((m) => reach(m.into, m.duplicate))])].sort(), merged: leading.length > 0 };
  };
  const answeringShown = new Set([...shownAt.keys()].filter((id) => isQuestion(byId.get(id))).flatMap((id) => answersOf(id).answers));
  /** @param {string} id */
  const placesOf = (id) => [`${standing(id).unit}\0`, ...(standing(id).topic === null ? [] : [`${standing(id).unit}\0${standing(id).topic}`])];

  for (const e of events.filter((ev) => ENTRIES.includes(ev.event))) {
    if (shown(e.id)) {
      assert.ok(inLivePlace(e.id), ctx(`${e.id} shows from a place that is not live`));
      assert.deepStrictEqual([...(shownAt.get(e.id) ?? [])].sort(), placesOf(e.id).sort(), ctx(`${e.id} does not show once in its unit's record and once in its topic's`));
      assert.ok(replacements.every((r) => r.replaces !== e.id), ctx(`${e.id} shows though a live replacement names it`));
      assert.ok(!isQuestion(e) || lineOf(e.id).at(-1) === e.id, ctx(`${e.id} shows though it is an earlier wording of ${lineOf(e.id).at(-1)}, the last of its line`));
      for (const m of merges.filter((merge) => merge.duplicate === e.id)) {
        assert.deepStrictEqual(reach(m.into, e.id), [], ctx(`${e.id} shows though ${m.id}, a merge that leads to a shown entry, took it as a duplicate`));
      }
    } else if (inLivePlace(e.id)) {
      assert.ok(reach(e.id).length > 0, ctx(`${e.id}, in a live place, neither shows nor leads to an entry that does`));
    }
  }

  for (const [place, record] of records) {
    const [unit, topic] = /** @type {[string, string]} */ (place.split('\0'));
    const at = { unit, topic: topic === '' ? null : topic };
    const within = (/** @type {string} */ id) => standing(id).unit === unit && (at.topic === null || standing(id).topic === at.topic);
    const made = (/** @type {Record<string, any>} */ e) => e.unit === unit && (at.topic === null || e.topic === at.topic);
    if (!placeLive(at.unit, at.topic)) {
      assert.deepStrictEqual([main(record), record.moved, record.merged, record.other_topics], [[], [], [], []], ctx(`${place}'s record, not live, shows something`));
      continue;
    }
    for (const e of main(record)) {
      const id = full(e.id);
      const beneath = chainOf(id).slice(1);
      const cut = beneath.findIndex((old) => !inLivePlace(old));
      const earlier = lineOf(id).filter((wording) => position.get(wording) < position.get(id)).reverse();
      assert.deepStrictEqual(e.replaced.map((/** @type {{id: string}} */ r) => full(r.id)), isQuestion(byId.get(id)) ? earlier : cut === -1 ? beneath : beneath.slice(0, cut),
        ctx(`${place} does not fold ${e.id}'s live chain beneath it`));
      for (const shownEntry of [e, ...e.replaced]) {
        assert.deepStrictEqual(shownEntry.holds.map((/** @type {{id: string}} */ h) => full(h.id)), confirmations.filter((c) => c.entry === full(shownEntry.id)).map((c) => c.id),
          ctx(`${place} does not show ${shownEntry.id}'s live confirmations alone`));
        assert.deepStrictEqual(shownEntry.kept.map((/** @type {{id: string}} */ k) => full(k.id)), keeps.filter((k) => k.entry === full(shownEntry.id)).map((k) => k.id),
          ctx(`${place} does not show the person's live keeps of ${shownEntry.id} alone`));
        assert.strictEqual(shownEntry.late_check, lateChecks.get(full(shownEntry.id)), ctx(`${place} does not show what the late check last found of ${shownEntry.id}`));
        assert.deepStrictEqual(shownEntry.assets, assetsOf(full(shownEntry.id)), ctx(`${place} does not show the latest live link of each file linked from ${shownEntry.id}`));
      }
    }
    assert.deepStrictEqual(record.moved.map((/** @type {{id: string, text: string}} */ m) => [full(m.id), m.text]), moves.filter(made).map((m) => [m.id, byId.get(m.question).text]),
      ctx(`${place}'s record does not show its live moves`));
    assert.deepStrictEqual(record.merged.map((/** @type {{id: string, duplicate_entry: {id: string}|null, holds: boolean}} */ m) => [full(m.id), m.duplicate_entry === null ? null : full(m.duplicate_entry.id), m.holds]),
      merges.filter(made).map((m) => [m.id, m.duplicate !== null && inLivePlace(m.duplicate) ? m.duplicate : null, leads(m)]), ctx(`${place}'s record does not show its live merges, each holding while it leads`));
    /** @type {Map<string, Set<string>>} */
    const expected = new Map();
    const tie = (/** @type {string[]} */ ids, /** @type {string} */ to) => {
      for (const id of ids.filter((shownId) => !within(shownId))) expected.set(id, new Set([...(expected.get(id) ?? []), to]));
    };
    for (const e of main(record)) {
      const id = full(e.id);
      for (const relied of byId.get(id).relies_on) tie(reach(relied), relied);
      if (isQuestion(byId.get(id))) tie(answersOf(id).answers, id);
    }
    for (const m of merges.filter(made).filter(leads)) tie(reach(m.into), m.into);
    for (const id of shownAt.keys()) {
      if (!within(id) && placed(id).some((p) => p.unit === unit && (at.topic === null || p.topic === at.topic))) expected.set(id, expected.get(id) ?? new Set());
    }
    assert.deepStrictEqual(new Map(record.other_topics.map((/** @type {{id: string, named: string[]}} */ o) => [full(o.id), new Set(o.named.map(full))])), expected,
      ctx(`${place}'s record does not show exactly the entries standing elsewhere tied to it`));
  }

  for (const [place, map] of maps) {
    const [unit, topic] = /** @type {[string, string]} */ (place.split('\0'));
    const record = /** @type {Record<string, any>} */ (records.get(place));
    if (!placeLive(unit, topic)) {
      assert.deepStrictEqual(map.questions, [], ctx(`${place}'s map, not live, shows something`));
      continue;
    }
    const on = (/** @type {{unit: string, topic: string|null}} */ p) => p.unit === unit && p.topic === topic;
    const shownRow = (/** @type {{id: string, answers: {id: string}[]}} */ row) => full(row.id);
    const standingHere = map.questions.filter((/** @type {{stands: string}} */ row) => !['moved-away', 'elsewhere', 'question-set-aside'].includes(row.stands));
    const questionRows = map.questions.filter((/** @type {{stands: string}} */ row) => row.stands !== 'question-set-aside').map(shownRow);
    for (const [at, id] of questionRows.entries()) {
      const twice = questionRows.slice(at + 1).find((other) => firstOf(other).id === firstOf(id).id);
      assert.strictEqual(twice, undefined, ctx(`${place}'s map shows ${id} and ${twice}, two wordings of one question`));
    }
    for (const row of standingHere) {
      assert.ok(row.stands !== 'open' || answering(full(row.id)).length === 0, ctx(`${place}'s map shows ${row.id} open, though a shown entry answers a wording of it`));
    }
    const questionsHere = [...shownAt.keys()].filter((id) => isQuestion(byId.get(id)) && on(standing(id)));
    assert.deepStrictEqual(standingHere.map(shownRow).sort(), [...questionsHere].sort(),
      ctx(`${place}'s map does not hold a row for each shown question standing on it`));
    for (const row of map.questions) {
      assert.strictEqual(row.waiting_on, row.stands === 'open' ? waitingOn(unit, full(row.id)) : null, ctx(`${place}'s map does not mark ${row.id} waiting on the experiment of its unit measuring it alone`));
      if (row.stands === 'question-set-aside') assert.ok([...main(record), ...record.other_topics].some((e) => full(e.id) === full(row.id)), ctx(`${place}'s record does not show ${row.id}, which its map shows as a row of its own`));
      for (const { id: answer } of row.answers) {
        assert.ok([...main(record), ...record.other_topics].some((e) => full(e.id) === full(answer)), ctx(`${place}'s record does not show ${answer}, which its map shows answering ${row.id}`));
      }
    }
    for (const row of standingHere) {
      const movedIn = movesOf(full(row.id), unit).filter(toTopic).at(-1);
      const { answers, merged } = answersOf(full(row.id));
      const later = laterOf(full(row.id));
      const stands = merged ? 'merged' : answers.length > 0 ? 'answered' : later === null ? 'open' : 'later';
      assert.deepStrictEqual([row.moved_from, row.moved_to], [movedIn === undefined || !placeLive(unit, movedIn.topic) ? null : movedIn.topic, stands === 'later' ? later : null],
        ctx(`${place}'s map does not show the live topic ${row.id} moved in from by its unit's last live move to a topic, and the roadmap it is later on`));
      assert.deepStrictEqual([row.answers.map((/** @type {{id: string}} */ a) => full(a.id)).sort(), row.stands], [answers, stands],
        ctx(`${place}'s map does not answer ${row.id} by its shown answers`));
      for (const answer of answers) {
        const elsewhere = record.other_topics.find((/** @type {{id: string}} */ o) => full(o.id) === answer);
        assert.ok(main(record).some((e) => full(e.id) === answer) || elsewhere?.named.map(full).includes(full(row.id)), ctx(`${place}'s record does not show ${answer}, answering ${row.id}`));
      }
    }
    const shownHere = new Set(questionsHere.flatMap((id) => answersOf(id).answers));
    const answersHere = (/** @type {string} */ id) => answersOf(id).answers.filter((a) => !shownHere.has(a) && placed(a).some(on));
    /** @param {string} stands */
    const rowsOf = (stands) => map.questions.filter((/** @type {{stands: string}} */ row) => row.stands === stands)
      .map((/** @type {{id: string, moved_from: string|null, moved_to: string|null, stands_in: object|null, answers: {id: string}[]}} */ row) => [full(row.id), row.moved_from, row.moved_to, row.stands_in, row.answers.map((a) => full(a.id)).sort()]).sort();
    const offTopic = [...shownAt.keys()].filter((id) => isQuestion(byId.get(id)) && !on(standing(id)));
    const movedAway = offTopic.filter((id) => standing(id).unit === unit && movesOf(id, unit).some((m) => m.topic === topic));
    assert.deepStrictEqual(rowsOf('moved-away'), movedAway.map((id) => [id, null, standing(id).topic, null, answersHere(id)]).sort(),
      ctx(`${place}'s map does not lead each shown question its unit moved away from it to where it stands now, with its answers placed there`));
    const elsewhere = offTopic.filter((id) => !movedAway.includes(id) && (placed(id).some(on) || answersHere(id).length > 0));
    assert.deepStrictEqual(rowsOf('elsewhere'), elsewhere.map((id) => [id, null, null, standing(id), answersHere(id)]).sort(),
      ctx(`${place}'s map does not show each shown question standing elsewhere placed on it, or answered by an entry placed there, where it stands (5.8.19)`));
    const alone = [...shownAt.keys()].filter((id) => typeof byId.get(id).answers === 'string' && !answeringShown.has(id) && placed(id).some(on));
    assert.deepStrictEqual(rowsOf('question-set-aside'), alone.map((id) => [id, null, null, on(standing(id)) ? null : standing(id), []]).sort(),
      ctx(`${place}'s map does not show each shown answer placed on it that answers no shown question as a row of its own (5.8.19)`));
  }

  const product = ledger(['product']);
  assert.deepStrictEqual([...product.findings, ...product.decisions].map((/** @type {{id: string}} */ e) => full(e.id)).sort(), [...shownAt.keys()].filter((id) => byId.get(id).product_wide === true).sort(),
    ctx('the product record does not hold the shown entries marked product-wide'));

  auditCopies(root, events, shownAt, placed, full, ctx);
}

// The ledger's copies in the knowledge directory, held to the records: a
// copy for each place a shown entry is placed in — its unit's own level, or
// a topic — and for no other; each naming every entry shown there and no entry
// that is not shown, so no replaced answer is in one; the product record's
// file naming the shown entries marked product-wide alone; no words of an
// entry that is not shown — a question's wording, an answer's text, its why
// — in any copy or the product record's file, but where a shown entry says
// them too; and the store indexing the records' copies, never the product
// record's file.
/**
 * @param {string} root @param {Record<string, any>[]} events @param {Map<string, string[]>} shownAt
 * @param {(id: string) => {unit: string, topic: string|null}[]} placed
 * @param {(short: string) => string} full @param {(msg: string) => string} ctx
 */
function auditCopies(root, events, shownAt, placed, full, ctx) {
  /** @type {Map<string, string[]>} */
  const expected = new Map();
  for (const id of shownAt.keys()) {
    for (const { unit, topic } of placed(id)) {
      const file = topic === null ? `${RECORDS_DIR}/${unit}.md` : `${RECORDS_DIR}/${unit}/${topic}.md`;
      expected.set(file, [...(expected.get(file) ?? []), id]);
    }
  }
  const markdown = (/** @type {string} */ rel) => (fs.existsSync(path.join(root, rel)) ? fs.readdirSync(path.join(root, rel), { withFileTypes: true }) : [])
    .flatMap((entry) => (entry.isDirectory() ? markdown(`${rel}/${entry.name}`) : entry.name.endsWith('.md') ? [`${rel}/${entry.name}`] : []));
  const copies = markdown(RECORDS_DIR).sort();
  assert.deepStrictEqual(copies, [...expected.keys()].sort(), ctx('the record copies are not one for each place a shown entry is placed in'));
  /** @param {string} rel */
  const named = (rel) => [...fs.readFileSync(path.join(root, rel), 'utf8').matchAll(/Entry (\w+)\.$/gm)].map((m) => full(m[1]));
  for (const [file, ids] of expected) {
    const names = named(file);
    assert.deepStrictEqual(ids.filter((id) => !names.includes(id)), [], ctx(`${file} does not name every entry its record shows`));
    assert.deepStrictEqual(names.filter((id) => !shownAt.has(id)), [], ctx(`${file} names an entry that is not current`));
  }
  const byId = new Map(events.map((e) => [e.id, e]));
  assert.deepStrictEqual([...new Set(named(PRODUCT_FILE))].sort(), [...shownAt.keys()].filter((id) => byId.get(id).product_wide === true).sort(),
    ctx('the product record\'s file does not name the shown entries marked product-wide alone'));
  /** @param {Record<string, any>} e @returns {string[]} */
  const words = (e) => [e.text, e.why, e.how, e.rules_out, e.alternatives, e.evidence, e.drops].flat().filter((w) => typeof w === 'string');
  const shownWords = [...shownAt.keys()].flatMap((id) => words(byId.get(id)));
  const unshown = events.filter((e) => ['asked', 'found', 'decided', 'replaced'].includes(e.event) && !shownAt.has(e.id))
    .flatMap((e) => words(e).map((w) => [e.id, w])).filter(([, w]) => !shownWords.some((shown) => shown.includes(w)));
  for (const file of [...copies, PRODUCT_FILE]) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert.deepStrictEqual(unshown.filter(([, w]) => text.includes(w)), [], ctx(`${file} holds the words of an entry that is not shown`));
  }
  const storeFile = knowledgeFiles(root).store;
  const chunks = fs.existsSync(storeFile) ? knowledgeStore.allChunks(knowledgeStore.loadStore(storeFile)).filter((c) => c.phase === 'record') : [];
  assert.deepStrictEqual([...new Set(chunks.map((c) => c.source_file))].sort(), copies, ctx('the store does not index the record copies alone'));
  for (const file of copies) {
    const held = chunks.filter((c) => c.source_file === file).sort((a, b) => a.id.localeCompare(b.id)).map((c) => c.content);
    const cut = chunker.chunk(fs.readFileSync(path.join(root, file), 'utf8'), RECORD_CHUNKING).map((c) => c.content);
    assert.deepStrictEqual(held, cut, ctx(`the store's chunks of ${file} are not the copy as it stands`));
  }
  assert.deepStrictEqual(chunks.flatMap((c) => unshown.filter(([, w]) => c.content.includes(w))), [], ctx('a chunk in the store holds the words of an entry that is not shown'));
}

// The trust log held to the ledger (16.13.3, 16.13.4, 16.12.1), read from
// the sim's own config folder, the project's events alone, each once by its
// id: a call for each of Claude's answers, a decision or its replacement of
// one, but one carried over; a reversal, naming the entry it reverses, for
// each of the person's replacements of a decision that held Claude's lean —
// Claude leaned down its chain, its own call, handed over or not, or a
// sealed answer, and it did not stand over the lean — made for a changed
// mind or a mistake and carrying no sealed answer of Claude's; a raise,
// naming the line, for each of the person's
// answers to the lean a raise sealed — an entry, or a keep of the decision
// Claude proposed to replace — beside the raises the person did not follow;
// none of them for anything else; and nothing left waiting in a
// conversation, as no append fails. Every verdict names a departure the
// trust log holds — a raise answered against the lean, a keep among them,
// or a reversal — that the ledger holds as a decision whose answer stood
// over the lean, or a keep (16.13.6), and none follows one that is no skip
// (16.10.1); the verdict a command that `ran` gave has its line, the latest.
/** @param {Sim} sim @param {string} label @param {string[]} [ran] the command, where it succeeded */
function auditTrust(sim, label, ran = []) {
  const ctx = (/** @type {string} */ msg) => `[${label}] ${msg}`;
  const ledgerFile = statePath(sim.dir, LEDGER);
  if (!fs.existsSync(ledgerFile)) return;
  /** @type {Record<string, any>[]} */
  const entries = fs.readFileSync(ledgerFile, 'utf8').split('\n').slice(0, -1).map((line) => JSON.parse(line));
  const byId = new Map(entries.map((e) => [e.id, e]));
  const project = JSON.parse(fs.readFileSync(statePath(sim.dir, 'manifest.json'), 'utf8')).project_id;
  const log = path.join(sim.configDir, TRUST_LOG);
  /** @type {Record<string, any>[]} */
  const lines = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').slice(0, -1).map((line) => JSON.parse(line)) : [];
  const events = [...new Map(lines.map((e) => [e.id, e])).values()].filter((e) => e.project === project);
  const ofType = (/** @type {string} */ type) => events.filter((e) => e.type === type);
  const isDecision = (/** @type {Record<string, any>} */ e) => e.event === 'decided' || e.of === 'decision';
  const isKeep = (/** @type {Record<string, any>} */ e) => e.event === 'kept';

  const claudes = (/** @type {Record<string, any>} */ e) => e.by === 'claude' && e.given !== 'carried';
  assert.deepStrictEqual(ofType('call').map((e) => e.entry).sort(), entries.filter((e) => isDecision(e) && claudes(e)).map((e) => e.id).sort(),
    ctx('the trust log does not hold one call for each of Claude\'s answers, and no other'));
  /** @type {(e: Record<string, any>) => boolean} */
  const leaned = (e) => claudes(e) || typeof e.sealed === 'string' || (e.event === 'replaced' && leaned(byId.get(e.replaces)));
  const reversing = entries.filter((e) => e.event === 'replaced' && e.of === 'decision' && e.by === 'person' && e.sealed === null
    && ['changed-mind', 'was-wrong'].includes(e.reason) && leaned(byId.get(e.replaces)) && byId.get(e.replaces).who_moved_whom !== 'person-moved-claude');
  assert.deepStrictEqual(ofType('reversal').map((e) => [e.entry, e.reverses]).sort(), reversing.map((e) => [e.id, e.replaces]).sort(),
    ctx('the trust log does not hold one reversal for each of the person\'s replacements standing over a lean the entry it replaces held, and no other'));
  assert.deepStrictEqual(ofType('raise').filter((e) => !e.didnt_follow).map((e) => e.entry).sort(),
    entries.filter((e) => (isDecision(e) && e.by === 'person' && e.sealed !== null) || isKeep(e)).map((e) => e.id).sort(),
    ctx('the trust log does not hold one raise for each of the person\'s answers to the lean a raise sealed, and no other'));
  const conversations = path.join(sim.configDir, 'conversations');
  const waiting = fs.existsSync(conversations) ? fs.readdirSync(conversations).filter((name) => fs.existsSync(path.join(conversations, name, PENDING))) : [];
  assert.deepStrictEqual(waiting, [], ctx('an event waits in a conversation, though no append failed'));
  const departures = new Set([...ofType('raise').filter((e) => !e.didnt_follow && e.answer !== e.sealed), ...ofType('reversal')].map((e) => e.entry));
  /** @type {Map<string, Record<string, any>[]>} */
  const given = new Map();
  for (const v of ofType('verdict')) {
    assert.ok(departures.has(v.entry), ctx(`the verdict ${v.id} names ${v.entry}, which is no departure the trust log holds`));
    const judged = byId.get(v.entry) ?? {};
    assert.ok((isDecision(judged) || isKeep(judged)) && judged.who_moved_whom === 'person-moved-claude', ctx(`the verdict ${v.id} names ${v.entry}, which is no departure in the ledger`));
    given.set(v.entry, [...(given.get(v.entry) ?? []), v]);
  }
  for (const [entry, verdicts] of given) {
    const judged = verdicts.slice(0, -1).filter((v) => v.verdict !== 'skip');
    assert.deepStrictEqual(judged, [], ctx(`${entry} was given a verdict after one that was no skip`));
  }
  if (ran[0] === 'verdict' && ran[1] === 'give') {
    const [, , prefix, verdict, , point] = ran;
    const latest = ofType('verdict').at(-1);
    assert.ok(latest !== undefined && latest.entry.startsWith(prefix) && latest.verdict === verdict && latest.point === point, ctx(`the trust log's latest verdict is not ${ran.slice(2).join(' ')}`));
  }
}

// The skills a menu's route reaches in place: another menu, or help.
const IN_PLACE_SKILLS = ['leeway-continue-linear', 'leeway-help'];

// A route the engine builds into a work skill hands off as it stands, so the
// handoff table must take it whole and carry it unchanged — a route and the
// table can never drift.
/** @param {string} dir @param {{route?: string|null}[]} keys @param {string} label */
function auditRoutes(dir, keys, label) {
  for (const { route } of keys) {
    if (!route) continue;
    const [named, ...args] = shellWords(route);
    const skill = named.slice(1);
    if (HANDOFF_TARGETS.includes(skill)) {
      let text;
      try {
        ({ text } = resolveHandoff(dir, named, args));
      } catch (err) {
        assert.fail(`[${label}] the handoff refuses ${route}: ${err.message}`);
      }
      assert.strictEqual(text, `Invoke \`${route}\`.`, `[${label}] the handoff does not carry ${route} as it stands`);
    } else {
      assert.ok(IN_PLACE_SKILLS.includes(skill), `[${label}] ${route} reaches neither a handoff target nor a menu`);
    }
  }
}

// ---------------------------------------------------------------------------
// The gate payload
// ---------------------------------------------------------------------------

// The menus each gateway's `view` verb draws over the project: the start
// menu (the empty state's when there is no work), every epic's menu, its
// completed topics and its specification menu, every linear unit's
// proceed/revisit menu.
/** @typedef {{keys: {route?: string|null}[], rendered: string}} ViewMenu */

// The specification menu's views over one epic — its `spec-scenario`,
// `spec-view` and `spec-completed-menu` verbs: the routing read and the
// scenario's display render whatever the state, beside the scenario's menu
// and, once anything has concluded, the concluded-specs sub-view.
/** @param {string} dir @param {string} workUnit @returns {GatewayMenu[]} */
function specificationViewMenus(dir, workUnit) {
  EPIC_GATEWAY.specScenario(dir, workUnit);
  const detail = specDetail(dir, workUnit);
  LIB.project.specificationDisplay(detail);
  return [
    [EPIC_GATEWAY.GATES.spec, () => LIB.project.specificationMenu(detail)],
    ...(detail.concluded.length > 0 ? [/** @type {GatewayMenu} */ ([EPIC_GATEWAY.GATES.specRefine, () => LIB.project.specificationCompletedMenu(detail)])] : []),
  ];
}

/** A gateway's menu: the gate it states, by the gateway's name for it, and its composition. @typedef {[string, () => ViewMenu]} GatewayMenu */

/** @type {Record<string, (dir: string) => GatewayMenu[]>} */
const VIEW_MENUS = {
  start: (dir) => {
    const result = START_GATEWAY.discover(dir);
    return [result.state.has_any_work
      ? [START_GATEWAY.GATES.start, () => LIB.project.startMenu(result)]
      : [START_GATEWAY.GATES.empty, () => LIB.project.emptyMenu(result)]];
  },
  epic: (dir) => listWorkUnits(dir).flatMap((wu) => {
    const detail = EPIC_GATEWAY.discover(dir, wu);
    return detail ? [
      /** @type {GatewayMenu} */ ([EPIC_GATEWAY.GATES.epic, () => LIB.project.epicMenu(wu, detail)]),
      /** @type {GatewayMenu} */ ([EPIC_GATEWAY.GATES.resume, () => LIB.project.epicCompletedMenu(wu, detail)]),
      ...specificationViewMenus(dir, wu),
    ] : [];
  }),
  linear: (dir) => listWorkUnits(dir).map((wu) => LIB.detail.activeWorkUnit(dir, wu)).filter(Boolean)
    .map((/** @type {any} */ { type, unit }) => /** @type {GatewayMenu} */ ([LINEAR_GATEWAY.GATES.view, () => LIB.project.workUnitMenu(type, unit)])),
};

/** One gateway render with the gate surface announced, collected from its start. @param {() => string} render */
function announcedRender(render) {
  return announced(() => {
    openGate();
    return render();
  });
}

/** @typedef {import('./pipeline-world.cjs').Sim} Sim */

// With the gate surface announced, the same render states its menu as data
// directly above the markdown, and that data has to be the whole menu.
/** @param {Sim} sim @param {string[]} args @param {Record<string,string>|null} identity @returns {void} */
function auditGatePayload(sim, args, identity) {
  const env = { ...sim.envOf(identity), LEEWAY_GATE_SURFACE: '1' };
  const stated = auditGate(engine.run(['render', ...args], { cwd: sim.dir, env }).stdout, `render ${args.join(' ')} — gate payload`);
  auditGateShown(sim, stated, identity, `render ${args.join(' ')}`);
}

// ---------------------------------------------------------------------------
// The gate shown, and the answers given at it
// ---------------------------------------------------------------------------

// The gate a render's menu states is the one its conversation was shown:
// the record `gate` answers against holds it — named as its MENU declares
// it, up to its first ` — ` — row for row, and unanswered.
/**
 * @param {Sim} sim @param {import('./gate-audit.cjs').GatePayload|null} stated
 * @param {Record<string,string>|null} identity @param {string} label
 */
function auditGateShown(sim, stated, identity, label) {
  if (stated === null) return;
  const folder = path.join(sim.configDir, 'conversations', sim.envOf(identity).CLAUDE_CODE_SESSION_ID);
  const shown = JSON.parse(fs.readFileSync(path.join(folder, SHOWN), 'utf8'));
  /** @param {{key: string, word: string|null, head: string, recommended: boolean}} o */
  const row = ({ key, word, head, recommended }) => ({ key, word, head, recommended });
  assert.deepStrictEqual(
    { gate: shown.gate, question: shown.question, options: shown.options.map(row), typed: shown.typed.map((/** @type {{label: string}} */ t) => t.label), answered: shown.answered },
    { gate: stated.gate.split(' — ')[0], question: stated.question, options: stated.options.map(row), typed: stated.typed.map((t) => t.label), answered: null },
    `[${label}] the gate shown is not the gate the menu states`,
  );
}

/** The sim's trust log, a line apiece. @param {Sim} sim @returns {string[]} */
function trustLines(sim) {
  const file = path.join(sim.configDir, TRUST_LOG);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').slice(0, -1) : [];
}

// Each answer through `gate` is one line of the trust log: the gate event
// holding the gate, the row recommended, the row picked and how it came, as
// `gate` answered them.
/** @param {Sim} sim @param {Record<string, unknown>} answered @param {string[]} before @param {string} label */
function auditGateAnswer(sim, answered, before, label) {
  const lines = trustLines(sim);
  assert.deepStrictEqual(lines.slice(0, before.length), before, `[${label}] the trust log was not appended to`);
  assert.strictEqual(lines.length, before.length + 1, `[${label}] the answer is not one line of the trust log`);
  const { type, gate, recommended, picked, via } = JSON.parse(lines[lines.length - 1]);
  assert.deepStrictEqual({ type, gate, recommended, picked, via }, { type: 'gate', gate: answered.gate, recommended: answered.recommended, picked: answered.picked, via: answered.via },
    `[${label}] the trust log's line is not the answer given`);
}

module.exports = {
  auditState, auditGatePayload, auditTrust, specDetail, shellWords, trustLines, auditGateAnswer,
};
