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
// and the close; decided's also `taken?: at`, when the decided gate's yes
// took its close (decided.cjs). What the engine checks is worked out at every call and
// never kept (6.4.3), so it never goes stale: the person's questions open on
// the topic's map (the ledger's fold); mail waiting in the topic's
// `topics/{topic}/mail/`; each phase of the cut naming its scenarios and
// its sections, what it relies on maybe nothing; every part of `spec.md`
// drawn on by a phase, directly or through its area, an area with no parts
// whole; what a phase relies on done — an earlier phase's close recorded,
// another unit completed; and a directive's check passing (directives.cjs).
// An item applies only where the unit has its step: the sweep between
// topics where it has more than one live topic.
//
// A mark counts only once made after the record's last close, so a point
// closed again — a decided topic a message set back in progress (10.2.7,
// mail.cjs) — is worked afresh. The decided gate stands on a close its yes
// has not taken (`decidedClose`): a topic reopened after its yes shows its
// gate again only once closed again, every engine item holding still. A skip shows on the screen of the next
// authority gate over its work (6.4.5): decided's, ready to build's and
// finish's each their own, and finish's every phase start's and close's too,
// as each record keeps them. An engine item is never marked or skipped, so
// a directive's check must pass (6.4.5); the directive's close records the
// directive in the migrations record, the one way it is recorded.
//
// `show` reads and takes no lock. `done`, `skip` and `close` write under the
// writer lock (engine.cjs) and commit the manifest they wrote alone, pushed;
// `close` refuses while any item is open (6.4.4).
// ---------------------------------------------------------------------------

