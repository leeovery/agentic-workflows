'use strict';

// ---------------------------------------------------------------------------
// Kernel: release versions held against a floor — the oldest release a
// tool must be for the engine to run on it. Mechanism only: which tool, and
// where its version is read, is the caller's.
// ---------------------------------------------------------------------------

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

module.exports = { atLeast };
