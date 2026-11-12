'use strict';

// ---------------------------------------------------------------------------
// The learned process gates (leeway-engine/scripts/domain/learned-gates.cjs):
// the list — which gates learn, each by the one name it is keyed by, with
// the report of each row that may run as an automatic step; whether a gate
// shows or runs as a step, from its count at the person's threshold, its
// usual answer's report and its showing's blind ask; the decision point's
// `gateStep` (domain/decision-point.cjs), every gate shown until the switch,
// and its `learned`, what it decides once switched, over the trust log and
// the showing the conversation holds open; and a learned gate's MENU drawn as
// its step says (domain/projections/surfaces.cjs) by each of the projections
// that draw one.
//
// Layer: unit. World: a gate's count from events built in memory a day before
// the frozen clock (trust-world.cjs, `history`); `learned`'s tests keep the log
// and the settings file in a config folder of their own, the project a plain
// folder whose state root is pinned (`useTrustWorld`), a showing held open
// drawn and answered in a conversation as the engine's commands draw and
// answer it, on the real clock, the separate call the stub binary; the menus
// composed in process, the gate opened as the engine's dispatch opens it.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { FROZEN_MS, withFrozenClock } = require('./engine-harness.cjs');
const { filesUnder, withEnv } = require('./discovery-test-utils.cjs');
const { PROJECT_ID, MODEL, SESSION, DAY, lines, useTrustWorld, inConversation, history } = require('./trust-world.cjs');

const SKILLS = path.join(__dirname, '../../skills');
const SCRIPTS = path.join(SKILLS, 'leeway-engine/scripts');
const LEARNED_GATES = path.join(SCRIPTS, 'domain/learned-gates.cjs');
const { LEARNED, BLIND_ASK, learnedGate, showingOf, drawnBlind, shows, stepOf } = require(LEARNED_GATES);
const { gateStep, learned } = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));
const { countsFrom, gateCount, stateOf } = require(path.join(SCRIPTS, 'domain/trust-counts.cjs'));
const { openGate, gateShown, gateStepped, section, menu, cmdOption, MENU_INSTRUCTION } = require(path.join(SCRIPTS, 'domain/projections/surfaces.cjs'));
const { recordGateShown, answerGate, lastShown } = require(path.join(SCRIPTS, 'domain/gate.cjs'));
const { planScreen, checkInScreen, concludeScreen } = require(path.join(SCRIPTS, 'domain/projections/investigation.cjs'));
const { waitAgents } = require(path.join(SCRIPTS, 'domain/projections/decided.cjs'));
const { experimentSpawnGate } = require(path.join(SCRIPTS, 'domain/projections/experiment.cjs'));
const { importReprompt } = require(path.join(SCRIPTS, 'domain/projections/transactions.cjs'));

/** @typedef {ReturnType<typeof history>} History */
/** @typedef {import('../../skills/leeway-engine/scripts/domain/learned-gates.cjs').GateStep} GateStep */

const AT_20 = 0.2;
// Where gates come: nowhere, pay's investigation, and pay's discussion of cards.
const NOWHERE = Object.freeze({ unit: null, phase: null, topic: null });
const HUNT = Object.freeze({ unit: 'pay', phase: 'investigation', topic: 'pay' });
const CARDS = Object.freeze({ unit: 'pay', phase: 'discussion', topic: 'cards' });
// A showing no gate here draws blind.
const SHOWING = showingOf(HUNT, ['H1']);

/** Each learned gate drawn by its projection, as it is stepped. @type {Readonly<Record<string, (step: GateStep) => string>>} */
const DRAWN = Object.freeze({
  'import reprompt': (step) => importReprompt(['/notes/sketch.png'], step),
  'wait for agents': (step) => waitAgents('fumi', 'note-window', 'Note Window', ['review'], step),
  'plan gate': (step) => planScreen({ title: 'Crash', order: [{ hypothesis: { name: 'H1', title: 'The save writes a null', state: 'suspected', by: null, body: [] }, check: 'Trace the save' }], settled: [], changed: null }, step),
  'check-in gate': (step) => checkInScreen({ title: 'Crash', hypotheses: [{ name: 'H1', title: 'The save writes a null', state: 'confirmed', by: null, body: [] }], resolved: ['H1'], experiments: [], next: 'Name the root cause' }, step),
  'conclude gate': (step) => concludeScreen({ unit: 'crash', title: 'Crash', hunt: 'The save wrote a null.', symptoms: [], rootCause: 'A null nothing checks.', fix: 'Check the field.', verdict: null, areas: [] }, step),
  'experiment spawn gate': (step) => experimentSpawnGate({ phase: 'discussion', id: 'E1', unit: 'lab', topic: 'timing', workType: 'epic' }, step),
});

