'use strict';

require('./hermetic-env.cjs');

// The GATE payload: each gate stated as data beside the MENU that displays
// it, for a surface that draws the gate itself. Announced by the environment
// and by nothing else — the first suite here is the proof that a session
// without the announcement sees the bytes it always saw.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { output } = require('./engine-harness.cjs');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { openGate, gateBlock, menu, cmdOption } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');

const ANNOUNCED = { WORKFLOWS_GATE_SURFACE: '1' };
const GATE_MARKER = '=== GATE (json for a gate surface — never display) ===';

/** The parsed GATE payload in a response, or null when it carries none. @param {string} out */
function gateOf(out) {
  const lines = out.split('\n');
  const i = lines.indexOf(GATE_MARKER);
  return i === -1 ? null : JSON.parse(lines[i + 1]);
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
 * only door to a shape no render surface produces today.
 * @param {() => void} compose @returns {object}
 */
function collect(compose) {
  const was = process.env.WORKFLOWS_GATE_SURFACE;
  process.env.WORKFLOWS_GATE_SURFACE = '1';
  try {
    openGate();
    compose();
    return JSON.parse(gateBlock('menu').split('\n')[1]);
  } finally {
    if (was === undefined) delete process.env.WORKFLOWS_GATE_SURFACE;
    else process.env.WORKFLOWS_GATE_SURFACE = was;
  }
}

/** An implementation topic sitting at its task gate. @param {string} dir @param {object} [item] */
function seedTaskGate(dir, item = {}) {
  createManifest(dir, 'auth', {
    phases: {
      planning: { items: { 'auth-flow': { status: 'completed' } } },
      implementation: {
        items: {
          'auth-flow': { status: 'in-progress', task_gate_mode: 'gated', current_task: 'auth-flow-1-1', ...item },
        },
      },
    },
  });
}

/** An epic whose discussion a peer session holds while its research runs. @param {string} dir */
function seedHeldEpic(dir) {
  createManifest(dir, 'v1', {
    work_type: 'epic',
    phases: {
      discovery: { items: { auth: { routing: 'discussion', source: 'discovery', order: 1 } } },
      research: { items: { auth: { status: 'in-progress' } } },
      discussion: { items: { auth: { status: 'in-progress' } } },
    },
  });
  const presence = createFile(dir, '.workflows/.cache/v1/discussion/auth/presence',
    JSON.stringify({ pid: process.pid, pid_start: null, session_id: 'peer' }) + '\n');
  const past = new Date(Date.now() - 240 * 1000);
  fs.utimesSync(presence, past, past);
}

describe('gate payload — the announce switch', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a render surface says nothing extra unannounced, and the announced bytes differ only by the GATE block', () => {
    seedTaskGate(dir);
    const plain = output(dir, ['render', 'task-gate', 'auth.implementation.auth-flow']);
    const announced = output(dir, ['render', 'task-gate', 'auth.implementation.auth-flow'], { env: ANNOUNCED });

    assert.ok(!plain.includes('=== GATE'), plain);
    assert.notStrictEqual(plain, announced);
    assert.strictEqual(withoutGate(announced), plain);
  });

  it('a gateway view says nothing extra unannounced, and the announced bytes differ only by the GATE block', () => {
    seedHeldEpic(dir);
    const plain = runGateway(dir, 'workflow-continue-epic', ['view', 'v1']);
    const announced = runGateway(dir, 'workflow-continue-epic', ['view', 'v1'], ANNOUNCED);

    assert.ok(!plain.includes('=== GATE'), plain);
    assert.strictEqual(withoutGate(announced), plain);
  });

  it('a value other than 1 is not an announcement', () => {
    seedTaskGate(dir);
    const plain = output(dir, ['render', 'task-gate', 'auth.implementation.auth-flow']);
    for (const value of ['', '0', 'true', 'yes']) {
      const out = output(dir, ['render', 'task-gate', 'auth.implementation.auth-flow'],
        { env: { WORKFLOWS_GATE_SURFACE: value } });
      assert.strictEqual(out, plain, `WORKFLOWS_GATE_SURFACE=${value} announced a gate`);
    }
  });
});

