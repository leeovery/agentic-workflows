'use strict';

// ---------------------------------------------------------------------------
// The roadmap's menus (leeway-engine/scripts/domain/projections/roadmap.cjs,
// 18.8): `render roadmap`, the roadmap's home — a DATA line naming each
// waiting item by its number (18.8.5), the screen the projection composes,
// and the menu in the frame (18.8.10); where each row leads, through `gate
// roadmap`, followed through the verb the conversation runs after it, each
// reported in one line from its response or Claude's own (18.8.6, 18.8.12);
// its help; and `render roadmap-harvest`, the end of a session of the
// product's conversation, its yes landing the items, a long name cut short,
// and its refusals the batch's (18.8.18). The home's layout and rows are
// test-engine-roadmap-projections.cjs's at the unit layer, drawn here only
// as the render answers them; the frame and the help screen
// test-engine-menus.cjs's; the roadmap verbs' own transactions
// test-engine-roadmap.cjs's.
//
// Layer: verb. World: this file's own — one item off the inbox with its
// note, one the product's conversation proposed, one it parked, one a unit
// parked and one archived, each put on the roadmap through the verbs, and
// one in flight in an epic, its join written to the manifest as start this
// work writes it (roadmap-world.cjs's `joinedTo`) — built once and copied
// for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, output, refusedPristine, screenOf, sectionOf, commitAll, cleanupFixture, fixtureFrom } = require('./engine-harness.cjs');
const { createManifest, writeState, statePath, layout } = require('./discovery-test-utils.cjs');
const { runOk, readProject, writeSource, joinedTo } = require('./roadmap-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { SHOWN } = require(path.join(SCRIPTS, 'domain/gate.cjs'));
const { projectName } = require(path.join(SCRIPTS, 'domain/state-checks.cjs'));
const { roadmapState } = require(path.join(SCRIPTS, 'domain/roadmap.cjs'));
const { roadmapScreen } = require(path.join(SCRIPTS, 'domain/projections/roadmap.cjs'));

const SESSION = 'roadmap-session';
const ENV = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION });
const LOG = '.product/sessions/session-001.md';
const NOTE = layout.inbox('ideas', '2026-01-02--pinned-fumi.md');
const CARRY_ON = Object.freeze({ kind: 'continue' });

const world = fixtureFrom('engine-roadmap-menu-', (dir) => {
  writeSource(dir, LOG);
  writeState(dir, NOTE, '# A fumi pinned above every window\n');
  commitAll(dir, 'the inbox');
  const batch = writeState(dir, '.cache/triage-roadmap.json', JSON.stringify([{ name: 'pinned-fumi', horizon: 'next', summary: 'a fumi stays above every window', note: statePath(dir, NOTE) }]));
  runOk(dir, ['add-batch', '--file', batch]);
  runOk(dir, ['add', 'sign-in', '--horizon', 'next', '--summary', 'accounts and sessions']);
  runOk(dir, ['add', 'fumi-sync', '--horizon', 'later', '--summary', 'a hosted sync service', '--source', LOG]);
  runOk(dir, ['add', 'lifetime-tier', '--horizon', 'later', '--summary', 'pay once, keep it', '--origin', 'park:product', '--source', LOG]);
  runOk(dir, ['add', 'colour-drift', '--horizon', 'later', '--summary', 'tag colours drift on restore', '--kind', 'bug', '--origin', 'park:checkout']);
  runOk(dir, ['add', 'old-idea', '--horizon', 'later', '--summary', 'something set aside']);
  runOk(dir, ['archive', 'old-idea']);
  createManifest(dir, 'launch', { work_type: 'epic' });
  joinedTo(dir, 'launch', 'sign-in');
});

/** @type {string} */
let dir;
beforeEach(() => { dir = world(); });
afterEach(() => cleanupFixture(dir));

/**
 * A render drawn in the test's conversation: its output, its MENU under the
 * rule as it reads, and each row of the gate it states with where it leads.
 * @param {string[]} args @param {string} gate
 */
function drawn(args, gate) {
  const out = output(dir, ['render', ...args], { env: ENV });
  const shown = JSON.parse(fs.readFileSync(path.join(conversationDir(), SHOWN), 'utf8'));
  return {
    out,
    screen: screenOf(out, `MENU: ${gate}`),
    rows: /** @type {Record<string, any>} */ (Object.fromEntries([...shown.options, ...shown.typed].map((/** @type {{key: string, next: unknown}} */ { key, next }) => [key, next]))),
  };
}

/** The test's conversation's folder. */
const conversationDir = () => path.join(/** @type {string} */ (process.env.LEEWAY_CONFIG_DIR), 'conversations', SESSION);

/** The roadmap drawn. */
const roadmap = () => drawn(['roadmap'], 'roadmap');

/** The person's pick at the menu drawn last: what it leads to. @param {string} gate @param {string} key */
const picked = (gate, key) => ok(dir, ['gate', gate, '--pick', key], { env: ENV }).next;

/** What a MENU states above its question, its wrapping undone. @param {string[]} screen */
const statementOf = (screen) => screen.slice(1, screen.indexOf('')).join(' ');

