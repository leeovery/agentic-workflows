'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what an epic's discovery logs hold under their fixed headings
// (20.11.1, 20.11.3) — written by `discovery-log`, read by the board. Claude
// writes the rest of the log as the conversation goes, in sections under
// headings of its own; these three are lists only the verb writes, an entry
// a line, written and read as every log's fixed lists are (log-lists.cjs):
//
//   ## Not taken              `- {direction} — {why}`
//   ## Views of the product   `- {view}`
//   ## Spikes                 `- {spike} · {tool} — {what it showed}`, the
//                             tool `[{tool}]({live link})` where it has one
//
// - The verb (`discovery-log not-taken|view|spike <epic> …`) puts its entry
//   in the log of the epic's open session, after the last entry under the
//   last of its heading there and the lines indented beneath it, as the
//   first where none is, or under the heading added at the log's end where
//   the log has none. It refuses, writing nothing: a unit the project
//   lacks or that is no epic, an epic with no session open, an argument out
//   of shape, a value missing, empty or past one line, one holding what
//   would break its line's shape — a direction or a tool holding ` — `, a
//   tool `[` or `]` — a live link that is no web address, and a spike the
//   epic does not hold, named by the folder `asset spike` answered as
//   `spike`. Nothing is committed: every state commit takes the log along.
// - The reader takes every session's log in order, and in each every line
//   under a fixed heading that is an entry, at the margin outside a fenced
//   block, as one entry, wherever it stands; an indented line and prose
//   are passed over, so a closing line or a move's pointer is never read
//   into an entry. A heading written again adds to its list; a later
//   spike's line stands over an earlier. An entry that does not read as its
//   heading's shape, and a spike's naming none of the epic's spikes, is
//   passed over, said among the warnings.
// - Beyond the lists (`beyondLists`) is what a log's closing line is read
//   from (discovery-entry.cjs), an entry recorded after it never taken for
//   it. A session started on the day of the first conversation its log
//   names (topic-log.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { activeSession, sessionLogsAt } = require('./discovery-session.cjs');
const { spikesOf } = require('./asset.cjs');
const { listedIn, beyondListsOf, withEntry } = require('./log-lists.cjs');
const { conversationsIn } = require('./topic-log.cjs');

/** The fixed headings, as the log writes them. */
const LOG_HEADINGS = Object.freeze({ notTaken: 'Not taken', views: 'Views of the product', spikes: 'Spikes' });

/** What divides a direction from its why, and a spike's tool from what it showed. */
const DASH = ' — ';

/** A spike's line: its folder, its tool, and what it showed. */
const SPIKE_ITEM = /^(\S+) · (.+?) — (.+)$/;

/** A tool written as a link to where the spike lives. */
const LINKED_TOOL = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

/** A live link: a web address, whole on one line, no bracket in it. */
const WEB_ADDRESS = /^[a-z][a-z0-9+.-]*:\/\/[^\s()<>[\]]+$/i;

/** A spike as the log says it: the tool it was made in, its live link, null where none is named, and what it showed. @typedef {{tool: string, link: string|null, showed: string}} SpikeSaid */
/**
 * What the logs say under their fixed headings.
 * @typedef {{notTaken: {direction: string, why: string}[], views: string[], spikes: Map<string, SpikeSaid>}} Heard
 */

/** A direction not taken and why, null where the entry does not read as one. @param {string} entry */
function notTakenOf(entry) {
  const cut = entry.indexOf(DASH);
  const said = cut === -1 ? null : { direction: entry.slice(0, cut).trim(), why: entry.slice(cut + DASH.length).trim() };
  return said === null || said.direction === '' || said.why === '' ? null : said;
}

/** A spike's line read, null where it does not read as one. @param {string} entry @returns {[string, SpikeSaid]|null} */
function spikeOf(entry) {
  const said = SPIKE_ITEM.exec(entry);
  if (said === null) return null;
  const linked = LINKED_TOOL.exec(said[2]);
  return [said[1], { tool: linked?.[1] ?? said[2], link: linked?.[2] ?? null, showed: said[3] }];
}

/**
 * Each fixed heading's reading: an entry taken into what the logs say, the
 * epic's spikes beside it, else why it is passed over.
 * @type {Readonly<Record<string, (heard: Heard, entry: string, spikes: string[]) => string|null>>}
 */
const READS = Object.freeze({
  [LOG_HEADINGS.notTaken]: (heard, entry) => {
    const said = notTakenOf(entry);
    if (said === null) return 'does not read as a direction and why';
    heard.notTaken.push(said);
    return null;
  },
  [LOG_HEADINGS.views]: (heard, entry) => {
    heard.views.push(entry);
    return null;
  },
  [LOG_HEADINGS.spikes]: (heard, entry, spikes) => {
    const said = spikeOf(entry);
    if (said === null) return 'does not read as a spike';
    if (!spikes.includes(said[0])) return 'names no spike the epic holds';
    heard.spikes.set(...said);
    return null;
  },
});

/** The fixed headings the lists stand under. */
const HEADINGS = Object.keys(READS);

/**
 * What the logs say under their fixed headings, in order, each a log's
 * text, read once, with its path from the state root, and the epic's spikes
 * (the header's); what is passed over said in `warnings`.
 * @param {{rel: string, text: string}[]} logs @param {string[]} spikes @param {string[]} warnings @returns {Heard}
 */
function heardIn(logs, spikes, warnings) {
  /** @type {Heard} */
  const heard = { notTaken: [], views: [], spikes: new Map() };
  for (const { rel, text } of logs) {
    for (const { heading, entry } of listedIn(text, HEADINGS)) {
      const passed = READS[heading](heard, entry, spikes);
      if (passed !== null) warnings.push(`${rel}: "${entry}" under ## ${heading} ${passed}, and is passed over`);
    }
  }
  return heard;
}

