'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, its branch as the host has it
// the truth for what its pull request holds (R15): the contract every
// landing driver meets, run through the engine's verbs against each shipped
// driver in turn. The branch deleted here while its pull request is open is
// taken from the host's copy, and the close lands every fix in it; a commit
// on the branch the engine never wrote — the person's own — is kept by the
// branch cut again after a merge by hand, replayed in its place, and lands
// with the squash. A host's own — a review's suggestion, its update of the
// branch, a second clone, a head moved after it was read — are its driver's
// suites' (tests/drivers/{name}/); a fix done left off by the close's own
// cut, test-engine-landing-conformance-quick-fix-close-left-off.cjs's. A
// driver's side (tests/drivers/{name}/landing.cjs) readies the world, merges
// by hand and reads what landed where; this file names no driver and no
// tool. Conformance layer: the quick-fix of quick-fix-world.cjs
// (`quickFixConformance`), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, git, createFile, readManifest } = require('./engine-harness.cjs');
const { UNIT, DESCRIPTION, BRANCH, SET, createFix, quickFixConformance } = require('./quick-fix-world.cjs');
const { HELP, steps } = require('./quick-fix-by-hand.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const MINE = { file: 'src/mine.js', text: 'const mine = true;\n', subject: 'My own change' };

for (const { name } of listDrivers('landing')) {
  const conf = quickFixConformance(name, `engine-landing-quick-fix-host-${name}-`);
  const { side, as, project, built, landed } = conf;
  const { committed, closed } = steps(conf);
  const [[how, merge]] = Object.entries(side.byHand);

  describe(`the ${name} landing driver's quick-fix, its branch as the host has it the truth (R15)`, () => {
    it('its branch deleted here while its pull request is open: taken from the host\'s copy, the close landing every fix in it', () => {
      const at = project();
      built(at, 1);
      built(at, 2);
      git(at, ['switch', '-q', 'main']);
      git(at, ['branch', '-q', '-D', BRANCH]);
      closed(at);

      assert.deepStrictEqual([landed(at), readManifest(at, UNIT).status], [[[`fix(${UNIT}): ${DESCRIPTION}`, [SET[0].file, HELP.file]]], 'completed']);
    });

    it(`merged by hand by ${how}, then a commit of the person's own on its branch: the next start cuts the branch again keeping it, replayed in its place, and it lands with the squash`, () => {
      const at = project();
      built(at, 1);
      merge(at, BRANCH);
      createFile(at, MINE.file, MINE.text);
      git(at, ['add', MINE.file]);
      git(at, ['commit', '-q', '-m', MINE.subject]);
      const before = git(at, ['rev-parse', '--short', BRANCH]).trim();
      createFix(at, 2, HELP.title, as());
      const start = ok(at, ['task', 'start', UNIT, '1.2'], as());
      const kept = git(at, ['log', '--format=%s', `${side.defaultTip(at)}..${BRANCH}`]).trim();
      committed(at, HELP.text);
      ok(at, ['land', 'open', UNIT, '1.2'], as());
      ok(at, ['task', 'done', UNIT, '1.2'], as());
      closed(at);

      assert.deepStrictEqual([start.cut_again.map((/** @type {any} */ { repo, from, replayed }) => ({ repo, from, replayed })), kept], [[{ repo: '.', from: before, replayed: [] }], MINE.subject]);
      assert.deepStrictEqual(landed(at).at(-1), [`fix(${UNIT}): ${DESCRIPTION}`, [HELP.file, MINE.file]]);
    });
  });
}
