'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a brief filled and issued (6.5) — `brief <role> [<unit>
// <task>|<unit> <topic>] [--{flag} <value> …]`, the only way the workflows
// hand one of their own agents its brief (6.5.1). Each role names its
// template, the agent it is dispatched as — the fix round's, the builder it
// is sent to — and the records its brief draws on (6.5.4, 6.5.11,
// brief-names.cjs); a role whose records include a task's takes the unit
// and the task, one whose records include a topic's takes the unit and the
// topic, any other neither. A role takes each flag its records name, every
// one of them but a flag a record holds optional, once, and no other:
// `--base <branch>`, `--report-a <path>`, `--question <id>`, `--agent
// <id>`, `--kind <kind>`, a read dive's `--path <file>`, the migration's
// `--directive <id>` and `--topic <unit.phase.topic>`; a flag carries a
// name, an id or a path, so no free text reaches a brief (6.5.6).
//
// A template is markdown in the engine's content (`content/briefs/{role}.md`,
// 6.5.2): the template's own words, and a slot, `{{record}}` alone on its
// line, for each record its role draws on, filled by that record's drawn
// form (brief-records.cjs). A template holding a slot that is no whole line,
// a slot no record answers, one its role does not draw on, or a record's
// slot missing or twice, is refused before anything is read.
//
// The filled brief is stored in the calling conversation's folder,
// `briefs/{id}.md`, its id a new one (`newId`), exactly what the agent is
// handed; beside it `briefs/{id}.json` says whose it is, `{role, agent,
// unit, task, topic}`, each of the unit, the task and the topic null where
// the role takes none. Each is written whole by a link to a file written
// beside it, so it is never seen half written and never written over
// another, the record first, so a brief always has its record; both go with
// the folder (conversation.cjs). The brief's first line names it, `Brief
// {id} — the builder's, for {unit} task {N.M}`, or `… for {unit} topic
// {topic}`.
// The dispatch carries the brief's pointer, `brief:{id}`, alone, and the
// hook before Agent and SendMessage hands the agent the stored brief
// (brief-guard.cjs).
//
// It refuses no session id, a role it does not know, arguments of another
// shape, a unit, a task or a topic the project lacks, a task done or
// closed, a topic set aside (5.8.17), and a record it cannot read. Once
// every record is drawn, what a record binds is bound — the dispatch a
// question's brief is for, to that question (brief-records.cjs) — before
// the brief is stored. It runs under the writer lock: reading the task may
// commit the tracker's set-up (task-verbs.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { handedSession } = require('../kernel/process.cjs');
const { newId } = require('./ledger-ids.cjs');
const { carrying } = require('./ledger.cjs');
const { trackedTask, ENDED } = require('./task-verbs.cjs');
const { parseShownTask, shownTask, taskName } = require('./task-id.cjs');
const { RECORDS } = require('./brief-records.cjs');
const { ROLES, briefPath, issuedPath, pointerOf } = require('./brief-names.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { hasTopic, manifestOf, liveness } = require('./ledger-units.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('./brief-records.cjs').Filling} Filling */
/** @typedef {import('./brief-records.cjs').TopicPlace} TopicPlace */
/** @typedef {import('./brief-records.cjs').BriefFlag} BriefFlag */
/** @typedef {import('./brief-names.cjs').Issued} Issued */

// The install moves the skills under `.claude/skills/`, so the content is
// resolved from this module rather than from the project root.
const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'content', 'briefs');

/** A slot, `{{record}}`. */
const SLOT = /\{\{([^{}]*)\}\}/g;

/**
 * What a role's brief is filled for: a task, a topic, or neither, as its
 * records are.
 * @param {string} role @returns {'task'|'topic'|null}
 */
function placeOfRole(role) {
  const places = ROLES[role].records.map((record) => RECORDS[record].of);
  return places.find((place) => place !== null) ?? null;
}

/** The flags a role takes, each its records name, once. @param {string} role @returns {BriefFlag[]} */
function flagsOf(role) {
  /** @type {Map<string, BriefFlag>} */
  const flags = new Map();
  for (const record of ROLES[role].records) {
    for (const flag of RECORDS[record].flags ?? []) if (!flags.has(flag.name)) flags.set(flag.name, flag);
  }
  return [...flags.values()];
}

