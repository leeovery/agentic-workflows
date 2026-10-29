'use strict';

// ---------------------------------------------------------------------------
// The local landing driver under the person's own git config, hostile to it
// (landing-world.cjs, `HOSTILE`): what the landing pins (landing-git.cjs,
// `PINNED`) holds where the remedy table's rows never reach it. A stack is
// read by its own commits where the person signs them and every log shows
// signatures; the landing and a replay are signed with the person's key, as
// their own commits are, and one git cannot sign is refused in git's words;
// a replay keeps a message that is not ASCII, recorded as UTF-8;
// it follows renames, however many, stops where a folder the task moved
// gains a file, where both sides changed one line, and where line endings
// alone differ; and a remedy's rebase
// keeps a landing that changes nothing. Git layer: the landing world with
// tasks 1.1 and 2.1 opened, built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { ok, git } = require('./engine-harness.cjs');
const {
  TASKS, openArgs, cutTask, commitFiles, landedOn, refusedMoving, followRemedy, personState, signatures, short, way, moveStep, rebaseSteps, strayRefusal: stray,
} = require('./landing-world.cjs');
const { READY } = require('./landing-remedies.cjs');

const { card } = TASKS;
const STATE = personState('hostile', 'engine-land-config-', READY);

const PHASE_ONE = 'feat/pay-phase-1';
const PHASE_FOUR = 'feat/pay-phase-4';
const CARD_LANDING = 'feat(pay): Add card\n\nTask: pay-1-1\n';
const MERGE_FOUR = ['land', 'phase', 'pay', '4'];

/**
 * A world whose main checkout is off the default branch, so a test moves
 * that branch by its ref, with task 4.1 cut from it carrying `files` less
 * `removed`, opened, and the default branch then given `after` — the
 * person's config hostile from then on.
 * @param {string} title @param {Record<string, string>} files @param {Record<string, string>} after
 * @param {{before?: Record<string, string>, removed?: string[]}} [opts] what the default branch holds first, and what the task removes
 */
function replaying(title, files, after, { before = {}, removed = [] } = {}) {
  const dir = STATE.project();
  git(dir, ['checkout', '-q', '-b', 'wip']);
  if (Object.keys(before).length > 0) commitFiles(dir, 'main', 'main', before);
  ok(dir, openArgs(cutTask(dir, '4.1', 'fix', title, 'main', files, { removed })));
  commitFiles(dir, 'main', 'main', after);
  STATE.apply(dir);
  return dir;
}

/** The refusal of phase 4's task conflicting with the default branch at `paths`. @param {string} dir @param {string} paths */
const conflicting = (dir, paths) => `land: task 4.1 conflicts with main at ${paths}, so nothing moved — `
  + way(dir, null, PHASE_FOUR, rebaseSteps(dir, PHASE_FOUR, 'main', `bring ${PHASE_FOUR} up to date with main`));

/** Five lines of a file, each naming it. @param {string} name */
const lines = (name) => ['one', 'two', 'three', 'four', 'five'].map((n) => `${name} ${n}\n`).join('');

