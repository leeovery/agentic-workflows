'use strict';

// ---------------------------------------------------------------------------
// The landing conformance table of a phase landed, then taking more (7.2.23),
// the engine squashed it: the contract every landing driver meets, run through
// the `land` verbs against each shipped driver in turn, a row for each of the
// way's rows in landing-again.cjs (`WAYS`, `ROWS`), and the merge-back check (`mergedBack`). The other ways are
// test-engine-landing-conformance-again-*.cjs's. Conformance layer: the
// landing world, the phase landed, built once per driver and copied for each
// row.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { WAYS, ROWS, AGAIN, againConformance, rowAgain, answers, mergedBack, MERGED_BACK } = require('./landing-again.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const WAY = 'engine';

for (const { name } of listDrivers('landing')) {
  const conf = againConformance(name, WAY);
  describe(AGAIN.title(name, WAY), () => {
    for (const row of WAYS[WAY].rows.map((key) => ROWS[key])) it(AGAIN.test(row), () => assert.deepStrictEqual(rowAgain(conf, row), answers(row)));
    it(AGAIN.mergedBack, () => assert.deepStrictEqual(mergedBack(conf), MERGED_BACK));
  });
}
