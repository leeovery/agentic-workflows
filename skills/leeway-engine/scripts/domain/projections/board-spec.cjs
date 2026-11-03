'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the specification on the board (20.9) — This session in a
// specification, a section's page and a pass's — read from the spec, its
// review's passes (agent-state.cjs, spec-passes.cjs), the ledger, and the
// cut on the manifest.
//
// - Its sections are the spec's areas, in its order; none before the spec
//   is written. A section was changed by a pass where the spec the writer
//   landed after taking that pass's report differs in it from the land the
//   pass reviewed — after the last pass, the spec as it stands — one of its
//   parts or its scenarios among it; one a pass running reads is being read.
// - Its passes are those whose report the agent store took in, each with
//   what it found — the person's share each gap it found, raised as a
//   question, and each finding raised as the replacement of a decision,
//   each counted once; Claude's every other — then those still out,
//   numbered on, each by where the store stands it — running, its report
//   in and not yet taken, or lost with the conversation that sent it —
//   since it was dispatched and with the sections it reads: those changed
//   since the land the latest reported pass reviewed. Newest first.
// - The banner says where the review stands: a pass out by its state; else,
//   while a question waits, the next pass waiting on the person; else ready
//   to build waiting on them, or the spec being written.
// - What waits on the person is each gap the review waits on them for, a
//   question asked at the spec or a replacement a pass raised — asked in
//   the conversation, never queued (20.9.1) — each by its entry and words,
//   the pass that found it — a replacement's, the pass that raised it; a
//   question's, the latest pass reported that was dispatched by the second
//   it was asked, the ledger's time being to the second, none where none
//   was — and the sections it touches: those its entry cites, and
//   those whose lines cite its entry.
// - Never a look (5.8.14): Claude's calls since the calls list was last
//   drawn in the conversation are read without moving the mark.
// - Ready to build waits on the review settling, then on the person's yes.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { specPath, specReading, specSections, SPEC_FILE } = require('../spec-sections.cjs');
const { reportedPasses, passesInFlight } = require('../agent-state.cjs');
const { reviewSettled, waitingGaps, sectionsToReview, changedSince, changedBetween } = require('../spec-passes.cjs');
const { readShown } = require('../ledger-read.cjs');
const { answerSince } = require('../ledger-since.cjs');
const { cutPhases } = require('../phase-checks.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').SpecView} SpecView */
/** @typedef {import('../board-model.cjs').SpecPass} SpecPass */
/** @typedef {import('../board-model.cjs').GapLine} GapLine */
/** @typedef {import('../spec-passes.cjs').Gap} Gap */
/** @typedef {ReturnType<typeof reportedPasses>[number]} Reported */
/** @typedef {import('../spec-sections.cjs').SpecReading} SpecReading */

