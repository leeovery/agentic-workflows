'use strict';

// Layer: verb.

require('./hermetic-env.cjs');

// The GATE payload: each gate stated as data beside the MENU that displays
// it, for a surface that draws the gate itself. Announced by the environment
// and by nothing else — the first suite here is the proof that a session
// without the announcement sees the bytes it always saw. A learned gate run
// as an automatic step states none, and leaves no gate shown to answer, the
// step logged as a step; the import reprompt's showing, set aside, is held
// at no place for the paths it names alone, and told from another by when
// the place the conversation sits at was entered and its paths.

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ok, output, refusedPristine, FROZEN_MS } = require('./engine-harness.cjs');
const { DAY, lines, history, shownIn, showingAnswers } = require('./trust-world.cjs');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { GATE_MARKER, announced, auditGate, auditMarkers } = require('./gate-audit.cjs');
const { openGate, gateShown, section, menu, menuFrame, cmdOption, promptOption, optionDetail } = require('../../skills/leeway-engine/scripts/domain/projections/surfaces.cjs');
const decisionPoint = require('../../skills/leeway-engine/scripts/domain/decision-point.cjs');
const { showingOf, drawnBlind } = require('../../skills/leeway-engine/scripts/domain/learned-gates.cjs');

const HOUR = 60 * 60 * 1000;
// Where the import reprompt comes: nowhere.
const NOWHERE = Object.freeze({ unit: null, phase: null, topic: null });

const ANNOUNCED = { LEEWAY_GATE_SURFACE: '1' };

/** The GATE payload in a response, held whole against its MENU; null when it carries no menu. @param {string} out */
function gateOf(out) {
  return auditGate(out, 'gate payload');
}

/** The same response with its GATE block cut out. @param {string} out */
function withoutGate(out) {
  const lines = out.split('\n');
  const i = lines.indexOf(GATE_MARKER);
  if (i === -1) return out;
  lines.splice(i, 2);
  return lines.join('\n');
}

/** The section markers of a response, in order. @param {string} out */
function markers(out) {
  return out.split('\n').filter((l) => l.startsWith('=== '));
}

/**
 * One menu composed through the builders with the surface announced — the
 * door to a shape no render surface produces today.
 * @param {() => string} compose  the menu body @returns {object}
 */
function collect(compose) {
  return announced(() => {
    openGate();
    return gateOf(section('MENU: builder', 'emit verbatim as markdown (not a code block)', compose()));
  });
}

/** An epic whose map holds a topic not yet started, its cancel gate the render. @param {string} dir */
function seedCancel(dir) {
  createManifest(dir, 'pay', {
    work_type: 'epic',
    phases: { discovery: { items: { 'data-export': { source: 'discovery' } } } },
  });
}

/** The cancel gate over that topic. */
const CANCEL = ['render', 'cancel-gate', 'pay.discovery.data-export'];

/** The epic menu over the held epic. */
const EPIC_MENU = ['render', 'epic-menu', 'v1'];

/** A bugfix's investigation in progress. @param {string} dir */
function seedInvestigation(dir) {
  createManifest(dir, 'auth', { work_type: 'bugfix', phases: { investigation: { items: { auth: { status: 'in-progress' } } } } });
}

/** The phase note over that investigation — a display, no menu. */
const PHASE_NOTE = ['render', 'phase-note', 'auth.investigation.auth', '--verb', 'Resuming'];

/**
 * A topic's session held by a live peer, last active four minutes ago.
 * @param {string} dir @param {string} wu @param {string} phase @param {string} topic
 */
function heldByPeer(dir, wu, phase, topic) {
  const presence = createFile(dir, `.leeway/.cache/${wu}/${phase}/${topic}/presence`,
    JSON.stringify({ pid: process.pid, pid_start: null, session_id: 'peer' }) + '\n');
  const past = new Date(Date.now() - 240 * 1000);
  fs.utimesSync(presence, past, past);
}

/** An epic whose discussion a peer session holds, a fresh topic beside it. @param {string} dir */
function seedHeldEpic(dir) {
  createManifest(dir, 'v1', {
    work_type: 'epic',
    phases: {
      discovery: { items: {
        auth: { source: 'discovery', order: 1 },
        billing: { source: 'discovery', order: 2 },
      } },
      discussion: { items: { auth: { status: 'in-progress' } } },
    },
  });
  heldByPeer(dir, 'v1', 'discussion', 'auth');
}

