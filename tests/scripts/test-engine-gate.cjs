'use strict';

// ---------------------------------------------------------------------------
// The person's answer at a gate (leeway-engine/scripts/domain/gate.cjs):
// the record of the gate shown — every MENU's gate stated through
// `section()` (surfaces.cjs), the command's MENU kept for the calling
// conversation by the engine's dispatch and a skill's gateway, with the mod
// announced or not, never for a command that failed, a menu drawn as an
// illustration, a raise's menu, or a command without a session — and
// `engine gate`, which logs the answer to the trust log by the gate's name
// (3.2.6, 16.11.9): the row the engine recommended and the row picked, a
// typed row, or free text, its words read by the separate call for the row
// they pick and dropped (16.S40, 16.S68); pressed only where the mod's record of its last
// press names this gate and row after it was shown — whatever the rows mod
// did with the send's own record — typed otherwise and always with the mod
// off (6.6.3, 6.6.4); what the row leads to returned and never performed
// (6.6.2); a rerun after a kill read once; each refusal logging nothing, a
// raise's among them; a showing set aside and shown again one showing, its
// answers one event, and a learned gate's showing on it; and the mod's
// record of a press read as the mod writes it, each literal read off its
// source.
//
// Layer: verb, the gateway's record and the source guard beside it. World:
// the project from the fixture library, read and never written — a feature
// in implementation while another unit's session holds the code slot,
// which puts the code gate's recommended row on screen — shared by every
// test; a plain repository without state for the gate before the project
// has any. Each test keeps its conversation and its trust log in a config
// folder of its own. The separate call is the stub binary, unarmed — no
// login, so no words are read — but where a test arms it.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { ok, output, refuses, initRepo, cleanupFixture } = require('./engine-harness.cjs');
const { setupFixture, createManifest, statePath, useTempFolder, withEnv, layout, filesUnder } = require('./discovery-test-utils.cjs');

const SKILLS = path.join(__dirname, '../../skills');
const SCRIPTS = path.join(SKILLS, 'leeway-engine/scripts');
const {
  openGate, gateShown, illustrate, section, menu, cmdOption, promptOption, rangeOption, MENU_INSTRUCTION,
} = require(path.join(SCRIPTS, 'domain/projections/surfaces.cjs'));
const { showingOf, shows } = require(path.join(SCRIPTS, 'domain/learned-gates.cjs'));
const { recordGateShown } = require(path.join(SCRIPTS, 'domain/gate.cjs'));
const { readTrustLog } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));
const { renderSurface } = require(path.join(SCRIPTS, 'domain/render.cjs'));
const { codeGate } = require(path.join(SCRIPTS, 'domain/projections/enter.cjs'));
const { announced } = require('./gate-audit.cjs');

// A Claude Code session's id.
const SESSION = 'c0ffee00-1234-4abc-8def-0123456789ab';
const ANNOUNCED = { LEEWAY_GATE_SURFACE: '1' };
const CODE_QUESTION = 'Proceed anyway?';

const config = useTempFolder('gate-config-');

/** @type {string} */
let dir;

before(() => {
  dir = setupFixture('gate-');
  createManifest(dir, 'pay', {});
});

after(() => cleanupFixture(dir));

/** The calling conversation's environment, over `env`. @param {Record<string, string|undefined>} [env] */
const conversation = (env = {}) => ({ CLAUDE_CODE_SESSION_ID: SESSION, LEEWAY_CONFIG_DIR: config(), ...env });

/** A file in the conversation's folder. @param {string} name */
const inFolder = (name) => path.join(config(), 'conversations', SESSION, name);

/** The record of the gate shown, as the engine wrote it; null where there is none. */
function shown() {
  const file = inFolder('gate-shown.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** Every event of the trust log, in order. @returns {Record<string, unknown>[]} */
function events() {
  const file = path.join(config(), 'trust.jsonl');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line)) : [];
}

/** The project's key in the trust log. */
const projectId = () => JSON.parse(fs.readFileSync(statePath(dir, layout.projectManifest), 'utf8')).project_id;

/** Render a surface for the conversation. @param {string[]} args @param {Record<string, string|undefined>} [env] */
const render = (args, env) => output(dir, ['render', ...args], { env: conversation(env) });

