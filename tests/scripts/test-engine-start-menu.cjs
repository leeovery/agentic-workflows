'use strict';

// ---------------------------------------------------------------------------
// The start menu (leeway-engine/scripts/domain/start-menu.cjs, its screen
// projections/start-menu.cjs; 18.2.12): a row per unit in progress, type
// first, with how far it has come and what waits on the person in it
// counted, the units with something waiting first, no topic on any row
// (18.2.1–18.2.6), read from the ledger in any conversation (12.13.7); the
// count leaving the verdicts out, which have the project's own row while
// they wait (18.2.11); the inbox as one line (18.2.8); one Start row, the
// product's row with its sessions and the research owed (18.2.13), triage,
// the roadmap, the view once a unit has closed (18.2.18), manage and help;
// and where each row leads, a unit's by Continue (19.1.3). Continue's own
// routes and refusals are test-engine-handoff.cjs's; the frame and the help
// screen test-engine-menus.cjs's.
//
// Layer: verb, `render start-menu` and `render help start-menu` run as the
// skill runs them, in a conversation of the test's own. World: the decided
// suites' (decided-world.cjs) — an epic in discussion and a feature —
// copied for each test, with the units a test needs beside them.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, output, sectionOf, writeState, layout } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT: FUMI, MADE } = require('./ledger-world.cjs');
const { NO_PAYLOAD, NOTE_MAP, writeIn, useDecidedWorld, decidedHelpers } = require('./decided-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { SHOWN } = require(path.join(SCRIPTS, 'domain/gate.cjs'));
const { NBSP } = require(path.join(SCRIPTS, 'domain/projections/surfaces.cjs'));
const { startMenuScreen } = require(path.join(SCRIPTS, 'domain/projections/start-menu.cjs'));

/** The decided world's conversation, where its raises are sealed and its screens drawn. */
const HERE = 'session-1';
/** A conversation that never drew or sealed anything: a new session. */
const NEW_SESSION = 'a-new-session';

/** A checklist closed. */
const CLOSED = Object.freeze({ items: {}, closed: '2026-10-01T09:00:00.000Z' });

/** A cut of three phases. */
const CUT = Object.freeze({ phases: [1, 2, 3].map((n) => ({ name: `Phase ${n}`, goal: 'A tally counts.', scenarios: [], sections: [String(n)], relies_on: [] })) });

/** The verdict page, where the e row leads (29.19's). */
const VERDICTS = Object.freeze({ kind: 'engine', argv: ['render', 'verdicts'] });

describe('the start menu (18.2.12)', () => {
  const dir = useDecidedWorld();
  const { close, staged, reverse } = decidedHelpers(dir);

  /**
   * The start menu drawn in the conversation `session`: its shown lines, and
   * its rows under the question as the screen reads them, their emphasis
   * dropped, each row whole however the frame wraps it.
   * @param {string} [session]
   */
  function startMenu(session = HERE) {
    const out = output(dir(), ['render', 'start-menu'], { env: { CLAUDE_CODE_SESSION_ID: session } });
    /** @param {string} name */
    const read = (name) => sectionOf(out, name).replace(/\*|`/g, '').replaceAll(NBSP, ' ').split('\n').slice(0, -1);
    const rows = read('MENU: start menu').slice(3).join('\n').replace(/\n +/g, ' ').split('\n');
    return { shown: read('DISPLAY: start-menu'), menu: rows.map((row) => row.replace(/^(\S+) +→/, '$1 →')) };
  }

  /** Each row of the gate the conversation `session` was last shown, with where it leads. @param {string} [session] */
  function rowsShown(session = HERE) {
    const shown = JSON.parse(fs.readFileSync(path.join(/** @type {string} */ (process.env.LEEWAY_CONFIG_DIR), 'conversations', session, SHOWN), 'utf8'));
    return Object.fromEntries(shown.options.map((/** @type {{key: string, next: unknown}} */ { key, next }) => [key, next]));
  }

  /** A feature in its build, its cut three phases, the checklists closed as given. @param {string} name @param {string[]} written */
  function building(name, written) {
    const checklists = Object.fromEntries(written.map((checklist) => [checklist, CLOSED]));
    createManifest(dir(), name, { work_type: 'feature', phases: { discussion: { items: { [name]: { status: 'completed' } } } }, build: { position: 'auto' }, cut: CUT, checklists });
  }

  /** A feature at its spec, a gap asked there: one question waiting, in the ledger. @param {string} name */
  function gapAtItsSpec(name) {
    createManifest(dir(), name, { work_type: 'feature', phases: { discussion: { items: { [name]: { status: 'completed' } } } } });
    writeState(dir(), layout.unit(name, 'spec.md'), '# Spec\n');
    writeIn(dir(), 'ask', `${name}.specification`, [], { ...MADE, text: 'Does a tally carry over midnight?' });
  }

  it('18.S1, 18.S2, 12.S31, 7.S16, 28.S1: a row per unit, type first, saying how far it has come and naming no topic — a build the phase it is at of every phase of its cut, one not yet written saying so; the unit with a question waiting first, its count read from the ledger in a new session; no waiting section', () => {
    building('ledger', ['phase-1-start', 'phase-1-close', 'phase-2-start']);
    building('paced', ['phase-1-start', 'phase-1-close']);
    gapAtItsSpec('tally');

    assert.deepStrictEqual(startMenu(NEW_SESSION).menu.slice(0, 6), [
      '1 → Continue feature: Tally — specification · 1 question waiting for you',
      '2 → Continue feature: Ledger — build, phase 2 of 3',
      '3 → Continue feature: Paced — build, phase 2 of 3, not yet written',
      '4 → Continue feature: Solo — discussion',
      '5 → Continue epic: Fumi — discussion, 0 of 2 topics decided',
      'p/product → Talk about the product',
    ]);
    assert.deepStrictEqual(Object.entries(rowsShown(NEW_SESSION)).slice(0, 5),
      ['tally', 'ledger', 'paced', 'solo', FUMI].map((unit, at) => [String(at + 1), { kind: 'engine', argv: ['handoff', 'unit', unit] }]),
      '24.S16: each row continues its unit where it stands');
  });

  it('18.S44, 18.S6: a unit\'s count takes in the gate waiting in it and never its verdict, which has the e row while it waits, leading to the verdict page — and none waiting, no e row', () => {
    const before = startMenu().menu;
    close();
    staged(NO_PAYLOAD);
    reverse(NOTE_MAP.sync.answer, 'Off until you turn it on.');
    const { menu } = startMenu();

    assert.deepStrictEqual([before.some((row) => row.startsWith('e/')), menu[0]], [false, '1 → Continue epic: Fumi — discussion, 0 of 2 topics decided · 1 gate waiting for you']);
    assert.ok(menu.includes('e/verdicts → Give the verdict waiting on a call you changed'), menu.join('\n'));
    assert.deepStrictEqual(rowsShown().e, VERDICTS);
  });

  it('18.2.3: the count says each kind waiting — the gates, the questions and the topics a changed answer holds — and the verdicts\' row how many wait', () => {
    /** @param {{gates: number, questions: number, topics: number}} waiting @param {number} verdicts */
    const screen = (waiting, verdicts) => startMenuScreen({
      units: [{ name: 'tally', type: 'feature', progress: 'specification', waiting }],
      inbox: { ideas: 0, bugs: 0, quickfixes: 0 }, product: { sessions: 0, last: null }, researchOwed: false, verdicts, closed: false, warnings: [],
    }).rows;
    const cue = (/** @type {ReturnType<typeof screen>} */ rows) => /** @type {{cue: string}} */ (rows[0].label).cue;
    const verdictRow = (/** @type {ReturnType<typeof screen>} */ rows) => rows.find(({ key }) => key === 'e')?.label;

    assert.deepStrictEqual([
      cue(screen({ gates: 0, questions: 1, topics: 0 }, 0)),
      cue(screen({ gates: 1, questions: 1, topics: 0 }, 0)),
      cue(screen({ gates: 1, questions: 2, topics: 1 }, 0)),
      cue(screen({ gates: 0, questions: 0, topics: 2 }, 0)),
      cue(screen({ gates: 0, questions: 0, topics: 0 }, 3)),
      verdictRow(screen({ gates: 0, questions: 0, topics: 0 }, 3)),
    ], [
      '1 question waiting for you',
      '1 gate and 1 question waiting for you',
      '1 gate, 2 questions and 1 topic waiting for you',
      '2 topics waiting for you',
      undefined,
      'Give the 3 verdicts waiting on calls you changed',
    ]);
  });

  it('18.S4, 18.S5, 18.S70, 18.S81: the inbox one line counted by kind, "Inbox: empty" with nothing in it; one Start row; the product\'s row, its sessions and last date once it has them and the research while owed; triage, the roadmap, manage and help always, and the view once a unit has closed — each row leading where it says', () => {
    const empty = startMenu();
    for (const [kind, slug] of [['ideas', 'saved-filters'], ['ideas', 'dark-mode'], ['bugs', 'lost-notes'], ['quickfixes', 'typo']]) {
      writeState(dir(), `.inbox/${kind}/2026-10-01--${slug}.md`, `# ${slug}\n`);
    }
    ok(dir(), ['enter', 'discovery', 'product'], { env: { CLAUDE_CODE_SESSION_ID: HERE } });
    ok(dir(), ['brownfield', 'record', 'accepted']);
    createManifest(dir(), 'shipped', { work_type: 'feature', status: 'completed' });
    const full = startMenu();
    const rows = (/** @type {string[]} */ menu) => menu.filter((row) => /^[a-z]\//.test(row));

    assert.deepStrictEqual([empty.shown, full.shown], [['Inbox: empty'], ['Inbox: 2 ideas · 1 bug · 1 quick-fix']]);
    assert.deepStrictEqual(rows(empty.menu), [
      'p/product → Talk about the product',
      's/start → Start something new — describe it, and we\'ll find what kind of work it is',
      't/triage → Triage the inbox',
      'r/roadmap → Open the product roadmap',
      'm/manage → Manage work units',
      'h/help → How Leeway works',
    ]);
    assert.match(rows(full.menu)[0], /^p\/product → Talk about the product — 1 session, last on \d{1,2} [A-Z][a-z]{2} · research owed$/);
    assert.deepStrictEqual(rows(full.menu).slice(1), [
      's/start → Start something new — describe it, and we\'ll find what kind of work it is',
      't/triage → Triage the inbox',
      'r/roadmap → Open the product roadmap',
      'v/view → View completed & cancelled work units',
      'm/manage → Manage work units',
      'h/help → How Leeway works',
    ]);
    assert.deepStrictEqual(rowsShown(), {
      1: { kind: 'engine', argv: ['handoff', 'unit', 'solo'] },
      2: { kind: 'engine', argv: ['handoff', 'unit', FUMI] },
      p: { kind: 'handoff', skill: 'leeway-discovery', args: ['none', 'none'] },
      s: { kind: 'handoff', skill: 'leeway-discovery', args: ['start', 'none'] },
      t: { kind: 'continue' },
      r: { kind: 'handoff', skill: 'leeway-roadmap', args: ['open'] },
      v: { kind: 'continue' },
      m: { kind: 'continue' },
      h: { kind: 'engine', argv: ['render', 'help', 'start-menu'] },
    });
  });

  it('20.3.3: drawn, the start menu leaves the conversation at no position, and `gate` answers a row with where it leads', () => {
    const position = () => {
      const file = path.join(/** @type {string} */ (process.env.LEEWAY_CONFIG_DIR), 'conversations', HERE, 'position.json');
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    };
    ok(dir(), ['session', 'label', FUMI], { env: { CLAUDE_CODE_SESSION_ID: HERE } });
    const atTheEpic = position();
    startMenu();

    assert.deepStrictEqual([atTheEpic, position()], [{ name: FUMI }, null]);
    assert.deepStrictEqual(ok(dir(), ['gate', 'start menu', '--pick', '2'], { env: { CLAUDE_CODE_SESSION_ID: HERE } }).next, { kind: 'engine', argv: ['handoff', 'unit', FUMI] });
  });

  it('23.2.3: its help, until the help home, a row into the walk through Leeway, the help skill', () => {
    const out = output(dir(), ['render', 'help', 'start-menu'], { env: { CLAUDE_CODE_SESSION_ID: HERE } });

    assert.match(sectionOf(out, 'MENU: help'), /w\/walk`\*\* +→ Walk through how Leeway works/);
    assert.deepStrictEqual(rowsShown().w, { kind: 'invoke', skill: 'leeway-help', args: [] });
  });
});
