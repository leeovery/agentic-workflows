'use strict';

// ---------------------------------------------------------------------------
// The epic's menu (leeway-engine/scripts/domain/projections/epic-menu.cjs,
// 18.4.17): `render epic-menu <epic>` — its heading the phase the epic is
// in, the tally beneath it, DECIDED and SET ASIDE listed with no key, the
// topics by what they need, the way on past them, discovery's row while the
// map is open, the recommended row first; the complete variant; where each
// row leads, through `gate "epic menu"`; and what the render refuses. What
// waits on the person: test-engine-epic-menu-waits.cjs.
//
// Layer: verb. World: an epic, `fumi`, mid-discussion, its manifest and its
// mailboxes written by hand, built once and copied for each test; each test
// keeps its conversation in a config folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ok, output, refusedPristine, screenOf, sectionOf, readManifest, writeState, layout, treeSnapshot, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest, useTempFolder } = require('./discovery-test-utils.cjs');
const { fixture } = require('./board-world.cjs');

const EPIC = 'fumi';
const SESSION = 'c0ffee00-1234-4abc-8def-0123456789ab';
const PEER = String(process.ppid);
const GONE = '2147483646';
const START_MENU = Object.freeze({ kind: 'engine', argv: ['render', 'start-menu'] });

/** A map row, in the map's order. @param {number} order @param {Record<string, unknown>} [marks] */
const row = (order, marks = {}) => ({ order, source: 'discovery', summary: `Topic ${order}`, ...marks });

/** A cut of two phases, the second relying on the first. */
const TWO_PHASES = Object.freeze({ phases: [{ name: 'Cards', scenarios: [], sections: ['1'], relies_on: [] }, { name: 'Refunds', scenarios: [], sections: ['2'], relies_on: [1] }] });
const CLOSED = Object.freeze({ items: {}, closed: '2026-11-01T00:00:00.000Z' });

/** The epic mid-discussion: two topics decided, three in progress, one not started, one cancelled, one postponed. */
const DISCUSSING = Object.freeze({
  work_type: 'epic',
  phases: {
    discovery: {
      approved_at: '2026-10-01T09:00:00.000Z',
      items: {
        'note-model': row(1), 'storage-and-sync': row(2), 'management-window': row(3), onboarding: row(4), licensing: row(5), 'build-and-release': row(6),
        positioning: row(7, { cancelled: true }), website: row(8, { postponed: true }),
      },
    },
    discussion: {
      items: {
        'note-model': { status: 'completed' }, 'storage-and-sync': { status: 'completed' },
        'management-window': { status: 'in-progress' }, onboarding: { status: 'in-progress' }, licensing: { status: 'in-progress' },
        positioning: { status: 'cancelled', previous_status: 'in-progress' }, website: { status: 'postponed', previous_status: 'in-progress' },
      },
    },
  },
});

const world = fixtureFrom('epic-menu-', (dir) => {
  createManifest(dir, EPIC, DISCUSSING);
  const project = JSON.parse(fs.readFileSync(path.join(dir, '.leeway', 'manifest.json'), 'utf8'));
  fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify({
    ...project,
    roadmap: { horizons: ['next', 'later'], items: { website: { horizon: 'next', summary: 'The website', origin: `postpone:${EPIC}`, postponed_from: { work_unit: EPIC, topic: 'website' } } } },
  }, null, 2));
  for (const topic of ['management-window', 'build-and-release']) writeState(dir, layout.mailbox(EPIC, topic, '001-from-note-model.md'), 'Note model decided notes open where they were made.\n');
});

const config = useTempFolder('epic-menu-config-');

/** @type {string} */
let dir;
beforeEach(() => { dir = world(); });
afterEach(() => cleanupFixture(dir));

/** The calling conversation's environment. */
const conversation = () => ({ CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: String(process.pid), LEEWAY_CONFIG_DIR: config(), TMUX: undefined, TMUX_PANE: undefined });

