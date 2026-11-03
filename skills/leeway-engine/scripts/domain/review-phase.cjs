'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the review phase's records (§14), read alike by its entry
// (review-entry.cjs), its round (review-round.cjs), its briefs
// (brief-records.cjs) and its screens (projections/review-phase.cjs).
//
// - Its areas are the spec's: each `## N. Title`, in the spec's order, never
//   merged (14.2.1, 14.2.3), known in the layout by its number and its
//   title's slug, `{n}-{slug}` (landing-names.cjs) — so a one-area spec has
//   one pair. Each area is read by the pair (kernel/reviewers.cjs), each
//   reviewer's report at `review/round-{N}/{area}-{letter}.md`, and the
//   change's tests by one reader, its report at `review/round-{N}/tests-a.md`
//   (14.2.2, 14.2.4).
// - A round is recorded by `review round` alone, at `review/round-{N}.json`,
//   the engine's: the report files it read; whether every one passed; what
//   the person can now do; each finding with its area — `tests` for the
//   test surface's — its scope, its call and where it landed: a fix task, an
//   item filed to the inbox with the ledger's call that filed it, or dropped
//   with why, the ledger's call beside an out-of-scope drop (14.3); how
//   Claude settled a failing round, null where it did not (14.6.3); and what
//   each scenario of the cut stood at as the round was recorded (15.3.3):
//
//     {"reports": ["1-cards-a.md", …], "passed": false, "can_now": ["…"],
//      "findings": [{"area": "1-cards", "scope": "in", "call": "bug",
//                    "text": "…", "fix": "4.1"}, …],
//      "settled": null, "scenarios": [{"scenario": "1.S1", "standing": "proven"}]}
//
//   Rounds run from 1 with none missing; a round never holds its own number.
// - The round under review is the one after the last recorded. Round 1 reads
//   every area; each later round the areas whose findings made fix tasks in
//   the round before, and no other (14.3.3); the test surface every round.
//   A round's fix tasks are a build phase of their own, numbered past the
//   cut, round k's `M+k` (P14, 14.3.2). The review phase is over once a
//   round makes no fix task and passed, or Claude settled it (14.6.3): no
//   count of rounds ends it.
// - The working tree outside `.leeway/` is snapshotted as the review phase
//   is entered, in the unit's cache, `review/tree.json`: each repository's
//   HEAD, and each path its status lists with the fingerprint of what it
//   holds (kernel/repos.cjs, `projectDirtyEntries`) — what `review round`
//   holds the tree to, naming every path changed since (12.7.8, 14.1.5).
// - The calls across the unit are every current decision made at any of its
//   places, with whose it is and how it was given (16.17.8); those decided
//   for the person are Claude's calls (`claudesCall`), the rule every count
//   of them reads, the build's share those made at `{unit}.implementation`
//   or `{unit}.review` (14.4.3). A finding out of scope is filed or dropped
//   by a call of Claude's own at `{unit}.review`, written through the
//   ledger's door; `review round` and `inbox file` take it by its id and
//   refuse any other (14.3.5, 14.3.7).
// ---------------------------------------------------------------------------

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { statePath } = require('../kernel/state-root.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { tryGit } = require('../kernel/git.cjs');
const { writeJsonAtomic, isObject } = require('../kernel/manifest-io.cjs');
const { BUILD_PHASES } = require('../kernel/manifest-schema.cjs');
const { projectRepos, repoName, projectDirtyEntries } = require('../kernel/repos.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { readSpec, specReading } = require('./spec-sections.cjs');
const { slugOf } = require('./landing-names.cjs');
const { REVIEWER_LETTERS } = require('../kernel/reviewers.cjs');
const { claudesCall } = require('./ledger-events.cjs');
const { isCurrent, factsOf } = require('./ledger-fold.cjs');
const { resolveId } = require('./ledger-ids.cjs');
const { handedTag } = require('./topic-map.cjs');

/** @typedef {import('./ledger-read.cjs').Shower} Shower */

/** An area of the spec: its number, its title, and its name in the layout. @typedef {{number: string, title: string, name: string}} Area */
/** What the test surface's findings and report are known by, beside the areas. */
const TESTS = 'tests';
/** The test surface's one reader's letter. */
const TESTS_LETTER = REVIEWER_LETTERS[0];

/**
 * A finding as a round records it.
 * @typedef {{area: string, scope: 'in'|'out', call: 'serious'|'bug'|'nit', text: string, fix?: string, inbox?: string, drop?: string, ledger?: string}} RoundFinding
 */
/**
 * A round as `review round` recorded it (the header's).
 * @typedef {{
 *   reports: string[], passed: boolean, can_now: string[], findings: RoundFinding[], settled: string|null,
 *   scenarios: {scenario: string, standing: string}[],
 * }} RoundRecord
 */

/** The review phase's folder, state-relative. @param {string} unit */
const reviewFolder = (unit) => `${unit}/review`;
/** A round's record, the engine's. @param {string} unit @param {number} round */
const roundRecordPath = (unit, round) => `${reviewFolder(unit)}/round-${round}.json`;
/** A round's report. @param {string} unit @param {number} round */
const roundReportFile = (unit, round) => `${reviewFolder(unit)}/round-${round}.md`;
/** A round's detailed checks. @param {string} unit @param {number} round */
const roundChecksFile = (unit, round) => `${reviewFolder(unit)}/round-${round}-checks.md`;
/** A round's folder of reports. @param {string} unit @param {number} round */
const roundFolder = (unit, round) => `${reviewFolder(unit)}/round-${round}`;
/** A reviewer's report of an area, or the test surface's, in a round. @param {string} unit @param {number} round @param {string} area @param {string} letter */
const areaReportPath = (unit, round, area, letter) => `${roundFolder(unit, round)}/${area}-${letter}.md`;

/**
 * The spec's areas, in its order, each with its name in the layout.
 * Refused where the unit has no spec.
 * @param {string} cwd @param {string} unit @returns {Area[]}
 */
function specAreas(cwd, unit) {
  return specReading(readSpec(cwd, unit)).headings
    .filter(({ kind }) => kind === 'area')
    .map(({ number, title }) => ({ number: /** @type {string} */ (number), title, name: `${number}-${slugOf(title)}` }));
}

/** The report files a round's areas and its test surface are read from, by name in its folder. @param {string[]} areas their names */
function reportNames(areas) {
  return [...areas.flatMap((area) => REVIEWER_LETTERS.map((letter) => `${area}-${letter}.md`)), `${TESTS}-${TESTS_LETTER}.md`];
}

/** Whether `value` holds strings alone. @param {unknown} value */
const strings = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');

/** Whether a round's record reads as one. @param {any} held */
function fitsRecord(held) {
  return isObject(held) && strings(held.reports) && typeof held.passed === 'boolean' && strings(held.can_now) && Array.isArray(held.findings)
    && held.findings.every((/** @type {unknown} */ finding) => isObject(finding)) && (held.settled === null || typeof held.settled === 'string')
    && Array.isArray(held.scenarios);
}

/**
 * Every round recorded, in order, from round 1 to the first not recorded;
 * refused where one does not read.
 * @param {string} cwd @param {string} unit @returns {RoundRecord[]}
 */
function recordedRounds(cwd, unit) {
  /** @type {RoundRecord[]} */
  const rounds = [];
  for (;;) {
    const rel = roundRecordPath(unit, rounds.length + 1);
    const file = statePath(cwd, rel);
    if (!fs.existsSync(file)) return rounds;
    /** @type {any} */
    let held;
    try {
      held = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      throw new Error(`${rel} does not read as a review round's record — ${messageOf(err)}`);
    }
    if (!fitsRecord(held)) throw new Error(`${rel} does not read as a review round's record — review round writes it`);
    rounds.push(held);
  }
}

/** A round's fix tasks, each once, in the order its findings name them. @param {RoundRecord} round */
const fixesOf = (round) => [...new Set(round.findings.flatMap(({ fix }) => (typeof fix === 'string' ? [fix] : [])))];

/** Whether a round ends the review phase: no fix task made, and passed or settled (14.3.3, 14.6.3). @param {RoundRecord} round */
const endsReview = (round) => fixesOf(round).length === 0 && (round.passed || round.settled !== null);

/** The build phase a round's fix tasks make: round k's, the k-th past the cut (P14). @param {Record<string, any>} manifest @param {number} round */
const fixPhase = (manifest, round) => (Array.isArray(manifest.cut?.phases) ? manifest.cut.phases.length : 0) + round;

/**
 * Where the review phase stands: the rounds recorded; whether it is over;
 * the round under review, the last recorded once it is over; and the areas
 * that round reads, by name — every one at round 1, then those whose
 * findings made fix tasks in the round before — the test surface beside
 * them while the review goes on.
 * @typedef {{rounds: RoundRecord[], over: boolean, round: number, reads: string[]}} ReviewStanding
 */

/** @param {Area[]} areas @param {RoundRecord[]} rounds @returns {ReviewStanding} */
function standingOf(areas, rounds) {
  const last = rounds.at(-1);
  if (last !== undefined && endsReview(last)) return { rounds, over: true, round: rounds.length, reads: [] };
  const named = new Set(last === undefined ? areas.map(({ name }) => name) : last.findings.filter(({ fix }) => typeof fix === 'string').map(({ area }) => area));
  return { rounds, over: false, round: rounds.length + 1, reads: areas.map(({ name }) => name).filter((name) => named.has(name)) };
}

/** Where the unit's review phase stands. @param {string} cwd @param {string} unit @returns {ReviewStanding & {areas: Area[]}} */
function reviewStanding(cwd, unit) {
  const areas = specAreas(cwd, unit);
  return { areas, ...standingOf(areas, recordedRounds(cwd, unit)) };
}

/** The snapshot of the working tree, in the unit's cache. @param {string} cwd @param {string} unit */
const snapshotPath = (cwd, unit) => statePath(cwd, '.cache', unit, 'review', 'tree.json');

/** What a path in the tree holds, as its fingerprint; null where it is gone or no file. @param {string} file absolute */
function heldPrint(file) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
  } catch {
    return null;
  }
}