describe('gate payload — the announce switch', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a render surface says nothing extra unannounced, and the announced bytes differ only by the GATE block', () => {
    seedCancel(dir);
    const plain = output(dir, CANCEL);
    const announced = output(dir, CANCEL, { env: ANNOUNCED });

    assert.ok(!plain.includes('=== GATE'), plain);
    assert.notStrictEqual(plain, announced);
    assert.strictEqual(withoutGate(announced), plain);
  });

  it('a value other than 1 is not an announcement', () => {
    seedCancel(dir);
    const plain = output(dir, CANCEL);
    for (const value of ['', '0', 'true', 'yes']) {
      const out = output(dir, CANCEL, { env: { LEEWAY_GATE_SURFACE: value } });
      assert.strictEqual(out, plain, `LEEWAY_GATE_SURFACE=${value} announced a gate`);
    }
  });
});

describe('gate payload — a render surface', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a display-only surface carries no gate', () => {
    seedInvestigation(dir);
    const out = output(dir, PHASE_NOTE, { env: ANNOUNCED });

    assert.match(out, /^=== DISPLAY: phase note/);
    assert.strictEqual(gateOf(out), null);
  });

  it('a labelled key row states its label as its head', () => {
    createManifest(dir, 'pay', {
      work_type: 'epic',
      phases: { discovery: { items: { 'data-export': { source: 'discovery' } } } },
    });
    const gate = gateOf(output(dir, ['render', 'cancel-gate', 'pay.discovery.data-export'], { env: ANNOUNCED }));

    assert.strictEqual(gate.gate, 'cancel gate');
    assert.strictEqual(gate.question, 'Cancel it?');
    assert.deepStrictEqual(gate.options[0], { key: 'y', word: 'yes', head: 'Confirm cancellation', tail: null, cue: null, holder: null, detail: null, struck: false, recommended: false });
  });

  it('a bare key row states no label — its word is the key the person presses, never a head', () => {
    createManifest(dir, 'auth', { phases: { discussion: { items: { auth: { status: 'completed' } } } } });
    createFile(dir, '.leeway/auth/topics/auth/log.md', '# Discussion — auth\n');
    createManifest(dir, 'v1', { work_type: 'epic' });
    const gate = gateOf(output(dir, ['render', 'absorb-confirm-gate', 'auth', '--into', 'v1', '--topic', 'auth', '--summary', 'Signing in'], { env: ANNOUNCED }));

    assert.strictEqual(gate.question, 'Absorb it?');
    assert.deepStrictEqual(gate.options, [
      { key: 'y', word: 'yes', head: '', tail: null, cue: null, holder: null, detail: null, struck: false, recommended: false },
      { key: 'n', word: 'no', head: '', tail: null, cue: null, holder: null, detail: null, struck: false, recommended: false },
    ]);
  });

  it('each render starts from nothing — neither a menu before it nor a menu-less one leaks rows in', () => {
    seedCancel(dir);
    seedInvestigation(dir);
    const first = output(dir, CANCEL, { env: ANNOUNCED });
    output(dir, ['render', 'walkthrough-offer'], { env: ANNOUNCED });
    output(dir, PHASE_NOTE, { env: ANNOUNCED });
    const last = output(dir, CANCEL, { env: ANNOUNCED });

    assert.deepStrictEqual(gateOf(last), gateOf(first));
  });

  it('the GATE sits directly above the MENU and after every other section', () => {
    const out = output(dir, ['render', 'walkthrough-screen', '--screen', '2', '--from', 'help'], { env: ANNOUNCED });
    const seen = markers(out);

    assert.strictEqual(seen.at(-2), GATE_MARKER);
    assert.match(seen.at(-1), /^=== MENU: walkthrough screen /);
    assert.ok(seen.slice(0, -2).every((m) => !m.startsWith('=== GATE') && !m.startsWith('=== MENU')), seen.join('\n'));
  });

  it('a menu drawn as a sample inside a display is not the gate — the payload is the screen\'s own menu', () => {
    const gate = gateOf(output(dir, ['render', 'walkthrough-screen', '--screen', '2', '--from', 'help'], { env: ANNOUNCED }));

    assert.strictEqual(gate.question, 'What next?');
    assert.strictEqual(gate.statement, '');
    assert.deepStrictEqual(gate.options.map((/** @type {{key: string}} */ o) => o.key), ['n', 'b', 's']);
  });
});

