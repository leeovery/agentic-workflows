'use strict';

// ---------------------------------------------------------------------------
// What the menus read of a quick-fix: what waits on the person there
// (leeway-engine/scripts/domain/waits.cjs; 18.2.3) — its questions asked in
// its conversation and its fixes' parked, each once, read from the ledger in
// any conversation; each raise sealed at its fixes, counted in the
// conversation that drew it alone (N1); and its close, never listed while a
// question of the conversation waits — each with its door; and how far it
// has come (domain/progress.cjs). Any other unit's: the other waits suites.
//
// Layer: verb, the reads called in process. Worlds: the quick-fix board's
// `working` and `closable` (quick-fix-board-world.cjs), each built once and
// copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');

const { ok, okSections, okSectionsAsync, cleanupFixture } = require('./engine-harness.cjs');
const { ledgerHelpers, ledgerReadHelpers, leaningCall, MADE } = require('./ledger-world.cjs');
const { UNIT: TYPO, PLACE } = require('./quick-fix-world.cjs');
const { SESSION, CALL, made, working, closable, quickFixBoard } = require('./quick-fix-board-world.cjs');
const { waitsIn, progress, door, wait } = require('./waits-world.cjs');

describe('a quick-fix\'s questions and its close (18.2.3, N1)', () => {
  /** @type {string} */
  let dir;
  afterEach(() => cleanupFixture(dir));
  const { env, parkedOn } = quickFixBoard(() => dir);
  /** What waits in the quick-fix, read in the conversation `session`, or in none, its seals beside this one's. @param {string} [session] */
  const waiting = (session) => waitsIn(dir, [TYPO], { config: env().LEEWAY_CONFIG_DIR, session });
  const intoFixes = door('leeway-quick-fix-process', 'quick-fix', TYPO);
  const PROPOSAL = { ...leaningCall('Entering marks the row.', 'Entering marks nothing.'), question: 'What should the README say entering does?' };
  /** The replacement of Claude's call `call` on the README, waiting. @param {string} call */
  const replacingWait = (call) => wait('raised', call, PROPOSAL.question, intoFixes);

  /** Claude's replacement of its call `call` on the README raised in this conversation: the raise's id. @param {string} call */
  const replacing = async (call) => (await okSectionsAsync(dir, ['raise', PLACE, '--replaces', call, '--reason', 'was-wrong'], { env: env(), stdin: JSON.stringify(PROPOSAL) })).res.raise;

  it('a question raised at its fixes waits once, asked and sealed, in any conversation; a replacement raised in this one waits here alone, until kept — each its door the fixes', async () => {
    dir = working();
    const asked = ledgerHelpers(() => dir).write('ask', PLACE, [], { ...MADE, text: CALL.question }).id;
    await okSectionsAsync(dir, ['raise', PLACE, '--answers', asked], { env: env(), stdin: JSON.stringify(CALL) });
    const raise = await replacing(made.call);
    const read = { here: waiting(SESSION), cleared: waiting('sess-cleared'), none: waiting() };
    ok(dir, ['raise', 'answer', raise, '--pick', 'keep'], { env: env(), stdin: JSON.stringify({ why: 'The README is right.' }) });
    const ASKED = wait('raised', asked, CALL.question, intoFixes);

    assert.deepStrictEqual([read, waiting(SESSION)], [
      { here: { [TYPO]: [ASKED, replacingWait(made.call)] }, cleared: { [TYPO]: [ASKED] }, none: { [TYPO]: [ASKED] } },
      { [TYPO]: [ASKED] },
    ]);
  });

  it('a question a fix is parked on waits once, by its number, among the build\'s questions — its raise drawn from the park never counted again', async () => {
    dir = working();
    await parkedOn('1.1', 'Should the help name both spellings?');
    okSections(dir, ['raise', 'draw', TYPO, 'Q1'], { env: env() });

    assert.deepStrictEqual(waiting(SESSION), { [TYPO]: [wait('question', 'Q1', 'Should the help name both spellings?', intoFixes)] });
  });

  it('its close waits once its screen draws, its door the fixes, and is never listed while a raise of this conversation waits — read in a conversation cleared since, the raise counts for nothing and the close waits; the quick-fix is in its implementation', async () => {
    dir = closable();
    const { ask, decide } = ledgerReadHelpers(() => dir);
    const call = decide(PLACE, ask(PLACE, 'What does the README say entering does?'), 'The README says entering marks the row');
    const closing = waiting(SESSION);
    await replacing(call);
    const CLOSE = wait('finish', 'finish', 'Close', intoFixes);

    assert.deepStrictEqual([closing, waiting(SESSION), waiting('sess-cleared'), progress(dir, TYPO)], [{ [TYPO]: [CLOSE] }, { [TYPO]: [replacingWait(call)] }, { [TYPO]: [CLOSE] }, 'implementation']);
  });
});
