'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the checklists (6.4) — one per closing point, held by the
// engine and worked by `checklist show|done|skip|close`. The six points sit
// in one table (`POINTS`), each item's key kept for good and its text the
// spec's words, as a gate shows them to the person:
// - decided, a topic's close (6.4.6), on the unit's manifest under
//   `checklists.decided.{topic}`;
// - ready to build (6.4.7), `checklists.ready-to-build`;
// - a phase's start and its close (6.4.8, 6.4.9), for a phase the unit's
//   cut holds, `checklists.phase-{N}-start` and `checklists.phase-{N}-close`;
// - finish (6.4.10), `checklists.finish`;
// - a directive (6.4.11), on the project manifest under
//   `checklists.directive.{id}`, its id the directive's file's name.
//
// A record is `{items: {key: {state: 'done'|'skipped', reason?, at}},
// closed?: at}` (6.4.12): Claude's marks alone, each skip with its reason,
// and the close. Ready to build's also keeps what the spec and the cut held
// as it closed. Decided's keeps `ledger_at`, the ledger's last line
// as it closed; `voided?: at`, when a message was delivered to the topic
// since (mail.cjs); and `taken?: at`, when the decided gate's yes took its
// close (decided.cjs). What the engine checks is worked out at every call and
// never kept (6.4.3), so it never goes stale: the person's questions open on
// the topic's map (the ledger's fold); mail waiting in the topic's
// `topics/{topic}/mail/`; the unit's topics settled, one live at least and
// every live one decided (spec-standing.cjs); the sweep between topics run,
// its report taken and the record of it committed (sweep.cjs); each phase
// of the cut naming its scenarios and its sections, what it relies on maybe nothing; every
// statement and screen of `spec.md` traced to the ledger (spec-trace.cjs), a
// spec its grammar cannot read failing it; every part of `spec.md` drawn on
// by a phase, directly or through its area, an area with no parts whole;
// the review's last pass reported on `spec.md`'s print as it stands, no pass
// in flight, no gap it found waiting on the person and nothing it left
// waiting, for the writer or to be surfaced (spec-passes.cjs); every file the
// unit's current entries link as canonical linked from `spec.md` (11.6.3,
// log-links.cjs); a build phase's, every item of its start and close but
// the shared design settled (phase-checks.cjs) — its tasks written, what it
// relies on done, its tasks passed, its phase review passed with its fixes
// landed, its scenarios proven or reported, its notes consolidated and its
// stack merged; finish's, the review phase over, no question waiting on
// the person and the unit's records indexed (finish-checks.cjs); and a
// directive's check passing
// (directives.cjs). What a
// call reads for them is read once (`reads`). Whether every engine item of
// a checklist holds is read beside the verbs too, as the build's stop
// asks it of a phase's start (`engineItemsHold`). An open engine item may name
// its way on: the phase review's, what stands in the way of it, its
// settlement among them (phase-settlement.cjs). Phase 1's close is refused
// beyond its items until the verify setup is recorded (12.3.3). A phase's
// close commits, beside the manifest, every record its folder holds — the
// reports its items read, its consolidation report, its settlement
// (round-report.cjs, `phaseRecords`) — so a second clone reads
// the phase as this one did.
// An item applies only where the unit has its step: the sweep between
// topics where it has more than one live topic; the review passed where it
// has a review phase; the records indexed where the checkout's knowledge
// base is set up. No phase starts before
// ready to build's yes begins the build (11.8.3), so a phase's start has no
// checklist until then.
//
// A mark counts only once made after the record's last close, so a point
// closed again — a decided topic a message set back in progress (10.2.7,
// mail.cjs) — is worked afresh. The decided gate stands on a close nothing
// new has come to since (`decidedClose`): a message delivered to the topic
// or a question opened on it — asked there, or moved to it — after the
// close voids it, as the yes taking it does, so the topic is worked afresh
// and closed again before its gate shows again, every engine item holding
// still. A decision changed since voids nothing. Ready to build stands on
// the landed spec alone (spec-landed.cjs): its close is refused while
// `spec.md` holds changes that have not landed, and keeps `spec_hash` and
// `cut_hash`, what the landed spec and the cut held as it closed; its gate
// stands on a close neither has changed since (`readyClose`): a land or a
// cut after it voids it (E12), and so does any engine item failing now, so
// the checklist is worked afresh and closed again before the gate shows
// again. A skip shows on the screen
// of the next authority gate over its work (6.4.5): decided's, ready to
// build's and finish's each their own, and finish's every phase start's and
// close's too, as each record keeps them. An engine item is never marked or
// skipped, so a directive's check must pass (6.4.5); the directive's close
// records the directive in the migrations record, the one way it is
// recorded.
//
// `show` reads and takes no lock. `done`, `skip` and `close` write under the
// writer lock (engine.cjs) and commit the manifest they wrote alone, pushed;
// `close` refuses while any item is open (6.4.4).
// ---------------------------------------------------------------------------