describe('gate payload — a learned gate run as an automatic step', () => {
  let dir;
  let config;
  beforeEach(() => {
    dir = setupFixture();
    config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-gate-payload-config-'));
  });
  afterEach(() => {
    cleanupFixture(dir);
    fs.rmSync(config, { recursive: true, force: true });
  });

  it('8.S22: the import prompt stepped by the decision point at no place, each showing told by the paths it names, run as a step on skip, states no gate — its report in its menu\'s place — and the prompt shown before it, over other paths, is gone, so an answer to it refuses; the step logged in the trust log as a step, no answer (3.2.7)', (t) => {
    const env = { ...ANNOUNCED, LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'sess-1' };
    const log = path.join(config, 'trust.jsonl');
    const { project_id: project } = JSON.parse(fs.readFileSync(path.join(dir, '.leeway/manifest.json'), 'utf8'));
    const skipped = history({ project, start: Date.now() - DAY });
    for (let i = 0; i < 13; i += 1) skipped.gate('import reprompt', { picked: 's' });
    fs.writeFileSync(log, lines(...skipped.events));
    /** The reprompt over `missing` drawn. @param {string[]} missing */
    const reprompt = (missing) => output(dir, ['render', 'import-reprompt', '--file', createFile(dir, '.leeway/.cache/pay/discovery/pay/import-reprompt.json', JSON.stringify({ missing }))], { env });
    const shown = gateOf(reprompt(['/notes/other.png']))?.gate;
    const asked = t.mock.method(decisionPoint, 'gateStep', (/** @type {string} */ name, /** @type {any} */ at) => decisionPoint.learned(name, at));
    const out = reprompt(['/notes/sketch.png']);
    const refused = refusedPristine(dir, ['gate', 'import reprompt', '--pick', 's'], { env }).error;
    const logged = fs.readFileSync(log, 'utf8').split('\n').slice(skipped.events.length, -1).map((line) => JSON.parse(line));

    assert.deepStrictEqual([shown, asked.mock.calls.map(({ arguments: [name, { place, key }] }) => [name, place, key])], ['import reprompt', [['import reprompt', { unit: null, phase: null, topic: null }, ['/notes/sketch.png']]]]);
    assert.strictEqual(gateOf(out), null);
    assert.deepStrictEqual(markers(out).map((marker) => marker.split(' (')[0]), ['=== DISPLAY: missing imports', '=== DATA', '=== DISPLAY: automatic step']);
    assert.match(out, /^automatic step: import reprompt\nran: s\nnext: null\n/m);
    assert.match(out, /^Paths that could not be landed skipped \[auto\]\. Landing the rest\.\n$/m, 'the report says the rest lands');
    assert.strictEqual(refused, 'gate: no gate has been shown in this conversation — render the gate, then answer it');
    assert.deepStrictEqual(logged.map(({ type, gate, row, showing }) => ({ type, gate, row, showing })), [
      { type: 'step', gate: 'import reprompt', row: 's', showing: showingOf(NOWHERE, null, ['/notes/sketch.png']) },
    ]);
  });
});

