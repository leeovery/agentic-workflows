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
// cancel carries on in the conversation back in the product's, whose talk
// goes on in that session (the close's is the by-hand sim's), the move
// hands off into the feature's discussion as any start does, and a return
// in a new window reads the one log (8.14.11). And a quick-fix from the
// product's talk cancelled once the session closed meanwhile, its way on
// the product's entry, which opens one again; and the return forgotten
// once the start by words, the bare start or the quick-fix's move left that
// talk, and from a discussion, which the start by words leaves; one started
// at the roadmap, cancelled back there by the roadmap's entry; and the
// product's entry, after the cancel, writing the conversation's own line
// where another window wrote last.
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
const { Sim, answerGate, startUnit, startThisWork, startBare, startPick, startWith, roadmapMenu, writeTasks, finishClosed, fixTree, fixBuilt, carryOn, presenceRow } = require('./pipeline-world.cjs');

const CONTINUE = Object.freeze({ kind: 'continue' });
const INTO_THE_PRODUCT = Object.freeze({ kind: 'invoke', skill: 'ledger-discovery', args: ['none', 'none'] });

/** In the product's talk, a quick-fix settled there started and entered: the start's answer. @param {Sim} sim @param {string} wu */
function fromTheTalk(sim, wu) {
  sim.run(['enter', 'discovery', 'product']);
  const log = /** @type {string} */ (sim.sections.match(/^log: (.*)$/m)?.[1]);
  fs.appendFileSync(log, `\n## ${wu} {#${wu}}\n\nA settled fix.\n`);
  const started = startThisWork(sim, { type: 'quick-fix', name: wu, description: `Fix ${wu}.`, reason: 'Settled and small.', shaped_by: [`${path.relative(statePath(sim.dir), log)}#${wu}`] });
  sim.run(['enter', 'implementation', wu]);
  return started;
}

