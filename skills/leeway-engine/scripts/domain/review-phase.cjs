'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the review phase's records (§14), read alike by its entry
// (review-entry.cjs), its verbs (review-round.cjs, review-verbs.cjs), its
// briefs (brief-records.cjs) and its screens (projections/review-phase.cjs).
//
// - Its areas are the spec's: each `## N. Title`, in the spec's order, never
//   merged (14.2.1, 14.2.3), known in the layout by its number and its
//   title's slug, `{n}-{slug}` (landing-names.cjs) — so a one-area spec has
//   one pair. Each area is read by the pair (kernel/reviewers.cjs), each
//   reviewer's report at `review/round-{N}/{area}-{letter}.md`, and the
//   change's tests by one reader, `tests` beside the areas, its report at
//   `review/round-{N}/tests-a.md` (14.2.2, 14.2.4).
// - A round is recorded by `review round` alone, at `review/round-{N}.json`,
//   the engine's: the report files it read; whether every one passed; what
//   the person can now do; each finding with its area — `tests` for the
//   test surface's — its scope, its call, the items of the reports it
//   answers, `{report}#{n}`, every item of every report answered by exactly
//   one finding, and where it landed: a fix task, an item filed to the inbox,
//   or dropped with why, the ledger's file-or-drop call beside each finding
//   out of scope and each above a nit dropped (14.3); how Claude settled a
//   failing round, null where it did not (14.6.3); and what each scenario
//   of the cut stood at as the round was recorded (15.3.3):
//
//     {"reports": ["1-cards-a.md", …], "passed": false, "can_now": ["…"],
//      "findings": [{"area": "1-cards", "scope": "in", "call": "bug",
//                    "text": "…", "from": ["1-cards-a#1"], "fix": "4.1"}, …],
//      "settled": null, "scenarios": [{"scenario": "1.S1", "standing": "proven"}]}
//
//   Rounds run from 1 with none missing; a round never holds its own number.
// - A round's fix tasks are a build phase of their own, numbered past the
//   cut, round k's `M+k` (P14, 14.3.2), each waited on until it is done or
//   closed. A round that passed, or that Claude settled, ends the review
//   phase (14.6.3) — no count of rounds ends it — which is over once that
//   round's fix tasks, nits alone where it passed, are done: no area is read
//   again for them (13.4.4, 13.10.1). Any other round is followed by the
//   next, once its fix tasks are done — and in step once its fix phase has
//   merged too, which stops at its gate as any phase merge does (14.6.2,
//   7.2.4), so the next round reads the tree it merged into, each phase
//   below it merging first, a fix phase built on them (7.2.6); in auto the
//   fix phases land at finish.
// - Round 1 reads every area and the test surface. Each later round reads
//   the areas Claude names once the fix tasks are done, from what they
//   changed (`review reads`, at `review/round-{N}-reads.json`, the
//   engine's): every one whose findings made fix tasks among them — each
//   read whose report holds an item such a finding answers — the test
//   surface as one of them, others added but none dropped (14.3.3).
// - A note for later a fix task's builder banks (`task note`, notes.cjs)
//   is one no phase's consolidation takes, a fix phase having none: the
//   review phase answers it, as it answers a reader's note — `notes#{k}`
//   among the items of the next round recorded, or, where the round that
//   ended the phase made the fix task, answered on its own (`review
//   notes`), its findings joining that round's record. A note held for no
//   phase that no phase's report took and no round answered stands, and the
//   phase is not over while one does (14.3.5).
// - What put back changes is set aside first (review-tree.cjs) at
//   `.cache/.set-aside/{unit}/round-{N}/put-{k}/{path}`, beside the units'
//   caches and never in one, so no lifecycle verb that takes a unit's cache
//   takes it — no unit's name opens on a dot — and nothing in the engine
//   removes it: the person does. While it holds anything, the screen of
//   the round's report, the entry and finish's screen name it
//   (`setAsideHeld`), the report's file never, a folder of this machine's.
// - The working tree outside `.leeway/` is snapshotted for a round in the
//   unit's cache, `review/tree.json`: the round's number, each repository's
//   HEAD, each path its status lists with the fingerprint of what it holds
//   (kernel/repos.cjs, `projectDirtyEntries`), a rename as its two paths,
//   and each repository's ignored entries, a folder ignored whole as one, so
//   what was there unseen is never taken for what was not. It is taken where its
//   round opens — round 1 at its entry, a later round at `review reads`,
//   which every later round calls before its briefs — and only where none
//   is held, never again while one is; `review round` holds the tree to its
//   own round's, naming every path changed since, and drops it once the
//   round is recorded. Only the person's word takes it again (`review
//   accept-tree`, 12.7.8, 14.1.5).
// - The calls across the unit are every current decision made at any of its
//   places, with whose it is and how it was given (16.17.8); those decided
//   for the person are Claude's calls (`claudesCall`), the rule every count
//   of them reads, the build's share those made at `{unit}.implementation`
//   or `{unit}.review` (14.4.3). A finding is filed or dropped by a call of
//   Claude's own at `{unit}.review`, written through the ledger's door;
//   `review round` and `inbox file` take it by its id and refuse any other
//   (14.3.5, 14.3.7).
// ---------------------------------------------------------------------------

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { statePath } = require('../kernel/state-root.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { tryGit } = require('../kernel/git.cjs');
const { writeJsonAtomic, isObject, isStringList } = require('../kernel/manifest-io.cjs');
const { BUILD_PHASES } = require('../kernel/manifest-schema.cjs');
const { repoName } = require('../kernel/repos.cjs');
const { codeChanges } = require('./worktree-prep.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { readSpec, specReading } = require('./spec-sections.cjs');
const { slugOf } = require('./landing-names.cjs');
const { REVIEWER_LETTERS } = require('../kernel/reviewers.cjs');
const { claudesCall } = require('./ledger-events.cjs');
const { isCurrent, factsOf } = require('./ledger-fold.cjs');
const { resolveId } = require('./ledger-ids.cjs');
const { handedTag } = require('./topic-map.cjs');
const { phaseLists, mergeWaiting } = require('./phase-checks.cjs');
const { shownTask } = require('./task-id.cjs');
const { cutLength } = require('./derivations.cjs');
const { STATUS_WORDS } = require('./task-verbs.cjs');
const { notesUntaken } = require('./notes.cjs');

/** @typedef {import('./ledger-read.cjs').Shower} Shower */
/** @typedef {import('./phase-checks.cjs').Reading} Reading */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

/** An area of the spec: its number, its title, and its name in the layout. @typedef {{number: string, title: string, name: string}} Area */
/** What the test surface's findings, its place among a round's reads and its report are known by, beside the areas. */
const TESTS = 'tests';
/** The test surface's one reader's letter. */
const TESTS_LETTER = REVIEWER_LETTERS[0];
/** What a builder's note is known by among a round's items, `notes#{k}`, and the area of a finding that answers builders' notes alone. */
const NOTES = 'notes';

/** The folder of the cache what put back sets aside is kept in, by unit. */
const SET_ASIDE = '.set-aside';

/** Where a unit's put backs set aside what they changed (the header's). @param {string} cwd @param {string} unit */
const setAsideFolder = (cwd, unit) => statePath(cwd, '.cache', SET_ASIDE, unit);

/** A copy put back set aside, from its unit's folder: `round-{N}/put-{k}/{path}`. */
const ASIDE_COPY = /^round-[1-9][0-9]*\/put-[1-9][0-9]*\/./;

/** What a unit's put backs set aside: the folder, and each copy in it from there. @typedef {{folder: string, paths: string[]}} SetAside */

/** Every file and link under `folder`, from it, a link never followed. @param {string} folder @param {string} [from] @returns {string[]} */
function filesUnder(folder, from = '') {
  return fs.readdirSync(path.join(folder, from), { withFileTypes: true }).flatMap((entry) => {
    const rel = from === '' ? entry.name : `${from}/${entry.name}`;
    return entry.isDirectory() ? filesUnder(folder, rel) : [rel];
  });
}

/** What the unit's put backs set aside, in order, null where they set aside nothing. @param {string} cwd @param {string} unit @returns {SetAside|null} */
function setAsideHeld(cwd, unit) {
  const folder = setAsideFolder(cwd, unit);
  const paths = fs.existsSync(folder) ? filesUnder(folder).filter((rel) => ASIDE_COPY.test(rel)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })) : [];
  return paths.length === 0 ? null : { folder, paths };
}

