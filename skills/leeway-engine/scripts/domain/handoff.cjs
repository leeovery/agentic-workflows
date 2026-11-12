'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the handoff — every move into work, named by one engine call.
//
// The table holds each skill a move into work lands on and the arguments it
// takes; a call naming anything else is refused. The engine composes the
// continuation and the line naming where the work goes — the session writes
// neither — and says which way the work travels: the gate mod carries it
// where the session announced handoff support (`LEEWAY_HANDOFF=1`), and
// the session invokes the skill in place where it did not. A topic named by
// its unit and name alone, as `/leeway {unit} {topic}` names it (10.3.1),
// is handed off into its discussion, as picking it from the menus does —
// refused, before anything travels, where the entry would refuse it
// (topic-standing.cjs). A phase lands on its own skill, but a quick-fix's
// implementation, which lands on the quick-fix's skill, the one that runs
// it from its opener to its close (19.5.1).
//
// The epic's menu takes the epic alone: one in progress, or one finish
// completed, whose menu is its complete variant (18.4.23). The start,
// `leeway`, takes nothing: where finish hands every other unit once it is
// done, and where a feature's, bugfix's or quick-fix's cancel from inside
// its session goes (18.4.20). The roadmap takes nothing either.
//
// Discovery is told how the conversation was come to: a work type, the
// person starting a piece of work of that kind; `start`, a piece of work of
// no kind yet (8.2.9); `none`, the product's conversation itself, or an
// epic's. Its seeds, refused before anything travels where the entry would
// refuse them (seeds.cjs): new work's, live inbox items and waiting roadmap
// items, `roadmap:{item}`, which a pull hands in (8.1.8); an existing
// epic's, waiting roadmap ideas joining it as topics (18.8.4).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { VALID_WORK_TYPES, WORK_TYPE_PIPELINES, NO_ARGUMENT, PRODUCT, assertLegalName } = require('../kernel/manifest-schema.cjs');
const { loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { assertSeeds } = require('./seeds.cjs');
const { titlecase } = require('./conventions.cjs');
const { section, dataSection, CONTINUE_INSTRUCTION, GATE_MOD_INSTRUCTION } = require('./projections/surfaces.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { mailPhase, topicTitles, itemName, topicKey, retiredRefusal } = require('./derivations.cjs');
const { unitInProgress, assertEnterable } = require('./topic-standing.cjs');

const HANDOFF_ENV = 'LEEWAY_HANDOFF';

/** Discovery's way in for a piece of work of no kind yet. */
const START = 'start';

/** The skill a quick-fix's work runs in, from its opener to its close (19.5.1). */
const QUICK_FIX_SKILL = 'leeway-quick-fix-process';

/**
 * The skill a phase runs in for a work type — the one a handoff into the
 * phase lands on: a quick-fix's implementation its own skill, every other
 * phase its own.
 * @param {string} phase @param {string} [type]
 */
function phaseSkill(phase, type) {
  return type === 'quick-fix' && phase === 'implementation' ? QUICK_FIX_SKILL : `leeway-${phase}-process`;
}

/**
 * Each skill some work type's pipeline enters by a handoff, with its phase
 * and the types it serves, in the pipelines' order.
 * @type {Map<string, {phase: string, served: string[]}>}
 */
const PHASE_SKILLS = new Map();
for (const type of VALID_WORK_TYPES) {
  for (const phase of WORK_TYPE_PIPELINES[/** @type {keyof typeof WORK_TYPE_PIPELINES} */ (type)]) {
    const skill = phaseSkill(phase, type);
    const held = PHASE_SKILLS.get(skill) ?? { phase, served: [] };
    PHASE_SKILLS.set(skill, { phase, served: [...held.served, type] });
  }
}

/**
 * One skill a handoff lands on.
 * @typedef {object} Target
 * @property {string} usage      its arguments, as a refusal names them
 * @property {number[]} counts   how many arguments it takes
 * @property {(cwd: string, args: string[]) => void} check  refuses an argument of the wrong shape
 * @property {(cwd: string, args: string[]) => string} where  where the work goes, named for the person
 * @property {number} [quoted]   the argument it reads quoted
 */

/**
 * A handoff, composed: the skill, its arguments as it is invoked with them,
 * the continuation that invokes it, and the line naming where the work goes.
 * @typedef {{skill: string, args: string, text: string, line: string}} Handoff
 */

/** @param {string} kind @param {string} value @param {readonly string[]} allowed */
function assertOneOf(kind, value, allowed) {
  if (allowed.includes(value)) return;
  const expected = allowed.length === 1 ? allowed[0] : `one of ${allowed.join('|')}`;
  throw new Error(`${kind} must be ${expected} — got "${value}"`);
}

/**
 * The manifest of a work unit the project holds — one that does not parse
 * refused as itself, never as a unit not found.
 * @param {string} cwd @param {string} name @returns {Record<string, any>}
 */
function workUnitManifest(cwd, name) {
  assertLegalName('work unit', name);
  if (!fs.existsSync(path.join(stateRoot(cwd), name, 'manifest.json'))) {
    throw new Error(`work unit "${name}" not found`);
  }
  return loadWorkUnitManifest(cwd, name);
}

/**
 * A work unit the project holds, of `type`, still in progress.
 * @param {string} cwd @param {string} name @param {string} type
 */
function assertWorkUnit(cwd, name, type) {
  const manifest = workUnitManifest(cwd, name);
  if (manifest.work_type !== type) {
    throw new Error(`work unit "${name}" is of type ${manifest.work_type}, not ${type}`);
  }
  if (manifest.status !== 'in-progress') {
    throw new Error(`work unit "${name}" is ${manifest.status} — a handoff moves into work in progress`);
  }
}

/**
 * Whether the unit is an epic finish completed, whose menu is its complete
 * variant (18.4.23).
 * @param {string} cwd @param {string} unit
 */
function finishedEpic(cwd, unit) {
  const manifest = workUnitManifest(cwd, unit);
  return manifest.work_type === 'epic' && manifest.status === 'completed';
}

/**
 * New work's seeds, comma-joined as discovery splits them: live inbox items,
 * every one on disk, and waiting roadmap items, `roadmap:{item}` — none
 * twice, none holding the quote discovery reads them inside.
 * @param {string} cwd @param {string} seeds
 */
/** A place, and the most specific name in it where there is one. @param {string} place @param {string|null} [name] */
function at(place, name = null) {
  return name === null ? place : `${place} · ${name}`;
}

/** The phase's row of the entry, where it has one. @param {string} phase */
function entryOf(phase) {
  // Required here: the entry's rows reach this module through the position.
  const { ENTRIES } = require('./enter.cjs');
  return ENTRIES[phase];
}

/**
 * Whether the phase is entered at the work unit, as its row of the entry
 * says (4.11.2).
 * @param {string} phase
 */
function enteredAtUnit(phase) {
  return entryOf(phase)?.level === 'unit';
}

/**
 * A phase's skill: a work type it serves, a work unit of that type, and,
 * where the phase is entered at a topic, the topic — a legal name, which need
 * not exist. An epic names its topic there; a single-topic unit's topic is
 * the unit itself. A unit entered at the unit names no topic.
 * @param {string} phase @param {string[]} served @returns {Target}
 */
function phaseTarget(phase, served) {
  return {
    get usage() { return `<${served.join('|')}> <work-unit>${enteredAtUnit(phase) ? '' : ' [<topic>]'}`; },
    get counts() { return enteredAtUnit(phase) ? [2] : [2, 3]; },
    check: (cwd, [type, unit, topic]) => {
      assertOneOf('the work type', type, served);
      if (type === 'epic' && topic === undefined && !enteredAtUnit(phase)) throw new Error(`an epic enters ${phase} at a topic`);
      assertWorkUnit(cwd, unit, type);
      if (topic === undefined) return;
      if (enteredAtUnit(phase)) throw new Error(`${unit} enters ${phase} at the work unit — name no topic`);
      assertLegalName('topic', topic);
    },
    where: (cwd, [, unit, topic]) => at(titlecase(phase), topic === undefined ? unit : itemName(topicTitles(loadWorkUnitManifest(cwd, unit)), phase, topic)),
  };
}

/** @type {Record<string, Target>} */
const TARGETS = {
  // No unit named is the product's conversation, where every start lands; an
  // epic named is its own discovery.
  'leeway-discovery': {
    usage: `<work-type|${START}|${NO_ARGUMENT}> <${NO_ARGUMENT}|epic> [<seeds|${NO_ARGUMENT}>]`,
    counts: [2, 3],
    quoted: 2,
    check: (cwd, [type, unit, seeds = NO_ARGUMENT]) => {
      assertOneOf('the work type', type, [...VALID_WORK_TYPES, START, NO_ARGUMENT]);
      if (unit !== NO_ARGUMENT) {
        assertOneOf('the work type into an existing epic', type, ['epic', NO_ARGUMENT]);
        assertWorkUnit(cwd, unit, 'epic');
      }
      if (seeds !== NO_ARGUMENT) assertSeeds(cwd, unit === NO_ARGUMENT ? PRODUCT : unit, seeds);
    },
    where: (_cwd, [, unit]) => at('Discovery', unit === NO_ARGUMENT ? null : unit),
  },
  leeway: {
    usage: '',
    counts: [0],
    check: () => {},
    where: () => at('Start'),
  },
  'leeway-roadmap': {
    usage: '',
    counts: [0],
    check: () => {},
    where: () => at('Roadmap'),
  },
  'leeway-continue-epic': {
    usage: '<epic>',
    counts: [1],
    check: (cwd, [unit]) => {
      if (!finishedEpic(cwd, unit)) assertWorkUnit(cwd, unit, 'epic');
    },
    where: (_cwd, [unit]) => at('Epic', unit),
  },
  ...Object.fromEntries([...PHASE_SKILLS].map(([skill, { phase, served }]) => [skill, phaseTarget(phase, served)])),
};

const HANDOFF_TARGETS = Object.keys(TARGETS);

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
    throw new Error(`Usage: engine handoff ${`${skill} ${target.usage}`.trimEnd()}`);
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
    text: `Invoke \`/${[skill, ...(composed === '' ? [] : [composed])].join(' ')}\`.`,
    line: `→ ${target.where(cwd, args)}`,
  };
}