describe('gate payload — a render surface', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('the task gate states its question, its pressable rows and its typed rows', () => {
    seedTaskGate(dir);
    const out = output(dir, ['render', 'task-gate', 'auth.implementation.auth-flow'], { env: ANNOUNCED });

    assert.deepStrictEqual(gateOf(out), {
      gate: 'task gate',
      question: 'Approve this task?',
      options: [
        { key: 'y', word: 'yes', head: 'Commit and continue to next task', tail: null, struck: false, recommended: false },
        { key: 'a', word: 'auto', head: 'Approve this and all remaining tasks automatically', tail: null, struck: false, recommended: false },
        { key: 'b', word: 'bounded', head: 'Approve this and the remaining tasks in this phase automatically', tail: null, struck: false, recommended: false },
        { key: 't', word: 'technical', head: "Retell the result from the code's perspective", tail: null, struck: false, recommended: false },
        { key: 's', word: 'show', head: 'Show the result as diagrams', tail: null, struck: false, recommended: false },
      ],
      typed: [
        { label: 'Ask', description: "Ask questions about the implementation (doesn't approve or reject)" },
        { label: 'Comment', description: 'Request changes (triggers a fix round)' },
      ],
    });
  });

  it('an auto task gate arms nothing — its DISPLAY is not a gate', () => {
    seedTaskGate(dir, { task_gate_mode: 'auto' });
    const out = output(dir, ['render', 'task-gate', 'auth.implementation.auth-flow'], { env: ANNOUNCED });

    assert.match(out, /^=== DISPLAY: task gate auto-approved/);
    assert.strictEqual(gateOf(out), null);
  });

  it('a display-only surface carries no gate', () => {
    seedTaskGate(dir, { analysis_cycle_total: 4 });
    const out = output(dir, ['render', 'cycle-limit', 'auth.implementation.auth-flow'], { env: ANNOUNCED });

    assert.match(out, /^=== DISPLAY: cycle limit/);
    assert.strictEqual(gateOf(out), null);
  });

  it('a bare-key row records its word as its own head', () => {
    createManifest(dir, 'pay', {
      work_type: 'epic',
      phases: { discovery: { items: { 'data-export': { routing: 'discussion', source: 'discovery' } } } },
    });
    const gate = gateOf(output(dir, ['render', 'cancel-gate', 'pay.discovery.data-export'], { env: ANNOUNCED }));

    assert.strictEqual(gate.gate, 'cancel gate');
    assert.strictEqual(gate.question, 'Cancel it?');
    assert.deepStrictEqual(gate.options[0], { key: 'y', word: 'yes', head: 'Confirm cancellation', tail: null, struck: false, recommended: false });
  });

  it('a metadata tail is split off the head, its italics gone', () => {
    createManifest(dir, 'auth', {
      next_phase: 'planning',
      completed_phases: ['discovery', 'discussion', 'specification'],
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'completed' } } },
      },
    });
    const gate = gateOf(output(dir, ['render', 'revisit-phases', 'auth'], { env: ANNOUNCED }));

    assert.strictEqual(gate.gate, 'revisit phases');
    assert.deepStrictEqual(gate.options[0], { key: '1', word: null, head: 'Discussion', tail: 'completed', struck: false, recommended: false });
    assert.deepStrictEqual(gate.options.at(-1), { key: 'b', word: 'back', head: 'Return to the previous menu', tail: null, struck: false, recommended: false });
  });

  it('each render starts from nothing — neither a menu before it nor a menu-less one leaks rows in', () => {
    seedTaskGate(dir, { analysis_cycle_total: 4 });
    const first = output(dir, ['render', 'task-gate', 'auth.implementation.auth-flow'], { env: ANNOUNCED });
    output(dir, ['render', 'cycle-gate'], { env: ANNOUNCED });
    output(dir, ['render', 'cycle-limit', 'auth.implementation.auth-flow'], { env: ANNOUNCED });
    const last = output(dir, ['render', 'task-gate', 'auth.implementation.auth-flow'], { env: ANNOUNCED });

    assert.deepStrictEqual(gateOf(last), gateOf(first));
  });

  it('a label-less menu asks in its trailing prompt, and that is the question', () => {
    const gate = collect(() => menu('', [cmdOption('1', null, 'The first one'), cmdOption('2', null, 'The second')],
      { prompt: 'Select an option (enter number):' }));

    assert.strictEqual(gate.question, 'Select an option (enter number):');
    assert.deepStrictEqual(gate.options.map((/** @type {{key: string}} */ o) => o.key), ['1', '2']);
  });

  it('a label or an explicit question outranks the prompt', () => {
    assert.strictEqual(collect(() => menu('Which one?', [cmdOption('1', null, 'One')], { prompt: 'Select an option:' })).question,
      'Which one?');
    assert.strictEqual(collect(() => menu('A long statement about the state of things.', [cmdOption('1', null, 'One')],
      { question: 'Proceed?', prompt: 'Select an option:' })).question, 'Proceed?');
  });

  it('the GATE sits directly above the MENU and after every other section', () => {
    const out = output(dir, ['render', 'walkthrough-screen', '--screen', '2', '--from', 'help'], { env: ANNOUNCED });
    const seen = markers(out);

    assert.strictEqual(seen.at(-2), GATE_MARKER);
    assert.match(seen.at(-1), /^=== MENU: walkthrough screen /);
    assert.ok(seen.slice(0, -2).every((m) => !m.startsWith('=== GATE') && !m.startsWith('=== MENU')), seen.join('\n'));
  });
});

