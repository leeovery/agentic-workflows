'use strict';

// ---------------------------------------------------------------------------
// The menus' frame (leeway-engine/scripts/domain/menus.cjs, E1): every menu
// named once in the registry, each gate's name one the trust log keys; a
// menu drawn as its TITLE, what it shows and its MENU, every row carrying
// its next as drawn and `gate` answering with it (18.9.1), h/help added to
// every menu (18.9.4, 23.2.1); the rows the frame refuses; where drawing a
// menu leaves the conversation (20.3.3, 20.3.8). A menu's help
// (projections/help.cjs, 18.9.5, 23.2.1, 23.2.2): its screen, its file, and
// the registry's keys held to each help file (23.2.4). The help row a gate
// or a raise never carries, and a question typed at a menu (18.S38, 18.S51;
// a question typed at a gate is test-engine-gate.cjs's).
//
// Layer: verb. World: the project from the fixture library, with an epic,
// `fumi`, copied for each test; each test keeps its conversation and its
// trust log in a config folder of its own. No menu's screen is drawn yet, so
// the frame draws the registry's entries with their keys given here, in
// process, as a command draws them.
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
const { parseHelp, menuDrift, helpScreen, menusDrift } = require(path.join(SCRIPTS, 'domain/projections/help.cjs'));
const { openGate, gateShown, section, menuSection, menu, cmdOption, MENU_INSTRUCTION } = require(path.join(SCRIPTS, 'domain/projections/surfaces.cjs'));
const { recordGateShown } = require(path.join(SCRIPTS, 'domain/gate.cjs'));
const { SCHEMA } = require(path.join(SCRIPTS, 'domain/trust-events.cjs'));

const SESSION = 'c0ffee00-1234-4abc-8def-0123456789ab';
const EPIC = 'fumi';

/** @typedef {import('../../skills/leeway-engine/scripts/domain/menus.cjs').Menu} Menu */
/** @typedef {import('../../skills/leeway-engine/scripts/domain/menus.cjs').MenuScreen} MenuScreen */

/** A menu of the registry as its screen draws it, its row keys given. @param {string} id @param {string[]} keys @returns {Menu} */
const drawn = (id, keys) => ({ ...MENUS[id], keys });

const TRIAGE = drawn('triage', ['#', 'w', 'b']);
const EPIC_MENU = drawn('epic-menu', ['#', 'd', 'b']);
const ROADMAP = drawn('roadmap', ['w']);

const HANDED = Object.freeze({ kind: 'handoff', skill: 'leeway-discovery', args: ['start', 'none'] });
const START_MENU = Object.freeze({ kind: 'engine', argv: ['render', 'start-menu'] });

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

/** Draw a menu as its render does, the gate it states recorded as shown. @param {Menu} m @param {string|undefined} arg @param {MenuScreen} screen */
const show = (m, arg, screen) => inConversation(() => {
  const out = drawMenu(dir, m, arg, screen);
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
    const out = inConversation(() => drawMenu(dir, TRIAGE, undefined, SCREEN));

    assert.deepStrictEqual(markers(out), ['=== TITLE', '=== DISPLAY: triage', '=== MENU: triage']);
    assert.deepStrictEqual([sectionOf(out, 'TITLE'), sectionOf(out, 'DISPLAY: triage')], ['# **`■ Triage`**\n', 'Inbox: 2 ideas\n']);
    assert.deepStrictEqual(withEnv(conversation(), gateShown), {
      gate: 'triage',
      question: 'What would you like to do?',
      options: [
        { key: '1', word: null, head: 'The first idea', recommended: false, next: { kind: 'continue' } },
        { key: 'w', word: 'work', head: 'Work on what is picked', recommended: false, next: HANDED },
        { key: 'h', word: 'help', head: 'What this menu is for, row by row', recommended: false, next: { kind: 'engine', argv: ['render', 'help', 'triage'] } },
        { key: 'b', word: 'back', head: 'Back to the start menu', recommended: false, next: START_MENU },
      ],
      typed: [{ label: 'Pick', next: { kind: 'continue' } }],
    });
  });

  it('shows nothing above the question where the screen shows nothing, and the start menu\'s help row says how Leeway works', () => {
    const out = inConversation(() => drawMenu(dir, drawn('start-menu', ['s']), undefined, { title: 'Start', shows: [], rows: [{ key: 's', word: 'start', label: 'Start something new', next: HANDED }] }));

    assert.deepStrictEqual(markers(out), ['=== TITLE', '=== MENU: start menu']);
    assert.match(sectionOf(out, 'MENU: start menu'), /^\*\*`h\/help`\*\* +→ How Leeway works$/m);
  });

  it('`gate` answers with the next the row was drawn with — the help row\'s the menu\'s help as drawn, its argument among it', () => {
    show(EPIC_MENU, EPIC, { ...SCREEN, title: 'Discussion — Fumi', rows: [{ key: 'd', word: 'discovery', label: 'Change the map', next: HANDED }] });

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
      assert.throws(() => inConversation(() => drawMenu(dir, /** @type {Menu} */ (m), undefined, /** @type {MenuScreen} */ (screen))), { message: refusal });
    }
    assert.deepStrictEqual(position(), { name: EPIC });
  });
});