const TOPIC_HANDOFF_USAGE = 'handoff topic <work-unit> <topic>';

/**
 * The handoff into a topic named by its unit and its key or title alone:
 * into the phase its topics are talked through — a bugfix's investigation,
 * else its discussion — refused where that phase's entry would refuse the
 * topic, or the unit has no topics to name, or is of a type the reshape
 * retires.
 * @param {string} cwd @param {string[]} args @returns {Handoff}
 */
function topicHandoff(cwd, args) {
  if (args.length !== 2) throw new Error(`Usage: engine ${TOPIC_HANDOFF_USAGE}`);
  const [unit, said] = args;
  const manifest = unitInProgress(cwd, unit);
  const retired = retiredRefusal(manifest);
  if (retired !== null) throw new Error(retired);
  const phase = mailPhase(manifest.work_type);
  if (phase === null) throw new Error(`${unit} is a ${manifest.work_type}, with no topics to open by name — it carries on from the start menu`);
  const topic = topicKey(manifest, said);
  assertEnterable(cwd, phase, manifest, topic);
  return resolveHandoff(cwd, phaseSkill(phase, manifest.work_type), [manifest.work_type, unit, topic]);
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
  const data = [`handoff: ${carried ? 'mod' : 'inline'}`, `skill: ${handoff.skill}`, `args: ${handoff.args}`];
  return [
    dataSection(data),
    section('DISPLAY: handoff', CONTINUE_INSTRUCTION, handoff.line),
    carried ? section('HANDOFF', GATE_MOD_INSTRUCTION, JSON.stringify(handoff)) : '',
  ].join('');
}

module.exports = { resolveHandoff, handoffSections, phaseSkill, QUICK_FIX_SKILL, HANDOFF_TARGETS, TOPIC_HANDOFF_USAGE, topicHandoff };