/** Whether a round's item is a builder's note. @param {string} item */
const isBuilderNote = (item) => item.startsWith(`${NOTES}#`);

/**
 * A finding as a round records it.
 * @typedef {{area: string, scope: 'in'|'out', call: 'serious'|'bug'|'nit', text: string, from: string[], fix?: string, inbox?: string, drop?: string, ledger?: string}} RoundFinding
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
/** The areas a later round reads, as Claude named them, the engine's. @param {string} unit @param {number} round */
const roundReadsPath = (unit, round) => `${reviewFolder(unit)}/round-${round}-reads.json`;
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

/** The report files a round's reads are read from, by name in its folder: each area's pair, and the test surface's one. @param {string[]} reads */
function reportNames(reads) {
  return reads.flatMap((read) => (read === TESTS ? [`${TESTS}-${TESTS_LETTER}.md`] : REVIEWER_LETTERS.map((letter) => `${read}-${letter}.md`)));
}

/** Whether a round's record reads as one. @param {any} held */
function fitsRecord(held) {
  return isObject(held) && isStringList(held.reports) && typeof held.passed === 'boolean' && isStringList(held.can_now) && Array.isArray(held.findings)
    && held.findings.every((/** @type {unknown} */ finding) => isObject(finding)) && (held.settled === null || typeof held.settled === 'string')
    && Array.isArray(held.scenarios);
}

