'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a review round recorded, and the review phase's screens
// (§14) — `review round <unit> --file <round.json>`, `review notes <unit>
// --file <notes.json>`, `render review-report <unit> [--round N]` and
// `render review-calls <unit>`.
//
// `review round` records the round under review (review-phase.cjs) from
// Claude's account of it, `{can_now, findings, settled?}`: what the person
// can now do, each a line; each finding with the area it is of — one the
// round reads, `tests` for the test surface — its scope, `in` or `out` of
// the change, its call, its text, the items of the round's reports it
// answers — each finding `{report}#{n}`, each note for later `{report}#n{k}`,
// each builder's note standing (review-phase.cjs) `notes#{k}`, a finding
// answering those alone of the area `notes`, and in a bugfix's round 1
// `unfixed#1`, serious, where its reproducing test passed on the unfixed
// code again (bug-proven.cjs, 15.5.6) — and where it landed, one of:
//   fix     a fix task, in scope: a task of the round's fix phase, past the
//           cut (P14), the tracker holding it, not closed (14.3.2, 14.3.4);
//   inbox   the item filed for it, out of scope: a live inbox item
//           (`inbox file`, 14.3.5);
//   drop    why it was dropped — in scope, below the floor or not real
//           (14.3.1); out of scope, by Claude's judgment (14.3.7);
// with `ledger`, Claude's file-or-drop call at `{unit}.review`, beside each
// finding out of scope and each serious or bug in scope dropped, so every
// such call is counted for the person (14.3.7); and how Claude settled the
// round, where it failed and makes no fix task — its findings fixed in
// earlier rounds or dropped so (14.6.3). It reads every report the round
// asks for (reportNames) by a review round's grammar (review-report.cjs):
// every item of every report, nits and notes for later among them, is
// answered by exactly one finding, two reviewers' one bug one finding, at no
// lesser call than the findings it answers; a note lies beyond the change,
// so a finding answering one is out of scope, filed or dropped, never a
// fix; the round passes where every report does and, in a bugfix's round 1,
// no run of its reproducing test on the unfixed code since the review
// began passed — Claude never types a verdict. What each scenario of the
// cut stands at, read at the change's tips (review-change.cjs, runs.cjs),
// is recorded with it (15.3.3, 15.5.6). Then it writes the round's record, its report — the
// closing report where the round ends the review phase (14.4.3), what each
// round decided, its fix tasks as filed, and the calls decided for the
// person counted as the round is recorded — and its checks, every report
// read whole (14.4.2), drops its round's snapshot, and commits them with
// the reports.
//
// `review notes` answers the builders' notes standing once the round that
// ended the phase has its fix tasks done — notes no round is left to
// answer — from Claude's account, `{findings}`, each finding as a round's,
// of the area `notes`, every note standing answered by exactly one; their
// findings join that round's record, its report written again with them,
// and both are committed — a quick-fix's review handing back to its close
// where that ends it, as `review round` does, and as the last of its fix
// tasks done or closed does (`handBack`, task-verbs.cjs). It refuses,
// opening `review notes: ` and writing
// nothing: a unit whose review phase cannot be entered; a round under
// review, which answers them; the round's fix tasks waiting; no note
// standing; and a payload of another shape, every fault named.
//
// `quick-fix notes <unit> --file <notes.json>` answers, at a quick-fix's
// close where no review was asked for, the notes for later its fixes'
// builders and pairs banked (`task note`, notes.cjs), which no phase's
// consolidation takes: from Claude's account, `{findings}`, each finding as
// a round's, of the area `notes`, out of scope, every note standing
// (review-phase.cjs, `notesStanding`) answered by exactly one, filed to the
// inbox or dropped, its `ledger` Claude's call at
// `{unit}.implementation`. They are kept after those answered before at
// `build/notes-answered.json` (notes.cjs, `answeredAtClose`) and committed
// (`quick-fix({unit}): notes for later answered`), so none stands at the
// close, nor in a review asked for after it (R24). It refuses, opening
// `quick-fix notes: ` and writing nothing: a unit the project lacks or
// holds not in progress; one that is no quick-fix built as one; a
// quick-fix whose review was asked for, which answers them (`review
// notes`); no note standing; and a payload of another shape, every fault
// named.
//
// It refuses, opening `review round: ` and writing nothing: a unit whose
// review phase cannot be entered; a round that cannot be read — one ended
// the phase, fix tasks of the round before wait, a later round's areas are
// not named; a bugfix's round 1 before its reproducing test has run on the
// unfixed code again since the review began, naming the call that runs it
// (15.5.6); no snapshot of the round's held, its cache lost or an earlier
// round's held, each named, and `review accept-tree`, which on the person's
// word takes the tree as it is; a working tree outside `.leeway/` changed
// since the round's snapshot, naming every path, nothing put back unasked —
// `render review-tree` asks the person whether it is put back or kept
// (review-tree.cjs, 12.7.8, 14.S13); a report missing or not reading; a payload of another shape,
// every fault named; and a failing round neither fixed nor settled. It runs
// under the writer lock (engine.cjs); a commit git refuses is a warning,
// the files written.
//
// The report's screen draws a round's report, the last by default, from
// the records to it, each round with the fix tasks it made, each standing
// as the tracker holds it now — built where done, not built where closed,
// else to fix (14.4.1) — and the calls decided for the person counted as
// they stand now, as the calls' screen lists them across the unit
// (review-phase.cjs, 14.4.4).
// ---------------------------------------------------------------------------