describe('gate payload — a gateway menu', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('the unnamed MENU is the "menu" gate, and its range row is typed rather than pressable', () => {
    createFile(dir, '.workflows/.inbox/ideas/2026-03-19--smart-retry.md', '# Smart Retry\n\nContent.');
    createFile(dir, '.workflows/.inbox/bugs/2026-03-20--bad-thing.md', '# Bad Thing\n\nContent.');
    const out = runGateway(dir, 'workflow-start', ['inbox'], ANNOUNCED);

    assert.deepStrictEqual(gateOf(out), {
      gate: 'menu',
      question: 'What would you like to do?',
      options: [
        { key: 'b', word: 'back', head: 'Return', tail: null, struck: false, recommended: false },
      ],
      typed: [
        { label: '1–2', description: 'Select item(s) to work on (comma-separated for several)' },
      ],
    });
  });

  it("the start menu's numbered rows carry its question and their keys", () => {
    createManifest(dir, 'auth', { work_type: 'feature' });
    const gate = gateOf(runGateway(dir, 'workflow-start', ['view'], ANNOUNCED));

    assert.strictEqual(gate.question, 'What would you like to do?');
    assert.deepStrictEqual(gate.options[0],
      { key: '1', word: null, head: 'Continue "Auth"', tail: 'feature, ready for discussion', struck: false, recommended: false });
    assert.deepStrictEqual(gate.typed, []);
  });

  it('a struck row and a recommended row carry their flags, and neither marker survives into the text', () => {
    seedHeldEpic(dir);
    const gate = gateOf(runGateway(dir, 'workflow-continue-epic', ['view', 'v1'], ANNOUNCED));

    assert.strictEqual(gate.gate, 'menu');
    assert.deepStrictEqual(gate.options[0],
      { key: '1', word: null, head: 'Continue "Auth"', tail: 'research', struck: false, recommended: true });
    assert.deepStrictEqual(gate.options[1],
      { key: '2', word: null, head: 'Continue "Auth"', tail: 'discussion · in session (last active 4m ago)', struck: true, recommended: false });
    assert.ok(gate.options.every((o) => !`${o.head}${o.tail}`.includes('recommended')), JSON.stringify(gate.options));
    assert.ok(gate.options.every((o) => !`${o.head}${o.tail}`.includes('~~')), JSON.stringify(gate.options));
  });

  it('the GATE sits directly above the MENU and after every other section', () => {
    seedHeldEpic(dir);
    const seen = markers(runGateway(dir, 'workflow-continue-epic', ['view', 'v1'], ANNOUNCED));

    assert.deepStrictEqual(seen.slice(-2), [GATE_MARKER, '=== MENU (emit verbatim as markdown) ===']);
    assert.ok(seen.slice(0, -2).every((m) => !m.startsWith('=== GATE') && !m.startsWith('=== MENU')), seen.join('\n'));
  });
});