describe('gate payload — the import reprompt\'s showing, held at no place (N1, N2)', () => {
  let dir;
  let config;
  beforeEach(() => {
    dir = setupFixture();
    config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-gate-payload-config-'));
  });
  afterEach(() => {
    cleanupFixture(dir);
    fs.rmSync(config, { recursive: true, force: true });
  });

  it('set aside by free text, it shows on its hold in the next conversation over the same paths, the answer there the same event; a later reprompt over other paths, the first abandoned, is drawn afresh, its answer an event of its own', () => {
    /** The conversation `session`, its trust log in the test's own config folder. @param {string} session */
    const as = (session) => ({ LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: session });
    /** The reprompt over `missing` drawn in `session`: the showing it was shown on. @param {string[]} missing @param {string} session */
    const reprompt = (missing, session) => {
      const file = createFile(dir, '.leeway/.cache/pay/discovery/pay/import-reprompt.json', JSON.stringify({ missing }));
      output(dir, ['render', 'import-reprompt', '--file', file], { env: as(session) });
      return shownIn(config, session).showing;
    };
    const aside = (/** @type {string} */ session) => ok(dir, ['gate', 'import reprompt', '--typed'], { env: as(session), stdin: 'Hang on, where did I save those?' });

    reprompt(['/notes/sketch.png'], 'first');
    aside('first');
    const held = reprompt(['/notes/sketch.png'], 'next');
    aside('next');
    const afresh = reprompt(['/screens/tax-form.png'], 'next');
    ok(dir, ['gate', 'import reprompt', '--pick', 's'], { env: as('next') });

    assert.deepStrictEqual([held, afresh, showingAnswers(config, 'import reprompt')], [showingOf(NOWHERE, null, ['/notes/sketch.png']), showingOf(NOWHERE, null, ['/screens/tax-form.png']), [[null, null, 's'], [0, 0, 1]]]);
  });

  it('3.2.7, 16.21.3: its showing is told by when the place the conversation\'s position names was entered and the paths it names — the reprompt over the same paths in two entries of the product\'s conversation two showings, each run as a step under an id of its own; where the position names no place, the roadmap or none at all, by its paths alone', (t) => {
    const as = (/** @type {string} */ session) => ({ LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: session });
    const log = path.join(config, 'trust.jsonl');
    const { project_id: project } = JSON.parse(fs.readFileSync(path.join(dir, '.leeway/manifest.json'), 'utf8'));
    const skipped = history({ project, start: Date.now() - DAY });
    for (let i = 0; i < 13; i += 1) skipped.gate('import reprompt', { picked: 's' });
    fs.writeFileSync(log, lines(...skipped.events));
    t.mock.method(decisionPoint, 'gateStep', (/** @type {string} */ name, /** @type {any} */ at) => decisionPoint.learned(name, at));
    const missing = ['/notes/sketch.png'];
    /** The reprompt over `missing` drawn in `session`. @param {string} session */
    const reprompt = (session) => output(dir, ['render', 'import-reprompt', '--file', createFile(dir, '.leeway/.cache/product/discovery/product/import-reprompt.json', JSON.stringify({ missing }))], { env: as(session) });
    /** The product's conversation entered in `session`, the clock at `ms`: when it was entered, as recorded. @param {number} ms @param {string} session */
    const entered = (ms, session) => {
      t.mock.timers.enable({ apis: ['Date'], now: ms });
      try {
        ok(dir, ['enter', 'discovery', 'product'], { env: as(session) });
      } finally {
        t.mock.timers.reset();
      }
      return JSON.parse(fs.readFileSync(path.join(dir, '.leeway/.cache/product/discovery/product/entered.json'), 'utf8')).at;
    };

    const first = entered(FROZEN_MS, 'sess-1');
    reprompt('sess-1');
    const second = entered(FROZEN_MS + HOUR, 'sess-1');
    reprompt('sess-1');
    ok(dir, ['session', 'label', 'roadmap'], { env: as('at-the-roadmap') });
    reprompt('at-the-roadmap');
    reprompt('placeless');
    const steps = fs.readFileSync(log, 'utf8').split('\n').slice(skipped.events.length, -1).map((line) => JSON.parse(line)).filter(({ type }) => type === 'step');

    assert.deepStrictEqual([first, second], [new Date(FROZEN_MS).toISOString(), new Date(FROZEN_MS + HOUR).toISOString()]);
    const showings = [showingOf(NOWHERE, first, missing), showingOf(NOWHERE, second, missing), showingOf(NOWHERE, null, missing)];
    assert.deepStrictEqual(showings.map((showing) => drawnBlind('import reprompt', showing)), [false, false, false]);
    assert.deepStrictEqual(steps.map(({ showing }) => showing), [showings[0], showings[1], showings[2], showings[2]]);
    assert.deepStrictEqual(new Set(steps.map(({ id }) => id)).size, 3);
  });
});

describe('gate payload — the statement', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a statement label over an explicit question is the statement, its markup gone', () => {
    createManifest(dir, 'pay', {
      work_type: 'epic',
      phases: { discovery: { items: { 'data-export': { source: 'discovery' } } } },
    });
    const gate = gateOf(output(dir, ['render', 'cancel-gate', 'pay.discovery.data-export'], { env: ANNOUNCED }));

    assert.strictEqual(gate.question, 'Cancel it?');
    assert.strictEqual(gate.statement,
      'Cancelling Data Export takes it off the board — nothing has started, so only the map row is marked; it can be reactivated later.');
  });

  it('a statement over the question is the statement', () => {
    createManifest(dir, 'auth', { phases: { discovery: { items: { 'data-export': { source: 'discovery' } } } } });
    const gate = gateOf(output(dir, ['render', 'cancel-gate', 'auth.discovery.data-export'], { env: ANNOUNCED }));

    assert.strictEqual(gate.question, 'Cancel it?');
    assert.strictEqual(gate.statement, 'Cancelling Data Export takes it off the board — nothing has started, so only the map row is marked; it can be reactivated later.');
  });

  it('every line above the question is statement, in order', () => {
    const label = ['2 topic(s) have no source file to draft from:', '', '- Billing Core', '- Auth'].join('\n');
    const gate = collect(() => menu(label, [cmdOption('l', 'leave', 'Leave them unset')], { question: 'How do you want to handle them?' }));

    assert.strictEqual(gate.question, 'How do you want to handle them?');
    assert.strictEqual(gate.statement, '2 topic(s) have no source file to draft from:\n- Billing Core\n- Auth');
  });
});

