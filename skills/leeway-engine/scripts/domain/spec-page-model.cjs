'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the model of the person's review page (11.11) — a unit's
// `spec.md` as the page draws it, read through the spec's one parser
// (spec-sections.cjs), and Claude's tick on each line, drawn from the
// entries it cites (11.11.15). The page, its marks' record and ready to
// build all read a line by its id and its fingerprint from here, so each is
// the same wherever it is used: the review page's own scripts compute them
// the same way, and the page they built is the contract (11.11.12).
//
// A line is each statement, scenario and screen. Its id is its number with
// its dots as dashes (`16-3-7`, `16-S69`, `3-2-1-scr1`); its fingerprint, `h`,
// the first 12 hex digits of the SHA-256 of its wording — each block not
// fenced on one line, each fence as written, joined by newlines, the source
// bracket left out — so a change to a line's sources alone, or to how it
// wraps, keeps the tick that holds its wording (11.11.6). The lines are
// grouped by area, each area's items in the spec's order: its parts'
// headings, its lines, and the heading of its block of scenarios. A line's
// flags mark it resting on a call of Claude's (`claude`), the builder's
// (`builder`), or a screen or holding a fenced block (`screen`).
//
// Claude's tick (11.11.15): a statement or a screen resting only on the
// person's decisions and on findings, or left to the builder — its bracket
// the builder's, or each entry it cites a "don't care" — carries the tick,
// its reason the decisions it restates and when, the findings it rests on,
// or that it holds nothing the person would see. One resting on a call of
// Claude's — a decision Claude made, or the person handed to Claude, and no
// migration carried over — or on a decision whose question was marked hard
// to undo (16.11.7), its question's ledger line carrying `hard_to_undo:
// true`, stays open, its reason saying which; so does one that does not
// trace (spec-trace.cjs), its reason why. A scenario takes its tick from
// the statements it draws on: it carries it where every one does.
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const { resolveId } = require('./ledger-ids.cjs');
const { claudesCall } = require('./ledger-events.cjs');
const { currentsOf } = require('./ledger-fold.cjs');
const { readSpec, specReading } = require('./spec-sections.cjs');
const { untraced } = require('./spec-trace.cjs');
const { withUnitEntries } = require('./unit-entries.cjs');

/** @typedef {import('./spec-sections.cjs').Line} Line */
/** @typedef {import('./spec-sections.cjs').SpecReading} SpecReading */
/** @typedef {import('./unit-entries.cjs').UnitView} UnitView */
/** @typedef {import('./unit-entries.cjs').UnitEntry} UnitEntry */

/** The question's field that marks it hard to undo (16.11.7), absent until the labeller writes it. */
const HARD_TO_UNDO = 'hard_to_undo';

/** A line's mark, as the page reads its kind: Claude's call, the builder's, a screen. @typedef {'claude'|'builder'|'screen'} Flag */

/**
 * An item of an area as the page draws it: a part's heading, `h3`; the
 * heading of the area's scenarios, `h2s`; or a line — its id, its number (a
 * screen's `screen`, after the line it follows), its kind, its blocks as
 * `[kind, text]` pairs, its bracket's contents, its flags and its
 * fingerprint.
 * @typedef {{k: 'h3'|'h2s', t: string} | {
 *   k: 'line', id: string, num: string, kind: Line['kind'], after?: string, parts: [string, string][], src: string, flags: Flag[], h: string,
 * }} Item
 */
/** An area and its items. @typedef {{num: number, title: string, items: Item[]}} Area */
/** A line of the model: its id, the area it stands in, its fingerprint, and the line as read. @typedef {{id: string, section: number, h: string, line: Line}} ModelLine */
/** Claude's assessment of a line: its tick, `soft`, or open for the person, and why. @typedef {{v: 'soft'|'open', why: string}} Tick */
/** A spec as its page draws it. @typedef {{h1: string, intro: string, sections: Area[], lines: ModelLine[]}} Page */
/** The page with Claude's tick on each line, by id. @typedef {Page & {ticks: Map<string, Tick>}} SpecPage */

/** A line's id: its number, its dots as dashes. @param {string} number */
const lineId = (number) => number.replaceAll('.', '-');

/** The first 12 hex digits of the SHA-256 of `text`. @param {string} text */
const fingerprint = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 12);