/** The working tree outside `.leeway/` (the header's). @param {string} cwd @returns {{heads: Record<string, string|null>, paths: Record<string, string>}} */
function treeNow(cwd) {
  const root = codeRoot(cwd);
  const repos = projectRepos(root);
  const heads = Object.fromEntries(repos.map((repo) => [repoName(repo), tryGit(repo.path, ['rev-parse', '-q', '--verify', 'HEAD'])?.trim() ?? null]));
  const paths = Object.fromEntries(projectDirtyEntries(repos).map(({ path: at, status }) => [at, `${status} ${heldPrint(path.join(root, at)) ?? '-'}`]));
  return { heads, paths };
}

/** The working tree outside `.leeway/` snapshotted for the unit's review phase. @param {string} cwd @param {string} unit */
function takeSnapshot(cwd, unit) {
  const file = snapshotPath(cwd, unit);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJsonAtomic(file, treeNow(cwd));
}

/** A repository as a line names it. @param {string} name `.` or its folder */
const repoWords = (name) => (name === '.' ? 'the project\'s repository' : `\`${name}\``);

/**
 * What changed outside `.leeway/` since the snapshot, a line each: a
 * repository whose HEAD moved, then each path whose status or content
 * changed, in order; null where no snapshot was taken.
 * @param {string} cwd @param {string} unit @returns {string[]|null}
 */