describe('gate payload — a menu', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a held row states its holder apart from its tail, a recommended row its flag, and neither marker survives into the text', () => {
    seedHeldEpic(dir);
    const gate = gateOf(output(dir, EPIC_MENU, { env: ANNOUNCED }));

    assert.strictEqual(gate.gate, 'epic menu');
    assert.deepStrictEqual(gate.options[0],
      { key: '1', word: null, head: 'Start "Billing"', tail: 'not started', cue: null, holder: null, detail: null, struck: false, recommended: true });
    assert.deepStrictEqual(gate.options[1],
      { key: '2', word: null, head: 'Continue "Auth"', tail: 'in progress', cue: null, holder: 'in session (last active 4m ago)', detail: null, struck: true, recommended: false });
    const texts = gate.options.map((/** @type {{head: string, tail: string|null, holder: string|null}} */ o) => `${o.head}${o.tail}${o.holder}`);
    assert.ok(texts.every((t) => !t.includes('recommended') && !t.includes('~~')), JSON.stringify(gate.options));
  });

  it('the GATE sits directly above the MENU and after every other section', () => {
    seedHeldEpic(dir);
    const seen = markers(output(dir, EPIC_MENU, { env: ANNOUNCED }));

    assert.deepStrictEqual(seen.slice(-2), [GATE_MARKER, '=== MENU: epic menu (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===']);
    assert.ok(seen.slice(0, -2).every((m) => !m.startsWith('=== GATE') && !m.startsWith('=== MENU')), seen.join('\n'));
  });
});

