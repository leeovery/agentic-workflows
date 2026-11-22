'use strict';

// ---------------------------------------------------------------------------
// A task changed after its landing landed again over its tip at that
// landing (task-landed.cjs, `landingBase`, R29), through `land phase`,
// against each shipped driver in turn — its branch given plain commits on
// that tip, the one shape read after a landing: just its change since
// lands, what it takes back of its own work among it — its file deleted,
// gone from the default branch; a line it added rewritten, landed with no
// conflict — the record's tip moved to its branch's; a task landed by hand
// and changed before any verb recorded it lands over the tip that landed,
// its landing recorded first. Landed by hand by a squash or a merge commit,
// never opened, then changed, and opened while another task of its phase
// stands opened and not landed, its change is laid from that landing onto
// the phase's tip, never its branch's whole tree, and the phase lands both
// tasks' work (S1). A branch rewritten or merged into past its landing is
// refused, test-engine-landing-conformance-record-rewritten.cjs's and
// -merged-past.cjs's; one behind it, -behind.cjs's; one moved with no
// change of its own, test-engine-land-local-record-moved.cjs's.
// Conformance layer: the landing world (landing-world.cjs), built once per
// driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { git, tip, fixtureFrom, cleanupFixture, readManifest } = harness;
const { UNIT, TASKS, openArgs, own, commitFiles, buildLanding } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/ledger-engine/scripts/domain/drivers.cjs');

const { card, total } = TASKS;
const PHASE = ['land', 'phase', UNIT, '1'];

for (const { name } of listDrivers('landing')) {
  /**
   * @type {{
   *   env: Record<string, string|undefined>, prepare: (dir: string) => void, on: (dir: string) => string,
   *   holds: (dir: string) => string[], byHand: Record<string, (dir: string, branch: string) => void>,
   *   squashedHere: (dir: string, branch: string) => void, mergedHere: (dir: string, branch: string) => void,
   * }}
   */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const as = { env: side.env };
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, as);
  const world = fixtureFrom(`engine-landing-record-changed-${name}-`, (dir) => {
    buildLanding(dir);
    side.prepare(dir);
  });
  /** @type {string|null} */
  let dir = null;
  afterEach(() => {
    if (dir !== null) cleanupFixture(dir);
    dir = null;
  });
  /** Card's landing record. @param {string} at */
  const cardRecord = (at) => readManifest(at, UNIT).landings[`${UNIT}-1-1`]['.'];
  /** Card opened and its phase landed by the engine, a world's copy. */
  const landedCard = () => {
    const at = (dir = world());
    ok(at, openArgs(card));
    ok(at, ['land', 'phase', UNIT, '1']);
    return at;
  };
  /** The default branch's card.txt, null where it holds none. @param {string} at */
  const cardOnMain = (at) => (side.holds(at).includes('card.txt') ? git(side.on(at), ['show', 'main:card.txt']) : null);
  /** What land phase 1 answers, read after it: what it merged, what it landed empty, card.txt on the default branch, and whether the record's tip is card's branch's. @param {string} at */
  const landedAgain = (at) => {
    const answer = own(ok(at, ['land', 'phase', UNIT, '1']));
    return [answer.merged, answer.landed_empty ?? [], cardOnMain(at), cardRecord(at).tip === tip(at, card.branch)];
  };

  /** The ways a person lands card's branch by hand in their terminal, pushed where there is a host. @type {Record<string, (dir: string, branch: string) => void>} */
  const BY_HAND = { 'a squash': side.squashedHere, 'a merge commit': side.mergedHere };

  describe(`the ${name} landing driver's task changed after its landing, landed again over its tip then (R29)`, () => {
    it('its file deleted on its branch after its landing: land phase lands the deletion, nothing landed empty, the record\'s tip moved to its branch\'s', () => {
      const at = landedCard();
      commitFiles(at, card.branch, card.branch, {}, { removed: ['card.txt'] });

      assert.deepStrictEqual(landedAgain(at), [['1.1'], [], null, true]);
    });

    it('a line it added rewritten on its branch after its landing: land phase lands the line with no conflict', () => {
      const at = landedCard();
      commitFiles(at, card.branch, card.branch, { 'card.txt': 'a card\n' });

      assert.deepStrictEqual(landedAgain(at), [['1.1'], [], 'a card\n', true]);
    });

    it('landed by hand, then a line it added rewritten before any verb recorded it: land phase records that landing first and lands the line over the tip that landed', () => {
      const at = (dir = world());
      ok(at, openArgs(card));
      Object.values(side.byHand)[0](at, card.branch);
      const landing = tip(at, 'main');
      commitFiles(at, card.branch, card.branch, { 'card.txt': 'a card\n' });

      assert.deepStrictEqual([...landedAgain(at), cardRecord(at).first === landing], [['1.1'], [], 'a card\n', true, true]);
    });

    for (const [how, land] of Object.entries(BY_HAND)) {
      it(`landed by ${how} by hand, never opened, then changed, and opened while 1.2 stands opened and not landed: land phase lands both tasks' work, the record the engine's, and a second answers already (S1)`, () => {
        const at = (dir = world());
        ok(at, openArgs(total));
        land(at, card.branch);
        commitFiles(at, card.branch, card.branch, { 'fix.txt': 'fix\n' });
        ok(at, openArgs(card));
        ok(at, PHASE);
        const work = ['card.txt', 'fix.txt', 'total.txt'];

        assert.deepStrictEqual([work.filter((file) => side.holds(at).includes(file)), cardRecord(at).by, ok(at, PHASE).already], [work, 'engine', true]);
      });
    }
  });
}