/** The step run on the gate `gate`'s row `row`, on `showing`. @param {string} gate @param {string} row @param {string} [showing] @returns {GateStep} */
const ran = (gate, row, showing = SHOWING) => ({ step: 'automatic', gate, row, showing });

/** `draw` with the gate opened as a command opens it: what it drew, and the gate it left shown. @param {() => string} draw */
function opened(draw) {
  openGate();
  const out = draw();
  return { out, shown: gateShown(), stepped: gateStepped() };
}

/** The state of `name`'s count in `h` as of the frozen clock, at 20%. @param {History} h @param {string} [name] */
const stateIn = (h, name = 'plan gate') => stateOf(gateCount(countsFrom(h.events, { project: PROJECT_ID, model: MODEL, now: FROZEN_MS }), name), AT_20);

/** A history of `n` presses of `row` at `gate`, then `then`'s. @param {number} n @param {{row?: string, gate?: string, start?: number}} [at] @param {(h: History) => void} [then] */
function pressed(n, { row = 'y', gate = 'plan gate', start } = {}, then = () => {}) {
  const h = history(start === undefined ? {} : { start });
  for (let i = 0; i < n; i += 1) h.gate(gate, { picked: row });
  then(h);
  return h;
}

/** A bound as a percent, to two places. @param {number} bound */
const percent = (bound) => Number((bound * 100).toFixed(2));

/** `n` counting from 0. @param {number} n */
const range = (n) => Array.from({ length: n }, (_, i) => i);

describe('the list (P4, 16.11.9, 16.14.7)', () => {
  it('holds the six process gates the plan names, pooling none, and no authority gate, nor the build\'s gate after a task or its phase merge, which show only in step (3.2.3, 3.S4, 16.S58, 7.2.4)', () => {
    const off = ['start this work', 'approve the map', 'decided', 'ready to build', 'finish', 'step gate — 1.1', 'phase merge — 1'];

    assert.deepStrictEqual(Object.keys(LEARNED), ['import reprompt', 'wait for agents', 'plan gate', 'check-in gate', 'conclude gate', 'experiment spawn gate']);
    assert.deepStrictEqual(off.map(learnedGate), off.map(() => null));
    assert.strictEqual(learnedGate('plan gate — revised'), 'plan gate', 'an entry after its name is that gate, keyed by the name before it');
  });

  it('declares each by one MENU in the engine, and names it in one other place, where its surface asks the decision point to step it — so its name keys one gate for good (16.11.9)', () => {
    const sources = filesUnder(SKILLS).filter((file) => file.endsWith('.cjs') && file !== LEARNED_GATES).map((file) => fs.readFileSync(file, 'utf8'));
    const count = (/** @type {RegExp} */ pattern) => sources.reduce((n, text) => n + (text.match(pattern)?.length ?? 0), 0);

    assert.deepStrictEqual(Object.keys(LEARNED).map((name) => [name, count(new RegExp(`MENU: ${name}(?=['\`"]| — )`, 'g')), count(new RegExp(`['"\`]${name}['"\`]`, 'g'))]), Object.keys(LEARNED).map((name) => [name, 1, 1]));
  });

  it('reports only rows its menu draws to be pressed: never a typed row, a Comment or paths in the person\'s words; nor the conclude\'s keep going, which would hold the investigation open with no one to end it; nor the wait\'s wait, whose next draws the wait again while the agents run', () => {
    const rows = Object.entries(DRAWN).map(([name, draw]) => {
      const { shown } = opened(() => draw(shows(name, SHOWING)));
      return [name, shown?.options.map((o) => o.key).filter((key) => Object.hasOwn(LEARNED[name], key)), shown?.typed.length];
    });

    assert.deepStrictEqual(rows, [['import reprompt', ['s'], 1], ['wait for agents', ['g'], 0], ['plan gate', ['y'], 1], ['check-in gate', ['y'], 1], ['conclude gate', ['y'], 1], ['experiment spawn gate', ['y', 'l'], 0]]);
    assert.deepStrictEqual(Object.values(LEARNED).map((reports) => Object.keys(reports)), [['s'], ['g'], ['y'], ['y'], ['y'], ['y', 'l']]);
  });
});

