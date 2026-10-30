'use strict';

// ---------------------------------------------------------------------------
// A raise drawn (leeway-engine/scripts/domain/raise.cjs, its screen
// domain/projections/raise.cjs, the decision point domain/decision-point.cjs):
// `engine raise <place> --answers <question>`, Claude's call on stdin, put
// through the decision point, every row judged by the one-decision check at
// once, sealed in the conversation's folder and drawn as one MENU (16.S30);
// `raise show`, drawing it again from the seal alone, the mechanism behind
// its toggle; every refusal drawing and sealing nothing; a second raise of
// the question keeping the first seal (P6); and a raise that is no gate,
// clearing the gate shown.
//
// Layer: verb. World: the ledger suites' unit with four questions asked —
// three on one topic, one on another — and a feature with one, built once
// and only read but for one decision and a question moved to the roadmap: a
// raise writes the conversation's folder alone. Each test keeps its conversation
// in a config folder of its own. The separate call is the stub binary
// (claude-stub.cjs): unarmed it has no login, so every row is drawn
// unchecked; armed per test where the check is the subject.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ok, okSectionsAsync, refuses, refusesAsync, output, initRepo, cleanupFixture } = require('./engine-harness.cjs');
const { useTempFolder, createManifest } = require('./discovery-test-utils.cjs');
const { SESSION: WRITER, MADE, NOTE, SPACE, ledgerWorld, ledgerHelpers } = require('./ledger-world.cjs');
const { SESSION, raiseHelpers } = require('./raise-world.cjs');
const { auditGate, auditMarkers } = require('./gate-audit.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { isId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const decisionPoint = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));
const { gateShown } = require(path.join(SCRIPTS, 'domain/projections/surfaces.cjs'));

const EVERY_CALL_ASKS = 'Every call comes to you for now: the counts that would let me decide aren\'t built yet.';
const NO_GATE = 'gate: no gate has been shown in this conversation — render the gate, then answer it';
// The way on from a raise the conversation never drew.
const ELSEWHERE = 'a raise is answered in the conversation that drew it, so after a /clear, or a resume under a new session, raise the question again';

const CURSOR = Object.freeze({ key: '1', name: 'Cursor', text: 'On the screen the cursor is on', notice: 'the note opens where you are looking' });
const MAIN = Object.freeze({ key: '2', name: 'Main', text: 'On the main screen', notice: 'every note opens on the same screen' });
const LAST = Object.freeze({ key: '3', name: 'Last', text: 'Where the last note was', notice: 'notes gather on one screen until you move one' });

/** Claude's call: where a new note opens. */
const CALL = Object.freeze({
  question: 'When you make a new note, where should its window open?',
  rows: [CURSOR, MAIN],
  lean: '1',
  why: 'A note follows the person.',
  sort: 'several',
  mechanism: 'The screen under the pointer when the note is made.',
  product_wide: false,
});

/**
 * The screen a raise of `CALL` draws, its id `id`, the mechanism shown with
 * `technical`, the reason the decision point gave.
 * @param {string} id @param {{technical?: boolean, reason?: string}} [opts]
 */
function screen(id, { technical = false, reason = EVERY_CALL_ASKS } = {}) {
  return [
    `=== MENU: raise — ${id} (emit verbatim as markdown (not a code block), then STOP for the user's response) ===`,
    '· · · · · · · · · · · ·',
    'Fumi · Note Window',
    '',
    'When you make a new note, where should its window open?',
    '',
    'I lean: On the screen the cursor is on',
    '',
    'WHAT YOU\'D NOTICE',
    '',
    '- Cursor: the note opens where you are looking',
    '- Main: every note opens on the same screen',
    '',
    'WHY I\'M ASKING',
    '',
    reason,
    ...(technical ? ['', 'THE MECHANISM', '', 'The screen under the pointer when the note is made.'] : []),
    '',
    '**`◆ Which way?`**',
    '',
    '**`1`**           → On the screen the cursor is on (recommended)',
    '**`2`**           → On the main screen',
    `**\`t/technical\`** → ${technical ? 'Hide' : 'Show'} the mechanism`,
    '**`e/explain`**   → I don\'t follow — explain it again',
    '**Comment**     → Ask about it, or tell me what I\'ve missed',
    '',
  ].join('\n');
}

const config = useTempFolder('raise-config-');

/** @type {string} */
let dir;
// A feature, its one topic the feature itself.
const FEATURE = 'quick-capture';
const FEATURE_AT = `${FEATURE}.discussion.${FEATURE}`;

/**
 * The questions asked, by short id: three on the note window, one on space
 * homing, one in the feature.
 */
const asked = { where: '', size: '', title: '', homing: '', capture: '' };

before(() => {
  dir = ledgerWorld('raise-');
  createManifest(dir, FEATURE, { phases: { discussion: { items: { [FEATURE]: { status: 'in-progress' } } } } });
  const { write } = ledgerHelpers(() => dir);
  /** @param {string} at @param {string} text */
  const ask = (at, text) => write('ask', at, [], { ...MADE, text }, WRITER).id;
  asked.where = ask(NOTE, 'Where does a new note open?');
  asked.size = ask(NOTE, 'How big is a new note?');
  asked.title = ask(NOTE, 'What does a new note\'s title default to?');
  asked.homing = ask(SPACE, 'Which Space does a note live on?');
  asked.capture = ask(FEATURE_AT, 'Which key starts a capture?');
});

after(() => cleanupFixture(dir));

const { conversation, inFolder, seals } = raiseHelpers(() => dir, config, CALL);

/** The gate the conversation was last shown, as the gate mod reads it; null where none was. @returns {any} */
const gateShownFile = () => (fs.existsSync(inFolder('gate-shown.json')) ? JSON.parse(fs.readFileSync(inFolder('gate-shown.json'), 'utf8')) : null);

/**
 * A raise drawn: its response and its screen.
 * @param {Record<string, unknown>} [call] @param {{at?: string, answers?: string, flags?: string[], env?: Record<string, string|undefined>}} [opts]
 */
function draw(call = CALL, { at = NOTE, answers = asked.where, flags = [], env } = {}) {
  return okSectionsAsync(dir, ['raise', at, '--answers', answers, ...flags], { env: conversation(env), stdin: JSON.stringify(call) });
}

/**
 * A draw refused: its error, nothing sealed.
 * @param {string[]} args @param {string} stdin @param {Record<string, string|undefined>} [env]
 */
async function refusedDraw(args, stdin, env) {
  const { error } = await refusesAsync(dir, ['raise', ...args], { env: conversation(env), stdin });
  assert.strictEqual(seals(), null, 'a refused raise sealed something');
  return error;
}

/** A refused draw of `call`, at the note window, answering where a new note opens. @param {unknown} call */
const refusedCall = (call) => refusedDraw([NOTE, '--answers', asked.where], JSON.stringify(call));

/** `raise show`'s answer and screen. @param {string[]} args @param {{stdin?: string, env?: Record<string, string|undefined>}} [opts] */
function show(args, { stdin = '', env } = {}) {
  const out = output(dir, ['raise', 'show', ...args], { env: conversation(env), stdin });
  const nl = out.indexOf('\n');
  return { res: JSON.parse(out.slice(0, nl)), sections: out.slice(nl + 1) };
}

/** Output with the GATE block taken out. @param {string} out */
const withoutGate = (out) => out.replace(/^=== GATE \(.*\) ===\n.*\n/m, '');

describe('the draw (16.S30, 16.9.2)', () => {
  it('draws what is decided, the lean, what the person would notice with each row and why it asks, then the rows, the lean recommended, the toggle, "I don\'t follow" and a comment — one MENU declared by the raise\'s id, the decision and its reason answered', async () => {
    const { res, sections } = await draw();

    assert.ok(isId(res.raise), `the raise's id is no ledger id: ${res.raise}`);
    assert.deepStrictEqual(res, { ok: true, decision: 'ask', reason: EVERY_CALL_ASKS, raise: res.raise, redrawn: false });
    assert.strictEqual(sections, screen(res.raise));
  });

  it('Claude\'s words read as written, never as markup, on the screen and in its payload alike', async () => {
    const probe = 'Should `sync --force` retry 2*3 times, or *never*?';
    const call = { ...CALL, question: probe, rows: [CURSOR, { ...MAIN, text: 'Retry *never*', notice: 'a `--force` sync fails at once' }] };

    const { sections } = await draw(call, { env: { LEEWAY_GATE_SURFACE: '1' } });

    const menu = sections.split('\n');
    assert.ok(menu.includes('Should \\`sync --force\\` retry 2\\*3 times, or \\*never\\*?'), sections);
    assert.ok(menu.includes('- Main: a \\`--force\\` sync fails at once'), sections);
    assert.ok(menu.includes('**`2`**           → Retry \\*never\\*'), sections);
    const gate = /** @type {Record<string, any>} */ (auditGate(sections, 'raise'));
    assert.ok(gate.statement.split('\n').includes(probe), gate.statement);
    assert.ok(gate.statement.split('\n').includes('- Main: a `--force` sync fails at once'), gate.statement);
    assert.strictEqual(gate.options[1].head, 'Retry *never*');
  });

  it('a feature\'s raise is headed by the feature alone, its topic the feature itself', async () => {
    const { sections } = await draw(CALL, { at: FEATURE_AT, answers: asked.capture });

    assert.strictEqual(sections.split('\n')[2], 'Quick Capture');
  });

  it('the mechanism keeps its lines as written, each from its first word, escaped as the rest', async () => {
    const mechanism = 'The screen under the pointer:\n  NSEvent.mouseLocation, read *once*\n\nthen the screen holding it.';
    const { res } = await draw({ ...CALL, mechanism });

    const { sections } = show([res.raise, '--technical'], { env: { LEEWAY_GATE_SURFACE: '1' } });
    const at = sections.indexOf('THE MECHANISM\n\n') + 'THE MECHANISM\n\n'.length;
    assert.strictEqual(sections.slice(at, sections.indexOf('\n\n**`◆', at)), 'The screen under the pointer:\nNSEvent.mouseLocation, read \\*once\\*\n\nthen the screen holding it.');
    auditGate(sections, 'raise show --technical');
  });

  it('the mechanism stays behind the toggle at the draw; raise show --technical draws it, its toggle then hiding it, and raise show alone the screen as drawn', async () => {
    const { res } = await draw();

    assert.deepStrictEqual(show([res.raise, '--technical']), { res: { ok: true, raise: res.raise }, sections: screen(res.raise, { technical: true }) });
    assert.strictEqual(show([res.raise]).sections, screen(res.raise));
  });

  it('the toggle leads to raise show, "I don\'t follow" to the answer that says so, each row to its pick — the raise named by its id', async () => {
    const { res } = await draw();
    const leads = () => Object.fromEntries(/** @type {any} */ (gateShown()).options.map((/** @type {any} */ o) => [o.word ?? o.key, o.next.argv]));

    assert.deepStrictEqual(leads(), {
      1: ['raise', 'answer', res.raise, '--pick', '1'],
      2: ['raise', 'answer', res.raise, '--pick', '2'],
      technical: ['raise', 'show', res.raise, '--technical'],
      explain: ['raise', 'answer', res.raise, '--didnt-follow'],
    });
    show([res.raise, '--technical']);
    assert.deepStrictEqual(leads().technical, ['raise', 'show', res.raise]);
  });

  it('the gate audit holds the screen to its payload with the mod announced, the notice and the why in its statement; unannounced, the screen is the same less the payload', async () => {
    const plain = await draw();
    const announced = await draw(CALL, { env: { LEEWAY_GATE_SURFACE: '1' } });
    const technical = show([plain.res.raise, '--technical'], { env: { LEEWAY_GATE_SURFACE: '1' } });

    auditMarkers(plain.sections, 'raise');
    const gate = auditGate(announced.sections, 'raise');
    auditGate(technical.sections, 'raise show --technical');
    assert.strictEqual(gate?.gate, `raise — ${plain.res.raise}`);
    assert.ok(gate?.statement.includes('- Main: every note opens on the same screen') && gate.statement.includes(EVERY_CALL_ASKS), 'the payload states no notice or no why');
    assert.strictEqual(withoutGate(announced.sections), plain.sections);
  });
});

describe('the seal (P1, P6)', () => {
  it('is kept in the conversation\'s folder by the raise\'s id: the call as given, where it was raised, the question and what it relies on by full id, the menu, the rows the check judged — none, with no login — the reason, when it was shown, no answer, no "I don\'t follow"', async () => {
    const { full } = ledgerHelpers(() => dir);
    const { res } = await draw(CALL, { flags: ['--relies-on', asked.size] });

    const sealed = seals()[res.raise];
    assert.deepStrictEqual(Object.keys(seals()), [res.raise]);
    assert.ok(!Number.isNaN(Date.parse(sealed.at)), `when it was shown is no time: ${sealed.at}`);
    assert.deepStrictEqual(sealed, {
      v: 1,
      id: res.raise,
      menu: `raise — ${res.raise}`,
      place: { unit: 'fumi', phase: 'discussion', topic: 'note-window' },
      answers: full(asked.where),
      relies_on: [full(asked.size)],
      replaces: null,
      call: CALL,
      rows_judged: [],
      reason: EVERY_CALL_ASKS,
      at: sealed.at,
      answered: null,
      didnt_follow: 0,
    });
  });

  it('9.S12: decides nothing until the person answers — the ledger as it was, the question open on its map with no answer, the lean sealed in the conversation alone (9.3.9)', async () => {
    const { ledgerText } = ledgerHelpers(() => dir);
    const before = ledgerText();

    const { res } = await draw();

    assert.strictEqual(ledgerText(), before);
    const row = ok(dir, ['ledger', 'map', 'fumi', 'note-window']).questions.find((/** @type {{id: string}} */ q) => q.id === asked.where);
    assert.deepStrictEqual([row.stands, row.answers, Object.keys(seals())], ['open', [], [res.raise]]);
  });

  it('a second raise of the question in the conversation — the same place, the same question — keeps the first seal and draws it, its lean unchanged; another question at the place is sealed beside it', async () => {
    const first = await draw();
    const sealed = seals();

    const again = await draw({ ...CALL, rows: [MAIN, CURSOR], lean: '2', mechanism: 'The main screen, always.' });
    assert.deepStrictEqual([again.res, again.sections], [{ ...first.res, redrawn: true }, first.sections]);
    assert.deepStrictEqual(seals(), sealed);

    const other = await draw(CALL, { answers: asked.size });
    assert.notStrictEqual(other.res.raise, first.res.raise);
    assert.deepStrictEqual(Object.keys(seals()).sort(), [first.res.raise, other.res.raise].sort());
  });

  it('raise show draws from the seal alone, whatever Claude hands it, and takes a prefix of the id', async () => {
    const { res } = await draw();

    const shown = show([res.raise.slice(0, 6)], { stdin: JSON.stringify({ ...CALL, lean: '2', question: 'Where else?' }) });
    assert.strictEqual(shown.sections, screen(res.raise));
  });

  it('a seal of another version is never matched, nor drawn by raise show, and stays as written', async () => {
    const first = await draw();
    const newer = { ...seals()[first.res.raise], v: 2 };
    fs.writeFileSync(inFolder('raise-shown.json'), JSON.stringify({ [first.res.raise]: newer }));

    const again = await draw();
    assert.notStrictEqual(again.res.raise, first.res.raise);
    assert.deepStrictEqual(seals()[first.res.raise], newer);
    assert.strictEqual(refuses(dir, ['raise', 'show', first.res.raise], { env: conversation() }).error, `raise show: ${first.res.raise} was sealed by a release this engine does not read`);
  });

  it('a seals file that cannot be read refuses the raise, and is left as it is', async () => {
    fs.mkdirSync(path.dirname(inFolder('raise-shown.json')), { recursive: true });
    for (const [text, error] of [
      ['{"torn', /^raise: the conversation's raises, .*raise-shown\.json, cannot be read — /],
      ['[]', /^raise: the conversation's raises, .*raise-shown\.json, hold no raise by its id$/],
    ]) {
      fs.writeFileSync(inFolder('raise-shown.json'), text);
      const { error: refused } = await refusesAsync(dir, ['raise', NOTE, '--answers', asked.where], { env: conversation(), stdin: JSON.stringify(CALL) });
      assert.match(refused, /** @type {RegExp} */ (error));
      assert.strictEqual(fs.readFileSync(inFolder('raise-shown.json'), 'utf8'), text);
    }
  });

  it('raise show refuses a raise this conversation never drew, no session, and anything but an id and --technical', async () => {
    const { res } = await draw();
    /** @param {string[]} args @param {Record<string, string|undefined>} [env] */
    const refused = (args, env) => refuses(dir, ['raise', 'show', ...args], { env: conversation(env) }).error;

    assert.strictEqual(refused(['0000000000']), `raise show: this conversation has drawn no raise 0000000000 — ${ELSEWHERE}`);
    const twin = `${res.raise.slice(0, 20)}${res.raise.endsWith('Z') ? 'Y' : 'Z'}`;
    fs.writeFileSync(inFolder('raise-shown.json'), JSON.stringify({ ...seals(), [twin]: { ...seals()[res.raise], id: twin } }));
    assert.strictEqual(refused([res.raise.slice(0, 8)]), `raise show: "${res.raise.slice(0, 8)}" begins the ids of 2 raises this conversation drew — give more of the id`);
    assert.match(refused([res.raise], { CLAUDE_CODE_SESSION_ID: undefined }), /^raise show: no conversation to raise it in/);
    for (const args of [[], ['--technical'], [res.raise, '--mechanism'], [res.raise, '--technical', '--technical']]) {
      assert.strictEqual(refused(args), 'Usage: engine raise show <id> [--technical]', args.join(' '));
    }
  });
});

describe('the one-decision check at the draw (5.5.2, E10)', () => {
  it('judges every row at once — its answer, the other rows what it rules out, no why yet — the seal naming each row judged one rule', async () => {
    const meet = path.join(config(), 'meet');
    const log = path.join(config(), 'calls.jsonl');
    fs.mkdirSync(meet);
    const call = { ...CALL, rows: [CURSOR, MAIN, LAST] };

    const { res } = await draw(call, { env: { CLAUDE_STUB_ANSWERS: JSON.stringify({ '': { rules: ['One rule.'] } }), CLAUDE_STUB_LOG: log, CLAUDE_STUB_MEET: `3:${meet}` } });

    assert.deepStrictEqual(seals()[res.raise].rows_judged, ['1', '2', '3'], 'a row went unjudged: its call did not meet the others at the barrier');
    const entry = (/** @type {{text: string}} */ row) => [
      `The answer: ${row.text}`,
      'Why: not given',
      `What it rules out:\n${call.rows.filter((other) => other !== row).map((other) => `- ${other.text}`).join('\n')}`,
    ].join('\n\n');
    const inputs = fs.readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line).input);
    assert.deepStrictEqual(inputs.sort(), call.rows.map(entry).sort());
  });

  it('refuses a raise whose row holds several rules, drawing and sealing nothing, naming the row and its rules', async () => {
    const error = await refusedDraw([NOTE, '--answers', asked.where], JSON.stringify(CALL), {
      CLAUDE_STUB_ANSWERS: JSON.stringify({ 'The answer: On the main screen': { rules: ['Open on the main screen.', 'Size it to half the screen.'] }, '': { rules: ['One rule.'] } }),
    });

    assert.strictEqual(error, 'raise: row 2 holds several rules, and the entry a row lands as holds one — nothing drawn. Make each row one answer to the question, and raise what else it decides as a question of its own:\n'
      + '  row 2:\n    1. Open on the main screen.\n    2. Size it to half the screen.');
  });
});

describe('the decision point (29.5.2)', () => {
  it('answers ask with its reason for every call, and the response, the seal and the screen carry whatever it answers', async (t) => {
    const reason = 'On behaviour in Fumi my calls still miss more often than you allow: 21%, over your 20%.';
    t.mock.method(decisionPoint, 'decide', () => ({ decision: 'ask', reason }));

    const { res, sections } = await draw();

    assert.deepStrictEqual(res, { ok: true, decision: 'ask', reason, raise: res.raise, redrawn: false });
    assert.strictEqual(seals()[res.raise].reason, reason);
    assert.strictEqual(sections, screen(res.raise, { reason }));
  });

  it('a blind ask refuses, naming where it is built, and seals nothing', async (t) => {
    t.mock.method(decisionPoint, 'decide', () => ({ decision: 'blind', reason: 'A blind draw.' }));

    assert.strictEqual(await refusedCall(CALL), 'raise: the decision point answered blind, and asking blind is 29.19\'s, not built yet — nothing drawn');
  });
});

describe('a raise is no gate (6.6.10, E6)', () => {
  it('drawing a raise, raising the question again while its seal is open, and raise show each clear the gate shown before it, which then takes no answer', async () => {
    const answer = () => refuses(dir, ['gate', 'migration gate', '--pick', 'y'], { env: conversation() }).error;
    const gateOnScreen = () => {
      output(dir, ['render', 'migration-gate'], { env: conversation() });
      assert.strictEqual(gateShownFile()?.gate, 'migration gate');
    };

    gateOnScreen();
    const { res } = await draw();
    assert.strictEqual(answer(), NO_GATE);

    gateOnScreen();
    assert.strictEqual((await draw()).res.redrawn, true);
    assert.strictEqual(answer(), NO_GATE);

    gateOnScreen();
    show([res.raise]);
    assert.strictEqual(answer(), NO_GATE);
  });
});

describe('the draw\'s refusals, drawing and sealing nothing', () => {
  it('with no session id: there is no conversation to raise it in', async () => {
    const error = await refusedDraw([NOTE, '--answers', asked.where], JSON.stringify(CALL), { CLAUDE_CODE_SESSION_ID: undefined });

    assert.strictEqual(error, 'raise: no conversation to raise it in — Claude Code hands every command it runs a session id, and this one has none');
  });

  it('in a project with no state', async () => {
    const plain = initRepo(fs.mkdtempSync(path.join(os.tmpdir(), 'raise-stateless-')));
    try {
      const { error } = await refusesAsync(plain, ['raise', NOTE, '--answers', asked.where], { env: conversation(), stdin: JSON.stringify(CALL) });
      assert.strictEqual(error, 'raise: there is no workflows state here — the question a raise answers is in the ledger, which the state holds');
      assert.strictEqual(seals(), null);
    } finally {
      fs.rmSync(plain, { recursive: true, force: true });
    }
  });

  it('argv ledger decide would not take, in the raise\'s own words', async () => {
    assert.strictEqual(await refusedDraw([NOTE], JSON.stringify(CALL)),
      'raise needs --answers <id> — Usage: engine raise <work-unit>.<phase>[.<topic>] --answers <id> [--relies-on <id> …]   (the call as JSON on stdin)');
  });

  it('a place ledger decide would refuse', async () => {
    assert.strictEqual(await refusedDraw(['nope.discussion.note-window', '--answers', asked.where], JSON.stringify(CALL)), 'raise: there is no work unit "nope"');
  });

  it('a question ledger decide would refuse to answer from the place: another topic\'s', async () => {
    assert.match(await refusedDraw([NOTE, '--answers', asked.homing], JSON.stringify(CALL)),
      /^raise --answers names \w+, a question on space-homing — before the spec a topic writes on its own entries alone/);
  });

  it('a question no longer open — raised, then answered, then raised again with its seal open, or in another conversation', async () => {
    const { write } = ledgerHelpers(() => dir);
    await draw(CALL, { answers: asked.title });
    const decided = write('decide', NOTE, ['--answers', asked.title], { ...MADE, text: 'Its first line', why: 'It names the note.' }, WRITER).id;
    const sealed = seals();

    const again = await refusesAsync(dir, ['raise', NOTE, '--answers', asked.title], { env: conversation(), stdin: JSON.stringify(CALL) });
    assert.match(again.error, new RegExp(`^raise --answers names \\w+, which is answered by ${decided} — a raise asks an open question$`));
    assert.deepStrictEqual(seals(), sealed);
    const elsewhere = await refusesAsync(dir, ['raise', NOTE, '--answers', asked.title], { env: conversation({ CLAUDE_CODE_SESSION_ID: 'c0ffee00-0000-4abc-8def-0123456789ab' }), stdin: JSON.stringify(CALL) });
    assert.strictEqual(elsewhere.error, again.error);
  });

  it('a question moved to the roadmap as later', async () => {
    const { write } = ledgerHelpers(() => dir);
    const syncing = write('ask', NOTE, [], { ...MADE, text: 'Do notes sync across Macs?' }, WRITER).id;
    ok(dir, ['roadmap', 'add', 'sync', '--horizon', 'v2', '--summary', 'Notes sync across Macs']);
    write('move', NOTE, ['--question', syncing, '--to', 'roadmap:sync'], MADE, WRITER);

    assert.strictEqual(await refusedDraw([NOTE, '--answers', syncing], JSON.stringify(CALL)), `raise --answers names ${syncing}, which is moved to the roadmap as later, roadmap:sync — a raise asks an open question`);
  });

  it('stdin holding no JSON object', async () => {
    assert.match(await refusedDraw([NOTE, '--answers', asked.where], 'not json'), /^raise: the call comes on stdin as a JSON object, and stdin holds no JSON — /);
    assert.strictEqual(await refusedCall([CALL]), `raise: the call comes on stdin as a JSON object, not ${JSON.stringify([CALL])}`);
  });

  it('a field the call does not hold, one it lacks, and one of another type — a line break among them', async () => {
    const { mechanism, ...lacking } = CALL;
    for (const [call, error] of /** @type {[unknown, string][]} */ ([
      [{ ...CALL, kind: 'look' }, 'raise: the call has no field kind — it holds question, rows, lean, why, sort, mechanism, product_wide'],
      [lacking, 'raise: the call needs mechanism'],
      [{ ...CALL, sort: 'maybe' }, 'raise: the call\'s sort is not one of one, several'],
      [{ ...CALL, product_wide: 'no' }, 'raise: the call\'s product_wide is not true or false'],
      [{ ...CALL, question: 'Where?\nAnd when?' }, 'raise: the call\'s question is not one line of text'],
      [{ ...CALL, rows: [CURSOR, { ...MAIN, notice: 'One screen,\nalways' }] }, 'raise: the call\'s rows[1]\'s notice is not one line of text'],
      [{ ...CALL, mechanism: '' }, 'raise: the call\'s mechanism is not non-empty text'],
      [{ ...CALL, rows: [CURSOR, { ...MAIN, why: 'Because.' }] }, 'raise: the call\'s rows[1] has no field why — it holds key, name, text, notice'],
      [{ ...CALL, rows: [CURSOR, { key: '2', name: 'Main', text: 'On the main screen' }] }, 'raise: the call\'s rows[1] needs notice'],
      [{ ...CALL, rows: [CURSOR, 'On the main screen'] }, 'raise: the call\'s rows[1] is not a row — {key, name, text, notice}'],
    ])) {
      assert.strictEqual(await refusedCall(call), error, JSON.stringify(call));
    }
  });

  it('fewer than two rows', async () => {
    assert.strictEqual(await refusedCall({ ...CALL, rows: [CURSOR] }), 'raise: the call has 1 row — a raise offers the person a choice of two at least');
  });

  it('a key two rows share', async () => {
    assert.strictEqual(await refusedCall({ ...CALL, rows: [CURSOR, { ...MAIN, key: '1' }] }), 'raise: the call\'s rows share the key 1 — each row\'s key is its own');
  });

  it('a key the trust log cannot key', async () => {
    assert.strictEqual(await refusedCall({ ...CALL, rows: [CURSOR, { ...MAIN, key: 'main screen' }] }), 'raise: the call\'s rows[1]\'s key is not a key: letters, digits, - and _, up to 24 of them');
  });

  it('a row\'s key that is the screen\'s own word, in any case — keep among them, so a raise event\'s keep always means a keep', async () => {
    for (const key of ['t', 'E', 'technical', 'Explain', 'COMMENT', 'keep', 'Keep']) {
      assert.strictEqual(await refusedCall({ ...CALL, rows: [CURSOR, { ...MAIN, key }] }), `raise: the call's rows[1] takes the key ${key}, which the screen keeps for itself — t, e, technical, explain, comment, keep are its own, in any case`);
    }
  });

  it('a lean naming no row', async () => {
    assert.strictEqual(await refusedCall({ ...CALL, lean: '3' }), 'raise: the call leans to 3, and no row has that key — its rows: 1, 2');
  });

  it('a seal that cannot be written', async () => {
    fs.mkdirSync(path.join(config(), 'conversations'));
    fs.writeFileSync(path.join(config(), 'conversations', SESSION), 'a file where the folder goes');

    const { error } = await refusesAsync(dir, ['raise', NOTE, '--answers', asked.where], { env: conversation(), stdin: JSON.stringify(CALL) });

    assert.match(error, /^raise: the raise could not be sealed in the conversation's folder — nothing drawn: /);
  });
});
