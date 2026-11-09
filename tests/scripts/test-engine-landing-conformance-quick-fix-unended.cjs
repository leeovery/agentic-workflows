'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, its pull request landed only
// once each fix has ended (R11): the contract every landing driver meets,
// run through the engine's verbs against each shipped driver in turn. `land
// phase` and `land finish` land a quick-fix only once each of its tasks is
// done or closed, refused as its close refuses, naming each that is
// neither and the way on; nothing lands. Once each has ended and the close
// stands, `land phase` lands the pull request: a fix that reverts the one
// before it, its own commit on the one branch, leaves that fix read as
// landed still, its commit in the pull request merged, though its change
// is gone — the close then drawn saying the fixes have landed, and the
// fix's opening refused as done. The
// fixes' landing as one pull request is
// test-engine-landing-conformance-quick-fix.cjs's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies the world and reads what
// landed where; this file names no driver and no tool. Conformance layer:
// the quick-fix of quick-fix-world.cjs (`quickFixConformance`), built once
// per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, refuses, git, output, sectionOf, readManifest } = require('./engine-harness.cjs');
const { UNIT, BRANCH, SET, createFix, fixDone, guardedGit, checklistClosed, quickFixConformance } = require('./quick-fix-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const BACK = 'Put the flag back';

for (const { name } of listDrivers('landing')) {
  const { side, as, project, changed, built, landed, record } = quickFixConformance(name, `engine-landing-quick-fix-unended-${name}-`);

  describe(`the ${name} landing driver's quick-fix, its pull request landed only once each fix has ended (R11)`, () => {
    it('refuses it landed, its phase or whole, while a fix is neither done nor closed, naming each, and lands nothing', () => {
      const at = project();
      built(at, 1);
      changed(at, 2);
      changed(at, 3);
      const phase = refuses(at, ['land', 'phase', UNIT, '1'], as()).error;
      ok(at, ['land', 'open', UNIT, '1.3'], as());
      const finish = refuses(at, ['land', 'finish', UNIT], as()).error;

      const unended = `land: ${UNIT} closes once each of its fixes has ended — 1.2 is in progress, 1.3 is in progress: each is done once it is committed, in ${UNIT}'s pull request and passed by its pair, or closed with its reason`;
      assert.deepStrictEqual([phase, finish, landed(at)], [unended, unended, []]);
    });

    it('lands it once each has ended, a fix reverting the one before it on the one branch: that fix read as landed still, its commit in the pull request merged — the close drawn saying the fixes have landed, its opening refused as done', () => {
      const at = project();
      built(at, 1);
      const first = git(at, ['rev-parse', BRANCH]).trim();
      createFix(at, 2, BACK, as());
      ok(at, ['task', 'start', UNIT, '1.2'], as());
      guardedGit(at, ['revert', '--no-commit', first], as());
      guardedGit(at, ['revert', '--quit'], as());
      ok(at, ['commit', '--paths', SET[0].file, '--task', UNIT, '1.2', '-m', `fix(${UNIT}): put the flag back`], as());
      ok(at, ['land', 'open', UNIT, '1.2'], as());
      fixDone(at, '1.2', as());
      record(at, 1);
      record(at, 2);
      checklistClosed(at, as());
      ok(at, ['land', 'phase', UNIT, '1'], as());
      const menu = sectionOf(output(at, ['render', 'finish', UNIT], as()), 'MENU: finish');
      const opening = refuses(at, ['land', 'open', UNIT, '1.1'], as()).error;
      ok(at, ['finish', 'yes', UNIT], as());

      assert.match(menu, /\*\*`y\/yes`\*\* {4}→ Close it — its fixes have landed, so mark it complete\n/);
      assert.deepStrictEqual([opening, readManifest(at, UNIT).status, git(side.on(at), ['show', `main:${SET[0].file}`])], [
        `land: task 1.1 of ${UNIT} has landed, and is done — nothing of it is left to open`, 'completed', 'const flag = \'color\';\n',
      ]);
    });
  });
}
