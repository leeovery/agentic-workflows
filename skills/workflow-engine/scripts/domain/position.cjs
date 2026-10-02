'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the conversation's position — where in the workflows a
// conversation is working, kept as `position.json` in its folder
// (conversation.cjs) for whatever carries the conversation on: the tmux
// label's resume (session-label.cjs), and `conversation position`, which
// names what to re-read to carry on there.
//
// Every place records itself on arrival, through the calls that label it,
// labels on or off: `session label {wu} {phase} {topic}` inside a phase,
// `session label {wu}` at a work unit's menu, `session label roadmap|baseline`
// at the project-level places. Inside implementation, `task start` adds the
// task in flight and that task's `task complete` takes it off; a re-label
// of the same implementation keeps it, and any other place leaves none. The
// start menu is no position: `session repair` drops the calling
// conversation's own.
//
// The engine is the file's one writer. It writes only for a conversation it
// has marked, never creating the folder, and only a place this project has;
// a position that cannot be written costs the verb nothing.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { PROJECT_IDENTITIES, VALID_PHASES, EXPERIMENT_TERMINAL_STATUSES, illegalNameReason } = require('../kernel/manifest-schema.cjs');
const { isObject, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { conversationDir, isMarked } = require('./conversation.cjs');
const { loadManifest, loadProjectManifest } = require('./reads.cjs');
const { recordDir } = require('./experiment.cjs');
const { section, dataSection } = require('./projections/surfaces.cjs');

const FILE = 'position.json';

const POSITION_INSTRUCTION = 'json for the gate mod — never display';

/**
 * @typedef {object} Position
 * @property {string} name   a work unit, or a project identity
 * @property {string} [phase]
 * @property {string} [topic]
 * @property {string} [task] the implementation task in flight, `{phase}.{task}`
 */

/** @param {string} sessionId */
function positionPath(sessionId) {
  return path.join(conversationDir(sessionId), FILE);
}

/**
 * The position recorded for the conversation `sessionId`; null where none
 * is, or it does not read as one.
 * @param {string} sessionId @returns {Position|null}
 */
function readPosition(sessionId) {
  try {
    const parsed = JSON.parse(fs.readFileSync(positionPath(sessionId), 'utf8'));
    if (isObject(parsed) && typeof parsed.name === 'string') return /** @type {Position} */ (parsed);
  } catch { /* none recorded, or unreadable */ }
  return null;
}

/** The calling conversation where the engine has marked it, else null. @returns {string|null} */
function ownConversation() {
  const sessionId = process.env.CLAUDE_CODE_SESSION_ID;
  return sessionId && isMarked(sessionId) ? sessionId : null;
}

/** @param {string} sessionId @param {Position} position */
function writePosition(sessionId, position) {
  try { writeJsonAtomic(positionPath(sessionId), position); } catch { /* a courtesy, never a failure */ }
}

/** @param {string} cwd @param {string} name */
function isWorkUnit(cwd, name) {
  return illegalNameReason('work unit', name) === null && fs.existsSync(path.join(cwd, '.workflows', name));
}

/**
 * Whether the arguments name a place this project has: a work unit, a
 * phase and legal topic in one, or a project identity, which has no phase.
 * @param {string} cwd @param {string} name @param {string} [phase] @param {string} [topic]
 */
function isPlace(cwd, name, phase, topic) {
  if (phase === undefined) return PROJECT_IDENTITIES.includes(name) || isWorkUnit(cwd, name);
  return VALID_PHASES.includes(phase) && typeof topic === 'string' && illegalNameReason('topic', topic) === null
    && isWorkUnit(cwd, name);
}

/** @param {Position|null} a @param {Position} b */
function samePlace(a, b) {
  return a !== null && a.name === b.name && a.phase === b.phase && a.topic === b.topic;
}

/** The plan step an internal id ends in, `{phase}.{task}`. @param {string} internalId @returns {string|null} */
function taskStep(internalId) {
  const m = /-(\d+)-(\d+)$/.exec(internalId);
  return m ? `${m[1]}.${m[2]}` : null;
}

/**
 * Record the calling conversation's arrival at a place.
 * @param {string} cwd @param {string} name @param {string} [phase] @param {string} [topic]
 */
function recordPosition(cwd, name, phase, topic) {
  const own = ownConversation();
  if (!own || !isPlace(cwd, name, phase, topic)) return;
  /** @type {Position} */
  const position = phase === undefined ? { name } : { name, phase, topic };
  const prior = readPosition(own);
  if (phase === 'implementation' && samePlace(prior, position) && prior?.task) position.task = prior.task;
  writePosition(own, position);
}

/**
 * Record the task `task start` put in flight.
 * @param {string} cwd @param {string} workUnit @param {string} topic @param {string} internalId
 */
function recordTask(cwd, workUnit, topic, internalId) {
  const own = ownConversation();
  const step = taskStep(internalId);
  if (!own || step === null || !isPlace(cwd, workUnit, 'implementation', topic)) return;
  writePosition(own, { name: workUnit, phase: 'implementation', topic, task: step });
}

/**
 * Take a completed task off the position — only the one it names, in that
 * topic's implementation.
 * @param {string} workUnit @param {string} topic @param {string} internalId
 */
function clearTask(workUnit, topic, internalId) {
  const own = ownConversation();
  if (!own) return;
  /** @type {Position} */
  const place = { name: workUnit, phase: 'implementation', topic };
  const prior = readPosition(own);
  if (!samePlace(prior, place) || prior?.task !== taskStep(internalId)) return;
  writePosition(own, place);
}

/** @param {string|null|undefined} sessionId */
function dropPosition(sessionId) {
  if (!sessionId) return;
  try { fs.unlinkSync(positionPath(sessionId)); } catch { /* none recorded */ }
}

// ---------------------------------------------------------------------------
// What a conversation re-reads to carry on from its position: the skill that
// runs the work there, then the topic's documents. A work unit's menu runs
// no work, so it names neither.
// ---------------------------------------------------------------------------

/** @param {string} skill */
const skillFile = (skill) => `.claude/skills/${skill}/SKILL.md`;

/**
 * The session log a place's session writes: the open one the marker names,
 * else the latest on disk.
 * @param {string} cwd @param {string} dir project-relative @param {unknown} active
 * @returns {string[]}
 */
function sessionLog(cwd, dir, active) {
  if (typeof active === 'string' && /^\d+$/.test(active)) return [`${dir}/session-${active}.md`];
  /** @type {string[]} */
  let names = [];
  try { names = fs.readdirSync(path.join(cwd, dir)).filter((f) => /^session-\d+\.md$/.test(f)); } catch { return []; }
  const latest = names.sort((a, b) => parseInt(a.slice(8), 10) - parseInt(b.slice(8), 10)).pop();
  return latest ? [`${dir}/${latest}`] : [];
}

/** The plan's phase task files, in phase order. @param {string} cwd @param {string} dir project-relative @returns {string[]} */
function phaseTaskFiles(cwd, dir) {
  /** @type {string[]} */
  let names = [];
  try { names = fs.readdirSync(path.join(cwd, dir)).filter((f) => /^phase-\d+-tasks\.md$/.test(f)); } catch { return []; }
  return names.sort((a, b) => parseInt(a.slice(6), 10) - parseInt(b.slice(6), 10)).map((f) => `${dir}/${f}`);
}

/**
 * The file named for the task in the plan's directory or a folder in it —
 * where a plan format that keeps its tasks as files keeps them.
 * @param {string} cwd @param {string} dir project-relative @param {string} internalId
 * @returns {string[]}
 */
function taskFile(cwd, dir, internalId) {
  const name = `${internalId}.md`;
  /** @type {string[]} */
  const found = [];
  /** @param {string} rel @param {boolean} descend */
  const walk = (rel, descend) => {
    let entries;
    try { entries = fs.readdirSync(path.join(cwd, rel), { withFileTypes: true }); } catch { return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isFile() && entry.name === name) found.push(`${rel}/${name}`);
      else if (entry.isDirectory() && descend) walk(`${rel}/${entry.name}`, false);
    }
  };
  walk(dir, true);
  return found;
}