/** The spec's text, null where it is not written. @param {BoardAt} at */
function specText(at) {
  const file = specPath(at.cwd, at.unit);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

/** The areas of a spec's addresses, its introduction aside. @param {string[]} addresses @returns {Set<string>} */
const areasOf = (addresses) => new Set(addresses.filter((address) => /^\d/.test(address)).map((address) => address.split('.')[0]));

/** The area a line of the spec stands in. @param {{number: string}} line */
const lineArea = ({ number }) => number.split(/[.-]/)[0];

/**
 * The passes that changed each area, by area (the header's).
 * @param {Reported[]} reported @param {string|null} text @returns {Map<string, number[]>}
 */
function changedBy(reported, text) {
  /** @type {Map<string, number[]>} */
  const by = new Map();
  reported.forEach(({ land }, k) => {
    const next = reported[k + 1];
    if (next === undefined && text === null) return;
    const { changed } = next === undefined ? changedSince(land.sections, /** @type {string} */ (text)) : changedBetween(land.sections, new Map(Object.entries(next.land.sections)));
    for (const area of areasOf(changed)) by.set(area, [...(by.get(area) ?? []), k + 1]);
  });
  return by;
}

/** What a reported pass found, and the person's share and Claude's (the header's). @param {Reported} pass */
function foundBy({ findings, raised }) {
  const found = Array.isArray(findings) ? findings : [];
  const yours = new Set([...found.filter(({ lane }) => lane === 'gap').map(({ id }) => id), ...raised.map(({ finding }) => finding)]).size;
  return { found: found.length, calls: found.length - yours, yours };
}

/**
 * The review's passes, newest first (the header's).
 * @param {Reported[]} reported @param {{created: string, stands: 'landed'|'running'|'lost'}[]} out @param {string[]|null} reads @returns {SpecPass[]}
 */
function passesOf(reported, out, reads) {
  return [
    ...reported.map((pass, k) => ({ pass: k + 1, ...foundBy(pass), state: /** @type {const} */ ('read'), since: null, reads: null })),
    ...out.map(({ created, stands }, k) => ({ pass: reported.length + k + 1, found: 0, calls: 0, yours: 0, state: stands, since: created, reads })),
  ].reverse();
}

/**
 * The areas a cite on the spec names: by its number, else by its title.
 * @param {SpecReading} reading @param {string} section
 */
function citedArea(reading, section) {
  const number = /^§?\s*(\d+)/.exec(section.trim())?.[1];
  const area = reading.headings.find((heading) => heading.kind === 'area' && (number === undefined ? heading.title === section.trim() : String(heading.number) === number));
  return area === undefined ? [] : [String(area.number)];
}

/** When a pass was dispatched, to the second. @param {string} created */
const dispatchedSecond = (created) => Math.floor(Date.parse(created) / 1000) * 1000;

/**
 * A gap waiting on the person (the header's).
 * @param {BoardAt} at @param {Gap} gap @param {Reported[]} reported @param {SpecReading|null} reading @returns {GapLine}
 */
function gapLine(at, { entry, short, text, at: asked, cites, pass }, reported, reading) {
  const by = pass === null ? reported.filter(({ created }) => dispatchedSecond(created) <= Date.parse(asked)).length : reported.findIndex(({ id }) => id === pass) + 1;
  const spec = `${at.unit}/${SPEC_FILE}`;
  const sections = reading === null ? [] : [...new Set([
    ...cites.filter(({ path }) => path === spec).flatMap(({ section }) => citedArea(reading, section)),
    ...reading.lines.filter(({ cites: cited }) => cited.some((id) => entry.startsWith(id))).map(lineArea),
  ])].sort((a, b) => Number(a) - Number(b));
  return { id: short, text, pass: by === 0 ? null : by, sections };
}

/** The specification's This session (the header's). @param {BoardAt} at @returns {{view: SpecView}} */
function specView(at) {
  const text = specText(at);
  const reading = text === null ? null : specReading(text);
  const reported = reportedPasses(at.cwd, at.unit);
  const out = passesInFlight(at.cwd, at.unit);
  const reads = text === null || out.length === 0 ? null : [...areasOf(sectionsToReview(at.cwd, at.unit, text).changed)];
  const beingRead = out.some(({ stands }) => stands === 'running') ? reads : null;
  const changed = changedBy(reported, text);
  const since = readShown(at.root, at.warnings, (shower) => /** @type {{id: string, text: string}[]} */ (/** @type {unknown} */ (answerSince(shower, { unit: at.unit, topic: null }, at.root, at.warnings).calls)));
  return {
    view: {
      kind: 'spec',
      unit: at.unit,
      title: at.title,
      type: at.manifest.work_type,
      sections: (reading?.headings ?? []).filter(({ kind }) => kind === 'area').map(({ number, title }) => ({
        number: String(number), title, changed_by: changed.get(String(number)) ?? [], reading: beingRead?.includes(String(number)) ?? false,
      })),
      passes: passesOf(reported, out, reads),
      waiting: waitingGaps(at.cwd, at.unit, at.warnings).map((gap) => gapLine(at, gap, reported, reading)),
      since: since.map(({ id, text: said }) => ({ id, text: said, question: null })),
      cut: cutPhases(at.manifest).map(({ name = '', scenarios, sections }, k) => ({ phase: k + 1, name, scenarios: scenarios.length, sections })),
      ready: text !== null && reviewSettled(at.cwd, at.unit, at.warnings) ? 'person' : 'review',
    },
  };
}

/** Where the review stands while a pass is out, by the pass's state. @type {Readonly<Record<'running'|'landed'|'lost', (pass: number) => string>>} */
const OUT = Object.freeze({
  running: (pass) => `pass ${pass} reading`,
  landed: (pass) => `pass ${pass}'s report in`,
  lost: (pass) => `pass ${pass} lost`,
});

/**
 * The banner's facts in a specification (20.2.4): where the review stands —
 * a pass out by its state; else, while a question waits, the next pass
 * waiting on the person; else ready to build waiting on them, or the spec
 * being written — then how many questions wait, while any does.
 * @param {SpecView} view @returns {{state: 'running'|'needs', facts: {text: string, needs: boolean}[]}}
 */
function specBanner({ type, passes, waiting, ready }) {
  const fact = (/** @type {string} */ text, needs = false) => ({ text, needs });
  const head = [fact(type), fact('specification')];
  const [latest] = passes;
  const out = latest === undefined || latest.state === 'read' ? null : fact(OUT[latest.state](latest.pass));
  if (waiting.length > 0) return { state: 'needs', facts: [...head, out ?? fact(`pass ${(latest?.pass ?? 0) + 1} waits on you`), fact(`${waiting.length} waiting on you`, true)] };
  if (ready === 'person') return { state: 'needs', facts: [...head, fact('ready to build waits on you')] };
  return { state: 'running', facts: [...head, out ?? fact('being written')] };
}

/**
 * A section of the spec read in full (20.9.2), by its number; refused where
 * the spec is not written or holds no such section.
 * @param {BoardAt} at @param {string} number @returns {import('../board-model.cjs').SectionPage}
 */
function sectionPage(at, number) {
  const text = specText(at);
  const heading = text === null ? undefined : specReading(text).headings.find((held) => held.kind === 'area' && String(held.number) === number);
  const section = text === null ? undefined : specSections(text).get(number);
  if (heading === undefined || section === undefined) throw new Error(`${at.unit}'s spec holds no section ${number}`);
  return { kind: 'section', unit: at.unit, number, title: heading.title, text: section.text };
}

/**
 * A reported pass read in full (20.9.2), by its number: what it found and
 * its report; refused where no pass of that number has reported.
 * @param {BoardAt} at @param {string} said @returns {import('../board-model.cjs').PassPage}
 */
function passPage(at, said) {
  const pass = reportedPasses(at.cwd, at.unit)[Number(said) - 1];
  if (pass === undefined || !fs.existsSync(pass.file)) throw new Error(`${at.unit}'s review holds no reported pass ${said}`);
  return { kind: 'pass', unit: at.unit, pass: Number(said), ...foundBy(pass), text: fs.readFileSync(pass.file, 'utf8') };
}

module.exports = { specView, specBanner, sectionPage, passPage };