/** The roadmap's tree as drawn. @param {string} out */
const treeOf = (out) => sectionOf(out, 'DISPLAY: roadmap').trimEnd().split('\n');


describe('the roadmap\'s home (18.8.10)', () => {
  it('18.S35: each waiting item on one line with its kind and where it came from, its summary in the DATA, and the rows work, new, move, archive, product, help and back — no converse row', () => {
    const { out, screen } = roadmap();

    assert.deepStrictEqual(sectionOf(out, 'DATA').trimEnd().split('\n'), ['item 1: pinned-fumi', 'item 2: fumi-sync', 'item 3: lifetime-tier', 'item 4: colour-drift']);
    assert.deepStrictEqual([sectionOf(out, 'TITLE'), treeOf(out)], [`# **\`■ Roadmap · ${projectName(dir)}\`**\n`, roadmapScreen(projectName(dir), roadmapState(dir)).shows]);
    assert.deepStrictEqual(treeOf(out).filter((line) => !line.startsWith(' ')), ['next (1)', '', 'later (3)'], 'sign-in, in flight, and old-idea, archived, are off the home');
    assert.deepStrictEqual(screen, [
      '· · · · · · · · · · · ·',
      '◆ What would you like to do?',
      '',
      'w/work    → Work on items now — discovery finds what kind of work',
      '            they are',
      'n/new     → Add an item — I\'ll ask what it is and which horizon',
      'm/move    → Move an item to another horizon you name',
      'a/archive → Archive an item',
      'p/product → Talk about the product as a whole',
      'h/help    → What this menu is for, row by row',
      'b/back    → Back to the start menu',
    ]);
  });

  it('18.S37, 18.8.7: p opens the product\'s conversation, the same one as the start menu\'s; b draws the start menu', () => {
    roadmap();
    const product = picked('roadmap', 'p');
    assert.deepStrictEqual(product, { kind: 'handoff', skill: 'leeway-discovery', args: ['none', 'none'] });
    assert.match(output(dir, ['handoff', product.skill, ...product.args]), /^→ Discovery$/m);
    roadmap();
    assert.deepStrictEqual(picked('roadmap', 'b'), { kind: 'engine', argv: ['render', 'start-menu'] });
  });

  it('18.S36, 18.8.6: n carries on, where Claude asks what and which horizon; the add reports itself in one line, and drawn again the item says it came from the roadmap', () => {
    roadmap();
    assert.deepStrictEqual(picked('roadmap', 'n'), CARRY_ON);
    assert.strictEqual(runOk(dir, ['add', 'widgets', '--horizon', 'next', '--summary', 'a fumi on the desktop', '--origin', 'roadmap']).said, 'On the roadmap: "Widgets" → next.');
    assert.match(sectionOf(roadmap().out, 'DISPLAY: roadmap'), /^next \(2\)\n.*\n {2}└─ 2\. Widgets +idea · roadmap$/m);
  });

  it('18.S50, 18.8.12: m carries on, where Claude asks which item and which horizon; the move puts it on the horizon named', () => {
    roadmap();
    assert.deepStrictEqual(picked('roadmap', 'm'), CARRY_ON);
    runOk(dir, ['move', 'fumi-sync', '--horizon', 'next']);
    assert.deepStrictEqual(sectionOf(roadmap().out, 'DATA').trimEnd().split('\n').slice(0, 2), ['item 1: pinned-fumi', 'item 2: fumi-sync']);
    assert.strictEqual(roadmapState(dir).items.find((/** @type {{name: string}} */ item) => item.name === 'fumi-sync')?.horizon, 'next');
  });

  it('18.8.13: a carries on, where Claude asks which item; archived, it is off the roadmap\'s home, and the numbers close up', () => {
    roadmap();
    assert.deepStrictEqual(picked('roadmap', 'a'), CARRY_ON);
    runOk(dir, ['archive', 'lifetime-tier']);
    const { out } = roadmap();
    assert.deepStrictEqual(sectionOf(out, 'DATA').trimEnd().split('\n'), ['item 1: pinned-fumi', 'item 2: fumi-sync', 'item 3: colour-drift']);
  });

  it('nothing waiting says so, with n and p alone beside help and back', () => {
    for (const name of ['pinned-fumi', 'fumi-sync', 'lifetime-tier', 'colour-drift']) runOk(dir, ['archive', name]);
    const { out, screen } = roadmap();

    assert.doesNotMatch(out, /=== (DATA|DISPLAY)/);
    assert.deepStrictEqual(screen, [
      '· · · · · · · · · · · ·',
      'Nothing waits on the roadmap.',
      '',
      '◆ What would you like to do?',
      '',
      'n/new     → Add an item — I\'ll ask what it is and which horizon',
      'p/product → Talk about the product as a whole',
      'h/help    → What this menu is for, row by row',
      'b/back    → Back to the start menu',
    ]);
  });

  it('its help says what the roadmap is, and what each row does; its back draws the roadmap again', () => {
    roadmap();
    const help = output(dir, ['render', 'help', 'roadmap'], { env: ENV });

    assert.match(sectionOf(help, 'DISPLAY: help'), /^The roadmap holds what you've shaped but not yet committed to\s+build, on horizons you name/);
    assert.match(sectionOf(help, 'DISPLAY: help'), /· New adds an item: I'll ask what it is and which horizon it\s+goes on; I never pick one\./);
    assert.deepStrictEqual(picked('help', 'b'), { kind: 'engine', argv: ['render', 'roadmap'] });
  });
});

describe('the end of a session of the product\'s conversation (18.8.18)', () => {
  /** The items the session proposes, written where the render reads them. @param {object[]} items */
  const proposed = (items) => writeState(dir, '.cache/product/discovery/product/roadmap-items.json', JSON.stringify(items));

  const FOUR = [
    { name: 'import-from-apple-stickies-and-every-notes-application', horizon: 'next', summary: 'bring notes over from Stickies', sources: [LOG] },
    { name: 'fumi-on-iphone', horizon: 'later', summary: 'fumi on the phone', sources: [LOG] },
    { name: 'desktop-widgets', horizon: 'later', summary: 'fumi as widgets', sources: [LOG] },
    { name: 'shared-fumis', horizon: 'someday', summary: 'fumis between people', sources: [LOG] },
  ];

  it('18.S63: the capabilities proposed show on one screen, each with its horizon, a long name cut short where it would run into it, and the person\'s yes lands them — Keep shaping carries on', () => {
    const file = proposed(FOUR);
    const { out, screen, rows } = drawn(['roadmap-harvest', '--file', file], 'roadmap harvest gate');

    assert.deepStrictEqual(sectionOf(out, 'DISPLAY: roadmap harvest').trimEnd().split('\n'), [
      'TO THE ROADMAP (4, from this conversation)',
      '  ├─ Import From Apple Stickies And Every Notes Applic…    [next]',
      '  ├─ Fumi On Iphone                                       [later]',
      '  ├─ Desktop Widgets                                      [later]',
      '  └─ Shared Fumis                                       [someday]',
    ]);
    assert.strictEqual(statementOf(screen), `Your yes puts these 4 on ${projectName(dir)}'s roadmap, each on the horizon you gave it.`);
    assert.deepStrictEqual(screen.slice(screen.indexOf('')), [
      '',
      '◆ Put them on the roadmap?',
      '',
      'y/yes        → Put them on the roadmap',
      'Keep shaping → Tell me what to change — an item or its horizon',
    ]);
    assert.deepStrictEqual([rows.y, rows['keep-shaping']], [{ kind: 'engine', argv: ['roadmap', 'add-batch', '--file', file] }, CARRY_ON]);

    ok(dir, rows.y.argv);
    assert.deepStrictEqual(Object.entries(readProject(dir).roadmap.items).filter(([, item]) => item.origin === 'harvest' && item.sources?.[0] === LOG).map(([name, item]) => [name, item.horizon]).slice(1),
      FOUR.map((item) => [item.name, item.horizon]));
  });

  it('one item is put on the roadmap as it', () => {
    const { screen } = drawn(['roadmap-harvest', '--file', proposed([FOUR[0]])], 'roadmap harvest gate');

    assert.strictEqual(statementOf(screen), `Your yes puts this one on ${projectName(dir)}'s roadmap, on the horizon you gave it.`);
    assert.deepStrictEqual(screen.slice(screen.indexOf('')), [
      '',
      '◆ Put it on the roadmap?',
      '',
      'y/yes        → Put it on the roadmap',
      'Keep shaping → Tell me what to change — an item or its horizon',
    ]);
  });

  it('refuses, writing nothing, what the batch would refuse: no file, a name on the roadmap, an archived one\'s, an illegal horizon, a source not on disk', () => {
    const harvest = (/** @type {object} */ item) => ['render', 'roadmap-harvest', '--file', proposed([{ ...FOUR[0], ...item }])];
    const refused = [
      () => ['render', 'roadmap-harvest'],
      () => harvest({ name: 'fumi-sync' }),
      () => harvest({ name: 'old-idea' }),
      () => harvest({ horizon: 'v1.5' }),
      () => harvest({ sources: ['.product/sessions/session-009.md'] }),
    ].map((args) => refusedPristine(dir, args(), { env: ENV }).error);

    assert.deepStrictEqual(refused.slice(0, 3), [
      'render roadmap-harvest: --file is required — the items the session proposes, as roadmap add-batch takes them',
      'render roadmap-harvest: "fumi-sync" is already on the roadmap — edit it, or pick a different name',
      'render roadmap-harvest: "old-idea" is archived on the roadmap, and its name stays taken — bring it back onto a horizon (engine roadmap move old-idea --horizon <h>), or name the new one apart',
    ]);
    assert.match(refused[3], /^render roadmap-harvest: entry 1 — "v1\.5" is not a legal horizon name/);
    assert.match(refused[4], /^render roadmap-harvest: source "\.product\/sessions\/session-009\.md" does not exist/);
  });
});
