'use strict';

// Layer: verb.

require('./hermetic-env.cjs');

// The GATE payload: each gate stated as data beside the MENU that displays
// it, for a surface that draws the gate itself. Announced by the environment
// and by nothing else — the first suite here is the proof that a session
// without the announcement sees the bytes it always saw.

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFile, spawnSync } = require('child_process');

const { output } = require('./engine-harness.cjs');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { GATE_MARKER, announced, auditGate, auditMarkers } = require('./gate-audit.cjs');
const { openGate, gateShown, section, menu, menuFrame, cmdOption, promptOption, optionDetail } = require('../../skills/leeway-engine/scripts/domain/projections/surfaces.cjs');
const { menuBlock } = require('../../skills/leeway-engine/scripts/gateway.cjs');

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

/** A skill adapter driven as the process it is. @param {string} dir @param {string} gateway @param {string[]} args @param {Record<string,string>} [env] */
function runGateway(dir, gateway, args, env = {}) {
  const script = path.resolve(__dirname, '../../skills', gateway, 'scripts/gateway.cjs');
  const res = spawnSync('node', [script, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });
  assert.strictEqual(res.status, 0, `${gateway} ${args.join(' ')} failed\n${res.stderr}`);
  return res.stdout;
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

  it('a gateway view says nothing extra unannounced, and the announced bytes differ only by the GATE block', () => {
    seedHeldEpic(dir);
    const plain = runGateway(dir, 'leeway', ['manage']);
    const announced = runGateway(dir, 'leeway', ['manage'], ANNOUNCED);

    assert.ok(!plain.includes('=== GATE'), plain);
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

  it('an auto candidate gate arms nothing — its DISPLAY is not a gate', () => {
    createManifest(dir, 'pay', {
      work_type: 'epic',
      phases: { discovery: { items: {}, analysis_staging: { 'discovery-gap-analysis': { gate_mode: 'auto', candidates: { 'data-export': { status: 'pending' } } } } } },
    });
    const file = createFile(dir, '.leeway/.cache/pay/candidate.json', JSON.stringify({ name: 'data-export', summary: 'The export.' }));
    const out = output(dir, ['render', 'candidate-gate', 'pay', '--file', file], { env: ANNOUNCED });

    assert.match(out, /^=== DISPLAY: candidate approved/m);
    assert.strictEqual(gateOf(out), null);
  });

  it('a display-only surface carries no gate', () => {
    seedInvestigation(dir);
    const out = output(dir, ['render', 'phase-completed', 'auth', '--phase', 'investigation'], { env: ANNOUNCED });

    assert.match(out, /^=== DISPLAY: phase completed/);
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
    createManifest(dir, 'v1', { work_type: 'epic' });
    const gate = gateOf(output(dir, ['render', 'absorb-confirm-gate', 'auth'], { env: ANNOUNCED }));

    assert.strictEqual(gate.question, 'Proceed?');
    assert.deepStrictEqual(gate.options, [
      { key: 'y', word: 'yes', head: '', tail: null, cue: null, holder: null, detail: null, struck: false, recommended: false },
      { key: 'n', word: 'no', head: '', tail: null, cue: null, holder: null, detail: null, struck: false, recommended: false },
    ]);
  });

  it('a metadata tail is stated apart from the head, its italics gone', () => {
    createManifest(dir, 'auth', {
      work_type: 'bugfix',
      next_phase: 'specification',
      completed_phases: ['discovery', 'investigation'],
      phases: { investigation: { items: { auth: { status: 'completed' } } } },
    });
    const gate = gateOf(output(dir, ['render', 'revisit-phases', 'auth'], { env: ANNOUNCED }));

    assert.strictEqual(gate.gate, 'revisit phases');
    assert.deepStrictEqual(gate.options[0], { key: '1', word: null, head: 'Investigation', tail: 'completed', cue: null, holder: null, detail: null, struck: false, recommended: false });
    assert.deepStrictEqual(gate.options.at(-1), { key: 'b', word: 'back', head: 'Return to the previous menu', tail: null, cue: null, holder: null, detail: null, struck: false, recommended: false });
  });

  it('each render starts from nothing — neither a menu before it nor a menu-less one leaks rows in', () => {
    seedCancel(dir);
    seedInvestigation(dir);
    createFile(dir, '.leeway/.cache/pay/names.json', JSON.stringify({ names: ['billing-core'] }));
    const first = output(dir, CANCEL, { env: ANNOUNCED });
    output(dir, ['render', 'summary-backfill-gate', 'pay', '--variant', 'unsourced', '--file', '.leeway/.cache/pay/names.json'], { env: ANNOUNCED });
    output(dir, ['render', 'phase-completed', 'auth', '--phase', 'investigation'], { env: ANNOUNCED });
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
    createManifest(dir, 'v1', { work_type: 'epic' });
    createFile(dir, '.leeway/.cache/v1/names.json', JSON.stringify({ names: ['billing-core', 'auth'] }));
    const gate = gateOf(output(dir, ['render', 'summary-backfill-gate', 'v1', '--variant', 'unsourced',
      '--file', '.leeway/.cache/v1/names.json'], { env: ANNOUNCED }));

    assert.strictEqual(gate.question, 'How do you want to handle them?');
    assert.strictEqual(gate.statement, '2 topic(s) have no source file to draft from:\n- Billing Core\n- Auth');
  });
});

describe('gate payload — a gateway menu', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a gateway\'s MENU states the gate the gateway names it, and its range row is typed rather than pressable', () => {
    createFile(dir, '.leeway/.inbox/ideas/2026-03-19--smart-retry.md', '# Smart Retry\n\nContent.');
    createFile(dir, '.leeway/.inbox/bugs/2026-03-20--bad-thing.md', '# Bad Thing\n\nContent.');
    const out = runGateway(dir, 'leeway', ['inbox'], ANNOUNCED);

    assert.deepStrictEqual(gateOf(out), {
      gate: 'inbox menu',
      question: 'What would you like to do?',
      statement: '',
      options: [
        { key: 'b', word: 'back', head: 'Return', tail: null, cue: null, holder: null, detail: null, struck: false, recommended: false },
      ],
      typed: [
        { label: '1–2', description: 'Triage item(s) — archive, put on the roadmap, or start work (comma-separated for several)', detail: null },
      ],
    });
  });

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

describe('gate payload — every gateway verb', () => {
  const SKILLS = path.resolve(__dirname, '../../skills');
  const ENGINE_GATEWAY = path.join(SKILLS, 'leeway-engine/scripts/gateway.cjs');
  const SET_ITEM = '.leeway/.inbox/ideas/2026-06-01--user-id.md';
  const BUG_ITEM = '.leeway/.inbox/bugs/2026-06-02--login-timeout.md';

  /** @typedef {{args: string[], gated: boolean, refused?: boolean}} GatewayCall */

  /** A call whose response draws a menu, stated whole in its payload. @param {...string} args @returns {GatewayCall} */
  const gated = (...args) => ({ args, gated: true });
  /** A call whose response draws no menu, so carries no payload. @param {...string} args @returns {GatewayCall} */
  const ungated = (...args) => ({ args, gated: false });
  /** A call the gateway refuses — a usage error, no payload. @param {...string} args @returns {GatewayCall} */
  const refused = (...args) => ({ args, gated: false, refused: true });

  // Every verb each gateway's runGateway table dispatches (`index` is the
  // bare call, `fallback` an unmatched one), called over the one world below.
  /** @type {Record<string, Record<string, GatewayCall[]>>} */
  const CALLS = {
    'leeway': {
      index: [refused()],
      inbox: [gated('inbox')],
      archived: [gated('archived')],
      'working-set': [gated('working-set', SET_ITEM), gated('working-set', SET_ITEM, BUG_ITEM)],
      'working-set-add-gate': [gated('working-set-add-gate', SET_ITEM)],
      'working-set-drop-gate': [gated('working-set-drop-gate', SET_ITEM)],
      manage: [gated('manage'), gated('manage', 'checkout')],
      completed: [gated('completed')],
    },
    'leeway-roadmap': {
      view: [gated('view')],
      'pull-set': [gated('pull-set')],
      proposal: [ungated('proposal', '--file', 'proposed.json')],
    },
  };

  // The shapes the menu builders draw, each met by at least one call's
  // payload. The world's titles carry `_ * [ ]` wherever it holds a title.
  /** @type {Record<string, (gate: import('./gate-audit.cjs').GatePayload) => boolean>} */
  const SHAPES = {
    'a struck row with its cue and its holder': (g) => g.options.some((o) => o.struck && o.cue !== null && o.holder !== null),
    'a row with its tail and a cue': (g) => g.options.some((o) => !o.struck && o.tail !== null && o.cue !== null),
    'a recommended row': (g) => g.options.some((o) => o.recommended),
    'a range row': (g) => g.typed.some((t) => t.label.includes('–')),
    'a prompt row': (g) => g.typed.some((t) => !t.label.includes('–')),
    'a statement': (g) => g.statement !== '',
    'a title carrying markup as text': (g) => g.options.some((o) => /[_*[\]]/.test(o.head)),
  };

  /**
   * One project holding every state the gateway menus draw from: an inbox
   * and an archive, a roadmap with items waiting, an epic whose discussion a
   * peer holds while a message waits in its mailbox, and one not started
   * with a message waiting — beside a completed topic whose input moved, a
   * cancelled topic, a topic
   * postponed to the roadmap and a blocked plan — a unit of each
   * linear type ready for its next phase, a feature with a message waiting,
   * and closed units.
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
    createFile(dir, SET_ITEM, '# Fix user_id in *auth* [draft]\n');
    createFile(dir, BUG_ITEM, '# Login_timeout *spikes* [prod]\n');
    createFile(dir, '.leeway/.inbox/ideas/2026-06-03--smart-retry.md', '# Smart retry\n');
    createFile(dir, '.leeway/.inbox/.archived/ideas/2026-05-01--old-idea.md', '# Old *idea* [stale]_x\n');
    createFile(dir, 'proposed.json', JSON.stringify([{ name: 'gift-cards', horizon: 'later [v2]', summary: 'stored *value*' }]));

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

    /** A linear unit whose one phase concluded. @param {string} name @param {string} workType @param {string} phase @param {string} next */
    const concluded = (name, workType, phase, next) => createManifest(dir, name, {
      work_type: workType,
      phases: { [phase]: { items: { [name]: { status: 'completed' } } } },
      completed_phases: ['discovery', phase],
      next_phase: next,
    });
    concluded('checkout', 'feature', 'discussion', 'specification');
    concluded('crash-fix', 'bugfix', 'investigation', 'specification');
    createManifest(dir, 'payments', { phases: { discussion: { items: { payments: { status: 'in-progress' } } } } });
    createFile(dir, '.leeway/payments/topics/payments/mail/001.md', '# A message\n');
    createManifest(dir, 'done-feat', { status: 'completed', phases: { review: { items: { 'done-feat': { status: 'completed' } } } } });
    createManifest(dir, 'old-bug', { work_type: 'bugfix', status: 'cancelled' });
  }

  /**
   * A skill adapter run as its own process, answered whatever its exit.
   * @param {string} dir @param {string} gateway @param {string[]} args
   * @param {{env?: Record<string, string>, node?: string[]}} [opts]
   * @returns {Promise<{code: number, stdout: string, stderr: string}>}
   */
  function spawnGateway(dir, gateway, args, { env = {}, node = [] } = {}) {
    const script = path.join(SKILLS, gateway, 'scripts/gateway.cjs');
    return new Promise((resolve) => {
      execFile('node', [...node, script, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } },
        (err, stdout, stderr) => resolve({ code: err ? Number(err.code) || 1 : 0, stdout, stderr }));
    });
  }

  let dir;
  /** @type {Record<string, string[]>} */
  let tables;
  /** @type {Map<GatewayCall, {code: number, stdout: string, stderr: string}>} */
  let responses;
  /** The epic's menu over the same world, which the engine draws. @type {string} */
  let epicMenu;

  before(async () => {
    dir = setupFixture();
    seedEveryRowShape(dir);
    // Each script run with runGateway handing its table back instead of
    // dispatching it — the verbs as the script registers them.
    const preload = createFile(dir, 'gateway-verbs.cjs',
      `require(${JSON.stringify(ENGINE_GATEWAY)}).runGateway = (handlers) => process.stdout.write(JSON.stringify(Object.keys(handlers)));\n`);
    const gateways = fs.readdirSync(SKILLS).filter((d) => fs.existsSync(path.join(SKILLS, d, 'scripts/gateway.cjs')));
    const calls = Object.entries(CALLS).flatMap(([gateway, verbs]) => Object.values(verbs).flat().map((call) => ({ gateway, call })));
    const [verbs, answers] = await Promise.all([
      Promise.all(gateways.map((g) => spawnGateway(dir, g, [], { node: ['--require', preload] }))),
      Promise.all(calls.map(({ gateway, call }) => spawnGateway(dir, gateway, call.args, { env: ANNOUNCED }))),
    ]);
    tables = Object.fromEntries(gateways
      .map((g, i) => [g, verbs[i].stdout])
      .filter(([, out]) => out !== '')
      .map(([g, out]) => [g, JSON.parse(out).sort()]));
    responses = new Map(calls.map(({ call }, i) => [call, answers[i]]));
    epicMenu = output(dir, EPIC_MENU, { env: ANNOUNCED });
  });
  after(() => { cleanupFixture(dir); });

  it('calls every verb every gateway dispatches — a verb added without a call here fails', () => {
    assert.deepStrictEqual(tables, Object.fromEntries(Object.entries(CALLS).map(([g, verbs]) => [g, Object.keys(verbs).sort()])));
  });

  for (const [gateway, verbs] of Object.entries(CALLS)) {
    it(`${gateway}: each verb announced states the menu it draws whole, and a response with none states nothing`, () => {
      for (const call of Object.values(verbs).flat()) {
        const label = `${gateway} ${call.args.join(' ')}`.trim();
        const { code, stdout, stderr } = /** @type {{code: number, stdout: string, stderr: string}} */ (responses.get(call));
        assert.strictEqual(code === 0, !call.refused, `[${label}] exit ${code}\n${stderr}`);
        assert.strictEqual(auditGate(stdout, label) !== null, call.gated, `[${label}] ${call.gated ? 'draws no gate' : 'draws a gate'}\n${stdout}`);
      }
    });
  }

  it('the world reaches every row shape the menu builders draw, the epic\'s menu among the gateways\'', () => {
    const gates = [...[...responses.values()].map(({ stdout }) => stdout), epicMenu].map((out) => auditGate(out, 'shape')).filter((g) => g !== null);
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

    const actions = gateOf(output(dir, ['render', 'archived-actions', '--path', archived], { env: ANNOUNCED }));
    assert.strictEqual(actions.statement, 'Selected: Fix user_id in *auth* [draft] (idea, archived)');

    const remove = gateOf(output(dir, ['render', 'archived-delete-gate', '--path', archived], { env: ANNOUNCED }));
    assert.strictEqual(remove.statement, 'Permanently deleting "Fix user_id in *auth* [draft]" removes the file from the repo and cannot be undone.');
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
  it('states no gate', () => {
    const out = announced(() => {
      openGate();
      return menuBlock('empty menu', '');
    });

    assert.ok(!out.includes(GATE_MARKER), out);
    assert.strictEqual(auditGate(out, 'empty menu'), null);
  });

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
