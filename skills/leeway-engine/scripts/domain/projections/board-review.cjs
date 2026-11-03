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
//   unchanged, not read again (20.10.2); its findings in scope, its checks
//   not proven, what went to the inbox, and its verdict.
// - Under way, each read the round takes is read once every report of it is
//   written, with the findings its reports hold, the most either holds;
//   being read since this conversation issued its brief for that read in
//   that round (P15); else waiting. A read the round does not take is
//   unchanged. What it found in scope is the failing round's before it,
//   which its fix tasks fix.
// - Its fix tasks are a build phase past the cut (P14): the recorded
//   round's own where it made any, else the round before's, each task by its
//   line, from the unit's one read of the tracker (board.cjs).
// - A check opens on its page (20.10.3): where it stands in the round that
//   recorded it, with its scenario's words from the spec.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { statePath } = require('../../kernel/state-root.cjs');
const { readReport } = require('../round-report.cjs');
const { specPath, specReading } = require('../spec-sections.cjs');
const { fixesOf, fixPhase, reportNames, areaReportPath, recordedRounds, TESTS } = require('../review-phase.cjs');
const { taskLine, standingAt, reviewStandingAt } = require('./board-build.cjs');

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

/** The findings a report holds, none where it does not read as a report. @param {string} file */
function reportFindings(file) {
  try {
    return readReport(fs.readFileSync(file, 'utf8')).findings.length;
  } catch {
    return 0;
  }
}

/**
 * A read of a round under way: read once all its reports are written, with
 * the most findings either holds; being read since its brief; else waiting.
 * @param {BoardAt} at @param {number} round @param {{read: string, area: string, title: string}} read @returns {AreaLine}
 */
function underWay(at, round, { read, area, title }) {
  const files = reportNames([read]).map((name) => statePath(at.cwd, areaReportPath(at.unit, round, read, name.slice(read.length + 1, -3))));
  if (files.every((file) => fs.existsSync(file))) return { area, title, state: 'read', ran: 0, found: Math.max(...files.map(reportFindings)), since: null };
  const brief = at.issued.filter((issued) => issued.round === round && (read === TESTS ? issued.role === 'test-surface' : issued.role === 'review-area' && issued.area === area)).at(-1);
  return brief === undefined ? { area, title, state: 'waiting', ran: 0, found: 0, since: null } : { area, title, state: 'reading', ran: 0, found: 0, since: brief.at };
}

/** A read the round does not take: not read again. @param {{area: string, title: string}} read @returns {AreaLine} */
const unchanged = ({ area, title }) => ({ area, title, state: 'unchanged', ran: 0, found: 0, since: null });

/** The checks a recorded round ran of an area's scenarios, `{area}.S{k}`. @param {RoundRecord} record @param {string} area */
const ranIn = ({ scenarios }, area) => scenarios.filter(({ scenario }) => scenario.startsWith(`${area}.S`)).length;

/** The reads a recorded round took, by their names. @param {RoundRecord} record */
const readNames = ({ reports }) => new Set(reports.map((report) => report.replace(/-[a-z]\.md$/, '')));

/** A recorded round's findings in scope. @param {RoundRecord} record @param {number} round @returns {ReviewView['found']} */
const foundOf = ({ findings }, round) => findings.flatMap((finding, k) => (finding.scope === 'in' ? [{ round, finding: k + 1, area: finding.area, text: finding.text }] : []));

/** A round's verdict. @param {RoundRecord} record @returns {ReviewView['verdict']} */
const verdictOf = ({ passed, settled }) => (passed ? 'passed' : settled === null ? 'failed' : 'settled');

/**
 * The fix tasks a round made, as the build's phase they make, each task by
 * its line; null where it made none.
 * @param {BoardAt} at @param {RoundRecord[]} rounds @param {number} round @returns {ReviewView['fixes']}
 */
function fixesAt(at, rounds, round) {
  const record = rounds[round - 1];
  if (record === undefined || fixesOf(record).length === 0) return null;
  const phase = fixPhase(at.manifest, round);
  const tasks = (standingAt(at).phases.find((held) => held.phase === phase)?.tasks ?? []).map((task) => taskLine(at, task));
  return { phase, round, tasks };
}

