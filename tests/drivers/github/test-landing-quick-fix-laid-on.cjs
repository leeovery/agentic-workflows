'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver's part of the landing conformance suite's
// quick-fix, a later fix in flight when the fix below is merged by hand
// (quick-fix-laid-on.cjs, `laidOnInFlight`): its days run for this driver
// alone, each driver's in a suite of its own. Conformance layer: the
// quick-fix of quick-fix-world.cjs (`quickFixConformance`), built once and
// copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const test = require('node:test');
const { laidOnInFlight } = require('../../scripts/quick-fix-laid-on.cjs');

laidOnInFlight(test, 'github', ['a merge commit on GitHub', 'a squash on GitHub']);
