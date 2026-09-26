'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the walkthrough's screens, the reference cards, and the help
// home. The prose lives beside the code as markdown (`content/walkthrough/`)
// rather than in string literals — it is written and read as writing. Screens
// and cards share one format and one loader: each file opens on its `# Title`
// and marks its diagrams with fences, and this module splits a file on those
// fences and renders the parts in order, prose as markdown so it re-flows to
// the pane, diagrams fenced so their columns hold. A fence carrying a
// language tag is a diagram written in notation: its body goes to the layout
// for that kind (./walkthrough-diagrams.cjs), which draws it at the detected
// width. An untagged fence is emitted exactly as drawn.
//
// The menu is the walk: its rows differ by the screen's position and by where
// the walk was entered from, and nothing else about a screen is conditional.
// A card's menu is the same at every card — a card is read, not walked.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { section, titleSection, dataSection, menu, cmdOption, promptOption, emitAs, MENU_INSTRUCTION } = require('./surfaces.cjs');
const { displayWidth } = require('../../kernel/terminal.cjs');
const { DIAGRAM_KINDS, isDiagramKind, renderDiagram } = require('./walkthrough-diagrams.cjs');

// The install moves the skills under `.claude/skills/`, so the content is
// resolved from this module rather than from the project root.
const CONTENT_DIR = path.join(__dirname, '..', '..', '..', 'content', 'walkthrough');
const SCREENS_DIR = path.join(CONTENT_DIR, 'screens');
const TOPICS_DIR = path.join(CONTENT_DIR, 'topics');

const PROSE_INSTRUCTION = emitAs('markdown');
const DIAGRAM_INSTRUCTION = emitAs('text');

const ORIGINS = ['first-run', 'help'];

const SCREEN_ASK_PROMPT = "Ask anything about what's on this screen";
const CARD_ASK_PROMPT = "Ask anything about what's on this card";
const HELP_ASK_PROMPT = 'Ask anything about how the workflows work';
const CLOSING_PROMPT = "Tell me what you're likely to start with, and I'll say what path it will take";

/**
 * @typedef {object} ContentChunk
 * @property {'prose'|'diagram'} kind
 * @property {string} text
 * @property {string} [tag] a diagram's fence tag; absent or '' is drawn-as-written
 */

/**
 * @typedef {object} Screen
 * @property {number} index     1-based position in the walk
 * @property {number} total     screens in the walk
 * @property {string} title
 * @property {ContentChunk[]} chunks   in file order
 * @property {string|null} next_title the following screen's title, null on the last
 */

/**
 * @typedef {object} Card
 * @property {string} slug      the filename without its ordering prefix or extension
 * @property {string} title
 * @property {ContentChunk[]} chunks   in file order
 */

/** One content directory's files in order — the filename's numeric prefix is that order. @param {string} dir @returns {string[]} */
function contentFiles(dir) {
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => path.join(dir, name));
}

/**
 * A content file's `# Title` and its fence-separated chunks. A fence's
 * language tag rides the chunk: an unknown one is refused here, where the
 * file that carries it is still in hand. A tagged chunk survives an empty
 * body — a `sample` fence is nothing but its tag.
 * @param {string} file @returns {{title: string, chunks: ContentChunk[]}}
 */
function parseContent(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const heading = lines.findIndex((l) => l.startsWith('# '));
  if (heading === -1) throw new Error(`walkthrough content: ${path.basename(file)} has no "# Title" line`);
  /** @type {ContentChunk[]} */
  const chunks = [];
  /** @type {string[]} */
  let buffer = [];
  /** @type {string|null} the open fence's tag; null outside a fence */
  let fence = null;
  const flush = () => {
    const text = buffer.join('\n').replace(/^\n+|\n+$/g, '');
    if (fence === null) {
      if (text !== '') chunks.push({ kind: 'prose', text });
    } else if (text !== '' || fence !== '') {
      chunks.push({ kind: 'diagram', text, tag: fence });
    }
    buffer = [];
  };
  for (const line of lines.slice(heading + 1)) {
    if (line.startsWith('```')) {
      const tag = line.slice(3).trim();
      if (fence === null && tag !== '' && !isDiagramKind(tag)) {
        throw new Error(`walkthrough content: ${path.basename(file)} fences a "${tag}" diagram (tags: ${DIAGRAM_KINDS.join(', ')})`);
      }
      flush();
      fence = fence === null ? tag : null;
      continue;
    }
    buffer.push(line);
  }
  if (fence !== null) throw new Error(`walkthrough content: ${path.basename(file)} leaves a fence open`);
  flush();
  return { title: lines[heading].slice(2).trim(), chunks };
}

