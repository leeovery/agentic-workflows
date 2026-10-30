'use strict';

// ---------------------------------------------------------------------------
// The git floor at boot (leeway-engine/scripts/domain/git-floor.cjs,
// domain/boot.cjs): a git on the PATH below the engine's floor, or none,
// stops boot before anything runs, with nothing written, and `render
// git-floor-stop` draws the stop; a git at the floor or above passes.
//
// Layer: verb. World: a plain temp folder, a conversation holding a
// position, and a stand-in `git` that answers `--version` or fails, reached
// through the PATH the call runs under.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, output, refuses } = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { conversationDir } = require('../../skills/leeway-engine/scripts/domain/conversation.cjs');

const folder = useTempFolder('engine-boot-git-floor-');

/**
 * A PATH holding only a `git` that runs `script`, or, with none given, no
 * `git` at all.
 * @param {string} [script]
 * @returns {{PATH: string}}
 */
function pathWith(script) {
  const bin = fs.mkdtempSync(path.join(folder(), 'bin-'));
  if (script !== undefined) fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
  return { PATH: bin };
}

/** A `git` that answers `--version` with `answer`. @param {string} answer */
const answering = (answer) => pathWith(`echo '${answer}'`);

/** Apple's stand-in for git on a Mac without the command-line tools: it runs, and fails. */
const XCRUN_SHIM = "echo 'xcrun: error: invalid active developer path (/Library/Developer/CommandLineTools), missing xcrun at: /Library/Developer/CommandLineTools/usr/bin/xcrun' >&2\nexit 1";

/**
 * Boot in an empty project under `env`, from a conversation holding a
 * position: its answer, the project left empty and the position kept, and
 * the stop's screen.
 * @param {{PATH: string}} env
 */
function stopped(env) {
  const project = fs.mkdtempSync(path.join(folder(), 'project-'));
  const session = path.basename(project);
  const position = path.join(conversationDir(session), 'position.json');
  fs.mkdirSync(path.dirname(position), { recursive: true });
  fs.writeFileSync(position, '{"name":"payments"}');
  try {
    const answer = ok(project, ['boot'], { env: { ...env, CLAUDE_CODE_SESSION_ID: session } });
    assert.deepStrictEqual(fs.readdirSync(project), [], 'the stop wrote nothing');
    assert.ok(fs.existsSync(position), 'the stop left the conversation\'s position');
    return { answer, screen: output(project, ['render', 'git-floor-stop'], { env }) };
  } finally {
    fs.rmSync(conversationDir(session), { recursive: true, force: true });
  }
}

/** The stop's screen: its title, then what boot found. @param {string} title @param {string} found */
const screen = (title, found) => [
  '=== DISPLAY: git floor stop (emit verbatim as a properties code block (```properties fence)) ===',
  `⚑ Boot stopped: ${title}`,
  '',
  '=== DISPLAY: git floor account (emit verbatim as markdown (not a code block)) ===',
  `> Leeway runs on git 2.40.0 or newer, ${found}`,
  '>',
  "> Install git 2.40.0 or newer, then start a new session in this project. git-scm.com/downloads gives the ways to get one on each system; on a Mac, Homebrew's git takes over from the one Apple's command-line tools bring.",
  '',
].join('\n');

const NONE = ['Leeway found no git to run', 'and boot found no git it could run on this machine.'];

const MEETS = /render git-floor-stop: this git meets the floor, 2\.40\.0 — nothing stopped boot/;

describe('the git floor at boot', () => {
  it('a git below the floor stops boot with nothing written — the conversation\'s position kept — and its screen names the floor, the version found and where to get one', () => {
    const { answer, screen: shown } = stopped(answering('git version 2.39.5 (Apple Git-154)'));

    assert.deepStrictEqual(answer, { ok: true, state: 'git', warnings: [] });
    assert.strictEqual(shown, screen('this git is older than Leeway needs', 'and the git on this machine is 2.39.5.'));
  });

  it('no git on the PATH stops boot too, as does one that runs and fails, as Apple\'s stand-in does without the command-line tools — the screen saying none runs', () => {
    for (const [what, env] of [['none', pathWith()], ['the xcrun stand-in', pathWith(XCRUN_SHIM)]]) {
      const { answer, screen: shown } = stopped(env);

      assert.deepStrictEqual(answer, { ok: true, state: 'git', warnings: [] }, what);
      assert.strictEqual(shown, screen(...NONE), what);
    }
  });

  it('the floor itself passes, as a build of it does, a git whose version does not read, and the git this machine runs — the stop then has nothing to draw', () => {
    for (const answer of ['git version 2.40.0', 'git version 2.40.0.windows.1', 'git version unknown']) {
      assert.match(refuses(folder(), ['render', 'git-floor-stop'], { env: answering(answer) }).error, MEETS, answer);
    }
    assert.match(refuses(folder(), ['render', 'git-floor-stop']).error, MEETS);
  });
});
