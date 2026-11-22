'use strict';

// ---------------------------------------------------------------------------
// Kernel: release versions read and held against a floor — the oldest
// release a tool must be for the engine to run on it. Mechanism only: which
// tool, and where its version is read, is the caller's.
// ---------------------------------------------------------------------------

/**
 * The release a text opens with, as its parts, or null where it opens with
 * none: `2.30.0`, `v2.30`, `2.40.0.windows.1` reading 2.40.0, a third part
 * absent reading as 0.
 * @param {string} text @returns {number[]|null}
 */
function releaseOf(text) {
  const m = /^v?(\d+)\.(\d+)(?:\.(\d+))?/.exec(text);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

/**
 * Whether `version` is `floor` or a later release, part by part, each part
 * a number.
 * @param {number[]} version @param {readonly number[]} floor
 * @returns {boolean}
 */
function atLeast(version, floor) {
  for (let i = 0; i < floor.length; i++) {
    if (version[i] !== floor[i]) return version[i] > floor[i];
  }
  return true;
}

module.exports = { releaseOf, atLeast };