function treeChanges(cwd, unit) {
  const file = snapshotPath(cwd, unit);
  if (!fs.existsSync(file)) return null;
  const then = JSON.parse(fs.readFileSync(file, 'utf8'));
  const now = treeNow(cwd);
  const moved = Object.keys({ ...then.heads, ...now.heads }).filter((repo) => then.heads[repo] !== now.heads[repo])
    .map((repo) => `${repoWords(repo)} is at ${now.heads[repo]?.slice(0, 7) ?? 'no commit'}, not ${then.heads[repo]?.slice(0, 7) ?? 'no commit'}`);
  const changed = [...new Set([...Object.keys(then.paths), ...Object.keys(now.paths)])].filter((at) => then.paths[at] !== now.paths[at]).sort();
  return [...moved, ...changed];
}

/**
 * A current decision of the unit's, at any of its places (16.17.8): its
 * short id, the place it was made at, whose it is and how it was given,
 * the question it answers, its answer and why, and its kind, null until the
 * labeller gives one (16.11).
 * @typedef {{short: string, phase: string, topic: string|null, by: string, given: string|null, handed: string|null, question: string|null, answer: string, why: string, kind: string|null}} UnitCall
 */

/**
 * Every current decision of the unit's, in the ledger's order.
 * @param {Shower} shower @param {string} unit @returns {UnitCall[]}
 */
function unitCalls(shower, unit) {
  const { folded, show } = shower;
  return [...folded.facts].flatMap(([id, facts]) => {
    if (facts.kind !== 'decision' || facts.unit !== unit || !isCurrent(folded, id)) return [];
    const shown = show(id);
    return [{
      short: /** @type {string} */ (shown.id),
      phase: facts.phase,
      topic: facts.topic,
      by: /** @type {string} */ (facts.by),
      given: facts.given,
      handed: handedTag({ given: facts.given ?? undefined }),
      question: facts.answers === null ? null : /** @type {string} */ (show(facts.answers).text),
      answer: /** @type {string} */ (shown.text),
      why: String(shown.why ?? ''),
      kind: /** @type {string|null} */ (shown.kind ?? null),
    }];
  });
}

/**
 * Why `given` names no file-or-drop call of the review phase's — a current
 * decision of Claude's own at `{unit}.review` (14.3.7) — or null where it
 * does.
 * @param {Shower} shower @param {string} unit @param {string} given
 * @returns {string|null}
 */
function reviewCallFault({ folded }, unit, given) {
  let id;
  try {
    id = resolveId(given, folded.facts.keys());
  } catch (err) {
    return messageOf(err);
  }
  const facts = factsOf(folded, id);
  if (facts.kind !== 'decision' || facts.unit !== unit || facts.phase !== 'review') return `${given} is no decision made at ${unit}.review — a file-or-drop call is Claude's, written there: ledger decide ${unit}.review`;
  if (!claudesCall(facts)) return `${given} is the person's decision — a file-or-drop call is Claude's own, never offered (14.3.5)`;
  return isCurrent(folded, id) ? null : `${given} is no longer current`;
}

/** Whether a call of the unit's was decided for the person: Claude's. @param {UnitCall} call */
const forThePerson = ({ by, given }) => claudesCall({ by, given });

/** Whether a call was made in the build: at the unit's implementation or review. @param {UnitCall} call */
const inTheBuild = ({ phase }) => BUILD_PHASES.includes(phase);

module.exports = {
  TESTS, TESTS_LETTER, specAreas, reportNames, recordedRounds, fixesOf, endsReview, fixPhase, reviewStanding, standingOf,
  reviewFolder, roundRecordPath, roundReportFile, roundChecksFile, roundFolder, areaReportPath,
  takeSnapshot, treeChanges, unitCalls, reviewCallFault, forThePerson, inTheBuild,
};