const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, readProjectManifest, writeProjectManifestAtomic, withProjectLock } = require('../kernel/manifest.cjs');
const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { hasTopic, manifestOf, liveness, liveTopics } = require('./ledger-units.cjs');
const { ID_FACTS, foldLedger, mapOf } = require('./ledger-fold.cjs');
const { SPEC_FILE, readSpec, specSections, specStatements } = require('./spec-sections.cjs');
const { topicsSettled } = require('./spec-standing.cjs');
const { inventedLines } = require('./spec-trace.cjs');
const { readLandedSpec } = require('./spec-landed.cjs');
const { sweepTaken, candidatesWaiting } = require('./sweep.cjs');
const { reviewSettled, cutRequests } = require('./spec-passes.cjs');
const { mailboxDepth, buildBegun, phaseKey, cutPhases, cutLength } = require('./derivations.cjs');
const checks = require('./phase-checks.cjs');
const finishChecks = require('./finish-checks.cjs');
const { phaseRecords } = require('./round-report.cjs');
const { cutHolds } = require('./cut.cjs');
const { canonicalAssets } = require('./ledger-read.cjs');
const { logLinks } = require('./log-links.cjs');
const { directiveOf, checkDirective, recordDirective } = require('./directives.cjs');
const { commitStateTail, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { fingerprint } = require('../kernel/fingerprint.cjs');
const { REVIEWERS } = require('../kernel/reviewers.cjs');

/** @typedef {import('./phase-checks.cjs').Reading} PhaseReading */
/** @typedef {{state: 'done'|'skipped', reason?: string, at: string}} Mark */
/** @typedef {{items: Record<string, Mark>, closed?: string, ledger_at?: number, voided?: string, taken?: string, spec_hash?: string, cut_hash?: string}} Checklist */

/**
 * A checklist named: its point; where its record sits under the manifest's
 * `checklists`; the work it closes; that work's manifest as read, the
 * unit's or, for a directive, the project's; and what the call has read for
 * its checks, kept for its others (phase-checks.cjs).
 * @typedef {{
 *   point: string, path: string[], cwd: string,
 *   unit: string|null, topic: string|null, phase: number|null,
 *   manifest: Record<string, any>, warnings: string[], reads: Map<string, any>,
 * }} Named
 */

/**
 * An item of a point: its key and text; how the engine checks it, where it
 * does, and the way on it names while open, where it names one; and where
 * it applies, where not everywhere.
 * @typedef {{key: string, text: string, check?: (named: Named) => boolean, way?: (named: Named) => string, applies?: (named: Named) => boolean}} Item
 */

/** @typedef {{checklist: string, item: string, text: string, reason: string, at: string}} Skip */

/** Where a checklist sits, named by what follows its point. @typedef {Omit<Named, 'point'|'cwd'|'warnings'|'reads'>} Place */

/**
 * A point: what names its checklist after the point, and where that places
 * it; its items; the skips its gate shows, given its own; what its close
 * keeps beside the time, where it keeps more; why its close is refused
 * beyond its items, where it can be; what its close commits beside the
 * manifest, where it commits more; and what its close does beyond
 * recording itself, where it does more.
 * @typedef {{
 *   takes: string[],
 *   place: (cwd: string, args: string[]) => Place,
 *   items: Item[],
 *   shows: (named: Named, own: Skip[]) => Skip[],
 *   seals?: (named: Named) => Record<string, unknown>,
 *   refuses?: (named: Named) => string|null,
 *   commits?: (named: Named) => string[],
 *   closes?: (named: Named) => void,
 * }} Point
 */

/** A checklist's record on a manifest, where it has one. @param {Record<string, any>} manifest @param {string[]} path @returns {Checklist|undefined} */
const recordAt = (manifest, path) => path.reduce((node, key) => node?.[key], manifest.checklists);

/** No question of the person's open on the topic's map (5.8.5, 9.5.3). @param {Named} named */
function questionsClosed({ cwd, unit, topic, warnings }) {
  const root = stateRoot(cwd);
  const folded = { facts: foldLedger(root, ID_FACTS, warnings), live: liveness(root) };
  return mapOf(folded, /** @type {string} */ (unit), /** @type {string} */ (topic)).every((row) => row.stands !== 'open');
}

/**
 * The ledger's last line, and whether a line past `after` opened a question
 * on the topic: one asked there, or moved to it.
 * @param {string} root @param {string} unit @param {string} topic @param {number} after @param {string[]} warnings
 * @returns {{last: number, opened: boolean}}
 */
function ledgerPast(root, unit, topic, after, warnings) {
  return foldLedger(root, {
    start: () => /** @type {{last: number, opened: boolean}} */ ({ last: 0, opened: false }),
    step: (state, event, place) => {
      state.last = place.number;
      const opens = event.unit === unit && ((event.event === 'asked' && event.topic === topic) || (event.event === 'moved' && event.to === topic));
      if (opens && place.number > after) state.opened = true;
    },
  }, warnings);
}

/** No message waiting in the topic's mail (10.2.7). @param {Named} named */
function mailboxEmpty({ cwd, unit, topic }) {
  return mailboxDepth(stateRoot(cwd), /** @type {string} */ (unit), /** @type {string} */ (topic)) === 0;
}

/** The unit's topics settled, as its spec's entry reads them (11.2.1). @param {Named} named */
const settled = ({ manifest }) => topicsSettled(manifest);

/**
 * The sweep between topics run: its report taken, one sweep for the spec
 * (8.10.3), and none of its candidates waiting on approve the map (8.10.9).
 * @param {Named} named
 */
const sweepRun = ({ cwd, unit, manifest }) => sweepTaken(cwd, /** @type {string} */ (unit)) && candidatesWaiting(cwd, manifest).length === 0;

/**
 * Each phase of the cut names a scenario and a section, what it relies on
 * maybe nothing (11.5.4); the cut holds against the spec as it stands, as
 * `cut` checks it (11.5.9); and no decision made at the spec since the
 * cut's brief waits for it (spec-passes.cjs).
 * @param {Named} named
 */
function phasesComplete({ cwd, unit, manifest, warnings }) {
  const phases = cutPhases(manifest);
  const at = /** @type {string} */ (unit);
  return phases.length > 0 && phases.every(({ scenarios, sections }) => scenarios.length > 0 && sections.length > 0) && cutHolds(cwd, at, phases)
    && cutRequests(cwd, at, warnings).length === 0;
}

/** Every part of the spec drawn on by a phase of the cut, directly or through its area; an area with no parts, whole. @param {Named} named */
function sectionsDrawn({ cwd, unit, manifest }) {
  const phases = cutPhases(manifest);
  if (phases.length === 0) return false;
  const drawn = new Set(phases.flatMap(({ sections }) => sections));
  const addresses = [...specSections(readSpec(cwd, /** @type {string} */ (unit))).keys()];
  return addresses
    .filter((address) => !addresses.some((part) => part.startsWith(`${address}.`)))
    .every((address) => drawn.has(address) || drawn.has(address.split('.')[0]));
}

/**
 * Every statement and screen of the unit's spec traced to the ledger
 * (11.4.1); a spec the grammar cannot read, or none, fails it (11.4.5).
 * @param {Named} named
 */
function statementsTraced({ cwd, unit, warnings }) {
  let lines;
  try {
    lines = specStatements(readSpec(cwd, /** @type {string} */ (unit)));
  } catch {
    return false;
  }
  return inventedLines(cwd, /** @type {string} */ (unit), lines, warnings).length === 0;
}

/** The review's last pass changed nothing (11.7.6): as spec-passes.cjs settles it. @param {Named} named */
const reviewed = ({ cwd, unit, warnings }) => reviewSettled(cwd, /** @type {string} */ (unit), warnings);

/** Every file or folder the unit's current entries link as canonical linked from its spec, a folder by a link to it or to what it holds (11.6.3). @param {Named} named */
function assetsLinked({ cwd, unit, warnings }) {
  const root = stateRoot(cwd);
  const links = logLinks(root, [`${unit}/${SPEC_FILE}`]);
  return canonicalAssets(root, /** @type {string} */ (unit), warnings).every((asset) => links.some((link) => link === asset || link.startsWith(`${asset}/`)));
}

/** What `landed`, the unit's landed spec, and its cut hold, as ready to build's close keeps them. @param {string} landed @param {Record<string, any>} manifest */
const sealOf = (landed, manifest) => ({ spec_hash: fingerprint(landed), cut_hash: fingerprint(JSON.stringify(manifest.cut ?? null)) });

/** What the unit's landed spec and its cut hold now, as ready to build's close keeps them, refused while the spec on disk is not the landed one. @param {string} cwd @param {string} unit @param {Record<string, any>} manifest */
const specAndCut = (cwd, unit, manifest) => sealOf(readLandedSpec(cwd, unit), manifest);

/**
 * A check of the phase a checklist closes, as phase-checks.cjs makes it,
 * reading the unit as the call has read it.
 * @template T @param {(at: PhaseReading, phase: number) => T} check @returns {(named: Named) => T}
 */
const ofPhase = (check) => (named) => check(/** @type {PhaseReading} */ (named), /** @type {number} */ (named.phase));

/** A check of the unit a checklist closes, reading it as the call has read it. @template T @param {(at: PhaseReading) => T} check @returns {(named: Named) => T} */
const ofUnit = (check) => (named) => check(/** @type {PhaseReading} */ (named));

/** What stands between the phase and its review passed, each fault saying its way on. @param {Named} named */
const reviewFaults = (named) => checks.phaseReviewFaults(/** @type {PhaseReading} */ (named), /** @type {number} */ (named.phase));

/** The directive's check passes. @param {Named} named */
const directivePasses = ({ cwd, path }) => checkDirective(cwd, path[1]).passed;

/** The unit has more than one live topic. @param {Named} named */
const moreThanOneTopic = ({ unit, manifest }) => liveTopics(/** @type {string} */ (unit), manifest).length > 1;

/** A work unit's manifest, refused where the project has no such unit. @param {string} cwd @param {string} unit */
function unitManifest(cwd, unit) {
  const manifest = workUnitNameRefusal(unit) === null ? manifestOf(stateRoot(cwd), unit) : null;
  if (manifest === null) throw new Error(`there is no work unit "${unit}"`);
  return manifest;
}

/**
 * A unit's checklist, placed by `where` from the unit's manifest and what
 * follows the unit's name.
 * @param {(manifest: Record<string, any>, given: string, unit: string) => {path: string[], topic?: string, phase?: number}} where
 * @returns {Point['place']}
 */
const onUnit = (where) => (cwd, [unit, given]) => {
  const manifest = unitManifest(cwd, unit);
  return { unit, topic: null, phase: null, manifest, ...where(manifest, given, unit) };
};

/** A phase's start or close, refused where the cut has no phase of that number. @param {'start'|'close'} end */
const onPhase = (end) => onUnit((manifest, given, unit) => {
  const phases = cutLength(manifest);
  if (phases === 0) throw new Error(`${unit} has no cut — its phases come from engine cut`);
  if (!/^[1-9][0-9]*$/.test(given) || Number(given) > phases) throw new Error(`${unit}'s cut has no phase ${given} — its phases are 1 to ${phases}`);
  const phase = Number(given);
  if (end === 'start' && !buildBegun(manifest)) throw new Error(`${unit}'s build has not begun, so no phase starts — ready to build's yes begins it: render ready-to-build ${unit}`);
  return { path: [phaseKey(phase, end)], phase };
});

/** The skips a gate shows of its own checklist alone. @type {Point['shows']} */
const ownSkips = (_, own) => own;

/** A gate that shows no skips. @type {Point['shows']} */
const noSkips = () => [];

/** @type {Readonly<Record<string, Point>>} */
const POINTS = Object.freeze({
  decided: {
    takes: ['<work-unit>', '<topic>'],
    place: onUnit((manifest, topic, unit) => {
      if (!hasTopic(manifest, topic)) throw new Error(`${unit} has no topic "${topic}"`);
      return { path: ['decided', topic], topic };
    }),
    items: [
      { key: 'questions-closed', text: 'every question of the person\'s closed', check: questionsClosed },
      { key: 'closing-pass', text: 'the closing pass run, and its last re-read changing nothing' },
      { key: 'decisions-entered', text: 'every decision in the conversation has an entry' },
      { key: 'replacements-checked', text: 'each replacement checked against what it replaced' },
      { key: 'conflicts-read', text: 'the read for conflicting answers run within the topic' },
      { key: 'findings-rerun', text: 'each measured finding the topic\'s decisions rest on re-run' },
      { key: 'mailbox-empty', text: 'the topic\'s mailbox empty: every message raised and answered', check: mailboxEmpty },
      { key: 'product-lines-shown', text: 'the product-record lines and any candidates written for the decided screen' },
    ],
    shows: ownSkips,
    seals: ({ cwd, unit, topic, warnings }) => ({ ledger_at: ledgerPast(stateRoot(cwd), /** @type {string} */ (unit), /** @type {string} */ (topic), Infinity, warnings).last }),
  },
  'ready-to-build': {
    takes: ['<work-unit>'],
    place: onUnit(() => ({ path: ['ready-to-build'] })),
    items: [
      { key: 'topics-settled', text: 'every topic decided, cancelled or postponed, a feature\'s one topic being decided by this same screen', check: settled },
      { key: 'sweep-run', text: 'the sweep between topics run, where the unit has more than one topic', check: sweepRun, applies: moreThanOneTopic },
      { key: 'replacements-checked', text: 'the spec has checked each replacement against what it replaced' },
      { key: 'statements-traced', text: 'every statement traced', check: statementsTraced },
      { key: 'review-settled', text: 'the review\'s last pass changed nothing', check: reviewed },
      { key: 'phases-complete', text: 'each phase in the cut has its scenarios, sections and relies-on', check: phasesComplete },
      { key: 'invariants-checked', text: 'every invariant names a check or says none can' },
      { key: 'sections-drawn', text: 'every section of the spec drawn on by at least one phase in the cut', check: sectionsDrawn },
      { key: 'assets-linked', text: 'canonical assets linked from spec.md — one gone or no longer needed set to reference: asset status <work-unit> <path> reference', check: assetsLinked },
    ],
    shows: ownSkips,
    seals: ({ cwd, unit, manifest }) => specAndCut(cwd, /** @type {string} */ (unit), manifest),
  },
  'phase-start': {
    takes: ['<work-unit>', '<N>'],
    place: onPhase('start'),
    items: [
      { key: 'tasks-written', text: 'tasks written with their links', check: ofPhase(checks.tasksWritten) },
      { key: 'design-settled', text: 'shared design settled' },
      { key: 'relies-on-done', text: 'what the phase relies on is done: closed, and its stack merged', check: ofPhase(checks.reliedOnDone) },
    ],
    shows: noSkips,
  },
  'phase-close': {
    takes: ['<work-unit>', '<N>'],
    place: onPhase('close'),
    items: [
      { key: 'tasks-passed', text: `every task passed each of its ${REVIEWERS} reviewers`, check: ofPhase(checks.tasksPassed) },
      {
        key: 'phase-review-passed', text: 'the phase review passed and its fixes landed', check: (named) => reviewFaults(named).length === 0, way: (named) => reviewFaults(named).join('; '),
      },
      {
        key: 'scenarios-reported', text: 'each scenario proven or reported not proven', check: ofPhase(checks.scenariosReported), way: ofPhase(checks.scenariosWay),
      },
      { key: 'notes-consolidated', text: 'the notes for later read by the consolidation agent, then made into tasks or dropped with a reason', check: ofPhase(checks.notesConsolidated) },
      { key: 'stack-merged', text: 'the stack merged, or waiting at its gate in step', check: ofPhase(checks.stackMerged) },
    ],
    shows: noSkips,
    refuses: (named) => checks.closeRefusal(/** @type {PhaseReading} */ (named), /** @type {number} */ (named.phase)),
    commits: ({ cwd, unit, phase }) => phaseRecords(cwd, /** @type {string} */ (unit), /** @type {number} */ (phase)),
  },
  finish: {
    takes: ['<work-unit>'],
    place: onUnit(() => ({ path: ['finish'] })),
    items: [
      {
        key: 'review-passed',
        text: 'the review phase passed and its report is written, where the unit has a review phase (a quick-fix\'s only when the person asks)',
        check: ofUnit(finishChecks.reviewPassed),
        way: ofUnit(finishChecks.reviewWay),
        applies: ofUnit(finishChecks.hasReviewPhase),
      },
      {
        key: 'questions-answered', text: 'no question waiting on the person', check: ofUnit(finishChecks.questionsAnswered), way: ofUnit(finishChecks.questionsWay),
      },
      { key: 'inbox-closed', text: 'resolved inbox items closed' },
      { key: 'build-log-closed', text: 'the build log closed' },
      {
        key: 'records-indexed', text: 'the records indexed', check: ofUnit(finishChecks.recordsIndexed), way: ofUnit(finishChecks.recordsWay), applies: ofUnit(finishChecks.knowledgeSetUp),
      },
    ],
    shows: (named, own) => [...phaseSkips(named.manifest), ...own],
  },
  directive: {
    takes: ['<id>'],
    place: (cwd, [id]) => {
      directiveOf(id);
      return { unit: null, topic: null, phase: null, path: ['directive', id], manifest: readProjectManifest(cwd) };
    },
    items: [{ key: 'check', text: 'its check', check: directivePasses }],
    shows: noSkips,
    closes: ({ cwd, path }) => recordDirective(cwd, directiveOf(path[1])),
  },
});

/** A checklist's name as its record's path reads. @param {Named} named */
const nameOf = ({ path }) => path.join('.');

/** The items of a named checklist that apply to its work. @param {Named} named */
const itemsOf = (named) => POINTS[named.point].items.filter((item) => item.applies === undefined || item.applies(named));

/**
 * Where each item of a named checklist stands: the engine's as it checks
 * them now, an open one with the way on it names, and Claude's by the marks
 * made since the last close.
 * @param {Named} named
 * @returns {Array<{key: string, text: string, by: 'engine'|'claude', state: 'done'|'skipped'|'open', reason?: string, at?: string, way?: string}>}
 */
function itemStates(named) {
  const record = recordAt(named.manifest, named.path);
  return itemsOf(named).map(({ key, text, check, way }) => {
    if (check !== undefined) {
      if (check(named)) return { key, text, by: 'engine', state: 'done' };
      return { key, text, by: 'engine', state: 'open', ...(way === undefined ? {} : { way: way(named) }) };
    }
    const mark = record?.items[key];
    if (mark === undefined || (record?.closed !== undefined && mark.at <= record.closed)) return { key, text, by: 'claude', state: 'open' };
    return { key, text, by: 'claude', ...mark };
  });
}

/** An item skipped, as a gate shows it. @param {string} checklist @param {{key: string, text: string}} item @param {{reason?: string, at?: string}} mark @returns {Skip} */
const skipOf = (checklist, { key, text }, { reason, at }) => ({ checklist, item: key, text, reason: /** @type {string} */ (reason), at: /** @type {string} */ (at) });

/** Every phase start's and close's skips, as their records keep them, in the cut's order. @param {Record<string, any>} manifest @returns {Skip[]} */
function phaseSkips(manifest) {
  return cutPhases(manifest).flatMap((_, at) => /** @type {const} */ (['start', 'close']).flatMap((end) => {
    const checklist = phaseKey(at + 1, end);
    const record = recordAt(manifest, [checklist]);
    return POINTS[`phase-${end}`].items.flatMap((item) => {
      const mark = record?.items[item.key];
      return mark?.state === 'skipped' ? [skipOf(checklist, item, mark)] : [];
    });
  }));
}

const CHECKLISTS = Object.entries(POINTS).map(([point, { takes }]) => [point, ...takes].join(' ')).join(' | ');

const CHECKLIST_USAGE = [
  'checklist show <checklist>',
  'checklist done <checklist> <item>',
  'checklist skip <checklist> <item> --reason "<text>"',
  'checklist close <checklist>',
  `  <checklist>: ${CHECKLISTS}`,
].join('\n');

/** What each verb takes after its checklist: an item or none, and its flags, joined. */
const VERBS = /** @type {Readonly<Record<string, {item: boolean, flags: string}>>} */ (Object.freeze({
  show: { item: false, flags: '' },
  done: { item: true, flags: '' },
  skip: { item: true, flags: 'reason' },
  close: { item: false, flags: '' },
}));

/** @returns {never} */
function usage() {
  const lines = CHECKLIST_USAGE.split('\n').map((line) => line.trim());
  throw new Error(`Usage: ${lines.map((line) => (line.startsWith('checklist ') ? `engine ${line}` : line)).join(' | ')}`);
}

/**
 * Whether every item the engine checks of the checklist `args` name after
 * its point holds, so only Claude's own items stand before its close —
 * refused as `checklist show` refuses it; its checks read first what the
 * call has read already, `reads`, where given.
 * @param {string} cwd @param {string} point @param {string[]} args @param {Map<string, any>} [reads]
 */
function engineItemsHold(cwd, point, args, reads = new Map()) {
  return itemStates(named(cwd, point, args, reads)).every(({ by, state }) => by !== 'engine' || state === 'done');
}

/**
 * The checklist `args` name after its point, its work's manifest read.
 * Refuses a point it does not know, a unit, topic or phase the project
 * lacks, and a directive the migrations lack. Its checks keep what they
 * read in `reads`.
 * @param {string} cwd @param {string} point @param {string[]} args @param {Map<string, any>} [reads]
 * @returns {Named}
 */
function named(cwd, point, args, reads = new Map()) {
  if (!Object.hasOwn(POINTS, point) || args.length !== POINTS[point].takes.length) usage();
  return { point, cwd, warnings: [], reads, ...POINTS[point].place(cwd, args) };
}

/**
 * Change a named checklist's record, its work's manifest read again and
 * saved under that manifest's lock — the change seeing the checklist as
 * read there, and throwing to write nothing — then commit the manifest,
 * with the files given beside it. Answers the commit's outcome on `result`.
 * @param {Named} checklist @param {string} done what the commit message says was done
 * @param {(record: Checklist, fresh: Named) => void} change
 * @param {Record<string, unknown>} result @param {string[]} [beside] state-relative
 */
function changeRecord(checklist, done, change, result, beside = []) {
  const { cwd, unit, path } = checklist;
  const write = (/** @type {Record<string, any>} */ manifest) => {
    const parent = path.slice(0, -1).reduce((node, key) => (node[key] ??= {}), manifest.checklists ??= {});
    change(parent[path[path.length - 1]] ??= { items: {} }, { ...checklist, manifest });
    return manifest;
  };
  if (unit === null) {
    withProjectLock(cwd, () => writeProjectManifestAtomic(cwd, write(readProjectManifest(cwd))));
  } else {
    withWorkUnitLock(cwd, unit, () => saveWorkUnitManifest(cwd, unit, write(loadWorkUnitManifest(cwd, unit))));
  }
  const { warnings } = checklist;
  const scope = unit === null ? 'checklist' : `checklist(${unit})`;
  const outcome = commitStateTail(cwd, [unit === null ? PROJECT_MANIFEST_SPEC : `${unit}/manifest.json`, ...beside], `${scope}: ${nameOf(checklist)} ${done}`, warnings);
  result.committed = outcome.committed;
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome, unit === null ? undefined : `${unit} --state`);
  return result;
}

