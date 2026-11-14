'use strict';

// ---------------------------------------------------------------------------
// The land verbs (landing.cjs) and what has landed (task-landed.cjs) over
// histories generated from a seed, against each shipped driver in turn:
// tasks cut in a line and stacked, opened, landed by hand by every kind or
// on the host's site, given plain commits after, rewritten or merged back
// before landing or once a verb read the landing — refused, the way on
// followed — main moved on by the person's own commits, and phases landed;
// then everything still to land landed by the verbs, every refusal's way on
// followed — half of them a unit's with a branch of its own, its tasks
// landing there and the branch landed on main at finish (7.2.34, 7.2.38).
// Each history is held to a model of what each task's work is, built from
// the writes alone: main holds every task's final work once, the person's
// own kept; every task's record holds its branch's work; and no verb lands
// a commit that changes nothing. The generator, the model and the checks
// are landing-history-world.cjs's. Conformance layer. Budget: 36 s — four
// histories on each driver at the gate, each a whole phase walked from its
// cut to its last landing, half of them a unit's landed at finish besides;
// fewer would sample a driver's shapes too thinly to catch a regression
// there.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const assert = require('node:assert');
const { describe, it } = require('node:test');
const path = require('path');

const { cleanupFixture } = require('./engine-harness.cjs');
const { seeds, historyWorld, history } = require('./landing-history-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

for (const { name } of listDrivers('landing')) {
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const world = historyWorld(`landing-histories-${name}-`, side);

  describe(`landing histories on the ${name} driver: main ends holding every task's final work once and the person's own, each record its task's work, and no landing changes nothing`, () => {
    for (const seed of seeds()) {
      it(`the history of seed ${seed}`, () => {
        const at = world();
        try {
          const { steps, problems } = history(side, at, seed);
          assert.deepStrictEqual(problems, [], `seed ${seed} on ${name}:\n  ${steps.join('\n  ')}`);
        } finally {
          cleanupFixture(at);
        }
      });
    }
  });
}
