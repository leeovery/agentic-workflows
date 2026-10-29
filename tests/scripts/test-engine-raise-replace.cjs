'use strict';

// ---------------------------------------------------------------------------
// A raise on a replacement (workflow-engine/scripts/domain/raise.cjs, landed
// through domain/ledger-write.cjs; the keep's line domain/ledger-events.cjs,
// read by domain/ledger-fold.cjs, ledger-read.cjs, ledger-affected.cjs,
// ledger-verdicts.cjs, ledger-copies.cjs, ledger-late-check.cjs and the
// state merge's line rule, domain/state-merge-rules.cjs): `engine raise
// <place> --replaces <entry> --reason <reason> [--cause <id>]`, Claude's
// proposed answers drawn with a row of the screen's own keeping the
// decision as it stands, `ledger replace`'s checks run before anything is
// drawn or sealed, each decision's raise sealed on its own (16.5.7,
// 29.5.2); each answer — a proposal picked, the person's own words, `keep`,
// "I don't follow" — with its ledger line, its raise event, who moved whom
// (5.3.10) and the verdict queue, read through this machine's trust log
// (domain/trust-evidence.cjs), and refused, recording nothing, on a raise
// with no such row or a decision replaced since the draw; a keep changing
// nothing current, so nothing relying on the decision is affected (5.6.10),
// and confirming it still holds against its cause (5.6.13), its raise event
// a departure this machine alone judges, and every reader passing it by or
// showing it beside the decision; each answer landed once across a kill;
// and a call the decision point lets proceed landed as Claude's
// replacement.
//
// Layer: verb, and beside it process — the answer killed in a child at a
// file call on its way. World: the ledger suites' unit with a question, a
// finding, Claude's decision answering the question and a question relying
// on that decision, written once on the note window and copied for each
// test; each test keeps its conversation and the trust log in a config
// folder of its own, and a second machine's in a folder within it. The
// separate call is the stub binary, unarmed: no login, so every row is
// drawn unjudged.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  ok, okSectionsAsync, refusesAsync, refusedPristine, output, killedAt, readState, layout, cleanupFixture,
} = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { UNIT, MADE, NOTE, PHASES, NOTE_COPY, writtenWorld, ledgerHelpers, copiesHelpers } = require('./ledger-world.cjs');
const { auditGate } = require('./gate-audit.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const { TRUST_LOG } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));
const { RAISE_SHOWN, PRESSED } = require(path.join(SCRIPTS, 'domain/gate.cjs'));
const { gateShown } = require(path.join(SCRIPTS, 'domain/projections/surfaces.cjs'));
const { linesToAdd, entryId } = require(path.join(SCRIPTS, 'domain/state-merge-rules.cjs'));
const decisionPoint = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));

// A Claude Code session's id.
const SESSION = 'c0ffee00-1234-4abc-8def-0123456789ab';
const EVERY_CALL_ASKS = 'Every call comes to you for now: the counts that would let me decide aren\'t built yet.';
const OVER = 'person-moved-claude';

// Claude's decision as it stands, which the raise proposes to replace.
const KEPT = 'On the screen the cursor is on';
const MAIN = Object.freeze({ key: '1', name: 'Main', text: 'On the main screen', notice: 'every note opens on the same screen' });
const LAST = Object.freeze({ key: '2', name: 'Last', text: 'Where the last note was', notice: 'notes gather on one screen until you move one' });
const KEEP = Object.freeze({ key: 'keep', name: 'Keep it as it stands', text: KEPT, notice: 'nothing changes' });

/** Claude's call: a new note opening on the main screen, in place of the cursor's. */
const CALL = Object.freeze({
  question: 'Should a new note open somewhere other than under the cursor?',
  rows: [MAIN, LAST],
  lean: '1',
  why: 'Most people work on one screen.',
  sort: 'one',
  mechanism: 'The main display, whatever the pointer is over.',
  product_wide: false,
});

