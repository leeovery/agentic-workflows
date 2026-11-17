'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the environment setup as the person sees it (22.5.7, 22.5.8),
// drawn from the setup on the project manifest (environment-verbs.cjs): its
// title, `Environment setup — {Project}`; HOW TO RUN {PROJECT}, each command
// the setup holds; TO PREPARE THE ENVIRONMENT, each step with when it runs,
// a note saying it never runs; WHAT CAN'T RUN AT ONCE, SO FAR; and the
// LINTERS. At the project's first ready to build each part reads "as found"
// and the verify setup is never shown, the first phase's tasks building it
// after (22.5.9); its foot says it is asked once, and its gate, `environment
// setup`, asks to record it: y/yes, its next `environment confirm`, and a
// Comment saying what's different. From manage the parts read as recorded,
// THE VERIFY SETUP shows beside them, read only, changed only by the task
// that builds it (15.2.11), and its gate, `manage setup`, asks to keep it:
// y/yes, back to manage, and a Comment.
// ---------------------------------------------------------------------------

const { wrap } = require('../../kernel/render.cjs');
const { displayWidth } = require('../../kernel/terminal.cjs');
const { section, menu, cmdOption, promptOption, MENU_INSTRUCTION, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { VERIFY_PARTS } = require('../environment.cjs');

/** @typedef {import('../environment.cjs').Setup} Setup */
/** @typedef {import('../environment.cjs').Step} Step */

/**
 * The screen as it is drawn: the project's name, the setup, and whether it
 * is manage's.
 * @typedef {{project: string, setup: Setup, manage: boolean}} SetupView
 */

/** The bullet a row opens on, and the indent its continuations hang at. */
const BULLET = '  · ';
const HANGING = '    ';

/** How each command of `run` reads, in the order the screen lists them. */
const COMMANDS = Object.freeze({ build: 'Build', tests: 'Tests', run: 'Run' });

/** When a step runs, as its row says it. @type {Readonly<Record<Step['when'], string>>} */
const WHEN = Object.freeze({
  first: 'before the first task',
  worktree: 'in each worktree a task runs in',
  both: 'before the first task, and in each worktree a task runs in',
});

/** The verify setup's parts, as their rows name them. */
const VERIFY_NAMES = Object.freeze({ launch: 'Launch', health: 'Health check', drive: 'Drive', evidence: 'Evidence', cleanup: 'Cleanup' });

/** A row, wrapped to the pane under its bullet. @param {string} text */
function row(text) {
  return wrap(text, displayWidth() - BULLET.length).map((line, at) => `${at === 0 ? BULLET : HANGING}${line}`).join('\n');
}

/** A block: its heading, then its rows, or the line saying it holds none. @param {string} heading @param {string[]} rows @param {string} none */
function block(heading, rows, none) {
  return [heading, ...(rows.length === 0 ? [row(none)] : rows.map(row))].join('\n');
}

/** A step's row: its name, its command or its note, and when it runs. @param {Step} step */
function stepRow(step) {
  return 'command' in step ? `${step.name}: ${step.command} — ${WHEN[step.when]}` : `${step.name}: ${step.note} — a note, never run`;
}

/** The verify setup, read only, as manage shows it. @param {Setup['verify']} verify */
function verifyBlock(verify) {
  const heading = 'THE VERIFY SETUP, BUILT BY A TASK';
  if (verify === null) return block(heading, [], 'None yet — the first phase\'s tasks build it');
  return block(heading, [
    `In ${verify.place}, its feature map ${verify.feature_map}`,
    ...VERIFY_PARTS.map((part) => `${VERIFY_NAMES[part]}: ${verify[part]}`),
  ], '');
}

/** The screen's display. @param {SetupView} view */
function setupDisplay({ project, setup, manage }) {
  const found = manage ? '' : ', AS FOUND';
  const none = manage ? 'None recorded' : 'Nothing found';
  const blocks = [
    `Environment setup — ${project}`,
    block(`HOW TO RUN ${project.toUpperCase()}`, Object.entries(COMMANDS).flatMap(([key, name]) => {
      const command = setup.run[/** @type {keyof typeof COMMANDS} */ (key)];
      return command === undefined ? [] : [`${name}: ${command}`];
    }), none),
    block(`TO PREPARE THE ENVIRONMENT${found}`, setup.prepare.map(stepRow), none),
    block('WHAT CAN\'T RUN AT ONCE, SO FAR', setup.concurrency.map(({ what }) => what), 'Nothing found yet — a build records it when it learns it'),
    block(`LINTERS${found}`, setup.linters.map(({ name, command, fix }) => `${name} — ${command}${fix === undefined ? '' : `, its fix ${fix}`}`), none),
  ];
  if (manage) blocks.push(verifyBlock(setup.verify));
  return blocks.join('\n\n');
}

/** The question, the project named where it fits the glyph. @param {string} asks @param {string} project */
function question(asks, project) {
  const named = `${asks} for ${project}?`;
  return named.length <= 60 ? named : `${asks}?`;
}

/** The gate: at the first ready to build, recording the setup; from manage, keeping it. @param {SetupView} view */
function setupGate({ project, manage }) {
  const gate = manage
    ? { name: 'manage setup', statement: 'The verify setup changes only through the task that builds it.', yes: 'Keep it — back to manage', next: ['environment', 'confirm', '--from', 'manage'], asks: 'Keep this setup' }
    : { name: 'environment setup', statement: 'Asked once, at the first ready to build.', yes: 'Record it — change it later from manage', next: ['environment', 'confirm'], asks: 'Record this setup' };
  return section(`MENU: ${gate.name}`, MENU_INSTRUCTION, menu(gate.statement, [
    cmdOption('y', 'yes', gate.yes, { next: { kind: 'engine', argv: gate.next } }),
    promptOption('Comment', 'Tell me what\'s different'),
  ], { question: question(gate.asks, project) }));
}

/**
 * The environment setup's screen: its display, then its gate.
 * @param {SetupView} view
 * @returns {string}
 */
function environmentSetupScreen(view) {
  return section('DISPLAY: environment setup', CONTINUE_INSTRUCTION, setupDisplay(view)) + setupGate(view);
}

module.exports = { environmentSetupScreen };
