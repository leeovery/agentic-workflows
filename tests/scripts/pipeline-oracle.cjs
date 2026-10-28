'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's oracle (tests/README.md §11): the audit `Sim`
// (pipeline-world.cjs) runs over the whole state after every mutation a
// scenario makes —
//   - every manifest parses and is schema-valid (statuses in vocabulary,
//     discovery items status-less, no phase-named shadow roots),
//   - every derivation (lifecycle, phaseStatus, next-phase) computes without
//     throwing for every item,
//   - every navigation gateway (start, the continue menus, bridge) reads
//     and renders the state without throwing — the epic's specification
//     menu among its views,
//   - every menu a gateway draws, and every menu a render draws, states
//     itself whole in its gate payload once the gate surface is announced,
//   - the ledger's projections and its copies hold to the events.
// This is the detector for the silent class of bug: state that writes fine,
// raises nothing, and only breaks a menu three phases later.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const engine = require(path.join(ROOT, 'skills/workflow-engine/scripts/engine.cjs'));
const schema = require(path.join(ROOT, 'skills/workflow-engine/scripts/kernel/manifest-schema.cjs'));
const derivations = require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/derivations.cjs'));
const { roadmapState } = require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/roadmap.cjs'));
const { mapState } = require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/discussion-map.cjs'));
const { registerState } = require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/research-threads.cjs'));
const {
  RECORDS_DIR, PRODUCT_FILE, knowledgeFiles,
} = require(path.join(ROOT, 'skills/workflow-engine/scripts/kernel/knowledge/files.cjs'));
const knowledgeStore = require(path.join(ROOT, 'skills/workflow-engine/scripts/kernel/knowledge/store.cjs'));
const chunker = require(path.join(ROOT, 'skills/workflow-engine/scripts/kernel/knowledge/chunker.cjs'));
const RECORD_CHUNKING = JSON.parse(fs.readFileSync(path.join(ROOT, 'skills/workflow-engine/content/knowledge/chunking/record.json'), 'utf8'));
const { LEDGER } = require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/ledger-events.cjs'));
const START_GATEWAY = require(path.join(ROOT, 'skills/workflow-start/scripts/gateway.cjs'));
const EPIC_GATEWAY = require(path.join(ROOT, 'skills/workflow-continue-epic/scripts/gateway.cjs'));
const LINEAR_GATEWAY = require(path.join(ROOT, 'skills/workflow-continue-linear/scripts/gateway.cjs'));
const BRIDGE = require(path.join(ROOT, 'skills/workflow-bridge/scripts/gateway.cjs'));
const LIB = require(path.join(ROOT, 'skills/workflow-engine/scripts/lib.cjs'));
const {
  specificationDiscovery, specificationDetail,
} = require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/specification.cjs'));
const { openGate } = require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/projections/surfaces.cjs'));
const {
  resolveHandoff, HANDOFF_TARGETS,
} = require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/handoff.cjs'));
const { announced, auditGate } = require('./gate-audit.cjs');
const { ledgerEntries } = require('./engine-harness.cjs');
const { statePath } = require(path.join(ROOT, 'skills/workflow-engine/scripts/kernel/state-root.cjs'));

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

