'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the specification on the board (20.9) — This session in a
// specification, a section's page, a pass's and a finding's — read from the
// spec, its review's passes (agent-state.cjs, spec-passes.cjs), the ledger,
// and the cut on the manifest.
//
// - Its sections are the spec's areas, in its order; none before the spec
//   is written. A section was changed by a pass where the spec the writer
//   landed after taking that pass's report differs in it from the land the
//   pass reviewed — after the last pass, the spec as it stands — one of its
//   parts or its scenarios among it; one a pass running reads is being read.
// - Each finding of a reported pass stands with the person by where its
//   surfacing linked it (D23): one asked as a question waits on them while
//   the question it grew into — reworded, replaced or merged — is open, and
//   is theirs once they answered it, Claude's once Claude did; one raised
//   as the replacement of a decision waits while the gap does, and is
//   theirs then; any other — a rewrite, a fact, a gap settled without
//   asking — is Claude's.
// - Its passes are those whose report the agent store took in, each with
//   what it found, the person's share and Claude's as its findings stand;
//   then those still out, numbered on, each by where the store stands it —
//   running, its report in and not yet taken, or lost with the conversation
//   that sent it — since it was dispatched and with the sections it reads:
//   those changed since the land the latest reported pass reviewed. Newest
//   first. Each pass after the first read what the one before it changed.
// - Where the spec stands, as its banner, the unit's tab and All work say
//   it: a pass out by its state; else, while a gap waits, the next pass
//   waiting on the person; else ready to build while its yes waits; else
//   the spec being written. What waits on the person is counted on the
//   banner from the unit's one list (board-standing.cjs), the gaps and the
//   yes among it, each gap opening the finding that raised it, else its
//   entry.
// - What waits on the person is each gap the review waits on them for, a
//   question asked at the spec or a replacement a pass raised — asked in
//   the conversation, never queued (20.9.1) — each by its entry and words,
//   the pass and finding that raised it, none where no pass did
//   (spec-passes.cjs), and the sections it touches: those its entry cites,
//   and those whose lines cite its entry.
// - Never a look (5.8.14): Claude's calls since the calls list was last
//   drawn in the conversation are read without moving the mark, each with
//   the question it answers, the pass and finding that asked that question,
//   and the sections it touches, as a gap's are.
// - Ready to build waits on the review settling, then on the person's yes.
// - Each reported pass is a moment of the unit lately, when it was
//   dispatched, with what it found as its findings stand; and each question
//   a pass asked the person, by the label of the finding it was asked as,
//   when it was asked (D23).
// ---------------------------------------------------------------------------

const { fact, placeFact } = require('../board-model.cjs');
const fs = require('fs');
const { specPath, specReading, SPEC_FILE } = require('../spec-sections.cjs');
const { reportedPasses, passesInFlight } = require('../agent-state.cjs');
const { waitingGaps, sectionsToReview, changedSince, changedBetween, askedBy, gapsIn, raisedBy } = require('../spec-passes.cjs');
const { findingText } = require('../spec-report.cjs');
const { factsOf, currentsOf, answersOf, questionStands } = require('../ledger-fold.cjs');
const { withUnitEntries } = require('../unit-entries.cjs');
const { readShown } = require('../ledger-read.cjs');
const { answerSince } = require('../ledger-since.cjs');
const { cutPhases, buildBegun } = require('../derivations.cjs');
const { projectName } = require('../state-checks.cjs');
const { readyDraws } = require('../ready-to-build.cjs');
const { counted } = require('./map.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').SpecView} SpecView */
/** @typedef {import('../board-model.cjs').SpecPass} SpecPass */
/** @typedef {import('../board-model.cjs').GapLine} GapLine */
/** @typedef {import('../board-model.cjs').WaitingLine} WaitingLine */
/** @typedef {import('../board-model.cjs').FindingStanding} FindingStanding */
/** @typedef {import('../spec-passes.cjs').Gap} Gap */
/** @typedef {ReturnType<typeof reportedPasses>[number]} Reported */

/** The unit's passes reported, read once a call. @param {BoardAt} at @returns {Reported[]} */
const reportedOf = (at) => at.once('reported-passes', () => reportedPasses(at.cwd, at.unit));

/** The unit's gaps waiting on the person, read once a call. @param {BoardAt} at @returns {ReturnType<typeof waitingGaps>} */
const gapsOf = (at) => at.once('waiting-gaps', () => waitingGaps(at.cwd, at.unit, at.warnings));
/** @typedef {import('../spec-sections.cjs').SpecReading} SpecReading */
/** @typedef {import('../unit-entries.cjs').UnitView} Entries */