/** Answer the gate shown, `stdin` the person's words. @param {string[]} args @param {Record<string, string|undefined>} [env] @param {string} [stdin] */
const answer = (args, env, stdin) => ok(dir, ['gate', ...args], { env: conversation(env), stdin });

/** An answer the engine refuses: its error. @param {string[]} args @param {Record<string, string|undefined>} [env] @param {string} [stdin] */
const refused = (args, env, stdin) => refuses(dir, ['gate', ...args], { env: conversation(env), stdin }).error;

/** What the person typed in place of a row. */
const WORDS = 'not yet — I want to sort the repository settings out myself first';

/** The separate calls the stub logged to `log`. @param {string} log @returns {{argv: string[], input: string}[]} */
const calls = (log) => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : []);

/**
 * The mod's record of its last press: the code gate's `yes` unless `over`
 * says otherwise, sent `after` ms after the gate shown was shown.
 * @param {number} after @param {Record<string, unknown>} [over]
 */
function pressed(after, over = {}) {
  const at = new Date(Date.parse(shown().at) + after).toISOString();
  fs.writeFileSync(inFolder('pressed.json'), JSON.stringify({ gate: 'code gate', answer: 'yes', at, ...over }));
}

/**
 * A menu declared as `declared`, its rows composed by `rows` once the gate
 * is open, shown the conversation as a command shows it — `env` over the
 * command's environment — and the GATE payloads it stated.
 * @param {string} declared @param {() => string[]} rows @param {Record<string, string|undefined>} [env]
 * @returns {Record<string, any>[]}
 */
function showMenu(declared, rows, env = {}) {
  return inConversation(() => {
    const payloads = withEnv(env, () => {
      openGate();
      return gatePayloads(section(`MENU: ${declared}`, MENU_INSTRUCTION, menu('', rows(), { question: 'Go on?' })));
    });
    recordGateShown();
    return payloads;
  });
}

/**
 * The code gate (12.7.8) shown the conversation as the build's entry draws
 * it, a peer implementing ship's checkout flow — `env` over the command's
 * environment.
 * @param {Record<string, string|undefined>} [env]
 */
function showCodeGate(env = {}) {
  inConversation(() => {
    withEnv(env, () => {
      openGate();
      codeGate([{ work_unit: 'ship', phase: 'implementation', topic: 'checkout-flow', age_seconds: 60 }]);
    });
    recordGateShown();
  });
}

/** The in-session gate's rows: back, recommended, or on into the held topic. */
const IN_SESSION_ROWS = () => [cmdOption('b', 'back', { head: 'Return to menu', recommended: true }), cmdOption('y', 'yes', 'Proceed anyway')];

/** The GATE payloads an output states. @param {string} out @returns {Record<string, any>[]} */
function gatePayloads(out) {
  const lines = out.split('\n');
  return lines.flatMap((line, i) => (line.startsWith('=== GATE (') ? [JSON.parse(lines[i + 1])] : []));
}

/** A gate event's own fields, the header the engine sets left out. @param {Record<string, unknown>} event */
const ownFields = ({ gate, recommended, picked, via, with_text: withText, reading }) => ({ gate, recommended, picked, via, with_text: withText, reading });

/** Run `fn` as a command the conversation runs in this process. @template T @param {() => T} fn @returns {T} */
const inConversation = (fn) => withEnv(conversation(), fn);