/** Claude's call on the answer to whether a new note takes focus. */
const FOCUS_CALL = Object.freeze({
  ...CALL,
  question: 'Should a new note leave the focus where it was?',
  rows: [{ ...MAIN, text: 'The focus stays where it was' }, { ...LAST, text: 'The focus follows the pointer' }],
  lean: '2',
});

/** Claude's account of the person's reason. */
const WHY = 'They keep their notes together on the main screen.';

const { world, made } = writtenWorld('raise-replace-', PHASES, (write) => {
  const where = write('ask', NOTE, [], { ...MADE, text: 'Where does a new note open?' }).id;
  const screens = write('find', NOTE, [], { ...MADE, text: 'Most people work on one screen.', how: 'seen in a study' }).id;
  const opens = write('decide', NOTE, ['--answers', where], { ...MADE, text: KEPT, why: 'A note follows the person.' }).id;
  const focus = write('ask', NOTE, ['--relies-on', opens], { ...MADE, text: 'Does a new note take focus?' }).id;
  return { where, screens, opens, focus };
});

const config = useTempFolder('raise-replace-config-');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = world();
});

afterEach(() => {
  cleanupFixture(dir);
});

const { ledgerText, entries, full } = ledgerHelpers(() => dir);
const { copy } = copiesHelpers(() => dir);

/** The calling conversation's environment, over `env`. @param {Record<string, string|undefined>} [env] */
const conversation = (env = {}) => ({ CLAUDE_CODE_SESSION_ID: SESSION, WORKFLOWS_CONFIG_DIR: config(), ...env });

/** A file in the conversation's folder. @param {string} name */
const inFolder = (name) => path.join(config(), 'conversations', SESSION, name);

/** The conversation's sealed raises, null where none was sealed. @returns {Record<string, any>|null} */
const seals = () => (fs.existsSync(inFolder(RAISE_SHOWN)) ? JSON.parse(fs.readFileSync(inFolder(RAISE_SHOWN), 'utf8')) : null);

/** The trust log's events, each but its id, its time and the project's name. */
function logged() {
  const file = path.join(config(), TRUST_LOG);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').slice(0, -1).map((line) => {
    const { id: _id, at: _at, project_name: _name, ...event } = JSON.parse(line);
    return event;
  });
}

/** The id setup minted the project. */
const project = () => JSON.parse(readState(dir, layout.projectManifest)).project_id;

/** The argv naming Claude's decision as the one replaced, for `reason`. @param {string} [reason] @param {string[]} [more] */
const replacing = (reason = 'changed-mind', more = []) => [NOTE, '--replaces', made.opens, '--reason', reason, ...more];

/**
 * A raise on a replacement drawn: its response and its screen.
 * @param {string[]} [args] @param {{call?: Record<string, unknown>, env?: Record<string, string|undefined>}} [opts]
 */
function drawn(args = replacing(), { call = CALL, env } = {}) {
  return okSectionsAsync(dir, ['raise', ...args], { env: conversation(env), stdin: JSON.stringify(call) });
}

/** A raise on a replacement drawn: its id. @param {string[]} [args] */
async function draw(args) {
  return /** @type {string} */ ((await drawn(args)).res.raise);
}

/**
 * A draw refused, drawing nothing, sealing nothing and writing nothing:
 * its error.
 * @param {string[]} args @param {unknown} [call]
 */
async function refusedDraw(args, call = CALL) {
  const ledger = ledgerText();
  const { error } = await refusesAsync(dir, ['raise', ...args], { env: conversation(), stdin: JSON.stringify(call) });
  assert.deepStrictEqual([seals(), ledgerText()], [null, ledger], `raise ${args.join(' ')} refused, yet sealed or wrote`);
  return error;
}

/**
 * The person's answer, which must land: its response.
 * @param {string} id @param {string[]} how @param {Record<string, unknown>|null} [given] @param {Record<string, string|undefined>} [env]
 */
