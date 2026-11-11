'use strict';

// ---------------------------------------------------------------------------
// The learned process gates (leeway-engine/scripts/domain/learned-gates.cjs):
// the list — which gates learn, each by the one name it is keyed by, with
// the report of each row that may run as an automatic step; whether a gate
// shows or runs as a step, from its count at the person's threshold, its
// usual answer's report and its blind ask; the decision point's `gateStep`
// (domain/decision-point.cjs), every gate shown until the switch, and its
// `learned`, what it decides once switched, over the trust log; and a
// learned gate's MENU drawn as its step says (domain/projections/
// surfaces.cjs) by each of the projections that draw one.
//
// Layer: unit. World: a gate's count from events built in memory a day before
// the frozen clock (trust-world.cjs, `history`); `learned`'s tests keep the log
// and the settings file in a config folder of their own, the project a plain
// folder whose state root is pinned (`useTrustWorld`); the menus composed in
// process, the gate opened as the engine's dispatch opens it.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { FROZEN_MS, withFrozenClock } = require('./engine-harness.cjs');
const { filesUnder } = require('./discovery-test-utils.cjs');
const { PROJECT_ID, MODEL, lines, useTrustWorld, history } = require('./trust-world.cjs');

const SKILLS = path.join(__dirname, '../../skills');
const SCRIPTS = path.join(SKILLS, 'leeway-engine/scripts');
const LEARNED_GATES = path.join(SCRIPTS, 'domain/learned-gates.cjs');
const { LEARNED, BLIND_ASK, SHOWS, learnedGate, drawnBlind, stepOf } = require(LEARNED_GATES);
const { gateStep, learned } = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));
const { countsFrom, gateCount, stateOf } = require(path.join(SCRIPTS, 'domain/trust-counts.cjs'));
const { openGate, gateShown, gateStepped, section, menu, cmdOption, MENU_INSTRUCTION } = require(path.join(SCRIPTS, 'domain/projections/surfaces.cjs'));
const { planScreen, checkInScreen, concludeScreen } = require(path.join(SCRIPTS, 'domain/projections/investigation.cjs'));
const { waitAgents } = require(path.join(SCRIPTS, 'domain/projections/decided.cjs'));
const { experimentSpawnGate } = require(path.join(SCRIPTS, 'domain/projections/experiment.cjs'));
const { importReprompt } = require(path.join(SCRIPTS, 'domain/projections/transactions.cjs'));

/** @typedef {ReturnType<typeof history>} History */
/** @typedef {import('../../skills/leeway-engine/scripts/domain/learned-gates.cjs').GateStep} GateStep */

const AT_20 = 0.2;
// A draw of the plan gate's at a unit and topic, with its answers: not blind
// at 13, blind at 16.
const PAY = Object.freeze({ unit: 'pay', topic: 'pay' });

/** Each learned gate drawn by its projection, as it is stepped. @type {Readonly<Record<string, (step: GateStep) => string>>} */
const DRAWN = Object.freeze({
  'import reprompt': (step) => importReprompt(['/notes/sketch.png'], step),
  'wait for agents': (step) => waitAgents('fumi', 'note-window', 'Note Window', ['review'], step),
  'plan gate': (step) => planScreen({ title: 'Crash', order: [{ hypothesis: { name: 'H1', title: 'The save writes a null', state: 'suspected', by: null, body: [] }, check: 'Trace the save' }], settled: [], changed: null }, step),
  'check-in gate': (step) => checkInScreen({ title: 'Crash', hypotheses: [{ name: 'H1', title: 'The save writes a null', state: 'confirmed', by: null, body: [] }], resolved: ['H1'], experiments: [], next: 'Name the root cause' }, step),
  'conclude gate': (step) => concludeScreen({ unit: 'crash', title: 'Crash', hunt: 'The save wrote a null.', symptoms: [], rootCause: 'A null nothing checks.', fix: 'Check the field.', verdict: null, areas: [] }, step),
  'experiment spawn gate': (step) => experimentSpawnGate({ phase: 'discussion', id: 'E1', unit: 'lab', topic: 'timing', workType: 'epic' }, step),
});

/** `draw` with the gate opened as a command opens it: what it drew, and the gate it left shown. @param {() => string} draw */
function opened(draw) {
  openGate();
  const out = draw();
  return { out, shown: gateShown(), stepped: gateStepped() };
}

/** The state of `name`'s count in `h` as of the frozen clock, at 20%. @param {History} h @param {string} [name] */
const stateIn = (h, name = 'plan gate') => stateOf(gateCount(countsFrom(h.events, { project: PROJECT_ID, model: MODEL, now: FROZEN_MS }), name), AT_20);

/** A history of `n` presses of `row` at the plan gate, then `then`'s. @param {number} n @param {string} [row] @param {(h: History) => void} [then] */
function pressed(n, row = 'y', then = () => {}) {
  const h = history();
  for (let i = 0; i < n; i += 1) h.gate('plan gate', { picked: row });
  then(h);
  return h;
}