/** The epic's menu as this conversation draws it. @param {string} [unit] */
const menuOf = (unit = EPIC) => output(dir, ['render', 'epic-menu', unit], { env: conversation() });

/** The epic laid over with `more`. @param {Record<string, any>} more */
const epicAs = (more) => createManifest(dir, EPIC, { ...DISCUSSING, ...more });

/** Every topic of the epic settled: decided, but the cancelled and the postponed. */
function settled() {
  const manifest = readManifest(dir, EPIC);
  for (const topic of ['management-window', 'onboarding', 'licensing']) manifest.phases.discussion.items[topic].status = 'completed';
  manifest.phases.discussion.items['build-and-release'] = { status: 'completed' };
  createManifest(dir, EPIC, manifest);
}

/** The person's pick at the menu drawn last: what it leads to. @param {string} key */
const picked = (key) => ok(dir, ['gate', 'epic menu', '--pick', key], { env: conversation() }).next;

/** A presence beat on one of the epic's topics, as the conversation `session` in the process `pid` beats it. @param {string} phase @param {string} topic @param {string} session @param {string} pid */
function beat(phase, topic, session, pid) {
  const own = fs.mkdtempSync(path.join(os.tmpdir(), 'epic-menu-peer-'));
  try {
    ok(dir, ['presence', 'beat', EPIC, phase, topic], { env: { LEEWAY_CONFIG_DIR: own, CLAUDE_CODE_SESSION_ID: session, CLAUDE_PID: pid, TMUX: undefined } });
  } finally {
    fs.rmSync(own, { recursive: true, force: true });
  }
}

/** The menu's rows as the screen reads them, from the rule down. @param {string} out */
const rowsOf = (out) => screenOf(out, 'MENU: epic menu').slice(3);

