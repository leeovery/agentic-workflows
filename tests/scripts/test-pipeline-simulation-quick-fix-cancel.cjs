'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's quick-fix cancelled mid-fix (18.3.9, 19.5.29):
// one fix done, its pull request open, and the next holding work not
// committed; the cancel through its confirm from inside the quick-fix's
// session — what the holder had not committed set aside, its worktree
// taken apart, the pull request closed and the branch kept — and its
// receipt, carrying on in the conversation, as its close does; then
// reactivated, the held fix started again, its work put back, built and
// done, and the close landing both. The cancel's own rules are
// test-engine-landing-conformance-quick-fix-nested-cancel.cjs's. And two
// quick-fixes started from the product's talk in one conversation — one
// cancelled, one moved — each leaving the product's session open: the
// cancel carries on in the conversation, whose talk of the product goes on
// in that session (the close's is the by-hand sim's), the move hands off
// into the feature's discussion as any start does, and a return in a new
// window reads the one log (8.14.11).
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { git, statePath } = require('./engine-harness.cjs');
const { Sim, answerGate, startUnit, startThisWork, startBare, startPick, writeTasks, finishClosed, fixTree, fixBuilt } = require('./pipeline-world.cjs');

const CONTINUE = Object.freeze({ kind: 'continue' });

describe('pipeline simulation: quick-fix cancelled mid-fix', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('quick-fix: cancelled with a fix done and the next holding work not committed — the work set aside, its worktree taken apart, the person\'s checkout never moved, the receipt naming both, and on in the conversation; its task start refused while cancelled; reactivated, the work put back, the fix built, and the close landing both', () => {
    const wu = 'typo';
    startUnit(sim, 'quick-fix', wu, 'The --color flag is spelt --colour');
    sim.run(['enter', 'implementation', wu]);
    /** Fix `title` written: its task. @param {string} title */
    const written = (title) => writeTasks(sim, wu, 1, [{ title, type: 'fix', reference: 'none', scenarios: [`Given the ${title.split(' ')[2]}, when it is read, then it names --colour.`] }])[0];

    const flag = written('Spell the flag --colour');
    sim.run(['task', 'start', wu, flag]);
    fixBuilt(sim, wu, flag, ['src/flag.js'], { record: 'The flag.' });
    const help = written('Spell the help --colour');
    sim.run(['task', 'start', wu, help]);
    sim.run(['brief', 'builder', wu, help]);
    sim.write(path.join(fixTree(sim, wu), 'src/help.js'), '--colour\n');

    sim.render(['cancel-gate', wu], { expect: 'content' });
    const cancelled = sim.run(answerGate(sim, 'cancel gate', '--pick', 'y').next.argv);
    assert.match(sim.sections, /marked as cancelled/);
    const left = [git(sim.dir, ['branch', '--show-current']).trim(), fs.existsSync(fixTree(sim, wu))];
    sim.refuses(['task', 'start', wu, help], /^task start: typo is cancelled — reactivating it comes first$/);
    const refusedOn = git(sim.dir, ['branch', '--show-current']).trim();

    sim.run(['workunit', 'reactivate', wu]);
    sim.run(['enter', 'implementation', wu]);
    const started = sim.run(['task', 'start', wu, help]);
    fixBuilt(sim, wu, help, ['src/help.js'], { record: 'The help.' });
    sim.write(`.ledger/${wu}/build/log.md`, '# The fixes\n');
    finishClosed(sim, wu);
    sim.render(['finish', wu], { expect: 'content' });
    const yes = sim.run(answerGate(sim, 'finish', '--pick', 'y').next.argv);

    assert.deepStrictEqual([cancelled.next, left, refusedOn, started.put_back], [CONTINUE, ['main', false], 'main', ['src/help.js']], 'a cancelled quick-fix\'s task start is refused, the checkout and the work set aside left as they are');
    assert.deepStrictEqual([yes.landed.map((/** @type {{merged: string[]}} */ { merged }) => merged), sim.manifest(wu).status], [[[flag, help]], 'completed']);
  });

  it('two quick-fixes from the product\'s talk in one conversation — cancelled, moved — each leave its session open, the cancel carrying on with the talk in it and the move handing off into its discussion, so the talk keeps one log, and a return in a new window reads the pricing talk', () => {
    sim.handOver();
    sim.run(['enter', 'discovery', 'product']);
    const log = /** @type {string} */ (sim.sections.match(/^log: (.*)$/m)?.[1]);
    const rel = path.relative(statePath(sim.dir), log);
    fs.appendFileSync(log, '\n## Pricing {#pricing}\n\nThree tiers, the middle one leading.\n');
    /** A quick-fix the talk settled, started in this conversation and carried into its fixes: the session its yes closed. @param {string} wu */
    const fromTheTalk = (wu) => {
      fs.appendFileSync(log, `\n## ${wu} {#${wu}}\n\nA settled fix.\n`);
      const started = startThisWork(sim, { type: 'quick-fix', name: wu, description: `Fix ${wu}.`, reason: 'Settled and small.', shaped_by: [`${rel}#${wu}`] });
      sim.run(['enter', 'implementation', wu]);
      return started.product_session_closed;
    };
    /** The conversation carried on by `next`, then talking product again: whether that started a session. @param {object} next */
    const back = (next) => {
      assert.deepStrictEqual(next, CONTINUE);
      return sim.run(['enter', 'discovery', 'product']).started;
    };

    const closed = [fromTheTalk('drop-me')];
    sim.render(['cancel-gate', 'drop-me'], { expect: 'content' });
    const started = back(sim.run(answerGate(sim, 'cancel gate', '--pick', 'y').next.argv).next);

    closed.push(fromTheTalk('grows'));
    const brief = sim.write('.ledger/.cache/grows/build/brief.md', '# grows\n\nWhat the fix showed.\n');
    sim.run(['workunit', 'move', 'grows', '--to', 'feature', '--file', sim.write('.ledger/.cache/grows/build/move.json', { description: 'Grows, as a feature.', reason: 'It needs a decision.', brief })]);
    const moved = sim.run(answerGate(sim, 'start this work', '--pick', 'y').next.argv).next;
    const open = sim.manifest('.').product_session;

    sim.run(['discovery-session', 'close', 'product', '-m', 'discovery(product): end session 001']);
    startBare(sim);
    startPick(sim, 'p');
    sim.handOver();
    sim.run(['enter', 'discovery', 'product']);
    const read = [...sim.sections.matchAll(/^session log: (.*)$/gm)].map((m) => m[1]);

    assert.deepStrictEqual([closed, started, moved, open, read], [[null, null], false, { kind: 'handoff', skill: 'ledger-discussion-process', args: ['feature', 'grows'] }, '001', [log]]);
    assert.match(fs.readFileSync(read[0], 'utf8'), /Three tiers, the middle one leading\./);
  });
});
