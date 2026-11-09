'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a reviewer's report (13.4, 13.5.11) — the grammar every
// review in the build writes to, so the engine reads a round's outcome and
// the orchestrator takes a report's verdict and nits alone, never the rest
// (13.5.9). A report is markdown, its reading the reviewer's own, ending in
// its notes for later, then its findings, then its verdict:
//
//   ## Notes for later
//
//   - {what lies beyond the task}, at {where it is}
//
//   ## Findings
//
//   - serious: {what is wrong}
//     Scenario: {the user scenario that meets it}
//   - nit: {…}
//     Scenario: {…}
//
//   Verdict: fail
//
// Three things are held: `## Findings` is the report's last heading at
// level one or two, fenced blocks aside; its last line is its verdict,
// `Verdict: pass` or `Verdict: fail` in any case, bold or not, a period
// after it or none; and the verdict says what the findings do — a report
// passes with nothing serious and no bug (13.4.3, 13.4.4). What comes before
// `## Findings`, the notes for later among it (12.10.1), no reader here
// reads.
//
// Between them the findings are read as a careful writer writes them, and
// nothing is lost or misread (list-items.cjs). Each finding is an item at
// the margin, opening on its call — `serious`, `bug` (a real bug that is
// not serious) or `nit` (13.4.1, 13.7.2), in any case, emphasis aside —
// then `:` or a dash; it holds every line to the next, a fence or a heading
// below level two among them, and somewhere in it, outside a fenced block,
// it names its user scenario, `Scenario: {…}`, emphasised or bulleted or
// not, on a line of its own or after its text on the opening line. Prose
// before the first finding is a lead-in. `None` stands for no finding only
// as all the section holds: one line beginning with the word, emphasis
// allowed. Outside a fenced block, the section refuses, naming the line:
// a line at the margin beginning with a call that opens no finding, a
// heading among them; one below the margin opening as a finding would; an
// item opening `{word}:` on a word that is no call; and an item before the
// first finding, which has no call. So the verdict is the report's last
// line and each nit an item opening on `nit`, each read without the rest.
//
// A task's reports sit beside its account, in `build/tasks/{task}/`, one
// per reviewer of the count each round, `round-{N}-{letter}.md` (4.11.5,
// 12.14.7), and beside them a failed round the orchestrator settled, its
// settlement, `round-{N}-settled.md`, the engine's (task-account.cjs,
// 13.4.6). The count may change between rounds as the model pass
// re-measures it (13.3.4, 2.4.6), so a round before the last is read by
// the letters it holds, and the last, the round under review, by the
// count's. Its rounds run from 1 with none missing, each holding a
// reviewer's report and the last every one of the count's; a round passes where each of its reports passes, and
// the task's verdict is its last round's. A task has passed its pair once
// its last round passed or the orchestrator settled it, and nothing changed
// under that round since (below) — what its account, its phase's close and
// `land chain` all read (13.4.6). A report that does not read, or
// a round missing one, refuses every read of the task's rounds, naming it.
// The round under review is read from them too, never from a conversation:
// the last round where a report of it is still to be written or does not
// read, else the next — a settled round's too — none once a round passed,
// but where the task changed under it.
//
// A round covers a change to its task only where its pair was briefed after
// the change: each brief of a reviewer records the round it was briefed
// for and, by its letter, the conversation that briefed it; each of the
// builder's, the freeing it went past (task-verbs.cjs, `back`) and the
// changes, and its own brief, unlike a fix round's, the conversation that
// issued it, the one a fix round can go to its builder from;
// `.cache/{unit}/build/tasks/{task}/briefed.json`, `{"round", "readers",
// "builder", "change", "session"}` (`recordReviewer`, `recordBuilder`) —
// the checkout's own, as the briefs are, so a task ended with no account
// leaves nothing on the state branch. Something added to the task (`task
// add`), or a call raised for it decided other than its lean (raise.cjs),
// marks it, as it lands, with the round its pair was briefed for then,
// reported or not, and the count of its changes,
// `.cache/{unit}/build/tasks/{task}/changed.json`, `{"round": N, "n": K}`
// (`markChanged`), beside the briefs' record it is read against — none
// before any round is briefed, round 1 reading it.
// A change the builder's last brief did not go past (`pendingChange`) is
// its brief's to carry, sent again before a fix round's (brief-records.cjs).
// A round briefed and not yet reported whole (`roundStanding`) stands
// reviewer by reviewer: reported; reading, its brief issued in the calling
// conversation and its report not written; to brief again, briefed in
// another conversation or not at all; or its report not reading, which goes
// back to its reviewer. It is being read (`beingRead`) only while one is
// reading: its builder waits for the round's reports, and every other state
// names its way on (`readRefusal`). Once the round the mark names is the
// task's last reported (`changedIn`), the task changed under it, and where
// it passed (`changedUnder`), its pair reads it again in the round after
// and its account waits for that round (task-account.cjs); once a round
// briefed after the change is reported, the mark names a round before the
// last, and nothing has.
// A report that does not read is replaced by briefing its reviewer again,
// which every refusal of it names. A phase's review is
// reported beside its consolidation, `build/phases/phase-{N}/
// review-{letter}.md`, or `{area}-{letter}.md` where it was split, and read
// whole (`phaseReports`), each report with its text's fingerprint, by which
// a settlement names the reports it answers (phase-settlement.cjs) and
// commits them. What the phase's folder holds (`phaseRecords`) its close
// commits. Both read the folder as the layout places it: a file it does not
// place — an editor's swap file, a `.DS_Store` — may be one the person's
// gitignore covers, which a commit naming it fails on.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { statePath } = require('../kernel/state-root.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { REVIEWER_LETTERS } = require('../kernel/reviewers.cjs');
const { headingLevels } = require('./spec-sections.cjs');
const { BULLET, listItems, saysNone } = require('./list-items.cjs');
const { fingerprint } = require('../kernel/fingerprint.cjs');
const { layoutPlace } = require('./layout.cjs');
const { shownTask, taskName, phaseName } = require('./task-id.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** A finding's call (13.4.1). @typedef {'serious'|'bug'|'nit'} Call */
/** @typedef {{call: Call, text: string, scenario: string}} Finding */
/** @typedef {{verdict: 'pass'|'fail', findings: Finding[]}} Report */
/** A reviewer's report of a round: its letter, its path from the state root, its text. @typedef {Report & {reviewer: string, file: string, text: string}} RoundReport */
/** @typedef {{round: number, reports: RoundReport[], passes: boolean, settled: boolean}} Round */
/** A reviewer's report of a phase's review: its path from the state root, and the fingerprint of its text. @typedef {Report & {file: string, print: string}} PhaseReport */

const FINDINGS = '## Findings';
const EMPHASIS = '[*_]*';
const VERDICT = new RegExp(`^[ \\t]*${EMPHASIS}verdict${EMPHASIS}[ \\t]*:${EMPHASIS}[ \\t]*${EMPHASIS}(pass|fail)${EMPHASIS}\\.?[ \\t]*$`, 'i');
/** A finding's opening after its marker: its call, then `:` or a dash, then its text. */
const OPENING = `${EMPHASIS}(serious|bug|nit)${EMPHASIS}(?:[ \\t]*:|[ \\t]*[—–]|[ \\t]+--?(?=[ \\t]))${EMPHASIS}[ \\t]*(.*)$`;
const FINDING = new RegExp(`^${BULLET}${OPENING}`, 'i');
const BELOW_THE_MARGIN = new RegExp(`^[ \\t]+(?:${BULLET})?${OPENING}`, 'i');
const STARTS_WITH_A_CALL = new RegExp(`^(?:(?:[-*+]|[0-9]+[.)])[ \\t]*|#{1,6}[ \\t]+)?${EMPHASIS}(?:serious|bugs?|nits?)(?![\\w-])`, 'i');
const ON_A_WORD = new RegExp(`^${BULLET}${EMPHASIS}([A-Za-z][\\w-]*)${EMPHASIS}[ \\t]*:`);
const AN_ITEM = new RegExp(`^${BULLET}\\S`);
const SCENARIO_NAMED = `${EMPHASIS}(?:user[ \\t]+)?scenario${EMPHASIS}:${EMPHASIS}[ \\t]*(\\S.*)$`;
const SCENARIO_LINE = new RegExp(`^[ \\t]*(?:${BULLET})?${SCENARIO_NAMED}`, 'i');
const SCENARIO_AFTER = new RegExp(`(?:^|[ \\t])${SCENARIO_NAMED}`, 'i');
const FORM = `each finding opens at the margin on its call, \`- serious: …\`, \`- bug: …\` or \`- nit: …\``;
const ROUND_FILE = /^round-([1-9][0-9]*)-([a-z])\.md$/;
/** A report of a phase's review: its set, `review` or an area, and its reviewer's letter. */
const PHASE_REPORT = /^(.+)-([a-z])\.md$/;

/** Whether findings pass: nothing serious and no bug (13.4.3, 13.4.4). @param {readonly Finding[]} findings */
function passes(findings) {
  return findings.every(({ call }) => call === 'nit');
}

/** Lines with the indentation they share taken off. @param {string[]} lines */
function dedented(lines) {
  const depth = Math.min(...lines.filter((line) => line.trim() !== '').map((line) => /^\s*/.exec(line)?.[0].length ?? 0));
  return lines.map((line) => line.slice(Math.min(depth, line.length)));
}

/**
 * What is wrong with a line under `## Findings` that opens no finding but
 * is shaped like one (the header's), given whether a finding has opened
 * before it; null where nothing is.
 * @param {string} line @param {boolean} first
 */
function findingFault(line, first) {
  const shown = `"${line.trim()}" under ${FINDINGS}`;
  if (BELOW_THE_MARGIN.test(line)) return `${shown} opens a finding below the margin — ${FORM}`;
  if (/^\s/.test(line)) return null;
  if (STARTS_WITH_A_CALL.test(line)) return `${shown} begins with a call but opens no finding — ${FORM}`;
  const word = ON_A_WORD.exec(line)?.[1];
  if (word !== undefined && word.toLowerCase() !== 'scenario') return `${shown} opens on "${word}", which is no call — a finding's call is serious, bug or nit`;
  return first && AN_ITEM.test(line) ? `${shown} is a finding with no call — ${FORM}` : null;
}

/**
 * A finding from its item: its call, its text as written after the call,
 * and its scenario; its fault pushed to `faults` where it names none.
 * @param {import('./list-items.cjs').Item} item @param {number} number @param {string[]} faults
 * @returns {Finding}
 */
function findingOf({ opened, beneath }, number, faults) {
  const call = /** @type {Call} */ (opened[1].toLowerCase());
  const scenario = SCENARIO_AFTER.exec(opened[2])?.[1]
    ?? beneath.map(({ line, fenced }) => (fenced ? undefined : SCENARIO_LINE.exec(line)?.[1])).find((found) => found !== undefined);
  if (scenario === undefined) faults.push(`finding ${number} (${call}) names no user scenario — a line \`Scenario: …\` in it`);
  return { call, text: [opened[2], ...dedented(beneath.map(({ line }) => line))].join('\n').trim(), scenario: scenario?.trim() ?? '' };
}

/**
 * The findings under `## Findings`, none where they say `None`; what is
 * wrong pushed to `faults`.
 * @param {string[]} listed the lines between the heading and the verdict @param {string[]} faults
 * @returns {Finding[]}
 */
function findingsOf(listed, faults) {
  if (saysNone(listed)) return [];
  const { items, faults: shaped } = listItems(listed, FINDING, findingFault);
  faults.push(...shaped);
  if (items.length === 0 && shaped.length === 0) faults.push(`nothing under ${FINDINGS} is a finding — ${FORM} — or all it holds is \`None.\``);
  return items.map((item, number) => findingOf(item, number + 1, faults));
}

/**
 * A reviewer's report read by its grammar (the header's), refused where it
 * does not read, every fault named.
 * @param {string} text @returns {Report}
 */
function readReport(text) {
  const lines = text.trimEnd().split(/\r\n?|\n/);
  const levels = headingLevels(lines);
  const at = levels.reduce((last, level, line) => (level > 0 && level <= 2 ? line : last), -1);
  const verdict = VERDICT.exec(lines.at(-1) ?? '')?.[1].toLowerCase();
  /** @type {string[]} */
  const faults = [];
  if (at === -1 || lines[at].trim() !== FINDINGS) faults.push(`its last heading at level one or two is not \`${FINDINGS}\``);
  if (verdict === undefined) faults.push('its last line is not `Verdict: pass` or `Verdict: fail`');
  if (faults.length > 0) throw new Error(faults.join('; '));
  const findings = findingsOf(lines.slice(at + 1, -1), faults);
  if (faults.length === 0 && (verdict === 'pass') !== passes(findings)) {
    faults.push(verdict === 'pass' ? 'it says pass with a serious finding or a bug standing' : 'it says fail with nothing serious and no bug, which passes');
  }
  if (faults.length > 0) throw new Error(faults.join('; '));
  return { verdict: /** @type {'pass'|'fail'} */ (verdict), findings };
}

/** The folder of a task's account's own files, state-relative. @param {TaskRef} ref */
function taskFolder(ref) {
  return `${ref.unit}/build/tasks/${shownTask(ref)}`;
}

/** A reviewer's report of a task's round, state-relative. @param {TaskRef} ref @param {number} round @param {string} letter */
function roundReportPath(ref, round, letter) {
  return `${taskFolder(ref)}/round-${round}-${letter}.md`;
}

/** A reviewer's report of a phase's review, state-relative. @param {string} unit @param {number} phase @param {string} letter */
function phaseReviewPath(unit, phase, letter) {
  return `${phaseFolder(unit, phase)}/review-${letter}.md`;
}

/** The mark of a change to a task after a round of its review, in the cache, state-relative. @param {TaskRef} ref */
function changedPath(ref) {
  return `.cache/${taskFolder(ref)}/changed.json`;
}

/** The record of a task's briefs (the header's), in the cache, state-relative. @param {TaskRef} ref */
function briefedPath(ref) {
  return `.cache/${taskFolder(ref)}/briefed.json`;
}

/** @typedef {{round: number, readers: Record<string, string>, builder: number, change: number, session: string|null}} Briefed */

/**
 * What the task's briefs record: the highest round its pair was briefed
 * for, the conversation that briefed each reviewer of it by its letter, and
 * the freeing and the change its builder was last briefed past, each 0
 * where none, and the conversation that last issued its builder's own
 * brief, null where none did.
 * @param {string} cwd @param {TaskRef} ref @returns {Briefed}
 */
function briefedOf(cwd, ref) {
  const file = statePath(cwd, briefedPath(ref));
  const held = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  return { round: Number(held.round ?? 0), readers: { ...held.readers }, builder: Number(held.builder ?? 0), change: Number(held.change ?? 0), session: held.session ?? null };
}

/** One of the engine's records in the task's build folder written whole, the folder made where it is not. @param {string} cwd @param {string} rel @param {unknown} value */
function writeRecord(cwd, rel, value) {
  const file = statePath(cwd, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJsonAtomic(file, value);
}

/**
 * The task's reviewer `letter` briefed for `round` in the conversation
 * `session`: a later round starts its readers afresh, an earlier one is
 * passed over.
 * @param {string} cwd @param {TaskRef} ref @param {number} round @param {string} letter @param {string} session
 */
function recordReviewer(cwd, ref, round, letter, session) {
  const held = briefedOf(cwd, ref);
  if (round < held.round) return;
  const readers = round > held.round ? { [letter]: session } : { ...held.readers, [letter]: session };
  writeRecord(cwd, briefedPath(ref), { ...held, round, readers });
}

/**
 * The task's builder briefed past the freeing at the ledger's line `freed`
 * and the task's changes so far — by its own brief, in the conversation
 * `session`; by a fix round's, with none.
 * @param {string} cwd @param {TaskRef} ref @param {number} freed @param {string|null} [session]
 */
function recordBuilder(cwd, ref, freed, session = null) {
  const held = briefedOf(cwd, ref);
  const briefed = { ...held, builder: freed, change: changeCount(cwd, ref), session: session ?? held.session };
  if (briefed.builder !== held.builder || briefed.change !== held.change || briefed.session !== held.session) writeRecord(cwd, briefedPath(ref), briefed);
}

/** Where `task worktree` recorded the commit each repository was laid out at, in the cache, state-relative. @param {TaskRef} ref */
function laidOutPath(ref) {
  return `.cache/${taskFolder(ref)}/laid-out.json`;
}

/** The commit each repository of the task was laid out at, by its folder, `''` the project's own; none before it is laid out. @param {string} cwd @param {TaskRef} ref @returns {Record<string, string>} */
function laidOutOf(cwd, ref) {
  const file = statePath(cwd, laidOutPath(ref));
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

/** The commits the task's branch was made at, by repository folder, recorded over those held. @param {string} cwd @param {TaskRef} ref @param {Record<string, string>} made */
function recordLaidOut(cwd, ref, made) {
  if (Object.keys(made).length > 0) writeRecord(cwd, laidOutPath(ref), { ...laidOutOf(cwd, ref), ...made });
}

/** The orchestrator's settlement of a task's failed round, state-relative. @param {TaskRef} ref @param {number} round */
function settlementPath(ref, round) {
  return `${taskFolder(ref)}/round-${round}-settled.md`;
}

/** A phase's folder, where its review's reports sit, state-relative. @param {string} unit @param {number} phase */
function phaseFolder(unit, phase) {
  return `${unit}/build/phases/phase-${phase}`;
}

/**
 * The names of the files a phase's folder holds that the layout places
 * there, in name order — never an editor's swap file, a `.DS_Store` or an
 * agent's staged `.txt`, which the person's gitignore may cover and a
 * commit naming them would fail on.
 * @param {string} cwd @param {string} unit @param {number} phase @returns {string[]}
 */
function placedIn(cwd, unit, phase) {
  const rel = phaseFolder(unit, phase);
  const folder = statePath(cwd, rel);
  return (fs.existsSync(folder) ? fs.readdirSync(folder).sort() : []).filter((name) => layoutPlace(`${rel}/${name}`) !== null);
}

/** Whether any report of the phase's review is written. @param {string} cwd @param {string} unit @param {number} phase */
function phaseReviewBegun(cwd, unit, phase) {
  return placedIn(cwd, unit, phase).some((name) => PHASE_REPORT.test(name));
}

/**
 * A phase's review as its reports stand: a report from every reviewer of
 * the count, for each set of reports the folder holds — `review`, or an
 * area where the review was split (13.1.4) — each read, with its file and
 * the fingerprint of its text; or what stands in the way of reading them
 * all — none reported, a report missing, one that does not read.
 * @param {string} cwd @param {string} unit @param {number} phase
 * @returns {{faults: string[], reports: PhaseReport[]}}
 */
function phaseReports(cwd, unit, phase) {
  const rel = phaseFolder(unit, phase);
  const held = placedIn(cwd, unit, phase);
  const sets = [...new Set(held.flatMap((name) => PHASE_REPORT.exec(name)?.[1] ?? []))].sort();
  if (sets.length === 0) return { faults: [`${phaseName(unit, phase)} has no phase review reported — its reviewers write their reports in ${rel}/`], reports: [] };
  /** @type {{faults: string[], reports: PhaseReport[]}} */
  const found = { faults: [], reports: [] };
  for (const file of sets.flatMap((set) => REVIEWER_LETTERS.map((letter) => `${rel}/${set}-${letter}.md`))) {
    if (!held.includes(file.slice(rel.length + 1))) {
      found.faults.push(`the phase review has no report at ${file}`);
      continue;
    }
    const text = fs.readFileSync(statePath(cwd, file), 'utf8');
    try {
      found.reports.push({ file, print: fingerprint(text), ...readReport(text) });
    } catch (err) {
      found.faults.push(`${file} does not read as a reviewer's report — ${messageOf(err)}`);
    }
  }
  return found;
}

/**
 * Every record a phase's folder holds — its review's reports, its
 * consolidation report, its settlement — each state-relative, in name
 * order; none where it holds none.
 * @param {string} cwd @param {string} unit @param {number} phase @returns {string[]}
 */
function phaseRecords(cwd, unit, phase) {
  return placedIn(cwd, unit, phase).map((name) => `${phaseFolder(unit, phase)}/${name}`);
}

/**
 * The letters of the reviewers whose reports a round holds, in order.
 * @param {Set<string>} held the folder's file names @param {number} round
 */
function lettersHeld(held, round) {
  return [...held].flatMap((name) => {
    const named = ROUND_FILE.exec(name);
    return named !== null && Number(named[1]) === round ? [named[2]] : [];
  }).sort();
}

/**
 * One round of a task: the reports of the reviewers `letters` names, read,
 * refused where it names none, or a report is missing or does not read;
 * and whether the orchestrator settled it.
 * @param {string} cwd @param {TaskRef} ref @param {number} round @param {Set<string>} held the folder's file names @param {readonly string[]} letters the round's
 * @returns {Round}
 */
function readRound(cwd, ref, round, held, letters) {
  if (letters.length === 0) throw new Error(`round ${round} of ${taskName(ref)} has no reviewer's report — its reviewers write them in ${taskFolder(ref)}/`);
  const reports = letters.map((letter) => {
    const file = roundReportPath(ref, round, letter);
    if (!held.has(`round-${round}-${letter}.md`)) throw new Error(`round ${round} of ${taskName(ref)} has no report from reviewer ${letter} — ${file}`);
    const text = fs.readFileSync(statePath(cwd, file), 'utf8');
    try {
      return { reviewer: letter, file, text, ...readReport(text) };
    } catch (err) {
      throw new Error(`${file} does not read as a reviewer's report — ${messageOf(err)}; brief reviewer ${letter} again, and its report replaces it`);
    }
  });
  return { round, reports, passes: reports.every(({ verdict }) => verdict === 'pass'), settled: held.has(`round-${round}-settled.md`) };
}

/**
 * Every review round of a task, in order, from its reports on disk, each
 * read by its letters (the header's); none before its first report is
 * written.
 * @param {string} cwd @param {TaskRef} ref @param {readonly string[]} [letters] the count's
 * @returns {Round[]}
 */
function taskRounds(cwd, ref, letters = REVIEWER_LETTERS) {
  const held = heldFiles(cwd, ref);
  return roundsTo(cwd, ref, held, lastReported(held), letters);
}

/** A task's rounds 1 to `last`, the last read by the count's letters, each before it by those it holds. @param {string} cwd @param {TaskRef} ref @param {Set<string>} held @param {number} last @param {readonly string[]} letters @returns {Round[]} */
function roundsTo(cwd, ref, held, last, letters) {
  return Array.from({ length: last }, (_, at) => readRound(cwd, ref, at + 1, held, at + 1 === last ? letters : lettersHeld(held, at + 1)));
}

/**
 * Every review round of a task reported whole, in order: `taskRounds`, a
 * last round still waiting on a reviewer's report, or holding one that does
 * not read, left out (the header's).
 * @param {string} cwd @param {TaskRef} ref @param {readonly string[]} [letters] the count's
 * @returns {Round[]}
 */
function wholeRounds(cwd, ref, letters = REVIEWER_LETTERS) {
  const held = heldFiles(cwd, ref);
  return roundsTo(cwd, ref, held, lastWhole(cwd, ref, held, letters), letters);
}

/** Whether a round ends the task's review: every reviewer of it passed the task, or the orchestrator settled it (13.4.6). @param {Round} round */
const pairPassed = (round) => round.passes || round.settled;

/**
 * Whether a task passed its pair, by its last round (`pairPassed`), with
 * nothing changed under it since (the header's); not where no round is
 * reported. Refused as `taskRounds` refuses.
 * @param {string} cwd @param {TaskRef} ref @param {readonly string[]} [letters] the count's
 */
function taskPassed(cwd, ref, letters = REVIEWER_LETTERS) {
  const rounds = taskRounds(cwd, ref, letters);
  const last = rounds.at(-1);
  return last !== undefined && pairPassed(last) && changedUnder(cwd, ref, rounds) === null;
}

/** The names of the files a task's folder holds. @param {string} cwd @param {TaskRef} ref @returns {Set<string>} */
function heldFiles(cwd, ref) {
  const folder = statePath(cwd, taskFolder(ref));
  return new Set(fs.existsSync(folder) ? fs.readdirSync(folder) : []);
}

/** The highest round any reviewer's report is written for, 0 where none is. @param {Set<string>} held */
function lastReported(held) {
  const rounds = [...held].map((name) => ROUND_FILE.exec(name)).flatMap((named) => (named !== null ? [Number(named[1])] : []));
  return Math.max(0, ...rounds);
}

/** Whether every reviewer of the count has a report of `round` that reads. @param {string} cwd @param {TaskRef} ref @param {Set<string>} held @param {number} round @param {readonly string[]} letters */
function reportedWhole(cwd, ref, held, round, letters) {
  return letters.every((letter) => held.has(`round-${round}-${letter}.md`) && reportFaults(statePath(cwd, roundReportPath(ref, round, letter))) === null);
}

/** The highest round every reviewer of the count has reported, 0 where none is. @param {string} cwd @param {TaskRef} ref @param {Set<string>} held @param {readonly string[]} letters */
function lastWhole(cwd, ref, held, letters) {
  const last = lastReported(held);
  return last > 0 && !reportedWhole(cwd, ref, held, last, letters) ? last - 1 : last;
}

/** @typedef {{letter: string, state: 'reported'|'reading'|'again'|'unread', faults: string|null}} Reader */

/**
 * The round of the task briefed and not yet reported whole, reviewer by
 * reviewer, as the conversation `session` stands to it (the header's);
 * null where none is.
 * @param {string} cwd @param {TaskRef} ref @param {string|null} session @param {readonly string[]} [letters] the count's
 * @returns {{round: number, readers: Reader[]}|null}
 */
function roundStanding(cwd, ref, session, letters = REVIEWER_LETTERS) {
  const { round, readers } = briefedOf(cwd, ref);
  const held = heldFiles(cwd, ref);
  if (round <= lastWhole(cwd, ref, held, letters)) return null;
  return {
    round,
    readers: letters.map((letter) => {
      if (!held.has(`round-${round}-${letter}.md`)) return { letter, state: session !== null && readers[letter] === session ? 'reading' : 'again', faults: null };
      const faults = reportFaults(statePath(cwd, roundReportPath(ref, round, letter)));
      return { letter, state: faults === null ? 'reported' : 'unread', faults };
    }),
  };
}

/**
 * The round of the task its pair is reading (the header's): one briefed
 * and not yet reported whole, a reviewer briefed for it in the conversation
 * `session` still to report; null where none is.
 * @param {string} cwd @param {TaskRef} ref @param {string|null} session @param {readonly string[]} [letters] the count's
 * @returns {number|null}
 */
function beingRead(cwd, ref, session, letters = REVIEWER_LETTERS) {
  const standing = roundStanding(cwd, ref, session, letters);
  return standing !== null && standing.readers.some(({ state }) => state === 'reading') ? standing.round : null;
}

/** Each way on for a reviewer of a round not reported whole, by its state. */
const READER_WAYS = Object.freeze({
  reading: (/** @type {string} */ letter, /** @type {string} */ brief) => `reviewer ${letter}, briefed in this conversation, is still to report: wait for it — or, where it stopped without writing its report, brief it again, ${brief}`,
  again: (/** @type {string} */ letter, /** @type {string} */ brief) => `reviewer ${letter} was briefed in an earlier conversation, or not at all: brief it for the round, ${brief}`,
  unread: (/** @type {string} */ letter, /** @type {string} */ brief, /** @type {string|null} */ faults) => `reviewer ${letter}'s report does not read — ${faults}: it goes back to its reviewer, ${brief}`,
});

/**
 * Why the task's builder waits on a round not reported whole, `standing`:
 * each reviewer whose report is not in, or does not read, with its way on.
 * @param {TaskRef} ref @param {{round: number, readers: Reader[]}} standing
 */
function readRefusal(ref, { round, readers }) {
  const ways = readers.filter(({ state }) => state !== 'reported').map(({ letter, state, faults }) => {
    const brief = `engine brief reviewer ${ref.unit} ${shownTask(ref)} --letter ${letter}`;
    return READER_WAYS[/** @type {'reading'|'again'|'unread'} */ (state)](letter, brief, faults);
  });
  return `round ${round} of ${taskName(ref)} is not yet reported whole — ${ways.join('; ')} — and its builder goes back once the round's reports are in`;
}

/** Why a file's text does not read as a reviewer's report, by `read`, or null where it does. @param {string} file @param {(text: string) => unknown} [read] @returns {string|null} */
function reportFaults(file, read = readReport) {
  try {
    read(fs.readFileSync(file, 'utf8'));
    return null;
  } catch (err) {
    return messageOf(err);
  }
}

/**
 * A change to the task marked (the header's): against the round its pair
 * was briefed for, reported or not, the path of the mark answered; nothing
 * where no round is briefed yet, the round to come reading the task as it
 * is.
 * @param {string} cwd @param {TaskRef} ref @returns {string|null}
 */
function markChanged(cwd, ref) {
  const { round } = briefedOf(cwd, ref);
  if (round === 0) return null;
  writeRecord(cwd, changedPath(ref), { round, n: changeCount(cwd, ref) + 1 });
  return changedPath(ref);
}

/** The task's mark, `{round: 0, n: 0}` where it has none. @param {string} cwd @param {TaskRef} ref @returns {{round: number, n: number}} */
function markOf(cwd, ref) {
  const file = statePath(cwd, changedPath(ref));
  const held = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  return { round: Number(held.round ?? 0), n: Number(held.n ?? 0) };
}

/** The round the task's mark names, or 0 where it has none. @param {string} cwd @param {TaskRef} ref */
const markedRound = (cwd, ref) => markOf(cwd, ref).round;

/** How many changes the task's mark counts, 0 where it has none. @param {string} cwd @param {TaskRef} ref */
const changeCount = (cwd, ref) => markOf(cwd, ref).n;

/** Whether the task changed since its builder's last brief (the header's). @param {string} cwd @param {TaskRef} ref */
const pendingChange = (cwd, ref) => changeCount(cwd, ref) > briefedOf(cwd, ref).change;

/**
 * The round the task changed in (the header's): its last, where the mark
 * names it, the change landing after its pair was briefed; else null.
 * @param {string} cwd @param {TaskRef} ref @param {readonly Round[]} rounds the task's
 * @returns {number|null}
 */
function changedIn(cwd, ref, rounds) {
  const last = rounds.at(-1);
  return last !== undefined && markedRound(cwd, ref) === last.round ? last.round : null;
}

/**
 * The round the task changed under (the header's): its last, where that
 * round ended its review and the task changed in it; else null.
 * @param {string} cwd @param {TaskRef} ref @param {readonly Round[]} rounds the task's
 * @returns {number|null}
 */
function changedUnder(cwd, ref, rounds) {
  const last = rounds.at(-1);
  return last !== undefined && pairPassed(last) ? changedIn(cwd, ref, rounds) : null;
}

/**
 * Why a task that changed under its last round, `round`, goes no further
 * until its pair reads it again (round-report.cjs): the way on, that round.
 * @param {TaskRef} ref @param {number} round
 */
function changedRefusal(ref, round) {
  return `${taskName(ref)} changed after round ${round} passed — something was added to it, or a call of it decided against its lean — so its pair reads it again first: engine brief reviewer ${ref.unit} ${shownTask(ref)} --letter <letter>, each reviewer of round ${round + 1}`;
}

/**
 * The round of a task under review, from its reports on disk alone, so
 * every reviewer of a round is briefed for it whenever they are: the last
 * round reported where a report of it the count asks for is still to be
 * written, or does not read, else the one after it — a
 * settled round among them, the orchestrator's direction reviewed again
 * (13.4.6), and one the task changed under (the header's); refused where
 * the last round passed with nothing changed under it, which ends the
 * task's review.
 * @param {string} cwd @param {TaskRef} ref @param {readonly string[]} [letters] the count's
 * @returns {number}
 */
function roundUnderReview(cwd, ref, letters = REVIEWER_LETTERS) {
  const held = heldFiles(cwd, ref);
  const last = lastReported(held);
  if (last === 0) return 1;
  if (!reportedWhole(cwd, ref, held, last, letters)) return last;
  if (readRound(cwd, ref, last, held, letters).passes && markedRound(cwd, ref) !== last) throw new Error(`round ${last} of ${taskName(ref)} passed — its review is over`);
  return last + 1;
}

module.exports = {
  passes, readReport, reportFaults, taskFolder, roundReportPath, settlementPath, changedPath, briefedPath, briefedOf, recordReviewer, recordBuilder, laidOutPath, laidOutOf, recordLaidOut,
  roundStanding, beingRead, readRefusal, pendingChange,
  taskRounds, wholeRounds, pairPassed, taskPassed, markChanged, changedIn, changedUnder, changedRefusal, roundUnderReview, phaseReviewPath,
  phaseFolder, phaseReviewBegun, phaseReports, phaseRecords,
};
