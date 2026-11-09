'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a nested clone a quick-fix never touches (R18;
// leeway-engine/scripts/domain/landing.cjs, over drivers/landing/github/):
// the repositories a quick-fix reads come from its own record, so a clone
// it never committed in, whose host refuses every read — an organisation
// whose sign-on the token lacks, a repository gone, a rate limit — never
// holds it up: every verb of a fix in the project alone goes through, and
// none makes a call to that clone's host, neither gh's nor git's.
// Conformance layer: quick-fix-world.cjs's `quickFixNestedConformance` on
// GitHub's side (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, call, git, createFile } = require('../../scripts/engine-harness.cjs');
const { UNIT, SET, createFix, quickFixNestedConformance, recordFile, checklistClosed } = require('../../scripts/quick-fix-world.cjs');
const { github, calls } = require('./world.cjs');

const { as, project, landed } = quickFixNestedConformance('github', 'github-landing-quick-fix-untouched-');

/**
 * The clone at `dir`'s host made to refuse every read — its gh calls as
 * GitHub refuses one the token may not make, its git transport logged and
 * failed, the log and its ssh in `beside`, outside the project — the
 * calls' options under it, and where the transport is logged.
 * @param {string} dir @param {string} beside
 */
function unreadable(dir, beside) {
  const log = path.join(beside, 'lib-transport.log');
  const ssh = path.join(beside, 'lib-ssh');
  fs.writeFileSync(ssh, `#!/bin/sh\necho "$@" >> '${log}'\nexit 1\n`, { mode: 0o755 });
  git(dir, ['config', 'core.sshCommand', ssh]);
  return { options: { env: { ...as().env, GH_STUB_FAULT: 'refused', GH_STUB_FAULT_REPO: github(dir).repo } }, log };
}

describe('a nested clone a quick-fix never touches, its host refusing every read (R18)', () => {
  it('every verb of a fix in the project alone goes through, and none calls the clone\'s host', () => {
    const at = project();
    const before = calls(at.lib).length;
    const { options, log } = unreadable(at.lib, path.dirname(at.dir));
    createFix(at.dir, 1, SET[0].title, options);
    ok(at.dir, ['task', 'start', UNIT, '1.1'], options);
    createFile(at.dir, SET[0].file, SET[0].text);
    ok(at.dir, ['commit', '--paths', SET[0].file, '--task', UNIT, '1.1', '-m', `fix(${UNIT}): ${SET[0].title.toLowerCase()}`], options);
    ok(at.dir, ['land', 'open', UNIT, '1.1'], options);
    ok(at.dir, ['task', 'done', UNIT, '1.1'], options);
    ok(at.dir, ['quick-fix', 'record', UNIT, '1.1', '--file', recordFile(at.dir, 1, { changed: 'The flag.', why: 'It was spelt the American way.', leaves: 'Nothing.' })], options);
    checklistClosed(at.dir, options);
    const screen = call(at.dir, ['render', 'finish', UNIT], options).code;
    ok(at.dir, ['finish', 'yes', UNIT], options);

    assert.deepStrictEqual([screen, landed(at)['.'].length, landed(at).lib, calls(at.lib).length - before, fs.existsSync(log)], [0, 1, [], 0, false]);
  });
});
