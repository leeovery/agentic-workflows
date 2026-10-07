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

const fs = require('fs');
const path = require('path');
const { VALID_WORK_TYPES, WORK_TYPE_PIPELINES, PAUSING_PHASES, NO_ARGUMENT, assertLegalName } = require('../kernel/manifest-schema.cjs');
const { loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { EPIC_DETAIL_PHASES } = require('./epic-detail.cjs');
const { parseInboxPaths } = require('./inbox.cjs');
const { titlecase } = require('./conventions.cjs');
const { section, dataSection, CONTINUE_INSTRUCTION } = require('./projections/surfaces.cjs');

const HANDOFF_ENV = 'WORKFLOWS_HANDOFF';

const HANDOFF_INSTRUCTION = 'json for the gate mod — never display';

const OUTCOMES = ['completed', 'paused', 'cancelled', 'postponed'];

// Every phase some work type's pipeline holds is entered by a handoff.
const PIPELINE_PHASES = [...new Set(Object.values(WORK_TYPE_PIPELINES).flat())];

/** The skill a phase runs in — the one a handoff into the phase lands on. @param {string} phase */
function phaseSkill(phase) {
  return `workflow-${phase}-process`;
}

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

/**
 * A work unit the project holds, of `type`, still in progress — a manifest
 * that does not parse refused as itself, never as a unit not found.
 * @param {string} cwd @param {string} name @param {string} type
 */
function assertWorkUnit(cwd, name, type) {
  assertLegalName('work unit', name);
  if (!fs.existsSync(path.join(cwd, '.workflows', name, 'manifest.json'))) {
    throw new Error(`work unit "${name}" not found`);
  }
  const manifest = loadWorkUnitManifest(cwd, name);
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
 * A phase's skill: the work type it serves, a work unit of that type, and the
 * topic — a legal name, which need not exist. An epic always names its topic;
 * a single-topic unit's topic is the unit itself.
 * @param {string} phase @returns {Target}
 */
function phaseTarget(phase) {
  const served = VALID_WORK_TYPES.filter((type) => WORK_TYPE_PIPELINES[type].includes(phase));
  return {
    usage: `<${served.join('|')}> <work-unit> [<topic>]`,
    counts: [2, 3],
    check: (cwd, [type, unit, topic]) => {
      assertOneOf('the work type', type, served);
      if (type === 'epic' && topic === undefined) throw new Error(`an epic enters ${phase} at a topic`);
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
      if (unit === NO_ARGUMENT) {
        if (seeds !== NO_ARGUMENT) assertSeeds(cwd, seeds);
        return;
      }
      assertOneOf('the work type into an existing epic', type, ['epic', NO_ARGUMENT]);
      if (seeds !== NO_ARGUMENT) throw new Error(`inbox seeds start new work, never an existing epic's discovery — got "${seeds}"`);
      assertWorkUnit(cwd, unit, 'epic');
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
      if (phase !== undefined) {
        assertOneOf('the phase', phase, EPIC_DETAIL_PHASES);
        assertOneOf('the outcome', outcome, OUTCOMES);
        if (outcome === 'paused') assertOneOf('the phase that paused', phase, PAUSING_PHASES);
      }
      assertWorkUnit(cwd, unit, 'epic');
    },
    where: ([unit]) => at('Epic', unit),
  },
  ...Object.fromEntries(PIPELINE_PHASES.map((phase) => [phaseSkill(phase), phaseTarget(phase)])),
};

const HANDOFF_TARGETS = Object.keys(TARGETS);

// A conversation opens on workflow-start, the user's way in, or wherever a handoff lands the work.
const OPENING_SKILLS = ['workflow-start', ...HANDOFF_TARGETS];

/**
 * The handoff into `skill` with `args`, checked against the table and
 * composed — the skill named bare or as its slash command, as a menu's
 * stored route names it. Refuses a skill no move into work lands on, the
 * wrong number of arguments, an argument the continuation could not carry,
 * and one of the wrong shape.
 * @param {string} cwd @param {string} named @param {string[]} args
 * @returns {Handoff}
 */
function resolveHandoff(cwd, named, args) {
  const skill = named.startsWith('/') ? named.slice(1) : named;
  if (!Object.hasOwn(TARGETS, skill)) {
    throw new Error(`"${skill}" is not a handoff target — a handoff moves into work: ${HANDOFF_TARGETS.join(', ')}`);
  }
  const target = TARGETS[skill];
  if (!target.counts.includes(args.length)) {
    throw new Error(`Usage: engine handoff ${[skill, target.usage].filter(Boolean).join(' ')}`);
  }
  const spanEnd = args.find((arg) => arg.includes('`'));
  if (spanEnd !== undefined) throw new Error(`"${spanEnd}" cannot travel in the continuation — a backtick ends its code span`);
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

module.exports = { resolveHandoff, handoffSections, phaseSkill, HANDOFF_TARGETS, OPENING_SKILLS };
