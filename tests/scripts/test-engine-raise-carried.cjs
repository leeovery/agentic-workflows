'use strict';

// ---------------------------------------------------------------------------
// A raise on the replacement of a decision the migration carried from
// before Ledger (ledger-engine/scripts/domain/raise.cjs, `whoseReplaced`,
// over domain/ask-rule.cjs): standing as the migration carried it, no keep
// of the person's on it since, it is read as carried over, whoever its line
// says made it — the person among them — so the ask rule decides its
// replacement as any call's, a one-answer call going ahead as Claude's;
// under `--always built-otherwise` it asks for the mark (21.6.16); once the
// person keeps it, and for a decision of theirs made in Ledger, it always
// asks as theirs (16.5.7); and Claude's own `ledger replace` of it stays
// refused, naming the raise. The rest of a replacement's raise — its draw,
// its answers and the mark's keep row — is test-engine-raise-replace.cjs's.
//
// Layer: verb. World, built once and copied: the ledger suites' unit with,
// on the note window, a finding, the person's decision made in Ledger, and
// the person's decision as the migration carried it. Each test keeps its
// conversation and the trust log, empty, in a config folder of its own; the
// stand-in labels each call behaviour.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { refusedPristine, commitAll, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest, useTempFolder } = require('./discovery-test-utils.cjs');
const { UNIT, MADE, NOTE, PHASES, ledgerHelpers } = require('./ledger-world.cjs');
const { raiseHelpers } = require('./raise-world.cjs');

// The person's decision from before Ledger, which the code was built otherwise than.
const CARRIED = 'On the screen it was last opened on';
const MAIN = Object.freeze({ key: '1', name: 'Main', text: 'On the main screen', notice: 'every note opens on the same screen' });
const LAST = Object.freeze({ key: '2', name: 'Last', text: 'Where the last note was', notice: 'notes gather on one screen until you move one' });

/** Claude's call with one defensible answer: a new note opening where the code opens it. */
const CALL = Object.freeze({
  question: 'Should a new note open where the code opens it?',
  rows: [MAIN, LAST],
  lean: '1',
  why: 'The code has opened notes on the main screen since the spring.',
  sort: 'one',
  mechanism: 'The main display, whatever the pointer is over.',
  product_wide: false,
});

/** The same, leaning to keep the decision. */
const KEEP_LEAN = Object.freeze({ ...CALL, question: 'Should a new note open where it was last opened, as decided?', lean: 'keep' });

/** Claude's call on the person's decision that a new note takes focus. */
const FOCUS_CALL = Object.freeze({
  ...CALL,
  question: 'Should a new note leave the focus where it was?',
  rows: [{ ...MAIN, text: 'The focus stays where it was' }, { ...LAST, text: 'The focus follows the pointer' }],
});

/** @type {Record<'screens'|'theirs'|'carried', string>} */
const made = /** @type {any} */ ({});

const world = fixtureFrom('raise-carried-', (template) => {
  createManifest(template, UNIT, { work_type: 'epic', phases: PHASES });
  const { write, carriedOver } = ledgerHelpers(() => template);
  const asked = (/** @type {string} */ text) => write('ask', NOTE, [], { ...MADE, text }).id;
  made.screens = write('find', NOTE, [], { ...MADE, text: 'New notes open on the main screen.', how: 'read in src/note.js, open', known: 'read' }).id;
  made.theirs = write('decide', NOTE, ['--answers', asked('Does a new note take focus?')], { by: 'person', who_moved_whom: 'none', text: 'It takes the focus', why: 'Typing starts at once.' }).id;
  made.carried = carriedOver(NOTE, asked('Where does a new note open?'), CARRIED, 'person');
  commitAll(template, 'the decision carried');
}, { kept: made });

const config = useTempFolder('raise-carried-config-');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = world();
});

afterEach(() => {
  cleanupFixture(dir);
});

const { full } = ledgerHelpers(() => dir);
const { conversation, seals, answer, lastEntry, labelledAs, raised } = raiseHelpers(() => dir, config, CALL);

/** The flags raising the replacement of `decision`, the finding the cause, as code built otherwise is raised. @param {string} decision */
const cited = (decision) => ['--replaces', decision, '--reason', 'new-fact', '--cause', made.screens];

/** A raise of `call` on the replacement of `decision`, with `more` flags, labelled behaviour: its response. @param {string} decision @param {Record<string, unknown>} call @param {string[]} [more] */
const raising = async (decision, call, more = []) => (await raised(NOTE, [...cited(decision), ...more], call, labelledAs(call, 'behaviour'))).res;

/** Whose the decision a sealed raise would replace was. @param {string} raise */
const sealedWhose = (raise) => /** @type {Record<string, any>} */ (seals())[raise].replaced_by;

const THEIRS = 'You decided this yourself, so changing it always comes to you.';

describe('a decision the migration carried, the person\'s by its line (21.6.16)', () => {
  it('is replaced through the ask rule as any call is, never asking for being theirs: a one-answer call goes ahead, landing as Claude\'s replacement; the same call on their decision made in Ledger always asks', async () => {
    const goes = await raising(made.carried, CALL);
    const landed = lastEntry();
    const asks = await raising(made.theirs, FOCUS_CALL);

    assert.deepStrictEqual([goes.decision, [landed.event, landed.by, landed.replaces, landed.text]], ['proceed', ['replaced', 'claude', full(made.carried), MAIN.text]]);
    assert.deepStrictEqual([asks.decision, asks.reason, sealedWhose(asks.raise)], ['ask', THEIRS, 'person']);
  });

  it('asks for the mark under --always built-otherwise, sealed as carried over; once the person keeps it, its replacement always asks as theirs', async () => {
    const marked = await raising(made.carried, KEEP_LEAN, ['--always', 'built-otherwise']);
    const whose = sealedWhose(marked.raise);
    answer(marked.raise, ['--pick', 'keep']);
    const after = await raising(made.carried, CALL);

    assert.deepStrictEqual([marked.decision, marked.reason, whose], ['ask', 'The code was built otherwise than a decision from before Ledger, so it always comes to you.', 'carried']);
    assert.deepStrictEqual([after.decision, after.reason, sealedWhose(after.raise)], ['ask', THEIRS, 'person']);
  });

  it('Claude\'s own ledger replace of it is refused, writing nothing, naming the raise', () => {
    const { error } = refusedPristine(dir, ['ledger', 'replace', NOTE, ...cited(made.carried)], { env: conversation(), stdin: JSON.stringify({ ...MADE, drops: [CARRIED], text: MAIN.text, why: 'The code opens it there.' }) });

    assert.strictEqual(error, `ledger replace: ${made.carried} is the person's decision — Claude's change to it always comes to them: raise ${NOTE} --replaces ${made.carried} --reason new-fact --cause ${made.screens}`);
  });
});
