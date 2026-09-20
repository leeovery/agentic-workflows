'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the walkthrough's screens and the help home. The prose lives
// beside the code as markdown (`content/walkthrough/screens/`) rather than in
// string literals — it is written and read as writing. Each file opens on its
// `# Title` and marks its diagrams with fences; this module splits a file on
// those fences and renders the parts in order, prose as markdown so it
// re-flows to the pane, diagrams fenced so their columns hold.
//
// The menu is the walk: its rows differ by the screen's position and by where
// the walk was entered from, and nothing else about a screen is conditional.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { section, titleSection, menu, cmdOption, promptOption } = require('./surfaces.cjs');

// The install moves the skills under `.claude/skills/`, so the content is
// resolved from this module rather than from the project root.
const SCREENS_DIR = path.join(__dirname, '..', '..', '..', 'content', 'walkthrough', 'screens');

const PROSE_INSTRUCTION = 'emit verbatim as markdown (not a code block)';
const DIAGRAM_INSTRUCTION = 'emit verbatim as a code block';
const MENU_INSTRUCTION = "emit verbatim as markdown, then STOP for the user's response";

const ORIGINS = ['first-run', 'help'];

const ASK_PROMPT = "Ask anything about what's on this screen";
const CLOSING_PROMPT = "Tell me what you're likely to start with, and I'll say what path it will take";

/**
 * @typedef {object} ScreenChunk
 * @property {'prose'|'diagram'} kind
 * @property {string} text
 */

/**
 * @typedef {object} Screen
 * @property {number} index     1-based position in the walk
 * @property {number} total     screens in the walk
 * @property {string} title
 * @property {ScreenChunk[]} chunks   in file order
 * @property {string|null} next_title the following screen's title, null on the last
 */

/** The screen files in walk order — the filename's numeric prefix is that order. @returns {string[]} */
function screenFiles() {
  return fs.readdirSync(SCREENS_DIR)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => path.join(SCREENS_DIR, name));
}

/** A screen file's `# Title` and its fence-separated chunks. @param {string} file @returns {{title: string, chunks: ScreenChunk[]}} */
function parseScreen(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const heading = lines.findIndex((l) => l.startsWith('# '));
  if (heading === -1) throw new Error(`walkthrough content: ${path.basename(file)} has no "# Title" line`);
  /** @type {ScreenChunk[]} */
  const chunks = [];
  /** @type {string[]} */
  let buffer = [];
  let fenced = false;
  const flush = () => {
    const text = buffer.join('\n').replace(/^\n+|\n+$/g, '');
    if (text !== '') chunks.push({ kind: fenced ? 'diagram' : 'prose', text });
    buffer = [];
  };
  for (const line of lines.slice(heading + 1)) {
    if (line.startsWith('```')) {
      flush();
      fenced = !fenced;
      continue;
    }
    buffer.push(line);
  }
  if (fenced) throw new Error(`walkthrough content: ${path.basename(file)} leaves a fence open`);
  flush();
  return { title: lines[heading].slice(2).trim(), chunks };
}

/**
 * The numbered screen, with the following screen's title — the label the
 * `n/next` row wears, so a reader knows where the key leads. The walk's
 * length is the content directory's, so the whole `--screen` contract is
 * settled here rather than against a number written down twice.
 * @param {string|undefined} screen the requested 1-based position
 * @returns {Screen}
 */
function loadScreen(screen) {
  const files = screenFiles();
  const index = Number(screen);
  if (!Number.isInteger(index) || index < 1 || index > files.length) {
    throw new Error(`render walkthrough-screen: --screen is 1–${files.length} — got "${screen ?? ''}"`);
  }
  const { title, chunks } = parseScreen(files[index - 1]);
  return {
    index,
    total: files.length,
    title,
    chunks,
    next_title: index < files.length ? parseScreen(files[index]).title : null,
  };
}

/**
 * A screen's command exits. The first screen has nowhere to go back to on a
 * first run, where it is the offer itself; the last screen has only its way
 * out.
 * @param {Screen} s @param {string} origin
 * @returns {string[]}
 */
function screenCommands(s, origin) {
  const firstRun = origin === 'first-run';
  if (s.next_title === null) {
    return [cmdOption('d', 'done', firstRun ? 'Go to the start menu' : 'Back to help')];
  }
  const options = [cmdOption('n', 'next', s.next_title)];
  if (s.index === 1) {
    options.push(firstRun
      ? cmdOption('s', 'skip', "Skip this for now — it's under h/help whenever you want it")
      : cmdOption('b', 'back', 'Back to help'));
    return options;
  }
  options.push(cmdOption('b', 'back', 'Go back a screen'));
  options.push(firstRun
    ? cmdOption('s', 'skip', "Stop here — it's under h/help whenever you want it")
    : cmdOption('s', 'stop', 'Stop here and go back to help'));
  return options;
}

/**
 * The screen's menu — the same section whether it arrives under a screen or
 * alone. The last screen earns a second prompt option: a question about the
 * walk and a statement of what the reader is about to start are disjoint
 * intents, and the flow routes on both.
 * @param {Screen} s @param {string} origin
 * @returns {string}
 */
function screenMenu(s, origin) {
  const options = [...screenCommands(s, origin), promptOption('Ask', ASK_PROMPT)];
  if (s.next_title === null) options.push(promptOption('Tell me', CLOSING_PROMPT));
  return section('MENU: walkthrough screen', MENU_INSTRUCTION, menu('What next?', options));
}

/**
 * One screen of the walk: its heading, its content in file order, its menu.
 * `menuOnly` serves the return from a question — the reader has the screen
 * already, and only needs the keys back.
 * @param {Screen} s @param {string} origin @param {boolean} menuOnly
 * @returns {string}
 */
function walkthroughScreen(s, origin, menuOnly) {
  if (menuOnly) return screenMenu(s, origin);
  return [
    titleSection(`How the workflows work · ${s.index} of ${s.total} · ${s.title}`),
    ...s.chunks.map((c) => (c.kind === 'prose'
      ? section('DISPLAY: walkthrough prose', PROSE_INSTRUCTION, c.text)
      : section('DISPLAY: walkthrough diagram', DIAGRAM_INSTRUCTION, c.text))),
    screenMenu(s, origin),
  ].join('\n');
}

/**
 * The help home — the walk, the reference cards, a question, and the way back.
 * @returns {string}
 */
function walkthroughHome() {
  return [
    titleSection('Help'),
    section('MENU: walkthrough home', MENU_INSTRUCTION, menu(
      'What would you like to do?',
      [
        cmdOption('w', 'walk', `Walk through how the workflows work (${screenFiles().length} short screens)`),
        cmdOption('t', 'topics', 'Read about one area in more depth'),
        cmdOption('b', 'back', 'Back to the start menu'),
        promptOption('Ask', 'Ask anything about how the workflows work'),
      ],
    )),
  ].join('\n');
}

module.exports = { ORIGINS, loadScreen, walkthroughScreen, walkthroughHome };