/** @param {Position} position @returns {string|null} */
function internalIdOf(position) {
  return position.task && position.topic ? `${position.topic}-${position.task.replace('.', '-')}` : null;
}

/** @param {any} manifest @param {string} phase @param {string} topic @returns {Record<string, any>} */
function itemOf(manifest, phase, topic) {
  const item = manifest?.phases?.[phase]?.items?.[topic];
  return isObject(item) ? item : {};
}

/**
 * The skill that runs the work at a position and the topic's documents,
 * whether or not they exist; neither at a work unit's menu.
 * @param {string} cwd @param {Position} position @param {any} manifest the work unit's, or null
 * @returns {{skill: string|null, documents: string[]}}
 */
function workAt(cwd, position, manifest) {
  const { name, phase } = position;
  if (phase === undefined) {
    if (name === 'baseline') return { skill: skillFile('workflow-baseline'), documents: [] };
    if (name !== 'roadmap') return { skill: null, documents: [] };
    const roadmap = loadProjectManifest(cwd)?.roadmap;
    const active = isObject(roadmap) ? roadmap.active_session : undefined;
    return {
      skill: skillFile('workflow-roadmap'),
      documents: typeof active === 'string' ? sessionLog(cwd, '.workflows/.roadmap/sessions', active) : [],
    };
  }
  const wu = `.workflows/${name}`;
  const topic = /** @type {string} */ (position.topic);
  const skill = skillFile(phase === 'discovery' ? 'workflow-discovery' : `workflow-${phase}-process`);
  switch (phase) {
    case 'discovery':
      return { skill, documents: sessionLog(cwd, `${wu}/discovery/sessions`, manifest?.phases?.discovery?.active_session) };
    case 'research':
    case 'discussion':
    case 'investigation':
      return { skill, documents: [`${wu}/${phase}/${topic}.md`] };
    case 'experiment': {
      const experiments = itemOf(manifest, 'experiment', topic).experiments;
      const live = isObject(experiments)
        ? Object.keys(experiments).filter((id) => isObject(experiments[id]) && !EXPERIMENT_TERMINAL_STATUSES.includes(experiments[id].status))
        : [];
      return {
        skill,
        documents: live.flatMap((id) => {
          let dir;
          try { dir = recordDir(name, topic, id, experiments); } catch { return []; }
          return ['problem.md', 'design.md', 'report.md'].map((f) => `${dir}/${f}`);
        }),
      };
    }
    case 'scoping':
      return { skill, documents: [`${wu}/specification/${topic}/specification.md`, `${wu}/planning/${topic}/planning.md`] };
    case 'specification':
      return { skill, documents: [`${wu}/specification/${topic}/specification.md`] };
    case 'planning':
      return { skill, documents: [`${wu}/planning/${topic}/planning.md`, ...phaseTaskFiles(cwd, `${wu}/planning/${topic}`)] };
    case 'implementation': {
      const internalId = internalIdOf(position);
      if (internalId === null) return { skill, documents: [] };
      const format = itemOf(manifest, 'planning', topic).format;
      const reading = typeof format === 'string' && illegalNameReason('format', format) === null
        ? [`.claude/skills/workflow-planning-process/references/output-formats/${format}/reading.md`]
        : [];
      return { skill, documents: [...reading, ...taskFile(cwd, `${wu}/planning/${topic}`, internalId)] };
    }
    case 'review':
      return { skill, documents: [`${wu}/review/${topic}/report.md`] };
    default:
      return { skill: null, documents: [] };
  }
}

