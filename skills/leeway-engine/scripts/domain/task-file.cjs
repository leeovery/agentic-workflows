'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the task template (12.4.1), the text `task create` takes from
// a file (7.1.3) and the tracker holds whole. The title is the file's one
// level-one heading, first; each field is a level-two heading over its own
// text: the task's type, its problem, solution and outcome, its acceptance
// scenarios and its spec reference. The type is a conventional-commit kind,
// from which the landing names the task's branch and pull request. A file
// missing a field, holding one twice or empty, holding a heading the template
// lacks, typed outside the kinds, or titled over more than one line, is
// refused, every fault named at once. A title is one line wherever the
// engine takes one, a phase's too: no character that breaks a line anywhere
// in it, the task file's own line ending aside. A verb of another kind
// reads a task's spec reference from its text as the tracker holds it.
// ---------------------------------------------------------------------------

/** The kinds a task's type is one of. */
const TASK_TYPES = Object.freeze(['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'build', 'ci', 'chore']);

/** The template's fields, as their headings read. */
const FIELDS = Object.freeze(['Type', 'Problem', 'Solution', 'Outcome', 'Acceptance scenarios', 'Spec reference']);

/** Every character that breaks a line. */
const LINE_BREAK = /[\n\v\f\r\u0085\u2028\u2029]/;

/** @typedef {{title: string, type: string, text: string}} TaskText */

/** Whether a title is more than one line. @param {string} title */
function breaksLine(title) {
  return LINE_BREAK.test(title);
}

/**
 * The file's sections under its level-two headings, by heading, each with
 * every body written under that heading, trimmed.
 * @param {string[]} lines the lines after the title
 * @returns {Map<string, string[]>}
 */
function sectionsOf(lines) {
  /** @type {Map<string, string[][]>} */
  const bodies = new Map();
  /** @type {string[]|null} */
  let body = null;
  for (const line of lines) {
    const heading = /^## +(.+?)\s*$/.exec(line);
    if (heading === null) {
      body?.push(line);
      continue;
    }
    body = [];
    bodies.set(heading[1], [...(bodies.get(heading[1]) ?? []), body]);
  }
  return new Map([...bodies].map(([heading, held]) => [heading, held.map((written) => written.join('\n').trim())]));
}

/**
 * What is amiss in a task file's fields, each fault in words.
 * @param {Map<string, string[]>} sections
 * @returns {string[]}
 */
function faultsOf(sections) {
  const faults = [...sections.keys()].filter((heading) => !FIELDS.includes(heading)).map((heading) => `"${heading}" is not a field of the task template`);
  for (const field of FIELDS) {
    const bodies = sections.get(field) ?? [];
    if (bodies.length === 0) faults.push(`no ${field}`);
    else if (bodies.length > 1) faults.push(`${field} is written ${bodies.length} times`);
    else if (bodies[0] === '') faults.push(`${field} is empty`);
  }
  const type = sections.get('Type');
  if (type?.length === 1 && type[0] !== '' && !TASK_TYPES.includes(type[0])) {
    faults.push(`the type "${type[0]}" is not one of ${TASK_TYPES.join(', ')}`);
  }
  return faults;
}

/**
 * A task file's title, type and text, the text the file's whole, trimmed.
 * Refuses a file the template does not hold, naming every fault.
 * @param {string} text
 * @returns {TaskText}
 */
function readTaskText(text) {
  const lines = text.trim().split('\n');
  const title = /^# +([^ \t][\s\S]*?)[ \t]*\r?$/.exec(lines[0])?.[1];
  const sections = sectionsOf(lines.slice(1));
  const faults = [
    ...(title === undefined ? ['no title: the file opens with its "# " heading'] : []),
    ...(title !== undefined && breaksLine(title) ? ['the title breaks its line — a title is one line'] : []),
    ...faultsOf(sections),
  ];
  if (faults.length > 0) throw new Error(`the task file does not hold the task template — ${faults.join('; ')}`);
  return { title: /** @type {string} */ (title), type: /** @type {string[]} */ (sections.get('Type'))[0], text: text.trim() };
}

/**
 * The spec reference a task's text holds, as written; null where it holds
 * none, or more than one.
 * @param {string} text @returns {string|null}
 */
function specReferenceOf(text) {
  const bodies = sectionsOf(text.trim().split('\n').slice(1)).get('Spec reference') ?? [];
  return bodies.length === 1 && bodies[0] !== '' ? bodies[0] : null;
}

module.exports = { TASK_TYPES, breaksLine, readTaskText, specReferenceOf };