const fs = require('fs');
const { statePath, stateRoot } = require('../kernel/state-root.cjs');
const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { trackedLists } = require('./task-verbs.cjs');
const { parseShownTask, shownTask, phaseName } = require('./task-id.cjs');
const { filled, shaped, listed, readPayload, refusing } = require('./staged-payload.cjs');
const { READERS, readersDone } = require('./scratch.cjs');
const { refuserFor, committed } = require('./task-account.cjs');
const { readReviewReport } = require('./review-report.cjs');
const { readShown } = require('./ledger-read.cjs');
const { parseInboxPath, FOLDER_KIND } = require('./inbox.cjs');
const { titleOf } = require('./start.cjs');
const { unitInProgress } = require('./topic-standing.cjs');
const { itemTitle, topicTitles, quickFixBuild, reviewAsked, buildRefusal } = require('./derivations.cjs');
const { closeNotesPath, answeredAtClose } = require('./notes.cjs');
const { reading, reposOf } = require('./phase-checks.cjs');
const { readSpec, specStatements } = require('./spec-sections.cjs');
const { changeOf, cutStandings } = require('./review-change.cjs');
const { fixAcceptance, fixScenarios } = require('./fix-acceptance.cjs');
const { reviewHeld } = require('./review-entry.cjs');
const {
  UNFIXED_ITEM, isBugfix, bugRuns, rerunRefusal, rerunPassed,
} = require('./bug-proven.cjs');
const {
  NOTES, isBuilderNote, reportNames, notesStanding, reviewStanding, roundRefusal, endedWords, recordedRounds, fixesOf, endsReview, fixPhase, roundRecordPath, roundReportFile, roundChecksFile, roundFolder,
  snapshotRound, dropSnapshot, treeChanges, setAsideHeld, unitCalls, reviewCallFault, forThePerson, inTheBuild,
} = require('./review-phase.cjs');
const {
  roundReport, closingReport, reportScreen, reviewCallsScreen,
} = require('./projections/review-phase.cjs');

/** @typedef {import('./review-phase.cjs').RoundRecord} RoundRecord */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */
/** @typedef {import('./review-phase.cjs').RoundFinding} RoundFinding */
/** @typedef {import('./projections/review-phase.cjs').RoundView} RoundView */

const SCOPES = ['in', 'out'];
/** The calls, gravest first. */
const CALLS = ['serious', 'bug', 'nit'];
const LANDS = ['fix', 'inbox', 'drop'];
/** A note for later's kind among a round's items, beside the findings' calls. */
const NOTE = 'note';

/** A round's report read, by its file's name in the round's folder, with its findings' calls and how many notes for later it holds. @typedef {{name: string, text: string, verdict: 'pass'|'fail', calls: string[], notes: number}} ReadReport */

/**
 * Every report the round asks for, read, or what stands in the way.
 * @param {string} cwd @param {string} unit @param {number} round @param {string[]} reads
 * @returns {{faults: string[], reports: ReadReport[]}}
 */