describe('the gate shown (3.S6)', () => {
  it('a render records the gate its MENU states for the conversation: its name, its question, each row with its word, its head, its tail and detail, whether the engine recommends it and what it leads to, each typed row by its key, and when it was shown', () => {
    const before = Date.now();
    render(['migration-gate']);
    const after = Date.now();

    const { at, ...record } = shown();
    assert.deepStrictEqual(record, {
      gate: 'migration gate',
      question: 'Ready to continue?',
      options: [{ key: 'y', word: 'yes', head: 'Proceed', tail: null, detail: null, recommended: false, next: null }],
      typed: [{ key: 'ask', label: 'Ask', prompt: true, next: null }],
      showing: null,
      answered: null,
    });
    assert.ok(Date.parse(at) >= before && Date.parse(at) <= after, at);
  });

  it('is recorded whether or not the gate mod announced itself, which adds only the GATE block to what the render says', () => {
    const plain = render(['migration-gate']);
    const { at: _plainAt, ...unannounced } = shown();
    const announced = render(['migration-gate'], ANNOUNCED);
    const { at: _announcedAt, ...withMod } = shown();

    assert.deepStrictEqual(withMod, unannounced);
    assert.ok(!plain.includes('=== GATE'), plain);
    assert.strictEqual(announced.replace(/^=== GATE \(.*\) ===\n.*\n/m, ''), plain);
  });

  it('a command whose output states no gate leaves the gate shown standing', () => {
    render(['migration-gate']);
    const before = shown();
    render(['github-rule-gate']);
    const replaced = shown();
    render(['signpost', 'Next step']);

    assert.strictEqual(before.gate, 'migration gate');
    assert.strictEqual(replaced.gate, 'github rule gate');
    assert.deepStrictEqual(shown(), replaced);
  });

  it('a raise is no gate: a MENU declared as a raise\'s is never recorded, announced or not, and the gate shown before it stands (E6)', () => {
    render(['migration-gate']);
    const before = shown();

    for (const env of [{}, ANNOUNCED]) showMenu('raise — 3IvpS2ynHKerzBxUBYWrs', IN_SESSION_ROWS, env);

    assert.deepStrictEqual(shown(), before);
  });

  it('a command that fails records nothing — the gate it composed before it failed was never shown, and the gate shown stands to be answered', () => {
    render(['migration-gate']);
    const before = shown();
    refuses(dir, ['render', 'cancel-gate', 'ghost.discovery.none'], { env: conversation() });

    assert.deepStrictEqual(shown(), before);
    assert.strictEqual(answer(['migration gate', '--pick', 'y']).picked, 'y');
  });

  it('the command opens the gate, never the surface it renders: a surface rendered after the command\'s MENU took the gate states none of its own', () => {
    openGate();
    section('MENU: opened gate', MENU_INSTRUCTION, menu('', [cmdOption('y', 'yes', 'Go')], { question: 'Go on?' }));
    const out = announced(() => renderSurface(dir, 'migration-gate', { dotpath: '' }));

    assert.ok(!out.includes('=== GATE'), out);
    assert.strictEqual(gateShown()?.gate, 'opened gate');
  });

  it('records nothing for a command Claude Code handed no session id', () => {
    render(['migration-gate'], { CLAUDE_CODE_SESSION_ID: undefined });
    assert.strictEqual(fs.existsSync(path.join(config(), 'conversations')), false);
  });

  it('a record that cannot be written costs the render nothing', () => {
    const plain = render(['migration-gate'], { CLAUDE_CODE_SESSION_ID: undefined });
    fs.writeFileSync(path.join(config(), 'conversations'), 'a file where the folders go');

    assert.strictEqual(render(['migration-gate']), plain);
  });

  it('every MENU states its gate as section() builds its marker, and a menu drawn as an illustration states none', () => {
    const body = () => menu('', [cmdOption('y', 'yes', 'Go')], { question: 'Go on?' });
    openGate();
    illustrate(() => section('MENU: drawn gate', MENU_INSTRUCTION, body()));
    assert.strictEqual(gateShown(), null);

    const out = section('MENU: answered gate', MENU_INSTRUCTION, body());
    assert.ok(out.startsWith(`=== MENU: answered gate (${MENU_INSTRUCTION}) ===\n`), out);
    assert.deepStrictEqual(gateShown(), {
      gate: 'answered gate',
      question: 'Go on?',
      options: [{ key: 'y', word: 'yes', head: 'Go', tail: null, detail: null, recommended: false, next: null }],
      typed: [],
      showing: null,
    });
  });

  it('no MENU marker is built anywhere but section()', () => {
    /** @param {string} folder @returns {string[]} */
    const sources = (folder) => fs.readdirSync(folder, { withFileTypes: true }).flatMap((e) => {
      const at = path.join(folder, e.name);
      if (e.isDirectory()) return sources(at);
      return e.name.endsWith('.cjs') ? [at] : [];
    });
    const building = sources(SKILLS).filter((file) => fs.readFileSync(file, 'utf8').includes('=== MENU'));
    assert.deepStrictEqual(building.map((file) => path.relative(SKILLS, file)), []);
  });

  it('a typed row is keyed by its label\'s words, lowercase, joined by hyphens, and marked where the person answers it in words rather than picking items', () => {
    showMenu('shaped gate', () => [
      cmdOption('y', 'yes', 'Go'),
      promptOption('Tell me what to change', 'what to revise'),
      rangeOption(1, 4, 'Start work on item(s)'),
    ]);

    assert.deepStrictEqual(shown().typed.map((/** @type {{key: string, prompt: boolean}} */ t) => [t.key, t.prompt]), [['tell-me-what-to-change', true], ['1-4', false]]);
  });

  it('a skill\'s gateway records the gate its MENU states, as the engine\'s dispatch does', () => {
    const script = path.join(SKILLS, 'leeway-roadmap/scripts/gateway.cjs');
    const res = spawnSync('node', [script, 'view'], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...conversation() } });
    assert.strictEqual(res.status, 0, res.stderr);

    const { gate, question, options: [first] } = shown();
    assert.deepStrictEqual([gate, question], ['roadmap menu', 'What would you like to do?']);
    assert.deepStrictEqual(events(), [], 'nothing is logged until the gate is answered');
    assert.strictEqual(answer(['roadmap menu', '--pick', first.key]).picked, first.key);
  });
});

