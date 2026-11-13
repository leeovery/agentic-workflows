'use strict';

// ---------------------------------------------------------------------------
// The landing conformance table of a phase landed, then taking more (7.2.23),
// rebased by hand: the contract every landing driver meets, run through the
// `land` verbs against each shipped driver in turn — each of the way's rows
// (landing-again.cjs, `describeAgain`). The other ways are
// test-engine-landing-conformance-again-*.cjs's. Conformance layer: the
// landing world, the phase landed, built once per driver and copied for each
// test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');

const { describeAgain } = require('./landing-again.cjs');

describeAgain('rebased', describe, it);