/** The verb's usage, a line per role. */
const BRIEF_USAGE = Object.keys(ROLES).map((role) => {
  const place = placeOfRole(role);
  return [`brief ${role}`, ...(place === null ? [] : [`<unit> <${place}>`]), ...flagsOf(role).map(({ name, value, optional }) => (optional ? `[--${name} <${value}>]` : `--${name} <${value}>`))].join(' ');
}).join('\n');

/** @returns {never} */
function usage() {
  throw new Error(`Usage: ${BRIEF_USAGE.split('\n').map((line) => `engine ${line}`).join(' | ')}`);
}

/**
 * The name of the flag `arg` gives, refused where its role does not take it
 * or its value is joined to it by `=`.
 * @param {string} role @param {string} arg `--{name}`
 */
function flagNamed(role, arg) {
  const [name, joined] = arg.slice(2).split(/=(.*)/s);
  const flag = flagsOf(role).find((taken) => taken.name === name);
  if (flag === undefined) throw new Error(`brief: the ${role}'s brief takes no --${name} — a brief draws on its records alone`);
  if (joined !== undefined) throw new Error(`brief: --${name} takes its value after a space, \`--${name} <${flag.value}>\``);
  return name;
}

/**
 * A role's arguments: its unit and its task or topic, where it takes them,
 * and each flag it takes, given once with its value. A flag it does not
 * take is refused as such, any other shape by the usage.
 * @param {string} role @param {string[]} args
 * @returns {{ref: TaskRef|null, place: TopicPlace|null, given: Record<string, string>}}
 */
function argumentsOf(role, args) {
  const required = flagsOf(role).filter(({ optional }) => !optional).map(({ name }) => name);
  const of = placeOfRole(role);
  /** @type {string[]} */
  const positional = [];
  /** @type {Record<string, string>} */
  const given = {};
  for (let at = 0; at < args.length; at += 1) {
    if (!args[at].startsWith('--')) {
      positional.push(args[at]);
      continue;
    }
    const name = flagNamed(role, args[at]);
    const value = args[at + 1];
    if (value === undefined || value.startsWith('--') || Object.hasOwn(given, name)) usage();
    given[name] = value;
    at += 1;
  }
  if (positional.length !== (of === null ? 0 : 2) || required.some((name) => !Object.hasOwn(given, name))) usage();
  const [unit, named] = positional;
  return {
    ref: of === 'task' ? parseShownTask(unit, named) : null,
    place: of === 'topic' ? { unit, topic: named } : null,
    given,
  };
}

/**
 * The topic a brief is filled for, refused where the project lacks its unit
 * or the unit lacks it, or it is set aside (5.8.17).
 * @param {string} cwd @param {TopicPlace} place
 */
function liveTopic(cwd, { unit, topic }) {
  const root = stateRoot(cwd);
  const manifest = manifestOf(root, unit);
  if (manifest === null) throw new Error(`Work unit "${unit}" not found`);
  if (!hasTopic(manifest, topic)) throw new Error(`brief: ${unit} has no topic "${topic}"`);
  const dead = liveness(root)(unit, topic);
  if (dead !== null) throw new Error(`brief: ${unit}/${topic} is set aside — ${dead}`);
}

/**
 * A role's template from its text, refused where it does not hold one slot,
 * alone on its line, for each record its role draws on and none other.
 * @param {string} role @param {string} text @returns {string}
 */
function templateOf(role, text) {
  const { records } = ROLES[role];
  /** @type {string[]} */
  const faults = [];
  /** @type {string[]} */
  const slots = [];
  for (const line of text.split('\n')) {
    const found = [...line.matchAll(SLOT)].map((match) => match[1]);
    if (found.length === 0) continue;
    if (found.length > 1 || line !== `{{${found[0]}}}`) faults.push(`"${line}" holds a slot that is not alone on its line`);
    for (const slot of found) {
      if (!Object.hasOwn(RECORDS, slot)) faults.push(`{{${slot}}} is no record`);
      else if (!records.includes(slot)) faults.push(`the ${role}'s brief draws on no ${slot}`);
      slots.push(slot);
    }
  }
  for (const record of records) {
    const count = slots.filter((slot) => slot === record).length;
    if (count !== 1) faults.push(count === 0 ? `no slot for ${record}` : `${record}'s slot is there ${count} times`);
  }
  if (faults.length > 0) throw new Error(`brief: the ${role}'s template is refused — ${faults.join('; ')}`);
  return text;
}

