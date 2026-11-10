'use strict';

// ---------------------------------------------------------------------------
// What the menus read of a quick-fix, with no conversation of their own:
// what waits on the person there (leeway-engine/scripts/domain/waits.cjs;
// 18.2.3) — its questions asked in its conversation and its fixes' parked,
// each once; the raises sealed in any conversation at its fixes, the latest
// seal of each deciding and a seal of a subject the project's ledger does
// not hold passed over (E4); and its close — each with its door; and how
// far it has come (domain/progress.cjs). Any other unit's: test-engine-
// waits.cjs and test-engine-waits-build.cjs.
//
// Layer: verb, the reads called in process. Worlds: the quick-fix board's
// `working` and `closable` (quick-fix-board-world.cjs), each copied for
// each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, okSections, okSectionsAsync, cleanupFixture } = require('./engine-harness.cjs');
const { ledgerHelpers, leaningCall, MADE } = require('./ledger-world.cjs');
const { UNIT: TYPO, PLACE } = require('./quick-fix-world.cjs');
const { SESSION, CALL, made, working, closable, quickFixBoard } = require('./quick-fix-board-world.cjs');
const { waitsIn, progress, door, wait } = require('./waits-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { RAISE_SHOWN } = require(path.join(SCRIPTS, 'domain/gate.cjs'));
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));

describe('a quick-fix\'s questions and its close, read with no conversation (18.2.3, E4)', () => {
  /** @type {string} */
  let dir;
  afterEach(() => cleanupFixture(dir));
  const { env, parkedOn } = quickFixBoard(() => dir);
  /** The engine as another conversation runs it, its seals beside this one's. */
  const elsewhere = () => ({ ...env(), CLAUDE_CODE_SESSION_ID: 'sess-elsewhere' });
  /** What waits in the quick-fix, read with every conversation's seals. */
  const waiting = () => waitsIn(dir, [TYPO], { config: env().LEEWAY_CONFIG_DIR });
  const intoFixes = door('leeway-quick-fix-process', 'quick-fix', TYPO);
  const PROPOSAL = { ...leaningCall('Entering marks the row.', 'Entering marks nothing.'), question: 'What should the README say entering does?' };

  /** Claude's replacement of its call on the README raised in the conversation `as` runs: the raise's id. @param {Record<string, string|undefined>} as */
  const replacing = async (as) => (await okSectionsAsync(dir, ['raise', PLACE, '--replaces', made.call, '--reason', 'was-wrong'], { env: as, stdin: JSON.stringify(PROPOSAL) })).res.raise;

  it('a question raised at its fixes waits once, asked and sealed; a replacement raised in another conversation waits too — each its door the fixes', async () => {
    dir = working();
    const asked = ledgerHelpers(() => dir).write('ask', PLACE, [], { ...MADE, text: CALL.question }).id;
    await okSectionsAsync(dir, ['raise', PLACE, '--answers', asked], { env: env(), stdin: JSON.stringify(CALL) });
    await replacing(elsewhere());

    assert.deepStrictEqual(waiting(), { [TYPO]: [wait('question', asked, CALL.question, intoFixes), wait('question', made.call, PROPOSAL.question, intoFixes)] });
  });

  it('a question a fix is parked on waits once, by its number, among the build\'s questions — its raise drawn from the park never counted again', async () => {
    dir = working();
    await parkedOn('1.1', 'Should the help name both spellings?');
    okSections(dir, ['raise', 'draw', TYPO, 'Q1'], { env: env() });

    assert.deepStrictEqual(waiting(), { [TYPO]: [wait('question', 'Q1', 'Should the help name both spellings?', intoFixes)] });
  });

  it('E4: a seal of a subject this project\'s ledger does not hold — another project\'s quick-fix of the same name, on this machine — is passed over', async () => {
    dir = working();
    const raise = await replacing(env());
    const conversations = path.join(env().LEEWAY_CONFIG_DIR, 'conversations');
    const { [raise]: seal } = JSON.parse(fs.readFileSync(path.join(conversations, SESSION, RAISE_SHOWN), 'utf8'));
    const theirs = newId();
    fs.mkdirSync(path.join(conversations, 'sess-theirs'));
    fs.writeFileSync(path.join(conversations, 'sess-theirs', RAISE_SHOWN), JSON.stringify({ [theirs]: { ...seal, id: theirs, replaces: { ...seal.replaces, entry: newId() } } }));

    assert.deepStrictEqual(waiting(), { [TYPO]: [wait('question', made.call, PROPOSAL.question, intoFixes)] });
  });

  it('E4: a conversation whose seals cannot be read is passed over whole, every other read', async () => {
    dir = working();
    await replacing(env());
    const unreadable = path.join(env().LEEWAY_CONFIG_DIR, 'conversations', 'sess-torn');
    fs.mkdirSync(unreadable);
    fs.writeFileSync(path.join(unreadable, RAISE_SHOWN), '{"torn');

    assert.deepStrictEqual(waiting(), { [TYPO]: [wait('question', made.call, PROPOSAL.question, intoFixes)] });
  });

  it('E4: the latest seal of a replacement decides — raised again in another conversation it waits once, and kept there it waits no more', async () => {
    dir = working();
    await replacing(elsewhere());
    const raise = await replacing(env());
    const twice = waiting();
    ok(dir, ['raise', 'answer', raise, '--pick', 'keep'], { env: env(), stdin: JSON.stringify({ why: 'The README is right.' }) });

    assert.deepStrictEqual([twice, waiting()], [{ [TYPO]: [wait('question', made.call, PROPOSAL.question, intoFixes)] }, { [TYPO]: [] }]);
  });

  it('its close waits once its screen draws, its door the fixes; the quick-fix is in its implementation', () => {
    dir = closable();

    assert.deepStrictEqual([waiting(), progress(dir, TYPO)], [{ [TYPO]: [wait('finish', 'finish', 'Close', intoFixes)] }, 'implementation']);
  });
});