describe('where drawing a menu leaves the conversation (20.3.3, 20.3.8)', () => {
  it('the start menu and the project\'s menus beside it drop the position, so the board shows All work', () => {
    atTheEpic();
    inConversation(() => drawMenu(dir, TRIAGE, undefined, SCREEN));

    assert.strictEqual(position(), null);
  });

  it('the epic\'s menu records the conversation at its unit', () => {
    inConversation(() => drawMenu(dir, EPIC_MENU, EPIC, { ...SCREEN, rows: [] }));

    assert.deepStrictEqual(position(), { name: EPIC });
  });

  it('the roadmap records the conversation at the roadmap', () => {
    atTheEpic();
    inConversation(() => drawMenu(dir, ROADMAP, undefined, { title: 'Roadmap', shows: [], rows: [{ key: 'w', word: 'work', label: 'Work on items', next: HANDED }] }));

    assert.deepStrictEqual(position(), { name: 'roadmap' });
  });
});

describe('a menu\'s help (18.9.5, 23.2.1, 23.2.2)', () => {
  it('"■ Help · {Menu}", what the menu is for and a bullet a row, the invitation to ask, and its gate: back to the menu as drawn, and Ask leading into the conversation', () => {
    const out = inConversation(() => helpScreen(TRIAGE, undefined, parseHelp(HELP_TEXT, 'triage.help.md')));

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
      options: [{ key: 'b', word: 'back', head: 'Back to triage', recommended: false, next: { kind: 'engine', argv: ['render', 'triage'] } }],
      typed: [{ label: 'Ask', next: { kind: 'continue' } }],
    });
  });

  it('its back row draws a unit\'s menu again for that unit, under the menu\'s title', () => {
    const out = inConversation(() => helpScreen(EPIC_MENU, EPIC, parseHelp(HELP_TEXT, 'epic-menu.help.md')));

    assert.strictEqual(sectionOf(out, 'TITLE'), '# **`■ Help · Epic menu`**\n');
    assert.deepStrictEqual(withEnv(conversation(), gateShown).options[0].next, { kind: 'engine', argv: ['render', 'epic-menu', EPIC] });
  });

  it('`render help` refuses a menu the registry does not name, and one with no help yet', () => {
    assert.strictEqual(refuses(dir, ['render', 'help', 'inbox']).error, 'there is no menu "inbox" — the menus: start-menu, epic-menu, triage, archived, archived-item, roadmap, manage, manage-unit, closed, verdicts');
    assert.strictEqual(refuses(dir, ['render', 'help', 'triage']).error, 'triage has no help yet — its help is triage.help.md, beside its projection');
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
});

describe('a question typed, and the help row a gate never carries (18.9.2, 18.9.4)', () => {
  it('18.S38: a question typed at a menu answers no row — logged as free text, leading nowhere', () => {
    show(TRIAGE, undefined, SCREEN);

    assert.deepStrictEqual(ok(dir, ['gate', 'triage', '--typed'], { env: conversation() }), {
      ok: true, gate: 'triage', picked: null, recommended: null, via: 'typed', next: null,
    });
  });

  it('18.S51: a gate or a raise drawing h/help is refused; a menu draws it', () => {
    const rows = () => menu('', [cmdOption('y', 'yes', 'Go on'), cmdOption('h', 'help', 'Help')], { question: 'Go on?' });

    assert.throws(() => section('MENU: finish', MENU_INSTRUCTION, rows()), { message: 'finish: a gate or a raise carries no h/help row — a question typed at it sets it aside (18.9.4); only a menu draws help' });
    assert.throws(() => section('MENU: raise — 0a1b', MENU_INSTRUCTION, rows()), { message: 'raise — 0a1b: a gate or a raise carries no h/help row — a question typed at it sets it aside (18.9.4); only a menu draws help' });
    assert.match(menuSection('triage', MENU_INSTRUCTION, rows()), /^\*\*`h\/help`\*\* +→ Help$/m);
  });
});
