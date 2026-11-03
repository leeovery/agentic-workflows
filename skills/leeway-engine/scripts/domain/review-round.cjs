'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a review round recorded, and the review phase's screens
// (§14) — `review round <unit> --file <round.json>`, `render review-report
// <unit> [--round N]` and `render review-calls <unit>`.
//
// `review round` records the round under review (review-phase.cjs) from
// Claude's account of it, `{can_now, findings, settled?}`: what the person
// can now do, each a line; each finding with the area it is of — one the
// round reads, `tests` for the test surface — its scope, `in` or `out` of
// the change, its call, its text, the items of the round's reports it
// answers, `{report}#{n}`, and where it landed, one of:
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
// asks for (reportNames) by the reviewers' grammar (round-report.cjs):
// every item of every report, nits among them, is answered by exactly one
// finding, two reviewers' one bug one finding, at no lesser call than the
// items it answers; the round passes where every report does — Claude
// never types a verdict. What each scenario of the cut stands at, read at
// the change's tips (review-change.cjs, runs.cjs), is recorded with it
// (15.3.3, 15.5.6). Then it writes the round's record, its report — the
// closing report where the round ends the review phase (14.4.3) — and its
// checks, every report read whole (14.4.2), drops the snapshot it held the
// tree to, and commits them with the reports.
//
// It refuses, opening `review round: ` and writing nothing: a unit whose
// review phase cannot be entered; a round that cannot be read — one ended
// the phase, fix tasks of the round before wait, a later round's areas are
// not named; no snapshot; a working tree outside `.leeway/` changed since
// the snapshot, naming every path — nothing is reverted, the person decides,
// and `review accept-tree` on their word takes the tree as it is (12.7.8,
// 14.S13); a report missing or not reading; a payload of another shape,
// every fault named; and a failing round neither fixed nor settled. It runs
// under the writer lock (engine.cjs); a commit git refuses is a warning,
// the files written.
//
// The report's screen draws a round's report as it was written, the last by
// default; the calls' screen lists every call decided for the person across
// the unit (review-phase.cjs, 14.4.4).
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
const { titleOf } = require('./start.cjs');
const { unitInProgress } = require('./topic-standing.cjs');
const { itemTitle, topicTitles } = require('./derivations.cjs');
const { cutPhases } = require('./phase-checks.cjs');
const { readSpec, specStatements } = require('./spec-sections.cjs');
const { runsOf } = require('./runs.cjs');
const { changeOf, changeTips } = require('./review-change.cjs');
const { reviewHeld } = require('./review-entry.cjs');
const {
  reportNames, reviewStanding, roundRefusal, recordedRounds, fixesOf, endsReview, fixPhase, roundRecordPath, roundReportFile, roundChecksFile, roundFolder,
  snapshotTaken, dropSnapshot, treeChanges, unitCalls, reviewCallFault, forThePerson, inTheBuild,
} = require('./review-phase.cjs');
const {
  roundReport, closingReport, reportScreen, reviewCallsScreen,
} = require('./projections/review-phase.cjs');

/** @typedef {import('./review-phase.cjs').RoundRecord} RoundRecord */
/** @typedef {import('./review-phase.cjs').RoundFinding} RoundFinding */
/** @typedef {import('./projections/review-phase.cjs').RoundView} RoundView */
/** @typedef {import('./projections/review-phase.cjs').CallsCount} CallsCount */

const SCOPES = ['in', 'out'];
/** The calls, gravest first. */
const CALLS = ['serious', 'bug', 'nit'];
const LANDS = ['fix', 'inbox', 'drop'];

/** A round's report read, by its file's name in the round's folder, with its findings' calls. @typedef {{name: string, text: string, verdict: 'pass'|'fail', calls: string[]}} ReadReport */

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
      const { verdict, findings } = readReport(text);
      found.reports.push({ name, text, verdict, calls: findings.map(({ call }) => call) });
    } catch (err) {
      found.faults.push(`${rel} does not read as a reviewer's report — ${messageOf(err)}; brief its reviewer again, and its report replaces it`);
    }
  }
  return found;
}

/** Every item of the round's reports, `{report}#{n}`, by its call. @param {ReadReport[]} reports @returns {Map<string, string>} */
const reportItems = (reports) => new Map(reports.flatMap(({ name, calls }) => calls.map((call, at) => [`${name.replace(/\.md$/, '')}#${at + 1}`, call])));

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
 * no report of the round holds, or a call lesser than theirs.
 * @param {Map<string, string>} items @param {Record<string, any>} finding @param {string} what @returns {string[]}
 */