function answer(id, how, given = { why: WHY }, env = {}) {
  return ok(dir, ['raise', 'answer', id, ...how], { env: conversation(env), stdin: given === null ? '' : JSON.stringify(given) });
}

/** The ledger's last line but its time. */
function lastEntry() {
  const { at: _at, ...line } = /** @type {Record<string, unknown>} */ (entries().at(-1));
  return line;
}

/**
 * The person's replacement of Claude's decision a raise lands, its line but
 * the time: `own` over the pick of the lean.
 * @param {string} id @param {Record<string, unknown>} [own]
 */
function replacementOf(id, own = {}) {
  return {
    v: 1, id, event: 'replaced', unit: UNIT, topic: 'note-window', phase: 'discussion', session: SESSION,
    by: 'person', who_moved_whom: 'none', replaces: full(made.opens), reason: 'changed-mind', cause: null, drops: [KEPT], of: 'decision',
    answers: full(made.where), text: MAIN.text, why: WHY, rules_out: [LAST.text], relies_on: [], product_wide: false, sealed: MAIN.text,
    alternatives: [], evidence: [], kind: null, unchecked: true, ...own,
  };
}

/** The person's keep of Claude's decision a raise lands, its line but the time. @param {string} id */
function keepOf(id) {
  return {
    v: 1, id, event: 'kept', unit: UNIT, topic: 'note-window', phase: 'discussion', session: SESSION,
    by: 'person', who_moved_whom: OVER, entry: full(made.opens), reason: 'changed-mind', cause: null, sealed: MAIN.text,
  };
}

/**
 * A raise event as the trust log holds it, but its id and time: `own` over
 * the pick of the lean, typed.
 * @param {string|null} entry @param {Record<string, unknown>} [own]
 */
function raiseEvent(entry, own = {}) {
  return {
    v: 1, type: 'raise', project: project(), model: null, session: SESSION,
    entry, kind: null, label: null, sort: 'one', sealed: '1', answer: '1', via: 'typed', with_text: false, reading: null, didnt_follow: false, blocked_build: null, ...own,
  };
}

/** A second machine: a config folder of its own, the trust log in it. */
const secondMachine = () => ({ WORKFLOWS_CONFIG_DIR: path.join(config(), 'second-machine') });

/**
 * The verdict queue read through the trust log of the machine `env` names —
 * the conversation's where it names none: each departure's full id, its
 * answer and the lean beside it.
 * @param {Record<string, string|undefined>} [env]
 */
const queue = (env = conversation()) => ok(dir, ['verdict', 'queue'], { env }).departures.map((/** @type {{id: string, text: string, lean: string}} */ d) => [full(d.id), d.text, d.lean]);

/**
 * Claude's decision that a new note takes focus, answering the question
 * relying on where it opens, and relying on `more`'s entries: its short id.
 * @param {string[]} [more]
 */
const decideFocus = (more = []) => ledgerHelpers(() => dir).write('decide', NOTE, ['--answers', made.focus, ...more], { ...MADE, text: 'It takes the focus', why: 'Typing starts at once.' }).id;

/** What a replacement affects in the unit, by full id. */
const affected = () => ok(dir, ['ledger', 'affected', UNIT]).affected.map((/** @type {{id: string}} */ e) => full(e.id));