/** The checklist's own fields of an answer: its unit, where it has one, and its name. @param {Named} checklist */
const answering = (checklist) => ({ ...(checklist.unit === null ? {} : { unit: checklist.unit }), checklist: nameOf(checklist) });

/**
 * `checklist show`: each item done, skipped or open, and who checks it; the
 * checklist's close, null where it was never closed; and the skips its gate
 * shows.
 * @param {Named} checklist
 */
function show(checklist) {
  const items = itemStates(checklist);
  const own = items.filter((item) => item.state === 'skipped').map((item) => skipOf(nameOf(checklist), item, item));
  const answer = {
    ...answering(checklist),
    closed: recordAt(checklist.manifest, checklist.path)?.closed ?? null,
    items,
    skips: POINTS[checklist.point].shows(checklist, own),
  };
  return checklist.warnings.length > 0 ? { ...answer, warnings: checklist.warnings } : answer;
}

/**
 * Claude's mark of an item: done, or skipped with its reason. Refuses an
 * item the checklist lacks, and one the engine checks.
 * @param {Named} checklist @param {string} key @param {Mark['state']} state @param {string} [reason]
 */
function mark(checklist, key, state, reason) {
  const items = itemsOf(checklist);
  const item = items.find((candidate) => candidate.key === key);
  if (item === undefined) throw new Error(`${nameOf(checklist)} has no item "${key}" — its items are ${items.map((each) => each.key).join(', ')}`);
  if (item.check !== undefined) throw new Error(`${key} is the engine's to check, never marked — it reads done once it holds`);
  const at = new Date().toISOString();
  /** @type {Mark} */
  const made = state === 'done' ? { state, at } : { state, reason: /** @type {string} */ (reason), at };
  return changeRecord(checklist, `${key} ${state}`, (record) => { record.items[key] = made; }, { ...answering(checklist), item: key, ...made });
}