const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, readProjectManifest, writeProjectManifestAtomic, withProjectLock } = require('../kernel/manifest.cjs');
const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { hasTopic, manifestOf, liveness, finishedUnits, liveTopics } = require('./ledger-units.cjs');
const { ID_FACTS, foldLedger, mapOf } = require('./ledger-fold.cjs');
const { readSpec, specSections } = require('./spec-sections.cjs');
const { mailboxDepth } = require('./derivations.cjs');
const { directiveOf, checkDirective, recordDirective } = require('./directives.cjs');
const { commitStateTail, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { messageOf } = require('../kernel/call.cjs');

/** @typedef {{state: 'done'|'skipped', reason?: string, at: string}} Mark */
/** @typedef {{items: Record<string, Mark>, closed?: string, taken?: string}} Checklist */

/**
 * A checklist named: its point; where its record sits under the manifest's
 * `checklists`; the work it closes; and that work's manifest as read, the
 * unit's or, for a directive, the project's.
 * @typedef {{
 *   point: string, path: string[], cwd: string,
 *   unit: string|null, topic: string|null, phase: number|null,
 *   manifest: Record<string, any>, warnings: string[],
 * }} Named
 */

/**
 * An item of a point: its key and text; how the engine checks it, where it
 * does; and where it applies, where not everywhere.
 * @typedef {{key: string, text: string, check?: (named: Named) => boolean, applies?: (named: Named) => boolean}} Item
 */

/** @typedef {{checklist: string, item: string, text: string, reason: string, at: string}} Skip */

/** Where a checklist sits, named by what follows its point. @typedef {Omit<Named, 'point'|'cwd'|'warnings'>} Place */

/**
 * A point: what names its checklist after the point, and where that places
 * it; its items; the skips its gate shows, given its own; and what its
 * close does beyond recording itself, where it does more.
 * @typedef {{
 *   takes: string[],
 *   place: (cwd: string, args: string[]) => Place,
 *   items: Item[],
 *   shows: (named: Named, own: Skip[]) => Skip[],
 *   closes?: (named: Named) => void,
 * }} Point
 */

/** The key a phase's start or close keeps its checklist under. @param {number} number @param {'start'|'close'} end */
const phaseKey = (number, end) => `phase-${number}-${end}`;

/** A checklist's record on a manifest, where it has one. @param {Record<string, any>} manifest @param {string[]} path @returns {Checklist|undefined} */
const recordAt = (manifest, path) => path.reduce((node, key) => node?.[key], manifest.checklists);

/** Whether a checklist on a manifest has been closed. @param {Record<string, any>} manifest @param {string[]} path */
const closed = (manifest, path) => recordAt(manifest, path)?.closed !== undefined;

/** Whether a phase of the unit has started: its start's checklist closed (6.4.8). @param {Record<string, any>} manifest @param {number} number */
const phaseStarted = (manifest, number) => closed(manifest, [phaseKey(number, 'start')]);

/** The phases of the unit's cut, none where it has no cut. @param {Record<string, any>} manifest @returns {Array<{sections: string[], scenarios: string[], relies_on: Array<number|string>}>} */
const phasesOf = (manifest) => manifest.cut?.phases ?? [];

/** No question of the person's open on the topic's map (5.8.5, 9.5.3). @param {Named} named */
function questionsClosed({ cwd, unit, topic, warnings }) {
  const root = stateRoot(cwd);
  const folded = { facts: foldLedger(root, ID_FACTS, warnings), live: liveness(root) };
  return mapOf(folded, /** @type {string} */ (unit), /** @type {string} */ (topic)).every((row) => row.stands !== 'open');
}

/** No message waiting in the topic's mail (10.2.7). @param {Named} named */
function mailboxEmpty({ cwd, unit, topic }) {
  return mailboxDepth(stateRoot(cwd), /** @type {string} */ (unit), /** @type {string} */ (topic)) === 0;
}

/** Each phase of the cut names a scenario and a section; what it relies on may be nothing (11.5.4). @param {Named} named */
function phasesComplete({ manifest }) {
  const phases = phasesOf(manifest);
  return phases.length > 0 && phases.every(({ scenarios, sections }) => scenarios.length > 0 && sections.length > 0);
}

/** Every part of the spec drawn on by a phase of the cut, directly or through its area; an area with no parts, whole. @param {Named} named */
function sectionsDrawn({ cwd, unit, manifest }) {
  const phases = phasesOf(manifest);
  if (phases.length === 0) return false;
  const drawn = new Set(phases.flatMap(({ sections }) => sections));
  const addresses = [...specSections(readSpec(cwd, /** @type {string} */ (unit))).keys()];
  return addresses
    .filter((address) => !addresses.some((part) => part.startsWith(`${address}.`)))
    .every((address) => drawn.has(address) || drawn.has(address.split('.')[0]));
}

/** What the phase relies on is done: each earlier phase's close recorded, each other unit completed (12.6.2, 12.6.3). @param {Named} named */
function reliedOnDone({ cwd, manifest, phase }) {
  const finished = finishedUnits(stateRoot(cwd));
  const on = phasesOf(manifest)[/** @type {number} */ (phase) - 1].relies_on;
  return on.every((relied) => (typeof relied === 'number' ? closed(manifest, [phaseKey(relied, 'close')]) : finished(relied)));
}

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
  const phases = phasesOf(manifest);
  if (phases.length === 0) throw new Error(`${unit} has no cut — its phases come from engine cut`);
  if (!/^[1-9][0-9]*$/.test(given) || Number(given) > phases.length) throw new Error(`${unit}'s cut has no phase ${given} — its phases are 1 to ${phases.length}`);
  const phase = Number(given);
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
      { key: 'product-lines-shown', text: 'the product-record lines and any candidates are on the screen' },
    ],
    shows: ownSkips,
  },
  'ready-to-build': {
    takes: ['<work-unit>'],
    place: onUnit(() => ({ path: ['ready-to-build'] })),
    items: [
      { key: 'topics-settled', text: 'every topic decided, cancelled or postponed, a feature\'s one topic being decided by this same screen' },
      { key: 'sweep-run', text: 'the sweep between topics run, where the unit has more than one topic', applies: moreThanOneTopic },
      { key: 'replacements-checked', text: 'the spec has checked each replacement against what it replaced' },
      { key: 'statements-traced', text: 'every statement traced' },
      { key: 'review-settled', text: 'the review\'s last pass changed nothing' },
      { key: 'phases-complete', text: 'each phase in the cut has its scenarios, sections and relies-on', check: phasesComplete },
      { key: 'invariants-checked', text: 'every invariant names a check or says none can' },
      { key: 'sections-drawn', text: 'every section of the spec drawn on by at least one phase in the cut', check: sectionsDrawn },
      { key: 'assets-linked', text: 'canonical assets linked' },
    ],
    shows: ownSkips,
  },
  'phase-start': {
    takes: ['<work-unit>', '<N>'],
    place: onPhase('start'),
    items: [
      { key: 'tasks-written', text: 'tasks written with their links' },
      { key: 'design-settled', text: 'shared design settled' },
      { key: 'relies-on-done', text: 'what the phase relies on is done', check: reliedOnDone },
    ],
    shows: noSkips,
  },
  'phase-close': {
    takes: ['<work-unit>', '<N>'],
    place: onPhase('close'),
    items: [
      { key: 'tasks-passed', text: 'every task passed its pair' },
      { key: 'phase-review-passed', text: 'the phase review passed and its fixes landed' },
      { key: 'scenarios-reported', text: 'each scenario proven or reported not proven' },
      { key: 'notes-consolidated', text: 'the notes for later read by the consolidation agent, then made into tasks or dropped with a reason' },
      { key: 'stack-merged', text: 'the stack merged, or waiting at its gate in step' },
    ],
    shows: noSkips,
  },
  finish: {
    takes: ['<work-unit>'],
    place: onUnit(() => ({ path: ['finish'] })),
    items: [
      { key: 'review-passed', text: 'the review phase passed and its report is written, where the unit has a review phase (a quick-fix\'s only when the person asks)' },
      { key: 'inbox-closed', text: 'resolved inbox items closed' },
      { key: 'build-log-closed', text: 'the build log closed' },
      { key: 'records-indexed', text: 'the records indexed' },
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
 * them now, and Claude's by the marks made since the last close.
 * @param {Named} named
 * @returns {Array<{key: string, text: string, by: 'engine'|'claude', state: 'done'|'skipped'|'open', reason?: string, at?: string}>}
 */
function itemStates(named) {
  const record = recordAt(named.manifest, named.path);
  return itemsOf(named).map(({ key, text, check }) => {
    if (check !== undefined) return { key, text, by: 'engine', state: check(named) ? 'done' : 'open' };
    const mark = record?.items[key];
    if (mark === undefined || (record?.closed !== undefined && mark.at <= record.closed)) return { key, text, by: 'claude', state: 'open' };
    return { key, text, by: 'claude', ...mark };
  });
}

/** An item skipped, as a gate shows it. @param {string} checklist @param {{key: string, text: string}} item @param {{reason?: string, at?: string}} mark @returns {Skip} */
const skipOf = (checklist, { key, text }, { reason, at }) => ({ checklist, item: key, text, reason: /** @type {string} */ (reason), at: /** @type {string} */ (at) });

/** Every phase start's and close's skips, as their records keep them, in the cut's order. @param {Record<string, any>} manifest @returns {Skip[]} */
function phaseSkips(manifest) {
  return phasesOf(manifest).flatMap((_, at) => /** @type {const} */ (['start', 'close']).flatMap((end) => {
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
 * The checklist `args` name after its point, its work's manifest read.
 * Refuses a point it does not know, a unit, topic or phase the project
 * lacks, and a directive the migrations lack.
 * @param {string} cwd @param {string} point @param {string[]} args
 * @returns {Named}
 */
function named(cwd, point, args) {
  if (!Object.hasOwn(POINTS, point) || args.length !== POINTS[point].takes.length) usage();
  return { point, cwd, warnings: [], ...POINTS[point].place(cwd, args) };
}

/**
 * Change a named checklist's record, its work's manifest read again and
 * saved under that manifest's lock — the change seeing the checklist as
 * read there, and throwing to write nothing — then commit the manifest
 * alone. Answers the commit's outcome on `result`.
 * @param {Named} checklist @param {string} done what the commit message says was done
 * @param {(record: Checklist, fresh: Named) => void} change
 * @param {Record<string, unknown>} result
 */
function changeRecord(checklist, done, change, result) {
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
  const outcome = commitStateTail(cwd, unit === null ? PROJECT_MANIFEST_SPEC : `${unit}/manifest.json`, `${scope}: ${nameOf(checklist)} ${done}`, warnings);
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
 * Record the checklist's close, refused while any item is open (6.4.4),
 * then do what its point's close does beyond.
 * @param {Named} checklist
 */
function close(checklist) {
  const at = new Date().toISOString();
  const answer = changeRecord(checklist, 'closed', (record, fresh) => {
    const open = itemStates(fresh).filter((item) => item.state === 'open').map((item) => item.key);
    if (open.length > 0) throw new Error(`${nameOf(checklist)} has items open: ${open.join(', ')}`);
    record.closed = at;
  }, { ...answering(checklist), closed: at });
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
 * already, the topic set back in progress since, so it is worked afresh and
 * closed again; or an item the engine checks failing now, as mail landing
 * since the close fails the mailbox's.
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
 * Record on the unit's manifest, as it is saved, that the decided gate's
 * yes took the topic's close.
 * @param {Record<string, any>} manifest @param {string} topic @param {string} at
 */
function takeDecidedClose(manifest, topic, at) {
  /** @type {Checklist} */ (recordAt(manifest, ['decided', topic])).taken = at;
}

module.exports = { CHECKLIST_USAGE, runChecklistVerb, phaseStarted, decidedClose, takeDecidedClose };