/**
 * A record of the review phase's, read: null where there is none, refused
 * where it does not read as `fits` holds it.
 * @param {string} cwd @param {string} rel @param {string} what @param {(held: any) => boolean} fits
 */
function recordAt(cwd, rel, what, fits) {
  const file = statePath(cwd, rel);
  if (!fs.existsSync(file)) return null;
  /** @type {any} */
  let held;
  try {
    held = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${rel} does not read as ${what} — ${messageOf(err)}`);
  }
  if (!fits(held)) throw new Error(`${rel} does not read as ${what} — the engine writes it`);
  return held;
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
    const held = recordAt(cwd, roundRecordPath(unit, rounds.length + 1), 'a review round\'s record', fitsRecord);
    if (held === null) return rounds;
    rounds.push(held);
  }
}

/** The areas Claude named for a later round, or null where it named none yet. @param {string} cwd @param {string} unit @param {number} round @returns {string[]|null} */
function namedReads(cwd, unit, round) {
  return recordAt(cwd, roundReadsPath(unit, round), 'the areas a review round reads', (held) => isObject(held) && isStringList(held.reads))?.reads ?? null;
}

/** A round's fix tasks, each once, in the order its findings name them. @param {RoundRecord} round */
const fixesOf = (round) => [...new Set(round.findings.flatMap(({ fix }) => (typeof fix === 'string' ? [fix] : [])))];

/** Whether a round ends the review phase: it passed, or Claude settled it (14.6.3). @param {RoundRecord} round */
const endsReview = (round) => round.passed || round.settled !== null;

/** The build phase a round's fix tasks make: round k's, the k-th past the cut (P14). @param {Record<string, any>} manifest @param {number} round */
const fixPhase = (manifest, round) => cutLength(manifest) + round;

/** The reads every area and the test surface make: round 1's. @param {Area[]} areas */
const everyRead = (areas) => [...areas.map(({ name }) => name), TESTS];

/** The read a report item `{report}#{n}` is of: its report's name without the reviewer's letter. @param {string} item */
const readOfItem = (item) => item.replace(/#\d+$/, '').replace(new RegExp(`-(${REVIEWER_LETTERS.join('|')})$`), '');

/**
 * The reads whose findings in a round made fix tasks, in the reads' order:
 * each such finding's area, and each read whose report holds an item it
 * answers.
 * @param {Area[]} areas @param {RoundRecord} round
 */
function fixedReads(areas, round) {
  const fixed = new Set(round.findings.filter(({ fix }) => typeof fix === 'string').flatMap(({ area, from }) => [area, ...from.map(readOfItem)]));
  return everyRead(areas).filter((read) => fixed.has(read));
}

/**
 * What comes after the last round waits on (14.3.3): its fix tasks neither
 * done nor closed, each with where it stands; and once none is, in step,
 * the lowest phase up to its fix phase whose stack waits at its merge gate
 * (`mergeWaiting`, phase-checks.cjs) — that fix phase's own, or one below
 * it a switch from auto left unmerged — null where none waits.
 * @param {Reading} at @param {RoundRecord[]} rounds
 * @returns {{waiting: string[], merging: number|null}}
 */
function fixesWaiting(at, rounds) {
  const last = rounds.at(-1);
  if (last === undefined || fixesOf(last).length === 0) return { waiting: [], merging: null };
  const phase = fixPhase(at.manifest, rounds.length);
  const statuses = new Map((phaseLists(at, [phase])[0] ?? []).map(({ ref, status }) => [shownTask(ref), status]));
  const waiting = fixesOf(last).filter((fix) => !['done', 'closed'].includes(statuses.get(fix) ?? ''))
    .map((fix) => `${fix} ${STATUS_WORDS[statuses.get(fix) ?? ''] ?? 'not in the tracker'}`);
  return { waiting, merging: waiting.length > 0 ? null : mergeWaiting(at, phase) };
}

/** The builders' notes standing (the header's), each `notes#{k}`, in order. @param {string} cwd @param {string} unit @param {RoundRecord[]} rounds */
function notesStanding(cwd, unit, rounds) {
  const answered = new Set(rounds.flatMap(({ findings }) => findings.flatMap(({ from }) => from)));
  return notesUntaken(cwd, unit).map(({ note }) => `${NOTES}#${note}`).filter((item) => !answered.has(item));
}

/**
 * Where the review phase stands: the spec's areas; the rounds recorded; the
 * round under review, or the last recorded once a round ended the phase;
 * whether one did, and whether the phase is over; the last round's fix
 * tasks waiting; in step, the fix phase whose merge the round under review
 * waits on, null where none; the reads the round under review must take;
 * those it takes — null for a later round whose areas Claude has not yet
 * named; and the builders' notes standing.
 * @typedef {{
 *   areas: Area[], rounds: RoundRecord[], round: number, ended: boolean, over: boolean,
 *   waiting: string[], merging: number|null, required: string[], reads: string[]|null, notes: string[],
 * }} ReviewStanding
 */

/** Where the unit's review phase stands, its tracker read through `at`. @param {Reading} at @returns {ReviewStanding} */
function reviewStanding(at) {
  const { cwd, unit } = at;
  const areas = specAreas(cwd, unit);
  const rounds = recordedRounds(cwd, unit);
  const { waiting, merging } = fixesWaiting(at, rounds);
  const notes = notesStanding(cwd, unit, rounds);
  const last = rounds.at(-1);
  if (last === undefined) return { areas, rounds, round: 1, ended: false, over: false, waiting, merging, required: everyRead(areas), reads: everyRead(areas), notes };
  if (endsReview(last)) {
    return { areas, rounds, round: rounds.length, ended: true, over: waiting.length === 0 && notes.length === 0, waiting, merging: null, required: [], reads: [], notes };
  }
  const round = rounds.length + 1;
  return { areas, rounds, round, ended: false, over: false, waiting, merging, required: fixedReads(areas, last), reads: namedReads(cwd, unit, round), notes };
}

/** How the round that ended the review phase did, as a sentence says it. @param {string} unit @param {ReviewStanding} standing */
function endedWords(unit, { rounds, round }) {
  return `${unit}'s review phase ${rounds[round - 1].passed ? 'passed' : 'was settled'} in round ${round}`;
}

/** Why the builders' notes standing hold the review phase open, with the way on. @param {string} unit @param {string[]} notes */
const notesWords = (unit, notes) => `the notes its fix tasks' builders left are answered, then finish: ${notes.join(', ')} — review notes ${unit} --file <notes.json>`;

/**
 * Why nothing more is read or recorded once a round ended the review phase,
 * with the way on: finish, or that round's fix tasks first, then its
 * builders' notes answered; null while the review goes on.
 * @param {string} unit @param {ReviewStanding} standing @returns {string|null}
 */
function endedRefusal(unit, standing) {
  if (!standing.ended) return null;
  if (standing.over) return `${endedWords(unit, standing)} — finish is next`;
  if (standing.waiting.length > 0) return `${endedWords(unit, standing)} — its fix tasks are built, then finish: task ${standing.waiting.join(', task ')}`;
  return `${endedWords(unit, standing)} — ${notesWords(unit, standing.notes)}`;
}

/** Why a round cannot be read yet: the round before's fix tasks not done. @param {ReviewStanding} standing */
const waitingWords = ({ round, waiting }) => `round ${round} is read once every fix task of round ${round - 1} is done — task ${waiting.join(', task ')}`;

/** The fix phase whose merge the round under review waits on, in step, and its gate. @param {string} unit @param {number} phase */
const mergingWords = (unit, phase) => `phase ${phase} waits at its gate: render phase-merge-gate ${unit} ${phase}`;

/** A round's reads as a line names them, the test surface by its name. @param {string[]} reads */
const readsWords = (reads) => reads.map((read) => (read === TESTS ? `the test surface (${TESTS})` : read)).join(', ');

/** Why a later round's reads are not yet known, with the way on. @param {string} unit @param {ReviewStanding} standing */
const unnamedWords = (unit, { round, required }) => `round ${round}'s areas are not yet named — review reads ${unit} <area> …, from what round ${round - 1}'s fix tasks changed, among them ${readsWords(required)}`;

/**
 * Why no round is under review, or null: one ended the phase, the round
 * before's fix tasks wait, or, in step, its fix phase's merge.
 * @param {string} unit @param {ReviewStanding} standing @returns {string|null}
 */
function openRefusal(unit, standing) {
  const ended = endedRefusal(unit, standing);
  if (ended !== null) return ended;
  if (standing.waiting.length > 0) return waitingWords(standing);
  return standing.merging === null ? null : `round ${standing.round} is read once round ${standing.round - 1}'s fix phase has merged — ${mergingWords(unit, standing.merging)}`;
}

/**
 * Why the round under review cannot be read or recorded yet, or null: none
 * is under review (openRefusal), or its areas are not named.
 * @param {string} unit @param {ReviewStanding} standing @returns {string|null}
 */
function roundRefusal(unit, standing) {
  return openRefusal(unit, standing) ?? (standing.reads === null ? unnamedWords(unit, standing) : null);
}

/** The snapshot of the working tree, in the unit's cache. @param {string} cwd @param {string} unit */
const snapshotPath = (cwd, unit) => statePath(cwd, '.cache', unit, 'review', 'tree.json');

/** What a path in the tree holds, as its fingerprint; null where it is gone or no file. @param {string} file absolute */
function heldPrint(file) {
  try {
    return contentPrint(fs.readFileSync(file));
  } catch {
    return null;
  }
}

/** The fingerprint of what a file holds, as a snapshot keeps it. @param {Buffer} content */
function contentPrint(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
}

/** The fingerprint of an empty file's content. */
const EMPTY_PRINT = contentPrint(Buffer.alloc(0));

/** The working tree outside `.leeway/` (the header's), its ignored entries aside. @param {string} root the code root @param {Repo[]} repos @returns {{heads: Record<string, string|null>, paths: Record<string, string>}} */
function treeNow(root, repos) {
  const heads = Object.fromEntries(repos.map((repo) => [repoName(repo), tryGit(repo.path, ['rev-parse', '-q', '--verify', 'HEAD'])?.trim() ?? null]));
  const paths = Object.fromEntries(codeChanges(repos, { renames: false }).map(({ path: at, status }) => [at, `${status} ${heldPrint(path.join(root, at)) ?? '-'}`]));
  return { heads, paths };
}

/** Each repository's ignored entries, by its name, each from its top, a folder ignored whole as one ending `/`. @param {Repo[]} repos @returns {Record<string, string[]>} */
function ignoredNow(repos) {
  return Object.fromEntries(repos.map((repo) => [
    repoName(repo), (tryGit(repo.path, ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z']) ?? '').split('\0').filter(Boolean),
  ]));
}

/** The working tree outside `.leeway/` snapshotted for a round, over any held: on the person's word alone. @param {string} cwd @param {string} unit @param {number} round @param {Repo[]} repos */
function takeSnapshot(cwd, unit, round, repos) {
  const file = snapshotPath(cwd, unit);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJsonAtomic(file, { round, ...treeNow(codeRoot(cwd), repos), ignored: ignoredNow(repos) });
}

/** The working tree snapshotted as a round opens, where none is held; one held kept as it stands. @param {string} cwd @param {string} unit @param {number} round @param {Repo[]} repos */
function openSnapshot(cwd, unit, round, repos) {
  if (!fs.existsSync(snapshotPath(cwd, unit))) takeSnapshot(cwd, unit, round, repos);
}

/** The round whose snapshot is held, or null where none is. @param {string} cwd @param {string} unit @returns {number|null} */
function snapshotRound(cwd, unit) {
  const file = snapshotPath(cwd, unit);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).round : null;
}

/** The snapshot dropped, once the round it held the tree for is recorded. @param {string} cwd @param {string} unit */
const dropSnapshot = (cwd, unit) => fs.rmSync(snapshotPath(cwd, unit), { force: true });

/** A repository as a line names it. @param {string} name `.` or its folder */
const repoWords = (name) => (name === '.' ? 'the project\'s repository' : `\`${name}\``);

/**
 * A change outside `.leeway/` since the snapshot: what it is of — a
 * repository by its name, or a path — and what it was then and is now, a
 * HEAD or a path's status with the fingerprint of what it holds; null where
 * there was none, or the path was clean.
 * @typedef {{of: string, then: string|null, now: string|null}} TreeChange
 */

/**
 * What changed outside `.leeway/` since the snapshot: each repository whose
 * HEAD moved, and each path whose status or content changed, in order, with
 * each repository's HEAD, its ignored entries and each path its status
 * listed as the snapshot holds them; read once the round's snapshot is held
 * (snapshotRound).
 * @param {string} cwd @param {string} unit @param {Repo[]} repos
 * @returns {{heads: Record<string, string|null>, ignored: Record<string, string[]>, held: Record<string, string>, moved: TreeChange[], paths: TreeChange[]}}
 */
function treeDrift(cwd, unit, repos) {
  const then = JSON.parse(fs.readFileSync(snapshotPath(cwd, unit), 'utf8'));
  const now = treeNow(codeRoot(cwd), repos);
  /** @param {Record<string, string|null>} was @param {Record<string, string|null>} is @returns {TreeChange[]} */
  const drift = (was, is) => [...new Set([...Object.keys(was), ...Object.keys(is)])].filter((of) => was[of] !== is[of]).map((of) => ({ of, then: was[of] ?? null, now: is[of] ?? null }));
  return {
    heads: then.heads, ignored: then.ignored, held: then.paths, moved: drift(then.heads, now.heads), paths: drift(then.paths, now.paths).sort((a, b) => (a.of < b.of ? -1 : 1)),
  };
}

/** A commit's first seven characters. @param {string} sha */
const shortSha = (sha) => sha.slice(0, 7);

/** A repository whose HEAD moved, as a line names it: one new since the snapshot, or one gone, said so. @param {TreeChange} moved */
function movedWords({ of, then, now }) {
  if (then === null) return `${repoWords(of)} is a repository new since the round began`;
  if (now === null) return `${repoWords(of)} holds no commit now, at ${shortSha(then)} when the round began`;
  return `${repoWords(of)}'s HEAD moved, from ${shortSha(then)} to ${shortSha(now)}`;
}

/**
 * What changed outside `.leeway/` since the snapshot, a line each: a
 * repository whose HEAD moved, then each path whose status or content
 * changed, in order (treeDrift).
 * @param {string} cwd @param {string} unit @param {Repo[]} repos @returns {string[]}
 */
function treeChanges(cwd, unit, repos) {
  const { moved, paths } = treeDrift(cwd, unit, repos);
  return [...moved.map(movedWords), ...paths.map(({ of }) => of)];
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
  TESTS, TESTS_LETTER, NOTES, isBuilderNote, SET_ASIDE, setAsideFolder, setAsideHeld, EMPTY_PRINT, reportNames, recordedRounds, fixesOf, endsReview, fixPhase, reviewStanding, everyRead,
  endedWords, endedRefusal, openRefusal, roundRefusal, readsWords, mergingWords,
  roundRecordPath, roundReportFile, roundChecksFile, roundReadsPath, roundFolder, areaReportPath,
  takeSnapshot, openSnapshot, snapshotRound, dropSnapshot, treeDrift, movedWords, treeChanges, unitCalls, reviewCallFault, forThePerson, inTheBuild,
};
