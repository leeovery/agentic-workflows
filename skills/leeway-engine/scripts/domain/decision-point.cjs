'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the decision point (16.1, 16.2) — whether a call Claude has a
// lean on goes to the person. One function, reached by every raise
// (raise.cjs): Claude supplies the question and its lean, never the
// decision. It answers ask, proceed (the call lands as Claude's), check
// (Claude finds the answer out, nothing drawn) or ask blind (Claude's
// answer held back until the person has given theirs, 16.17), and the
// reason for it.
//
// What it decides from (E1), as the raise gives it: the call; its label;
// where it is made, and whether it blocks build work; whose the entry it
// would replace is; the experiment still running that measures the question
// it answers; Claude's mark that it always asks; whether it was sent
// to check once already; the project; the model of the session making it;
// the time; and the question's id, the same on every raise of it (E3), none
// for a replacement.
//
// Until the ask rule is switched on (29.19.2), every call asks (29.5.2),
// with the rule's own reason. `ruled` is what it decides once switched: the
// ask rule (ask-rule.cjs) over the trust log's counts for the project and
// the model as of the time (trust-counts.cjs), the person's settings
// (trust-settings.cjs) and their care entries, from the record of the
// person (person.cjs); and where the rule lets the call proceed — a quiet
// kind's, or a one-answer call's (16.3.7) — on a question, never a
// replacement, which sets out Claude's proposals beside the decision as it
// stands, so its rows tell where Claude leans, a blind question drawn at
// the share (16.17.3, 16.17.9): the question's id turned into a number,
// the first 32 bits of its SHA-1 as a fraction, as the measured replay
// drew (trust/replay_rule.py), drawing blind under the share — the wider
// share while the call's count holds few answers of the project's own at
// the session's model (trust-settings.cjs) — so the same question draws
// the same way however often it is raised, and no tally is kept
// (16.17.4). Claude never chooses which calls are drawn.
//
// Beside it, whether Claude offers to settle the rest of a topic, asked once
// the person has answered a raise there and by the offer's own render
// (16.8.1): until the ask rule is switched on, no offer comes. Once
// switched, it is convergence.cjs's `offerDue`: the topic's run of
// agreements, where it has come to the offer.
//
// Beside it, `gateStep`: whether a learned process gate (learned-gates.cjs)
// shows, or runs as an automatic step on one of its rows (3.2.7). Every
// surface that draws one asks it, at the gate's place — its unit, phase and
// topic — with the key it draws the gate's showing from, and draws what it
// answers (projections/surfaces.cjs). A showing held at the gate's place
// (showing-hold.cjs) — waiting for its answer, set aside by free text, or
// left open by a row that shows the gate again — shows again on its hold
// and is never drawn again, the person having engaged with it, while it is
// of the subject the draw's key names (`heldFor`); one of a subject gone is
// ended, and the gate drawn afresh. A surface's draw that shows the gate on
// a new showing opens its hold; a verb's check of the step reads the hold
// and opens none. Until the learned gates are switched on (29.19.2), every
// gate shows. `learned` is what it decides once switched, where no showing
// is held: in a build in step, the gate shows, the position read from the
// unit at each gate so a switch bites at once (3.3.3, 3.3.6); else — only
// the build has a position (3.3.1) — as the gate's count stands for the
// project and the session's model as of the time, at the person's
// threshold, its showing's blind ask drawn. A gate off the list shows, and
// nothing is read for it.
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const { rule } = require('./ask-rule.cjs');
const { kindOf } = require('./labeller.cjs');
const { countsFrom, countsOf, gateCount, stateOf } = require('./trust-counts.cjs');
const { projectId, modelOf, readPersonEvents } = require('./trust-log.cjs');
const { trustSettings, BLIND_SHARE, WIDE_BLIND_SHARE, WIDE_UNTIL } = require('./trust-settings.cjs');
const { careEntries } = require('./person.cjs');
const { learnedGate, heldFor, showingOf, shows, stepOf } = require('./learned-gates.cjs');
const { heldShowing, holdShowing, endShowing } = require('./showing-hold.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { BUILD_PHASES } = require('../kernel/manifest-schema.cjs');

/** @typedef {import('./ask-rule.cjs').Ruling | 'blind'} Decision */
/** @typedef {import('./trust-counts.cjs').Counts} Counts */
/**
 * Where and when a call is decided, beside the call itself, and the id its
 * blind draw hashes: the question's, the same on every raise of it; none
 * for a replacement, which is never drawn blind.
 * @typedef {Omit<import('./ask-rule.cjs').Context, 'project'|'counts'|'settings'|'care'> & {project: {root: string, name: string}, model: string|null, now: number, question: string|null}} At
 */
/** @typedef {import('./learned-gates.cjs').GateStep} GateStep */
/**
 * Where a gate comes: the command's folder; the gate's place — the unit,
 * phase and topic it comes at, each null where it comes at none; the key its
 * surface draws the showing from, out of its own state; and whether a verb
 * checks the step rather than a surface drawing the gate, opening no hold.
 * @typedef {{cwd: string, place: import('./learned-gates.cjs').Place, key: unknown, check?: boolean}} GateAt
 */

const EVERY_CALL_ASKS = 'Every call comes to you for now: I don\'t decide on my own yet.';
const BLIND = 'I\'m asking you this one cold, keeping my answer back until you\'ve given yours, to check my calls against yours.';
// The draw reads the first 32 bits of the id's SHA-1: 8 hex digits.
const DRAW_DIGITS = 8;
const DRAW_RANGE = 2 ** 32;

/**
 * Whether the call goes to the person, and why.
 * @param {import('./raise.cjs').Call} _call @param {At} _at
 * @returns {{decision: Decision, reason: string}}
 */
function decide(_call, _at) {
  return { decision: 'ask', reason: EVERY_CALL_ASKS };
}

/** The question's id as a number from 0 up to 1 (16.17.4). @param {string} question */
function drawOf(question) {
  return parseInt(crypto.createHash('sha1').update(question).digest('hex').slice(0, DRAW_DIGITS), 16) / DRAW_RANGE;
}

/**
 * The share of the call's kind's calls — of the one-answer calls, for a
 * call sorted `one` — drawn blind: the wide share while its count holds
 * fewer than WIDE_UNTIL answers of the project's own at the session's
 * model.
 * @param {{sort: 'one'|'several'}} call @param {import('./labeller.cjs').Label} label @param {Counts} counts
 */
function blindShare({ sort }, label, counts) {
  const count = sort === 'one' ? counts.one : counts.kinds[/** @type {import('./event-fields.cjs').Kind} */ (kindOf(label))];
  return count.own < WIDE_UNTIL ? WIDE_BLIND_SHARE : BLIND_SHARE;
}

/**
 * The ask rule's decision on the call: over the counts the trust log holds
 * on the project, for the session's model as of the time, the person's
 * settings, and their care entries, which the record of the person holds,
 * each project's by its id (person.cjs); where it lets a question's call
 * proceed, asked blind where the question's id draws so.
 * @param {import('./raise.cjs').Call} call @param {At} at
 * @returns {{decision: Decision, reason: string}}
 */
function ruled(call, { project: { root, name }, model, now, question, ...at }) {
  const counts = countsOf(root, { model, now });
  const ruling = rule(call, { ...at, project: { id: projectId(root), name }, counts, settings: trustSettings(), care: careEntries() });
  if (ruling.decision !== 'proceed' || question === null) return ruling;
  return drawOf(question) < blindShare(call, /** @type {import('./labeller.cjs').Label} */ (at.label), counts) ? { decision: 'blind', reason: BLIND } : ruling;
}

/**
 * The agreements in a row in the topic `topic` of `unit` where Claude offers
 * to settle the rest of it (16.8.1), else null.
 * @param {string} _cwd @param {string} _unit @param {string} _topic
 * @returns {number|null}
 */
function convergenceDue(_cwd, _unit, _topic) {
  return null;
}

/**
 * Whether the learned gate `name` shows, or runs as an automatic step, on
 * its showing.
 * @param {string} name @param {GateAt} at
 * @returns {GateStep}
 */
function gateStep(name, at) {
  return drawn(name, at, (showing) => shows(name, showing));
}

/**
 * The gate `gate` at its place: shown on the showing held there, while it is
 * of the subject `key` names; else drawn on the showing its key tells, as
 * `decides` steps it, a surface's draw opening its hold where it shows — a
 * verb's check opens none.
 * @param {string} gate @param {GateAt} at @param {(showing: string, root: string) => GateStep} decides
 * @returns {GateStep}
 */
function drawn(gate, { cwd, place, key, check = false }, decides) {
  const root = stateRoot(cwd);
  const held = standing(root, gate, place, key);
  if (held !== null) return shows(gate, held.showing, { place, opened: held.opened });
  const showing = showingOf(place, key);
  const step = decides(showing, root);
  return step.step === 'automatic' || check ? step : shows(gate, showing, { place, opened: holdShowing(root, gate, place, showing, key).opened });
}

/**
 * The showing of the gate `gate` held at `place` while it is still of the
 * subject a draw on `key` names; one whose subject is gone ended, none then.
 * @param {string} root @param {string} gate @param {import('./learned-gates.cjs').Place} place @param {unknown} key
 */
function standing(root, gate, place, key) {
  const held = heldShowing(root, gate, place);
  if (held === null || heldFor(gate, held.key, key)) return held;
  endShowing(root, gate, place, held);
  return null;
}

/**
 * Whether the unit's build is in step, at a place of the build: its
 * implementation, or its review phase, whose fixes take the build's position
 * (14.6.2).
 * @param {string} root @param {GateAt['place']} place
 */
function inStep(root, { unit, phase }) {
  return unit !== null && phase !== null && BUILD_PHASES.includes(phase) && manifestOf(root, unit)?.build?.position === 'step';
}

/**
 * The learned gates' step on the gate `name`: shown on the showing held at
 * its place, and in a build in step; else as its count stands on the
 * project for the session's model as of now, at the person's threshold, its
 * showing's blind ask drawn. A gate off the list shows, reading nothing.
 * @param {string} name @param {GateAt} at
 * @returns {GateStep}
 */
function learned(name, at) {
  const gate = learnedGate(name);
  if (gate === null) return shows(name, null);
  return drawn(gate, at, (showing, root) => (inStep(root, at.place) ? shows(gate, showing) : counted(gate, at.cwd, root, showing)));
}

/**
 * The learned gate `gate`'s step on its showing `showing`, as its count
 * stands on the project for the session's model as of now, at the person's
 * threshold.
 * @param {string} gate @param {string} cwd @param {string} root @param {string} showing
 * @returns {GateStep}
 */
function counted(gate, cwd, root, showing) {
  /** @type {Record<string, unknown>[]} */
  const answers = [];
  readPersonEvents(root, (event) => {
    if (event.type === 'gate' && event.gate === gate) answers.push(event);
  });
  const counts = countsFrom(answers, { project: projectId(root), model: modelOf(cwd), now: Date.now() });
  return stepOf(gate, stateOf(gateCount(counts, gate), trustSettings().threshold), showing);
}

module.exports = { decide, ruled, convergenceDue, gateStep, learned };
