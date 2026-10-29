'use strict';

// ---------------------------------------------------------------------------
// The git floor at boot (workflow-engine/scripts/domain/git-floor.cjs,
// domain/boot.cjs): a git on the PATH below the engine's floor, or none,
// stops boot before anything runs, with nothing written, and `render
// git-floor-stop` draws the stop; a git at the floor or above passes.
//
// Layer: verb. World: a plain temp folder, and a stand-in `git` that answers
// `--version` alone, reached through the PATH the call runs under.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, output, refuses } = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');

const folder = useTempFolder('engine-boot-git-floor-');

/**
 * A PATH holding only a `git` that answers `--version` with `answer`, or,
 * with none given, no `git` at all.
 * @param {string} [answer]
 * @returns {{PATH: string}}
 */
function pathWith(answer) {
  const bin = fs.mkdtempSync(path.join(folder(), 'bin-'));
  if (answer !== undefined) fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh\necho '${answer}'\n`, { mode: 0o755 });
  return { PATH: bin };
}

/**
 * Boot in an empty project under `env`: its answer, the project left empty,
 * and the stop's screen.
 * @param {{PATH: string}} env
 */
function stopped(env) {
  const project = fs.mkdtempSync(path.join(folder(), 'project-'));
  const answer = ok(project, ['boot'], { env });
  assert.deepStrictEqual(fs.readdirSync(project), [], 'the stop wrote nothing');
  return { answer, screen: output(project, ['render', 'git-floor-stop'], { env }) };
}

/** The stop's screen: its title, then what boot found. @param {string} title @param {string} found */
const screen = (title, found) => [
  '=== DISPLAY: git floor stop (emit verbatim as a properties code block (```properties fence)) ===',
  `⚑ Boot stopped: ${title}`,
  '',
  '=== DISPLAY: git floor account (emit verbatim as markdown (not a code block)) ===',
  `> Leeway runs on git 2.40.0 or newer, ${found}`,
  '>',
  "> Install a newer git, then start a new session in this project. On a Mac, Homebrew's `brew install git` puts one ahead of the git that comes with Apple's command-line tools; elsewhere, your system's package manager or git-scm.com has one.",
  '',
].join('\n');

const MEETS = /render git-floor-stop: this git meets the floor, 2\.40\.0 — nothing stopped boot/;

describe('the git floor at boot', () => {
  it('a git below the floor stops boot with nothing written, and its screen names the floor, the version found and how to get a newer git', () => {
    const { answer, screen: shown } = stopped(pathWith('git version 2.39.5 (Apple Git-154)'));

    assert.deepStrictEqual(answer, { ok: true, state: 'git', warnings: [] });
    assert.strictEqual(shown, screen('this git is older than Leeway needs', 'and the git on this machine is 2.39.5.'));
  });

  it('no git on the PATH stops boot too, its screen saying none runs', () => {
    const { answer, screen: shown } = stopped(pathWith());

    assert.deepStrictEqual(answer, { ok: true, state: 'git', warnings: [] });
    assert.strictEqual(shown, screen('Leeway found no git to run', 'and boot found no git it could run on this machine.'));
  });

  it('the floor itself passes, as a build of it does, a git whose version does not read, and the git this machine runs — the stop then has nothing to draw', () => {
    for (const answer of ['git version 2.40.0', 'git version 2.40.0.windows.1', 'git version unknown']) {
      assert.match(refuses(folder(), ['render', 'git-floor-stop'], { env: pathWith(answer) }).error, MEETS, answer);
    }
    assert.match(refuses(folder(), ['render', 'git-floor-stop']).error, MEETS);
  });
});