/**
 * Record the checklist's close, refused where what its point keeps cannot be
 * read, then while any item is open (6.4.4), then as its point refuses it
 * beyond them, committing what its point's close commits beside the
 * manifest; then do what its point's close does beyond.
 * @param {Named} checklist
 */
function close(checklist) {
  const at = new Date().toISOString();
  const answer = changeRecord(checklist, 'closed', (record, fresh) => {
    const sealed = POINTS[checklist.point].seals?.(fresh);
    const open = itemStates(fresh).filter((item) => item.state === 'open').map((item) => item.key);
    if (open.length > 0) throw new Error(`${nameOf(checklist)} has items open: ${open.join(', ')}`);
    const refused = POINTS[checklist.point].refuses?.(fresh) ?? null;
    if (refused !== null) throw new Error(refused);
    record.closed = at;
    Object.assign(record, sealed);
  }, { ...answering(checklist), closed: at }, POINTS[checklist.point].commits?.(checklist));
  POINTS[checklist.point].closes?.(checklist);
  return answer;
}

/**
 * `checklist <show|done|skip|close> <checklist> …`: the verb's answer.
 * Refuses arguments of another shape with the usage, and every refusal of
 * the checklist named or its item, opening `checklist {verb}: `.
 * @param {string} cwd @param {string|undefined} verb @param {string[]} positional @param {Record<string, string>} opts
 * @returns {Record<string, unknown>}
 */