describe('land: under the person\'s config, hostile to it', () => {
  it('reads a commit the person signed at the top of a phase\'s branch, every log showing signatures, by its own sha and subject', () => {
    const dir = STATE.project();
    STATE.apply(dir);
    const tree = git(dir, ['rev-parse', `${commitFiles(dir, 'tidy', PHASE_ONE, { 'tidy.txt': 'tidy\n' })}^{tree}`]).trim();
    const top = git(dir, ['commit-tree', '-S', tree, '-p', PHASE_ONE, '-m', 'my signed tidy']).trim();
    git(dir, ['update-ref', `refs/heads/${PHASE_ONE}`, top]);
    assert.match(git(dir, ['cat-file', 'commit', top]), /^gpgsig /m);
    const refusal = stray(PHASE_ONE, 1, top, 'my signed tidy', way(dir, null, PHASE_ONE, moveStep(PHASE_ONE, `${short(top)}^`, `take ${short(top)} off ${PHASE_ONE}`)));
    assert.strictEqual(refusedMoving(dir, ['land', 'chain', 'pay', '1.1']), refusal);
    followRemedy(dir, refusal);
    assert.deepStrictEqual(ok(dir, ['land', 'chain', 'pay', '1.1']).stack, ['1.1']);
  });

  it('keeps a landing that changes nothing where its stack is rebased off a commit below it', () => {
    const dir = STATE.project();
    ok(dir, openArgs(cutTask(dir, '1.4', 'feat', 'Keep it', card.branch, {})));
    const below = commitFiles(dir, PHASE_ONE, 'main', { 'tidy.txt': 'tidy\n' }, { message: 'my tidy' });
    commitFiles(dir, PHASE_ONE, below, card.files, { message: CARD_LANDING });
    commitFiles(dir, PHASE_ONE, PHASE_ONE, {}, { message: 'feat(pay): Keep it\n\nTask: pay-1-4\n' });
    STATE.apply(dir);
    const off = rebaseSteps(dir, PHASE_ONE, `--onto ${short(below)}^ ${short(below)}`, `take ${short(below)} off ${PHASE_ONE}`);
    const refusal = stray(PHASE_ONE, 1, below, 'my tidy', way(dir, null, PHASE_ONE, off));
    assert.strictEqual(refusedMoving(dir, ['land', 'chain', 'pay', '1.4']), refusal);
    followRemedy(dir, refusal);
    assert.deepStrictEqual(ok(dir, ['land', 'chain', 'pay', '1.4']).stack, ['1.1', '1.4']);
  });

  it('signs the landing an open makes and the commit a replay makes with the person\'s key, as their own git commit would', () => {
    const dir = STATE.project();
    git(dir, ['checkout', '-q', '-b', 'wip']);
    STATE.apply(dir);
    const landing = ok(dir, openArgs(cutTask(dir, '4.1', 'fix', 'Sign it', 'main', { 'signed.txt': 'signed\n' }))).commit;
    commitFiles(dir, 'main', 'main', { 'other.txt': 'other\n' });
    const replayed = ok(dir, MERGE_FOUR).commit;
    assert.notStrictEqual(replayed, landing);
    assert.deepStrictEqual(signatures(dir, [landing, replayed]), ['G', 'G']);
  });

  it('refuses a landing and a replay git cannot sign, in git\'s own words, naming the commit, and moves nothing', () => {
    const dir = replaying('Sign it', { 'signed.txt': 'signed\n' }, { 'other.txt': 'other\n' });
    git(dir, ['config', 'user.signingKey', path.join(dir, '.git', 'no key')]);
    const cannot = (what, then) => new RegExp(`^land: ${what} could not be committed \\(git commit-tree failed: .*no key.*\\), so nothing moved — clear what git names and ${then}$`, 's');
    assert.match(refusedMoving(dir, MERGE_FOUR), cannot('task 4\\.1\'s replay onto main', 'land again'));
    assert.match(refusedMoving(dir, openArgs(cutTask(dir, '5.1', 'fix', 'Sign it too', 'main', { 'too.txt': 'too\n' }))), cannot('task 5\\.1\'s landing on feat/pay-phase-5', 'open the task again'));
  });

  it('replays a landing whose message is not ASCII as it reads, recorded as UTF-8', () => {
    const dir = replaying('Zahlung für Café', { 'cafe.txt': 'café\n' }, { 'other.txt': 'other\n' });
    ok(dir, MERGE_FOUR);
    assert.strictEqual(landedOn(dir, 'main').at(-1)?.subject, 'fix(pay): Zahlung für Café');
    assert.doesNotMatch(git(dir, ['cat-file', 'commit', 'main']), /^encoding /m);
  });

  it('replays a task that renames and edits two files onto a default branch that edited one, following both', () => {
    const before = { 'ledger.txt': lines('ledger'), 'notes.txt': lines('note') };
    const renamed = { 'books/accounts.txt': `${lines('ledger')}more\n`, 'books/remarks.txt': `${lines('note')}more\n` };
    const dir = replaying('Rename the books', renamed, { 'ledger.txt': `first\n${lines('ledger')}` }, { before, removed: ['ledger.txt', 'notes.txt'] });
    ok(dir, MERGE_FOUR);
    assert.strictEqual(git(dir, ['show', 'main:books/accounts.txt']), `first\n${lines('ledger')}more\n`);
  });

  it('stops where a folder the task moved gains a file on the default branch, as git\'s own merge does', () => {
    const dir = replaying('Move lib', { 'src/a.txt': 'a\n' }, { 'lib/b.txt': 'b\n' }, { before: { 'lib/a.txt': 'a\n' }, removed: ['lib/a.txt'] });
    assert.strictEqual(refusedMoving(dir, MERGE_FOUR), conflicting(dir, 'src/b.txt'));
  });

  it('stops where the task and the default branch changed one line, as git\'s own merge does, whatever the person\'s merge.default', () => {
    const dir = replaying('Edit two', { 'two.txt': 'one\nTASK\nthree\n' }, { 'two.txt': 'one\nMAIN\nthree\n' }, { before: { 'two.txt': 'one\ntwo\nthree\n' } });
    assert.strictEqual(refusedMoving(dir, MERGE_FOUR), conflicting(dir, 'two.txt'));
  });

  it('stops where the default branch changed a file\'s line endings alone and the task edited it, as git\'s own merge does', () => {
    const before = { 'eol.txt': 'one\r\ntwo\r\nthree\r\n' };
    const dir = replaying('Edit a line', { 'eol.txt': 'one\r\nTWO\r\nthree\r\n' }, { 'eol.txt': 'one\ntwo\nthree\n' }, { before });
    assert.strictEqual(refusedMoving(dir, MERGE_FOUR), conflicting(dir, 'eol.txt'));
  });
});