/**
 * The round the board shows: the one under review once it has opened —
 * round 1 at the phase's entry, a later one once its reads are named — else
 * the last recorded.
 * @param {ReviewStanding} standing
 */
const shownRound = ({ round, rounds, reads }) => (rounds.length >= round || round === 1 || reads !== null ? round : round - 1);

/** The review phase's This session (the header's). @param {BoardAt} at @returns {{view: ReviewView}} */
function reviewView(at) {
  const standing = reviewStandingAt(at);
  const round = shownRound(standing);
  const record = standing.rounds[round - 1];
  const built = standingAt(at).phases.flatMap(({ tasks }) => tasks).filter(({ status }) => status === 'done').length;
  const head = { kind: /** @type {const} */ ('review'), unit: at.unit, title: at.title, type: at.manifest.work_type, built, round };
  if (record === undefined) {
    const taken = new Set(standing.reads ?? standing.required);
    return {
      view: {
        ...head,
        recorded: false,
        areas: readsOf(standing).map((read) => (taken.has(read.read) ? underWay(at, round, read) : unchanged(read))),
        found: round > 1 ? foundOf(standing.rounds[round - 2], round - 1) : [],
        not_proven: [],
        inbox: [],
        verdict: null,
        fixes: fixesAt(at, standing.rounds, round - 1),
      },
    };
  }
  const read = readNames(record);
  return {
    view: {
      ...head,
      recorded: true,
      areas: readsOf(standing).map(({ read: name, area, title }) => (read.has(name)
        ? { area, title, state: 'read', ran: ranIn(record, area), found: record.findings.filter((finding) => finding.area === name).length, since: null }
        : unchanged({ area, title }))),
      found: foundOf(record, round),
      not_proven: record.scenarios.filter(({ standing: stands }) => stands !== 'proven'),
      inbox: record.findings.flatMap(({ inbox, text }) => (typeof inbox === 'string' ? [text] : [])),
      verdict: verdictOf(record),
      fixes: fixesAt(at, standing.rounds, round),
    },
  };
}

/**
 * The banner's facts in the review phase (20.2.4): the round reading, or
 * its verdict once recorded; done once a round ended the phase.
 * @param {ReviewView} view @returns {{state: 'running'|'done', facts: {text: string, needs: boolean}[]}}
 */
function reviewBanner({ type, round, verdict }) {
  const fact = (/** @type {string} */ text) => ({ text, needs: false });
  return {
    state: verdict === 'passed' || verdict === 'settled' ? 'done' : 'running',
    facts: [fact(type), fact('review'), fact(`round ${round} ${verdict ?? 'reading'}`)],
  };
}

/**
 * A finding of a recorded round read in full (20.10.3); refused where the
 * round is not recorded or holds no such finding.
 * @param {BoardAt} at @param {string} said @param {string} k @returns {import('../board-model.cjs').FindingPage}
 */
function findingPage(at, said, k) {
  const round = Number(said);
  const finding = recordedRounds(at.cwd, at.unit)[round - 1]?.findings[Number(k) - 1];
  if (finding === undefined) throw new Error(`round ${said} of ${at.unit}'s review holds no finding ${k}`);
  return {
    kind: 'finding', unit: at.unit, round, finding: Number(k), area: finding.area, scope: finding.scope, call: finding.call, text: finding.text, fix: finding.fix ?? null, inbox: finding.inbox ?? null,
  };
}

/**
 * A check a recorded round ran, by its scenario (the header's); refused
 * where the round is not recorded or ran no such check.
 * @param {BoardAt} at @param {string} said @param {string} scenario @returns {import('../board-model.cjs').CheckPage}
 */
function checkPage(at, said, scenario) {
  const round = Number(said);
  const check = recordedRounds(at.cwd, at.unit)[round - 1]?.scenarios.find((held) => held.scenario === scenario);
  if (check === undefined) throw new Error(`round ${said} of ${at.unit}'s review ran no check of ${scenario}`);
  const file = specPath(at.cwd, at.unit);
  const written = fs.existsSync(file) ? specReading(fs.readFileSync(file, 'utf8')).lines.find(({ kind, number }) => kind === 'scenario' && number === scenario) : undefined;
  return { kind: 'check', unit: at.unit, round, scenario, standing: check.standing, text: written?.wording ?? null };
}

module.exports = { reviewView, reviewBanner, findingPage, checkPage };