describe('the draw (16.5.7, 29.5.2)', () => {
  it('draws Claude\'s proposals, the lean recommended, then keep — the decision\'s answer as it stands — and seals the replacement\'s target, reason and cause beside the call, so the answer needs nothing more', async () => {
    const { res, sections } = await drawn(replacing('new-fact', ['--cause', made.screens, '--relies-on', made.screens]), { env: { WORKFLOWS_GATE_SURFACE: '1' } });

    const sealed = /** @type {Record<string, any>} */ (seals())[res.raise];
    assert.deepStrictEqual(sealed, {
      v: 1, id: res.raise, menu: `raise — ${res.raise}`, place: { unit: UNIT, phase: 'discussion', topic: 'note-window' },
      answers: null, relies_on: [full(made.screens)],
      replaces: { entry: full(made.opens), reason: 'new-fact', cause: full(made.screens), keep: KEEP },
      call: CALL, rows_judged: [], reason: EVERY_CALL_ASKS, at: sealed.at, answered: null, didnt_follow: 0,
    });
    const gate = /** @type {Record<string, any>} */ (auditGate(sections, 'raise --replaces'));
    assert.deepStrictEqual(gate.options.map((/** @type {Record<string, any>} */ o) => [o.word ?? o.key, o.head, o.recommended]).slice(0, 3),
      [['1', MAIN.text, true], ['2', LAST.text, false], ['keep', KEPT, false]]);
    assert.ok(gate.statement.includes(`I lean: ${MAIN.text}`) && gate.statement.includes('- Keep it as it stands: nothing changes'), 'the payload states no lean or no keep');
    assert.deepStrictEqual(/** @type {any} */ (gateShown()).options.find((/** @type {{key: string}} */ o) => o.key === 'keep').next.argv, ['raise', 'answer', res.raise, '--pick', 'keep']);
  });

  it('a second raise to replace the decision in the conversation keeps the first seal, its lean unchanged', async () => {
    const first = await drawn();

    const again = await drawn(replacing(), { call: { ...CALL, lean: '2' } });

    assert.deepStrictEqual([again.res, again.sections], [{ ...first.res, redrawn: true }, first.sections]);
  });

  it('a raise to replace another decision at the same place, the first still open, is sealed fresh beside it with its own rows and lean', async () => {
    const takes = decideFocus();
    const first = await drawn();

    const second = await drawn([NOTE, '--replaces', takes, '--reason', 'changed-mind'], { call: FOCUS_CALL });

    assert.deepStrictEqual([second.res.redrawn, second.res.raise === first.res.raise], [false, false]);
    const sealed = /** @type {Record<string, any>} */ (seals());
    assert.deepStrictEqual([first.res.raise, second.res.raise].map((id) => [sealed[id].replaces.entry, sealed[id].call]), [[full(made.opens), CALL], [full(takes), FOCUS_CALL]]);
  });
});

describe('the draw\'s refusals, drawing and sealing nothing', () => {
  it('ledger replace\'s checks, in the raise\'s words: a flag it does not take, a reason of none of the four, a reason needing a cause given none, a cause that is the entry replaced or not what the reason needs, and an entry no longer current', async () => {
    assert.match(await refusedDraw([...replacing(), '--answers', made.where]), /^raise takes no --answers — Usage: engine raise <work-unit>\.<phase>\[\.<topic>\] --replaces <id> --reason <new-fact\|other-topic\|changed-mind\|was-wrong> \[--cause <id>\] \[--relies-on <id> …\]/);
    assert.strictEqual(await refusedDraw(replacing('a-whim')), 'raise: --reason is one of new-fact, other-topic, changed-mind, was-wrong — not "a-whim"');
    assert.strictEqual(await refusedDraw(replacing('new-fact')), 'raise --reason new-fact needs --cause <id>: a finding');
    assert.strictEqual(await refusedDraw(replacing('changed-mind', ['--cause', made.opens])), `raise --cause names ${made.opens}, the entry it replaces — a cause is what made the change`);
    assert.strictEqual(await refusedDraw(replacing('new-fact', ['--cause', made.where])), `raise --cause names ${made.where}, a question on note-window — --reason new-fact needs a finding`);
    const { write } = ledgerHelpers(() => dir);
    const since = write('replace', NOTE, ['--replaces', made.opens, '--reason', 'changed-mind'], { ...MADE, drops: [KEPT], text: 'Beside the last note', why: 'Notes gather.' }).id;
    assert.match(await refusedDraw(replacing()), new RegExp(`^raise --replaces names ${made.opens}, which ${since} replaced — the current one is ${since}$`));
  });

  it('an entry replaced that is no decision: a raise\'s rows answer a decision\'s question', async () => {
    assert.strictEqual(await refusedDraw([NOTE, '--replaces', made.focus, '--reason', 'changed-mind']),
      `raise --replaces names ${made.focus}, a question — a raise replaces a decision, the person picking its answer`);
  });

  it('a call proposing nothing, a lean of keep, a proposal keyed keep, and a proposal whose answer is the decision\'s as it stands', async () => {
    assert.strictEqual(await refusedDraw(replacing(), { ...CALL, rows: [] }),
      'raise: the call proposes no answer — a raise on a replacement proposes one at least, beside keeping the entry as it stands');
    assert.strictEqual(await refusedDraw(replacing(), { ...CALL, lean: 'keep' }),
      'raise: the call leans to keep, the entry as it stands — a raise on a replacement leans to one of its proposals');
    assert.strictEqual(await refusedDraw(replacing(), { ...CALL, rows: [MAIN, { ...LAST, key: 'Keep' }] }),
      'raise: the call\'s rows[1] takes the key Keep, which the screen keeps for itself — t, e, technical, explain, comment, keep are its own, in any case');
    assert.strictEqual(await refusedDraw(replacing(), { ...CALL, rows: [MAIN, { ...LAST, text: KEPT }] }),
      `raise: the call's row 2 proposes ${made.opens}'s answer as it stands — a replacement changes it, and keeping it is the screen's own row`);
  });
});

