'use strict';

// ---------------------------------------------------------------------------
// The start menu (leeway-engine/scripts/domain/start-menu.cjs, its screen
// projections/start-menu.cjs; 18.2.12): a row per unit in progress, type
// first, with how far it has come and what waits on the person in it
// counted, each kind of wait in one count, the units with something waiting
// first, then by type, no topic on any row (18.2.1–18.2.6), read from the
// ledger in any conversation (12.13.7) and a raise sealed in the
// conversation that drew it; mail waiting for a unit's topic beside the
// count, never in it (10.4.3); the count leaving the verdicts out, which
// have the project's own row while they wait (18.2.11); the inbox as one
// line (18.2.8); one Start row, the product's row with its sessions and the
// research owed (18.2.13, 8.12.13), triage, the roadmap, the view once a
// unit has closed (18.2.18), manage and help, its walk carried on in the
// start skill; and where each row leads, a unit's by Continue (19.1.3).
// Continue's own routes and refusals are test-engine-handoff.cjs's; the
// frame and the help screen test-engine-menus.cjs's.
//
// Layer: verb, `render start-menu` and `render help start-menu` run as the
// skill runs them, in a conversation of the test's own, and the count's
// kinds in process. World: the decided suites' (decided-world.cjs) — an
// epic in discussion and a feature — copied for each test, with the units a
// test needs beside them; a builder's question parked in the ledger, the
// review phase's (review-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, okSectionsAsync, output, sectionOf, writeState, layout, commitAll } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT: FUMI, MADE, leaningCall } = require('./ledger-world.cjs');
const { NO_PAYLOAD, NOTE_MAP, writeIn, useDecidedWorld, decidedHelpers } = require('./decided-world.cjs');
const review = require('./review-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { SHOWN } = require(path.join(SCRIPTS, 'domain/gate.cjs'));
const { NBSP } = require(path.join(SCRIPTS, 'domain/projections/surfaces.cjs'));
const { WAIT_KINDS } = require(path.join(SCRIPTS, 'domain/waits.cjs'));
const { counts } = require(path.join(SCRIPTS, 'domain/start-menu.cjs'));
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

/**
 * The start menu drawn in `dir` in the conversation `env` names: its shown
 * lines, and its rows under the question as the screen reads them, their
 * emphasis dropped, each row whole however the frame wraps it.
 * @param {string} dir @param {Record<string, string|undefined>} env
 */
function drawnIn(dir, env) {
  const out = output(dir, ['render', 'start-menu'], { env });
  /** @param {string} name */
  const read = (name) => sectionOf(out, name).replace(/\*|`/g, '').replaceAll(NBSP, ' ').split('\n').slice(0, -1);
  const rows = read('MENU: start menu').slice(3).join('\n').replace(/\n +/g, ' ').split('\n');
  return { shown: read('DISPLAY: start-menu'), menu: rows.map((row) => row.replace(/^(\S+) +→/, '$1 →')) };
}

describe('the start menu (18.2.12)', () => {
  const dir = useDecidedWorld();
  const { close, staged, reverse } = decidedHelpers(dir);

  /** The start menu drawn in the conversation `session`. @param {string} [session] */
  const startMenu = (session = HERE) => drawnIn(dir(), { CLAUDE_CODE_SESSION_ID: session });

  /** Each row of the gate the conversation `session` was last shown, with where it leads. @param {string} [session] */
  function rowsShown(session = HERE) {
    const shown = JSON.parse(fs.readFileSync(path.join(/** @type {string} */ (process.env.LEEWAY_CONFIG_DIR), 'conversations', session, SHOWN), 'utf8'));
    return Object.fromEntries(shown.options.map((/** @type {{key: string, next: unknown}} */ { key, next }) => [key, next]));
  }

  /** The rows after the units', each a letter's. @param {string[]} menu */
  const lettered = (menu) => menu.filter((row) => /^[a-z]\//.test(row));

  /** A feature in its build, its cut three phases, the checklists closed as given. @param {string} name @param {string[]} written */
  function building(name, written) {
    const checklists = Object.fromEntries(written.map((checklist) => [checklist, CLOSED]));
    createManifest(dir(), name, { work_type: 'feature', phases: { discussion: { items: { [name]: { status: 'completed' } } } }, build: { position: 'auto' }, cut: CUT, checklists });
  }

  /** A bug entered at its investigation. @param {string} bug */
  function hunting(bug) {
    createManifest(dir(), bug, { work_type: 'bugfix', description: `${bug} loses the saved state` });
    commitAll(dir(), `the bug ${bug}`);
    ok(dir(), ['enter', 'investigation', bug], { env: { CLAUDE_CODE_SESSION_ID: HERE, CLAUDE_PID: undefined } });
  }

  /** Claude's question at the bug's investigation, raised and sealed in the conversation HERE. @param {string} bug */
  async function raisedAt(bug) {
    const at = `${bug}.investigation.${bug}`;
    const question = `What does ${bug} lose?`;
    const asked = writeIn(dir(), 'ask', at, [], { ...MADE, text: question });
    await okSectionsAsync(dir(), ['raise', at, '--answers', asked], { env: { CLAUDE_CODE_SESSION_ID: HERE, TMUX: undefined, TMUX_PANE: undefined }, stdin: JSON.stringify({ ...leaningCall('Every session.', 'The last one.'), question }) });
  }

  /** A message waiting in `unit`'s topic's mailbox. @param {string} unit @param {string} topic */
  const mailFor = (unit, topic) => writeState(dir(), `${unit}/topics/${topic}/mail/001-a-note.md`, '# A note\n\nFrom Discovery · 1 Oct\n');

  it('18.S1, 7.S16, 28.S1: a row per unit, type first, saying how far it has come and naming no topic — a build the phase it is at of every phase of its cut, one not yet written saying so — each continuing its unit; no waiting section', () => {
    building('ledger', ['phase-1-start', 'phase-1-close', 'phase-2-start']);
    building('paced', ['phase-1-start', 'phase-1-close']);

    assert.deepStrictEqual(startMenu().menu.slice(0, 5), [
      '1 → Continue feature: Ledger — build, phase 2 of 3',
      '2 → Continue feature: Paced — build, phase 2 of 3, not yet written',
      '3 → Continue feature: Solo — discussion',
      '4 → Continue epic: Fumi — discussion, 0 of 2 topics decided',
      'p/product → Talk about the product',
    ]);
    assert.deepStrictEqual(Object.entries(rowsShown()).slice(0, 4),
      ['ledger', 'paced', 'solo', FUMI].map((unit, at) => [String(at + 1), { kind: 'engine', argv: ['handoff', 'unit', unit] }]),
      '24.S16: each row continues its unit where it stands');
  });

  it('18.2.3: every kind of wait lands in exactly one count — approve the map, decided, ready to build and finish the gates, a question the questions, a decided topic a replaced answer holds the topics — and a verdict in none', () => {
    /** The count each kind of wait lands in. */
    const landsIn = Object.fromEntries(WAIT_KINDS.map((kind) => {
      const waiting = counts([/** @type {any} */ ({ kind })]);
      return [kind, Object.keys(waiting).filter((count) => waiting[/** @type {keyof typeof waiting} */ (count)] === 1).join(', ') || null];
    }));

    assert.deepStrictEqual(landsIn, { map: 'gates', decided: 'gates', ready: 'gates', finish: 'gates', question: 'questions', affected: 'topics', verdict: null });
  });

  it('18.S44, 18.S6: a unit\'s count takes in the gate waiting in it and never its verdict, which has the e row while it waits, leading to the verdict page, which draws — and none waiting, no e row', () => {
    const before = startMenu().menu;
    close();
    staged(NO_PAYLOAD);
    reverse(NOTE_MAP.sync.answer, 'Off until you turn it on.');
    const { menu } = startMenu();

    assert.deepStrictEqual([before.some((row) => row.startsWith('e/')), menu[0]], [false, '1 → Continue epic: Fumi — discussion, 0 of 2 topics decided · 1 gate waiting for you']);
    assert.ok(menu.includes('e/verdicts → Give the verdict waiting on a call you changed'), menu.join('\n'));
    assert.deepStrictEqual(rowsShown().e, VERDICTS);
    const page = output(dir(), VERDICTS.argv, { env: { CLAUDE_CODE_SESSION_ID: HERE } });
    assert.match(sectionOf(page, 'MENU: verdicts'), /n\/nothing/);
  });

  it('18.2.3: the count says each kind waiting — the gates, the questions and the topics a changed answer holds — and the verdicts\' row how many wait', () => {
    /** @param {{gates: number, questions: number, topics: number}} waiting @param {number} verdicts */
    const screen = (waiting, verdicts) => startMenuScreen({
      units: [{ name: 'tally', type: 'feature', progress: 'specification', waiting, mail: false }],
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

  it('N1: a raise sealed at a bug\'s investigation counts on its row in the conversation that drew it, listing it first, and in no other', async () => {
    hunting('kill-all');
    await raisedAt('kill-all');

    assert.deepStrictEqual([startMenu().menu[0], startMenu(NEW_SESSION).menu.slice(0, 3)], [
      '1 → Continue bugfix: Kill All — investigation · 1 question waiting for you',
      ['1 → Continue feature: Solo — discussion', '2 → Continue bugfix: Kill All — investigation', '3 → Continue epic: Fumi — discussion, 0 of 2 topics decided'],
    ]);
  });

  it('10.4.3: mail waiting for a unit\'s topic shows on its row, beside the count and never in it, its place among the rows unmoved; an epic\'s is its own menu\'s', async () => {
    hunting('kill-all');
    await raisedAt('kill-all');
    mailFor('kill-all', 'kill-all');
    mailFor('solo', 'solo');
    mailFor(FUMI, 'note-window');

    assert.deepStrictEqual(startMenu().menu.slice(0, 3), [
      '1 → Continue bugfix: Kill All — investigation · 1 question waiting for you · mail waiting',
      '2 → Continue feature: Solo — discussion · mail waiting',
      '3 → Continue epic: Fumi — discussion, 0 of 2 topics decided',
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

    assert.deepStrictEqual([empty.shown, full.shown], [['Inbox: empty'], ['Inbox: 2 ideas · 1 bug · 1 quick-fix']]);
    assert.deepStrictEqual(lettered(empty.menu), [
      'p/product → Talk about the product',
      's/start → Start something new — describe it, and we\'ll find what kind of work it is',
      't/triage → Triage the inbox',
      'r/roadmap → Open the product roadmap',
      'm/manage → Manage work units',
      'h/help → How Leeway works',
    ]);
    assert.match(lettered(full.menu)[0], /^p\/product → Talk about the product — 1 session, last on \d{1,2} [A-Z][a-z]{2} · research owed$/);
    assert.deepStrictEqual(lettered(full.menu).slice(1), [
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

  it('18.S5: a unit cancelled, none completed, brings the view', () => {
    createManifest(dir(), 'dropped', { work_type: 'bugfix', status: 'cancelled' });

    assert.ok(lettered(startMenu().menu).includes('v/view → View completed & cancelled work units'));
  });

  it('8.S78, 18.2.13: the product\'s row notes the research owed before any session as its tail, and drops it once the research is completed', () => {
    ok(dir(), ['brownfield', 'record', 'accepted']);
    const owed = lettered(startMenu().menu)[0];
    ok(dir(), ['brownfield', 'record', 'completed']);

    assert.deepStrictEqual([owed, lettered(startMenu().menu)[0]], ['p/product → Talk about the product — research owed', 'p/product → Talk about the product']);
  });

  it('18.2.13: the product\'s sessions whose logs name no conversation are counted, with no date', () => {
    writeState(dir(), '.product/sessions/session-001.md', '# Product session 001\n');
    writeState(dir(), '.product/sessions/session-002.md', '# Product session 002\n');

    assert.strictEqual(lettered(startMenu().menu)[0], 'p/product → Talk about the product — 2 sessions');
  });

  it('18.2.3, 18.2.12: the rows in their order — the units with something waiting first, then features, a retired type\'s unit among them, bugfixes, quick-fixes and epics, each type in the project\'s order; then product, start, triage, roadmap, verdicts, view, manage and help', () => {
    close();
    staged(NO_PAYLOAD);
    reverse(NOTE_MAP.sync.answer, 'Off until you turn it on.');
    createManifest(dir(), 'atlas', { work_type: 'epic' });
    createManifest(dir(), 'crash', { work_type: 'bugfix' });
    createManifest(dir(), 'typo', { work_type: 'quick-fix' });
    createManifest(dir(), 'zeta-concern', { work_type: 'cross-cutting', phases: { discussion: { items: { 'zeta-concern': { status: 'in-progress' } } } } });
    createManifest(dir(), 'shipped', { work_type: 'feature', status: 'completed' });

    assert.deepStrictEqual(startMenu().menu, [
      '1 → Continue epic: Fumi — discussion, 0 of 2 topics decided · 1 gate waiting for you',
      '2 → Continue feature: Solo — discussion',
      '3 → Continue cross-cutting: Zeta Concern — waiting on the migration\'s cut',
      '4 → Continue bugfix: Crash — investigation',
      '5 → Continue quick-fix: Typo — implementation',
      '6 → Continue epic: Atlas — discovery, 0 topics on the map',
      'p/product → Talk about the product',
      's/start → Start something new — describe it, and we\'ll find what kind of work it is',
      't/triage → Triage the inbox',
      'r/roadmap → Open the product roadmap',
      'e/verdicts → Give the verdict waiting on a call you changed',
      'v/view → View completed & cancelled work units',
      'm/manage → Manage work units',
      'h/help → How Leeway works',
    ]);
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

  it('23.2.3: its help, until the help home, a row into the walk through Leeway, which the start skill carries on into', () => {
    const out = output(dir(), ['render', 'help', 'start-menu'], { env: { CLAUDE_CODE_SESSION_ID: HERE } });

    assert.match(sectionOf(out, 'MENU: help'), /w\/walk`\*\* +→ Walk through how Leeway works/);
    assert.deepStrictEqual(rowsShown().w, { kind: 'continue' });
  });
});

describe('a builder\'s question parked in the ledger (12.S31, 18.S2)', () => {
  /** @type {string} */
  let dir;
  review.useWorld((copied) => {
    dir = copied;
  });

  it('12.S31, 18.S2: a fix task\'s builder parks on a question, and the unit is listed first with it counted, read from the ledger in a new session; no other row counts anything, and no waiting section stands apart', async () => {
    review.firstRoundFailed();
    review.enter();
    await review.fixParked();
    const { menu } = drawnIn(dir, review.env(NEW_SESSION));

    assert.strictEqual(menu[0], '1 → Continue feature: Pay — review · 1 question waiting for you');
    assert.deepStrictEqual(menu.filter((row) => row.includes('waiting for you')), [menu[0]]);
  });
});