/** A log's lines outside its fixed lists, their headings left out with them. @param {string[]} lines */
function beyondLists(lines) {
  return beyondListsOf(lines, HEADINGS);
}

/** The day a session started, from its log's text, null before a conversation has written it. @param {string} text */
const sessionStarted = (text) => conversationsIn(text)[0]?.date ?? null;

/** A value of the person's or Claude's words, refused missing, empty or past one line. @param {string|undefined} value @param {string} flag */
function oneLine(value, flag) {
  if (typeof value !== 'string' || value.trim() === '' || /[\r\n]/.test(value)) throw new Error(`discovery-log: --${flag} is one line of words, not empty`);
  return value.trim();
}

/** Refuses a value holding what would break its line's shape. @param {string} value @param {string} flag @param {string[]} breaks */
function unbroken(value, flag, breaks) {
  const held = breaks.find((mark) => value.includes(mark));
  if (held !== undefined) throw new Error(`discovery-log: --${flag} holds "${held.trim()}", which its line's shape keeps for itself`);
  return value;
}

/**
 * Each entry the verb writes: its heading, its usage after `discovery-log`,
 * the positionals it takes after the epic, its flags and those it may be
 * given, and its line from them, refused where one does not hold.
 * @type {Readonly<Record<string, {heading: string, usage: string, takes: number, flags: string[], may?: string[], line: (root: string, unit: string, positional: string[], opts: Record<string, string>) => string}>>}
 */
const ENTRIES = Object.freeze({
  'not-taken': {
    heading: LOG_HEADINGS.notTaken,
    usage: 'not-taken <epic> --direction "<direction>" --why "<why>"',
    takes: 0,
    flags: ['direction', 'why'],
    line: (_root, _unit, _positional, opts) => `${unbroken(oneLine(opts.direction, 'direction'), 'direction', [DASH])}${DASH}${oneLine(opts.why, 'why')}`,
  },
  view: {
    heading: LOG_HEADINGS.views,
    usage: 'view <epic> --text "<view>"',
    takes: 0,
    flags: ['text'],
    line: (_root, _unit, _positional, opts) => oneLine(opts.text, 'text'),
  },
  spike: {
    heading: LOG_HEADINGS.spikes,
    usage: 'spike <epic> <spike> --tool "<tool>" --showed "<what it showed>" [--link <live link>]',
    takes: 1,
    flags: ['tool', 'showed'],
    may: ['link'],
    line: (root, unit, [spike], opts) => {
      if (!spikesOf(root, unit).includes(spike)) throw new Error(`discovery-log: ${unit} has no spike "${spike}" — name it as asset spike answered it, its spike`);
      const tool = unbroken(oneLine(opts.tool, 'tool'), 'tool', [DASH, '[', ']']);
      if (opts.link !== undefined && !WEB_ADDRESS.test(opts.link)) throw new Error(`discovery-log: --link is the spike's live link, a web address, not "${opts.link}"`);
      return `${spike} · ${opts.link === undefined ? tool : `[${tool}](${opts.link})`}${DASH}${oneLine(opts.showed, 'showed')}`;
    },
  },
});

const LOG_USAGE = Object.values(ENTRIES).map(({ usage }) => `discovery-log ${usage}`).join('\n');

/** Refuses arguments out of an entry's shape, with its usage. @param {typeof ENTRIES[string]} entry @param {string[]} positional @param {Record<string, string>} opts */
function checkShape({ usage, takes, flags, may = [] }, positional, opts) {
  const given = Object.keys(opts);
  if (positional.length !== takes + 1 || !flags.every((flag) => given.includes(flag)) || !given.every((flag) => flags.includes(flag) || may.includes(flag))) {
    throw new Error(`Usage: engine discovery-log ${usage}`);
  }
}

/**
 * `discovery-log <entry> <epic> …` (the header's): the entry's line put in
 * the log of the epic's open session. Answers the log, from the state root,
 * the heading and the line.
 * @param {string} cwd @param {string|undefined} kind @param {string[]} positional @param {Record<string, string>} opts
 */
function logHeard(cwd, kind, positional, opts) {
  if (kind === undefined || !Object.hasOwn(ENTRIES, kind)) throw new Error(`Usage: engine discovery-log <${Object.keys(ENTRIES).join('|')}> …\n${LOG_USAGE}`);
  const entry = ENTRIES[kind];
  checkShape(entry, positional, opts);
  const [unit, ...rest] = positional;
  const root = stateRoot(cwd);
  const manifest = manifestOf(root, unit);
  if (manifest === null) throw new Error(`discovery-log: there is no work unit "${unit}"`);
  if (manifest.work_type !== 'epic') throw new Error(`discovery-log: ${unit} is a ${manifest.work_type} — the fixed lists are an epic's discovery's`);
  const session = activeSession(cwd, unit);
  if (session === null) throw new Error(`discovery-log: no discovery session is open for ${unit} — enter discovery ${unit} opens one`);
  const line = entry.line(root, unit, rest, opts);
  const rel = path.posix.join(sessionLogsAt(unit), `session-${session}.md`);
  const file = statePath(cwd, rel);
  fs.writeFileSync(file, withEntry(fs.readFileSync(file, 'utf8'), HEADINGS, entry.heading, line));
  return { log: rel, heading: entry.heading, line: `- ${line}` };
}

module.exports = { LOG_USAGE, heardIn, beyondLists, sessionStarted, logHeard };
