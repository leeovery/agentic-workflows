'use strict';

// ---------------------------------------------------------------------------
// A task changed after its landing, landed again with its phase's stack
// (R29, R30), against each shipped driver in turn. Fast-forwarded by hand,
// then changed and opened after another task: `land phase` lands each
// task's change once, a commit each, never again as one that changes
// nothing — the stack never fast-forwarded over a changed task's change,
// which lands alone. Landed by a merge commit by hand while another task
// stands opened, then its file rewritten and opened on that task: the
// phase lands the rewrite — the pull requests below it brought up to the
// default branch its change was laid on. Fast-forwarded by hand, changed
// and opened, then given another commit here, not pushed: another task
// opened after it is refused until its branch holds that task's branch as
// it stands here, the chain's tip the phase lands, then opens, and the
// phase lands both tasks' work. A task cut from another's branch, its
// landing judged by its own change (S3), is
// test-engine-landing-conformance-record-own-judged.cjs's. Conformance
// layer: the landing world (landing-world.cjs), built once per driver and
// copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { git, call, fixtureFrom, cleanupFixture } = harness;
const { UNIT, TASKS, openArgs, own, commitFiles, mergeBack, buildLanding } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { card, total } = TASKS;
const PHASE = ['land', 'phase', UNIT, '1'];

for (const { name } of listDrivers('landing')) {
  /**
   * @type {{
   *   env: Record<string, string|undefined>, prepare: (dir: string) => void, on: (dir: string) => string, holds: (dir: string) => string[],
   *   forwardedHere: (dir: string, branch: string) => void, mergedHere: (dir: string, branch: string) => void,
   *   pulled: (dir: string) => void, defaultTip: (dir: string) => string,
   * }}
   */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const as = { env: side.env };
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, as);
  const world = fixtureFrom(`engine-landing-record-changed-stack-${name}-`, (dir) => {
    buildLanding(dir);
    side.prepare(dir);
  });
  /** @type {string|null} */
  let dir = null;
  afterEach(() => {
    if (dir !== null) cleanupFixture(dir);
    dir = null;
  });
  /** Card fast-forwarded by hand and fix.txt then added on its branch, then `first` — main merged back into each — opened and card, a world's copy. @param {...{shown: string, type: string, title: string, branch: string}} first */
  const changedCard = (...first) => {
    const at = (dir = world());
    side.forwardedHere(at, card.branch);
    commitFiles(at, card.branch, card.branch, { 'fix.txt': 'fix\n' });
    for (const task of first) mergeBack(at, task.branch, 'main');
    for (const task of [...first, card]) ok(at, openArgs(task));
    return at;
  };
  /** The commits the default branch gained since `from`, oldest first, each by whether it changes anything. @param {string} at @param {string} from */
  const gained = (at, from) => git(side.on(at), ['log', '--reverse', '--first-parent', '--format=%T %P', `${from}..main`]).split('\n').filter(Boolean)
    .map((line) => {
      const [tree, parent] = line.split(' ');
      return tree !== git(side.on(at), ['rev-parse', `${parent}^{tree}`]).trim();
    });

  describe(`the ${name} landing driver's task changed after its landing, landed again with its phase's stack`, () => {
    it('fast-forwarded by hand, then changed, and opened after 1.2: land phase lands each task\'s change once, a commit each, nothing landed empty', () => {
      const at = changedCard(total);
      const from = side.defaultTip(at);
      const answer = own(ok(at, PHASE));

      assert.deepStrictEqual([[...answer.merged].sort(), answer.landed_empty ?? [], gained(at, from), ['fix.txt', 'total.txt'].filter((file) => side.holds(at).includes(file))], [
        ['1.1', '1.2'], [], [true, true], ['fix.txt', 'total.txt'],
      ]);
    });

    it('landed by a merge commit by hand while 1.2 stands opened, then its card rewritten and opened: land phase lands the card as rewritten, 1.2\'s work with it', () => {
      const at = (dir = world());
      ok(at, openArgs(total));
      side.mergedHere(at, card.branch);
      commitFiles(at, card.branch, card.branch, { 'card.txt': 'a card\n' });
      ok(at, openArgs(card));
      ok(at, PHASE);
      side.pulled(at);

      assert.deepStrictEqual([git(side.on(at), ['show', 'main:card.txt']), side.holds(at).includes('total.txt')], ['a card\n', true]);
    });

    it('fast-forwarded by hand, changed and opened, then given another commit here: 1.2 opened after it is refused until it holds 1.1\'s branch as it stands here, then opens, and the phase lands both tasks\' work', () => {
      const at = changedCard();
      commitFiles(at, card.branch, card.branch, { 'fix.txt': 'fix, again\n' });
      const refused = call(at, openArgs(total), as);
      const onto = /merge it back onto (\S+) first/.exec(JSON.parse(refused.stderr.trim()).error)?.[1];
      git(at, ['switch', '-q', total.branch]);
      git(at, ['merge', '-q', '--no-edit', /** @type {string} */ (onto)]);
      git(at, ['switch', '-q', 'main']);
      ok(at, openArgs(total));
      ok(at, PHASE);
      side.pulled(at);

      assert.deepStrictEqual([refused.code, ['card.txt', 'fix.txt', 'total.txt'].filter((file) => side.holds(at).includes(file)), git(side.on(at), ['show', 'main:fix.txt'])], [
        1, ['card.txt', 'fix.txt', 'total.txt'], 'fix, again\n',
      ]);
    });
  });
}