describe('gate payload — every row shape', () => {
  // The shapes the menu builders draw, each met by at least one menu's
  // payload. The world's titles carry `_ * [ ]` wherever it holds a title.
  /** @type {Record<string, (gate: import('./gate-audit.cjs').GatePayload) => boolean>} */
  const SHAPES = {
    'a struck row with its cue and its holder': (g) => g.options.some((o) => o.struck && o.cue !== null && o.holder !== null),
    'a row with its tail and a cue': (g) => g.options.some((o) => !o.struck && o.tail !== null && o.cue !== null),
    'a recommended row': (g) => g.options.some((o) => o.recommended),
    'a prompt row': (g) => g.typed.length > 0,
    'a statement': (g) => g.statement !== '',
    'a title carrying markup as text': (g) => g.options.some((o) => /[_*[\]]/.test(o.head)),
  };

  /**
   * One project holding every state the menus draw from: an archive, a
   * roadmap with items waiting, and an epic whose discussion a peer holds
   * while a message waits in its mailbox, and one not started with a
   * message waiting — beside a completed topic whose input moved, a
   * cancelled topic, a topic postponed to the roadmap and a blocked plan.
   * @param {string} dir
   */
  function seedEveryRowShape(dir) {
    createFile(dir, '.leeway/manifest.json', JSON.stringify({
      ...JSON.parse(fs.readFileSync(path.join(dir, '.leeway/manifest.json'), 'utf8')),
      roadmap: {
        horizons: ['now_ish *core*', 'later [v2]'],
        items: {
          ordering: { horizon: 'now_ish *core*', summary: 'customers order', origin: 'harvest', pulled_to: { work_unit: 'v1' } },
          menus: { horizon: 'now_ish *core*', summary: 'operators keep *menus* in [sync]', origin: 'harvest' },
          loyalty: { horizon: 'later [v2]', summary: 'rewards_for_regulars', origin: 'park:v1' },
          offline: { horizon: 'now_ish *core*', summary: 'works *offline*', origin: 'postpone:v1', postponed_from: { work_unit: 'v1', topic: 'offline' } },
        },
      },
    }));
    createFile(dir, '.leeway/.inbox/.archived/ideas/2026-05-01--old-idea.md', '# Old *idea* [stale]_x\n');
    createFile(dir, 'proposed.json', JSON.stringify([{ name: 'gift-cards', horizon: 'later', summary: 'stored value' }]));

    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            auth: { source: 'discovery', order: 1 },
            billing: { source: 'discovery', order: 2 },
            search: { source: 'discovery', order: 3, cancelled: true },
            offline: { source: 'discovery', order: 4, postponed: true },
            tax: { source: 'discovery', order: 5 },
          },
        },
        discussion: {
          items: {
            auth: { status: 'in-progress' },
            billing: { status: 'completed' },
            search: { status: 'cancelled', previous_status: 'in-progress' },
          },
        },
        planning: { items: { tmpl: { status: 'in-progress', external_dependencies: { billing: { description: 'the ledger', state: 'unresolved' } } } } },
      },
    });
    createFile(dir, '.leeway/v1/topics/auth/mail/001.md', '# A message\n');
    createFile(dir, '.leeway/v1/topics/tax/mail/001.md', '# A message\n');
    heldByPeer(dir, 'v1', 'discussion', 'auth');
  }

  let dir;
  /** The epic's menu over the same world, which the engine draws. @type {string} */
  let epicMenu;
  /** The archived items over the same world, which the engine draws. @type {string} */
  let archived;
  /** The roadmap's harvest over the same world, which the engine draws. @type {string} */
  let harvest;

  before(() => {
    dir = setupFixture();
    seedEveryRowShape(dir);
    epicMenu = output(dir, EPIC_MENU, { env: ANNOUNCED });
    archived = output(dir, ['render', 'archived'], { env: ANNOUNCED });
    harvest = output(dir, ['render', 'roadmap-harvest', '--file', 'proposed.json'], { env: ANNOUNCED });
  });
  after(() => { cleanupFixture(dir); });

  it('the world reaches every row shape the menu builders draw, over the epic\'s menu, the archived items and the roadmap\'s harvest', () => {
    const gates = [epicMenu, archived, harvest].map((out) => auditGate(out, 'shape')).filter((g) => g !== null);
    for (const [shape, drawn] of Object.entries(SHAPES)) {
      assert.ok(gates.some(drawn), `no menu drew ${shape}`);
    }
  });
});

describe('gate payload — a row\'s detail', () => {
  it('lines directly beneath a row are its detail: separate lines keep their break, a wrapped description joins back', () => {
    const description = 'A description long enough that the engine has to wrap it across several lines.';
    const gate = collect(() => menuFrame([
      'Pick one?',
      '',
      cmdOption('1', null, 'First'),
      'A note on the first.',
      'A second note.',
      cmdOption('2', null, 'Second'),
      promptOption('Comment', 'Tell me more'),
      ...optionDetail(description, 30),
      '',
      'Reply with a number.',
    ]));

    assert.deepStrictEqual(gate.options.map((/** @type {{detail: string|null}} */ o) => o.detail), ['A note on the first.\nA second note.', null]);
    assert.strictEqual(gate.typed[0].detail, description);
    assert.strictEqual(gate.question, 'Pick one?');
    assert.strictEqual(gate.statement, 'Reply with a number.');
  });
});

