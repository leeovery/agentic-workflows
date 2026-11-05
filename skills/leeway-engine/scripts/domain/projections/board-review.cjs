'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the review phase on the board (20.10) — This session in the
// review phase and a finding's page, read from where the review phase
// stands (review-phase.cjs), its rounds' records and reports, and the briefs
// this conversation issued.
//
// - The round shown is the one under review once it has opened, as the
//   review phase opens it — round 1 at its entry, a later round once its
//   reads are named — else the last recorded: a failing round, with its
//   fix tasks, until the next opens, and the round that ended the phase.
// - Recorded, each area and the reader over the tests is read where the
//   round read it, with the checks the round ran of the area's scenarios —
//   `{area}.S{k}` — and the findings the round gave it, every other
//   unchanged, not read again (20.10.2); its findings in scope, each with
//   its call, its checks not proven, and its verdict.
// - Under way, each read the round takes is read once every report of it is
//   written, with every finding its reports hold; being read since this
//   conversation issued its brief for that read in that round (P15); else
//   waiting. A read the round does not take is unchanged. What it found is
//   each finding of each report landed, with its call, its read's area and
//   the report item it is, unnumbered and its scope unsaid until the round
//   is recorded. Round 1's checks not proven are the cut's scenarios not
//   proven at the change's tips, as `review round` judges them, read from
//   the unit's read of the tracker and, where its work not landed is done,
//   those phases' tasks whole (review-change.cjs); a later round's
//   are the round before's until it is recorded. What went to the inbox is
//   every recorded round's to the one shown, each by its round.
// - Its fix tasks are a build phase past the cut (P14): the latest round's
//   up to the one shown that made any, each task by its line, from the
//   unit's one read of the tracker (board.cjs).
// - Finish waits on the person once the review phase is over (D18): a round
//   ended it and its fix tasks and builders' notes are done.
// - The questions its fix tasks wait on are the build's (board-build.cjs):
//   WAITING ON YOU, each a press can queue, and whether they stop it.
// - A check opens on its page (20.10.3): where it stands in the round that
//   recorded it, or round 1's at the change's tips while it is read, with
//   its scenario's words from the spec.
// - A finding opens on its page (20.10.3): as its round holds it once
//   recorded — one opened by its report item while the round was read, as
//   the round's finding answering that item — else as its reviewer's report
//   holds it.
// - The banner (D36, D37): finish waiting on the person, flagged; else
//   stopped where nothing can go on, the round reading or, once recorded, a
//   failing round's fix tasks building while any is not done and it has not
//   stopped, a round that ended the phase passed or settled; and the
//   questions waiting, flagged.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { statePath } = require('../../kernel/state-root.cjs');
const { readReport } = require('../round-report.cjs');
const { projectName } = require('../state-checks.cjs');
const { fixesOf, fixPhase, reportNames, areaReportPath, recordedRounds, TESTS } = require('../review-phase.cjs');
const { trackedChange, cutStandings } = require('../review-change.cjs');
const { reposOf, landedOf } = require('../phase-checks.cjs');
const { copiedTasks } = require('../task-verbs.cjs');
const { buildView, taskLine, standingAt, reviewStandingAt, readingAt, scenarioWording } = require('./board-build.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').ReviewView} ReviewView */
/** @typedef {import('../board-model.cjs').AreaLine} AreaLine */
/** @typedef {import('../review-phase.cjs').RoundRecord} RoundRecord */
/** @typedef {import('../review-phase.cjs').ReviewStanding} ReviewStanding */

/** The reader over the tests, as its line titles it. */
const TESTS_TITLE = 'Tests held against the specification';

/** The reads of a round, each the area's name or the tests', with its number and title. @param {ReviewStanding} standing */
function readsOf({ areas }) {
  return [...areas.map(({ number, title, name }) => ({ read: name, area: number, title })), { read: TESTS, area: TESTS, title: TESTS_TITLE }];
}

/** Where a finding's words name its user scenario, which a report writes after them. */
const SCENARIO_NAMED = /(?:^|\s)[*_]*Scenario[*_]*:/i;

/** A finding's words, up to where they name its scenario. @param {string} text */
function wordsOf(text) {
  const named = text.search(SCENARIO_NAMED);
  return named <= 0 ? text : text.slice(0, named).trim();
}

/** The findings a report holds, each by its call and words whole; none where it does not read as a report. @param {string} file @returns {{call: string, text: string}[]} */
function reportFindings(file) {
  try {
    return readReport(fs.readFileSync(file, 'utf8')).findings;
  } catch {
    return [];
  }
}