/** The title and introduction: the first line's title, and what stands before the first area but its contents. @param {string} text */
function frontOf(text) {
  const plain = text.replace(/\r\n?/g, '\n');
  const first = plain.split('\n', 1)[0];
  const body = plain.search(/^## (?!Contents\b)/m);
  return {
    h1: first.startsWith('# ') ? first.slice(2).trim() : '',
    intro: plain.slice(first.length, body === -1 ? plain.length : body).replace(/^## Contents\b[\s\S]*/m, ''),
  };
}

/** A line's flags. @param {Line} line @param {Set<string>} calls the numbers of the lines resting on a call of Claude's @returns {Flag[]} */
function flagsOf(line, calls) {
  const screen = line.kind === 'screen' || line.parts.some(({ kind }) => kind === 'fence');
  return /** @type {[Flag, boolean][]} */ ([['claude', calls.has(line.number)], ['builder', line.builder], ['screen', screen]]).filter(([, on]) => on).map(([flag]) => flag);
}

/** A line as the page draws it. @param {Line} line @param {Set<string>} calls @returns {Item} */
function itemOf(line, calls) {
  const shown = line.kind === 'screen' || line.kind === 'note' ? line.kind : line.number;
  return {
    k: 'line',
    id: lineId(line.number),
    num: shown,
    kind: line.kind,
    ...(line.of === null ? {} : { after: line.of }),
    parts: line.parts.map(({ kind, text }) => [kind, text]),
    src: line.bracket ?? '',
    flags: flagsOf(line, calls),
    h: fingerprint(line.wording),
  };
}

/**
 * The page a spec's reading draws, its faults aside — the caller refuses a
 * reading with faults — its lines resting on Claude's calls those `calls`
 * numbers.
 * @param {string} text @param {SpecReading} reading @param {Set<string>} [calls]
 * @returns {Page}
 */
function pageOf(text, { lines, headings }, calls = new Set()) {
  /** @type {Area[]} */
  const sections = [];
  /** @type {ModelLine[]} */
  const model = [];
  const marks = [...headings.map((heading) => ({ at: heading.line, heading })), ...lines.map((line) => ({ at: line.line, line }))].sort((a, b) => a.at - b.at);
  for (const mark of marks) {
    if ('heading' in mark && mark.heading.kind === 'area') {
      sections.push({ num: Number(mark.heading.number), title: mark.heading.title, items: [] });
      continue;
    }
    const area = sections.at(-1);
    if (area === undefined) continue;
    if ('line' in mark) {
      const item = itemOf(mark.line, calls);
      area.items.push(item);
      model.push({ id: lineId(mark.line.number), section: area.num, h: fingerprint(mark.line.wording), line: mark.line });
    } else if (mark.heading.kind === 'scenarios') {
      area.items.push({ k: 'h2s', t: `Scenarios for §${mark.heading.number}` });
    } else {
      area.items.push({ k: 'h3', t: mark.heading.title });
    }
  }
  return { ...frontOf(text), sections, lines: model };
}

/** Names in a run: `a`, `a and b`, `a, b and c`. @param {string[]} names */
function listed(names) {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** A noun for one or several. @param {string} one @param {number} count */
const plural = (one, count) => (count === 1 ? one : `${one}s`);

/** What an entry a line cites stands as for its tick. @typedef {'finding'|'builder'|'call'|'decision'} Sort */

/** @param {UnitEntry} entry @returns {Sort} */
function sortOf({ kind, line }) {
  if (kind === 'finding') return 'finding';
  if (line.given === 'dont-care') return 'builder';
  return claudesCall(line) ? 'call' : 'decision';
}

/** Whether the question a decision answers was marked hard to undo, along its chain to the question as it stands. @param {UnitView} view @param {UnitEntry} decision */
function markedHardToUndo({ folded, entries }, decision) {
  return currentsOf(folded, /** @type {string} */ (decision.line.answers)).some((id) => entries.get(id)?.line[HARD_TO_UNDO] === true);
}

/** An entry named with when it was made. @param {UnitEntry} entry */
const dated = ({ short, line }) => `${short} of ${String(line.at).slice(0, 10)}`;

const BUILDERS = 'Left to the builder: holds nothing you would see';

/** @param {string} why @returns {Tick} */
const soft = (why) => ({ v: 'soft', why });
/** @param {string} why @returns {Tick} */
const open = (why) => ({ v: 'open', why });

/**
 * Claude's tick on a statement or a screen, from the entries it cites, and
 * whether it rests on a call of Claude's.
 * @param {UnitView} view @param {Line} line @returns {{tick: Tick, call: boolean}}
 */
function citedTick(view, line) {
  const fault = untraced(view, line);
  if (fault !== null) return { tick: open(`Traces to no entry: ${fault}`), call: false };
  if (line.builder) return { tick: soft(BUILDERS), call: false };
  const cited = line.cites.map((cite) => /** @type {UnitEntry} */ (view.entries.get(resolveId(cite, view.folded.facts.keys()))));
  const of = (/** @type {Sort} */ sort) => cited.filter((entry) => sortOf(entry) === sort);
  const [calls, decisions, findings] = [of('call'), of('decision'), of('finding')];
  const hard = decisions.filter((decision) => markedHardToUndo(view, decision));
  const opens = [
    ...(calls.length > 0 ? [`Rests on Claude's ${plural('call', calls.length)} ${listed(calls.map(({ short }) => short))}`] : []),
    ...(hard.length > 0 ? [`Restates your ${plural('decision', hard.length)} ${listed(hard.map(({ short }) => short))}, ${hard.length === 1 ? 'its question' : 'their questions'} marked hard to undo`] : []),
  ];
  if (opens.length > 0) return { tick: open(opens.join('; ')), call: calls.length > 0 };
  if (decisions.length > 0) return { tick: soft(`Restates your ${plural('decision', decisions.length)} ${listed(decisions.map(dated))}`), call: false };
  if (findings.length > 0) return { tick: soft(`Rests on the ${plural('finding', findings.length)} ${listed(findings.map(dated))}`), call: false };
  return { tick: soft(BUILDERS), call: false };
}

/**
 * Claude's tick on a scenario, from the statements it draws on.
 * @param {Line} line @param {Map<string, {tick: Tick, call: boolean}>} drawn the statements' by number
 * @returns {{tick: Tick, call: boolean}}
 */
function scenarioTick({ drawsOn }, drawn) {
  const waiting = drawsOn.filter((number) => drawn.get(number)?.tick.v !== 'soft');
  const call = drawsOn.some((number) => drawn.get(number)?.call === true);
  if (waiting.length === 0) return { tick: soft(`Draws on ${listed(drawsOn)}, ${drawsOn.length === 1 ? 'which carries' : 'each carrying'} Claude's tick`), call };
  return { tick: open(`Draws on ${listed(waiting)}, which ${waiting.length === 1 ? 'waits' : 'wait'} on you`), call };
}

/**
 * Claude's tick on each line, by number, and the numbers of the lines
 * resting on a call of Claude's.
 * @param {UnitView} view @param {Line[]} lines @returns {{ticks: Map<string, Tick>, calls: Set<string>}}
 */
function lineTicks(view, lines) {
  /** @type {Map<string, {tick: Tick, call: boolean}>} */
  const drawn = new Map();
  for (const line of lines) if (line.kind === 'statement' || line.kind === 'screen') drawn.set(line.number, citedTick(view, line));
  for (const line of lines) if (line.kind === 'scenario') drawn.set(line.number, scenarioTick(line, drawn));
  return {
    ticks: new Map(lines.filter(({ number }) => drawn.has(number)).map(({ number }) => [number, /** @type {{tick: Tick}} */ (drawn.get(number)).tick])),
    calls: new Set([...drawn].filter(([, { call }]) => call).map(([number]) => number)),
  };
}

/**
 * A unit's spec as its review page draws it, with Claude's tick on each
 * line by id. Refuses a unit with no spec, and a spec its grammar cannot
 * read, naming every fault, one per line.
 * @param {string} cwd @param {string} unit @param {string[]} [warnings] what a landing the read's check finished said, pushed to
 * @returns {SpecPage}
 */
function specPage(cwd, unit, warnings = []) {
  const text = readSpec(cwd, unit);
  const reading = specReading(text);
  if (reading.faults.length > 0) throw new Error(reading.faults.join('\n'));
  const { ticks, calls } = withUnitEntries(cwd, unit, warnings, (view) => lineTicks(view, reading.lines));
  return { ...pageOf(text, reading, calls), ticks: new Map([...ticks].map(([number, tick]) => [lineId(number), tick])) };
}

module.exports = { HARD_TO_UNDO, lineId, fingerprint, pageOf, lineTicks, specPage };
