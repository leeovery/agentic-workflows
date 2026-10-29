'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a brief filled and issued (6.5) — `brief <role> [<unit>
// <task>]`, the only way the workflows hand one of their own agents its
// brief (6.5.1). Each role names its template, the agent it is dispatched
// as, and the records its brief draws on (6.5.4, 6.5.11); a role whose
// records include a task's takes the unit and the task, any other takes
// neither, and no role takes a flag, so no free text reaches a brief
// (6.5.6).
//
// A template is markdown in the engine's content (`content/briefs/{role}.md`,
// 6.5.2): the template's own words, and a slot, `{{record}}` alone on its
// line, for each record its role draws on, filled by that record's drawn
// form (brief-records.cjs). A template holding a slot that is no whole line,
// a slot no record answers, one its role does not draw on, or a record's
// slot missing or twice, is refused before anything is read.
//
// The filled brief is stored in the calling conversation's folder,
// `briefs/{id}.md`, its id a new one (`newId`), written whole by a link to
// a file written beside it, so it is never seen half written and never
// written over another; it goes with the folder (conversation.cjs). Its
// first line names it, `Brief {id} — the builder's, for {unit} task {N.M}`.
// The dispatch carries the brief's pointer, `brief:{id}`, alone, and the
// hook before Agent and SendMessage hands the agent the stored brief.
//
// It refuses no session id, a role it does not know, arguments of another
// shape, a unit or a task the project lacks, a task done or closed, and a
// record it cannot read. It runs under the writer lock: reading the task
// may commit the tracker's set-up (task-verbs.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { handedSession } = require('../kernel/process.cjs');
const { conversationDir } = require('./conversation.cjs');
const { newId } = require('./ledger-ids.cjs');
const { carrying } = require('./ledger.cjs');
const { trackedTask, ENDED } = require('./task-verbs.cjs');
const { parseShownTask, shownTask, taskName } = require('./task-id.cjs');
const { RECORDS } = require('./brief-records.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('./brief-records.cjs').Filling} Filling */

// The install moves the skills under `.claude/skills/`, so the content is
// resolved from this module rather than from the project root.
const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'content', 'briefs');

/** The folder of a conversation's briefs. */
const BRIEFS = 'briefs';

/** What a dispatch carries in place of its brief, before the brief's id. */
const POINTER = 'brief:';

/** A slot, `{{record}}`. */
const SLOT = /\{\{([^{}]*)\}\}/g;

/**
 * Each role: the agent it is dispatched as, whose brief its first line says
 * it is, and the records its brief draws on, by their slots.
 * @type {Readonly<Record<string, {agent: string, whose: string, records: readonly string[]}>>}
 */
const ROLES = Object.freeze({
  builder: { agent: 'leeway-builder', whose: 'the builder\'s', records: ['task', 'spec-sections', 'decided-calls', 'linters'] },
  'product-researcher': { agent: 'leeway-product-researcher', whose: 'the product researcher\'s', records: [] },
});

/** Whether a role's brief is filled for a task. @param {string} role */
function takesTask(role) {
  return ROLES[role].records.some((record) => RECORDS[record].ofTask);
}

/** The verb's usage, a line per role. */
const BRIEF_USAGE = Object.keys(ROLES).map((role) => `brief ${role}${takesTask(role) ? ' <unit> <task>' : ''}`).join('\n');

/** @returns {never} */
function usage() {
  throw new Error(`Usage: ${BRIEF_USAGE.split('\n').map((line) => `engine ${line}`).join(' | ')}`);
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

/** Where a conversation keeps a brief. @param {string} session @param {string} id */
function briefPath(session, id) {
  return path.join(conversationDir(session), BRIEFS, `${id}.md`);
}

/** The pointer a dispatch carries for a brief. @param {string} id */
function pointerOf(id) {
  return `${POINTER}${id}`;
}

/**
 * A brief stored whole at `file`: written beside it, then linked in place,
 * which refuses a file already there.
 * @param {string} file @param {string} text
 */
function storeBrief(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const written = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(written, text);
  try {
    fs.linkSync(written, file);
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'EEXIST') throw new Error(`brief: a brief is stored at ${file} already`);
    throw err;
  } finally {
    fs.rmSync(written, { force: true });
  }
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
 * `brief <role> [<unit> <task>]`: the role's brief filled from its records
 * and stored in the calling conversation's folder. Answers its id, its
 * role, the agent it is dispatched as and the pointer the dispatch carries;
 * where reading the task committed the tracker's set-up, that commit, and
 * what any read warned of.
 * @param {string} cwd @param {string[]} args
 */
function issueBrief(cwd, [role, ...rest]) {
  if (role === undefined || !Object.hasOwn(ROLES, role)) usage();
  const flag = rest.find((arg) => arg.startsWith('--'));
  if (flag !== undefined) throw new Error(`brief: the ${role}'s brief takes no ${flag} — a brief draws on its records alone`);
  if (rest.length !== (takesTask(role) ? 2 : 0)) usage();
  const ref = rest.length === 2 ? parseShownTask(rest[0], rest[1]) : null;
  const session = handedSession();
  if (session === null) throw new Error('brief: no conversation to issue it in — Claude Code hands every command it runs a session id, and this one has none');
  const { agent, whose, records } = ROLES[role];
  const template = templateOf(role, fs.readFileSync(path.join(TEMPLATES_DIR, `${role}.md`), 'utf8'));
  /** @type {string[]} */
  const warnings = [];
  try {
    const { task, committed } = ref === null ? { task: null, committed: undefined } : unendedTask(cwd, ref, warnings);
    /** @type {Filling} */
    const filling = { cwd, ref, task };
    const drawn = Object.fromEntries(records.map((record) => [record, RECORDS[record].draw(filling, warnings)]));
    const id = newId();
    const named = `Brief ${id} — ${whose}${ref === null ? '' : `, for ${ref.unit} task ${shownTask(ref)}`}`;
    storeBrief(briefPath(session, id), `${named}\n\n${filled(template, drawn)}`);
    return { id, role, agent, pointer: pointerOf(id), ...(committed === undefined ? {} : { committed }), ...(warnings.length > 0 ? { warnings } : {}) };
  } catch (err) {
    throw carrying(err, warnings);
  }
}

module.exports = { ROLES, BRIEFS, BRIEF_USAGE, issueBrief, templateOf, storeBrief, briefPath, pointerOf };
