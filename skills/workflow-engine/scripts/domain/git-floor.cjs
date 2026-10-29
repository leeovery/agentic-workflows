'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the oldest git the engine runs on. The landing replays a
// task's commits with `git merge-tree --merge-base`, which git 2.40 brought;
// nothing else the engine runs, or prints for the person to run, needs a
// newer one. Boot reads the version once, before anything runs git, and a
// git below the floor, or none on the PATH, stops it there.
// `render git-floor-stop` draws the stop, reading the version again.
// ---------------------------------------------------------------------------

const { spawnSync } = require('child_process');
const { gitFloorStop } = require('./projections/boot.cjs');

/** The oldest git the engine runs on. */
const GIT_FLOOR = [2, 40, 0];

/**
 * How the git on the PATH falls short of the floor: null where it meets it,
 * or answers a version that does not read, which is not judged; else the
 * version it answers, `found` null where no git runs.
 * @typedef {{found: string|null}|null} GitShortfall
 */

/**
 * The version `git --version` answers, as git prints it — `2.39.5 (Apple
 * Git-154)` reads 2.39.5, `2.40.0.windows.1` reads 2.40.0, and a release
 * without its third part reads it as 0.
 * @param {string} answer
 * @returns {number[]|null}
 */
function versionOf(answer) {
  const m = /^git version (\d+)\.(\d+)(?:\.(\d+))?/.exec(answer);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

/** @param {number[]} version @returns {boolean} */
function meetsFloor(version) {
  for (let i = 0; i < GIT_FLOOR.length; i++) {
    if (version[i] !== GIT_FLOOR[i]) return version[i] > GIT_FLOOR[i];
  }
  return true;
}

/** @returns {GitShortfall} */
function gitShortfall() {
  const res = spawnSync('git', ['--version'], { encoding: 'utf8' });
  if (res.error || res.status !== 0) return { found: null };
  const version = versionOf(res.stdout.trim());
  return version === null || meetsFloor(version) ? null : { found: version.join('.') };
}

/**
 * `render git-floor-stop`: the screen of boot's stop on the git it found.
 * @returns {string}
 */
function gitFloorStopSurface() {
  const shortfall = gitShortfall();
  if (shortfall === null) throw new Error(`render git-floor-stop: this git meets the floor, ${GIT_FLOOR.join('.')} — nothing stopped boot`);
  return gitFloorStop(GIT_FLOOR.join('.'), shortfall.found);
}

module.exports = { GIT_FLOOR, gitShortfall, gitFloorStopSurface };
