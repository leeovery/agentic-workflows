'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the records a brief is filled from (6.5.4, 13.11.2), each
// drawn in one fixed form, so what an agent is told is what the records
// say and nothing else (6.5.6):
//
//   task           the task's text whole, as the tracker holds it, each of
//                  its headings a level down, under the template's own; then
//                  each addition, in order, under a heading of its own saying
//                  whether the orchestrator or the person added it (13.11.3)
//   spec-sections  each section the task's spec reference cites, verbatim
//                  from the unit's spec (spec-sections.cjs)
//   decided-calls  the unit's current decisions at its own level, the
//                  person's and Claude's alike, in the ledger's order, each
//                  one list item: its id, whose it is, its answer and why,
//                  every line after its first indented
//   linters        the project's linters, each its name and its command,
//                  from the environment on the project manifest (22.5.12)
//
// A record the project holds none of yet is drawn as none recorded. One that
// cannot be read refuses the brief: a task with no spec reference, a
// section the spec lacks, linters of another shape. Nothing else of the
// project reaches a brief — its CLAUDE.md and its skills reach the agent
// without it (6.5.5).
// ---------------------------------------------------------------------------

const { stateRoot } = require('../kernel/state-root.cjs');
const { readProjectManifest } = require('../kernel/manifest.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { readShown } = require('./ledger-read.cjs');
const { recordOf, standingOf } = require('./ledger-fold.cjs');
const { readCitedSections, headingLevels } = require('./spec-sections.cjs');
const { specReferenceOf } = require('./task-file.cjs');
const { taskName } = require('./task-id.cjs');

/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */

/**
 * What a brief is filled for: the project, and the task where its role
 * takes one, as the tracker holds it.
 * @typedef {{cwd: string, ref: TaskRef|null, task: TaskDetail|null}} Filling
 */

/**
 * A record: whether it is a task's, and its drawn form; what a read said on
 * the way pushed to `warnings`.
 * @typedef {{ofTask: boolean, draw: (filling: Filling, warnings: string[]) => string}} BriefRecord
 */

const NONE = 'None recorded.';

/** Whose an entry is, as a brief says it. @type {Readonly<Record<string, string>>} */
const WHOSE = Object.freeze({ person: 'the person\'s', claude: 'Claude\'s' });

/** A drawn list, a line an item, or none recorded. @param {string[]} items */
function listed(items) {
  return items.length === 0 ? NONE : items.join('\n');
}

/** The task, and the ref it was read by, for a record that is a task's. @param {Filling} filling */
function taskOf({ ref, task }) {
  if (ref === null || task === null) throw new Error('brief-records: a task\'s record is drawn for a task');
  return { ref, task };
}

/** Markdown with each heading a level down, a fenced block's lines aside. @param {string} text */
function headingsDown(text) {
  const lines = text.split('\n');
  const levels = headingLevels(lines);
  return lines.map((line, at) => (levels[at] > 0 ? `#${line}` : line)).join('\n');
}

/** Text whose every line after its first is indented, to stay in a list item. @param {string} text */
const indented = (text) => text.split('\n').join('\n  ');

/** @param {Filling} filling */
function drawTask(filling) {
  const { task } = taskOf(filling);
  return [headingsDown(task.text), ...task.additions.map(({ by, text }) => `## Added by the ${by}\n\n${text}`)].join('\n\n');
}

/** @param {Filling} filling */
function drawSpecSections(filling) {
  const { ref, task } = taskOf(filling);
  const reference = specReferenceOf(task.text);
  if (reference === null) throw new Error(`${taskName(ref)} holds no spec reference`);
  return readCitedSections(filling.cwd, ref.unit, reference).map((section) => section.text).join('\n\n');
}

/** @param {Filling} filling @param {string[]} warnings */
function drawDecidedCalls(filling, warnings) {
  const { ref } = taskOf(filling);
  return readShown(stateRoot(filling.cwd), warnings, ({ folded, show }) => listed(
    recordOf(folded, ref.unit, null).decisions
      .filter((id) => standingOf(folded, id).topic === null)
      .map((id) => {
        const { id: short, by, text, why } = show(id);
        return `- ${short}, ${WHOSE[/** @type {string} */ (by)]}: ${indented(String(text))}\n  Why: ${indented(String(why))}`;
      }),
  ));
}

/** Whether a value is text with something in it. @param {unknown} value */
const filled = (value) => typeof value === 'string' && value.trim() !== '';

/** @param {Filling} filling */
function drawLinters({ cwd }) {
  const { environment } = readProjectManifest(cwd);
  if (environment === undefined) return NONE;
  const linters = isObject(environment) ? environment.linters : null;
  if (linters === undefined) return NONE;
  if (!Array.isArray(linters) || !linters.every((linter) => isObject(linter) && filled(linter.name) && filled(linter.command))) {
    throw new Error('the project manifest\'s environment.linters is not a list of {name, command}');
  }
  return listed(linters.map(({ name, command }) => `- ${name}: ${command}`));
}

/** Every record, by the slot that draws it. @type {Readonly<Record<string, BriefRecord>>} */
const RECORDS = Object.freeze({
  task: { ofTask: true, draw: drawTask },
  'spec-sections': { ofTask: true, draw: drawSpecSections },
  'decided-calls': { ofTask: true, draw: drawDecidedCalls },
  linters: { ofTask: false, draw: drawLinters },
});

module.exports = { RECORDS };