function fromFaults(items, finding, what) {
  if (!Array.isArray(finding.from) || finding.from.length === 0 || !finding.from.every(filled)) return [`${what} answers no report item — name each in from, as 1-cards-a#1`];
  const unheld = finding.from.filter((/** @type {string} */ item) => !items.has(item));
  if (unheld.length > 0) return [`${what} names ${unheld.join(', ')}, which no report the round read holds`];
  const gravest = Math.min(...finding.from.map((/** @type {string} */ item) => CALLS.indexOf(/** @type {string} */ (items.get(item)))));
  return CALLS.indexOf(String(finding.call)) > gravest ? [`${what} is a ${finding.call}, and the report items it answers call it a ${CALLS[gravest]}`] : [];
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
  const findings = listed(round.findings, 'findings').map((finding, i) => {
    const what = `finding ${i + 1}`;
    const shape = shaped(finding, what, ['area', 'scope', 'call', 'text', 'from'], [...LANDS, 'ledger']);
    if (!reads.includes(String(shape.area))) faults.push(`${what} is of ${JSON.stringify(shape.area)}, which the round does not read — it reads ${reads.join(', ')}`);
    if (!SCOPES.includes(String(shape.scope))) faults.push(`${what}'s scope is in or out`);
    if (!CALLS.includes(String(shape.call))) faults.push(`${what}'s call is serious, bug or nit`);
    if (!filled(shape.text)) faults.push(`${what} says nothing`);
    faults.push(...fromFaults(items, shape, what), ...landingFaults(at, shape, what));
    return /** @type {RoundFinding} */ (shape);
  });
  faults.push(...coverageFaults(items, findings));
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
 * review phase cannot be entered or the round cannot be read.
 * @param {string} cwd @param {string} unit
 */
function roundUnderReview(cwd, unit) {
  const manifest = refusing('review round', () => unitInProgress(cwd, unit));
  const standing = refusing('review round', () => reviewHeld(cwd, unit, manifest, roundRefusal));
  return { manifest, ...standing, reads: /** @type {string[]} */ (standing.reads) };
}

/** The tree held to its snapshot, refused where none is held or the tree moved since (the header's). @param {string} cwd @param {string} unit @param {(reason: string) => never} refuse */
function treeHeld(cwd, unit, refuse) {
  if (!snapshotTaken(cwd, unit)) refuse(`no snapshot of the working tree is held — enter review ${unit} takes one`);
  const changed = treeChanges(cwd, unit);
  if (changed.length > 0) {
    refuse(`the working tree outside .leeway/ changed since the snapshot the round is held to: ${changed.join(', ')} — nothing is reverted; the person decides what stands, and on their word review accept-tree ${unit} takes the tree as it is`);
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
  const { manifest, areas, rounds, round, reads } = roundUnderReview(cwd, unit);
  treeHeld(cwd, unit, refuse);
  const { faults, reports } = roundReports(cwd, unit, round, reads);
  if (faults.length > 0) refuse(faults.join('; '));
  const phase = fixPhase(manifest, round);
  /** @type {string[]} */
  const warnings = [];
  const account = refusing(said, () => readShown(stateRoot(cwd), warnings, (shower) => accountOf({
    unit, phase, cwd, statuses: phaseStatuses(cwd, unit, phase), call: (id) => reviewCallFault(shower, unit, id),
  }, readPayload(cwd, file), reads, reportItems(reports))));
  /** @type {RoundRecord} */
  const record = {
    reports: reports.map(({ name }) => name), passed: reports.every(({ verdict }) => verdict === 'pass'), can_now: account.can_now, findings: account.findings, settled: account.settled, scenarios: [],
  };
  verdictHeld(round, unit, phase, record, refuse);
  record.scenarios = refusing(said, () => scenarioStandings(cwd, unit, manifest, round));
  const recorded = [...rounds, record];
  const rels = [roundRecordPath(unit, round), roundReportFile(unit, round), roundChecksFile(unit, round)];
  writeJsonAtomic(statePath(cwd, rels[0]), record);
  fs.writeFileSync(statePath(cwd, rels[1]), `${reportText(cwd, unit, manifest, recorded, warnings)}\n`);
  fs.writeFileSync(statePath(cwd, rels[2]), checksText(round, reports));
  dropSnapshot(cwd, unit);
  const fixes = fixesOf(record);
  const ends = endsReview(record);
  return committed(cwd, [...rels, ...reports.map(({ name }) => `${roundFolder(unit, round)}/${name}`)], `review(${unit}): round ${round}`, warnings, {
    round,
    passed: record.passed,
    fixes,
    ends,
    ...(fixes.length === 0 ? {} : { fix_phase: phase }),
    ...(ends ? {} : { reads_at_least: reviewStanding(cwd, unit, manifest).required }),
    areas: areas.map(({ name }) => name),
  });
}

/** An inbox item as a report names it: its title and kind; its file's name where it is gone or has no title. @param {string} cwd @param {string} rel */
function filedItem(cwd, rel) {
  const { folder, slug } = parseInboxPath(cwd, statePath(cwd, rel), { archived: false });
  const file = statePath(cwd, rel);
  return { title: (fs.existsSync(file) ? titleOf(fs.readFileSync(file, 'utf8')) : null) ?? slug, kind: FOLDER_KIND[folder] };
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
 * The last round's report as text: the closing report where the round ends
 * the review phase, else the round's own.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {RoundRecord[]} rounds @param {string[]} warnings
 */
function reportText(cwd, unit, manifest, rounds, warnings) {
  const wordings = scenarioWordings(cwd, unit);
  const title = itemTitle(topicTitles(manifest), 'review', unit);
  const calls = callsCount(cwd, unit, warnings);
  if (endsReview(/** @type {RoundRecord} */ (rounds.at(-1)))) {
    return closingReport(unit, title, rounds.map((_, at) => roundView(cwd, manifest, rounds, at + 1, wordings)), calls);
  }
  return roundReport(unit, title, roundView(cwd, manifest, rounds, rounds.length, wordings), calls);
}

/**
 * `render review-report <unit> [--round N]`: a round's report as it was
 * written, the last by default.
 * @param {string} cwd @param {{dotpath: string, round?: string}} args
 */
function reviewReportSurface(cwd, { dotpath: unit = '', round }) {
  return refusing('render review-report', () => {
    unitInProgress(cwd, unit);
    const rounds = recordedRounds(cwd, unit);
    if (rounds.length === 0) throw new Error(`${unit}'s review phase has recorded no round yet — review round ${unit} --file <round.json> records one`);
    const at = round === undefined ? rounds.length : Number(round);
    if (!Number.isInteger(at) || at < 1 || at > rounds.length) throw new Error(`--round names a round recorded, 1 to ${rounds.length}`);
    return reportScreen(fs.readFileSync(statePath(cwd, roundReportFile(unit, at)), 'utf8').trimEnd());
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

module.exports = { recordRound, reviewReportSurface, reviewCallsSurface };