/** The spec's text, null where it is not written. @param {BoardAt} at */
function specText(at) {
  const file = specPath(at.cwd, at.unit);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

/** The areas of a spec's addresses, its introduction aside. @param {string[]} addresses @returns {Set<string>} */
const areasOf = (addresses) => new Set(addresses.filter((address) => /^\d/.test(address)).map((address) => address.split('.')[0]));

/** The area a line of the spec stands in. @param {{number: string}} line */
const lineArea = ({ number }) => number.split(/[.-]/)[0];

/** Areas in the spec's order. @param {Iterable<string>} areas */
const inOrder = (areas) => [...new Set(areas)].sort((a, b) => Number(a) - Number(b));

/**
 * The areas each reported pass changed, by its number from 1 (the header's).
 * @param {Reported[]} reported @param {string|null} text @returns {string[][]}
 */
function changesOf(reported, text) {
  return reported.map(({ land }, k) => {
    const next = reported[k + 1];
    if (next === undefined && text === null) return [];
    const { changed } = next === undefined ? changedSince(land.sections, /** @type {string} */ (text)) : changedBetween(land.sections, new Map(Object.entries(next.land.sections)));
    return inOrder(areasOf(changed));
  });
}

/** The passes that changed each area, by area. @param {string[][]} changes @returns {Map<string, number[]>} */
function changedBy(changes) {
  /** @type {Map<string, number[]>} */
  const by = new Map();
  changes.forEach((areas, k) => areas.forEach((area) => by.set(area, [...(by.get(area) ?? []), k + 1])));
  return by;
}

/** The replacements raised that still wait on the person, by pass and finding. @param {Entries['folded']} folded @param {string} unit @param {Reported[]} reported */
function raisedWaiting(folded, unit, reported) {
  return new Set(gapsIn(folded, unit, [], raisedBy(reported)).raised.map(({ pass, finding }) => `${pass}/${finding}`));
}

/**
 * Where a question a finding was asked as stands with the person, through
 * every question it grew into: waiting while one is open, else theirs where
 * they answered one, else Claude's.
 * @param {Entries['folded']} folded @param {string} entry @returns {FindingStanding}
 */
function askedStanding(folded, entry) {
  const questions = currentsOf(folded, entry);
  if (questions.some((question) => questionStands(folded, question) === 'open')) return 'waits';
  return questions.flatMap((question) => answersOf(folded, question)).some((answer) => factsOf(folded, answer).by === 'person') ? 'yours' : 'claude';
}

/**
 * Where each finding of a reported pass stands with the person, by its id
 * (the header's).
 * @param {Entries['folded']} folded @param {Reported} pass @param {Set<string>} waiting the replacements still waiting @returns {Map<string, FindingStanding>}
 */
function standingsOf(folded, pass, waiting) {
  return new Map((Array.isArray(pass.findings) ? pass.findings : []).map(({ id, lane }) => {
    const asked = pass.asked.find(({ finding }) => finding === id);
    if (lane !== 'gap') return [id, 'claude'];
    if (asked !== undefined) return [id, askedStanding(folded, asked.entry)];
    if (pass.raised.some(({ finding }) => finding === id)) return [id, waiting.has(`${pass.id}/${id}`) ? 'waits' : 'yours'];
    return [id, 'claude'];
  }));
}

/** Each reported pass's findings as they stand with the person, in pass order, read in one read of the ledger. @param {BoardAt} at @param {Reported[]} reported */
function passStandings(at, reported) {
  return withUnitEntries(at.cwd, at.unit, at.warnings, ({ folded }) => {
    const waiting = raisedWaiting(folded, at.unit, reported);
    return reported.map((pass) => standingsOf(folded, pass, waiting));
  });
}

/** What a reported pass found, and the person's share and Claude's, as its findings stand. @param {Map<string, FindingStanding>} standings */
function foundBy(standings) {
  const calls = [...standings.values()].filter((standing) => standing === 'claude').length;
  return { found: standings.size, calls, yours: standings.size - calls };
}

/**
 * Each reported pass as a moment of the unit lately, when it was
 * dispatched: the first read the whole spec, each after it what it found
 * and whose its findings are, as they stand; and each question a pass asked
 * the person (D23), when it was asked, by its words.
 * @param {BoardAt} at @returns {import('../board-model.cjs').Moment[]}
 */
function passMoments(at) {
  const reported = reportedOf(at);
  if (reported.length === 0) return [];
  const passes = passStandings(at, reported).map((standings, k) => {
    const { found, calls, yours } = foundBy(standings);
    const said = k === 0 ? `read the whole specification · found ${found}` : `found ${found} · ${counted(calls, 'call')}, ${yours} yours`;
    return { kind: 'pass', at: new Date(reported[k].created).toISOString(), topic: null, detail: `${k + 1} ${said}` };
  });
  const asked = withUnitEntries(at.cwd, at.unit, at.warnings, ({ entries }) => reported.flatMap((pass, k) => pass.asked.flatMap(({ finding, entry }) => {
    const line = entries.get(entry)?.line;
    const about = pass.findings.find(({ id }) => id === finding)?.label ?? String(line?.text);
    return line === undefined ? [] : [{ kind: 'asked', at: String(line.at), topic: null, detail: `${k + 1} asked you about ${about}` }];
  })));
  return [...passes, ...asked];
}

/**
 * The review's passes, newest first (the header's).
 * @param {Map<string, FindingStanding>[]} standings @param {{created: string, stands: 'landed'|'running'|'lost'}[]} out @param {string[]|null} reads @returns {SpecPass[]}
 */
function passesOf(standings, out, reads) {
  return [
    ...standings.map((held, k) => ({ pass: k + 1, ...foundBy(held), state: /** @type {const} */ ('read'), since: null, reads: null })),
    ...out.map(({ created, stands }, k) => ({ pass: standings.length + k + 1, found: 0, calls: 0, yours: 0, state: stands, since: created, reads })),
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

/**
 * The sections an entry touches: those it cites in the unit's spec, and
 * those whose lines cite it.
 * @param {BoardAt} at @param {SpecReading|null} reading @param {string} entry its full id @param {{path: string, section: string}[]} cites
 * @returns {string[]}
 */
function touched(at, reading, entry, cites) {
  if (reading === null) return [];
  const spec = `${at.unit}/${SPEC_FILE}`;
  return inOrder([
    ...cites.filter(({ path }) => path === spec).flatMap(({ section }) => citedArea(reading, section)),
    ...reading.lines.filter(({ cites: cited }) => cited.some((id) => entry.startsWith(id))).map(lineArea),
  ]);
}

/** A reported pass's number, null where none is the pass named. @param {Reported[]} reported @param {string|null} id */
const passNumber = (reported, id) => (id === null ? null : reported.findIndex((pass) => pass.id === id) + 1 || null);

/** A gap waiting on the person (the header's), opening the finding that raised it, else its entry. @param {BoardAt} at @param {Gap} gap @param {Reported[]} reported @param {SpecReading|null} reading @returns {GapLine} */
function gapLine(at, { entry, short, text, cites, pass, finding }, reported, reading) {
  const number = passNumber(reported, pass);
  return { kind: 'gap', id: short, text, page: number === null || finding === null ? `entry:${short}` : `pass:${number}:${finding}`, pass: number, finding, sections: touched(at, reading, entry, cites) };
}

/**
 * Claude's calls since the person last looked (the header's), each with
 * the question it answers, the pass and finding that asked it, and the
 * sections it touches.
 * @param {BoardAt} at @param {{id: string, text: string}[]} calls @param {Reported[]} reported @param {SpecReading|null} reading
 * @returns {SpecView['since']}
 */
function callLines(at, calls, reported, reading) {
  return withUnitEntries(at.cwd, at.unit, at.warnings, ({ folded, entries }) => calls.map(({ id, text }) => {
    const [whole, entry] = [...entries].find(([key, { short }]) => key === id || short === id) ?? [id, undefined];
    const answers = typeof entry?.line.answers === 'string' ? entry.line.answers : null;
    const asked = answers === null ? { pass: null, finding: null } : askedBy(folded, reported, answers);
    const cites = Array.isArray(entry?.line.cites) ? entry.line.cites : [];
    return {
      id,
      text,
      question: answers === null || !entries.has(answers) ? null : String(entries.get(answers)?.line.text),
      pass: passNumber(reported, asked.pass),
      finding: asked.finding,
      sections: touched(at, reading, whole, cites),
    };
  }));
}

/**
 * What waits on the person in the unit as the specification lists it: each
 * gap with the pass and finding that raised it and the sections it
 * touches, every other wait with none.
 * @param {BoardAt} at @param {WaitingLine[]} waiting @param {Reported[]} reported @param {SpecReading|null} reading @returns {GapLine[]}
 */
function gapsWith(at, waiting, reported, reading) {
  const gaps = waiting.some(({ kind }) => kind === 'gap') ? new Map(gapsOf(at).map((gap) => [gap.short, gapLine(at, gap, reported, reading)])) : new Map();
  return waiting.map((line) => gaps.get(line.id) ?? { ...line, pass: null, finding: null, sections: [] });
}

/**
 * The spec's gaps and then ready to build's yes, as what waits on the
 * person in the unit: each gap by its words, opening the finding that
 * raised it, else its entry; the yes once its screen draws (`readyDraws`).
 * @param {BoardAt} at @returns {WaitingLine[]}
 */
function specWaits(at) {
  const reported = reportedOf(at);
  const gaps = gapsOf(at).map((gap) => {
    const { kind, id, text, page } = gapLine(at, gap, reported, null);
    return { kind, id, text, page };
  });
  if (gaps.length > 0) return gaps;
  return readyDraws(at.cwd, at.unit) ? [{ kind: /** @type {const} */ ('ready'), id: 'ready-to-build', text: 'Ready to build: the outline and the phase cut, for your yes', page: null }] : [];
}

/**
 * Where the spec stands, as its banner, its row on the unit's tab and All
 * work say it (the header's): a pass out by its state; else the next pass
 * waiting on the person while a gap does; else ready to build while its yes
 * waits; else being written.
 * @param {BoardAt} at @param {WaitingLine[]} waiting what waits on the person in the unit
 */
function specDoing(at, waiting) {
  if (buildBegun(at.manifest)) return 'ready to build, your yes given';
  const reported = reportedOf(at).length;
  const out = passesInFlight(at.cwd, at.unit);
  const latest = out.at(-1);
  if (latest !== undefined) return OUT[latest.stands](reported + out.length);
  if (waiting.some(({ kind }) => kind === 'gap')) return `pass ${reported + 1} waits on you`;
  return waiting.some(({ kind }) => kind === 'ready') ? 'ready to build' : 'being written';
}

/**
 * The specification's This session (the header's), what waits on the
 * person read from the unit's one list, each gap with the sections it
 * touches.
 * @param {BoardAt} at @param {WaitingLine[]} waiting @returns {{view: SpecView}}
 */
function specView(at, waiting) {
  const text = specText(at);
  const reading = text === null ? null : specReading(text);
  const reported = reportedOf(at);
  const out = passesInFlight(at.cwd, at.unit);
  const reads = text === null || out.length === 0 ? null : [...areasOf(sectionsToReview(at.cwd, at.unit, text).changed)];
  const beingRead = out.some(({ stands }) => stands === 'running') ? reads : null;
  const changed = changedBy(changesOf(reported, text));
  const since = readShown(at.root, at.warnings, (shower) => /** @type {{id: string, text: string}[]} */ (/** @type {unknown} */ (answerSince(shower, { unit: at.unit, topic: null }, at.root, at.warnings).calls)));
  return {
    view: {
      kind: 'spec',
      unit: at.unit,
      title: at.title,
      type: at.manifest.work_type,
      project: projectName(at.cwd),
      sections: (reading?.headings ?? []).filter(({ kind }) => kind === 'area').map(({ number, title }) => ({
        number: String(number), title, changed_by: changed.get(String(number)) ?? [], reading: beingRead?.includes(String(number)) ?? false,
      })),
      passes: passesOf(passStandings(at, reported), out, reads),
      waiting: gapsWith(at, waiting, reported, reading),
      since: since.length === 0 ? [] : callLines(at, since, reported, reading),
      cut: cutPhases(at.manifest).map(({ name = '', scenarios, sections }, k) => ({ phase: k + 1, name, scenarios: scenarios.length, sections })),
      given: buildBegun(at.manifest),
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
 * The banner's facts in a specification (20.2.4): the type, the phase and
 * where the spec stands (`specDoing`); what waits on the person is the
 * board's, from the unit's one list (board.cjs).
 * @param {BoardAt} at @param {WaitingLine[]} waiting @returns {{state: 'running', facts: {text: string, needs: boolean}[]}}
 */
function specBanner(at, waiting) {
  return { state: 'running', facts: [placeFact(at.manifest.work_type), placeFact('specification'), fact(specDoing(at, waiting))] };
}

/**
 * A section of the spec read in full (20.9.2), by its number: the passes
 * that changed it, and its text; refused where the spec is not written or
 * holds no such section.
 * @param {BoardAt} at @param {string} number @returns {import('../board-model.cjs').SectionPage}
 */
function sectionPage(at, number) {
  const text = specText(at);
  const reading = text === null ? null : specReading(text);
  const heading = reading?.headings.find((held) => held.kind === 'area' && String(held.number) === number);
  if (reading === null || heading === undefined) throw new Error(`${at.unit}'s spec holds no section ${number}`);
  const changed = changedBy(changesOf(reportedOf(at), text));
  return { kind: 'section', unit: at.unit, number, title: heading.title, changed_by: changed.get(number) ?? [], text: sectionProse(reading, number) };
}

/**
 * A section's words as its page reads them: each statement and screen of
 * the area, in its order, its blocks as written with its number and its
 * bracket of cites taken off — no heading, scenario or note.
 * @param {SpecReading} reading @param {string} number
 */
const sectionProse = (reading, number) => reading.lines
  .filter((line) => (line.kind === 'statement' || line.kind === 'screen') && lineArea(line) === number)
  .flatMap(({ parts }) => parts.map(({ text }) => text))
  .join('\n\n');

/** A reported pass by its number, refused where none of that number has reported. @param {BoardAt} at @param {Reported[]} reported @param {string} said */
function reportedPass(at, reported, said) {
  const pass = reported[Number(said) - 1];
  if (pass === undefined || !fs.existsSync(pass.file)) throw new Error(`${at.unit}'s review holds no reported pass ${said}`);
  return pass;
}

/**
 * A reported pass read in full (20.9.2), by its number: what it read — the
 * whole spec for the first, else what the pass before it changed — what it
 * changed, and each finding as it stands with the person; refused where no
 * pass of that number has reported.
 * @param {BoardAt} at @param {string} said @returns {import('../board-model.cjs').PassPage}
 */
function passPage(at, said) {
  const reported = reportedOf(at);
  const pass = reportedPass(at, reported, said);
  const k = Number(said) - 1;
  const changes = changesOf(reported, specText(at));
  const standings = passStandings(at, reported)[k];
  return {
    kind: 'pass',
    unit: at.unit,
    title: at.title,
    pass: k + 1,
    reads: k === 0 ? null : changes[k - 1],
    changed: changes[k],
    found: pass.findings.map(({ id, label }) => ({ finding: id, label, standing: /** @type {FindingStanding} */ (standings.get(id)) })),
  };
}

/**
 * A finding of a reported pass read in full (20.9.2), by its pass's number
 * and its id: its label and lane, where it stands with the person, the
 * sections the entry it was raised as touches, and its text in the report;
 * refused where the pass holds no such finding.
 * @param {BoardAt} at @param {string} said @param {string} id @returns {import('../board-model.cjs').SpecFindingPage}
 */
function specFindingPage(at, said, id) {
  const reported = reportedOf(at);
  const pass = reportedPass(at, reported, said);
  const finding = pass.findings.find((held) => held.id === id);
  if (finding === undefined) throw new Error(`${at.unit}'s pass ${said} holds no finding ${id}`);
  const text = specText(at);
  const reading = text === null ? null : specReading(text);
  const linked = pass.asked.find((held) => held.finding === id)?.entry ?? pass.raised.find((held) => held.finding === id)?.replaces ?? null;
  const sections = linked === null ? [] : withUnitEntries(at.cwd, at.unit, at.warnings, ({ folded, entries }) => {
    const entry = currentsOf(folded, linked).find((current) => entries.has(current)) ?? linked;
    const cites = entries.get(entry)?.line.cites;
    return touched(at, reading, entry, Array.isArray(cites) ? cites : []);
  });
  return {
    kind: 'spec-finding',
    unit: at.unit,
    title: at.title,
    pass: Number(said),
    finding: id,
    label: finding.label,
    lane: finding.lane,
    standing: /** @type {FindingStanding} */ (passStandings(at, reported)[Number(said) - 1].get(id)),
    sections,
    text: findingText(fs.readFileSync(pass.file, 'utf8'), id),
  };
}

module.exports = { specView, specBanner, specDoing, specWaits, reportedOf, sectionPage, passPage, specFindingPage, passMoments };
