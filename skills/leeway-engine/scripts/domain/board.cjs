'use strict';

// ---------------------------------------------------------------------------
// Domain ring: `engine board <session-id> [--tab this|unit|all] [--unit
// <work-unit>] [--page <ref> [--page-unit <work-unit>]]` — the workflows
// board's one read (§20),
// answering its view model (board-model.cjs) for the gate mod, which calls
// it after every engine call and every press. It takes no writer lock and
// writes nothing, the conversation's mark among it, reading the tracker from
// a copy of its store, with one exception every read of the ledger shares
// (ledger.cjs): a landing rewrites the ledger before it moves the state
// branch, so a read that finds the ledger departing from the branch takes
// the writer lock — waiting while a catch-up landing runs, and finishing a
// landing a kill cut short, which writes.
//
// - This session follows the conversation's position (20.3.3, 20.3.4): a
//   phase's view while it is in one — the build, the review phase, a
//   discussion, the specification, an epic's discovery, an experiment —
//   the unit's page at its menu and in a phase whose view comes later
//   (29.14.2), a quick-fix's implementation among them, and All work at the
//   start menu or a project-level place.
// - The unit's tab shows the unit `--unit` names, else the session's: an
//   epic's page for an epic (20.15.2), the unit's page for any other.
//   All work shows the project (20.16), and `--page unit:{unit}` another
//   unit's page from it (20.3.6).
// - A page (`--page`) is read against the unit it was opened in,
//   `--page-unit`, whatever tab shows it and wherever the session has gone
//   since — the start menu or another unit — so it stays while the session
//   moves beneath it (20.3.5). With none named it is the tab's unit's: on
//   the unit's tab the unit `--unit` names, else the session's; on This
//   session the session's. Wherever All work shows — its tab, and This
//   session at the start menu (20.3.6) — `unit:{unit}` names its own, and
//   All work's tab opens any other page only with its unit named. `--unit`
//   names the unit's tab's unit alone, never a page's, so the tabs stand as
//   they would with no page open. The answer carries beside the page the
//   view the tab shows beneath it (`beneath`), which its way back returns
//   to.
// - The banner is the session's place's (20.2.4), whichever tab is shown.
// - Never a look (5.8.14): Claude's calls since the person last looked are
//   read without moving the mark.
// - Each unit is read once a call, whichever tabs and pages draw it, and its
//   tracker in one read, once its build has begun, of a copy of its store
//   (task-verbs.cjs) — its phases, the fix phases past the cut, the tasks
//   ready, and the task a page names — which its build's checks read too,
//   the stop's asked of a phase's start among them; All work reads no other
//   unit's tracker.
// - Each tab is answered on its own: a view or page that cannot be drawn
//   answers `unavailable`, saying why, the banner and the questions standing
//   apart from it; This session's view that cannot be drawn leaves the
//   banner at the session's place, no question queued, and says why among
//   the warnings.
//
// It refuses: a call with no session id or more than one, a tab that is
// none of the three, the unit's tab or a page with no unit to show, a unit
// the project lacks — `--unit`'s or `--page-unit`'s — a page its ref does
// not name, a page's task that is no task's number, and `--page-unit` with
// no page.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { stateRoot } = require('../kernel/state-root.cjs');
const { PROJECT_IDENTITIES } = require('../kernel/manifest-schema.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { readPosition, conversationDir } = require('./conversation.cjs');
const { BRIEFS } = require('./brief-names.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { trackedUnit } = require('./task-verbs.cjs');
const { parseShownTask } = require('./task-id.cjs');
const { buildBegun } = require('./derivations.cjs');
const { titlecase } = require('./conventions.cjs');
const { projectName } = require('./state-checks.cjs');
const { BOARD_VERSION, TABS } = require('./board-model.cjs');
const { buildView, buildBanner, taskPage, writtenPage, roundPage } = require('./projections/board-build.cjs');
const { reviewView, reviewBanner, findingPage, checkPage } = require('./projections/board-review.cjs');
const { discussionView, discussionBanner, entryPage, messagePage, reviewReportPage } = require('./projections/board-discussion.cjs');
const { specView, specBanner, sectionPage, passPage } = require('./projections/board-spec.cjs');
const { discoveryView, discoveryBanner, briefPage, topicStarted, spikePage } = require('./projections/board-discovery.cjs');
const { experimentView, experimentBanner, reportPage } = require('./projections/board-experiment.cjs');
const { unitPage, unitBanner, placeBanner } = require('./projections/board-unit.cjs');
const { allView, allBanner } = require('./projections/board-all.cjs');

/** @typedef {import('./board-model.cjs').Board} Board */
/** @typedef {import('./board-model.cjs').Place} Place */
/** @typedef {import('./board-model.cjs').View} View */
/** @typedef {import('./board-model.cjs').Banner} Banner */
/** @typedef {import('./board-model.cjs').Question} Question */
/** @typedef {import('./conversation.cjs').InFlight} InFlight */
/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('./task-verbs.cjs').TrackedUnit} TrackedUnit */

const BOARD_USAGE = 'board <session-id> [--tab this|unit|all] [--unit <work-unit>] [--page <ref> [--page-unit <work-unit>]]';

/**
 * A brief this conversation issued for a unit: its role, its task, and the
 * review phase's area and round, where it names them; and when it was
 * issued.
 * @typedef {{role: string, task: string|null, area: string|null, round: number|null, at: string}} Issued
 */
/**
 * What the board reads at a call for one unit: the project; the unit with
 * its manifest and title; the conversation, its place, its tasks in flight
 * in the unit and the briefs it issued for it, oldest first; the unit's
 * tracker, read once — refused where its build has not begun; one read of
 * anything a call reads twice; and the warnings gathered.
 * @typedef {{
 *   cwd: string, root: string, session: string, place: Place, unit: string, manifest: Record<string, any>, title: string,
 *   inFlight: InFlight[], issued: Issued[], tracker: () => TrackedUnit,
 *   once: <T>(key: string, read: () => T) => T, warnings: string[],
 * }} BoardAt
 */
/** What a view's read answers: the view, and the questions a press can queue where it reads them. @typedef {{view: View, questions?: Question[]}} Read */
/** The banner's state and facts a view gives, the name the board's. @typedef {Omit<Banner, 'name'>} Banned */

/** The briefs the conversation issued for the unit, oldest first (the header's). @param {string} session @param {string} unit @returns {Issued[]} */
function issuedFor(session, unit) {
  const dir = path.join(conversationDir(session), BRIEFS);
  /** @type {string[]} */
  let names;
  try {
    names = fs.readdirSync(dir).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    try {
      const file = path.join(dir, name);
      const held = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (held?.unit !== unit) return [];
      return [{ role: String(held.role), task: held.task ?? null, area: held.area ?? null, round: held.round ?? null, at: fs.statSync(file).mtime.toISOString() }];
    } catch {
      return [];
    }
  }).sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Where the session is, as its position records it (the header's): a unit
 * the project lacks, or a project-level place, is no unit's.
 * @param {string} root @param {import('./conversation.cjs').Position|null} position @returns {Place}
 */
function placeOf(root, position) {
  const none = { unit: null, type: null, phase: null, topic: null };
  if (position === null || PROJECT_IDENTITIES.includes(position.name)) return none;
  const manifest = manifestOf(root, position.name);
  if (manifest === null) return none;
  return { unit: position.name, type: manifest.work_type, phase: position.phase ?? null, topic: position.topic ?? null };
}

/**
 * What the board reads for a unit at this call, refused where the project
 * lacks it; its tracker read once, with the task a page names.
 * @param {string} cwd @param {string} session @param {Place} place @param {string} unit @param {InFlight[]} inFlight @param {string[]} warnings @param {TaskRef|null} task
 * @returns {BoardAt}
 */
function unitAt(cwd, session, place, unit, inFlight, warnings, task) {
  const root = stateRoot(cwd);
  const manifest = manifestOf(root, unit);
  if (manifest === null) throw new Error(`there is no work unit "${unit}"`);
  /** @type {Map<string, unknown>} */
  const reads = new Map();
  /** @type {BoardAt['once']} */
  const once = (key, read) => {
    if (!reads.has(key)) reads.set(key, read());
    return /** @type {any} */ (reads.get(key));
  };
  return {
    cwd,
    root,
    session,
    place,
    unit,
    manifest,
    title: titlecase(unit),
    inFlight: place.unit === unit ? inFlight : [],
    issued: place.unit === unit ? issuedFor(session, unit) : [],
    tracker: () => once('tracker', () => {
      if (!buildBegun(manifest)) throw new Error(`${unit}'s build has not begun`);
      return trackedUnit(cwd, unit, manifest, task);
    }),
    once,
    warnings,
  };
}

/**
 * The phases with a view of their own, each its read and its banner, and
 * the types it stands for where not every type's: an epic's discovery
 * alone has a view, and a quick-fix's one session is no build.
 * @type {Readonly<Record<string, {read: (at: BoardAt) => Read, banner: (at: BoardAt, view: any) => Banned, of?: (type: string) => boolean}>>}
 */
const PHASE_VIEWS = Object.freeze({
  implementation: { read: buildView, banner: (_, view) => buildBanner(view), of: (type) => type !== 'quick-fix' },
  review: { read: reviewView, banner: (_, view) => reviewBanner(view) },
  discussion: { read: discussionView, banner: (_, view) => discussionBanner(view) },
  specification: { read: specView, banner: (_, view) => specBanner(view) },
  discovery: { read: discoveryView, banner: (_, view) => discoveryBanner(view), of: (type) => type === 'epic' },
  experiment: { read: experimentView, banner: (_, view) => experimentBanner(view) },
});

/** A phase's view for the unit, null where the unit's page stands for it. @param {BoardAt} at @param {string|null} phase */
function phaseView(at, phase) {
  if (phase === null || !Object.hasOwn(PHASE_VIEWS, phase)) return null;
  const view = PHASE_VIEWS[phase];
  return view.of === undefined || view.of(at.manifest.work_type) ? view : null;
}

/**
 * This session's view, with the banner it gives: a phase's view, else the
 * unit's page, at its menu where the session is at none.
 * @param {BoardAt} at @returns {Read & {banned: Banned}}
 */
function sessionRead(at) {
  const phase = phaseView(at, at.place.phase);
  if (phase !== null) {
    const read = phase.read(at);
    return { ...read, banned: phase.banner(at, read.view) };
  }
  const read = unitPage(at, at.place.phase === null);
  return { ...read, banned: unitBanner(at, read.view) };
}

/** A topic's page: its discussion once started, else its brief. @param {BoardAt} at @param {string} topic */
const topicPage = (at, topic) => (topicStarted(at, topic) ? discussionView(at, topic).view : briefPage(at, topic));

/**
 * The pages of a unit, each by its ref's shape and what draws it from the
 * ref's parts; a task's ref names the task its tracker read takes.
 * @type {readonly {ref: string, shape: RegExp, draw: (at: BoardAt, ...parts: string[]) => View, task?: true}[]}
 */
const PAGES = Object.freeze([
  { ref: 'task:{N.n}', shape: /^task:([^:]+)$/, draw: taskPage, task: true },
  { ref: 'task:{N.n}:written', shape: /^task:([^:]+):written$/, draw: writtenPage, task: true },
  { ref: 'task:{N.n}:round:{k}', shape: /^task:([^:]+):round:([^:]+)$/, draw: roundPage, task: true },
  { ref: 'entry:{id}', shape: /^entry:([^:]+)$/, draw: entryPage },
  { ref: 'finding:{round}:{k}', shape: /^finding:([^:]+):([^:]+)$/, draw: findingPage },
  { ref: 'check:{round}:{scenario}', shape: /^check:([^:]+):([^:]+)$/, draw: checkPage },
  { ref: 'section:{n}', shape: /^section:([^:]+)$/, draw: sectionPage },
  { ref: 'pass:{k}', shape: /^pass:([^:]+)$/, draw: passPage },
  { ref: 'topic:{topic}', shape: /^topic:([^:]+)$/, draw: topicPage },
  { ref: 'message:{topic}:{file}', shape: /^message:([^:]+):([^:]+)$/, draw: messagePage },
  { ref: 'review:{topic}:{id}', shape: /^review:([^:]+):([^:]+)$/, draw: reviewReportPage },
  { ref: 'spike:{folder}', shape: /^spike:([^:]+)$/, draw: spikePage },
  { ref: 'report:{topic}:{id}', shape: /^report:([^:]+):([^:]+)$/, draw: reportPage },
]);

/** All work's one page: another unit's. */
const ALL_PAGE = /^unit:([^:]+)$/;

/**
 * A page a ref names: All work's, by the unit it opens, wherever All work
 * shows — its tab, and This session at the start menu; any other, by what
 * draws it, its parts and the task it names, All work's tab opening one
 * only with the unit it was opened in named; refused where the ref names
 * none.
 * @param {Board['tab']} tab @param {boolean} showsAll @param {string} ref @param {boolean} isUnitNamed
 * @returns {{unit: string, draw: null, parts: string[], task: null}|{unit: null, draw: (at: BoardAt, ...parts: string[]) => View, parts: string[], task: string|null}}
 */
function pageOf(tab, showsAll, ref, isUnitNamed) {
  const opens = ALL_PAGE.exec(ref);
  if (showsAll && opens !== null) return { unit: opens[1], draw: null, parts: [], task: null };
  if (tab === 'all' && !isUnitNamed) throw new Error(`no page of All work is named "${ref}" — All work opens unit:{unit}, and another unit's page with --page-unit`);
  for (const { shape, draw, task } of PAGES) {
    const parts = shape.exec(ref)?.slice(1);
    if (parts !== undefined) return { unit: null, draw, parts, task: task ? parts[0] : null };
  }
  throw new Error(`no page is named "${ref}" — a page is ${PAGES.map((page) => page.ref).join(', ')}`);
}

/** A view drawn, or why it cannot be. @param {() => View} draw @returns {View} */
function drawn(draw) {
  try {
    return draw();
  } catch (err) {
    return { kind: 'unavailable', reason: messageOf(err) };
  }
}

/**
 * This session's read, null where it cannot be drawn, said among the
 * warnings.
 * @param {BoardAt} here @param {string[]} warnings @returns {(Read & {banned: Banned}) | {failed: string}}
 */
function ownRead(here, warnings) {
  try {
    return sessionRead(here);
  } catch (err) {
    warnings.push(`This session cannot be drawn — ${messageOf(err)}`);
    return { failed: messageOf(err) };
  }
}

/**
 * `engine board` (the header's).
 * @param {string} cwd @param {string[]} positional @param {Record<string, string>} opts @returns {Board}
 */
function boardOf(cwd, positional, opts) {
  if (positional.length !== 1) throw new Error(`Usage: engine ${BOARD_USAGE}`);
  const [session] = positional;
  const tab = /** @type {Board['tab']} */ (opts.tab ?? 'this');
  if (!TABS.includes(tab)) throw new Error(`--tab is this, unit or all, not "${tab}"`);
  if (opts['page-unit'] !== undefined && opts.page === undefined) throw new Error('--page-unit names the unit a page was opened in, and goes with --page');
  /** @type {string[]} */
  const warnings = [];
  const position = readPosition(session);
  const place = placeOf(stateRoot(cwd), position);
  const showsAll = tab === 'all' || tab === 'this' && place.unit === null;
  const page = opts.page === undefined ? null : pageOf(tab, showsAll, opts.page, opts['page-unit'] !== undefined);
  const tabUnit = opts.unit ?? place.unit;
  if (tab === 'unit' && tabUnit === null) throw new Error('the unit\'s tab is at no unit, whose page it would show — --unit names one');
  const pageUnit = page === null ? null : page.unit ?? opts['page-unit'] ?? (tab === 'unit' ? tabUnit : place.unit);
  if (page !== null && pageUnit === null) throw new Error('the session is at no unit, whose page it would show — --page-unit names one');
  const pageTask = page === null || page.task === null ? null : parseShownTask(/** @type {string} */ (pageUnit), page.task);
  /** @type {Map<string, BoardAt>} */
  const units = new Map();
  const at = (/** @type {string} */ unit) => {
    if (!units.has(unit)) units.set(unit, unitAt(cwd, session, place, unit, position?.tasks ?? [], warnings, unit === pageUnit ? pageTask : null));
    return /** @type {BoardAt} */ (units.get(unit));
  };
  const tabAt = tabUnit === null ? null : at(tabUnit);
  const pageAt = pageUnit === null ? null : at(pageUnit);
  const here = place.unit === null ? null : at(place.unit);
  const own = here === null ? null : ownRead(here, warnings);
  const read = own === null || 'failed' in own ? null : own;
  const tabView = () => {
    if (tab === 'all' || here === null && tab === 'this') return allView(cwd, here, position === null, warnings).view;
    if (tab === 'unit') return unitPage(/** @type {BoardAt} */ (tabAt), tabAt === here && place.phase === null).view;
    if (own !== null && 'failed' in own) throw new Error(own.failed);
    return /** @type {Read} */ (read).view;
  };
  return {
    version: BOARD_VERSION,
    place,
    banner: here === null ? { name: projectName(cwd), ...allBanner(position) } : { name: here.title, ...(read?.banned ?? placeBanner(here)) },
    unit: tabAt === null ? null : { unit: tabAt.unit, title: tabAt.title },
    tab,
    view: page === null ? drawn(tabView) : drawn(() => {
      const of = /** @type {BoardAt} */ (pageAt);
      return page.draw === null ? unitPage(of, false).view : page.draw(of, ...page.parts);
    }),
    beneath: page === null ? null : drawn(tabView),
    questions: read?.questions ?? [],
    warnings,
  };
}

module.exports = { BOARD_USAGE, boardOf };
