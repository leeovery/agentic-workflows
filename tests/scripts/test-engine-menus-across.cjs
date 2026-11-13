'use strict';

// ---------------------------------------------------------------------------
// Across the menus (18.9.3, 18.9.4, 23.2.1, 23.2.4): every menu the registry
// holds (domain/menus.cjs) has its help file beside its projection, telling
// exactly the rows it registers, and no help file stands for a menu it does
// not hold (23.S7); every menu drawn carries h/help, which opens the menu's
// help as it was drawn — what the screen is for, a line a row, and the
// invitation to ask about anything else (23.S4); and archive is a, work w,
// back b and help h on every menu that offers them (18.S39). Each menu's own
// screen is its suite's.
//
// Layer: verb. World: the project from the fixture library, built once and
// only read: an epic with a topic on its map, a closed feature, an idea in
// the inbox and one archived, and an item waiting on the roadmap — every
// menu drawn over it once, in one conversation, the gate each states read
// from it. The verdict page draws nothing until a departure waits, so it is
// drawn in its own suite (test-engine-verdict.cjs); its help is held to its
// rows here as every menu's is.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { output, cleanupFixture, sectionOf } = require('./engine-harness.cjs');
const { setupFixture, createManifest, createFile, writeState, readState, statePath } = require('./discovery-test-utils.cjs');

const PROJECTIONS = path.join(__dirname, '../../skills/leeway-engine/scripts/domain/projections');
const { MENUS } = require('../../skills/leeway-engine/scripts/domain/menus.cjs');
const { parseHelp, menusDrift } = require(path.join(PROJECTIONS, 'help.cjs'));

const SESSION = 'c0ffee00-1234-4abc-8def-0123456789ab';
const HELP_FILE = '.help.md';
const IDEA = '.inbox/ideas/2026-05-01--an-idea.md';
const ARCHIVED = '.inbox/.archived/ideas/2026-05-01--old-idea.md';

/** The key each action keeps on every menu that offers it (18.9.3, 18.9.4). */
const SAME_KEY = Object.freeze({ a: 'archive', w: 'work', b: 'back', h: 'help' });

/** @type {string} */
let dir;
/** The system config the conversation keeps its folder in. @type {string} */
let config;

/** @typedef {{word: string|null, next: any}} Row */

/** Each menu the world draws, by its registry name: its render's arguments after the name, and its gate's rows by key. @type {Record<string, {args: string[], rows: Record<string, Row>}>} */
let menus;

/** The conversation every menu is drawn in. */
const conversation = () => ({ CLAUDE_CODE_SESSION_ID: SESSION, LEEWAY_CONFIG_DIR: config, TMUX: undefined, TMUX_PANE: undefined });

/**
 * A render in the conversation: its output, and each row of the gate it
 * states, by its key, with its word and where it leads.
 * @param {string[]} argv @returns {{out: string, rows: Record<string, Row>}}
 */
function drawn(argv) {
  const out = output(dir, ['render', ...argv], { env: conversation() });
  const shown = JSON.parse(fs.readFileSync(path.join(config, 'conversations', SESSION, 'gate-shown.json'), 'utf8'));
  return { out, rows: Object.fromEntries(shown.options.map((/** @type {{key: string} & Row} */ { key, word, next }) => [key, { word, next }])) };
}

before(() => {
  dir = setupFixture('menus-across-');
  config = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'menus-across-config-')));
  createManifest(dir, 'v1', { work_type: 'epic', phases: { discovery: { items: { auth: { source: 'discovery', order: 1 } } } } });
  createManifest(dir, 'done-feat', { status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });
  createFile(dir, `.leeway/${IDEA}`, '# An idea\n');
  createFile(dir, `.leeway/${ARCHIVED}`, '# Old idea\n');
  writeState(dir, 'manifest.json', JSON.stringify({
    ...JSON.parse(readState(dir, 'manifest.json')),
    roadmap: { horizons: ['now'], items: { 'dark-mode': { horizon: 'now', summary: 'a dark theme', origin: 'harvest' } } },
  }, null, 2));
  const pick = writeState(dir, '.cache/triage.json', JSON.stringify({ picked: [statePath(dir, IDEA)], fits: [] }));
  /** @type {Record<string, string[]>} */
  const drawnAs = {
    'start-menu': [],
    'epic-menu': ['v1'],
    triage: ['--file', pick],
    archived: [],
    'archived-item': ['--path', statePath(dir, ARCHIVED)],
    roadmap: [],
    manage: [],
    'manage-unit': ['v1'],
    closed: [],
    care: [],
    matrix: [],
  };
  menus = Object.fromEntries(Object.entries(drawnAs).map(([id, args]) => [id, { args, rows: drawn([id, ...args]).rows }]));
});

