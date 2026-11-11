'use strict';

// ---------------------------------------------------------------------------
// What each `land` verb costs in git (landing.cjs), against each shipped
// driver in turn: the commands the engine runs to open each of phase 1's
// tasks, land the phase, land it again once landed, and finish — the
// landing record's settle reusing the verb's own reads — held to the
// ceiling the driver's side names for each verb, git's own transport
// children left out, which a git release may add or drop. Conformance
// layer: the landing world (landing-world.cjs), built once per driver and
// copied for the run.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { fixtureFrom, cleanupFixture, traced } = harness;
const { UNIT, TASKS, openArgs, buildLanding, finishReady, mergeBack } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { card, total, rounding } = TASKS;

/** What git runs of its own to carry a fetch or a push, never the engine's command. */
const TRANSPORT = /^(upload-pack|receive-pack|pack-objects|unpack-objects|index-pack|rev-list --objects) /;

for (const { name } of listDrivers('landing')) {
  /** @type {{env: Record<string, string|undefined>, prepare: (dir: string) => void, gitCalls: Record<'open'|'phase'|'again'|'finish', number>}} */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const world = fixtureFrom(`engine-landing-calls-${name}-`, (dir) => {
    buildLanding(dir);
    side.prepare(dir);
  });

  describe(`the ${name} landing driver's land verbs, by the git commands each runs`, () => {
    it('opens each task, lands the phase, lands it again and finishes within the ceiling the driver names for each', () => {
      const dir = world();
      try {
        /** @type {[string, 'open'|'phase'|'again'|'finish', number][]} */
        const ran = [];
        const counted = (/** @type {string} */ call, /** @type {'open'|'phase'|'again'|'finish'} */ verb, /** @type {string[]} */ args) => {
          const { commands } = traced(() => harness.ok(dir, args, { env: side.env }));
          ran.push([call, verb, commands.filter((command) => !TRANSPORT.test(command)).length]);
        };
        counted('open 1.2', 'open', openArgs(total));
        mergeBack(dir, card.branch, total.branch);
        counted('open 1.1', 'open', openArgs(card));
        counted('open 1.3', 'open', openArgs(rounding));
        counted('phase', 'phase', ['land', 'phase', UNIT, '1']);
        counted('phase again', 'again', ['land', 'phase', UNIT, '1']);
        finishReady(dir);
        counted('finish', 'finish', ['land', 'finish', UNIT]);

        assert.deepStrictEqual(ran.filter(([, verb, count]) => count > side.gitCalls[verb]), [], `the git commands each verb ran: ${JSON.stringify(ran)}`);
      } finally {
        cleanupFixture(dir);
      }
    });
  });
}
