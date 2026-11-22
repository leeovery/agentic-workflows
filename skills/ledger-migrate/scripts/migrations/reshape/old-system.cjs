'use strict';

//
// The files the old system wrote for itself, which the move (078) gives no
// place as legacy, and the migration audit reads back. Released with the
// move, it is frozen with it.
//
// Its agents' and trackers' files (`oldSystemFile`): those it wrote in a
// unit's topic folders of the old plan's phases, each known by its whole
// path below the topic's folder as the old skills write it — a topic's, a
// task's or a section's slug never makes one of these: the spec reviews'
// tracking; the plan, its phases' and tasks' files — one at the plan's top,
// named for its topic, where 007 found a tasks/ folder already and moved
// none — and its reviews' tracking, an older review's under review/; the
// build's tracking, analysis, staging, consolidation and fix tracking; and
// the review's reports and change-set checks. The move copies each into its
// unit's cache, beside the old cache's reports.
//
// Its environment setup file (`ENVIRONMENT_SETUP`), which held, in free
// text, how the project's environment is set up on a new machine. Its
// words, but for the old template's own leading `# Environment Setup`
// heading, are one step of the environment's `prepare`, a note no command
// does, `From before Ledger`, before the build's first task (`setupNote`):
// never run, and the setup never confirmed, so the first ready to build
// draws it on the setup's screen, where Claude reshapes it with what the
// repository shows and the person says yes (22.5.3). The words are carried
// as they stand, never judged. A file holding nothing more, or only the old
// skill's own sentence for no setup, carries nothing;
// the environment's other steps are kept, and a step of that name already
// there stands as it is (`withSetupNote`). The file itself is kept nowhere:
// git's history holds it.
//

/** @type {Readonly<Record<string, RegExp>>} */
const WRITTEN = {
  specification: /^review-(?:input|gap(?:-analysis)?|claims)-tracking-c[0-9]+\.md$/,
  planning: /^(?:planning|phase-[0-9]+-tasks|tasks\/[A-Za-z0-9-]+-[0-9]+-[0-9]+[a-z]*|review-(?:traceability|integrity)-tracking-c[0-9]+|review\/(?:traceability|integrity)-c[0-9]+)\.md$/,
  implementation: /^(?:implementation|analysis-(?:standards|duplication|architecture|tasks|report)-c[0-9]+|review-(?:tasks|report)-c[0-9]+|consolidation-(?:findings|tasks)-p[0-9]+|ad-hoc-tasks-[0-9]+|fix-tracking-[A-Za-z0-9-]+-[0-9]+-[0-9]+[a-z]*)\.md$/,
  review: /^(?:report(?:(?:-[a-z]+)?-[0-9]+-[0-9]+[a-z]*)?|change-set-c[0-9]+-[a-z0-9-]+)\.md$/,
};
// The old plan's phases, whose topic folders the old system wrote in.
const OLD_PLAN_PHASES = Object.freeze(Object.keys(WRITTEN));
// A plan's task file at the plan's top, after its topic's name.
const UNMOVED_TASK = /^-[0-9]+-[0-9]+[a-z]*\.md$/;

const ENVIRONMENT_SETUP = '.state/environment-setup.md';
const STEP_NAME = 'From before Ledger';
const TEMPLATE_HEADING = /^#[ \t]+Environment Setup[ \t]*(?:\r?\n|$)/;
// The old skill's own words for a project needing no setup.
const NO_SETUP = 'No special setup required.';

/** @param {unknown} v @returns {v is Record<string, any>} */
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Whether a unit's file, by its path below the unit's old folder, is one
 * the old system's agents or trackers wrote (the header's).
 * @param {string} rel
 */
function oldSystemFile(rel) {
  const [phase, topic, ...inside] = rel.split('/');
  if (!Object.hasOwn(WRITTEN, phase) || inside.length === 0) return false;
  const below = inside.join('/');
  return WRITTEN[phase].test(below) || (phase === 'planning' && below.startsWith(topic) && UNMOVED_TASK.test(below.slice(topic.length)));
}

/**
 * The note step the environment setup file's words make, or null where it
 * holds none but the template's heading and the old skill's sentence for no
 * setup.
 * @param {string} text @returns {{name: string, when: 'first', note: string}|null}
 */
function setupNote(text) {
  const note = text.replace(TEMPLATE_HEADING, '').replace(/^(?:[ \t]*\r?\n)+/, '').trimEnd();
  return note === '' || note === NO_SETUP ? null : { name: STEP_NAME, when: 'first', note };
}

/**
 * The project manifest with the environment setup file's note among its
 * environment's steps, after those it holds (the header's); the manifest as
 * it is where the file makes none.
 * @param {Record<string, any>} project @param {string|null} text the file's words, null where there is none
 * @returns {Record<string, any>}
 */
function withSetupNote(project, text) {
  const step = text === null ? null : setupNote(text);
  if (step === null) return project;
  const environment = isObject(project.environment) ? project.environment : {};
  const prepare = Array.isArray(environment.prepare) ? environment.prepare : [];
  if (prepare.some((held) => isObject(held) && held.name === STEP_NAME)) return project;
  return { ...project, environment: { ...environment, prepare: [...prepare, step] } };
}

module.exports = { OLD_PLAN_PHASES, oldSystemFile, ENVIRONMENT_SETUP, setupNote, withSetupNote };
