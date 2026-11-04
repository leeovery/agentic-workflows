'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a review round's report (14.2, 14.3.1) — an area pair's or
// the test reader's, read by the reviewers' grammar (round-report.cjs) with
// its notes for later besides, each an item of the round (review-round.cjs).
// The task loop's and the phase review's reports read by that grammar alone,
// their notes for later no engine code's.
//
// A notes section opens on a heading of level two or three, numbered or
// not, or a line holding its label alone, bold or plain — `Notes for
// later`, or `Note for later`, in any case, emphasised or not, a
// parenthesis after it or none, a colon or none — anywhere in the report,
// after its findings too; and runs
// to the next heading at its level or above, a label standing at level
// three, the next notes section, or the verdict; fenced blocks aside. It
// ends the finding above it. What it holds: its notes, each an item opening
// as list-items.cjs reads one, any lead-in above the first; or a sole line
// saying `None`, the form the readers' briefs name. A section holding
// anything else — prose and no item — refuses the report, naming that line,
// so its reader is briefed again; as does a line outside a fenced block that
// names the notes for later but is no heading of them — the label with a
// note after it on its line, or worded or marked otherwise: after any mix
// of heading marks, a number, a quote's mark, a list item's marker and
// emphasis, `notes` then `for later` with any punctuation between. The rest
// of the report, its notes sections taken out, reads by the reviewers'
// grammar.
// ---------------------------------------------------------------------------

const { messageOf } = require('../kernel/call.cjs');
const { headingLevels, fencedLines } = require('./spec-sections.cjs');
const { BULLET, listItems, saysNone } = require('./list-items.cjs');
const { readReport, reportFaults } = require('./round-report.cjs');

/** @typedef {import('./round-report.cjs').Report & {notes: number}} ReviewReport */

/** The notes' label: `Notes for later`, or `Note for later`, a parenthesis after it or none. */
const LABEL = 'notes? for later(?![a-z])(?:[ \\t]*\\([^)]*\\))?';
const NOTES_HEADING = new RegExp(`^#{2,3}[ \\t]+(?:[0-9]+[.)][ \\t]+)?[*_]*${LABEL}[ \\t]*:?[*_]*[ \\t]*:?[ \\t]*$`, 'i');
const NOTES_LABEL = new RegExp(`^(?:(?:\\*\\*|__)${LABEL}[ \\t]*:?(?:\\*\\*|__)|${LABEL})[ \\t]*:?[ \\t]*$`, 'i');
/** A line naming the notes for later (the header's). */
const NAMES_NOTES = /^(?:[#>*_+\- \t]|[0-9]+[.)])*notes?[^a-z0-9]*for later(?![a-z])/i;
const NOTE = new RegExp(`^${BULLET}\\S`);

/** The level a line opens a notes section at, or 0 where it opens none. @param {string} line @param {number} level its heading's, 0 where it is none @param {boolean} fenced */
function notesLevel(line, level, fenced) {
  if ((level === 2 || level === 3) && NOTES_HEADING.test(line.trim())) return level;
  return !fenced && level === 0 && NOTES_LABEL.test(line.trim()) ? 3 : 0;
}

/**
 * The report's notes sections (the header's): each its heading's line and
 * the lines it holds, `from` to `to`, its heading's among them; and each
 * line outside a fenced block that opens on the label but opens no section.
 * @param {string[]} lines @returns {{sections: {from: number, to: number}[], strays: string[]}}
 */
function notesSections(lines) {
  const levels = headingLevels(lines);
  const fenced = fencedLines(lines);
  const opens = lines.map((line, at) => notesLevel(line, levels[at], fenced[at]));
  const last = lines.length - 1;
  const sections = opens.flatMap((level, from) => {
    if (level === 0 || from >= last) return [];
    let to = from + 1;
    while (to < last && opens[to] === 0 && !(levels[to] > 0 && levels[to] <= level)) to += 1;
    return [{ from, to }];
  });
  const strays = lines.filter((line, at) => !fenced[at] && opens[at] === 0 && NAMES_NOTES.test(line.trim()));
  return { sections, strays };
}

/** Whether a line says `None`, emphasis allowed. @param {string} line */
const isNone = (line) => /^[*_]*none(?![a-z])/i.test(line.trim());

/** How many notes a section holds; what it holds that is neither notes nor `None` pushed to `faults`. @param {string[]} lines @param {{from: number, to: number}} section @param {string[]} faults */
function notesIn(lines, { from, to }, faults) {
  const listed = lines.slice(from + 1, to);
  if (saysNone(listed)) return 0;
  const { items } = listItems(listed, NOTE);
  const held = listed.filter((line) => line.trim() !== '');
  const shown = held.find((line) => !isNone(line)) ?? held[0];
  if (items.length === 0 && shown !== undefined) faults.push(`"${shown.trim()}" under ${lines[from].trim()} is no note — each note is an item, \`- …\`, or all the section holds is \`None.\``);
  return items.length;
}

/**
 * A review round's report read (the header's): its verdict and findings by
 * the reviewers' grammar, and how many notes for later it holds; refused
 * where it does not read, every fault named.
 * @param {string} text @returns {ReviewReport}
 */
function readReviewReport(text) {
  const lines = text.trimEnd().split(/\r\n?|\n/);
  const { sections, strays } = notesSections(lines);
  /** @type {string[]} */
  const faults = strays.map((line) => `"${line.trim()}" names the notes for later but is no heading of them — the notes go under a heading of their own, \`## Notes for later\`, each an item`);
  const notes = sections.reduce((count, section) => count + notesIn(lines, section, faults), 0);
  const taken = new Set(sections.flatMap(({ from, to }) => Array.from({ length: to - from }, (_, at) => from + at)));
  try {
    const report = readReport(lines.filter((_, at) => !taken.has(at)).join('\n'));
    if (faults.length === 0) return { ...report, notes };
  } catch (err) {
    faults.push(messageOf(err));
  }
  throw new Error(faults.join('; '));
}

/** Why a file's text does not read as a review round's report, or null where it does. @param {string} file */
const reviewReportFaults = (file) => reportFaults(file, readReviewReport);

module.exports = { readReviewReport, reviewReportFaults };