describe('the screen (18.4.17)', () => {
  it('the epic menu the gate mod\'s band tests draw (18.S42, 18.S65) is the engine\'s answer under the gate surface', async () => {
    const out = output(dir, ['render', 'epic-menu', EPIC], { env: { ...conversation(), LEEWAY_GATE_SURFACE: '1' } });

    assert.strictEqual(out, await fixture('menu-epic.mjs'));
  });

  it('18.S10, 18.S14, 18.S16, 18.S19, 18.S20, 18.S46, 8.S8, 9.S20, 10.S5: in discussion — the phase as the heading, the tally, DECIDED and SET ASIDE with no key, the topics by what they need, discovery\'s row, help and back', () => {
    beat('discussion', 'licensing', 'peer', PEER);
    const out = menuOf();

    assert.strictEqual(sectionOf(out, 'TITLE'), '# **`■ Discussion — Fumi`**\n');
    assert.deepStrictEqual(screenOf(out, 'DISPLAY: epic-menu'), [
      '8 topics · 2 decided · 3 in progress · 1 not started ·',
      '1 cancelled · 1 postponed',
      '',
      'DECIDED',
      '  ├─ Note Model',
      '  └─ Storage And Sync',
      '',
      'SET ASIDE',
      '  ├─ Positioning — cancelled',
      '  └─ Website — postponed · roadmap next',
    ]);
    assert.deepStrictEqual(screenOf(out, 'MENU: epic menu'), [
      '· · · · · · · · · · · ·',
      '◆ What would you like to do?',
      '',
      '1           → Continue "Management Window" — in progress · mail',
      '              waiting (recommended)',
      '2           → Continue "Onboarding" — in progress',
      '3           → ~~Continue "Licensing" — in progress~~ · in session',
      '              (last active 0s ago)',
      '4           → Start "Build And Release" — not started · mail',
      '              waiting',
      'd/discovery → Change the map — a new topic, cancel, postpone,',
      '              pull forward, reactivate, or reopen a decided topic',
      'h/help      → What this menu is for, row by row',
      'b/back      → Back to the start menu',
    ]);
  });

  it('18.S46: the tally counts every topic once — its counts sum to its topics', () => {
    const [tally] = screenOf(menuOf(), 'DISPLAY: epic-menu').join(' ').split('  ');
    const [topics, ...counts] = tally.split(' · ').map((part) => Number(part.split(' ')[0]));

    assert.deepStrictEqual([topics, counts.reduce((a, b) => a + b, 0)], [8, 8]);
  });

  it('18.S11: no spec row while a topic is neither decided, cancelled nor postponed; once each is, the spec\'s row is offered and recommended, carried on once the spec is written', () => {
    const open = rowsOf(menuOf());
    settled();
    const offered = rowsOf(menuOf());
    writeState(dir, `${EPIC}/spec.md`, '# Fumi\n');

    assert.deepStrictEqual([open.filter((r) => r.startsWith('s/')), offered.slice(0, 2), rowsOf(menuOf()).slice(0, 2)], [[], [
      's/spec      → Start the specification — every topic is decided or',
      '              set aside (recommended)',
    ], [
      's/spec → Continue the specification (recommended)',
      'h/help → What this menu is for, row by row',
    ]]);
  });

  it('18.S55, 18.S11: once the spec is written the map is closed — no discovery row — and every topic decided says so', () => {
    epicAs({ phases: { discovery: { approved_at: '2026-10-01T09:00:00.000Z', items: { cards: row(1) } }, discussion: { items: { cards: { status: 'completed' } } } } });
    const open = rowsOf(menuOf());
    writeState(dir, `${EPIC}/spec.md`, '# Fumi\n');

    assert.deepStrictEqual([open, rowsOf(menuOf())], [[
      's/spec      → Start the specification — every topic is decided',
      '              (recommended)',
      'd/discovery → Change the map — a new topic, cancel, postpone,',
      '              pull forward, reactivate, or reopen a decided topic',
      'h/help      → What this menu is for, row by row',
      'b/back      → Back to the start menu',
    ], [
      's/spec → Continue the specification (recommended)',
      'h/help → What this menu is for, row by row',
      'b/back → Back to the start menu',
    ]]);
  });

  it('18.S12, 12.S48: in the build its row at the phase it is at, of its cut\'s, the phase named in the heading alone; then the review', () => {
    const built = { phases: { discovery: { approved_at: '2026-10-01T09:00:00.000Z', items: { cards: row(1) } }, discussion: { items: { cards: { status: 'completed' } } } }, build: { position: 'auto' }, cut: TWO_PHASES };
    epicAs(built);
    const building = menuOf();
    epicAs({ ...built, checklists: { 'phase-1-close': CLOSED, 'phase-2-close': CLOSED } });
    const reviewing = menuOf();

    assert.deepStrictEqual([sectionOf(building, 'TITLE'), rowsOf(building), sectionOf(reviewing, 'TITLE'), rowsOf(reviewing)], [
      '# **`■ Build — Fumi`**\n', [
        '1      → Continue the build — phase 1 of 2, not yet written',
        '         (recommended)',
        'h/help → What this menu is for, row by row',
        'b/back → Back to the start menu',
      ],
      '# **`■ Review — Fumi`**\n', [
        '1      → Continue the review (recommended)',
        'h/help → What this menu is for, row by row',
        'b/back → Back to the start menu',
      ],
    ]);
  });

  it('18.S77: a finished epic\'s menu is its complete variant — its heading, its tally and its lists, and help and back alone', () => {
    settled();
    createManifest(dir, EPIC, { ...readManifest(dir, EPIC), status: 'completed' });
    const out = menuOf();

    assert.deepStrictEqual([sectionOf(out, 'TITLE'), screenOf(out, 'DISPLAY: epic-menu')[0], rowsOf(out)], [
      '# **`■ Complete — Fumi`**\n',
      '8 topics · 6 decided · 1 cancelled · 1 postponed',
      ['h/help → What this menu is for, row by row', 'b/back → Back to the start menu'],
    ]);
  });

  it('19.S4: the heading follows the epic through discovery, discussion, specification, the build and the review', () => {
    const headings = [];
    const heading = () => headings.push(sectionOf(menuOf(), 'TITLE').replace(/^# \*\*`■ | — Fumi`\*\*\n$/g, ''));
    epicAs({ phases: { discovery: { items: {} } } });
    heading();
    epicAs({});
    heading();
    settled();
    writeState(dir, `${EPIC}/spec.md`, '# Fumi\n');
    heading();
    const decided = readManifest(dir, EPIC);
    createManifest(dir, EPIC, { ...decided, build: { position: 'auto' }, cut: TWO_PHASES });
    heading();
    createManifest(dir, EPIC, { ...decided, build: { position: 'auto' }, cut: TWO_PHASES, checklists: { 'phase-1-close': CLOSED, 'phase-2-close': CLOSED } });
    heading();

    assert.deepStrictEqual(headings, ['Discovery', 'Discussion', 'Specification', 'Build', 'Review']);
  });

  it('a topic\'s experiments waiting count its top-level records, a split worked through its parent', () => {
    epicAs({ phases: { ...DISCUSSING.phases, experiment: { items: { onboarding: { status: 'in-progress', experiments: {
      E1: { slug: 'first-run', status: 'designed' }, 'E1.1': { slug: 'first-run-split', status: 'designed' }, E2: { slug: 'permissions', status: 'concluded' },
    } } } } } });

    assert.deepStrictEqual(rowsOf(menuOf()).slice(2, 4), ['2           → Continue "Onboarding" in the laboratory — 1', '              experiment waiting']);
  });

  it('an epic built under the old plan says it waits on the migration\'s cut in place of its build\'s row (P12)', () => {
    epicAs({ phases: { ...DISCUSSING.phases, implementation: { items: { billing: { status: 'in-progress' } } } } });
    const menu = screenOf(menuOf(), 'MENU: epic menu');

    assert.deepStrictEqual(menu.slice(1, 3), ['fumi was built under the old plan, and its build is entered once', 'the reshape\'s 29.17 migration has cut it']);
    assert.ok(!menu.some((line) => line.includes('Continue the build')));
  });
});

describe('the recommended row (18.4.7, 18.4.21)', () => {
  it('18.S13, 8.S41: the recommended row is the first in the map\'s foundations-first order, and leads the menu', () => {
    epicAs({ phases: { discovery: { approved_at: '2026-10-01T09:00:00.000Z', items: { later: row(2), first: row(1), last: row(3) } }, discussion: { items: {} } } });

    assert.deepStrictEqual(rowsOf(menuOf()).slice(0, 3), [
      '1           → Start "First" — not started (recommended)',
      '2           → Start "Later" — not started',
      '3           → Start "Last" — not started',
    ]);
  });

  it('18.S13, 8.S41: the recommendation is the first topic that can be worked in the map\'s order, drawn first, the rest grouped by what they need', () => {
    epicAs({ phases: { discovery: { approved_at: '2026-10-01T09:00:00.000Z', items: { second: row(2), first: row(1) } }, discussion: { items: { second: { status: 'in-progress' } } } } });

    assert.deepStrictEqual(rowsOf(menuOf()).slice(0, 2), [
      '1           → Start "First" — not started (recommended)',
      '2           → Continue "Second" — in progress',
    ]);
  });

  it('past discovery, discovery\'s row is never recommended — with every topic held elsewhere, no row is', () => {
    epicAs({ phases: { discovery: { approved_at: '2026-10-01T09:00:00.000Z', items: { cards: row(1) } }, discussion: { items: { cards: { status: 'in-progress' } } } } });
    beat('discussion', 'cards', 'peer', PEER);

    assert.ok(!rowsOf(menuOf()).some((line) => line.includes('(recommended)')));
  });

  it('18.S57, 18.S14: a topic another conversation holds is never recommended — it keeps its place, struck, and the recommendation leads with the next', () => {
    beat('discussion', 'management-window', 'peer', PEER);

    assert.deepStrictEqual(rowsOf(menuOf()).slice(0, 4), [
      '1           → Continue "Onboarding" — in progress (recommended)',
      '2           → ~~Continue "Management Window" — in progress · mail~~',
      '              ~~waiting~~ · in session (last active 0s ago)',
      '3           → Continue "Licensing" — in progress',
    ]);
  });

  it('1.S8, 18.S69: this conversation\'s own hold never reads as another session, and a session that ended holds nothing', () => {
    beat('discussion', 'management-window', SESSION, PEER);
    beat('discussion', 'onboarding', 'gone', GONE);

    assert.ok(!rowsOf(menuOf()).some((line) => line.includes('in session')));
  });
});

describe('where each row leads (18.4.17)', () => {
  it('a topic into its conversation by `handoff topic`, which refuses a pick gone stale; discovery\'s row into the epic\'s discovery; help the menu\'s help as drawn; back the start menu', () => {
    const nexts = ['1', '4', 'd', 'h', 'b'].map((key) => {
      menuOf();
      return picked(key);
    });

    assert.deepStrictEqual(nexts, [
      { kind: 'engine', argv: ['handoff', 'topic', EPIC, 'management-window'] },
      { kind: 'engine', argv: ['handoff', 'topic', EPIC, 'build-and-release'] },
      { kind: 'handoff', skill: 'leeway-discovery', args: ['none', EPIC] },
      { kind: 'engine', argv: ['render', 'help', 'epic-menu', EPIC] },
      START_MENU,
    ]);
  });

  it('the spec\'s row into the specification, the build\'s into the build and the review\'s into the review, each at the unit', () => {
    settled();
    menuOf();
    const spec = picked('s');
    const built = { build: { position: 'auto' }, cut: TWO_PHASES };
    createManifest(dir, EPIC, { ...readManifest(dir, EPIC), ...built });
    menuOf();
    const build = picked('1');
    createManifest(dir, EPIC, { ...readManifest(dir, EPIC), checklists: { 'phase-1-close': CLOSED, 'phase-2-close': CLOSED } });
    menuOf();

    assert.deepStrictEqual([spec, build, picked('1')], [
      { kind: 'handoff', skill: 'leeway-specification-process', args: ['epic', EPIC] },
      { kind: 'handoff', skill: 'leeway-implementation-process', args: ['epic', EPIC] },
      { kind: 'handoff', skill: 'leeway-review-process', args: ['epic', EPIC] },
    ]);
  });

  it('the menu\'s help is drawn for the epic, its back the menu again', () => {
    const help = output(dir, ['render', 'help', 'epic-menu', EPIC], { env: conversation() });

    assert.strictEqual(sectionOf(help, 'TITLE'), '# **`■ Help · Epic menu`**\n');
    assert.deepStrictEqual(ok(dir, ['gate', 'help', '--pick', 'b'], { env: conversation() }).next, { kind: 'engine', argv: ['render', 'epic-menu', EPIC] });
  });
});

describe('what the render does and refuses', () => {
  it('1.S8, 8.S30, 8.S34: drawing the menu writes nothing in the state — no analysis, no backfill, no stamp — and records the conversation at the epic', () => {
    const before = treeSnapshot(dir);
    menuOf();

    assert.deepStrictEqual(treeSnapshot(dir), before);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(config(), 'conversations', SESSION, 'position.json'), 'utf8')), { name: EPIC });
  });

  it('refuses a unit this project lacks, a unit of another type, and a cancelled epic, writing nothing', () => {
    createManifest(dir, 'solo', { work_type: 'feature' });
    createManifest(dir, 'gone-epic', { work_type: 'epic', status: 'cancelled' });
    const refused = ['nowhere', 'solo', 'gone-epic'].map((unit) => refusedPristine(dir, ['render', 'epic-menu', unit], { env: conversation() }).error);

    assert.deepStrictEqual(refused, [
      'there is no work unit "nowhere" — the start menu lists the work in progress',
      'solo is a feature — only an epic has a menu of its own',
      'gone-epic is cancelled — reactivating it comes first',
    ]);
    assert.strictEqual(fs.existsSync(path.join(config(), 'conversations', SESSION, 'position.json')), false);
  });
});
