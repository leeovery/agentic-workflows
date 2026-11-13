'use strict';

// ---------------------------------------------------------------------------
// Across the menus (18.9.3, 18.9.4, 23.2.1, 23.2.4): every menu the registry
// holds (domain/menus.cjs) has its help file beside its projection, telling
// exactly the rows it registers, and no help file stands for a menu it does
// not hold (23.S7); every menu drawn carries h/help, which opens the menu's
// help as it was drawn — what the screen is for, a line a row, and the
// invitation to ask about anything else (23.S4); and archive is a, work w,
// back b and help h on every menu that offers them (18.S39), each menu drawn
// in the states that bring every row it registers. Each menu's own screen is
// its suite's.
//
// Layer: verb. World: the project from the fixture library, built once and
// only read: an epic whose topic's call of Claude's the person replaced, a
// departure waiting on its verdict; an epic every topic of which is decided;
// a feature in its discussion an epic could take in; a cancelled unit and a
// closed one; an idea in the inbox and one archived; an item waiting on the
// roadmap; and a care entry — every menu drawn over it in each of those
// states, in one conversation, the gate each states read from it.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ok, output, cleanupFixture, sectionOf } = require('./engine-harness.cjs');
const { setupFixture, createManifest, createFile, writeState, readState, statePath, layout } = require('./discovery-test-utils.cjs');
const { MADE } = require('./ledger-world.cjs');

const PROJECTIONS = path.join(__dirname, '../../skills/leeway-engine/scripts/domain/projections');
const { MENUS } = require('../../skills/leeway-engine/scripts/domain/menus.cjs');
const { parseHelp, menusDrift } = require(path.join(PROJECTIONS, 'help.cjs'));

const SESSION = 'c0ffee00-1234-4abc-8def-0123456789ab';
const EPIC = 'v1';
const READY = 'ready';
const SOLO = 'solo';
const CANCELLED = 'gone';
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

/** Each menu the world draws, in each state it is drawn in: its registry name, its render's arguments after the name, and its gate's rows by key. @type {{id: string, args: string[], rows: Record<string, Row>}[]} */
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

/** A topic on an approved map. @param {number} order @param {string} summary */
const row = (order, summary) => ({ order, summary, source: 'discovery' });

/** A ledger write at the epic's topic, in the conversation: its short id. @param {string} verb @param {string[]} flags @param {Record<string, unknown>} content */
const ledger = (verb, flags, content) => ok(dir, ['ledger', verb, `${EPIC}.discussion.auth`, ...flags], { env: conversation(), stdin: JSON.stringify(content) }).id;

/** The first kind the care entries offer, added through their screens as the person adds one. */
function cared() {
  output(dir, ['render', 'care'], { env: conversation() });
  output(dir, ok(dir, ['gate', 'care entries', '--pick', 'n'], { env: conversation() }).next.argv, { env: conversation() });
  ok(dir, ok(dir, ['gate', 'care kind', '--pick', '1'], { env: conversation() }).next.argv, { env: conversation() });
}

before(() => {
  dir = setupFixture('menus-across-');
  config = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'menus-across-config-')));
  const approved = '2026-09-30T09:00:00.000Z';
  createManifest(dir, EPIC, { work_type: 'epic', phases: { discovery: { approved_at: approved, items: { auth: row(1, 'Signing in') } }, discussion: { items: { auth: { status: 'in-progress' } } } } });
  createManifest(dir, READY, { work_type: 'epic', phases: { discovery: { approved_at: approved, items: { one: row(1, 'One') } }, discussion: { items: { one: { status: 'completed' } } } } });
  createManifest(dir, SOLO, { phases: { discussion: { items: { [SOLO]: { status: 'in-progress' } } } } });
  writeState(dir, layout.doc(SOLO, 'discussion', SOLO), '# Solo\n');
  createManifest(dir, CANCELLED, { status: 'cancelled' });
  createManifest(dir, 'done-feat', { status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });
  const call = ledger('decide', ['--answers', ledger('ask', [], { ...MADE, text: 'Is sync on?' })], { ...MADE, text: 'On.', why: 'Because.' });
  ledger('replace', ['--replaces', call, '--reason', 'changed-mind'], { by: 'person', drops: ['the old answer'], text: 'Off.', why: 'The person wants it so.' });
  cared();
  createFile(dir, `.leeway/${IDEA}`, '# An idea\n');
  createFile(dir, `.leeway/${ARCHIVED}`, '# Old idea\n');
  writeState(dir, 'manifest.json', JSON.stringify({
    ...JSON.parse(readState(dir, 'manifest.json')),
    roadmap: { horizons: ['now'], items: { 'dark-mode': { horizon: 'now', summary: 'a dark theme', origin: 'harvest' } } },
  }, null, 2));
  const pick = writeState(dir, '.cache/triage.json', JSON.stringify({ picked: [statePath(dir, IDEA)], fits: [] }));
  /** @type {[string, string[]][]} */
  const drawnAs = [
    ['start-menu', []],
    ['epic-menu', [EPIC]],
    ['epic-menu', [READY]],
    ['triage', ['--file', pick]],
    ['archived', []],
    ['archived-item', ['--path', statePath(dir, ARCHIVED)]],
    ['roadmap', []],
    ['manage', []],
    ['manage-unit', [SOLO]],
    ['manage-unit', [CANCELLED]],
    ['closed', []],
    ['verdicts', []],
    ['care', []],
    ['matrix', []],
  ];
  menus = drawnAs.map(([id, args]) => ({ id, args, rows: drawn([id, ...args]).rows }));
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
  it('the world draws every menu the registry holds, every row each registers across its states, and none it does not', () => {
    /** @type {Record<string, Set<string>>} */
    const keys = {};
    for (const { id, rows } of menus) {
      for (const key of Object.keys(rows)) if (key !== 'h') (keys[id] ??= new Set()).add(/^\d+$/.test(key) ? '#' : key);
    }

    assert.deepStrictEqual(Object.fromEntries(Object.entries(keys).map(([id, drawnKeys]) => [id, [...drawnKeys].sort()])),
      Object.fromEntries(Object.values(MENUS).map(({ id, keys: registered }) => [id, [...registered].sort()])));
  });

  it('23.S4: pressing h on any menu shows what the screen is for, a line for each row, and the invitation to ask about anything else', () => {
    for (const { id, args, rows } of menus) {
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
    const keyed = menus.flatMap(({ id, rows }) => Object.entries(rows).map(([key, { word }]) => ({ id, key, word })));
    const actions = Object.entries(SAME_KEY);

    assert.deepStrictEqual(keyed.filter(({ key, word }) => actions.some(([k, w]) => (k === key) !== (w === word))), []);
    assert.deepStrictEqual(actions.filter(([key]) => !keyed.some((row) => row.key === key)).map(([key]) => key), [], 'the world draws every one of the four');
    assert.deepStrictEqual(['start-menu', 'triage', 'roadmap', 'epic-menu'].filter((id) => !menus.some((menu) => menu.id === id && menu.rows.h !== undefined)), []);
  });
});