function auditState(dir, label) {
  const ctx = (msg) => `[${label}] ${msg}`;

  // Project manifest parses.
  const projPath = path.join(dir, '.leeway', 'manifest.json');
  const project = fs.existsSync(projPath) ? JSON.parse(fs.readFileSync(projPath, 'utf8')) : null;

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
    for (const view of views(dir)) {
      auditGate(announcedRender(() => LIB.gateway.menuBlock(view().rendered)), `${label} — ${name} view`);
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
// question in a live place took it to — and an entry stands where the
// earliest entry of its chain in a live place was made, or where the first
// was when none is; it is placed where it stands, and where it was made
// where that differs (5.8.19). Current is what the records show. Every
// entry in a live place is shown, or leads to a shown entry down its live
// replacements or, with none, its live merges; a shown entry is in a live
// place, no live replacement names it, no live merge that would still lead
// to a shown entry took it as a duplicate, and it shows exactly once in its
// unit's record and once in its topic's. Each map holds a row for each
// shown question standing on the topic — answered by the shown entries
// answering any wording of it and those its leading merges lead to, merged
// while one leads, moved in from where the last live move the map's unit
// made of it was made, while that is live; a row for each shown question
// standing on another topic of the map's unit that the unit moved away from
// the topic by a live move, leading to where it stands now; and a row for
// each other shown question placed on the topic or with an answer placed
// there, saying where it stands. A row of a question standing off the topic
// shows its answers placed on the topic that no question standing there
// shows; and a row of its own for each shown answer placed on the topic
// whose question no shown wording asks, its question set aside. Each
// record shows its maps' answers, with exactly the entries standing
// elsewhere that were made there, that its entries rely on, its
// leading merges went into or that answer its questions; its live moves and
// merges, a merge's duplicate where it is live and whether the merge leads;
// each entry's live confirmations, what the late one-decision check last
// found of it where it found anything, and its chain down to the first
// entry not in a live place. A place that is not live shows nothing; the
// product record holds the shown entries marked product-wide.
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
  /** The moves in a live place `unit` made of `id`'s question, in the ledger's order. @param {string} id @param {string} unit */
  const movesOf = (id, unit) => moves.filter((m) => m.unit === unit && firstOf(m.question).id === firstOf(id).id);
  /** @type {Map<string, string|null>} */
  const madeOn = new Map();
  /** The topic `id` was made on: a question's, the one the last move its unit made of it in a live place took it to, if any. @param {string} id */
  const topicOf = (id) => {
    if (!madeOn.has(id)) {
      const e = byId.get(id);
      const move = isQuestion(e) ? movesOf(id, e.unit).at(-1) : undefined;
      madeOn.set(id, move === undefined ? e.topic : move.to);
    }
    return /** @type {string|null} */ (madeOn.get(id));
  };
  /** @param {string} id */
  const inLivePlace = (id) => placeLive(byId.get(id).unit, topicOf(id));
  /** @param {string} id @returns {{unit: string, topic: string|null}} */
  const standing = (id) => {
    const at = /** @type {string} */ (chainOf(id).filter(inLivePlace).at(-1) ?? chainOf(id).at(-1));
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
  /** What the late check last found of each entry it judged. @type {Map<string, string>} */
  const lateChecks = new Map(events.filter((e) => e.event === 'checked').map((e) => [e.entry, e.rules]));

  /** @param {string[]} args */
  const ledger = (args) => {
    const res = engine.run(['ledger', ...args], { cwd: dir });
    assert.strictEqual(res.code, 0, ctx(`ledger ${args.join(' ')} does not read: ${res.stderr}`));
    return JSON.parse(res.stdout);
  };
  const units = [...new Set(events.flatMap((e) => [e.unit, standing(e.id).unit]))];
  const topics = [...new Set(events.flatMap((e) => [[e.unit, e.topic], [standing(e.id).unit, standing(e.id).topic], ...(e.event === 'moved' ? [[e.unit, e.to]] : [])])
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

  /** Where `id` leads while not shown: its live replacements, or, with none, the entries its live merges went into. @param {string} id */
  const next = (id) => {
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
  /** @param {string} question */
  const answersOf = (question) => {
    const asked = chainOf(question);
    const own = events.filter((e) => asked.includes(e.answers) && shown(e.id)).map((e) => e.id);
    const leading = merges.filter((m) => asked.includes(m.question) && leads(m));
    return { answers: [...new Set([...own, ...leading.flatMap((m) => reach(m.into, m.duplicate))])].sort(), merged: leading.length > 0 };
  };
  /** @param {string} id */
  const placesOf = (id) => [`${standing(id).unit}\0`, ...(standing(id).topic === null ? [] : [`${standing(id).unit}\0${standing(id).topic}`])];

  for (const e of events.filter((ev) => ENTRIES.includes(ev.event))) {
    if (shown(e.id)) {
      assert.ok(inLivePlace(e.id), ctx(`${e.id} shows from a place that is not live`));
      assert.deepStrictEqual([...(shownAt.get(e.id) ?? [])].sort(), placesOf(e.id).sort(), ctx(`${e.id} does not show once in its unit's record and once in its topic's`));
      assert.ok(replacements.every((r) => r.replaces !== e.id), ctx(`${e.id} shows though a live replacement names it`));
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
      assert.deepStrictEqual(e.replaced.map((/** @type {{id: string}} */ r) => full(r.id)), cut === -1 ? beneath : beneath.slice(0, cut),
        ctx(`${place} does not fold ${e.id}'s live chain beneath it`));
      for (const shownEntry of [e, ...e.replaced]) {
        assert.deepStrictEqual(shownEntry.holds.map((/** @type {{id: string}} */ h) => full(h.id)), confirmations.filter((c) => c.entry === full(shownEntry.id)).map((c) => c.id),
          ctx(`${place} does not show ${shownEntry.id}'s live confirmations alone`));
        assert.strictEqual(shownEntry.late_check, lateChecks.get(full(shownEntry.id)), ctx(`${place} does not show what the late check last found of ${shownEntry.id}`));
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
    const questionsHere = [...shownAt.keys()].filter((id) => isQuestion(byId.get(id)) && on(standing(id)));
    assert.deepStrictEqual(standingHere.map(shownRow).sort(), [...questionsHere].sort(),
      ctx(`${place}'s map does not hold a row for each shown question standing on it`));
    for (const row of map.questions) {
      if (row.stands === 'question-set-aside') assert.ok([...main(record), ...record.other_topics].some((e) => full(e.id) === full(row.id)), ctx(`${place}'s record does not show ${row.id}, which its map shows as a row of its own`));
      for (const { id: answer } of row.answers) {
        assert.ok([...main(record), ...record.other_topics].some((e) => full(e.id) === full(answer)), ctx(`${place}'s record does not show ${answer}, which its map shows answering ${row.id}`));
      }
    }
    for (const row of standingHere) {
      const movedIn = movesOf(full(row.id), unit).at(-1);
      assert.deepStrictEqual([row.moved_from, row.moved_to], [movedIn === undefined || !placeLive(unit, movedIn.topic) ? null : movedIn.topic, null],
        ctx(`${place}'s map does not show the live topic ${row.id} moved in from by its unit's last live move`));
      const { answers, merged } = answersOf(full(row.id));
      assert.deepStrictEqual([row.answers.map((/** @type {{id: string}} */ a) => full(a.id)).sort(), row.stands], [answers, merged ? 'merged' : answers.length > 0 ? 'answered' : 'open'],
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
    const asked = (/** @type {string} */ answer) => [...shownAt.keys()].some((q) => isQuestion(byId.get(q)) && chainOf(q).includes(byId.get(answer).answers));
    const alone = [...shownAt.keys()].filter((id) => typeof byId.get(id).answers === 'string' && !asked(id) && placed(id).some(on));
    assert.deepStrictEqual(rowsOf('question-set-aside'), alone.map((id) => [id, null, null, null, []]).sort(),
      ctx(`${place}'s map does not show each shown answer placed on it whose question is set aside as a row of its own (5.8.19)`));
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

// The skills a menu's route reaches in place: another menu, or help.
const IN_PLACE_SKILLS = ['workflow-continue-linear', 'workflow-help'];

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
/** @param {string} dir @param {string} workUnit @returns {(() => ViewMenu)[]} */
function specificationViewMenus(dir, workUnit) {
  EPIC_GATEWAY.specScenario(dir, workUnit);
  const detail = specDetail(dir, workUnit);
  LIB.project.specificationDisplay(detail);
  return [
    () => LIB.project.specificationMenu(detail),
    ...(detail.concluded.length > 0 ? [() => LIB.project.specificationCompletedMenu(detail)] : []),
  ];
}

/** @type {Record<string, (dir: string) => (() => ViewMenu)[]>} */
const VIEW_MENUS = {
  start: (dir) => {
    const result = START_GATEWAY.discover(dir);
    return [() => (result.state.has_any_work ? LIB.project.startMenu(result) : LIB.project.emptyMenu(result))];
  },
  epic: (dir) => listWorkUnits(dir).flatMap((wu) => {
    const detail = EPIC_GATEWAY.discover(dir, wu);
    return detail ? [
      () => LIB.project.epicMenu(wu, detail),
      () => LIB.project.epicCompletedMenu(wu, detail),
      ...specificationViewMenus(dir, wu),
    ] : [];
  }),
  linear: (dir) => listWorkUnits(dir).map((wu) => LIB.detail.activeWorkUnit(dir, wu)).filter(Boolean)
    .map((/** @type {any} */ { type, unit }) => () => LIB.project.workUnitMenu(type, unit)),
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
  const env = { ...sim.envOf(identity), WORKFLOWS_GATE_SURFACE: '1' };
  auditGate(engine.run(['render', ...args], { cwd: sim.dir, env }).stdout, `render ${args.join(' ')} — gate payload`);
}

module.exports = {
  auditState, auditGatePayload, specDetail, shellWords,
};