function runChecklistVerb(cwd, verb, positional, opts) {
  const takes = verb !== undefined && Object.hasOwn(VERBS, verb) ? VERBS[verb] : null;
  if (takes === null || Object.keys(opts).join() !== takes.flags) usage();
  const [point, ...args] = takes.item ? positional.slice(0, -1) : positional;
  const key = positional[positional.length - 1];
  try {
    const checklist = named(cwd, point, args);
    if (verb === 'show') return show(checklist);
    if (verb === 'close') return close(checklist);
    if (verb === 'done') return mark(checklist, key, 'done');
    if ((opts.reason ?? '').trim() === '') throw new Error('a skip records its reason — --reason "<text>"');
    return mark(checklist, key, 'skipped', opts.reason);
  } catch (err) {
    const message = messageOf(err);
    throw new Error(message.startsWith('Usage: ') ? message : `checklist ${verb}: ${message}`);
  }
}

/**
 * The close the decided gate stands on (9.7.3, 10.2.7): the record's close,
 * and the skips it shows (6.4.5), each marked before it. Refused while the
 * checklist is open: closed never; its close taken by the gate's yes
 * already, the topic set back in progress since; a message delivered to the
 * topic, or a question opened on it, since the close — each worked afresh
 * and closed again; or an item the engine checks failing now, as mail
 * waiting fails the mailbox's.
 * @param {string} cwd @param {string} unit @param {string} topic
 * @returns {{closed: string, skips: Skip[], warnings: string[]}}
 */