/** The conversation's presence row in the product's conversation, if any. @param {Sim} sim */
const productRow = (sim) => presenceRow(sim.run(['presence', 'scan', 'product']), 'discovery', 'product');

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

    assert.deepStrictEqual([cancelled.next, left, refusedOn, started.put_back], [INTO_THE_PRODUCT, ['main', false], 'main', ['src/help.js']], 'a cancelled quick-fix\'s task start is refused, the checkout and the work set aside left as they are');
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
    /** The conversation carried on by `next`, back in the product's, its entry the way on: whether that entry started a session. @param {object} next */
    const back = (next) => {
      assert.deepStrictEqual([next, carryOn(sim).position], [INTO_THE_PRODUCT, { name: 'product' }], 'the cancel puts the conversation back in the product\'s');
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

    assert.deepStrictEqual([closed, started, moved, open, read], [[null, null], false, { kind: 'invoke', skill: 'ledger-discussion-process', args: ['feature', 'grows'] }, '001', [log]]);
    assert.match(fs.readFileSync(read[0], 'utf8'), /Three tiers, the middle one leading\./);
  });

  it('a quick-fix started from the product\'s talk, its row there dropped and the session closed by another window meanwhile, cancelled: the conversation back in the product\'s, its row beaten again, and the way on its entry, which opens a session again', () => {
    sim.handOver();
    const peer = sim.session('peer-b', 1);
    fromTheTalk(sim, 'typo');
    peer.run(['enter', 'discovery', 'product']);
    sim.run(['presence', 'cleanup', sim.env.CLAUDE_CODE_SESSION_ID]);
    peer.run(['discovery-session', 'close', 'product', '-m', 'discovery(product): end session 001']);
    sim.render(['cancel-gate', 'typo'], { expect: 'content' });
    const cancelled = sim.run(answerGate(sim, 'cancel gate', '--pick', 'y').next.argv);
    const back = [carryOn(sim).position, productRow(sim)?.session_id, sim.manifest('.').product_session ?? null];
    const entered = sim.run(['enter', 'discovery', 'product']);

    assert.deepStrictEqual([cancelled.next, back], [INTO_THE_PRODUCT, [{ name: 'product' }, sim.env.CLAUDE_CODE_SESSION_ID, null]]);
    assert.deepStrictEqual([entered.started, sim.manifest('.').product_session], [true, '002'], 'its entry opens the product\'s session again');
  });

  it('a quick-fix started at the roadmap, by the type call, and cancelled: the conversation back at the roadmap, the way on its entry', () => {
    sim.handOver();
    roadmapMenu(sim);
    sim.run(['enter', 'discovery', 'product', '--type-call']);
    startThisWork(sim, { type: 'quick-fix', name: 'typo', description: 'Fix the typo.', reason: 'Settled and small.' });
    sim.run(['enter', 'implementation', 'typo']);
    sim.render(['cancel-gate', 'typo'], { expect: 'content' });
    const cancelled = sim.run(answerGate(sim, 'cancel gate', '--pick', 'y').next.argv);

    assert.deepStrictEqual([cancelled.next, carryOn(sim).position], [{ kind: 'invoke', skill: 'ledger-roadmap', args: [] }, { name: 'roadmap' }]);
  });

  it('a quick-fix started from the product\'s talk, then the start by words in the same conversation, the quick-fix picked up again and cancelled: boot left the product\'s talk, so the cancel puts the conversation back nowhere', () => {
    sim.handOver();
    fromTheTalk(sim, 'typo');
    startWith(sim, 'carry on with the typo');
    sim.run(['enter', 'implementation', 'typo']);
    sim.render(['cancel-gate', 'typo'], { expect: 'content' });
    const cancelled = sim.run(answerGate(sim, 'cancel gate', '--pick', 'y').next.argv);

    assert.deepStrictEqual([cancelled.next, carryOn(sim).position, productRow(sim)], [CONTINUE, null, undefined]);
  });

  it('a quick-fix started from the product\'s talk and moved to a feature, the handoff carried on in the same conversation: the feature\'s cancel puts the conversation back nowhere', () => {
    sim.handOver();
    fromTheTalk(sim, 'grows');
    const brief = sim.write('.ledger/.cache/grows/build/brief.md', '# grows\n\nWhat the fix showed.\n');
    sim.run(['workunit', 'move', 'grows', '--to', 'feature', '--file', sim.write('.ledger/.cache/grows/build/move.json', { description: 'Grows, as a feature.', reason: 'It needs a decision.', brief })]);
    sim.run(answerGate(sim, 'start this work', '--pick', 'y').next.argv);
    const moved = productRow(sim);
    sim.run(['enter', 'discussion', 'grows']);
    sim.render(['cancel-gate', 'grows'], { expect: 'content' });
    const cancelled = sim.run(answerGate(sim, 'cancel gate', '--pick', 'y').next.argv);

    assert.deepStrictEqual([moved, cancelled.next, carryOn(sim).position], [undefined, CONTINUE, null], 'the move leaves the product\'s talk: its row there dropped, and nothing kept to go back to');
  });

  it('a quick-fix started from the product\'s talk, a fix in flight, then the bare command in the same conversation and the cancel from manage: the conversation is no longer at the quick-fix, so the cancel puts it back nowhere', () => {
    sim.handOver();
    fromTheTalk(sim, 'typo');
    const [fix] = writeTasks(sim, 'typo', 1, [{ title: 'Spell it --colour', type: 'fix', reference: 'none', scenarios: ['Given the flag, when it is read, then it names --colour.'] }]);
    sim.run(['task', 'start', 'typo', fix]);
    sim.run(['boot']);
    sim.render(['cancel-gate', 'typo'], { expect: 'content' });
    const cancelled = sim.run(answerGate(sim, 'cancel gate', '--pick', 'y').next.argv);

    assert.deepStrictEqual([cancelled.next, carryOn(sim).position, productRow(sim)], [CONTINUE, null, undefined]);
  });

  it('a quick-fix asked for from inside a feature\'s discussion, by the start with the person\'s words and the type call, and cancelled: boot left the discussion, so the cancel lands at no place', () => {
    startUnit(sim, 'feature', 'pricing', 'Three pricing tiers');
    sim.handOver();
    sim.run(['enter', 'discussion', 'pricing']);
    startWith(sim, 'quick fix: the README spells colour wrong');
    sim.run(['enter', 'discovery', 'product', '--type-call']);
    startThisWork(sim, { type: 'quick-fix', name: 'typo', description: 'Fix the README.', reason: 'Settled and small.' });
    sim.run(['enter', 'implementation', 'typo']);
    sim.render(['cancel-gate', 'typo'], { expect: 'content' });
    const cancelled = sim.run(answerGate(sim, 'cancel gate', '--pick', 'y').next.argv);

    assert.deepStrictEqual([cancelled.next, carryOn(sim).position], [CONTINUE, null]);
  });

  it('a quick-fix started from the product\'s talk while another window talks product, cancelled: its way on the product\'s entry, which writes this conversation\'s line under the other\'s, so what it keeps next sits under its own', () => {
    sim.handOver();
    const peer = sim.session('window-b', 1);
    fromTheTalk(sim, 'typo');
    peer.run(['enter', 'discovery', 'product']);
    sim.render(['cancel-gate', 'typo'], { expect: 'content' });
    const cancelled = sim.run(answerGate(sim, 'cancel gate', '--pick', 'y').next.argv);
    sim.run(['enter', 'discovery', 'product']);
    const log = /** @type {string} */ (sim.sections.match(/^log: (.*)$/m)?.[1]);
    const entered = fs.readFileSync(log, 'utf8').trimEnd().split('\n');
    sim.run(['discovery-log', 'view', 'product', '--text', 'A keeps talking after its close.']);
    const kept = fs.readFileSync(log, 'utf8').split('\n');
    const writer = kept.slice(0, kept.indexOf('- A keeps talking after its close.')).findLast((line) => / · session \S+$/.test(line));

    assert.deepStrictEqual(cancelled.next, INTO_THE_PRODUCT);
    assert.ok(entered.some((line) => / · session window-b$/.test(line)), 'the other window\'s line stands in the log');
    assert.match(entered.at(-1) ?? '', new RegExp(` · session ${sim.env.CLAUDE_CODE_SESSION_ID}$`), 'the entry closes the log on this conversation\'s own line');
    assert.match(writer ?? '', new RegExp(` · session ${sim.env.CLAUDE_CODE_SESSION_ID}$`), 'what it keeps after its return sits under its own line, never the other window\'s');
  });
});