describe('the answer\'s refusals, recording nothing', () => {
  it('keep on a raise of a question, which has no such row', async () => {
    const id = /** @type {string} */ ((await okSectionsAsync(dir, ['raise', NOTE, '--answers', made.focus], { env: conversation(), stdin: JSON.stringify(FOCUS_CALL) })).res.raise);

    const { error } = refusedPristine(dir, ['raise', 'answer', id, '--pick', 'keep'], { env: conversation(), stdin: JSON.stringify({ why: WHY }) });

    assert.strictEqual(error, 'raise answer: the raise has no row keep — its rows: 1, 2');
    assert.deepStrictEqual(logged(), []);
  });

  it('a decision replaced since the draw: keep and a pick each refused, naming the decision, what replaced it, and the way on, raising again on what is current', async () => {
    const id = await draw();
    const { write } = ledgerHelpers(() => dir);
    const since = write('replace', NOTE, ['--replaces', made.opens, '--reason', 'changed-mind'], { ...MADE, drops: [KEPT], text: 'Beside the last note', why: 'Notes gather.' }).id;
    const said = `raise answer: the raise proposes replacing ${made.opens}, and since it was drawn ${since} replaced it — nothing recorded: raise again on ${since}, where it still calls for a change, and the person's answer stays in the conversation`;

    for (const [how, given] of [[['--pick', 'keep'], ''], [['--pick', '1'], JSON.stringify({ why: WHY })]]) {
      assert.strictEqual(refusedPristine(dir, ['raise', 'answer', id, ...how], { env: conversation(), stdin: given }).error, said);
    }
    assert.deepStrictEqual([logged(), /** @type {Record<string, any>} */ (seals())[id].answered], [[], null]);
  });
});