function decidedClose(cwd, unit, topic) {
  const checklist = named(cwd, 'decided', [unit, topic]);
  const name = nameOf(checklist);
  const record = recordAt(checklist.manifest, checklist.path);
  const closedAt = record?.closed;
  if (record === undefined || closedAt === undefined) throw new Error(`${name} is open — its items are worked, then it is closed: checklist close decided ${unit} ${topic}`);
  if (record.taken !== undefined && record.taken >= closedAt) {
    throw new Error(`${name}'s close was taken by the decided gate's yes, and the topic was set back in progress since — its items are worked afresh and it is closed again`);
  }
  if (record.voided !== undefined && record.voided >= closedAt) {
    throw new Error(`${name} was closed before a message delivered to ${topic} — its items are worked afresh and it is closed again`);
  }
  if (ledgerPast(stateRoot(cwd), unit, topic, /** @type {number} */ (record.ledger_at), checklist.warnings).opened) {
    throw new Error(`${name} was closed before a question opened on ${topic} — its items are worked afresh and it is closed again`);
  }
  return standingClose(checklist, record, closedAt);
}

/**
 * The close ready to build's gate stands on (E12): the record's close, the
 * skips it shows (6.4.5), each marked before it, and the landed spec it
 * seals. Refused while `spec.md` holds changes that have not landed, and
 * while the checklist is open: closed never; the landed spec or the cut
 * changed since the close — a land or a cut after it — each worked afresh
 * and closed again; or an item the engine checks failing now.
 * @param {string} cwd @param {string} unit
 * @returns {{closed: string, skips: Skip[], warnings: string[], landed: string}}
 */
