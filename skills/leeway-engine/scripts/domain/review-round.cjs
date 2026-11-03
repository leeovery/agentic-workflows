'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a review round recorded, and the review phase's screens
// (§14) — `review round <unit> --file <round.json>`, `render review-report
// <unit> [--round N]` and `render review-calls <unit>`.
//
// `review round` records the round under review (review-phase.cjs) from
// Claude's account of it, `{can_now, findings, settled?}`: what the person
// can now do, each a line; each finding with the area it is of — one the
// round reads, or `tests` for the test surface — its scope, `in` or `out`
// of the change, its call, its text, and where it landed, one of:
//   fix     a fix task, in scope: a task of the round's fix phase, past the
//           cut (P14), the tracker holding it, not closed (14.3.2, 14.3.4);
//   inbox   the item filed for it, out of scope: a live inbox item, with
//           `ledger`, the file call (`inbox file`, 14.3.5);
//   drop    why it was dropped — in scope, below the floor (14.3.1); out of
//           scope, with `ledger`, the drop call (14.3.7);
// and, for a failing round, how Claude settled what it did not fix
// (14.6.3). It reads every report the round asks for — each area's pair,
// and the test reader (reportNames) — by the reviewers' grammar
// (round-report.cjs), and the round passes where every one does: Claude
// never types a verdict. A failing round makes fix tasks or is settled.
// What each scenario of the cut stands at, read at the change's tips
// (review-change.cjs, runs.cjs), is recorded with it (15.3.3, 15.5.6).
// Then it writes the round's record, its report — the closing report where
// the round ends the review phase (14.4.3) — and its checks, every report
// read whole (14.4.2), and commits them with the reports.
//
// It refuses, opening `review round: ` and writing nothing: a unit whose
// review phase cannot be entered; a review phase over; a working tree
// outside `.leeway/` changed since the entry snapshotted it, naming every
// path — nothing is reverted, the person decides (12.7.8, 14.S13); no
// snapshot; a fix task of the round before not done; a report missing or
// not reading; a payload of another shape, every fault named; and a failing
// round neither fixed nor settled. It runs under the writer lock
// (engine.cjs); a commit git refuses is a warning, the files written.
//
// The report's screen draws a round's record, the last by default; once the
// review phase is over, the closing report. The calls' screen lists every
// call decided for the person across the unit (review-phase.cjs, 14.4.4).
// ---------------------------------------------------------------------------

const fs = require('fs');
const { statePath, stateRoot } = require('../kernel/state-root.cjs');
const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { trackedLists } = require('./task-verbs.cjs');
const { parseShownTask, shownTask, phaseName } = require('./task-id.cjs');
const { filled, shaped, listed, readPayload, refusing } = require('./staged-payload.cjs');
const { refuserFor, committed } = require('./task-account.cjs');
const { readReport } = require('./round-report.cjs');
const { readShown } = require('./ledger-read.cjs');
const { parseInboxPath, FOLDER_KIND } = require('./inbox.cjs');
const { unitInProgress } = require('./topic-standing.cjs');
const { itemTitle, topicTitles } = require('./derivations.cjs');
const { cutPhases } = require('./phase-checks.cjs');
const { readSpec, specStatements } = require('./spec-sections.cjs');
const { runsOf } = require('./runs.cjs');
const { changeOf, changeTips } = require('./review-change.cjs');
const { reviewRefusal, fixesWaiting, fixesWaitingWords } = require('./review-entry.cjs');
const {
  TESTS, reportNames, reviewStanding, recordedRounds, fixesOf, endsReview, fixPhase, roundRecordPath, roundReportFile, roundChecksFile, roundFolder,
  treeChanges, unitCalls, reviewCallFault, forThePerson, inTheBuild,
} = require('./review-phase.cjs');
const {
  roundReport, closingReport, reportScreen, reviewCallsScreen,
} = require('./projections/review-phase.cjs');

/** @typedef {import('./review-phase.cjs').RoundRecord} RoundRecord */
/** @typedef {import('./review-phase.cjs').RoundFinding} RoundFinding */
/** @typedef {import('./projections/review-phase.cjs').RoundView} RoundView */
/** @typedef {import('./projections/review-phase.cjs').CallsCount} CallsCount */