describe('each answer, its line, its raise event, who moved whom and the queue (5.3.10)', () => {
  it('the lean picked: the person\'s replacement at the raise\'s id, dropping the answer as it stood, the other proposals what it rules out, the lean sealed, moving no one — one raise event naming it, no reversal, nothing in the queue; the record\'s copy holds the new answer', async () => {
    const id = await draw();

    const res = answer(id, ['--pick', '1']);

    assert.strictEqual(full(res.id), id);
    assert.deepStrictEqual(lastEntry(), replacementOf(id));
    assert.deepStrictEqual(logged(), [raiseEvent(id)]);
    assert.deepStrictEqual(queue(), []);
    assert.ok(copy(NOTE_COPY)?.includes(MAIN.text), 'the record\'s copy does not hold the answer that replaced the decision');
  });

  it('another proposal picked stands over the lean: a departure waiting with the lean beside it, still no reversal; what relied on the decision is affected', async () => {
    const id = await draw();

    answer(id, ['--pick', '2']);

    assert.deepStrictEqual(lastEntry(), replacementOf(id, { who_moved_whom: OVER, text: LAST.text, rules_out: [MAIN.text] }));
    assert.deepStrictEqual(logged(), [raiseEvent(id, { answer: '2' })]);
    assert.deepStrictEqual(queue(), [[id, LAST.text, MAIN.text]]);
    assert.deepStrictEqual(affected(), [full(made.focus)]);
  });

  it('the lean picked as the person came round to it, at Claude\'s word: claude-moved-person, nothing in the queue', async () => {
    const id = await draw();

    answer(id, ['--pick', '1'], { why: WHY, who_moved_whom: 'claude-moved-person' });

    assert.deepStrictEqual(lastEntry(), replacementOf(id, { who_moved_whom: 'claude-moved-person' }));
    assert.deepStrictEqual(queue(), []);
  });

  it('the person\'s own words stand over the lean: free text, typed, naming no row — a departure with the lean beside it', async () => {
    const id = await draw();

    answer(id, ['--own'], { text: 'Beside the note it was made from', why: WHY });

    assert.deepStrictEqual(lastEntry(), replacementOf(id, { who_moved_whom: OVER, text: 'Beside the note it was made from', rules_out: [] }));
    assert.deepStrictEqual(logged(), [raiseEvent(id, { answer: null, with_text: true })]);
    assert.deepStrictEqual(queue(), [[id, 'Beside the note it was made from', MAIN.text]]);
  });

  it('keep, pressed, reading no stdin: the person\'s keep at the raise\'s id — the decision, the reason and the cause, Claude\'s proposal sealed — standing over it; one raise event naming the keep; the decision current, the keep shown beside it in the record and waiting in the queue with the proposal as its lean', async () => {
    const id = await draw();
    fs.writeFileSync(inFolder(PRESSED), JSON.stringify({ gate: `raise — ${id}`, answer: 'keep', at: new Date(Date.now() + 1000).toISOString() }));

    const res = answer(id, ['--pick', 'keep'], null, { WORKFLOWS_GATE_SURFACE: '1' });

    assert.strictEqual(full(res.id), id);
    assert.deepStrictEqual(lastEntry(), keepOf(id));
    assert.deepStrictEqual(logged(), [raiseEvent(id, { answer: 'keep', via: 'pressed' })]);
    assert.deepStrictEqual(/** @type {Record<string, any>} */ (seals())[id].answered.answer, 'keep');
    const record = ok(dir, ['ledger', 'record', UNIT, 'note-window']);
    const decision = record.decisions.find((/** @type {{id: string}} */ d) => full(d.id) === full(made.opens));
    assert.deepStrictEqual([decision?.kept.map((/** @type {Record<string, string>} */ k) => [full(k.id), k.event, full(k.entry), k.sealed]), decision?.replaced], [[[id, 'kept', full(made.opens), MAIN.text]], []]);
    const row = ok(dir, ['ledger', 'map', UNIT, 'note-window']).questions.find((/** @type {{id: string}} */ q) => full(q.id) === full(made.where));
    assert.deepStrictEqual(row.answers.map((/** @type {{id: string}} */ a) => full(a.id)), [full(made.opens)]);
    assert.deepStrictEqual(queue(), [[id, KEPT, MAIN.text]]);
  });

  it('"I don\'t follow" logs a raise event in the trust log alone and leaves the raise open, to be shown again with keep among its rows', async () => {
    const id = await draw();
    const ledger = ledgerText();

    assert.deepStrictEqual(answer(id, ['--didnt-follow'], null), { ok: true, raise: id, open: true });

    assert.strictEqual(ledgerText(), ledger);
    assert.deepStrictEqual(logged(), [raiseEvent(null, { answer: null, didnt_follow: true })]);
    assert.deepStrictEqual(queue(), []);
    assert.match(output(dir, ['raise', 'show', id], { env: conversation() }), /^\*\*`keep`\*\* +→ On the screen the cursor is on$/m);
  });
});