describe('whether a learned gate shows or runs as a step (16.20.2)', () => {
  it('shows with no answers at all, a new user\'s first time and the author\'s alike (3.S9, 16.S58, 16.20.3)', () => {
    const state = stateIn(history());

    assert.deepStrictEqual([state.asks, percent(state.bound), stepOf('plan gate', state, SHOWING)], [true, 95, shows('plan gate', SHOWING)]);
  });

  it('runs as a step on its usual answer once the bound on leaving it falls below the threshold: 12 answers of yes, 20.58%, show; 13, 19.26%, run on yes (3.S7, 16.S59)', () => {
    const twelve = stateIn(pressed(12));
    const thirteen = stateIn(pressed(13));

    assert.deepStrictEqual([percent(twelve.bound), stepOf('plan gate', twelve, SHOWING), percent(thirteen.bound), stepOf('plan gate', thirteen, SHOWING)],
      [20.58, shows('plan gate', SHOWING), 19.26, ran('plan gate', 'y')]);
  });

  it('shows again once its answers start to vary, the bound a quarter over the threshold: a no after 15 yeses, 25.01%, shows; after 16, 23.77%, it stays a step (3.S8, 16.6.1, 16.6.2)', () => {
    const fifteen = stateIn(pressed(15, {}, (h) => h.gate('plan gate', { picked: 'n' })));
    const sixteen = stateIn(pressed(16, {}, (h) => h.gate('plan gate', { picked: 'n' })));

    assert.deepStrictEqual([percent(fifteen.bound), stepOf('plan gate', fifteen, SHOWING), percent(sixteen.bound), stepOf('plan gate', sixteen, SHOWING)],
      [25.01, shows('plan gate', SHOWING), 23.77, ran('plan gate', 'y')]);
  });

  it('shows where its usual answer runs as no step: a Comment, the conclude\'s keep going, or the wait\'s wait', () => {
    const usual = [['plan gate', 'comment'], ['conclude gate', 'k'], ['wait for agents', 'w']].map(([gate, row]) => [gate, stateIn(pressed(20, { gate, row }), gate)]);

    assert.deepStrictEqual(usual.map(([gate, state]) => [state.asks, stepOf(gate, state, SHOWING)]), usual.map(([gate]) => [false, shows(gate, SHOWING)]));
  });

  it('asks about one showing in twenty wherever it comes: the import reprompt over its showings at no place, the spawn gate over a topic\'s experiments at one place, and a check-in four times in each of many investigations (16.S59, 16.21.3)', () => {
    /** @param {string} gate @param {string[]} showings */
    const rate = (gate, showings) => showings.filter((showing) => drawnBlind(gate, showing)).length / showings.length;
    const rates = [
      rate('import reprompt', range(4000).map((i) => showingOf(NOWHERE, [`/notes/sketch-${i}.png`]))),
      rate('experiment spawn gate', range(4000).map((i) => showingOf(CARDS, `E${i + 1}`))),
      rate('check-in gate', range(1000).flatMap((i) => range(4).map((n) => showingOf({ unit: `bug-${i}`, phase: 'investigation', topic: `bug-${i}` }, [`H${n + 1}`])))),
    ];

    assert.ok(rates.every((rate) => Math.abs(rate - BLIND_ASK) < 0.01), `drawn blind: ${rates.join(', ')}`);
  });

  it('draws a showing alike however often it is drawn, and afresh where any part of it differs — the gate\'s name, its unit, phase or topic, its surface\'s key; a showing\'s digest pinned, so a replay draws a past showing from the log as it was drawn (E3)', () => {
    const key = [['H1', 'H2', 'H3', 'H4'], null];
    const one = showingOf(HUNT, key);
    const state = stateIn(pressed(13));

    assert.deepStrictEqual([one, showingOf(HUNT, key), stepOf('plan gate', state, one)], ['bf3bd2639c2e9dff', one, shows('plan gate', one)]);
    assert.deepStrictEqual([
      drawnBlind('check-in gate', one),
      drawnBlind('plan gate', showingOf({ ...HUNT, unit: 'other' }, key)),
      drawnBlind('plan gate', showingOf({ ...HUNT, phase: 'discussion' }, key)),
      drawnBlind('plan gate', showingOf({ ...HUNT, topic: 'other' }, key)),
      drawnBlind('plan gate', showingOf(HUNT, [key[0], 'H5 was ruled out'])),
    ], [false, false, false, false, false]);
  });
});