/** A file's content in its two registers — prose re-flows to the pane, a diagram's columns hold. A tagged diagram is laid out at the detected width first; an untagged one is emitted as drawn. @param {ContentChunk[]} chunks @returns {string[]} */
function chunkSections(chunks) {
  const width = displayWidth();
  return chunks.map((c) => (c.kind === 'prose'
    ? section('DISPLAY: walkthrough prose', PROSE_INSTRUCTION, c.text)
    : section('DISPLAY: walkthrough diagram', DIAGRAM_INSTRUCTION, c.tag ? renderDiagram(c.tag, c.text, width) : c.text)));
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
  const files = contentFiles(SCREENS_DIR);
  const index = Number(screen);
  if (!Number.isInteger(index) || index < 1 || index > files.length) {
    throw new Error(`render walkthrough-screen: --screen is 1–${files.length} — got "${screen ?? ''}"`);
  }
  const { title, chunks } = parseContent(files[index - 1]);
  return {
    index,
    total: files.length,
    title,
    chunks,
    next_title: index < files.length ? parseContent(files[index]).title : null,
  };
}

/**
 * Every reference card in menu order. The directory is the list — a card is
 * added by writing one, and its slug is its own filename, so nothing about
 * the set is written down twice.
 * @returns {Card[]}
 */
function cards() {
  return contentFiles(TOPICS_DIR).map((file) => ({
    slug: path.basename(file, '.md').replace(/^\d+-/, ''),
    ...parseContent(file),
  }));
}

/**
 * The named card. The refusal names every slug: `--name` is addressed by a
 * session reading the topics menu's DATA rows, so a miss means the two have
 * drifted and the reader needs the real set to land on.
 * @param {string|undefined} name
 * @returns {Card}
 */
function loadCard(name) {
  const all = cards();
  const card = all.find((c) => c.slug === name);
  if (card) return card;
  throw new Error(`render walkthrough-topic: --name is one of ${all.map((c) => c.slug).join(', ')} — got "${name ?? ''}"`);
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
  const options = [...screenCommands(s, origin), promptOption('Ask', SCREEN_ASK_PROMPT)];
  if (s.next_title === null) options.push(promptOption('Tell me', CLOSING_PROMPT));
  return section('MENU: walkthrough screen', MENU_INSTRUCTION, menu('What next?', options));
}

/** A card's menu — the way back to the index, the way out, and a question. @returns {string} */
function cardMenu() {
  return section('MENU: walkthrough card', MENU_INSTRUCTION, menu('What next?', [
    cmdOption('t', 'topics', 'Back to the topics'),
    cmdOption('b', 'back', 'Back to help'),
    promptOption('Ask', CARD_ASK_PROMPT),
  ]));
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
    ...chunkSections(s.chunks),
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
        cmdOption('w', 'walk', `Walk through how the workflows work (${contentFiles(SCREENS_DIR).length} short screens)`),
        cmdOption('t', 'topics', 'Read about one area in more depth'),
        cmdOption('b', 'back', 'Back to the start menu'),
        promptOption('Ask', HELP_ASK_PROMPT),
      ],
    )),
  ].join('\n');
}

/**
 * The index of reference cards. The rows are numbered for the reader and the
 * DATA table carries each number's slug, because a card's title does not
 * determine it ("The kinds of work" is `kinds-of-work`) — routing rides the
 * table, never the labels.
 * @returns {string}
 */
function walkthroughTopics() {
  const all = cards();
  return [
    titleSection('Help · Topics'),
    dataSection([
      'CARDS (key  name):',
      ...all.map((c, i) => `  ${i + 1}  ${c.slug}`),
    ]),
    section('MENU: walkthrough topics', MENU_INSTRUCTION, menu('Which area?', [
      ...all.map((c, i) => cmdOption(String(i + 1), null, c.title)),
      cmdOption('b', 'back', 'Back to help'),
      promptOption('Ask', HELP_ASK_PROMPT),
    ])),
  ].join('\n');
}

/**
 * One reference card: its heading and its content in file order — or, with
 * `menuOnly`, the card's menu alone. A card is also shown mid-conversation,
 * where it carries no gate, so its menu is fetched apart.
 * @param {Card} card @param {boolean} menuOnly
 * @returns {string}
 */
function walkthroughTopic(card, menuOnly) {
  if (menuOnly) return cardMenu();
  return [
    titleSection(`Help · ${card.title}`),
    ...chunkSections(card.chunks),
  ].join('\n');
}

module.exports = { ORIGINS, parseContent, loadScreen, loadCard, walkthroughScreen, walkthroughHome, walkthroughTopics, walkthroughTopic };