describe('gate payload — a row built from parts', () => {
  it('each part draws where the row always drew it, and reaches the payload as its own field', () => {
    /** @type {string[]} */
    let rows = [];
    const gate = collect(() => {
      rows = [
        cmdOption('1', null, { head: 'Continue "Auth"', tail: 'discussion', cue: 'mail waiting', recommended: true }),
        cmdOption('2', null, { head: 'Continue "Auth"', tail: 'discussion', cue: 'input moved', holder: 'in session (last active 4m ago)' }),
        cmdOption('3', null, { head: 'Start discussion for "Billing"', tail: 'mail waiting' }),
        cmdOption('s', 'spec', { head: 'Start the specification' }),
      ];
      return menu('Pick one?', rows);
    });

    assert.deepStrictEqual(rows, [
      '**`1`** → Continue "Auth" — *discussion* · mail waiting (recommended)',
      '**`2`** → ~~Continue "Auth" — *discussion* · input moved~~ · in session (last active 4m ago)',
      '**`3`** → Start discussion for "Billing" — *mail waiting*',
      '**`s/spec`** → Start the specification',
    ]);
    assert.deepStrictEqual(gate.options, [
      { key: '1', word: null, head: 'Continue "Auth"', tail: 'discussion', cue: 'mail waiting', holder: null, detail: null, struck: false, recommended: true },
      { key: '2', word: null, head: 'Continue "Auth"', tail: 'discussion', cue: 'input moved', holder: 'in session (last active 4m ago)', detail: null, struck: true, recommended: false },
      { key: '3', word: null, head: 'Start discussion for "Billing"', tail: 'mail waiting', cue: null, holder: null, detail: null, struck: false, recommended: false },
      { key: 's', word: 'spec', head: 'Start the specification', tail: null, cue: null, holder: null, detail: null, struck: false, recommended: false },
    ]);
  });

  it('a held row with no tail states its holder alone', () => {
    const gate = collect(() => menu('Pick one?', [cmdOption('1', null, { head: 'Start discussion for "Billing"', holder: 'in session (last active 1m ago)' })]));

    assert.deepStrictEqual(gate.options[0],
      { key: '1', word: null, head: 'Start discussion for "Billing"', tail: null, cue: null, holder: 'in session (last active 1m ago)', detail: null, struck: true, recommended: false });
  });

  it('a string label drawing a part inline is refused — the parts are the only way in', () => {
    assert.throws(() => cmdOption('1', null, 'Continue "Auth" — *discussion*'), /draws "— \*" inline/);
    assert.throws(() => cmdOption('b', 'back', 'Return to menu (recommended)'), /draws "\(recommended\)" inline/);
    assert.throws(() => cmdOption('1', null, '~~Continue "Auth"~~ · in session'), /draws "~~" inline/);
  });

  it('a cue notes a tail, so a row without one is refused', () => {
    assert.throws(() => cmdOption('1', null, { head: 'Start discussion for "Billing"', cue: 'mail waiting' }), /a cue notes a tail/);
  });

  it('text the engine did not author passes as a head, whatever it contains, and states its text', () => {
    const summary = 'Keep the old flow (recommended) — *for now*';
    const gate = collect(() => menu('Which one?', [cmdOption('1', null, { head: summary })]));

    assert.strictEqual(gate.options[0].head, 'Keep the old flow (recommended) — for now');
    assert.strictEqual(gate.options[0].tail, null);
    assert.strictEqual(gate.options[0].recommended, false);
  });
});

describe('gate payload — escaped text', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a title the engine escaped reads as its own characters, and its markup as text', () => {
    const archived = '.leeway/.inbox/.archived/ideas/2026-05-01--user-id.md';
    createFile(dir, archived, '# Fix user_id in *auth* [draft]\n');

    const item = gateOf(output(dir, ['render', 'archived-item', '--path', archived], { env: ANNOUNCED }));
    assert.strictEqual(item.statement, 'Selected: Fix user_id in *auth* [draft] (idea, archived)');

    const remove = gateOf(output(dir, ['render', 'archived-delete-gate', '--path', archived], { env: ANNOUNCED }));
    assert.strictEqual(remove.statement, 'Deleting "Fix user_id in *auth* [draft]" takes it out of the archive for good.');
  });

  it('a code span keeps its content as written', () => {
    const gate = collect(() => menu('Run `a_b*c` to release it.', [cmdOption('1', null, 'One')], { question: 'Proceed?' }));

    assert.strictEqual(gate.statement, 'Run a_b*c to release it.');
  });

  it('every part of a row states its text, whatever markup drew it', () => {
    const gate = collect(() => menu('Pick one?', [cmdOption('1', null, {
      head: 'Fix user\\_id in \\*auth\\* \\[draft\\]',
      tail: 'blocks `resolveUser`',
      cue: 'input `moved`',
      holder: 'in \\_session\\_',
    })]));

    assert.deepStrictEqual(gate.options[0], {
      key: '1', word: null, head: 'Fix user_id in *auth* [draft]', tail: 'blocks resolveUser', cue: 'input moved',
      holder: 'in _session_', detail: null, struck: true, recommended: false,
    });
  });
});

describe('gate payload — a menu that draws nothing', () => {
  it('a render that composed no frame and no row takes nothing', () => {
    const out = announced(() => {
      openGate();
      return section('MENU: empty menu', 'emit verbatim as markdown (not a code block)', '');
    });

    assert.ok(!out.includes(GATE_MARKER), out);
    assert.strictEqual(gateShown(), null);
  });
});