/**
 * Where the position is, named for the conversation.
 * @param {Position} position @param {any} manifest the work unit's, or null
 */
function placeName(position, manifest) {
  const { name, phase, topic } = position;
  if (phase === undefined) {
    if (name === 'roadmap') return 'the product roadmap';
    if (name === 'baseline') return 'the baseline assessment';
    return manifest && typeof manifest.work_type === 'string' ? `the ${manifest.work_type} "${name}"` : `"${name}"`;
  }
  const at = topic === name ? `the ${phase} of "${name}"` : `the ${phase} of "${topic}" in "${name}"`;
  const internalId = internalIdOf(position);
  return internalId === null ? at : `${at}, on task ${position.task} (internal id \`${internalId}\`)`;
}

/**
 * @typedef {object} PositionReads
 * @property {string} session_id
 * @property {Position|null} position
 * @property {string|null} skill  the skill that runs the work there, by absolute path; null where nothing carries on, or this project lacks it
 * @property {string[]} files     the topic's documents this project has, by absolute path, read after the skill
 * @property {string} text        the message naming where the conversation is and what to re-read
 */

/**
 * What the conversation `sessionId` re-reads to carry on from its position —
 * only what this project has of it, each file by its absolute path under the
 * project root, so a conversation with nothing else in context never guesses
 * the root — and the message naming it, composed here so a mod hands it on
 * unchanged. No position, and a work unit's menu, carry nothing on.
 * @param {string} cwd @param {string} sessionId @returns {PositionReads}
 */
function positionReads(cwd, sessionId) {
  const position = readPosition(sessionId);
  if (position === null) {
    return { session_id: sessionId, position: null, skill: null, files: [], text: 'This conversation holds no workflow position, so there is nothing to carry on from.' };
  }
  const manifest = illegalNameReason('work unit', position.name) === null ? loadManifest(cwd, position.name) : null;
  const where = placeName(position, manifest);
  const work = workAt(cwd, position, manifest);
  if (work.skill === null) {
    return { session_id: sessionId, position, skill: null, files: [], text: `This conversation is at ${where}, outside any phase, so there is nothing to carry on from.` };
  }
  const absolute = (/** @type {string} */ f) => path.resolve(cwd, f);
  const skill = fs.existsSync(absolute(work.skill)) ? absolute(work.skill) : null;
  const files = [...new Set(work.documents)].map(absolute).filter((f) => fs.existsSync(f));
  const opening = `This conversation is working in ${where}.`;
  const reread = skill === null ? 'To carry on there, re-read' : `To carry on there, re-read \`${skill}\` in full and follow its load directives, then re-read`;
  const text = files.length > 0
    ? [`${opening} ${reread} these in full:`, ...files.map((f) => `- ${f}`)].join('\n')
    : skill === null
      ? `${opening} Nothing of it is in this project to re-read.`
      : `${opening} To carry on there, re-read \`${skill}\` in full and follow its load directives.`;
  return { session_id: sessionId, position, skill, files, text };
}

/**
 * `conversation position`'s answer: the message as the DATA the
 * conversation reasons from, and all of it as one line of JSON for a mod.
 * @param {PositionReads} reads @returns {string}
 */
function positionSections(reads) {
  return dataSection([reads.text]) + section('POSITION', POSITION_INSTRUCTION, JSON.stringify(reads));
}

module.exports = {
  readPosition, recordPosition, recordTask, clearTask, dropPosition,
  positionReads, positionSections,
};