/** The reports of a read in a round, each by its name and reviewer's letter and its file. @param {BoardAt} at @param {number} round @param {string} read */
const reportsOf = (at, round, read) => reportNames([read]).map((name) => {
  const letter = name.slice(read.length + 1, -3);
  return { report: name.slice(0, -3), letter, file: statePath(at.cwd, areaReportPath(at.unit, round, read, letter)) };
});

/** Each report of a read the round has landed, with the findings it holds. @param {BoardAt} at @param {number} round @param {string} read */
const landedReports = (at, round, read) => reportsOf(at, round, read).filter(({ file }) => fs.existsSync(file)).map((held) => ({ ...held, findings: reportFindings(held.file) }));

/**
 * A read of a round under way: read once all its reports are written, with
 * every finding they hold; being read since its brief; else waiting.
 * @param {BoardAt} at @param {number} round @param {{read: string, area: string, title: string}} read @returns {AreaLine}
 */
function underWay(at, round, { read, area, title }) {
  const landed = landedReports(at, round, read);
  if (landed.length === reportsOf(at, round, read).length) return { area, title, state: 'read', ran: 0, found: landed.flatMap(({ findings }) => findings).length, since: null };
  const brief = at.issued.filter((issued) => issued.round === round && (read === TESTS ? issued.role === 'test-surface' : issued.role === 'review-area' && issued.area === area)).at(-1);
  return brief === undefined ? { area, title, state: 'waiting', ran: 0, found: 0, since: null } : { area, title, state: 'reading', ran: 0, found: 0, since: brief.at };
}

/** A read the round does not take: not read again. @param {{area: string, title: string}} read @returns {AreaLine} */
const unchanged = ({ area, title }) => ({ area, title, state: 'unchanged', ran: 0, found: 0, since: null });

/** The checks a recorded round ran of an area's scenarios, `{area}.S{k}`. @param {RoundRecord} record @param {string} area */
const ranIn = ({ scenarios }, area) => scenarios.filter(({ scenario }) => scenario.startsWith(`${area}.S`)).length;

/** The reads a recorded round took, by their names. @param {RoundRecord} record */
const readNames = ({ reports }) => new Set(reports.map((report) => report.replace(/-[a-z]\.md$/, '')));

/** A recorded round's findings in scope, each by its number and call. @param {RoundRecord} record @param {number} round @returns {ReviewView['found']} */
const foundOf = ({ findings }, round) => findings.flatMap((finding, k) => (finding.scope === 'in' ? [{ round, finding: k + 1, from: null, area: finding.area, call: finding.call, text: finding.text }] : []));

/**
 * What a round under way has found so far: each finding of each report it
 * has landed, with its read's area, its call and the report item it is —
 * numbered by none, and its scope unsaid, until `review round` records it.
 * @param {BoardAt} at @param {ReviewStanding} standing @param {number} round @param {Set<string>} taken @returns {ReviewView['found']}
 */
const foundSoFar = (at, standing, round, taken) => readsOf(standing).filter(({ read }) => taken.has(read))
  .flatMap(({ read }) => landedReports(at, round, read).flatMap(({ report, findings }) => findings.map(({ call, text }, k) => ({
    round, finding: null, from: `${report}#${k + 1}`, area: read, call, text: wordsOf(text),
  }))));

/** A round's checks not proven, each with its scenario's words. @param {BoardAt} at @param {Pick<RoundRecord, 'scenarios'>} record @param {number} round @returns {ReviewView['not_proven']} */
const unprovenOf = (at, { scenarios }, round) => scenarios.filter(({ standing }) => standing !== 'proven').map(({ scenario, standing }) => ({ round, scenario, standing, text: scenarioWording(at, scenario) }));

/**
 * The tasks whole of each of `phases`: as the unit's read of the tracker
 * holds them, the rest — phases whose tasks are all ended — read from a
 * copy of the store only here, where the change is drawn.
 * @param {BoardAt} at @param {number[]} phases @returns {import('../drivers.cjs').TaskDetail[][]}
 */
function wholeAt(at, phases) {
  const { written } = at.tracker();
  const ended = phases.filter((phase) => written[phase - 1] === null || written[phase - 1] === undefined);
  const copied = new Map(ended.length === 0 ? [] : copiedTasks(at.cwd, at.unit, ended).map((tasks, k) => [ended[k], tasks]));
  return phases.map((phase) => written[phase - 1] ?? copied.get(phase) ?? []);
}

/**
 * What each scenario of the cut stands at while round 1 is read: at the
 * change's tips, as `review round` judges it, from the unit's read of the
 * tracker; read once a call.
 * @param {BoardAt} at @returns {{scenario: string, standing: string}[]}
 */
const firstStandings = (at) => at.once('first-standings', () => {
  const read = readingAt(at);
  const change = trackedChange(at.cwd, at.unit, fixPhase(at.manifest, 1), { lists: at.tracker().phases, landed: landedOf(read), wholeOf: (phases) => wholeAt(at, phases) }, reposOf(read));
  return cutStandings(at.cwd, at.unit, at.manifest, change);
});