describe('gate payload — the audit', () => {
  /** A held row with a tail and a cue, rendered announced. */
  const heldRow = () => announced(() => {
    openGate();
    return section('MENU: audit', 'emit verbatim as markdown (not a code block)', menu('Pick one?', [
      cmdOption('1', null, { head: 'Continue "Auth"', tail: 'discussion', cue: 'input moved', holder: 'in session (last active 4m ago)' }),
    ]));
  });

  /**
   * The response with its first option's payload row rewritten, the menu left as drawn.
   * @param {string} out @param {(o: Record<string, unknown>) => void} change
   */
  const tampered = (out, change) => {
    const lines = out.split('\n');
    const at = lines.indexOf(GATE_MARKER) + 1;
    const gate = JSON.parse(lines[at]);
    change(gate.options[0]);
    lines[at] = JSON.stringify(gate);
    return lines.join('\n');
  };

  it('reads every part against the line the menu drew — its words, its strike, its italics', () => {
    const out = heldRow();
    assert.ok(auditGate(out, 'as drawn'));

    /** @type {[string, (o: Record<string, unknown>) => void][]} */
    const drifts = [
      ['a cue stated as tail', (o) => { o.tail = 'discussion · input moved'; o.cue = null; }],
      ['a holder stated as tail', (o) => { o.tail = 'discussion · input moved · in session (last active 4m ago)'; o.cue = null; o.holder = null; }],
      ['a strike the row does not state', (o) => { o.struck = false; }],
      ['a cue the row does not draw', (o) => { o.cue = 'mail waiting'; }],
    ];
    for (const [what, change] of drifts) {
      assert.throws(() => auditGate(tampered(out, change), what), /option parts are not what the menu's rows draw/, what);
    }
  });

  it('reads every part as the text it states — a part still carrying its markup or its escapes fails', () => {
    const out = announced(() => {
      openGate();
      return section('MENU: audit', 'emit verbatim as markdown (not a code block)', menu('Pick one?', [
        cmdOption('1', null, { head: 'Fix user\\_id in \\*auth\\*', tail: 'blocks `resolveUser`', cue: 'input `moved`', holder: 'in \\_session\\_' }),
      ]));
    });
    assert.ok(auditGate(out, 'as drawn'));

    /** @type {[string, (o: Record<string, unknown>) => void][]} */
    const drifts = [
      ['a head with its escapes', (o) => { o.head = 'Fix user\\_id in \\*auth\\*'; }],
      ['a tail with its code span', (o) => { o.tail = 'blocks `resolveUser`'; }],
      ['a cue with its code span', (o) => { o.cue = 'input `moved`'; }],
      ['a holder with its escapes', (o) => { o.holder = 'in \\_session\\_'; }],
      ['a head with its emphasis', (o) => { o.head = 'Fix user_id in **auth**'; }],
    ];
    for (const [what, change] of drifts) {
      assert.throws(() => auditGate(tampered(out, change), what), /option parts are not what the menu's rows draw/, what);
    }
  });
});

describe('section markers — the render forms', () => {
  it('a marker opens its instruction on one of the four forms, whatever behaviour follows', () => {
    const out = [
      section('TITLE', "emit verbatim as markdown (not a code block) — the view's chrome heading", '# **`■ Audit`**'),
      section('DISPLAY: tree', 'emit verbatim as a text code block (```text fence), directly above the menu', 'a tree'),
      section('DISPLAY: blocker', 'emit verbatim as a properties code block (```properties fence)', '⚑ Blocked'),
      section('DISPLAY: diff', 'emit verbatim as a diff code block (```diff fence)', '+ added'),
      section('DATA', 'reason from this — never display or parse the sections below', 'count: 1'),
    ].join('\n');
    assert.doesNotThrow(() => auditMarkers(out, 'the four forms'));
  });

  it('a bare code block, a form with no fence, or the moment ahead of the form fails', () => {
    const legacy = [
      'emit verbatim as a code block',
      'emit verbatim as a code block, directly above the menu',
      'emit verbatim as markdown',
      "emit verbatim as markdown, then STOP for the user's response",
      'emit verbatim as a properties code block — ```properties fence',
      'after the result summary: emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs',
    ];
    for (const instruction of legacy) {
      assert.throws(() => auditMarkers(section('DISPLAY: legacy', instruction, 'body'), instruction), /names no render form/, instruction);
    }
    assert.throws(() => auditMarkers('=== DISPLAY (emit verbatim as a code block) ===\nbody\n', 'gateway'), /names no render form/);
  });
});
