'use strict';

// ---------------------------------------------------------------------------
// The menus' frame (leeway-engine/scripts/domain/menus.cjs, E1): every menu
// named once in the registry, each gate's name one the trust log keys; a
// menu drawn as its TITLE where it has one, what it shows and its MENU — a
// statement under the rule where it makes one — every row carrying its next
// as drawn and `gate` answering with it (18.9.1), h/help added to every menu
// (18.9.4, 23.2.1); §18's screens drawn through it (18.2.12, 18.3.4,
// 18.7.11); the rows the frame refuses; where drawing a menu leaves the
// conversation (20.3.3, 20.3.8). A menu's help (projections/help.cjs,
// 18.9.5, 23.2.1, 23.2.2): its screen, the start menu's own (23.2.3), its
// back carrying every argument the menu was drawn with, its file, and the
// registry's keys held to each help file (23.2.4). The help row a gate or a
// raise never carries (18.S51; a question typed at a menu or a gate is
// test-engine-gate.cjs's).
//
// Layer: verb. World: the project from the fixture library, with an epic,
// `fumi`, copied for each test; each test keeps its conversation and its
// trust log in a config folder of its own. Of the menus' screens only the
// verdict page's is drawn yet (test-engine-verdict.cjs), so the frame draws
// the registry's entries with their keys given here, in process, as a
// command draws them.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, refuses, cleanupFixture, sectionOf } = require('./engine-harness.cjs');
const { setupFixture, createManifest, useTempFolder, withEnv } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { MENUS, HELP_GATE, drawMenu } = require(path.join(SCRIPTS, 'domain/menus.cjs'));
const { renderSurface } = require(path.join(SCRIPTS, 'domain/render.cjs'));
const { parseHelp, menuDrift, helpScreen, menusDrift } = require(path.join(SCRIPTS, 'domain/projections/help.cjs'));
const { openGate, gateShown, section, menuSection, menu, cmdOption, MENU_INSTRUCTION, NBSP } = require(path.join(SCRIPTS, 'domain/projections/surfaces.cjs'));
const { recordGateShown } = require(path.join(SCRIPTS, 'domain/gate.cjs'));
const { SCHEMA } = require(path.join(SCRIPTS, 'domain/trust-events.cjs'));

const SESSION = 'c0ffee00-1234-4abc-8def-0123456789ab';
const EPIC = 'fumi';

/** @typedef {import('../../skills/leeway-engine/scripts/domain/menus.cjs').Menu} Menu */
/** @typedef {import('../../skills/leeway-engine/scripts/domain/menus.cjs').MenuScreen} MenuScreen */
/** @typedef {import('../../skills/leeway-engine/scripts/domain/menus.cjs').Drawn} Drawn */

/** A menu of the registry as its screen draws it, its row keys given. @param {string} id @param {string[]} keys @returns {Menu} */
const drawn = (id, keys) => ({ ...MENUS[id], keys });

const TRIAGE = drawn('triage', ['#', 'w', 'b']);
const EPIC_MENU = drawn('epic-menu', ['#', 'd', 'b']);
const ROADMAP = drawn('roadmap', ['w']);

const HANDED = Object.freeze({ kind: 'handoff', skill: 'leeway-discovery', args: ['start', 'none'] });
const START_MENU = Object.freeze({ kind: 'engine', argv: ['render', 'start-menu'] });
/** @type {import('../../skills/leeway-engine/scripts/domain/projections/surfaces.cjs').Next} */
const ON = Object.freeze({ kind: 'continue' });

/** @type {MenuScreen} */
const SCREEN = Object.freeze({
  title: 'Triage',
  shows: ['Inbox: 2 ideas'],
  rows: [
    { key: 1, label: 'The first idea', next: { kind: 'continue' } },
    { key: 'w', word: 'work', label: 'Work on what is picked', next: HANDED },
  ],
  back: { label: 'Back to the start menu', next: START_MENU },
  prompt: { label: 'Pick', description: 'Name the items by number', next: { kind: 'continue' } },
});

const HELP_TEXT = [
  'Triage works through the inbox: the ideas, bugs and quick-fixes noted down to come back to.',
  '',
  '# → A number picks that item.',
  'w → Work starts on what\'s picked now, as one piece of work; discovery finds what kind of work it is as we talk.',
  'b → Back leaves triage with nothing changed.',
  '',
  'Ask → Ask anything about triage or the inbox',
].join('\n');