/** A bound as a percent, to two places. @param {number} bound */
const percent = (bound) => Number((bound * 100).toFixed(2));

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

  it('reports only rows its menu draws to be pressed: never a typed row, a Comment or paths in the person\'s words, nor the conclude\'s keep going, which would hold the investigation open with no one to end it', () => {
    const rows = Object.entries(DRAWN).map(([name, draw]) => {
      const { shown } = opened(() => draw(SHOWS));
      return [name, shown?.options.map((o) => o.key).filter((key) => Object.hasOwn(LEARNED[name], key)), shown?.typed.length];
    });

    assert.deepStrictEqual(rows, [['import reprompt', ['s'], 1], ['wait for agents', ['w', 'g'], 0], ['plan gate', ['y'], 1], ['check-in gate', ['y'], 1], ['conclude gate', ['y'], 1], ['experiment spawn gate', ['y', 'l'], 0]]);
    assert.deepStrictEqual(Object.values(LEARNED).map((reports) => Object.keys(reports)), [['s'], ['w', 'g'], ['y'], ['y'], ['y'], ['y', 'l']]);
  });
});

describe('whether a learned gate shows or runs as a step (16.20.2)', () => {
  it('shows with no answers at all, a new user\'s first time and the author\'s alike (3.S9, 16.S58, 16.20.3)', () => {
    const state = stateIn(history());

    assert.deepStrictEqual([state.asks, percent(state.bound), stepOf('plan gate', state, { ...PAY, answers: 0 })], [true, 95, SHOWS]);
  });

  it('runs as a step on its usual answer once the bound on leaving it falls below the threshold: 12 answers of yes, 20.58%, show; 13, 19.26%, run on yes (3.S7, 16.S59)', () => {
    const twelve = stateIn(pressed(12));
    const thirteen = stateIn(pressed(13));

    assert.deepStrictEqual([percent(twelve.bound), stepOf('plan gate', twelve, { ...PAY, answers: 12 }), percent(thirteen.bound), stepOf('plan gate', thirteen, { ...PAY, answers: 13 })],
      [20.58, SHOWS, 19.26, { step: 'automatic', row: 'y' }]);
  });

  it('shows again once its answers start to vary, the bound a quarter over the threshold: a no after 15 yeses, 25.01%, shows; after 16, 23.77%, it stays a step (3.S8, 16.6.1, 16.6.2)', () => {
    const fifteen = stateIn(pressed(15, 'y', (h) => h.gate('plan gate', { picked: 'n' })));
    const sixteen = stateIn(pressed(16, 'y', (h) => h.gate('plan gate', { picked: 'n' })));
    const quiet = { unit: 'quiet', topic: 'quiet', answers: 17 };

    assert.strictEqual(drawnBlind('plan gate', quiet), false);
    assert.deepStrictEqual([percent(fifteen.bound), stepOf('plan gate', fifteen, quiet), percent(sixteen.bound), stepOf('plan gate', sixteen, quiet)],
      [25.01, SHOWS, 23.77, { step: 'automatic', row: 'y' }]);
  });

  it('shows where its usual answer runs as no step: a Comment, or the conclude\'s keep going', () => {
    const comments = history();
    for (let i = 0; i < 20; i += 1) comments.gate('plan gate', { picked: 'comment' });
    const kept = history();
    for (let i = 0; i < 20; i += 1) kept.gate('conclude gate', { picked: 'k' });
    const draw = { unit: 'quiet', topic: 'quiet', answers: 20 };

    assert.deepStrictEqual([stateIn(comments).asks, stateIn(kept, 'conclude gate').asks], [false, false]);
    assert.deepStrictEqual([stepOf('plan gate', stateIn(comments), draw), stepOf('conclude gate', stateIn(kept, 'conclude gate'), draw)], [SHOWS, SHOWS]);
  });

  it('asks anyway about one showing in twenty, drawn from the gate\'s name, unit, topic and how many answers it holds: alike however often it is drawn, afresh at its next answer (16.S59, 16.21.3, E3)', () => {
    const draws = Array.from({ length: 4000 }, (_, i) => ({ unit: `unit-${i}`, topic: `topic-${i}`, answers: 13 }));
    const blind = draws.filter((draw) => drawnBlind('plan gate', draw));
    const one = blind[0];
    const state = stateIn(pressed(13));

    assert.ok(Math.abs(blind.length / draws.length - BLIND_ASK) < 0.01, `${blind.length} of ${draws.length} drawn blind`);
    assert.deepStrictEqual([stepOf('plan gate', state, one), stepOf('plan gate', state, one)], [SHOWS, SHOWS], 'drawn again before its next answer, it draws alike');
    assert.deepStrictEqual([
      drawnBlind('plan gate', { ...one, answers: 14 }), drawnBlind('check-in gate', one), drawnBlind('plan gate', { ...one, unit: 'other' }), drawnBlind('plan gate', { ...one, topic: 'other' }),
    ], [false, false, false, false], 'its name, unit, topic and answers each part of the draw');
  });
});