/** A template's slots filled with what each record drew. @param {string} template @param {Record<string, string>} drawn */
function filled(template, drawn) {
  return template.split('\n').map((line) => {
    const slot = /^\{\{([^{}]*)\}\}$/.exec(line);
    return slot === null ? line : drawn[slot[1]];
  }).join('\n');
}

/**
 * `text` stored whole at `file`: written beside it, then linked in place,
 * which refuses a file already there.
 * @param {string} file @param {string} text
 */
function linkWhole(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const written = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(written, text);
  try {
    fs.linkSync(written, file);
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'EEXIST') throw new Error(`brief: ${file} is stored already`);
    throw err;
  } finally {
    fs.rmSync(written, { force: true });
  }
}

/**
 * A brief stored in a conversation's folder under its id: the record of
 * whose it is, then the brief.
 * @param {string} session @param {string} id @param {string} text @param {Issued} issued
 */
function storeBrief(session, id, text, issued) {
  linkWhole(issuedPath(session, id), JSON.stringify(issued) + '\n');
  linkWhole(briefPath(session, id), text);
}

/** What a brief's first line says it is for: its task, its topic, or nothing. @param {TaskRef|null} ref @param {TopicPlace|null} place */
function forWhat(ref, place) {
  if (ref !== null) return `, for ${ref.unit} task ${shownTask(ref)}`;
  return place === null ? '' : `, for ${place.unit} topic ${place.topic}`;
}

/**
 * The task as the tracker holds it, and what its read committed, refused
 * where it is done or closed; what the read warned of pushed to `warnings`.
 * @param {string} cwd @param {TaskRef} ref @param {string[]} warnings
 */
function unendedTask(cwd, ref, warnings) {
  const { committed, warnings: read = [], ...task } = trackedTask(cwd, ref);
  warnings.push(...read);
  if (ENDED.includes(task.status)) throw new Error(`brief: ${taskName(ref)} is ${task.status} — a brief is issued for a task not yet ended`);
  return { task, committed };
}

/**
 * `brief <role> [<unit> <task>|<unit> <topic>]`: the role's brief filled from its records
 * and stored in the calling conversation's folder. Answers its id, its
 * role, the agent it is dispatched as and the pointer the dispatch carries;
 * where reading the task committed the tracker's set-up, that commit, and
 * what any read warned of.
 * @param {string} cwd @param {string[]} args
 */
function issueBrief(cwd, [role, ...rest]) {
  if (role === undefined || !Object.hasOwn(ROLES, role)) usage();
  const { ref, place, given } = argumentsOf(role, rest);
  const session = handedSession();
  if (session === null) throw new Error('brief: no conversation to issue it in — Claude Code hands every command it runs a session id, and this one has none');
  const { agent, whose, records } = ROLES[role];
  const template = templateOf(role, fs.readFileSync(path.join(TEMPLATES_DIR, `${role}.md`), 'utf8'));
  /** @type {string[]} */
  const warnings = [];
  try {
    if (place !== null) liveTopic(cwd, place);
    const { task, committed } = ref === null ? { task: null, committed: undefined } : unendedTask(cwd, ref, warnings);
    /** @type {Filling} */
    const filling = { cwd, role, ref, task, place, given, session };
    const drawn = Object.fromEntries(records.map((record) => [record, RECORDS[record].draw(filling, warnings)]));
    for (const record of records) RECORDS[record].bind?.(filling, warnings);
    const id = newId();
    storeBrief(session, id, `Brief ${id} — ${whose}${forWhat(ref, place)}\n\n${filled(template, drawn)}`, {
      role, agent, unit: ref?.unit ?? place?.unit ?? null, task: ref === null ? null : shownTask(ref), topic: place === null ? null : place.topic,
    });
    return { id, role, agent, pointer: pointerOf(id), ...(committed === undefined ? {} : { committed }), ...(warnings.length > 0 ? { warnings } : {}) };
  } catch (err) {
    throw carrying(err, warnings);
  }
}

module.exports = { BRIEF_USAGE, issueBrief, templateOf, storeBrief };