describe('a keep changes nothing current (5.6.10)', () => {
  it('the person keeps an entry Claude proposed to replace: its raise event stands as a departure, so the keep waits in this machine\'s queue, the answer it kept beside Claude\'s proposal as its lean, until its verdict is given; a second machine holds the keep in its ledger, none in its queue, and refuses a verdict on it; nothing that relied on the entry is affected, and no confirmation can name the keep, as none needs to', async () => {
    const kept = await draw();

    answer(kept, ['--pick', 'keep'], null);

    assert.deepStrictEqual(queue(), [[kept, KEPT, MAIN.text]]);
    const elsewhere = secondMachine();
    const { decisions } = ok(dir, ['ledger', 'record', UNIT, 'note-window'], { env: elsewhere });
    const decision = decisions.find((/** @type {{id: string}} */ d) => full(d.id) === full(made.opens));
    assert.deepStrictEqual([decision?.kept.map((/** @type {{id: string}} */ k) => full(k.id)), queue(elsewhere)], [[kept], []]);
    const refused = refusedPristine(dir, ['verdict', 'give', kept, 'skip', '--at', 'queue'], { env: elsewhere });
    assert.match(refused.error, /^verdict give: \w+ is no departure this machine logged — a departure's verdict is given on the machine where it was made/);
    assert.ok(!fs.existsSync(path.join(/** @type {string} */ (elsewhere.WORKFLOWS_CONFIG_DIR), TRUST_LOG)), 'the second machine logged a verdict it refused');
    const given = ok(dir, ['verdict', 'give', kept, 'nothing', '--at', 'queue'], { env: conversation() });
    assert.deepStrictEqual([full(given.entry), given.verdict, queue()], [kept, 'nothing', []]);
    assert.deepStrictEqual(affected(), []);
    const hold = refusedPristine(dir, ['ledger', 'hold', NOTE, '--entry', made.focus, '--after', kept], { env: conversation(), stdin: JSON.stringify(MADE) });
    assert.match(hold.error, /^ledger hold --after names \w+, a kept event — it must name a replacement$/);
  });

  it('every reader passes it by: the knowledge copy is as it was, the late check judges the decisions owed one and never the keep, and a second clone\'s merge carries its line once', async () => {
    const id = await draw();
    const [before, copied] = [ledgerText(), copy(NOTE_COPY)];
    assert.ok(copied?.includes(KEPT), 'the record\'s copy does not hold the decision');

    answer(id, ['--pick', 'keep'], null);

    const after = ledgerText();
    assert.strictEqual(copy(NOTE_COPY), copied);
    const keptLine = /** @type {string} */ (after.split('\n').find((line) => line.includes(`"id":"${id}"`)));
    const added = (/** @type {string} */ remote, /** @type {string} */ local) => [...linesToAdd(remote.split('\n'), local.split('\n'), entryId)];
    assert.deepStrictEqual([added(before, after), added(after, after)], [[keptLine], []]);
    const checked = ok(dir, ['ledger', 'late-check'], { env: { ...conversation(), CLAUDE_STUB_ANSWERS: JSON.stringify({ '': { rules: ['One rule.'] } }) } });
    assert.deepStrictEqual([checked, entries().filter((e) => e.event === 'checked').map((e) => e.entry)], [{ ok: true, ran: true, checked: 1, several: 0, owed: 0 }, [full(made.opens)]]);
  });
});

describe('a keep confirms the decision against its cause (5.6.10, 5.6.13)', () => {
  it('a decision affected by a new finding, kept for no cause, stays affected; kept for that new fact, its cause the finding, the line holds both and the decision is no longer affected — until a newer finding flags it again', async () => {
    const takes = decideFocus(['--relies-on', made.screens]);
    const { write } = ledgerHelpers(() => dir);
    const replaceScreens = (/** @type {string} */ finding, /** @type {string} */ was, /** @type {string} */ text) => write('replace', NOTE, ['--replaces', finding, '--reason', 'was-wrong'], { ...MADE, drops: [was], text, how: 'seen in a second study' }).id;
    const twoScreens = replaceScreens(made.screens, 'Most people work on one screen.', 'Most people work on two screens.');
    assert.deepStrictEqual(affected(), [full(takes)]);
    const keepFor = async (/** @type {string[]} */ more) => {
      const id = /** @type {string} */ ((await drawn([NOTE, '--replaces', takes, ...more], { call: FOCUS_CALL })).res.raise);
      answer(id, ['--pick', 'keep'], null);
      return id;
    };

    await keepFor(['--reason', 'changed-mind']);
    assert.deepStrictEqual(affected(), [full(takes)]);

    const kept = await keepFor(['--reason', 'new-fact', '--cause', twoScreens]);
    assert.deepStrictEqual(lastEntry(), { ...keepOf(kept), entry: full(takes), reason: 'new-fact', cause: full(twoScreens), sealed: FOCUS_CALL.rows[1].text });
    assert.deepStrictEqual(affected(), []);

    replaceScreens(twoScreens, 'Most people work on two screens.', 'Most people work on three screens.');
    assert.deepStrictEqual(affected(), [full(takes)]);
  });
});

describe('once (E3)', () => {
  it('killed between the state commit and marking its seal, the keep re-answered lands one keep line and one event, saying the raise was answered already with keep', async () => {
    const id = await draw();
    killedAt({ method: 'renameSync', file: RAISE_SHOWN, when: 'before' }, dir, ['raise', 'answer', id, '--pick', 'keep'], { env: conversation() });
    assert.strictEqual(/** @type {Record<string, any>} */ (seals())[id].answered, null);

    const res = answer(id, ['--pick', 'keep'], null);

    assert.deepStrictEqual([res.already, res.answer, full(res.id)], [true, 'keep', id]);
    assert.deepStrictEqual([entries().filter((e) => e.id === id).length, logged()], [1, [raiseEvent(id, { answer: 'keep' })]]);
    assert.strictEqual(/** @type {Record<string, any>} */ (seals())[id].answered.answer, 'keep');
  });

  it('killed between the state commit and marking its seal, a pick re-answered — the decision now replaced by its own line — lands one line and one event, saying the raise was answered already with that row', async () => {
    const id = await draw();
    killedAt({ method: 'renameSync', file: RAISE_SHOWN, when: 'before' }, dir, ['raise', 'answer', id, '--pick', '2'], { env: conversation(), stdin: JSON.stringify({ why: WHY }) });

    const res = answer(id, ['--pick', '2']);

    assert.deepStrictEqual([res.already, res.answer, full(res.id)], [true, '2', id]);
    assert.deepStrictEqual([entries().filter((e) => e.id === id).length, logged()], [1, [raiseEvent(id, { answer: '2' })]]);
  });
});

describe('proceed (E7, 16.3.7)', () => {
  it('where the decision point answers proceed, the draw lands Claude\'s replacement through ledger replace\'s write — the lean, the other proposals what it rules out, the answer it replaces dropped, its why — logged as a call carrying the sort, drawing and sealing nothing', async (t) => {
    const reason = 'On where things open my calls hold: 2% overruled, under your 20%.';
    t.mock.method(decisionPoint, 'decide', () => ({ decision: 'proceed', reason }));

    const { res, sections } = await drawn();

    assert.deepStrictEqual([res.decision, res.reason, sections], ['proceed', reason, '']);
    const id = full(res.id);
    assert.deepStrictEqual(lastEntry(), replacementOf(id, { by: 'claude', why: CALL.why, sealed: null }));
    assert.deepStrictEqual(logged(), [{ v: 1, type: 'call', project: project(), model: null, session: SESSION, entry: id, kind: null, label: null, sort: 'one' }]);
    assert.strictEqual(seals(), null);
  });
});
