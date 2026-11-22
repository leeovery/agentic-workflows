'use strict';

// ---------------------------------------------------------------------------
// The landing conformance table of a phase landed, then taking more (7.2.23),
// the engine squashed it: the contract every landing driver meets, run
// through the `land` verbs against each shipped driver in turn — its record,
// each of the way's rows, and its tasks' branches moved after it
// (landing-again.cjs, `describeAgain`). The other ways are
// test-engine-landing-conformance-again-*.cjs's. Conformance layer: the
// landing world, the phase landed, built once per driver and copied for each
// test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');

const { describeAgain } = require('./landing-again.cjs');

describeAgain('engine', describe, it);
