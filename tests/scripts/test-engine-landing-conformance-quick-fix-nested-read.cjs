'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a nested clone its record alone
// names (R18): the contract every landing driver meets, run through the
// engine's verbs against each shipped driver in turn. The door records the
// clone in the unit's state, on the state branch, before it commits there —
// a commit git then refuses there leaves it recorded — and a fix committed
// in the clone, its branch there gone before it opened, so neither the
// branch here nor the host holds it, is read by the record alone: its done
// refused naming its commit to make again through the door, and its close
// refused, as a fix holding work — never taken for a fix with no work,
// closed as met. A branch of the quick-fix's name holding no fix's work is
// test-engine-landing-conformance-quick-fix-nested-read-own.cjs's; a second
// clone of the project, -project-clone's. A driver's side
// (tests/drivers/{name}/landing.cjs) readies each repository and reads what
// landed where; this file names no driver and no tool. Conformance layer:
// quick-fix-world.cjs's `quickFixNestedConformance`, built once per driver
// and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, refuses, git, createFile } = require('./engine-harness.cjs');
const { UNIT, BRANCH, SET, createFix, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');
const { STATE_BRANCH } = require('../../skills/leeway-engine/scripts/domain/state-worktree.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

/** The nested repositories the unit's record names, as the state branch holds it. @param {string} dir the project */
const recorded = (dir) => JSON.parse(git(dir, ['show', `${STATE_BRANCH}:${UNIT}/manifest.json`])).fixes.repos;

for (const { name } of listDrivers('landing')) {
  const { as, project, gone } = quickFixNestedConformance(name, `engine-landing-quick-fix-nested-read-${name}-`);

  describe(`the ${name} landing driver's quick-fix, a nested clone its record alone names (R18)`, () => {
    it('the door records the clone on the state branch before it commits there, once: a commit git refuses there leaves it recorded, and the commit made again never names it twice', () => {
      const at = project();
      createFix(at.dir, 1, SET[0].title, as());
      ok(at.dir, ['task', 'start', UNIT, '1.1'], as());
      const hook = path.join(git(at.lib, ['rev-parse', '--absolute-git-dir']).trim(), 'hooks', 'pre-commit');
      fs.mkdirSync(path.dirname(hook), { recursive: true });
      fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
      createFile(at.dir, 'lib/lib.txt', 'lib --colour\n');
      const commit = ['commit', '--paths', 'lib/lib.txt', '--task', UNIT, '1.1', '-m', `fix(${UNIT}): spell the lib --colour`];
      refuses(at.dir, commit, as());
      const refused = [recorded(at.dir), git(at.lib, ['rev-list', '--count', `${NESTED.lib.into}..${BRANCH}`]).trim()];
      fs.rmSync(hook);
      ok(at.dir, commit, as());

      assert.deepStrictEqual([refused, recorded(at.dir)], [[['lib'], '0'], ['lib']]);
    });

    it('a fix committed in the clone, its branch gone there before it opened, has its done refused naming its commit to make again, and its close refused as holding work', () => {
      const at = project();
      createFix(at.dir, 1, SET[0].title, as());
      ok(at.dir, ['task', 'start', UNIT, '1.1'], as());
      createFile(at.dir, 'lib/lib.txt', 'lib --colour\n');
      ok(at.dir, ['commit', '--paths', 'lib/lib.txt', '--task', UNIT, '1.1', '-m', `fix(${UNIT}): spell the lib --colour`], as());
      const own = git(at.lib, ['rev-parse', '--short', BRANCH]).trim();
      gone(at.lib, NESTED.lib.into);

      const remade = `\`git cherry-pick --no-commit ${own}\`, settling any conflict and ending the pick with \`git cherry-pick --quit\`, which keeps its change, then \`engine commit --paths <file>… --task ${UNIT} 1.1 -m "<message>"\``;
      assert.deepStrictEqual([recorded(at.dir), refuses(at.dir, ['task', 'done', UNIT, '1.1'], as()).error, refuses(at.dir, ['task', 'close', UNIT, '1.1', '--reason', 'Met.'], as()).error], [
        ['lib'],
        `task done: task 1.1 of ${UNIT}'s commit ${own} is not on ${BRANCH} in lib — make its change again there through the door: ${remade}`,
        `task close: task 1.1 of ${UNIT} holds work of its own — it lands as it is with ${UNIT}'s pull request, done once it is in it, and its change is given up as a landed change is, by a fix of its own whose commit through the door reverts it: task create ${UNIT} 1 --file <task.md>`,
      ]);
    });
  });
}
