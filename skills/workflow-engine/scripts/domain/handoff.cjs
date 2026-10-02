'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the handoff — every move into work, named by one engine call.
//
// The table holds each skill a move into work lands on and the arguments it
// takes; a call naming anything else is refused. The engine composes the
// continuation and the line naming where the work goes — the session writes
// neither — and says which way the work travels: the gate mod carries it
// where the session announced handoff support (`WORKFLOWS_HANDOFF=1`), and
// the session invokes the skill in place where it did not.
// ---------------------------------------------------------------------------

const { VALID_WORK_TYPES, WORK_TYPE_PIPELINES, NO_ARGUMENT, illegalNameReason } = require('../kernel/manifest-schema.cjs');
const { loadManifest } = require('./reads.cjs');
const { parseInboxPaths } = require('./inbox.cjs');
const { titlecase } = require('./conventions.cjs');
const { section, dataSection, CONTINUE_INSTRUCTION } = require('./projections/surfaces.cjs');

const HANDOFF_ENV = 'WORKFLOWS_HANDOFF';

const HANDOFF_INSTRUCTION = 'json for the gate mod — never display';

// The phases an epic's conclusion comes from — its discovery among them,
// which the pipeline does not hold.
const EPIC_PHASES = ['discovery', ...WORK_TYPE_PIPELINES.epic];

const OUTCOMES = ['completed', 'paused', 'cancelled', 'postponed'];

// Every phase some work type's pipeline holds has an entry skill of its name.
const ENTRY_PHASES = [...new Set(Object.values(WORK_TYPE_PIPELINES).flat())];

/**
 * One skill a handoff lands on.
 * @typedef {object} Target
 * @property {string} usage      its arguments, as a refusal names them
 * @property {number[]} counts   how many arguments it takes
 * @property {(cwd: string, args: string[]) => void} check  refuses an argument of the wrong shape
 * @property {(args: string[]) => string} where  where the work goes, named for the person
 * @property {number} [quoted]   the argument it reads quoted
 */

/**
 * A handoff, composed: the skill, its arguments as it is invoked with them,
 * the continuation that invokes it, and the line naming where the work goes.
 * @typedef {{skill: string, args: string, text: string, line: string}} Handoff
 */

/** @param {string} kind @param {string} value @param {string[]} allowed */
function assertOneOf(kind, value, allowed) {
  if (allowed.includes(value)) return;
  const expected = allowed.length === 1 ? allowed[0] : `one of ${allowed.join('|')}`;
  throw new Error(`${kind} must be ${expected} — got "${value}"`);
}

/** @param {string} kind @param {string} name */
function assertLegalName(kind, name) {
  const illegal = illegalNameReason(kind, name);
  if (illegal !== null) throw new Error(illegal);
}

/**
 * A work unit the project holds, of `type`, still in progress.
 * @param {string} cwd @param {string} name @param {string} type
 */
function assertWorkUnit(cwd, name, type) {
  assertLegalName('work unit', name);
  const manifest = loadManifest(cwd, name);
  if (manifest === null) throw new Error(`work unit "${name}" not found`);
  if (manifest.work_type !== type) {
    throw new Error(`work unit "${name}" is of type ${manifest.work_type}, not ${type}`);
  }
  if (manifest.status !== 'in-progress') {
    throw new Error(`work unit "${name}" is ${manifest.status} — a handoff moves into work in progress`);
  }
}

/**
 * Live inbox items, comma-joined as discovery splits them — every one on
 * disk, none twice, none holding the quote discovery reads them inside.
 * @param {string} cwd @param {string} seeds
 */
function assertSeeds(cwd, seeds) {
  if (seeds.includes('"')) throw new Error(`inbox seeds travel quoted — a path cannot hold a double quote: ${seeds}`);
  parseInboxPaths(cwd, seeds.split(','), { archived: false });
}

/** A place, and the most specific name in it where there is one. @param {string} place @param {string|null} [name] */
function at(place, name = null) {
  return name === null ? place : `${place} · ${name}`;
}

/**
 * A phase entry skill: the work type it serves, a work unit of that type, and
 * the topic where the caller names one — a legal name, which need not exist.
 * @param {string} phase @returns {Target}
 */