const config = useTempFolder('menus-config-');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = setupFixture('menus-');
  createManifest(dir, EPIC, { work_type: 'epic' });
});

afterEach(() => cleanupFixture(dir));

/** The calling conversation's environment. */
const conversation = () => ({ CLAUDE_CODE_SESSION_ID: SESSION, LEEWAY_CONFIG_DIR: config(), TMUX: undefined, TMUX_PANE: undefined });

/** Run `fn` as a command the conversation runs in this process, its gate open. @template T @param {() => T} fn @returns {T} */
const inConversation = (fn) => withEnv(conversation(), () => {
  openGate();
  return fn();
});

/** Draw a menu as its render does, the gate it states recorded as shown. @param {Menu} m @param {Drawn} as @param {MenuScreen} screen */
const show = (m, as, screen) => inConversation(() => {
  const out = drawMenu(dir, m, as, screen);
  recordGateShown();
  return out;
});

/** The conversation's position, null where it has none. */
function position() {
  const file = path.join(config(), 'conversations', SESSION, 'position.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** Arrive at the epic's menu as `session label` arrives. */
const atTheEpic = () => ok(dir, ['session', 'label', EPIC], { env: conversation() });

/** The section markers of an output, in order. @param {string} out */
const markers = (out) => out.split('\n').filter((line) => line.startsWith('=== ')).map((line) => line.replace(/ \(.*$/, ''));

/** A section's lines as the screen reads them, its emphasis dropped and its hanging indents plain spaces: §18's and §23's text. @param {string} out @param {string} name */
const read = (out, name) => sectionOf(out, name).replace(/\*\*|`/g, '').replaceAll(NBSP, ' ').split('\n').slice(0, -1);

/** The registry's start menu, its rows' keys as §18 draws them. */
const START = drawn('start-menu', ['#', 'p', 's', 't', 'r', 'e', 'v', 'm']);

describe('the menus\' registry', () => {
  it('names every menu once, under a gate the trust log keys, none sharing a gate with another or with help', () => {
    const keyable = SCHEMA.events.gate.fields.find((/** @type {{name: string}} */ f) => f.name === 'gate').type;
    const gates = [...Object.values(MENUS).map(({ gate }) => gate), HELP_GATE];

    assert.deepStrictEqual(gates, ['start menu', 'epic menu', 'triage', 'archived items', 'archived item', 'roadmap', 'manage', 'manage unit', 'closed units', 'verdicts', 'help']);
    assert.deepStrictEqual(gates.filter((gate) => !keyable.test(gate)), []);
    assert.deepStrictEqual(Object.values(MENUS).filter(({ id }, i) => Object.keys(MENUS)[i] !== id), []);
  });

  it('20.3.3: the start menu and every menu of the project\'s reached from it leave no position; the epic\'s menu arrives at its unit, the roadmap at itself', () => {
    const arrivals = Object.fromEntries(Object.values(MENUS).map(({ id, arrival }) => [id, arrival]));

    assert.deepStrictEqual(arrivals, {
      'start-menu': 'none', 'epic-menu': 'unit', triage: 'none', archived: 'none', 'archived-item': 'none', roadmap: 'roadmap', manage: 'none', 'manage-unit': 'none', closed: 'none', verdicts: 'none',
    });
  });

  it('23.2.4: every menu\'s help tells exactly the rows it registers', () => {
    assert.deepStrictEqual(menusDrift(), []);
  });
});

describe('the frame (E1, 18.9.1, 18.9.4, 23.2.1)', () => {
  it('draws its title, what it shows as a text block, and its MENU under its gate: its rows with their nexts, then h/help leading to the menu\'s help, then b/back, then the prompt row', () => {
    const out = inConversation(() => drawMenu(dir, TRIAGE, {}, SCREEN));

    assert.deepStrictEqual(markers(out), ['=== TITLE', '=== DISPLAY: triage', '=== MENU: triage']);
    assert.deepStrictEqual([sectionOf(out, 'TITLE'), sectionOf(out, 'DISPLAY: triage')], ['# **`■ Triage`**\n', 'Inbox: 2 ideas\n']);
    assert.deepStrictEqual(withEnv(conversation(), gateShown), {
      gate: 'triage',
      question: 'What would you like to do?',
      options: [
        { key: '1', word: null, head: 'The first idea', tail: null, detail: null, recommended: false, next: { kind: 'continue' } },
        { key: 'w', word: 'work', head: 'Work on what is picked', tail: null, detail: null, recommended: false, next: HANDED },
        { key: 'h', word: 'help', head: 'What this menu is for, row by row', tail: null, detail: null, recommended: false, next: { kind: 'engine', argv: ['render', 'help', 'triage'] } },
        { key: 'b', word: 'back', head: 'Back to the start menu', tail: null, detail: null, recommended: false, next: START_MENU },
      ],
      typed: [{ label: 'Pick', next: { kind: 'continue' } }],
    });
  });

  it('`gate` answers with the next the row was drawn with — the help row\'s the menu\'s help as drawn, its argument among it', () => {
    show(EPIC_MENU, { arg: EPIC }, { ...SCREEN, title: 'Discussion — Fumi', rows: [{ key: 'd', word: 'discovery', label: 'Change the map', next: HANDED }] });

    assert.deepStrictEqual(ok(dir, ['gate', 'epic menu', '--pick', 'h'], { env: conversation() }), {
      ok: true, gate: 'epic menu', picked: 'h', recommended: null, via: 'typed', next: { kind: 'engine', argv: ['render', 'help', 'epic-menu', EPIC] },
    });
  });

  it('refuses a row it cannot draw — one leading nowhere, a key the menu does not register, h or b among the rows, a back the menu has none of — and a unit\'s menu drawn for none, leaving the conversation where it was', () => {
    atTheEpic();
    const refused = [
      [TRIAGE, { ...SCREEN, rows: [{ key: 'w', word: 'work', label: 'Work' }] }, 'triage: row w leads nowhere — every row of a menu carries its next'],
      [TRIAGE, { ...SCREEN, rows: [{ key: 'a', word: 'archive', label: 'Archive', next: HANDED }] }, 'triage: row a is not among the keys triage registers: #, w, b'],
      [TRIAGE, { ...SCREEN, rows: [{ key: 'h', word: 'help', label: 'Help', next: HANDED }] }, 'triage: row h is the frame\'s own — h/help is added to every menu, and b/back is the screen\'s back'],
      [TRIAGE, { ...SCREEN, rows: [{ key: 'b', word: 'back', label: 'Back', next: HANDED }] }, 'triage: row b is the frame\'s own — h/help is added to every menu, and b/back is the screen\'s back'],
      [ROADMAP, SCREEN, 'roadmap: row 1 is not among the keys roadmap registers: w'],
      [ROADMAP, { ...SCREEN, rows: [] }, 'roadmap registers no back row'],
      [EPIC_MENU, { ...SCREEN, rows: [] }, 'epic-menu is drawn for a unit, and none was named'],
    ];
    for (const [m, screen, refusal] of refused) {
      assert.throws(() => inConversation(() => drawMenu(dir, /** @type {Menu} */ (m), {}, /** @type {MenuScreen} */ (screen))), { message: refusal });
    }
    assert.deepStrictEqual(position(), { name: EPIC });
  });
});

describe('§18\'s screens drawn through the frame (18.2.12, 18.3.4, 18.7.11)', () => {
  it('18.2.12: the start menu — no title, the inbox shown above the rule, its rows, and its help row saying how Leeway works', () => {
    const out = inConversation(() => drawMenu(dir, START, {}, {
      shows: ['Inbox: 3 ideas · 2 bugs · 1 quick-fix'],
      rows: [
        { key: 1, label: 'Continue bugfix: Killing All Sessions Wipes Restore State — investigation · 1 question waiting for you', next: ON },
        { key: 2, label: 'Continue feature: Lazy Resume On Attach — build, phase 5 of 7', next: ON },
        { key: 3, label: 'Continue epic: Agent First Portal — discussion, 0 of 7 topics decided', next: ON },
        { key: 'p', word: 'product', label: 'Talk about the product — 4 sessions, last on 19 Oct', next: ON },
        { key: 's', word: 'start', label: 'Start something new — describe it, and we\'ll find what kind of work it is', next: HANDED },
        { key: 't', word: 'triage', label: 'Triage the inbox', next: ON },
        { key: 'r', word: 'roadmap', label: 'Open the product roadmap', next: ON },
        { key: 'e', word: 'verdicts', label: 'Give the 2 verdicts waiting on calls you changed', next: ON },
        { key: 'v', word: 'view', label: 'View completed & cancelled work units', next: ON },
        { key: 'm', word: 'manage', label: 'Manage work units, the project\'s setup and drivers, and the matrix', next: ON },
      ],
    }));

    assert.deepStrictEqual(markers(out), ['=== DISPLAY: start-menu', '=== MENU: start menu']);
    assert.deepStrictEqual([read(out, 'DISPLAY: start-menu'), read(out, 'MENU: start menu')], [['Inbox: 3 ideas · 2 bugs · 1 quick-fix'], [
      '· · · · · · · · · · · ·',
      '◆ What would you like to do?',
      '',
      '1          → Continue bugfix: Killing All Sessions Wipes Restore',
      '             State — investigation · 1 question waiting for you',
      '2          → Continue feature: Lazy Resume On Attach — build,',
      '             phase 5 of 7',
      '3          → Continue epic: Agent First Portal — discussion, 0 of',
      '             7 topics decided',
      'p/product  → Talk about the product — 4 sessions, last on 19 Oct',
      's/start    → Start something new — describe it, and we\'ll find',
      '             what kind of work it is',
      't/triage   → Triage the inbox',
      'r/roadmap  → Open the product roadmap',
      'e/verdicts → Give the 2 verdicts waiting on calls you changed',
      'v/view     → View completed & cancelled work units',
      'm/manage   → Manage work units, the project\'s setup and drivers,',
      '             and the matrix',
      'h/help     → How Leeway works',
    ]]);
  });

  it('18.3.4: manage — no title, nothing shown, its own question, and its back row', () => {
    const out = inConversation(() => drawMenu(dir, drawn('manage', ['#', 's', 'd', 'm', 'b']), {}, {
      shows: [],
      question: 'What would you like to manage?',
      rows: [
        { key: 1, label: 'Killing All Sessions Wipes Restore State — bugfix', next: ON },
        { key: 2, label: 'Lazy Resume On Attach — feature', next: ON },
        { key: 3, label: 'Agent First Portal — epic', next: ON },
        { key: 4, label: 'Split Oversized Go Files — feature, cancelled', next: ON },
        { key: 's', word: 'setup', label: 'Change the environment setup — how to run Portal, what can\'t run at once, the linters', next: ON },
        { key: 'd', word: 'drivers', label: 'Change the task driver or the landing driver', next: ON },
        { key: 'm', word: 'matrix', label: 'See the matrix — how often Claude\'s calls miss, by kind', next: ON },
      ],
      back: { label: 'Back to the start menu', next: START_MENU },
    }));

    assert.deepStrictEqual(markers(out), ['=== MENU: manage']);
    assert.deepStrictEqual(read(out, 'MENU: manage'), [
      '· · · · · · · · · · · ·',
      '◆ What would you like to manage?',
      '',
      '1         → Killing All Sessions Wipes Restore State — bugfix',
      '2         → Lazy Resume On Attach — feature',
      '3         → Agent First Portal — epic',
      '4         → Split Oversized Go Files — feature, cancelled',
      's/setup   → Change the environment setup — how to run Portal,',
      '            what can\'t run at once, the linters',
      'd/drivers → Change the task driver or the landing driver',
      'm/matrix  → See the matrix — how often Claude\'s calls miss, by',
      '            kind',
      'h/help    → What this menu is for, row by row',
      'b/back    → Back to the start menu',
    ]);
  });

  it('18.3.4: manage, a unit picked — its statement under the rule, over the question, and its Ask row', () => {
    const out = inConversation(() => drawMenu(dir, drawn('manage-unit', ['c', 'r', 'b']), {}, {
      shows: [],
      statement: 'Lazy Resume On Attach (feature)',
      rows: [{ key: 'c', word: 'cancel', label: 'Mark as cancelled', next: ON }],
      back: { label: 'Back to manage', next: { kind: 'engine', argv: ['render', 'manage'] } },
      prompt: { label: 'Ask', description: 'Ask a question about this work unit', next: ON },
    }));

    assert.deepStrictEqual(markers(out), ['=== MENU: manage unit']);
    assert.deepStrictEqual(read(out, 'MENU: manage unit'), [
      '· · · · · · · · · · · ·',
      'Lazy Resume On Attach (feature)',
      '',
      '◆ What would you like to do?',
      '',
      'c/cancel → Mark as cancelled',
      'h/help   → What this menu is for, row by row',
      'b/back   → Back to manage',
      'Ask      → Ask a question about this work unit',
    ]);
  });

  it('18.7.11: an archived item picked — its statement and its own question', () => {
    const out = inConversation(() => drawMenu(dir, drawn('archived-item', ['u', 'd', 'b']), {}, {
      shows: [],
      statement: 'Selected: Enter In The Preview Should Attach (idea, closed by Enter Attaches From Preview)',
      question: 'What would you like to do with it?',
      rows: [
        { key: 'u', word: 'unarchive', label: 'Restore it to the inbox', next: ON },
        { key: 'd', word: 'delete', label: 'Delete it for good — it can\'t be brought back', next: ON },
      ],
      back: { label: 'Back to the archived items', next: { kind: 'engine', argv: ['render', 'archived'] } },
    }));

    assert.deepStrictEqual(markers(out), ['=== MENU: archived item']);
    assert.deepStrictEqual(read(out, 'MENU: archived item'), [
      '· · · · · · · · · · · ·',
      'Selected: Enter In The Preview Should Attach (idea, closed by',
      'Enter Attaches From Preview)',
      '',
      '◆ What would you like to do with it?',
      '',
      'u/unarchive → Restore it to the inbox',
      'd/delete    → Delete it for good — it can\'t be brought back',
      'h/help      → What this menu is for, row by row',
      'b/back      → Back to the archived items',
    ]);
  });
});

describe('where drawing a menu leaves the conversation (20.3.3, 20.3.8)', () => {
  it('the start menu and the project\'s menus beside it drop the position, so the board shows All work', () => {
    atTheEpic();
    inConversation(() => drawMenu(dir, TRIAGE, {}, SCREEN));

    assert.strictEqual(position(), null);
  });

  it('the epic\'s menu records the conversation at its unit', () => {
    inConversation(() => drawMenu(dir, EPIC_MENU, { arg: EPIC }, { ...SCREEN, rows: [] }));

    assert.deepStrictEqual(position(), { name: EPIC });
  });

  it('the roadmap records the conversation at the roadmap', () => {
    atTheEpic();
    inConversation(() => drawMenu(dir, ROADMAP, {}, { title: 'Roadmap', shows: [], rows: [{ key: 'w', word: 'work', label: 'Work on items', next: HANDED }] }));

    assert.deepStrictEqual(position(), { name: 'roadmap' });
  });
});

describe('a menu\'s help (18.9.5, 23.2.1, 23.2.2, 23.2.3)', () => {
  const WALK = Object.freeze({ kind: 'invoke', skill: 'leeway-help', args: ['walk'] });
  const TOPICS = Object.freeze({ kind: 'engine', argv: ['render', 'help-topics'] });
  /** The start menu with its help as 23.2.3 draws it — before the product's row joined the menu (18.2.13) — "■ Help", its own closing line, and the walkthrough and the topics rows of its own. */
  const START_HELPED = Object.freeze({
    ...drawn('start-menu', ['#', 's', 't', 'r', 'e', 'v', 'm']),
    help: {
      label: 'How Leeway works',
      heading: 'Help',
      closing: 'Ask about anything else, or walk through the whole thing.',
      rows: [
        { key: 'w', word: 'walk', label: 'Walk through how Leeway works', next: WALK },
        { key: 't', word: 'topics', label: 'Read about one area in more depth', next: TOPICS },
      ],
    },
  });
  const START_HELP = [
    'The start menu is where every piece of work begins and resumes.',
    '',
    '# → A number continues that piece of work: a feature, bugfix or quick-fix goes straight to where it stands, an epic opens its menu; the ones with something waiting on you come first.',
    's → Start begins something new: describe it, and the kind of work is settled as we talk.',
    't → Triage works through the inbox, the things you noted down to come back to: work on them now, put them on the roadmap, or archive them.',
    'r → The roadmap holds what you\'ve shaped but not yet committed to build, by horizon.',
    'e → Verdicts appears while a call you changed waits for your word on what Claude\'s answer would have cost.',
    'v → View lists completed and cancelled work.',
    'm → Manage reopens, pivots, absorbs, cancels or brings back a piece of work, and changes the project\'s setup, its drivers and the matrix.',
    '',
    'Ask → Ask anything about how Leeway works',
  ].join('\n');

  it('"■ Help · {Menu}", what the menu is for and a bullet a row, the invitation to ask, and its gate: back to the menu as drawn, and Ask leading into the conversation', () => {
    const out = inConversation(() => helpScreen(TRIAGE, {}, parseHelp(HELP_TEXT, 'triage.help.md')));

    assert.deepStrictEqual(markers(out), ['=== TITLE', '=== DISPLAY: help', '=== MENU: help']);
    assert.strictEqual(sectionOf(out, 'TITLE'), '# **`■ Help · Triage`**\n');
    assert.strictEqual(sectionOf(out, 'DISPLAY: help'), [
      'Triage works through the inbox: the ideas, bugs and quick-fixes',
      'noted down to come back to.',
      '  · A number picks that item.',
      '  · Work starts on what\'s picked now, as one piece of work;',
      '    discovery finds what kind of work it is as we talk.',
      '  · Back leaves triage with nothing changed.',
      'Ask about anything else.',
      '',
    ].join('\n'));
    assert.deepStrictEqual(withEnv(conversation(), gateShown), {
      gate: 'help',
      question: 'What would you like to do?',
      options: [{ key: 'b', word: 'back', head: 'Back to triage', tail: null, detail: null, recommended: false, next: { kind: 'engine', argv: ['render', 'triage'] } }],
      typed: [{ label: 'Ask', next: { kind: 'continue' } }],
    });
  });

  it('23.2.3: the start menu\'s help — "■ Help", its closing line, and its own rows before back, each with its next', () => {
    const out = inConversation(() => helpScreen(START_HELPED, {}, parseHelp(START_HELP, 'start-menu.help.md')));

    assert.deepStrictEqual(markers(out), ['=== TITLE', '=== DISPLAY: help', '=== MENU: help']);
    assert.deepStrictEqual([sectionOf(out, 'TITLE'), read(out, 'DISPLAY: help'), read(out, 'MENU: help')], ['# **`■ Help`**\n', [
      'The start menu is where every piece of work begins and resumes.',
      '  · A number continues that piece of work: a feature, bugfix or',
      '    quick-fix goes straight to where it stands, an epic opens its',
      '    menu; the ones with something waiting on you come first.',
      '  · Start begins something new: describe it, and the kind of work',
      '    is settled as we talk.',
      '  · Triage works through the inbox, the things you noted down to',
      '    come back to: work on them now, put them on the roadmap, or',
      '    archive them.',
      '  · The roadmap holds what you\'ve shaped but not yet committed to',
      '    build, by horizon.',
      '  · Verdicts appears while a call you changed waits for your word',
      '    on what Claude\'s answer would have cost.',
      '  · View lists completed and cancelled work.',
      '  · Manage reopens, pivots, absorbs, cancels or brings back a',
      '    piece of work, and changes the project\'s setup, its drivers',
      '    and the matrix.',
      'Ask about anything else, or walk through the whole thing.',
    ], [
      '· · · · · · · · · · · ·',
      '◆ What would you like to do?',
      '',
      'w/walk   → Walk through how Leeway works',
      't/topics → Read about one area in more depth',
      'b/back   → Back to the start menu',
      'Ask      → Ask anything about how Leeway works',
    ]]);
    assert.deepStrictEqual(withEnv(conversation(), gateShown).options.map(({ key, next }) => [key, next]), [['w', WALK], ['t', TOPICS], ['b', START_MENU]]);
  });

  it('its back carries every argument the menu was drawn with — the unit it is for, and a flag — through `render help` and back', (t) => {
    const PATH = '.leeway/.inbox/.archived/ideas/enter-attaches.md';
    const ITEM = drawn('archived-item', ['u', 'd', 'b']);
    show(ITEM, { flags: { path: PATH } }, { shows: [], rows: [{ key: 'u', word: 'unarchive', label: 'Restore it to the inbox', next: ON }] });
    const { argv } = ok(dir, ['gate', 'archived item', '--pick', 'h'], { env: conversation() }).next;
    const [, surface, id, flag, value] = argv;
    const helpFile = path.join(SCRIPTS, 'domain/projections/archived-item.help.md');
    const [exists, read] = [fs.existsSync, fs.readFileSync];
    t.mock.method(fs, 'existsSync', (/** @type {fs.PathLike} */ file) => file === helpFile || exists(file));
    t.mock.method(fs, 'readFileSync', (/** @type {any[]} */ ...args) => (args[0] === helpFile ? HELP_TEXT : read(...args)));
    inConversation(() => renderSurface(dir, surface, { dotpath: id, item: undefined, [flag.replace(/^--/, '')]: value }));
    const back = withEnv(conversation(), gateShown).options[0].next;
    inConversation(() => helpScreen(EPIC_MENU, { arg: EPIC }, parseHelp(HELP_TEXT, 'epic-menu.help.md')));

    assert.deepStrictEqual([argv, back, withEnv(conversation(), gateShown).options[0].next], [
      ['render', 'help', 'archived-item', '--path', PATH],
      { kind: 'engine', argv: ['render', 'archived-item', '--path', PATH] },
      { kind: 'engine', argv: ['render', 'epic-menu', EPIC] },
    ]);
  });

  it('`render help` refuses a menu the registry does not name, and one with no help yet', () => {
    assert.strictEqual(refuses(dir, ['render', 'help', 'inbox']).error, 'there is no menu "inbox" — the menus: start-menu, epic-menu, triage, archived, archived-item, roadmap, manage, manage-unit, closed, verdicts');
    assert.deepStrictEqual([refuses(dir, ['render', 'help', 'triage', '--pick', '1']).error, refuses(dir, ['render', 'help', 'closed']).error], [
      'there is no help for triage yet — its help is triage.help.md, beside its projection',
      'there is no help for the closed units yet — its help is closed.help.md, beside its projection',
    ]);
  });

  it('a help file names its Ask row\'s label', () => {
    assert.throws(() => parseHelp('Triage works through the inbox.\n\nw → Work.\n', 'triage.help.md'), {
      message: 'triage.help.md names no Ask row — its label goes on a line of its own, "Ask → {label}"',
    });
  });

  it('23.2.4: a menu and its help part where a key the menu registers is not told, or one told is not registered, where its rows are drawn with no help, or its help is written before its rows — and agree where each is both, or neither is yet', () => {
    const help = parseHelp(HELP_TEXT, 'triage.help.md');

    assert.deepStrictEqual([
      menuDrift(drawn('triage', ['#', 'w', 'a']), help),
      menuDrift(TRIAGE, null),
      menuDrift(MENUS.triage, help),
      menuDrift(TRIAGE, help),
      menuDrift(MENUS.triage, null),
    ], [
      ['triage: row a has no help', 'triage: its help tells of a row b the menu does not register'],
      ['triage: its rows have no help — triage.help.md, beside its projection'],
      ['triage: its help is written, and the menu registers no rows'],
      [],
      [],
    ]);
  });

  it('23.2.4: a row of the help\'s own, told in its file, is the help\'s — never a row the menu must register', () => {
    const told = parseHelp(START_HELP.replace('Ask →', 'w → Walk takes you through the whole of it.\n\nAsk →'), 'start-menu.help.md');

    assert.deepStrictEqual([menuDrift(START_HELPED, told), menuDrift({ ...START_HELPED, help: { label: 'How Leeway works' } }, told)], [[], ['start-menu: its help tells of a row w the menu does not register']]);
  });
});

describe('the help row a gate never carries (18.9.4)', () => {
  it('18.S51: a gate or a raise drawing h/help is refused; a menu draws it', () => {
    const rows = () => menu('', [cmdOption('y', 'yes', 'Go on'), cmdOption('h', 'help', 'Help')], { question: 'Go on?' });

    assert.throws(() => section('MENU: finish', MENU_INSTRUCTION, rows()), { message: 'finish: a gate or a raise carries no h/help row — a question typed at it sets it aside (18.9.4); only a menu draws help' });
    assert.throws(() => section('MENU: raise — 0a1b', MENU_INSTRUCTION, rows()), { message: 'raise — 0a1b: a gate or a raise carries no h/help row — a question typed at it sets it aside (18.9.4); only a menu draws help' });
    assert.match(menuSection('triage', MENU_INSTRUCTION, rows()), /^\*\*`h\/help`\*\* +→ Help$/m);
  });
});