function readyClose(cwd, unit) {
  const checklist = named(cwd, 'ready-to-build', [unit]);
  const name = nameOf(checklist);
  const record = recordAt(checklist.manifest, checklist.path);
  const landed = readLandedSpec(cwd, unit);
  const now = sealOf(landed, checklist.manifest);
  const closedAt = record?.closed;
  if (record === undefined || closedAt === undefined) throw new Error(`${name} is open — its items are worked, then it is closed: checklist close ready-to-build ${unit}`);
  if (record.spec_hash !== now.spec_hash) throw new Error(`${name} was closed before ${unit}'s spec changed — a land after the close voids it, so its items are worked afresh and it is closed again`);
  if (record.cut_hash !== now.cut_hash) throw new Error(`${name} was closed before ${unit}'s spec was cut again — a cut after the close voids it, so its items are worked afresh and it is closed again`);
  return { ...standingClose(checklist, record, closedAt), landed };
}

/**
 * The close finish's gate stands on (14.5.1): the record's close, and the
 * skips it shows (6.4.5) — every phase start's and close's, as their records
 * keep them, then its own marked before it. Refused while the checklist is
 * open: closed never, or an item the engine checks failing now.
 * @param {string} cwd @param {string} unit
 * @returns {{closed: string, skips: Skip[], warnings: string[]}}
 */