function roundReports(cwd, unit, round, reads) {
  /** @type {{faults: string[], reports: ReadReport[]}} */
  const found = { faults: [], reports: [] };
  for (const name of reportNames(reads)) {
    const rel = `${roundFolder(unit, round)}/${name}`;
    const file = statePath(cwd, rel);
    if (!fs.existsSync(file)) {
      found.faults.push(`round ${round} has no report at ${rel}`);
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    try {
      const { verdict, findings, notes } = readReviewReport(text);
      found.reports.push({ name, text, verdict, calls: findings.map(({ call }) => call), notes });
    } catch (err) {
      found.faults.push(`${rel} does not read as a reviewer's report — ${messageOf(err)}; brief its reviewer again, and its report replaces it`);
    }
  }
  return found;
}

/** Each builder's note standing as an item of a round, a note. @param {string[]} notes @returns {[string, string][]} */
const noteItems = (notes) => notes.map((item) => [item, NOTE]);

/**
 * Every item of the round by its kind: each finding of its reports,
 * `{report}#{n}`, by its call; each note for later, `{report}#n{k}`, and
 * each builder's note standing, `notes#{k}`, a note; and where a bugfix's
 * reproducing test passed on the unfixed code again, `unfixed#1`, serious.
 * @param {ReadReport[]} reports @param {string[]} notes @param {boolean} rerunPass @returns {Map<string, string>}
 */
const roundItems = (reports, notes, rerunPass) => new Map([...reports.flatMap(({ name, calls, notes: noted }) => {
  const report = name.replace(/\.md$/, '');
  /** @type {[string, string][]} */
  const findings = calls.map((call, at) => [`${report}#${at + 1}`, call]);
  return [...findings, ...Array.from({ length: noted }, (_, at) => /** @type {[string, string]} */ ([`${report}#n${at + 1}`, NOTE]))];
}), ...noteItems(notes), ...(rerunPass ? [/** @type {[string, string]} */ ([UNFIXED_ITEM, CALLS[0]])] : [])]);

/**
 * A bugfix's round 1 held to its reproducing test run on the unfixed code
 * again since the review began, refused where it has not (15.5.6): whether
 * such a run passed; false for any other round or unit.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {number} round @param {(reason: string) => never} refuse
 */
function rerunHeld(cwd, unit, manifest, round, refuse) {
  if (round !== 1 || !isBugfix(manifest)) return false;
  const runs = bugRuns(cwd, unit, manifest);
  const refused = rerunRefusal(unit, runs);
  if (refused !== null) refuse(refused);
  return rerunPassed(runs.reruns);
}

/** The calls above a nit. */
const GRAVE = CALLS.slice(0, 2);

/** Whether a finding needs Claude's file-or-drop call: out of scope, or in scope and dropped above a nit (14.3.7). @param {Record<string, any>} finding */
const needsCall = (finding) => finding.scope === 'out' || (Object.hasOwn(finding, 'drop') && GRAVE.includes(finding.call));

/**
 * Where a finding landed refused, every fault named: a fix not of the
 * round's fix phase, the tracker lacking it or having closed it; an item
 * not in the live inbox; a drop with no why; a ledger call where none
 * belongs, or none where one does, or one that is no file-or-drop call.
 * @param {{unit: string, phase: number, statuses: Map<string, string>, call: (id: string) => string|null, cwd: string}} at
 * @param {Record<string, any>} finding @param {string} what
 * @returns {string[]}
 */
function landingFaults(at, finding, what) {
  const lands = LANDS.filter((key) => Object.hasOwn(finding, key));
  if (lands.length !== 1) return [`${what} lands in one of fix, inbox or drop, never ${lands.length === 0 ? 'none' : 'two'}`];
  const [land] = lands;
  const out = finding.scope === 'out';
  /** @type {string[]} */
  const faults = [];
  if (land === 'fix') faults.push(...(out ? [`${what} is out of scope, and a fix task is for a finding in scope (14.3.2)`] : fixFaults(at, finding.fix, what)));
  if (land === 'inbox') faults.push(...(out ? inboxFaults(at.cwd, finding, what) : [`${what} is in scope, and a finding in scope is fixed or dropped, never filed (14.3.2)`]));
  if (land === 'drop' && !filled(finding.drop)) faults.push(`${what} is dropped with no why`);
  if (needsCall(finding)) faults.push(...ledgerFaults(at, finding.ledger, what));
  else if (Object.hasOwn(finding, 'ledger')) faults.push(`${what} names a ledger call, which only a finding out of scope, or one in scope dropped above a nit, is filed or dropped by`);
  return faults;
}

/** A finding's file-or-drop call refused where it names none, or one that is no such call (14.3.7). @param {{call: (id: string) => string|null}} at @param {unknown} ledger @param {string} what */
function ledgerFaults({ call }, ledger, what) {
  if (!filled(ledger)) return [`${what} names no ledger call filing or dropping it — Claude's call at the review, counted for the person (14.3.7)`];
  const fault = call(String(ledger));
  return fault === null ? [] : [`${what}: ${fault}`];
}

/** @param {{unit: string, phase: number, statuses: Map<string, string>}} at @param {unknown} fix @param {string} what */
function fixFaults({ unit, phase, statuses }, fix, what) {
  let ref;
  try {
    ref = parseShownTask(unit, String(fix));
  } catch (err) {
    return [`${what}: ${messageOf(err)}`];
  }
  if (ref.phase !== phase) return [`${what} names task ${fix}, which is no task of ${phaseName(unit, phase)}, this round's fix phase`];
  const status = statuses.get(shownTask(ref));
  if (status === undefined) return [`${what} names task ${fix}, which the tracker does not hold — write it first: task create ${unit} ${phase} --file <task>`];
  return status === 'closed' ? [`${what} names task ${fix}, which the tracker has closed`] : [];
}

/**
 * An item filed refused where it is no live inbox item; else its path set
 * on the finding from the state's root, as the record keeps it.
 * @param {string} cwd @param {Record<string, any>} finding @param {string} what
 */
function inboxFaults(cwd, finding, what) {
  let rel;
  try {
    rel = parseInboxPath(cwd, String(finding.inbox), { archived: false }).rel;
  } catch (err) {
    return [`${what}: ${messageOf(err)}`];
  }
  if (!fs.existsSync(statePath(cwd, rel))) return [`${what} names ${finding.inbox}, which the inbox does not hold — file it first: inbox file <unit> --file <item>`];
  finding.inbox = rel;
  return [];
}

/**
 * The report items a finding answers refused, every fault named: none, one
 * no report of the round holds, a note for later answered in scope, or a
 * call lesser than the findings'.
 * @param {Map<string, string>} items @param {Record<string, any>} finding @param {string} what @returns {string[]}
 */
function fromFaults(items, finding, what) {
  if (!Array.isArray(finding.from) || finding.from.length === 0 || !finding.from.every(filled)) return [`${what} answers no report item — name each in from, as 1-cards-a#1`];
  const unheld = finding.from.filter((/** @type {string} */ item) => !items.has(item));
  if (unheld.length > 0) return [`${what} names ${unheld.join(', ')}, which no report the round read holds`];
  const kinds = finding.from.map((/** @type {string} */ item) => /** @type {string} */ (items.get(item)));
  /** @type {string[]} */
  const faults = kinds.includes(NOTE) && finding.scope !== 'out' ? [`${what} answers a note for later, which lies beyond the change — its scope is out, and it is filed or dropped, never fixed`] : [];
  const gravest = Math.min(...kinds.map((kind) => CALLS.indexOf(kind)).filter((at) => at >= 0));
  if (CALLS.indexOf(String(finding.call)) > gravest) faults.push(`${what} is a ${finding.call}, and the report items it answers call it a ${CALLS[gravest]}`);
  return faults;
}

/** Every item of the round's reports answered by exactly one finding, else each left out and each named twice. @param {Map<string, string>} items @param {Record<string, any>[]} findings */
function coverageFaults(items, findings) {
  /** @type {Map<string, number[]>} */
  const naming = new Map([...items.keys()].map((item) => [item, []]));
  findings.forEach(({ from }, at) => {
    for (const item of Array.isArray(from) ? new Set(from) : []) naming.get(item)?.push(at + 1);
  });
  return [...naming].flatMap(([item, by]) => {
    if (by.length === 0) return [`${item} is answered by no finding — every item of every report lands in the round's record (14.3.1)`];
    return by.length > 1 ? [`${item} is named by findings ${by.join(' and ')}, and is one finding's`] : [];
  });
}

/**
 * A finding's area refused where it is none the round reads, nor `notes`
 * for one answering builders' notes alone — said so where it answers one.
 * @param {Record<string, any>} finding @param {string[]} reads @param {string} what @returns {string[]}
 */
function areaFaults({ area, from }, reads, what) {
  if (reads.includes(String(area))) return [];
  const notes = (Array.isArray(from) ? from : []).filter((item) => isBuilderNote(String(item)));
  if (area === NOTES && notes.length > 0 && notes.length === from.length) return [];
  const read = reads.length === 0 ? '' : ` — it reads ${reads.join(', ')}`;
  return [`${what} is of ${JSON.stringify(area)}, which the round does not read${read}${notes.length === 0 ? '' : `; a finding answering builders' notes alone is of ${NOTES}`}`];
}

/**
 * Each finding of an account read, its every fault pushed to `faults`, and
 * every item answered by exactly one.
 * @param {Parameters<typeof landingFaults>[0]} at @param {unknown} given @param {string[]} reads @param {Map<string, string>} items @param {string[]} faults
 * @returns {RoundFinding[]}
 */
function findingsOf(at, given, reads, items, faults) {
  const findings = listed(given, 'findings').map((finding, i) => {
    const what = `finding ${i + 1}`;
    const shape = shaped(finding, what, ['area', 'scope', 'call', 'text', 'from'], [...LANDS, 'ledger']);
    faults.push(...areaFaults(shape, reads, what));
    if (!SCOPES.includes(String(shape.scope))) faults.push(`${what}'s scope is in or out`);
    if (!CALLS.includes(String(shape.call))) faults.push(`${what}'s call is serious, bug or nit`);
    if (!filled(shape.text)) faults.push(`${what} says nothing`);
    faults.push(...fromFaults(items, shape, what), ...landingFaults(at, shape, what));
    return /** @type {RoundFinding} */ (shape);
  });
  faults.push(...coverageFaults(items, findings));
  return findings;
}

/**
 * Claude's account of the round, its every fault named.
 * @param {Parameters<typeof landingFaults>[0]} at @param {unknown} given @param {string[]} reads @param {Map<string, string>} items
 * @returns {{can_now: string[], findings: RoundFinding[], settled: string|null}}
 */
function accountOf(at, given, reads, items) {
  const round = shaped(given, 'the round', ['can_now', 'findings'], ['settled']);
  /** @type {string[]} */
  const faults = [];
  const canNow = listed(round.can_now, 'can_now');
  if (!canNow.every(filled)) faults.push('each of can_now is a line of what the person can now do');
  const findings = findingsOf(at, round.findings, reads, items, faults);
  if (round.settled !== undefined && !filled(round.settled)) faults.push('settled says how Claude settled the round');
  if (faults.length > 0) throw new Error(faults.join('; '));
  return { can_now: /** @type {string[]} */ (canNow), findings, settled: round.settled === undefined ? null : String(round.settled) };
}

/** The round's fix phase's tasks, shown, by status. @param {string} cwd @param {string} unit @param {number} phase */
function phaseStatuses(cwd, unit, phase) {
  const [rows] = withStateLock(stateRoot(cwd), () => trackedLists(cwd, unit, [phase])).phases;
  return new Map((rows ?? []).map(({ ref, status }) => [shownTask(ref), status]));
}

/**
 * What each scenario of the cut stands at, at the change's tips — the
 * code the round read.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {number} round @param {Repo[]} repos
 */
function scenarioStandings(cwd, unit, manifest, round, repos) {
  return cutStandings(cwd, unit, manifest, changeOf(cwd, unit, fixPhase(manifest, round), null, repos));
}

/**
 * The round under review, the unit as it reads and the project's repos,
 * refused where its review phase cannot be entered or the round cannot be
 * read.
 * @param {string} cwd @param {string} unit
 */
function roundUnderReview(cwd, unit) {
  const at = reading(cwd, unit, refusing('review round', () => unitInProgress(cwd, unit)));
  const standing = refusing('review round', () => reviewHeld(at, roundRefusal));
  return {
    manifest: at.manifest, ...standing, reads: /** @type {string[]} */ (standing.reads), repos: reposOf(at),
  };
}

/** The tree held to its round's snapshot, refused where it is not held or the tree moved since (the header's). @param {string} cwd @param {string} unit @param {number} round @param {Repo[]} repos @param {(reason: string) => never} refuse */
function treeHeld(cwd, unit, round, repos, refuse) {
  const held = snapshotRound(cwd, unit);
  if (held !== round) {
    const why = held === null ? 'its cache is gone' : `the one held is round ${held}'s`;
    refuse(`no snapshot of round ${round}'s working tree is held — ${why}, and nothing is taken of the tree unasked: render review-tree ${unit} asks the person whether it stands as it is`);
  }
  const changed = treeChanges(cwd, unit, repos);
  if (changed.length > 0) {
    refuse(`the working tree outside .leeway/ changed since the snapshot the round is held to: ${changed.join(', ')} — nothing is put back unasked: render review-tree ${unit} asks the person whether it is put back or kept`);
  }
}

/** The checks a round read, every report whole, each under a heading naming it (14.4.2). @param {number} round @param {ReadReport[]} reports */
function checksText(round, reports) {
  return [`# Round ${round}'s checks`, ...reports.map(({ name, text }) => `# ${name.replace(/\.md$/, '')}\n\n${text.trimEnd()}`)].join('\n\n') + '\n';
}

/** A round's verdict held to its fixes and its settlement, refused where they do not fit it (14.6.3). @param {number} round @param {string} unit @param {number} phase @param {RoundRecord} record @param {(reason: string) => never} refuse */
function verdictHeld(round, unit, phase, record, refuse) {
  const fixes = fixesOf(record).length;
  if (record.passed && record.settled !== null) refuse('round passed, and only a failing round is settled');
  if (record.settled !== null && fixes > 0) refuse(`round ${round} is settled, and makes fix tasks — a round settled makes none, its failing findings fixed in earlier rounds or dropped`);
  if (!record.passed && fixes === 0 && record.settled === null) {
    refuse(`round ${round} failed — write its fixes as tasks of ${phaseName(unit, phase)} and name each on its finding, or say how it is settled`);
  }
}

/**
 * `review round`: the round under review recorded, its report and checks
 * written, its snapshot dropped, and all committed with its reports (the
 * header's).
 * @param {string} cwd @param {string} unit @param {string} file
 */
function recordRound(cwd, unit, file) {
  const said = 'review round';
  const refuse = refuserFor(said);
  const {
    manifest, areas, rounds, round, reads, notes, repos,
  } = roundUnderReview(cwd, unit);
  const rerunPass = rerunHeld(cwd, unit, manifest, round, refuse);
  treeHeld(cwd, unit, round, repos, refuse);
  const { faults, reports } = roundReports(cwd, unit, round, reads);
  if (faults.length > 0) refuse(faults.join('; '));
  const phase = fixPhase(manifest, round);
  /** @type {string[]} */
  const warnings = [];
  const account = refusing(said, () => readShown(stateRoot(cwd), warnings, (shower) => accountOf({
    unit, phase, cwd, statuses: phaseStatuses(cwd, unit, phase), call: (id) => reviewCallFault(shower, unit, id),
  }, readPayload(cwd, file), reads, roundItems(reports, notes, rerunPass))));
  /** @type {RoundRecord} */
  const record = {
    reports: reports.map(({ name }) => name),
    passed: !rerunPass && reports.every(({ verdict }) => verdict === 'pass'),
    can_now: account.can_now,
    findings: account.findings,
    settled: account.settled,
    scenarios: [],
  };
  verdictHeld(round, unit, phase, record, refuse);
  record.scenarios = refusing(said, () => scenarioStandings(cwd, unit, manifest, round, repos));
  const recorded = [...rounds, record];
  const rels = [roundRecordPath(unit, round), roundReportFile(unit, round), roundChecksFile(unit, round)];
  writeJsonAtomic(statePath(cwd, rels[0]), record);
  fs.writeFileSync(statePath(cwd, rels[1]), `${reportText(cwd, unit, manifest, recorded, null, warnings)}\n`);
  fs.writeFileSync(statePath(cwd, rels[2]), checksText(round, reports));
  dropSnapshot(cwd, unit);
  readersDone(cwd, READERS.round(unit));
  const fixes = fixesOf(record);
  const ends = endsReview(record);
  return committed(cwd, [...rels, ...reports.map(({ name }) => `${roundFolder(unit, round)}/${name}`)], `review(${unit}): round ${round}`, warnings, {
    round,
    passed: record.passed,
    fixes,
    ends,
    ...(fixes.length === 0 ? {} : { fix_phase: phase }),
    ...(ends ? {} : { reads_at_least: reviewStanding(reading(cwd, unit, manifest)).required }),
    areas: areas.map(({ name }) => name),
    ...closeNext(cwd, unit, manifest, ends),
  });
}

/**
 * Where a quick-fix's review hands back once a round ends it and it is
 * over: its close, in the same conversation (19.5.14, 24.1.3), whose
 * checklist then carries the review passed — nothing for any other unit,
 * nor while the round's fix tasks or its builders' notes hold it open.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {boolean} ends
 * @returns {{next?: {kind: 'engine', argv: string[]}}}
 */
function closeNext(cwd, unit, manifest, ends) {
  if (!ends || !quickFixBuild(manifest) || !reviewStanding(reading(cwd, unit, manifest)).over) return {};
  return { next: { kind: 'engine', argv: ['render', 'finish', unit] } };
}

/**
 * The same hand-back made by what ends the review after the round that
 * ended it — the last of its fix tasks done or closed (task-verbs.cjs), or
 * its builders' notes answered: the close, where a quick-fix's review asked
 * for at its close has ended and is now over (`closeNext`).
 * @param {string} cwd @param {string} unit
 * @returns {{next?: {kind: 'engine', argv: string[]}}}
 */
function handBack(cwd, unit) {
  const manifest = loadWorkUnitManifest(cwd, unit);
  if (!quickFixBuild(manifest) || !reviewAsked(manifest)) return {};
  return closeNext(cwd, unit, manifest, reviewStanding(reading(cwd, unit, manifest)).ended);
}

/** Why the builders' notes cannot be answered on their own, or null: a round under review answers them, the round that ended the phase waits on its fix tasks, or none stands. @param {string} unit @param {import('./review-phase.cjs').ReviewStanding} standing */
function notesRefusal(unit, standing) {
  if (!standing.ended) return roundRefusal(unit, standing) ?? `round ${standing.round} is under review, and answers the builders' notes standing among its items — review round ${unit} --file <round.json>`;
  if (standing.waiting.length > 0) return `${endedWords(unit, standing)} — its fix tasks are built first, then the notes their builders left are answered: task ${standing.waiting.join(', task ')}`;
  return standing.notes.length === 0 ? `no builder's note stands unanswered — ${endedWords(unit, standing)}, and finish is next` : null;
}

/**
 * `review notes`: the builders' notes standing, answered once the round
 * that ended the review phase has its fix tasks done, their findings
 * joining its record and its report written again (the header's).
 * @param {string} cwd @param {string} unit @param {string} file
 */
function answerNotes(cwd, unit, file) {
  const said = 'review notes';
  const manifest = refusing(said, () => unitInProgress(cwd, unit));
  const { rounds, notes } = refusing(said, () => reviewHeld(reading(cwd, unit, manifest), notesRefusal));
  const round = rounds.length;
  /** @type {string[]} */
  const warnings = [];
  const findings = refusing(said, () => readShown(stateRoot(cwd), warnings, (shower) => {
    const given = shaped(readPayload(cwd, file), 'the notes\' answers', ['findings'], []);
    /** @type {string[]} */
    const faults = [];
    const answered = findingsOf({
      unit, phase: fixPhase(manifest, round), cwd, statuses: new Map(), call: (id) => reviewCallFault(shower, unit, id),
    }, given.findings, [], new Map(noteItems(notes)), faults);
    if (faults.length > 0) throw new Error(faults.join('; '));
    return answered;
  }));
  const record = /** @type {RoundRecord} */ (rounds.at(-1));
  const recorded = [...rounds.slice(0, -1), { ...record, findings: [...record.findings, ...findings] }];
  const rels = [roundRecordPath(unit, round), roundReportFile(unit, round)];
  writeJsonAtomic(statePath(cwd, rels[0]), recorded.at(-1));
  fs.writeFileSync(statePath(cwd, rels[1]), `${reportText(cwd, unit, manifest, recorded, null, warnings)}\n`);
  return committed(cwd, rels, `review(${unit}): round ${round}'s builders' notes`, warnings, { round, answered: notes, ...closeNext(cwd, unit, manifest, true) });
}

/**
 * Why a unit's notes for later are not answered at its close, or null: it
 * is no quick-fix built as one, or its review was asked for, which answers
 * them.
 * @param {string} unit @param {Record<string, any>} manifest @returns {string|null}
 */
function closeNotesRefusal(unit, manifest) {
  if (!quickFixBuild(manifest)) return buildRefusal(manifest) ?? `${unit} is no quick-fix built as one — its notes for later are taken by its phases' consolidation and its review`;
  return reviewAsked(manifest) ? `${unit}'s review was asked for at its close, and answers its notes for later — review notes ${unit} --file <notes.json>` : null;
}

/**
 * `quick-fix notes`: a quick-fix's notes for later answered at its close,
 * kept after those answered before (the header's).
 * @param {string} cwd @param {string} unit @param {string} file
 */
function answerCloseNotes(cwd, unit, file) {
  const said = 'quick-fix notes';
  const refuse = refuserFor(said);
  const manifest = refusing(said, () => unitInProgress(cwd, unit));
  const refused = closeNotesRefusal(unit, manifest);
  if (refused !== null) refuse(refused);
  const notes = notesStanding(cwd, unit, recordedRounds(cwd, unit));
  if (notes.length === 0) refuse(`no note for later stands unanswered in ${unit}`);
  /** @type {string[]} */
  const warnings = [];
  const findings = refusing(said, () => readShown(stateRoot(cwd), warnings, (shower) => {
    const given = shaped(readPayload(cwd, file), 'the notes\' answers', ['findings'], []);
    /** @type {string[]} */
    const faults = [];
    const answered = findingsOf({
      unit, phase: 0, cwd, statuses: new Map(), call: (id) => reviewCallFault(shower, unit, id, 'implementation'),
    }, given.findings, [], new Map(noteItems(notes)), faults);
    if (faults.length > 0) throw new Error(faults.join('; '));
    return answered;
  }));
  const rel = closeNotesPath(unit);
  writeJsonAtomic(statePath(cwd, rel), { findings: [...answeredAtClose(cwd, unit), ...findings] });
  return committed(cwd, [rel], `quick-fix(${unit}): notes for later answered`, warnings, { answered: notes });
}

/** An inbox item as a report names it: its title and kind; its file's name where it is gone or has no title. @param {string} cwd @param {string} rel */
function filedItem(cwd, rel) {
  const { folder, slug } = parseInboxPath(cwd, statePath(cwd, rel), { archived: false });
  const file = statePath(cwd, rel);
  return { title: (fs.existsSync(file) ? titleOf(fs.readFileSync(file, 'utf8')) : null) ?? slug, kind: FOLDER_KIND[folder] };
}

/**
 * Each fix task of the rounds' fix phases, shown, by its status in the
 * tracker now: what a report's screen draws each fix's standing from.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {number} rounds
 * @returns {Map<string, string>}
 */
function fixStatuses(cwd, unit, manifest, rounds) {
  const phases = Array.from({ length: rounds }, (_, at) => fixPhase(manifest, at + 1));
  const lists = withStateLock(stateRoot(cwd), () => trackedLists(cwd, unit, phases)).phases;
  return new Map(lists.flatMap((rows) => (rows ?? []).map(({ ref, status }) => [shownTask(ref), status])));
}

/** A fix's standing by its task's status in the tracker, `fixing` where it is neither. @type {Map<string, 'fixed'|'unbuilt'>} */
const FIX_STANDINGS = new Map([['done', 'fixed'], ['closed', 'unbuilt']]);

/**
 * A round as its report draws it, with the fix tasks it made, each with the
 * finding it answers. Where `statuses` gives the tracker's, each stands as
 * it does now (FIX_STANDINGS); where it is null, as the round's file keeps
 * them, as filed, no standing claimed.
 * @param {string} cwd @param {Record<string, any>} manifest @param {RoundRecord} record @param {number} round @param {Map<string, string>} wordings each scenario's @param {Map<string, string>|null} statuses
 * @returns {RoundView}
 */
function roundView(cwd, manifest, record, round, wordings, statuses) {
  const standing = (/** @type {string} */ task) => (statuses === null ? null : FIX_STANDINGS.get(statuses.get(task) ?? '') ?? 'fixing');
  return {
    round,
    passed: record.passed,
    settled: record.settled,
    can_now: record.can_now,
    scenarios: record.scenarios.map(({ scenario, standing: stands }) => ({ scenario, standing: stands, wording: wordings.get(scenario) ?? '' })),
    made: fixesOf(record).length,
    fixes: record.findings.flatMap(({ fix, text }) => (fix === undefined ? [] : [{ task: fix, text, standing: standing(fix) }])),
    phase: fixPhase(manifest, round),
    filed: [...new Set(record.findings.flatMap(({ inbox }) => (inbox === undefined ? [] : [inbox])))].map((rel) => filedItem(cwd, rel)),
  };
}

/** Each scenario's wording, by its id, the statements it draws on left to the spec — a quick-fix's as its fixes' acceptance words them (fix-acceptance.cjs). @param {string} cwd @param {string} unit @param {Record<string, any>} manifest */
function scenarioWordings(cwd, unit, manifest) {
  if (quickFixBuild(manifest)) return new Map(fixScenarios(fixAcceptance(cwd, unit)).map(({ scenario, wording }) => [scenario, wording]));
  return new Map(specStatements(readSpec(cwd, unit)).filter(({ kind }) => kind === 'scenario').map(({ number, wording }) => [number, wording.replace(/\s*\([^()]*\)$/, '')]));
}

/** The calls decided for the person across the unit, counted with the build's share; what the read warned of pushed to `warnings`. @param {string} cwd @param {string} unit @param {string[]} warnings */
function callsCount(cwd, unit, warnings) {
  const calls = readShown(stateRoot(cwd), warnings, (shower) => unitCalls(shower, unit)).filter(forThePerson);
  return { count: calls.length, build: calls.filter(inTheBuild).length };
}

/**
 * The last round's report as text: the closing report where the round ends
 * the review phase, else the round's own, the calls decided for the person
 * counted as it is drawn. Where `statuses` gives the tracker's, as the
 * screen draws it, with what put back set aside; where it is null, as the
 * last round's file keeps it as it is recorded — each fix task as filed
 * (roundView), the calls counted as of its record, and no set-aside, a
 * folder of this machine's the screen names while it holds anything.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {RoundRecord[]} rounds @param {Map<string, string>|null} statuses @param {string[]} warnings
 */
function reportText(cwd, unit, manifest, rounds, statuses, warnings) {
  const wordings = scenarioWordings(cwd, unit, manifest);
  const title = itemTitle(topicTitles(manifest), 'review', unit);
  const last = /** @type {RoundRecord} */ (rounds.at(-1));
  const view = (/** @type {number} */ round) => roundView(cwd, manifest, rounds[round - 1], round, wordings, statuses);
  const calls = { ...callsCount(cwd, unit, warnings), recorded: statuses === null ? rounds.length : null };
  const aside = statuses === null ? null : setAsideHeld(cwd, unit);
  if (endsReview(last)) return closingReport(unit, title, rounds.map((_, at) => view(at + 1)), calls, aside);
  return roundReport(unit, title, view(rounds.length), calls, aside);
}

/**
 * `render review-report <unit> [--round N]`: a round's report, the last by
 * default, drawn from the records to it, each fix's standing in the
 * tracker now and the calls as they stand now.
 * @param {string} cwd @param {{dotpath: string, round?: string}} args
 */
function reviewReportSurface(cwd, { dotpath: unit = '', round }) {
  return refusing('render review-report', () => {
    const manifest = unitInProgress(cwd, unit);
    const rounds = recordedRounds(cwd, unit);
    if (rounds.length === 0) throw new Error(`${unit}'s review phase has recorded no round yet — review round ${unit} --file <round.json> records one`);
    const at = round === undefined ? rounds.length : Number(round);
    if (!Number.isInteger(at) || at < 1 || at > rounds.length) throw new Error(`--round names a round recorded, 1 to ${rounds.length}`);
    const drawn = rounds.slice(0, at);
    return reportScreen(reportText(cwd, unit, manifest, drawn, fixStatuses(cwd, unit, manifest, at), []));
  });
}

/** `render review-calls <unit>`: every call decided for the person across the unit, by kind. @param {string} cwd @param {{dotpath: string}} args */
function reviewCallsSurface(cwd, { dotpath: unit = '' }) {
  return refusing('render review-calls', () => {
    const manifest = unitInProgress(cwd, unit);
    const calls = readShown(stateRoot(cwd), [], (shower) => unitCalls(shower, unit)).filter(forThePerson);
    return reviewCallsScreen(unit, itemTitle(topicTitles(manifest), 'review', unit), calls);
  });
}

module.exports = {
  recordRound, answerNotes, answerCloseNotes, handBack, reviewReportSurface, reviewCallsSurface,
};