/** Round 1's checks not proven while it is read, each with its scenario's words. @param {BoardAt} at @returns {ReviewView['not_proven']} */
const unprovenSoFar = (at) => unprovenOf(at, { scenarios: firstStandings(at) }, 1);

/** What the recorded rounds up to `round` filed to the inbox, each finding by its round and number. @param {RoundRecord[]} rounds @param {number} round @returns {ReviewView['inbox']} */
const inboxUpTo = (rounds, round) => rounds.slice(0, round).flatMap(({ findings }, r) => findings.flatMap(({ inbox, text }, k) => (typeof inbox === 'string' ? [{ round: r + 1, finding: k + 1, text }] : [])));

/** A round's verdict. @param {RoundRecord} record @returns {ReviewView['verdict']} */
const verdictOf = ({ passed, settled }) => (passed ? 'passed' : settled === null ? 'failed' : 'settled');

/**
 * The fix tasks of the latest round up to `round` that made any, as the
 * build's phase they make, each task by its line; null where none did.
 * @param {BoardAt} at @param {RoundRecord[]} rounds @param {number} round @returns {ReviewView['fixes']}
 */
function fixesAt(at, rounds, round) {
  const made = rounds.slice(0, round).reduce((latest, record, k) => (fixesOf(record).length > 0 ? k + 1 : latest), 0);
  if (made === 0) return null;
  const phase = fixPhase(at.manifest, made);
  const tasks = (standingAt(at).phases.find((held) => held.phase === phase)?.tasks ?? []).map((task) => taskLine(at, task));
  return { phase, round: made, tasks };
}

/**
 * The round the board shows: the one under review once it has opened —
 * round 1 at the phase's entry, a later one once its reads are named — else
 * the last recorded.
 * @param {ReviewStanding} standing
 */
const shownRound = ({ round, rounds, reads }) => (rounds.length >= round || round === 1 || reads !== null ? round : round - 1);

/**
 * The round shown, under way: each read it takes, the rest unchanged; what
 * its landed reports found; round 1's checks not proven at the change's
 * tips, a later round's the round before's until it is recorded; what the
 * rounds before it filed to the inbox; and the latest fix tasks before it.
 * @param {BoardAt} at @param {ReviewStanding} standing @param {number} round
 */
function roundUnderWay(at, standing, round) {
  const taken = new Set(standing.reads ?? standing.required);
  const before = standing.rounds[round - 2];
  return {
    recorded: false,
    areas: readsOf(standing).map((read) => (taken.has(read.read) ? underWay(at, round, read) : unchanged(read))),
    found: foundSoFar(at, standing, round, taken),
    not_proven: before === undefined ? unprovenSoFar(at) : unprovenOf(at, before, round - 1),
    inbox: inboxUpTo(standing.rounds, round - 1),
    verdict: null,
    fixes: fixesAt(at, standing.rounds, round - 1),
  };
}

/** The round shown, recorded: what it read, found and could not prove, what every round to it filed to the inbox, its verdict, and the latest fix tasks. @param {BoardAt} at @param {ReviewStanding} standing @param {RoundRecord} record @param {number} round */
function roundRecorded(at, standing, record, round) {
  const read = readNames(record);
  return {
    recorded: true,
    areas: readsOf(standing).map(({ read: name, area, title }) => (read.has(name)
      ? { area, title, state: /** @type {const} */ ('read'), ran: ranIn(record, area), found: record.findings.filter((finding) => finding.area === name).length, since: null }
      : unchanged({ area, title }))),
    found: foundOf(record, round),
    not_proven: unprovenOf(at, record, round),
    inbox: inboxUpTo(standing.rounds, round),
    verdict: verdictOf(record),
    fixes: fixesAt(at, standing.rounds, round),
  };
}

/**
 * The review phase's This session (the header's), and the questions its
 * fix tasks wait on, as the build's view reads them.
 * @param {BoardAt} at @returns {{view: ReviewView, questions: import('../board-model.cjs').Question[]}}
 */
function reviewView(at) {
  const standing = reviewStandingAt(at);
  const round = shownRound(standing);
  const record = standing.rounds[round - 1];
  const build = buildView(at);
  const built = standingAt(at).phases.flatMap(({ tasks }) => tasks).filter(({ status }) => status === 'done').length;
  return {
    view: {
      kind: 'review',
      unit: at.unit,
      title: at.title,
      project: projectName(at.cwd),
      type: at.manifest.work_type,
      built,
      round,
      finish: standing.over,
      waiting: build.view.waiting,
      stopped: build.view.progress.stopped,
      ...(record === undefined ? roundUnderWay(at, standing, round) : roundRecorded(at, standing, record, round)),
    },
    questions: build.questions,
  };
}

