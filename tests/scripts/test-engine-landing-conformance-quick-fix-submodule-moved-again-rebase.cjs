'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix in a submodule the project
// nests, its pull requests in the project and the submodule both merged by
// hand, the project's first, by a rebase, then a later fix moving the
// submodule again (7.2.21, 7.2.24): the project's default branch points the
// submodule at the branch's own commit there, whose change the submodule
// landed; the close lands the later fix in the submodule, then in the
// project, its pointer set at the submodule's landing of the later fix's
// change — no re-point made, nothing refused. By a squash,
// test-engine-landing-conformance-quick-fix-submodule-moved-again-squash.cjs's.
// The case is quick-fix-submodule-repoint.cjs's (`movedAgain`); this file
// names no driver and no tool. Conformance layer: quick-fix-world.cjs's
// `quickFixNestedConformance`, built once per driver and copied for each
// test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');

const { movedAgain } = require('./quick-fix-submodule-repoint.cjs');

movedAgain('engine-landing-quick-fix-submodule-moved-again-rebase-', /rebase/, { describe, it });
