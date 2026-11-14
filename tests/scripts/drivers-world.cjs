'use strict';

// ---------------------------------------------------------------------------
// What the drivers' check suites share (test-engine-drivers-verbs.cjs,
// test-engine-ready-to-build-drivers.cjs): the tools the check reads,
// stood in for first on the PATH a call is given, so the machine's are
// never read — the stand-in tick (tests/drivers/tick/bin), which answers its
// version alone, and the stand-in gh with its stack extension
// (tests/drivers/github/bin) — each at its driver's floor unless the call
// says otherwise.
// ---------------------------------------------------------------------------

const path = require('path');

const DRIVERS = path.join(__dirname, '..', 'drivers');
const STAND_INS = [path.join(DRIVERS, 'tick', 'bin'), path.join(DRIVERS, 'github', 'bin')].join(':');

/**
 * A call's environment overlay with the tools stood in for, `more` over it:
 * `TICK_STUB_VERSION` or `GH_STUB_VERSION` a tool's version, and
 * `GH_STUB_NO_STACK` the stack extension missing.
 * @param {Record<string, string>} [more] @returns {Record<string, string>}
 */
const toolsEnv = (more = {}) => ({ PATH: `${STAND_INS}:${process.env.PATH}`, ...more });

module.exports = { toolsEnv };