function entryTarget(phase) {
  const served = VALID_WORK_TYPES.filter((type) => WORK_TYPE_PIPELINES[type].includes(phase));
  return {
    usage: `<${served.join('|')}> <work-unit> [<topic>]`,
    counts: [2, 3],
    check: (cwd, [type, unit, topic]) => {
      assertOneOf('the work type', type, served);
      assertWorkUnit(cwd, unit, type);
      if (topic !== undefined) assertLegalName('topic', topic);
    },
    where: ([, unit, topic]) => at(titlecase(phase), topic ?? unit),
  };
}

/** @type {Record<string, Target>} */
const TARGETS = {
  'workflow-discovery': {
    usage: `<work-type|${NO_ARGUMENT}> <${NO_ARGUMENT}|epic> [<inbox-paths|${NO_ARGUMENT}>]`,
    counts: [2, 3],
    quoted: 2,
    check: (cwd, [type, unit, seeds = NO_ARGUMENT]) => {
      assertOneOf('the work type', type, [...VALID_WORK_TYPES, NO_ARGUMENT]);
      if (unit !== NO_ARGUMENT) assertWorkUnit(cwd, unit, 'epic');
      if (seeds !== NO_ARGUMENT) assertSeeds(cwd, seeds);
    },
    where: ([, unit]) => at('Discovery', unit === NO_ARGUMENT ? null : unit),
  },
  'workflow-roadmap': {
    usage: 'open',
    counts: [1],
    check: (cwd, [mode]) => assertOneOf('the mode', mode, ['open']),
    where: () => at('Roadmap'),
  },
  'workflow-baseline': {
    usage: '',
    counts: [0],
    check: () => {},
    where: () => at('Baseline'),
  },
  'workflow-continue-epic': {
    usage: '<epic> [<completed-phase> <outcome>]',
    counts: [1, 3],
    check: (cwd, [unit, phase, outcome]) => {
      assertWorkUnit(cwd, unit, 'epic');
      if (phase === undefined) return;
      assertOneOf('the phase', phase, EPIC_PHASES);
      assertOneOf('the outcome', outcome, OUTCOMES);
    },
    where: ([unit]) => at('Epic', unit),
  },
  ...Object.fromEntries(ENTRY_PHASES.map((phase) => [`workflow-${phase}-entry`, entryTarget(phase)])),
};

/**
 * The handoff into `skill` with `args`, checked against the table and
 * composed. Refuses a skill no move into work lands on, the wrong number of
 * arguments, and an argument of the wrong shape.
 * @param {string} cwd @param {string} skill @param {string[]} args
 * @returns {Handoff}
 */
function resolveHandoff(cwd, skill, args) {
  if (!Object.hasOwn(TARGETS, skill)) {
    throw new Error(`"${skill}" is not a handoff target — a handoff moves into work: ${Object.keys(TARGETS).join(', ')}`);
  }
  const target = TARGETS[skill];
  if (!target.counts.includes(args.length)) {
    throw new Error(`Usage: engine handoff ${[skill, target.usage].filter(Boolean).join(' ')}`);
  }
  const split = args.find((arg, i) => i !== target.quoted && /[\s"']/.test(arg));
  if (split !== undefined) throw new Error(`"${split}" cannot travel as one argument — whitespace and quotes split it`);
  target.check(cwd, args);
  const composed = args.map((arg, i) => (i === target.quoted ? `"${arg}"` : arg)).join(' ');
  return {
    skill,
    args: composed,
    text: `Invoke \`/${[skill, composed].filter(Boolean).join(' ')}\`.`,
    line: `→ ${target.where(args)}`,
  };
}

/**
 * Whether the gate mod announced it carries a handoff to this process — set
 * at session start, inherited by every command the session runs.
 * @returns {boolean}
 */
function handoffAnnounced() {
  return process.env[HANDOFF_ENV] === '1';
}

/**
 * The answer a handoff gives: which way the work goes and the skill to
 * invoke where the session carries it itself, the line naming where it goes,
 * and — announced — the payload the gate mod carries it by.
 * @param {Handoff} handoff @returns {string}
 */
function handoffSections(handoff) {
  const carried = handoffAnnounced();
  const data = [`handoff: ${carried ? 'mod' : 'inline'}`, `skill: ${handoff.skill}`];
  if (handoff.args !== '') data.push(`args: ${handoff.args}`);
  return [
    dataSection(data),
    section('DISPLAY: handoff', CONTINUE_INSTRUCTION, handoff.line),
    carried ? section('HANDOFF', HANDOFF_INSTRUCTION, JSON.stringify(handoff)) : '',
  ].join('');
}

module.exports = { resolveHandoff, handoffSections, HANDOFF_TARGETS: Object.keys(TARGETS) };
