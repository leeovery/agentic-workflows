'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a reviewer's report (13.4, 13.5.11) — the grammar every
// review in the build writes to, so the engine reads a round's outcome and
// the orchestrator takes a report's verdict and nits alone, never the rest
// (13.5.9). A report is markdown, its reading the reviewer's own, ending in
// its findings, then its verdict:
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
// passes with nothing serious and no bug (13.4.3, 13.4.4).
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
// 13.4.6). Its rounds run from 1 with none missing, each holding every
// reviewer's report; a round passes where each of them passes, and the
// task's verdict is its last round's. A report that does not read, or a
// round missing one, refuses every read of the task's rounds, naming it.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { statePath } = require('../kernel/state-root.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { REVIEWER_LETTERS } = require('../kernel/reviewers.cjs');
const { headingLevels } = require('./spec-sections.cjs');
const { BULLET, listItems, saysNone } = require('./list-items.cjs');
const { shownTask, taskName } = require('./task-id.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** A finding's call (13.4.1). @typedef {'serious'|'bug'|'nit'} Call */
/** @typedef {{call: Call, text: string, scenario: string}} Finding */
/** @typedef {{verdict: 'pass'|'fail', findings: Finding[]}} Report */
/** A reviewer's report of a round: its letter, its path from the state root, its text. @typedef {Report & {reviewer: string, file: string, text: string}} RoundReport */
/** @typedef {{round: number, reports: RoundReport[], passes: boolean, settled: boolean}} Round */

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

/** The orchestrator's settlement of a task's failed round, state-relative. @param {TaskRef} ref @param {number} round */
function settlementPath(ref, round) {
  return `${taskFolder(ref)}/round-${round}-settled.md`;
}

/**
 * One round of a task: every reviewer's report read, refused where one is
 * missing or does not read, and whether the orchestrator settled it.
 * @param {string} cwd @param {TaskRef} ref @param {number} round @param {Set<string>} held the folder's file names
 * @returns {Round}
 */
function readRound(cwd, ref, round, held) {
  const reports = REVIEWER_LETTERS.map((letter) => {
    const file = roundReportPath(ref, round, letter);
    if (!held.has(`round-${round}-${letter}.md`)) throw new Error(`round ${round} of ${taskName(ref)} has no report from reviewer ${letter} — ${file}`);
    const text = fs.readFileSync(statePath(cwd, file), 'utf8');
    try {
      return { reviewer: letter, file, text, ...readReport(text) };
    } catch (err) {
      throw new Error(`${file} does not read as a reviewer's report — ${messageOf(err)}`);
    }
  });
  return { round, reports, passes: reports.every(({ verdict }) => verdict === 'pass'), settled: held.has(`round-${round}-settled.md`) };
}

/**
 * Every review round of a task, in order, from its reports on disk; none
 * before its first report is written.
 * @param {string} cwd @param {TaskRef} ref @returns {Round[]}
 */
function taskRounds(cwd, ref) {
  const folder = statePath(cwd, taskFolder(ref));
  const held = new Set(fs.existsSync(folder) ? fs.readdirSync(folder) : []);
  const rounds = [...held].map((name) => ROUND_FILE.exec(name)).flatMap((named) => (named !== null && REVIEWER_LETTERS.includes(named[2]) ? [Number(named[1])] : []));
  return Array.from({ length: Math.max(0, ...rounds) }, (_, at) => readRound(cwd, ref, at + 1, held));
}

module.exports = { passes, readReport, taskFolder, roundReportPath, settlementPath, taskRounds };