describe('the decision point\'s step on a learned gate (decision-point.cjs)', () => {
  const { folder, logPath, project } = useTrustWorld('learned-gates-');

  /** The trust log holding `h`'s events. @param {History} h */
  const logged = (h) => {
    fs.mkdirSync(path.dirname(logPath()), { recursive: true });
    fs.writeFileSync(logPath(), lines(...h.events));
  };

  /** The wait for agents at pay's discussion of cards, the agents `running` running. @param {string} dir @param {string[]} [running] */
  const waiting = (dir, running = ['a1']) => ({ cwd: dir, place: CARDS, key: running });

  /** The plan gate at pay's investigation, its order `order` and what a revision changed. @param {string} dir @param {string[]} order @param {string|null} [changed] */
  const planned = (dir, order, changed = null) => ({ cwd: dir, place: HUNT, key: [order, changed] });

  /**
   * The gate `gate` at `at` drawn in the conversation as its surface draws it,
   * stepped by `learned`, and kept as the gate shown: its step.
   * @param {string} gate @param {import('../../skills/leeway-engine/scripts/domain/decision-point.cjs').GateAt} at
   */
  function drawn(gate, at) {
    const step = learned(gate, at);
    openGate();
    DRAWN[gate](step);
    recordGateShown();
    return step;
  }

  it('shows every gate until the learned gates are switched on (29.19.2), whatever its count, on the showing its surface draws', () => {
    const dir = project('mint');
    logged(pressed(13, { gate: 'wait for agents', row: 'g' }));
    const showing = showingOf(CARDS, ['a1']);

    assert.deepStrictEqual(withFrozenClock(() => [gateStep('wait for agents', waiting(dir)), learned('wait for agents', waiting(dir))]), [shows('wait for agents', showing), ran('wait for agents', 'g', showing)]);
  });

  it('once switched, steps a gate as its count stands on the trust log for the project and the session\'s model as of now, at the person\'s threshold from the settings file, on its showing: 13 answers run as a step, counted as of a moment after the 12th they show; at 15% they show; a showing drawn blind shows', () => {
    const dir = project('mint');
    const h = pressed(12, { gate: 'wait for agents', row: 'g' });
    const twelfth = h.now();
    h.gate('wait for agents', { picked: 'g' });
    logged(h);
    const thirteen = withFrozenClock(() => learned('wait for agents', waiting(dir)));
    const blind = withFrozenClock(() => learned('wait for agents', waiting(dir, ['a22'])));
    const before = withFrozenClock(() => {
      const now = Date.now;
      Date.now = () => twelfth + 500;
      try {
        return learned('wait for agents', waiting(dir));
      } finally {
        Date.now = now;
      }
    });
    fs.writeFileSync(path.join(folder(), 'config', 'config.json'), JSON.stringify({ trust: { threshold: 0.15 } }));
    const showing = showingOf(CARDS, ['a1']);

    assert.deepStrictEqual([drawnBlind('wait for agents', showing), drawnBlind('wait for agents', showingOf(CARDS, ['a22']))], [false, true]);
    assert.deepStrictEqual([thirteen, blind, before, withFrozenClock(() => learned('wait for agents', waiting(dir)))],
      [ran('wait for agents', 'g', showing), shows('wait for agents', showingOf(CARDS, ['a22'])), shows('wait for agents', showing), shows('wait for agents', showing)]);
  });

  it('in a unit whose build is in step, every gate of its build shows whatever its count, and a gate outside its build follows its count — only the build has a position (3.3.1, 3.3.3)', () => {
    const dir = project('mint');
    fs.mkdirSync(path.join(dir, '.leeway', 'pay'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.leeway', 'pay', 'manifest.json'), JSON.stringify({ build: { position: 'step' } }));
    logged(pressed(13, { gate: 'wait for agents', row: 'g' }));
    const building = { ...waiting(dir), place: { unit: 'pay', phase: 'implementation', topic: null } };

    assert.deepStrictEqual(withFrozenClock(() => [learned('wait for agents', waiting(dir)).step, learned('wait for agents', building).step]), ['automatic', 'show']);
  });

  it('shows a gate off the list however its answers stand, ready to build among them, reading no trust log for it (3.S4, 16.S58, 16.20.4)', () => {
    const dir = project('mint');
    logged(pressed(20, { gate: 'ready to build', row: 's' }));
    const ready = withFrozenClock(() => learned('ready to build', planned(dir, ['H1'])));
    fs.rmSync(logPath());
    fs.mkdirSync(logPath());

    assert.deepStrictEqual([ready, learned('ready to build', planned(dir, ['H1']))], [shows('ready to build', null), shows('ready to build', null)]);
    assert.throws(() => learned('plan gate', planned(dir, ['H1'])), /EISDIR/, 'a listed gate reads the log');
  });

  it('a showing the conversation holds open shows again, never drawn again: free text read as its usual answer tips its count quiet, and the gate shown again still shows; a pick ends the showing, and the next is drawn (S2)', () => {
    const dir = project('mint');
    logged(pressed(12, { start: Date.now() - DAY }));

    const steps = inConversation(dir, () => {
      const first = drawn('plan gate', planned(dir, ['H1', 'H2']));
      withEnv({ CLAUDE_STUB_ANSWERS: JSON.stringify({ '': { row: 'y' } }) }, () => answerGate(dir, 'plan gate', { words: 'looks right, go ahead' }));
      const again = drawn('plan gate', planned(dir, ['H1', 'H2']));
      answerGate(dir, 'plan gate', { pick: 'y' });
      return [first, again, learned('plan gate', planned(dir, ['H2'], 'H1 is confirmed'))].map(({ step }) => step);
    });

    assert.deepStrictEqual(steps, ['show', 'show', 'automatic']);
  });

  it('a showing set aside by a Comment shows again however its surface draws it now, and the gate shown keeps the time its showing opened and the showing it was first drawn on (S2)', () => {
    const dir = project('mint');
    logged(pressed(20, { start: Date.now() - DAY }));
    const first = [['H1', 'H2', 'H3', 'H4'], null];

    const [steps, kept] = inConversation(dir, () => {
      const blind = drawn('plan gate', { cwd: dir, place: HUNT, key: first });
      const { opened } = /** @type {{opened: string}} */ (lastShown(SESSION));
      answerGate(dir, 'plan gate', { typed: 'comment' });
      const reordered = drawn('plan gate', planned(dir, ['H4', 'H1', 'H2', 'H3']));
      const shown = /** @type {{opened: string, showing: string}} */ (lastShown(SESSION));
      return [[blind.step, reordered.step], [shown.opened === opened, shown.showing]];
    });

    assert.deepStrictEqual([steps, kept], [['show', 'show'], [true, showingOf(HUNT, first)]]);
    assert.strictEqual(drawnBlind('plan gate', showingOf(HUNT, [['H4', 'H1', 'H2', 'H3'], null])), false, 'drawn afresh, the reordered plan would run as a step');
  });

  it('a showing redrawn while it waits shows again though what its surface draws it from changed meanwhile — an agent finished — on the showing it was drawn on', () => {
    const dir = project('mint');
    logged(pressed(13, { gate: 'wait for agents', row: 'g', start: Date.now() - DAY }));

    const [steps, showing] = inConversation(dir, () => {
      const both = drawn('wait for agents', waiting(dir, ['a40', 'a41']));
      const one = drawn('wait for agents', waiting(dir, ['a41']));
      return [[both.step, one.step], lastShown(SESSION)?.showing];
    });

    assert.deepStrictEqual([steps, showing], [['show', 'show'], showingOf(CARDS, ['a40', 'a41'])]);
    assert.strictEqual(drawnBlind('wait for agents', showingOf(CARDS, ['a41'])), false, 'drawn afresh, the wait over one agent would run as a step');
  });
});

describe('a learned gate\'s MENU, drawn as its step says (surfaces.cjs)', () => {
  it('is refused drawn without a step, or with another gate\'s — an entry after its name among them; a MENU off the list is drawn as it always is', () => {
    const body = () => menu('', [cmdOption('y', 'yes', 'Go ahead')], { question: 'Go ahead?' });
    openGate();

    assert.throws(() => section('MENU: plan gate', MENU_INSTRUCTION, body()), /^Error: plan gate: a learned gate is drawn as the decision point steps it — decision-point\.cjs gateStep$/);
    assert.throws(() => section('MENU: plan gate — revised', MENU_INSTRUCTION, body()), /a learned gate is drawn as the decision point steps it/);
    assert.throws(() => DRAWN['plan gate'](shows('check-in gate', SHOWING)), /^Error: plan gate: a learned gate is drawn as the decision point steps it, not as check-in gate's — decision-point\.cjs gateStep$/);
    assert.throws(() => DRAWN['check-in gate'](ran('plan gate', 'y')), /check-in gate: a learned gate is drawn as the decision point steps it, not as plan gate's/);
    assert.match(section('MENU: ready to build', MENU_INSTRUCTION, body()), /^=== MENU: ready to build /);
  });

  it('shown, keeps the showing it was drawn on as the gate shown', () => {
    const { shown } = opened(() => DRAWN['conclude gate'](shows('conclude gate', SHOWING)));

    assert.strictEqual(shown?.showing, SHOWING);
  });

  it('run as an automatic step, draws in its menu\'s place a DATA naming the gate, the row it ran and that row\'s next, then the row\'s report under a marker that does not stop — no gate shown (3.2.9, 6.6.14, 29.19.7, E13)', () => {
    const runs = Object.entries(LEARNED).flatMap(([name, reports]) => Object.keys(reports).map((row) => {
      const { out, shown, stepped } = opened(() => DRAWN[name](ran(name, row)));
      return { gate: name, row, step: out.slice(out.indexOf('=== DATA')), menu: out.includes('=== MENU'), shown, stepped };
    }));
    const automatic = (/** @type {string} */ gate, /** @type {string} */ row, /** @type {unknown} */ next) => [
      '=== DATA (reason from this — never display or parse the sections below) ===',
      `automatic step: ${gate}`,
      `ran: ${row}`,
      `next: ${JSON.stringify(next)}`,
      '=== DISPLAY: automatic step (emit verbatim as a text code block (```text fence) — an automatic step: do not stop; carry on along the row it ran, as its DATA names it) ===',
      LEARNED[gate][row],
      '',
    ].join('\n');
    const continues = { kind: 'continue' };

    assert.deepStrictEqual(runs, [
      ['import reprompt', 's', null],
      ['wait for agents', 'g', continues],
      ['plan gate', 'y', continues],
      ['check-in gate', 'y', continues],
      ['conclude gate', 'y', { kind: 'engine', argv: ['investigation', 'conclude', 'crash'] }],
      ['experiment spawn gate', 'y', { kind: 'handoff', skill: 'leeway-experiment-process', args: ['epic', 'lab', 'timing'] }],
      ['experiment spawn gate', 'l', continues],
    ].map(([gate, row, next]) => ({ gate, row, step: automatic(String(gate), String(row), next), menu: false, shown: null, stepped: true })));
  });

  it('refuses a step on a row that runs as none, drawing nothing', () => {
    openGate();

    assert.throws(() => DRAWN['conclude gate'](ran('conclude gate', 'k')), /^Error: conclude gate: row k runs as no automatic step — learned-gates\.cjs reports each row that does, and its menu draws it$/);
  });
});
