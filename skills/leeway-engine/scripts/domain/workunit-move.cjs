'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a unit's move to another type — a quick-fix to a feature or
// a bugfix, when the work needs a decision from the person beyond a quick
// call (19.5.9, 19.S24), and a bugfix to a feature, from its investigation,
// when the root cause is a design problem (19.4.5, 19.4.22, 19.S30) — run
// from inside the unit's own session, never from manage (18.3.4, P7).
//
// - The stage, `workunit move <unit> --to feature|bugfix --file
//   <payload.json>`: the unit checked, then Claude's payload, exactly
//   `{description, reason, brief}` — the description for the new type, the
//   one-line reason for it, and the one topic's brief, a draft in the cache
//   drawn from the change or the investigation — staged where start this
//   work stages a start, and start this work's screen drawn from it
//   (start-this-work.cjs): one payload, one screen. Nothing moves before
//   the yes.
// - What the move carries (19.5.16): the unit itself, re-typed in place
//   under its name, so its seeds, its discovery log, its assets and the
//   lines discovery made at its own level stay where they are and are read
//   as any unit's at its topic's first opening; the description given; its
//   one topic, the new type's first phase's item, unstarted until its first
//   entry starts it, and its brief at `topics/{unit}/brief.md`. The old
//   type's work is the topic's earlier input, read at its first opening and
//   never changed (enter.cjs): every other line made in the unit is carried
//   to the topic at the new type's first phase by one `rehomed` line
//   (ledger-rehomed.cjs), so no reader of the new type's later phases takes
//   it as theirs, and an absorb of the feature it became carries it on; and
//   the old type's own files are set aside under `topics/{unit}/earlier/`
//   (`earlierFile`, derivations.cjs) — a quick-fix's `build/` whole and its
//   `summary.md`, a bugfix's investigation log as `investigation-log.md`,
//   so the discussion keeps a log of its own — each line naming one
//   following it through the carry.
// - It refuses, writing nothing: a unit not in progress; a unit of a type
//   the reshape retires, as every door does (`retiredRefusal`,
//   derivations.cjs); a type that does not move — an epic, a feature — or
//   a move to a type its own does not take: a quick-fix moves to a feature
//   or a bugfix, a bugfix to a feature alone; a quick-fix its old scoping
//   made; a unit past its spec; a bugfix but from its investigation in
//   progress; and a quick-fix with a fix whose pull request is opened or
//   landed, as the landing driver reads it (`openedTasks`, landing.cjs),
//   which is finished first.
// - The yes (`start-this-work yes` over a staged move): the stage's checks
//   again, against the unit as it stands, and, where lines are carried, a
//   conversation naming its session. Then, the writer lock held, each step
//   one a second yes repeats or finds done: for a quick-fix, the project's
//   checkout taken back to the branch the fixes land on where it has one of
//   the unit's fixes' branches out — refused first, nothing moved, while it
//   holds changes not committed — and each fix not yet ended closed, each
//   close committing the tracker as the verb does; the carry appended, the
//   lines read once the fixes have closed; then nothing left that the new
//   type's build, numbering its own phase 1 and tasks 1.n, can meet — the
//   fixes' branches set aside, one holding commits of its own kept under
//   `moved/{branch}`, out of every landing's reading, the rest deleted
//   (fix-branch.cjs), and the fixes' phase taken out of the tracker for
//   good, its tasks with it (`removePhase`); the old type's files set
//   aside; the brief written. Last, the unit re-typed with its new
//   description, all a quick-fix's entry and build left on it (`build`,
//   `fixes`) and a bugfix's investigation item dropped, so the new type
//   starts as one before its spec, and its registration, in one save. The
//   knowledge base is
//   re-indexed, its chunks carrying the type (warn-don't-block), and one
//   commit takes the unit, the project manifest, the tracker's store where
//   the fixes began, and the ledger where lines were carried. It answers
//   the handoff into the new type's first phase (24.1.2).
// - Known edges: a failure between the save and the commit leaves the move
//   made and uncommitted, the unit of the new type, so the yes refuses to
//   run again; a quick-fix named like a waiting roadmap idea moves beside
//   it, its name being kept.
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
const { isObject } = require('../kernel/manifest-io.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { commitStateTail, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { appendEntry, commitLedger } = require('./ledger.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { retiredRefusal, legacyBuild, fixesBegun, FIXES_PHASE, itemOf, briefFile, EARLIER, earlierFile } = require('./derivations.cjs');
const { assertBeforeSpec } = require('./spec-standing.cjs');
const { draftIn, writeBrief } = require('./discovery-map.cjs');
const { filled, shaped, readPayload, stage } = require('./staged-payload.cjs');
const { trackedPhase, removePhase, runTaskVerb, ENDED } = require('./task-verbs.cjs');
const { openedTasks } = require('./landing.cjs');
const { keptFixes, setFixesAside, checkOutLanding } = require('./fix-branch.cjs');
const { linesOf, movedFiles } = require('./workunit-absorb.cjs');
const { reindexWorkUnit } = require('./workunit-lifecycle.cjs');
const { topicLog } = require('./topic-log.cjs');
const { shownTask } = require('./task-id.cjs');
const { stagedFile, nextAfter, OPENS_IN } = require('./start-this-work.cjs');
const { startThisWorkScreen, aType } = require('./projections/discovery-gates.cjs');

/** @typedef {import('./drivers.cjs').TaskRow} TaskRow */

/**
 * A move as staged: the unit by its name, the type it moves to, Claude's
 * description, reason and brief draft, and the type it moves from with the
 * names the branches holding its fixes' commits are kept under.
 * @typedef {{type: string, name: string, description: string, reason: string, brief: string, moves: {from: string, branches: string[]}}} StagedMove
 */

/** The types each type moves to (19.5.9, 19.4.22). @type {Readonly<Record<string, readonly string[]>>} */
const MOVES = Object.freeze({ 'quick-fix': ['feature', 'bugfix'], bugfix: ['feature'] });

/**
 * What each type that moves sets aside of its own, state-relative, each
 * `[from, to]`: where it was, and where in the topic's earlier material it
 * goes (the header's).
 * @type {Readonly<Record<string, (unit: string) => [string, string][]>>}
 */
const SET_ASIDE = Object.freeze({
  'quick-fix': (unit) => [[`${unit}/build`, earlierFile(unit, unit, EARLIER.build)], [`${unit}/summary.md`, earlierFile(unit, unit, EARLIER.summary)]],
  bugfix: (unit) => [[topicLog(unit, unit), earlierFile(unit, unit, EARLIER.investigationLog)]],
});

/** Whether what start this work staged is a move. @param {unknown} staged @returns {staged is StagedMove} */
function isMove(staged) {
  return isObject(staged) && Object.hasOwn(staged, 'moves');
}

/**
 * Refuses a type that does not move, or a move to a type its own does not
 * take. @param {string} unit @param {string} from @param {string} to
 */
function assertMoves(unit, from, to) {
  const takes = Object.hasOwn(MOVES, from) ? MOVES[from] : [];
  if (takes.length === 0) throw new Error(`${unit} is ${aType(from)}, which moves nowhere — a quick-fix moves to a feature or a bugfix, and a bugfix to a feature`);
  if (!takes.includes(to)) throw new Error(`${unit} is ${aType(from)}, which moves to ${takes.map(aType).join(' or ')} — not to ${JSON.stringify(to)}`);
}

/**
 * Refuses a bugfix but from its investigation in progress (19.4.22).
 * @param {Record<string, any>} manifest
 */
function assertInvestigating(manifest) {
  const status = itemOf(manifest, 'investigation', manifest.name)?.status;
  if (status === 'in-progress') return;
  const where = status === 'completed' ? 'has concluded — the work carries on in its spec' : 'has not begun';
  throw new Error(`a bugfix moves to a feature from its investigation, and ${manifest.name}'s ${where}`);
}

/**
 * A quick-fix's fixes as the tracker holds them, none where their phase is
 * not written: refused where any fix has its pull request opened or landed
 * — finished first, the new work started on its own.
 * @param {string} cwd @param {Record<string, any>} manifest @param {string} to
 * @returns {TaskRow[]}
 */
function fixesOf(cwd, manifest, to) {
  if (!fixesBegun(manifest)) return [];
  const unit = manifest.name;
  const fixes = trackedPhase(cwd, unit, FIXES_PHASE.number).tasks ?? [];
  const opened = openedTasks(cwd, unit, fixes.map(({ ref }) => ref));
  if (opened.length > 0) {
    const named = opened.length === 1 ? `fix ${opened[0]} has its pull request` : `fixes ${opened.join(', ')} have their pull requests`;
    throw new Error(`${unit}'s ${named} opened — finish the quick-fix, then start the ${to} as work of its own`);
  }
  return fixes;
}

/**
 * The unit's move to `to` checked as it stands: a quick-fix's fixes, as
 * `fixesOf` answers them; none for a bugfix.
 * @param {string} cwd @param {Record<string, any>} manifest @param {string} to
 * @returns {TaskRow[]}
 */
function checkMove(cwd, manifest, to) {
  const unit = manifest.name;
  const from = manifest.work_type;
  if (manifest.status !== 'in-progress') throw new Error(`${unit} is ${manifest.status ?? 'without a status'} — only work in progress moves`);
  const retired = retiredRefusal(manifest);
  if (retired !== null) throw new Error(retired);
  assertMoves(unit, from, to);
  if (from === 'quick-fix' && legacyBuild(manifest)) throw new Error(`${unit} was scoped under the old plan, and moves once the reshape's 29.17 migration has cut it`);
  assertBeforeSpec(cwd, manifest, 'ownWork');
  if (from === 'bugfix') assertInvestigating(manifest);
  return from === 'quick-fix' ? fixesOf(cwd, manifest, to) : [];
}

/**
 * Claude's payload checked: its description, its reason and its brief's
 * draft.
 * @param {string} cwd @param {unknown} given
 * @returns {{description: string, reason: string, brief: string}}
 */
function movePayload(cwd, given) {
  const fields = shaped(given, 'the payload', ['description', 'reason', 'brief']);
  if (!filled(fields.description) || !filled(fields.reason)) throw new Error('the description and the reason are each a non-empty string');
  if (!filled(fields.brief)) throw new Error('the one topic lands with its brief — brief names its draft');
  draftIn(cwd, fields.brief, 'the brief');
  return { description: fields.description, reason: fields.reason, brief: fields.brief };
}

/**
 * `workunit move <unit> --to <type> --file <payload.json>`: the move
 * checked and staged, and start this work's screen drawn from it.
 * @param {string} cwd @param {string} unit @param {{to: string, file: string}} opts
 * @returns {{response: Record<string, unknown>, sections: string}}
 */
function stageMove(cwd, unit, { to, file }) {
  const manifest = loadWorkUnitManifest(cwd, unit);
  checkMove(cwd, manifest, to);
  const from = manifest.work_type;
  /** @type {StagedMove} */
  const staged = stage(stagedFile(cwd), {
    type: to,
    name: unit,
    ...movePayload(cwd, readPayload(cwd, file)),
    moves: { from, branches: from === 'quick-fix' ? keptFixes(cwd, unit) : [] },
  });
  return { response: { work_unit: unit, from, to }, sections: startThisWorkScreen(staged) };
}

/** What a quick-fix's entry and build leave on its manifest: its build's record and its fixes'. */
const BUILT = Object.freeze(['build', 'fixes']);

/**
 * The manifest re-typed in place, with its new description: everything a
 * quick-fix's entry and build left on it and a bugfix's investigation item
 * dropped, so the new type starts as one before its spec, and the new
 * type's one topic added to its first phase, unstarted.
 * @param {Record<string, any>} manifest @param {string} to @param {string} description
 */
function retype(manifest, to, description) {
  manifest.work_type = to;
  manifest.description = description;
  for (const key of BUILT) delete manifest[key];
  const phases = ensureContainer(manifest, 'phases', 'phases');
  delete phases.investigation;
  const opens = OPENS_IN[to];
  ensureContainer(ensureContainer(phases, opens, `phases.${opens}`), 'items', `phases.${opens}.items`)[manifest.name] = { status: 'unstarted' };
}

/**
 * Both manifests' halves of the move in one save: the unit re-typed, and
 * its registration.
 * @param {string} cwd @param {string} unit @param {string} to @param {string} description
 */
function saveMoved(cwd, unit, to, description) {
  withWorkUnitLock(cwd, unit, () => {
    const manifest = loadWorkUnitManifest(cwd, unit);
    retype(manifest, to, description);
    withProjectLock(cwd, () => {
      const project = readProjectManifest(cwd);
      ensureContainer(ensureContainer(project, 'work_units', 'work_units'), unit, `work_units.${unit}`).work_type = to;
      writeProjectManifestAtomic(cwd, project);
    });
    saveWorkUnitManifest(cwd, unit, manifest);
  });
}

/**
 * The unit's lines the yes carries to its topic, with the files they name:
 * every line made in it but discovery's (the header's) — refused where any
 * is held and no conversation names the session the carry is made in.
 * @param {string} root @param {string} unit @param {string[]} warnings
 * @returns {{ids: string[], files: Set<string>}}
 */
function carriedLines(root, unit, warnings) {
  const lines = linesOf(root, unit, warnings, ({ phase }) => phase !== 'discovery');
  if (lines.ids.length > 0 && handedSession() === null) {
    throw new Error(`${unit} holds ledger entries, which the move carries to its topic in this conversation — Claude Code hands every command it runs a session id, and this one has none`);
  }
  return lines;
}

/**
 * What a quick-fix's move closes of its fixes: the branch the checkout was
 * taken back to, null where it was not, and the fixes it closed.
 * @typedef {{checkout: string|null, closed: string[]}} ClosedFixes
 */

/** A bugfix's move, which has no fixes. @type {ClosedFixes} */
const NO_FIXES = Object.freeze({ checkout: null, closed: [] });

/**
 * A quick-fix's fixes closed for its move (the header's): the checkout
 * taken back to the branch they land on, then each not yet ended closed.
 * @param {string} cwd @param {string} unit @param {TaskRow[]} fixes the tracker's
 * @param {string} to @param {string[]} warnings
 * @returns {ClosedFixes}
 */
function closeFixes(cwd, unit, fixes, to, warnings) {
  const checkout = checkOutLanding(cwd, unit);
  const closed = fixes.filter(({ status }) => !ENDED.includes(status)).map(({ ref }) => {
    const { warnings: said = [] } = /** @type {{warnings?: string[]}} */ (runTaskVerb(cwd, 'close', [unit, shownTask(ref)], { reason: `${unit} moved to ${aType(to)}` }));
    warnings.push(...said);
    return shownTask(ref);
  });
  return { checkout, closed };
}

/**
 * The old type's files set aside in the topic's earlier material, each
 * where it is still held. @param {string} cwd @param {[string, string][]} asides
 */
function setFilesAside(cwd, asides) {
  for (const [from, to] of asides) {
    if (!fs.existsSync(statePath(cwd, from))) continue;
    fs.mkdirSync(path.dirname(statePath(cwd, to)), { recursive: true });
    fs.renameSync(statePath(cwd, from), statePath(cwd, to));
  }
}

/**
 * `start-this-work yes` over a staged move: the unit moved as one
 * transaction (the header's), handing off into the new type's first phase.
 * @param {string} cwd @param {StagedMove} staged
 * @returns {Record<string, unknown>}
 */
function moveYes(cwd, staged) {
  const { name: unit, type: to, description } = staged;
  const root = stateRoot(cwd);
  const manifest = loadWorkUnitManifest(cwd, unit);
  const fixes = checkMove(cwd, manifest, to);
  const from = manifest.work_type;
  const quickFix = from === 'quick-fix';
  const begun = quickFix && fixesBegun(manifest);
  const draft = draftIn(cwd, staged.brief, 'the brief');
  const asides = SET_ASIDE[from](unit);
  /** @type {string[]} */
  const warnings = [];
  carriedLines(root, unit, warnings);

  return withStateLock(root, () => {
    const { checkout, closed } = quickFix ? closeFixes(cwd, unit, fixes, to, warnings) : NO_FIXES;
    const lines = carriedLines(root, unit, warnings);
    if (lines.ids.length > 0) {
      appendEntry(root, { event: 'rehomed', unit, topic: unit, phase: OPENS_IN[to], session: handedSession(), lines: lines.ids, files: movedFiles(lines.files, asides) }, warnings);
    }
    const branches = quickFix ? setFixesAside(cwd, unit) : [];
    const store = begun ? removePhase(cwd, unit, FIXES_PHASE.number) : [];
    setFilesAside(cwd, asides);
    writeBrief(cwd, unit, unit, draft.content);
    saveMoved(cwd, unit, to, description);
    fs.rmSync(draft.scratch, { force: true });
    fs.rmSync(stagedFile(cwd), { force: true });

    reindexWorkUnit(cwd, unit, warnings, { clearFirst: true });
    const paths = [unit, PROJECT_MANIFEST_SPEC, ...store];
    const message = `workflow(${unit}): move ${from} to ${to}`;
    const outcome = lines.ids.length > 0 ? commitLedger(cwd, message, warnings, paths) : commitStateTail(cwd, paths, message, warnings);
    /** @type {Record<string, unknown>} */
    const result = {
      work_unit: unit,
      work_type: to,
      from,
      brief: statePath(cwd, briefFile(unit, unit)),
      fixes_closed: closed,
      branches,
      checkout,
      committed: outcome.committed,
      next: nextAfter(to, unit),
    };
    if (warnings.length > 0) result.warnings = warnings;
    noteCommitOutcome(result, outcome);
    return result;
  });
}

module.exports = { stageMove, moveYes, isMove };