function finishClose(cwd, unit) {
  const checklist = named(cwd, 'finish', [unit]);
  const record = recordAt(checklist.manifest, checklist.path);
  const closedAt = record?.closed;
  if (record === undefined || closedAt === undefined) throw new Error(`finish is open — its items are worked, then it is closed: checklist close finish ${unit}`);
  const standing = standingClose(checklist, record, closedAt);
  return { ...standing, skips: [...phaseSkips(checklist.manifest), ...standing.skips] };
}

/**
 * A close standing as its gate shows it: refused while an item the engine
 * checks fails now; else the close and the skips marked before it.
 * @param {Named} checklist @param {Checklist} record @param {string} closedAt
 * @returns {{closed: string, skips: Skip[], warnings: string[]}}
 */
function standingClose(checklist, record, closedAt) {
  const name = nameOf(checklist);
  const items = itemsOf(checklist);
  const failing = items.filter((item) => item.check !== undefined && !item.check(checklist)).map((item) => item.key);
  if (failing.length > 0) throw new Error(`${name} has items open since its close: ${failing.join(', ')} — they are worked, and it is closed again`);
  const skips = items.flatMap((item) => {
    const made = record.items[item.key];
    return made?.state === 'skipped' && made.at <= closedAt ? [skipOf(name, item, made)] : [];
  });
  return { closed: closedAt, skips, warnings: checklist.warnings };
}

/**
 * Record on the unit's manifest, as it is saved, that a message delivered
 * to the topic now voids its decided close, where it has one standing:
 * whether it did.
 * @param {Record<string, any>} manifest @param {string} topic @param {string} at
 */
function voidDecidedClose(manifest, topic, at) {
  const record = recordAt(manifest, ['decided', topic]);
  if (record?.closed === undefined) return false;
  record.voided = at;
  return true;
}

/**
 * Record on the unit's manifest, as it is saved, that the decided gate's
 * yes took the topic's close.
 * @param {Record<string, any>} manifest @param {string} topic @param {string} at
 */
function takeDecidedClose(manifest, topic, at) {
  /** @type {Checklist} */ (recordAt(manifest, ['decided', topic])).taken = at;
}

module.exports = { CHECKLIST_USAGE, runChecklistVerb, engineItemsHold, decidedClose, readyClose, finishClose, takeDecidedClose, voidDecidedClose };