const SCOPES = ['in', 'out'];
const CALLS = ['serious', 'bug', 'nit'];
const LANDS = ['fix', 'inbox', 'drop'];

/** A round's report read, by its file's name in the round's folder. @typedef {{name: string, text: string, verdict: 'pass'|'fail'}} ReadReport */

/**
 * Every report the round asks for, read, or what stands in the way.
 * @param {string} cwd @param {string} unit @param {number} round @param {string[]} reads the areas it reads
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
      found.reports.push({ name, text, verdict: readReport(text).verdict });
    } catch (err) {
      found.faults.push(`${rel} does not read as a reviewer's report — ${messageOf(err)}; brief its reviewer again, and its report replaces it`);
    }
  }
  return found;
}

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
  if (land === 'inbox') faults.push(...(out ? inboxFaults(at.cwd, finding, what) :[`${what} is in scope, and a finding in scope is fixed or dropped, never filed (14.3.2)`]));
  if (land === 'drop' && !filled(finding.drop)) faults.push(`${what} is dropped with no why`);
  if (!out && Object.hasOwn(finding, 'ledger')) faults.push(`${what} names a ledger call, which only a finding out of scope is filed or dropped by`);
  if (out) faults.push(...ledgerFaults(at, finding.ledger, what));
  return faults;
}

/** A finding out of scope's ledger call refused where it names none, or one that is no file-or-drop call (14.3.7). @param {{call: (id: string) => string|null}} at @param {unknown} ledger @param {string} what */
function ledgerFaults({ call }, ledger, what) {
  if (!filled(ledger)) return [`${what} is out of scope, and names no ledger call filing or dropping it (14.3.7)`];
  const fault = call(ledger);
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
 * Claude's account of the round, its every fault named.
 * @param {Parameters<typeof landingFaults>[0]} at @param {unknown} given @param {string[]} areas the round's areas, by name
 * @returns {{can_now: string[], findings: RoundFinding[], settled: string|null}}
 */
function accountOf(at, given, areas) {
  const round = shaped(given, 'the round', ['can_now', 'findings'], ['settled']);
  /** @type {string[]} */
  const faults = [];
  const canNow = listed(round.can_now, 'can_now');
  if (!canNow.every(filled)) faults.push('each of can_now is a line of what the person can now do');
  const findings = listed(round.findings, 'findings').map((finding, i) => {
    const what = `finding ${i + 1}`;
    const shape = shaped(finding, what, ['area', 'scope', 'call', 'text'], [...LANDS, 'ledger']);
    if (![...areas, TESTS].includes(String(shape.area))) faults.push(`${what} is of ${JSON.stringify(shape.area)}, which the round does not read — it reads ${[...areas, TESTS].join(', ')}`);
    if (!SCOPES.includes(String(shape.scope))) faults.push(`${what}'s scope is in or out`);
    if (!CALLS.includes(String(shape.call))) faults.push(`${what}'s call is serious, bug or nit`);
    if (!filled(shape.text)) faults.push(`${what} says nothing`);
    faults.push(...landingFaults(at, shape, what));
    return /** @type {RoundFinding} */ (shape);
  });
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
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {number} round
 */
function scenarioStandings(cwd, unit, manifest, round) {
  const tips = changeTips(changeOf(cwd, unit, fixPhase(manifest, round), null));
  return cutPhases(manifest).flatMap(({ scenarios }) => scenarios).map((scenario) => ({ scenario, standing: runsOf(cwd, unit, scenario, tips).standing }));
}

/**
 * The round under review, and the unit as it reads, refused where its
 * review phase cannot be entered or is over.
 * @param {string} cwd @param {string} unit @param {(reason: string) => never} refuse
 */
function roundUnderReview(cwd, unit, refuse) {
  const manifest = refusing('review round', () => unitInProgress(cwd, unit));
  const refused = reviewRefusal(manifest);
  if (refused !== null) refuse(refused);
  const standing = refusing('review round', () => reviewStanding(cwd, unit));
  if (standing.over) refuse(`${unit}'s review phase passed in round ${standing.round} — finish is next`);
  return { manifest, ...standing };
}

/** The checks a round read, every report whole, each under a heading naming it (14.4.2). @param {number} round @param {ReadReport[]} reports */
function checksText(round, reports) {
  return [`# Round ${round}'s checks`, ...reports.map(({ name, text }) => `# ${name.replace(/\.md$/, '')}\n\n${text.trimEnd()}`)].join('\n\n') + '\n';
}

/**
 * `review round`: the round under review recorded, its report and checks
 * written, and all committed with its reports (the header's).
 * @param {string} cwd @param {string} unit @param {string} file
 */
function recordRound(cwd, unit, file) {
  const said = 'review round';
  const refuse = refuserFor(said);
  const { manifest, areas, rounds, round, reads } = roundUnderReview(cwd, unit, refuse);
  const changed = treeChanges(cwd, unit);
  if (changed === null) return refuse(`no snapshot of the working tree was taken — enter review ${unit} takes one`);
  if (changed.length > 0) refuse(`the working tree outside .leeway/ changed since the review phase was entered: ${changed.join(', ')} — nothing is reverted; the person decides what stands, and enter review ${unit} then takes the tree as it is`);
  const waiting = fixesWaiting(cwd, unit, manifest, rounds);
  if (waiting.length > 0) refuse(fixesWaitingWords(round, waiting));
  const { faults, reports } = roundReports(cwd, unit, round, reads);
  if (faults.length > 0) refuse(faults.join('; '));
  const phase = fixPhase(manifest, round);
  /** @type {string[]} */
  const warnings = [];
  const account = refusing(said, () => readShown(stateRoot(cwd), warnings, (shower) => accountOf({
    unit, phase, cwd, statuses: phaseStatuses(cwd, unit, phase), call: (id) => reviewCallFault(shower, unit, id),
  }, readPayload(cwd, file), reads)));
  const passed = reports.every(({ verdict }) => verdict === 'pass');
  /** @type {RoundRecord} */
  const record = {
    reports: reports.map(({ name }) => name), passed, can_now: account.can_now, findings: account.findings, settled: account.settled, scenarios: [],
  };
  if (passed && account.settled !== null) refuse('round passed, and only a failing round is settled');
  if (!passed && fixesOf(record).length === 0 && record.settled === null) {
    refuse(`round ${round} failed — write its fixes as tasks of ${phaseName(unit, phase)} and name each on its finding, or say how it is settled`);
  }
  record.scenarios = refusing(said, () => scenarioStandings(cwd, unit, manifest, round));
  const recorded = [...rounds, record];
  const rels = [roundRecordPath(unit, round), roundReportFile(unit, round), roundChecksFile(unit, round)];
  writeJsonAtomic(statePath(cwd, rels[0]), record);
  fs.writeFileSync(statePath(cwd, rels[1]), `${reportText(cwd, unit, manifest, recorded, round, warnings)}\n`);
  fs.writeFileSync(statePath(cwd, rels[2]), checksText(round, reports));
  const over = endsReview(record);
  const next = over ? null : reviewStanding(cwd, unit);
  return committed(cwd, [...rels, ...reports.map(({ name }) => `${roundFolder(unit, round)}/${name}`)], `review(${unit}): round ${round}`, warnings, {
    round,
    passed,
    fixes: fixesOf(record),
    ...(over ? { over: true } : { fix_phase: phase, next_reads: /** @type {NonNullable<typeof next>} */ (next).reads }),
    areas: areas.map(({ name }) => name),
  });
}

/** An inbox item as a report names it: its title and kind; its file's name where it is gone or has no title. @param {string} cwd @param {string} rel */
function filedItem(cwd, rel) {
  const { folder, slug } = parseInboxPath(cwd, statePath(cwd, rel), { archived: false });
  const file = statePath(cwd, rel);
  const first = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n')[0] : '';
  return { title: /^# +(\S.*)$/.exec(first)?.[1].trim() ?? slug, kind: FOLDER_KIND[folder] };
}

/**
 * A round as its report draws it.
 * @param {string} cwd @param {Record<string, any>} manifest @param {RoundRecord[]} rounds every round to it @param {number} round @param {Map<string, string>} wordings each scenario's
 * @returns {RoundView}
 */
function roundView(cwd, manifest, rounds, round, wordings) {
  const record = rounds[round - 1];
  return {
    round,
    passed: record.passed,
    settled: record.settled,
    can_now: record.can_now,
    scenarios: record.scenarios.map(({ scenario, standing }) => ({ scenario, standing, wording: wordings.get(scenario) ?? '' })),
    fixed: [...new Set(rounds.slice(0, round - 1).flatMap(({ findings }) => findings.filter(({ fix }) => fix !== undefined).map(({ text }) => text)))],
    fixing: record.findings.flatMap(({ fix, text }) => (fix === undefined ? [] : [{ task: fix, text }])),
    phase: fixPhase(manifest, round),
    filed: [...new Set(record.findings.flatMap(({ inbox }) => (inbox === undefined ? [] : [inbox])))].map((rel) => filedItem(cwd, rel)),
  };
}

/** Each scenario's wording, by its id, the statements it draws on left to the spec. @param {string} cwd @param {string} unit */
function scenarioWordings(cwd, unit) {
  return new Map(specStatements(readSpec(cwd, unit)).filter(({ kind }) => kind === 'scenario').map(({ number, wording }) => [number, wording.replace(/\s*\([^()]*\)$/, '')]));
}

/** The calls decided for the person across the unit, counted with the build's share; what the read warned of pushed to `warnings`. @param {string} cwd @param {string} unit @param {string[]} warnings @returns {CallsCount} */
function callsCount(cwd, unit, warnings) {
  const calls = readShown(stateRoot(cwd), warnings, (shower) => unitCalls(shower, unit)).filter(forThePerson);
  return { count: calls.length, build: calls.filter(inTheBuild).length };
}

/**
 * A round's report as text: the closing report where the round ends the
 * review phase, else the round's own.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {RoundRecord[]} rounds @param {number} round @param {string[]} warnings
 */
function reportText(cwd, unit, manifest, rounds, round, warnings) {
  const wordings = scenarioWordings(cwd, unit);
  const title = itemTitle(topicTitles(manifest), 'review', unit);
  const calls = callsCount(cwd, unit, warnings);
  if (round === rounds.length && endsReview(rounds[round - 1])) {
    return closingReport(unit, title, rounds.map((_, at) => roundView(cwd, manifest, rounds, at + 1, wordings)), calls);
  }
  return roundReport(unit, title, roundView(cwd, manifest, rounds, round, wordings), calls);
}

/**
 * `render review-report <unit> [--round N]`: a round's report, the last by
 * default, the closing report once it ends the review phase.
 * @param {string} cwd @param {{dotpath: string, round?: string}} args
 */
function reviewReportSurface(cwd, { dotpath: unit = '', round }) {
  return refusing('render review-report', () => {
    const manifest = unitInProgress(cwd, unit);
    const rounds = recordedRounds(cwd, unit);
    if (rounds.length === 0) throw new Error(`${unit}'s review phase has recorded no round yet — review round ${unit} --file <round.json> records one`);
    const at = round === undefined ? rounds.length : Number(round);
    if (!Number.isInteger(at) || at < 1 || at > rounds.length) throw new Error(`--round names a round recorded, 1 to ${rounds.length}`);
    return reportScreen(reportText(cwd, unit, manifest, rounds.slice(0, at), at, []));
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

const REVIEW_USAGE = 'review round <work-unit> --file <round.json>';

/**
 * `review <verb>`, its words and flags as the engine parsed them.
 * @param {string} cwd @param {string[]} positional @param {Record<string, string>} opts
 */
function runReviewVerb(cwd, [verb, unit, ...extra], opts) {
  const flags = Object.keys(opts);
  if (verb !== 'round' || unit === undefined || extra.length > 0 || typeof opts.file !== 'string' || flags.some((flag) => flag !== 'file')) throw new Error(`Usage: engine ${REVIEW_USAGE}`);
  return recordRound(cwd, unit, opts.file);
}

module.exports = { REVIEW_USAGE, runReviewVerb, recordRound, reviewReportSurface, reviewCallsSurface };
