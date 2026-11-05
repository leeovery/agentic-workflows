'use strict';

// ---------------------------------------------------------------------------
// Domain ring: an investigation's process gates as `render` serves them
// (19.4.19), each read from the hunt its log holds (investigation-log.cjs)
// and Claude's payload, and drawn by projections/investigation.cjs; each is
// answered through `gate`, and nothing here writes.
//
// - `investigation-plan <bugfix> --file <plan.json> [--revised]`: the
//   payload `{"order": [{"hypothesis": "H{n}", "check": "<how>"}, …]}`,
//   every hypothesis the log holds open, each once, in the order Claude will
//   check them. A finding that invalidates the agreed plan brings the
//   revised plan back to the same gate (19.4.24): `--revised`, its payload
//   saying besides what the finding changed, `"changed"`.
// - `investigation-check-in <bugfix> --file <check-in.json>`: the payload
//   `{"resolved": ["H{n}", …], "next": "<what is checked next>"}`, the
//   hypotheses resolved since the last gate, each one the log holds settled.
//
// Each refuses, opening on its command: a place whose investigation cannot
// take work or has not started (`openInvestigation`), a payload that cannot
// be read or is out of its shape, a value missing, empty or past one line,
// a hypothesis the log does not hold or named twice; the plan's, one
// settled, one the log holds open left out, none open at all, and what
// changed given without `--revised` or missing with it; the check-in's, one
// still open, and none resolved.
// ---------------------------------------------------------------------------

const { filled, shaped, listed, readPayload, refusing } = require('./staged-payload.cjs');
const { huntOf, openInvestigation } = require('./investigation-log.cjs');
const { topicTitle } = require('./derivations.cjs');
const { planScreen, checkInScreen } = require('./projections/investigation.cjs');

/** @typedef {import('./investigation-log.cjs').Hypothesis} Hypothesis */
/** @typedef {{dotpath?: string, file?: string, revised?: string}} Args */

/** Words of Claude's for one line, refused missing, empty or past it. @param {unknown} v @param {string} what */
function lineOf(v, what) {
  if (!filled(v) || /[\r\n]/.test(v)) throw new Error(`${what} is one line of words, not empty`);
  return v.trim();
}

/**
 * What a gate is drawn from: the bugfix, its investigation open, its topic
 * as screens title it, the hunt its log holds, and the payload.
 * @param {string} cwd @param {Args} args @param {string} surface @param {string} payload what the payload is
 */
function gateReads(cwd, { dotpath: unit = '', file }, surface, payload) {
  if (unit === '' || file === undefined) throw new Error(`Usage: engine render ${surface} <bugfix> --file <${payload}.json>`);
  const manifest = openInvestigation(cwd, unit, `render ${surface}`);
  /** @type {string[]} */
  const warnings = [];
  const hunt = huntOf(cwd, unit, warnings);
  return { unit, title: topicTitle(manifest, unit), hunt, given: readPayload(cwd, file) };
}

/**
 * The hypotheses `names` names, each one the log holds, none twice; `what`
 * the list's name in a refusal.
 * @param {Hypothesis[]} held @param {string[]} names @param {string} what @returns {Hypothesis[]}
 */
function namedHypotheses(held, names, what) {
  return names.map((name, at) => {
    const hypothesis = held.find((one) => one.name === name);
    if (hypothesis === undefined) throw new Error(`${what} names ${name}, which the log holds no hypothesis as`);
    if (names.indexOf(name) !== at) throw new Error(`${what} names ${name} twice`);
    return hypothesis;
  });
}

/** `render investigation-plan <bugfix> --file <plan.json> [--revised]`. @param {string} cwd @param {Args} args */
function investigationPlanSurface(cwd, args) {
  return refusing('render investigation-plan', () => {
    const { unit, title, hunt, given } = gateReads(cwd, args, 'investigation-plan', 'plan');
    const revised = args.revised !== undefined;
    const plan = shaped(given, 'the plan', revised ? ['order', 'changed'] : ['order']);
    const rows = listed(plan.order, 'the plan\'s order').map((row, at) => shaped(row, `the plan's order[${at}]`, ['hypothesis', 'check']));
    const order = namedHypotheses(hunt.hypotheses, rows.map(({ hypothesis }) => String(hypothesis)), 'the plan');
    const open = hunt.hypotheses.filter(({ state }) => state === 'suspected');
    if (open.length === 0) throw new Error(`the log holds no open hypothesis — log each one the plan checks first: engine investigation-log hypothesis ${unit} --title "<title>"`);
    const settled = order.find(({ state }) => state !== 'suspected');
    if (settled !== undefined) throw new Error(`the plan orders ${settled.name}, which the log holds settled — a plan orders the hypotheses still open`);
    const left = open.find((hypothesis) => !order.includes(hypothesis));
    if (left !== undefined) throw new Error(`the plan leaves out ${left.name}, which the log holds open — order every open hypothesis, or log it ruled out`);
    return planScreen({
      title,
      order: order.map((hypothesis, at) => ({ hypothesis, check: lineOf(rows[at].check, `the plan's order[${at}] check`) })),
      settled: hunt.hypotheses.filter(({ state }) => state !== 'suspected'),
      changed: revised ? lineOf(plan.changed, 'what the finding changed') : null,
    });
  });
}

/** `render investigation-check-in <bugfix> --file <check-in.json>`. @param {string} cwd @param {Args} args */
function investigationCheckInSurface(cwd, args) {
  return refusing('render investigation-check-in', () => {
    const { unit, title, hunt, given } = gateReads(cwd, args, 'investigation-check-in', 'check-in');
    const checkIn = shaped(given, 'the check-in', ['resolved', 'next']);
    const names = listed(checkIn.resolved, 'the check-in\'s resolved').map((name) => String(name));
    if (names.length === 0) throw new Error('the check-in names no hypothesis resolved — a check-in comes once one is');
    const open = namedHypotheses(hunt.hypotheses, names, 'the check-in').find(({ state }) => state === 'suspected');
    if (open !== undefined) throw new Error(`the check-in names ${open.name}, which the log holds open — log where it stands first: engine investigation-log hypothesis ${unit} ${open.name} --state <state>`);
    return checkInScreen({ title, hypotheses: hunt.hypotheses, resolved: names, experiments: hunt.experiments, next: lineOf(checkIn.next, 'what is checked next') });
  });
}

module.exports = { investigationPlanSurface, investigationCheckInSurface };