after(() => {
  cleanupFixture(dir);
  fs.rmSync(config, { recursive: true, force: true });
});

/** A menu's help file, read as its parts. @param {string} id */
const helpOf = (id) => parseHelp(fs.readFileSync(path.join(PROJECTIONS, `${id}${HELP_FILE}`), 'utf8'), `${id}${HELP_FILE}`);

describe('every menu\'s help (23.2.4)', () => {
  it('23.S7: every menu the registry holds has its help file beside its projection, telling exactly the rows it registers, and no help file stands for a menu it does not hold', () => {
    const files = fs.readdirSync(PROJECTIONS).filter((name) => name.endsWith(HELP_FILE)).map((name) => name.slice(0, -HELP_FILE.length));

    assert.deepStrictEqual(files.sort(), Object.keys(MENUS).sort());
    assert.deepStrictEqual(Object.values(MENUS).filter(({ keys }) => keys.length === 0).map(({ id }) => id), [], 'every menu registers the rows its help tells');
    assert.deepStrictEqual(menusDrift(), []);
  });
});

describe('h on every menu (18.9.4, 23.2.1, 23.2.2)', () => {
  it('the world draws every menu the registry holds but the verdict page', () => {
    assert.deepStrictEqual(Object.keys(MENUS).filter((id) => !Object.hasOwn(menus, id)), ['verdicts']);
  });

  it('23.S4: pressing h on any menu shows what the screen is for, a line for each row, and the invitation to ask about anything else', () => {
    for (const [id, { args, rows }] of Object.entries(menus)) {
      assert.deepStrictEqual(rows.h, { word: 'help', next: { kind: 'engine', argv: ['render', 'help', id, ...args] } }, id);

      const shows = sectionOf(drawn(rows.h.next.argv.slice(1)).out, 'DISPLAY: help').trimEnd().split('\n');
      const bullets = shows.filter((line) => line.startsWith('  · '));
      const closing = shows.slice(shows.lastIndexOf(bullets.at(-1) ?? '') + 1).filter((line) => !line.startsWith('    '));
      assert.ok(helpOf(id).paragraphs.length > 0 && !shows[0].startsWith(' '), `${id}: its help opens on what the screen is for`);
      assert.strictEqual(bullets.length, helpOf(id).rows.length, `${id}: a line for each row`);
      assert.match(closing[0] ?? '', /^Ask about anything else\b/, `${id}: the invitation closes it`);
    }
  });
});

describe('the same key for the same action (18.9.3)', () => {
  it('18.S39: archive is a, work w, back b and help h on every menu that offers them — the start menu, triage, the roadmap and the epic menu among them', () => {
    const keyed = Object.entries(menus).flatMap(([id, { rows }]) => Object.entries(rows).map(([key, { word }]) => ({ id, key, word })));
    const actions = Object.entries(SAME_KEY);

    assert.deepStrictEqual(keyed.filter(({ key, word }) => actions.some(([k, w]) => (k === key) !== (w === word))), []);
    assert.deepStrictEqual(actions.filter(([key]) => !keyed.some((row) => row.key === key)).map(([key]) => key), [], 'the world draws every one of the four');
    assert.deepStrictEqual(['start-menu', 'triage', 'roadmap', 'epic-menu'].filter((id) => menus[id].rows.h === undefined), []);
  });
});