describe('the decision point\'s step on a learned gate (decision-point.cjs)', () => {
  const { folder, logPath, project } = useTrustWorld('learned-gates-');

  /** The trust log holding `h`'s events. @param {History} h */
  const logged = (h) => {
    fs.mkdirSync(path.dirname(logPath()), { recursive: true });
    fs.writeFileSync(logPath(), lines(...h.events));
  };

  /** A gate's place in the investigation of `pay`. */
  const at = (/** @type {string} */ dir) => ({ cwd: dir, place: { unit: 'pay', phase: 'investigation', topic: 'pay' } });

  it('shows every gate until the learned gates are switched on (29.19.2), whatever its count', () => {
    const dir = project('mint');
    logged(pressed(13));

    assert.deepStrictEqual(withFrozenClock(() => [gateStep('plan gate', at(dir)), learned('plan gate', at(dir))]), [SHOWS, { step: 'automatic', row: 'y' }]);
  });

  it('once switched, steps a gate as its count stands on the trust log for the project and the session\'s model as of now, at the person\'s threshold from the settings file, its blind ask drawn from how many answers it holds: 13 yeses run as a step, counted as of a moment after the 12th they show; at 15% they show; 16 show on their blind ask', () => {
    const dir = project('mint');
    const h = pressed(12);
    const twelfth = h.now();
    h.gate('plan gate', { picked: 'y' });
    logged(h);
    const thirteen = withFrozenClock(() => learned('plan gate', at(dir)));
    const before = withFrozenClock(() => {
      const now = Date.now;
      Date.now = () => twelfth + 500;
      try {
        return learned('plan gate', at(dir));
      } finally {
        Date.now = now;
      }
    });
    logged(pressed(16));
    const sixteen = withFrozenClock(() => learned('plan gate', at(dir)));
    logged(pressed(13));
    fs.writeFileSync(path.join(folder(), 'config', 'config.json'), JSON.stringify({ trust: { threshold: 0.15 } }));

    assert.deepStrictEqual([drawnBlind('plan gate', { ...PAY, answers: 13 }), drawnBlind('plan gate', { ...PAY, answers: 12 }), drawnBlind('plan gate', { ...PAY, answers: 16 })], [false, false, true]);
    assert.deepStrictEqual([thirteen, before, sixteen, withFrozenClock(() => learned('plan gate', at(dir)))], [{ step: 'automatic', row: 'y' }, SHOWS, SHOWS, SHOWS]);
  });

  it('shows a gate off the list however its answers stand, ready to build among them, reading no trust log for it (3.S4, 16.S58, 16.20.4)', () => {
    const dir = project('mint');
    const h = history();
    for (let i = 0; i < 20; i += 1) h.gate('ready to build', { picked: 'y' });
    logged(h);
    const ready = withFrozenClock(() => learned('ready to build', at(dir)));
    fs.rmSync(logPath());
    fs.mkdirSync(logPath());

    assert.deepStrictEqual([ready, learned('ready to build', at(dir))], [SHOWS, SHOWS]);
    assert.throws(() => learned('plan gate', at(dir)), /EISDIR/, 'a listed gate reads the log');
  });
});

describe('a learned gate\'s MENU, drawn as its step says (surfaces.cjs)', () => {
  it('is refused drawn without a step, an entry after its name among them; a MENU off the list is drawn as it always is', () => {
    const body = () => menu('', [cmdOption('y', 'yes', 'Go ahead')], { question: 'Go ahead?' });
    openGate();

    assert.throws(() => section('MENU: plan gate', MENU_INSTRUCTION, body()), /^Error: plan gate: a learned gate is drawn as the decision point steps it — decision-point\.cjs gateStep$/);
    assert.throws(() => section('MENU: plan gate — revised', MENU_INSTRUCTION, body()), /a learned gate is drawn as the decision point steps it/);
    assert.match(section('MENU: ready to build', MENU_INSTRUCTION, body()), /^=== MENU: ready to build /);
  });

  it('run as an automatic step, draws in its menu\'s place a DATA naming the gate, the row it ran and that row\'s next, then the row\'s report under a marker that does not stop — no gate shown (3.2.9, 6.6.14, 29.19.7, E13)', () => {
    const runs = Object.entries(LEARNED).flatMap(([name, reports]) => Object.keys(reports).map((row) => {
      const { out, shown, stepped } = opened(() => DRAWN[name]({ step: 'automatic', row }));
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
      ['wait for agents', 'w', { kind: 'engine', argv: ['render', 'wait-agents', 'fumi.note-window'] }],
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

    assert.throws(() => DRAWN['conclude gate']({ step: 'automatic', row: 'k' }), /^Error: conclude gate: row k runs as no automatic step — learned-gates\.cjs reports each row that does, and its menu draws it$/);
  });
});