/** Where a recorded round stands on the banner, by its verdict; its fix tasks building only while it has not stopped. @param {ReviewView} view */
function verdictFact({ round, verdict, fixes, stopped }) {
  if (verdict === 'passed') return `round ${round} passes`;
  if (verdict === 'settled') return `round ${round} settled`;
  const building = !stopped && fixes?.round === round && fixes.tasks.some(({ state }) => state !== 'done' && state !== 'closed');
  return building ? `round ${round} fails · fix tasks building` : `round ${round} fails`;
}

/**
 * The banner's facts in the review phase (the header's): finish waiting on
 * the person; else the type and the phase, stopped where nothing can go on,
 * the round reading or where it stands once recorded, and the questions its
 * fix tasks wait on, flagged, as the build's banner has them.
 * @param {ReviewView} view @returns {{state: 'running'|'needs', facts: {text: string, needs: boolean}[]}}
 */
function reviewBanner(view) {
  const fact = (/** @type {string} */ text, needs = false) => ({ text, needs });
  const where = [fact(view.type), fact('review')];
  if (view.finish) return { state: 'needs', facts: [...where, fact('finish waits on you'), fact('1 waiting on you', true)] };
  return {
    state: view.stopped ? 'needs' : 'running',
    facts: [
      ...where,
      ...(view.stopped ? [fact('stopped')] : []),
      fact(view.verdict === null ? `round ${view.round} reading` : verdictFact(view)),
      ...(view.waiting.length > 0 ? [fact(`${view.waiting.length} waiting on you`, true)] : []),
    ],
  };
}

/**
 * A finding of a round read in full (20.10.3): by its number once the round
 * is recorded, else by the report item it is (the header's); refused where
 * the round holds no such finding.
 * @param {BoardAt} at @param {string} said @param {string} k @returns {import('../board-model.cjs').FindingPage}
 */
function findingPage(at, said, k) {
  const round = Number(said);
  const record = recordedRounds(at.cwd, at.unit)[round - 1];
  const number = k.includes('#') ? (record?.findings.findIndex(({ from }) => from.includes(k)) ?? -1) + 1 : Number(k);
  const finding = record?.findings[number - 1];
  if (finding !== undefined) {
    return {
      kind: 'finding', unit: at.unit, round, finding: number, area: finding.area, scope: finding.scope, call: finding.call, text: finding.text, fix: finding.fix ?? null, inbox: finding.inbox ?? null, reviewer: null,
    };
  }
  if (record === undefined && k.includes('#')) return foundPage(at, round, k);
  throw new Error(`round ${said} of ${at.unit}'s review holds no finding ${k}`);
}

/**
 * A finding of a round being read, as its reviewer's report holds it, by
 * the report item it is, `{report}#{n}`; refused where no report of the
 * round holds it.
 * @param {BoardAt} at @param {number} round @param {string} item @returns {import('../board-model.cjs').FindingPage}
 */
function foundPage(at, round, item) {
  const [report, n] = item.split('#');
  const read = readsOf(reviewStandingAt(at)).find(({ read: name }) => reportNames([name]).includes(`${report}.md`));
  const held = read === undefined ? undefined : landedReports(at, round, read.read).find((landed) => landed.report === report);
  const finding = held?.findings[Number(n) - 1];
  if (read === undefined || held === undefined || finding === undefined) throw new Error(`round ${round} of ${at.unit}'s review holds no finding ${item}`);
  return {
    kind: 'finding', unit: at.unit, round, finding: null, area: read.read, scope: null, call: finding.call, text: finding.text, fix: null, inbox: null, reviewer: held.letter,
  };
}

/**
 * A check of a round, by its scenario (the header's): as the round recorded
 * it, or as round 1 stands at the change's tips while it is read; refused
 * where the round ran or runs no such check.
 * @param {BoardAt} at @param {string} said @param {string} scenario @returns {import('../board-model.cjs').CheckPage}
 */
function checkPage(at, said, scenario) {
  const round = Number(said);
  const rounds = recordedRounds(at.cwd, at.unit);
  const checks = rounds[round - 1]?.scenarios ?? (round === 1 && rounds.length === 0 ? firstStandings(at) : []);
  const check = checks.find((held) => held.scenario === scenario);
  if (check === undefined) throw new Error(`round ${said} of ${at.unit}'s review ran no check of ${scenario}`);
  return { kind: 'check', unit: at.unit, round, scenario, standing: check.standing, text: scenarioWording(at, scenario) };
}

module.exports = { reviewView, reviewBanner, findingPage, checkPage };