describe('gate (6.6, 6.S18)', () => {
  it('a row picked over the one the engine recommended: the trust log gains the gate\'s name, the recommended row and the row picked, typed', () => {
    showCodeGate();

    assert.deepStrictEqual(answer(['code gate', '--pick', 'y']), {
      ok: true, gate: 'code gate', picked: 'y', recommended: 'b', via: 'typed', next: null,
    });
    const [event, ...more] = events();
    assert.deepStrictEqual(more, []);
    assert.deepStrictEqual(ownFields(event), { gate: 'code gate', recommended: 'b', picked: 'y', via: 'typed', with_text: false, reading: null });
    assert.deepStrictEqual([event.type, event.project, event.project_name, event.session], ['gate', projectId(), path.basename(dir), SESSION]);
  });

  it('with both mods running, the row the person pressed is logged pressed, though the rows mod spent the send\'s record as the row entered the transcript', () => {
    showCodeGate(ANNOUNCED);
    fs.writeFileSync(inFolder('sent.json'), JSON.stringify({ answer: 'yes', question: CODE_QUESTION, label: 'Enter anyway' }));
    pressed(1000);
    fs.writeFileSync(inFolder('sent.json'), 'null');

    assert.strictEqual(answer(['code gate', '--pick', 'y'], ANNOUNCED).via, 'pressed');
    assert.strictEqual(events()[0].via, 'pressed');
  });

  it('with the mod running, an answer typed at the prompt is logged typed: no press, or a press of another gate, of another row, or from before the gate was shown', () => {
    /** @type {[string, (() => void)][]} */
    const typed = [
      ['no press', () => {}],
      ['another gate', () => pressed(1000, { gate: 'github rule gate' })],
      ['another row', () => pressed(1000, { answer: 'back' })],
      ['before the gate was shown', () => pressed(-1000)],
    ];
    for (const [what, press] of typed) {
      showCodeGate(ANNOUNCED);
      press();
      assert.strictEqual(answer(['code gate', '--pick', 'y'], ANNOUNCED).via, 'typed', what);
    }
    assert.deepStrictEqual(events().map((e) => e.via), typed.map(() => 'typed'));
  });

  it('with the mod off, the answer is still logged — typed, even where a press names it', () => {
    showCodeGate();
    pressed(1000);

    assert.strictEqual(answer(['code gate', '--pick', 'y']).via, 'typed');
    assert.deepStrictEqual(ownFields(events()[0]), { gate: 'code gate', recommended: 'b', picked: 'y', via: 'typed', with_text: false, reading: null });
  });

  it('answers with what the picked row leads to, and performs none of it', () => {
    render(['github-rule-gate']);
    const before = fs.readFileSync(statePath(dir, layout.projectManifest), 'utf8');

    assert.deepStrictEqual(answer(['github rule gate', '--pick', 'n']), {
      ok: true, gate: 'github rule gate', picked: 'n', recommended: null, via: 'typed', next: { kind: 'engine', argv: ['github-rule', 'no'] },
    });
    assert.strictEqual(fs.readFileSync(statePath(dir, layout.projectManifest), 'utf8'), before, 'the rule\'s answer is not recorded');
  });

  it('a typed row, by its key: logged as that row, typed', () => {
    render(['migration-gate']);

    assert.deepStrictEqual(answer(['migration gate', '--typed', 'ask']), {
      ok: true, gate: 'migration gate', picked: 'ask', recommended: null, via: 'typed', next: null,
    });
    assert.deepStrictEqual(ownFields(events()[0]), { gate: 'migration gate', recommended: null, picked: 'ask', via: 'typed', with_text: false, reading: null });
  });

  it('18.S38, 18.S51, 16.S68: free text naming no row, which the separate call cannot read — no login serves it — sets the gate aside, logged as free text with no row read, leading nowhere', () => {
    showCodeGate(ANNOUNCED);

    assert.deepStrictEqual(answer(['code gate', '--typed'], ANNOUNCED, WORDS), {
      ok: true, gate: 'code gate', picked: null, recommended: 'b', via: 'typed', next: null,
    });
    assert.deepStrictEqual(ownFields(events()[0]), { gate: 'code gate', recommended: 'b', picked: null, via: 'typed', with_text: true, reading: null });
  });

  it('16.S40: free text is read by the separate call against the gate\'s question and its rows, each whole as shown, and the trust log holds the gate\'s name, the row recommended and the row read; the words land nowhere but the call, and the gate is set aside whatever they read, leading nowhere (16.13.3, 6.6.2)', () => {
    render(['github-rule-gate']);
    const log = path.join(config(), 'calls.jsonl');
    const { question, options: [set] } = shown();

    const res = answer(['github rule gate', '--typed'], { CLAUDE_STUB_LOG: log, CLAUDE_STUB_ANSWERS: JSON.stringify({ '': { row: 'n' } }) }, WORDS);

    assert.deepStrictEqual(res, { ok: true, gate: 'github rule gate', picked: null, recommended: null, via: 'typed', next: null });
    assert.deepStrictEqual(ownFields(events()[0]), { gate: 'github rule gate', recommended: null, picked: null, via: 'typed', with_text: true, reading: 'n' });
    const [call, ...more] = calls(log);
    assert.deepStrictEqual(more, []);
    const rows = `- y: yes — ${set.head}\n- n: no — Leave it unset — setup carries on without it`;
    assert.strictEqual(call.input, `The question: ${question}\n\nThe options:\n${rows}\n\nThe reply: ${WORDS}`);
    const holding = [...filesUnder(config()), ...filesUnder(statePath(dir))].filter((file) => file !== log && fs.readFileSync(file, 'utf8').includes(WORDS));
    assert.deepStrictEqual(holding, [], 'the person\'s words were kept');
  });

  it('free text is read against the gate\'s command rows alone, its typed rows never offered', () => {
    render(['migration-gate']);
    const log = path.join(config(), 'calls.jsonl');

    answer(['migration gate', '--typed'], { CLAUDE_STUB_LOG: log, CLAUDE_STUB_ANSWERS: JSON.stringify({ '': { row: 'y' } }) }, WORDS);

    const [{ argv }] = calls(log);
    assert.deepStrictEqual(JSON.parse(argv[argv.indexOf('--json-schema') + 1]).properties.row.enum, ['y', 'none of them']);
    assert.deepStrictEqual([shown().typed.map((/** @type {{key: string}} */ t) => t.key), events()[0].reading], [['ask'], 'y']);
  });

  it('a row picked or a typed row is never read: no call is made', () => {
    const log = path.join(config(), 'calls.jsonl');
    const armed = { CLAUDE_STUB_LOG: log, CLAUDE_STUB_ANSWERS: JSON.stringify({ '': { row: 'y' } }) };

    render(['migration-gate']);
    answer(['migration gate', '--pick', 'y'], armed);
    render(['migration-gate']);
    answer(['migration gate', '--typed', 'ask'], armed);

    assert.deepStrictEqual([events().map((e) => [e.picked, e.reading]), calls(log)], [[['y', null], ['ask', null]], []]);
  });

  it('the answer is marked on the gate shown, and a gate answered takes no second answer until it is shown again', () => {
    showCodeGate();
    answer(['code gate', '--pick', 'y']);
    const { answered } = shown();

    assert.deepStrictEqual({ ...answered, at: typeof answered.at }, { at: 'string', picked: 'y', via: 'typed' });
    assert.strictEqual(refused(['code gate', '--pick', 'b']), 'gate: "code gate" is answered — render it again to answer it again');
    assert.strictEqual(events().length, 1);
    showCodeGate();
    assert.strictEqual(answer(['code gate', '--pick', 'b']).picked, 'b');
    assert.strictEqual(events().length, 2);
  });

  it('a rerun after a kill between the log and the mark logs the same event again under the same id, read once (16.13.3); the gate shown again is a new event', () => {
    showCodeGate();
    answer(['code gate', '--pick', 'y']);
    fs.writeFileSync(inFolder('gate-shown.json'), JSON.stringify({ ...shown(), answered: null }));
    answer(['code gate', '--pick', 'y']);
    showCodeGate();
    answer(['code gate', '--pick', 'b']);

    const [first, again, next] = events().map((event) => event.id);
    /** @type {unknown[]} */
    const read = [];
    inConversation(() => readTrustLog((event) => read.push(event.picked)));
    assert.deepStrictEqual([again === first, next === first, read], [true, false, ['y', 'b']]);
  });

  it('a showing set aside — by free text or a prompt row — and shown again is one showing: it keeps the time it was first shown, its answers there are logged under one id, read once, the first reply counting; a pick ends it, and the gate shown after is a new showing, its answer a new event (16.13.3, 6.6.2)', () => {
    render(['migration-gate']);
    const { at } = shown();
    answer(['migration gate', '--typed'], {}, WORDS);
    render(['migration-gate']);
    const afterWords = shown().at;
    answer(['migration gate', '--typed', 'ask']);
    render(['migration-gate']);
    const afterAsk = shown().at;
    answer(['migration gate', '--pick', 'y']);
    render(['migration-gate']);
    const afterPick = shown().at;
    answer(['migration gate', '--pick', 'y']);

    const [first, ...rest] = events().map((event) => event.id);
    /** @type {unknown[]} */
    const read = [];
    inConversation(() => readTrustLog((event) => read.push([event.picked, event.with_text])));
    assert.deepStrictEqual([afterWords === at, afterAsk === at, afterPick === at], [true, true, false]);
    assert.deepStrictEqual(rest.map((id) => id === first), [true, true, false]);
    assert.deepStrictEqual(read, [[null, true], ['y', false]]);
  });

  it('a typed row that picks items is an answer: the gate shown after it is a new showing', () => {
    const rows = () => [cmdOption('y', 'yes', 'Go'), rangeOption(1, 4, 'Start work on item(s)')];
    showMenu('shaped gate', rows);
    const { at } = shown();
    answer(['shaped gate', '--typed', '1-4']);
    showMenu('shaped gate', rows);

    assert.notStrictEqual(shown().at, at);
  });

  it('a learned gate\'s answer logs the showing it was drawn on, so a replay draws its blind ask again; any other gate\'s logs none', () => {
    const showing = showingOf({ unit: 'pay', phase: 'investigation', topic: 'pay' }, ['H1']);
    inConversation(() => {
      openGate();
      section('MENU: plan gate', MENU_INSTRUCTION, menu('', [cmdOption('y', 'yes', 'Approve the plan')], { question: 'Approve this plan?' }), shows('plan gate', showing));
      recordGateShown();
    });
    answer(['plan gate', '--pick', 'y']);
    render(['migration-gate']);
    answer(['migration gate', '--pick', 'y']);

    assert.deepStrictEqual(events().map((event) => [event.gate, event.showing]), [['plan gate', showing], ['migration gate', null]]);
  });

  it('a gate before the project has state is answered like any other, its event naming no project (16.13.5)', () => {
    const plain = initRepo(path.join(config(), 'project'));
    output(plain, ['render', 'state-lost-gate'], { env: conversation() });
    ok(plain, ['gate', 'state lost gate', '--pick', 'n'], { env: conversation() });

    const [event] = events();
    assert.deepStrictEqual([event.gate, event.picked, event.project, event.project_name], ['state lost gate', 'n', null, null]);
  });

  it('the gate is named as its MENU declares it, up to its first " — ": the in-session gate of every entry is one gate, answered by the name its marker reads', () => {
    showMenu('in-session gate — 3', IN_SESSION_ROWS);

    assert.strictEqual(shown().gate, 'in-session gate');
    assert.strictEqual(answer(['in-session gate — 3', '--pick', 'y']).gate, 'in-session gate');
    assert.strictEqual(events()[0].gate, 'in-session gate');
  });

  it('a press on an entry of a gate is a press of the gate: the mod records the name its payload states, the entry with it', () => {
    const [payload] = showMenu('in-session gate — 3', IN_SESSION_ROWS, ANNOUNCED);
    pressed(1000, { gate: payload.gate });

    assert.strictEqual(payload.gate, 'in-session gate — 3');
    assert.strictEqual(answer(['in-session gate', '--pick', 'y'], ANNOUNCED).via, 'pressed');
  });

  it('a name the trust log cannot key refuses the answer, never made to fit', () => {
    showMenu('Shouted Gate', () => [cmdOption('y', 'yes', 'Go')]);

    assert.match(refused(['Shouted Gate', '--pick', 'y']), /^a gate event cannot be recorded: its gate is not a gate's name/);
    assert.deepStrictEqual([events(), shown().answered], [[], null]);
  });
});

describe('gate — refusals, logging nothing', () => {
  it('with no session id: there is no conversation to answer in', () => {
    showCodeGate();
    const record = shown();

    assert.match(refused(['code gate', '--pick', 'y'], { CLAUDE_CODE_SESSION_ID: undefined }), /^gate: no conversation to answer in/);
    assert.deepStrictEqual([events(), shown()], [[], record]);
  });

  it('with no gate shown', () => {
    assert.strictEqual(refused(['code gate', '--pick', 'y']), 'gate: no gate has been shown in this conversation — render the gate, then answer it');
    assert.deepStrictEqual(events(), []);
  });

  it('naming a gate other than the one shown', () => {
    render(['github-rule-gate']);
    const record = shown();

    assert.strictEqual(refused(['code gate', '--pick', 'y']), 'gate: the gate shown is "github rule gate", not "code gate"');
    assert.deepStrictEqual([events(), shown()], [[], record]);
  });

  it('a key the gate lacks: a row it has not, a typed row picked, a row typed', () => {
    render(['migration-gate']);
    const record = shown();

    assert.strictEqual(refused(['migration gate', '--pick', 'n']), 'gate: "migration gate" has no row n to pick — its rows: y');
    assert.strictEqual(refused(['migration gate', '--pick', 'ask']), 'gate: "migration gate" has no row ask to pick — its rows: y — ask is typed: --typed ask');
    assert.strictEqual(refused(['migration gate', '--typed', 'y']), 'gate: "migration gate" has no typed row y — its typed rows: ask');
    assert.deepStrictEqual([events(), shown()], [[], record]);
  });

  it('free text with no words on stdin, before any call is made', () => {
    showCodeGate();
    const record = shown();
    const log = path.join(config(), 'calls.jsonl');

    for (const words of ['', ' \n']) {
      assert.strictEqual(refused(['code gate', '--typed'], { CLAUDE_STUB_LOG: log }, words), 'gate: free text at "code gate" comes with the person\'s words on stdin, read for the row they pick and dropped');
    }
    assert.deepStrictEqual([events(), shown(), calls(log)], [[], record, []]);
  });

  it('a raise, by its menu or its name: a raise is no gate, and is answered by raise answer', () => {
    render(['migration-gate']);
    const record = shown();

    for (const name of ['raise — 3IvpS2ynHKerzBxUBYWrs', 'raise']) {
      assert.strictEqual(refused([name, '--pick', '1']), 'gate: a raise is no gate — answer it with raise answer <id>', name);
    }
    assert.deepStrictEqual([events(), shown()], [[], record]);
  });

  it('a call naming no gate, or neither answer, or both, is a usage error — and the name is whole, quoted or as bare words', () => {
    render(['github-rule-gate']);
    const usage = 'Usage: engine gate <name> (--pick <key> | --typed [<key>])   (free text\'s words on stdin)';
    for (const args of [['--pick', 'y'], ['github rule gate'], ['github rule gate', '--pick', 'y', '--typed'], ['github rule gate', '--pick']]) {
      assert.strictEqual(refused(args), usage, args.join(' '));
    }
    assert.deepStrictEqual(events(), []);
    assert.strictEqual(answer(['github', 'rule', 'gate', '--pick', 'y']).gate, 'github rule gate');
  });
});

// What the gate mod leaves of a press is what `gate` reads: the file, the
// keys of its record, the gate as the GATE payload names it, the row by the
// answer the mod sends for it, and the record a send that failed leaves.
// Each literal is read off the mod's source — a mod cannot import the engine
// — and held against a real answer.
describe('the mod\'s record of a press, as `gate` reads it', () => {
  const REGISTER = path.join(SKILLS, 'leeway-gates/hooks/register.ts');
  const LAYOUT = path.join(SKILLS, 'leeway-gates/hooks/layout.ts');
  /** @param {string} file */
  const source = (file) => fs.readFileSync(file, 'utf8');

  /** A string constant's value, as the mod's source spells it. @param {string} file @param {string} name */
  function literal(file, name) {
    const found = new RegExp(`const ${name} = '([^']*)'`).exec(source(file));
    assert.ok(found, `${path.basename(file)} names ${name}`);
    return found[1];
  }

  /** Write the mod's record of a press, under the file name it writes. @param {string} text */
  const press = (text) => fs.writeFileSync(inFolder(literal(REGISTER, 'PRESSED')), text);

  it('the mod records a press with the keys the engine reads: the gate\'s name as its payload states it, the row\'s answer, and when it was sent', () => {
    const type = /type Pressed = \{([^}]*)\}/.exec(source(REGISTER));
    assert.ok(type, 'the mod declares the press it records');
    assert.deepStrictEqual([...type[1].matchAll(/(\w+): string/g)].map((m) => m[1]).sort(), ['answer', 'at', 'gate']);
    assert.match(source(REGISTER), /const \{ gate: name, \.\.\.stated \} = JSON\.parse\(payload\)/, 'the mod names the gate as its payload does');
    assert.match(source(REGISTER), /const answer = answerOf\(option\)[\s\S]*?\[PRESSED\]: \{\s*gate: gate\.name,\s*answer,\s*at: new Date\(await \$\.clock\.now\(\)\)\.toISOString\(\),?\s*\}/,
      'the mod records the row it sends by the answer it sends, and the time by its clock');
  });

  it('a press the mod records is the press `gate` reads, for a row with a word and a row without one', () => {
    assert.match(source(LAYOUT), /export const answerOf = \(option: Option\) => option\.word \?\? option\.key\n/, 'the mod sends a row\'s word, else its key');
    /** @param {{word: string|null, key: string}} option */
    const answerOf = (option) => option.word ?? option.key;

    for (const key of ['b', '1']) {
      const [payload] = showMenu('pressed gate', () => [cmdOption('b', 'back', 'Return to menu'), cmdOption('1', null, 'Continue "Auth"')], ANNOUNCED);
      const option = payload.options.find((/** @type {{key: string}} */ o) => o.key === key);
      press(JSON.stringify({ gate: payload.gate, answer: answerOf(option), at: new Date(Date.parse(shown().at) + 1000).toISOString() }));

      assert.strictEqual(answer(['pressed gate', '--pick', key], ANNOUNCED).via, 'pressed', key);
    }
  });

  it('a send that failed leaves over its press the record `gate` reads as no press', () => {
    showCodeGate(ANNOUNCED);
    pressed(1000);
    press(literal(REGISTER, 'NOTHING_SENT'));

    assert.strictEqual(answer(['code gate', '--pick', 'y'], ANNOUNCED).via, 'typed');
  });
});
