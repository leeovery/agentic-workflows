'use strict';

// Frozen clock for fixture recipes. Recipes must be byte-deterministic — the
// same recipe always builds the same snapshot — but the engine stamps real
// times (work-unit `created`, agent-state rows, cache payload headers).
// Pinning Date over a recipe's engine calls removes the only
// nondeterministic input.
//
// Two ways in, because a recipe's calls run two ways. `withFrozenClock`
// pins it around an in-process call (the engine, which the harness calls
// directly); `fake-clock-preload.cjs` pins it for a spawned one (the
// knowledge CLI, reached through NODE_OPTIONS --require).
//
// Worlds materialised for live walks do NOT use this: walker runs are
// real sessions and never byte-compared.

const FIXED_MS = 1767225600000; // 2026-01-01T00:00:00.000Z

const RealDate = Date;

class FrozenDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) {
      super(FIXED_MS);
    } else {
      super(...args);
    }
  }

  static now() {
    return FIXED_MS;
  }
}

/** Freeze the calling realm's clock; answers the undo. @returns {() => void} */
function freeze() {
  const previous = global.Date;
  global.Date = FrozenDate;
  return () => { global.Date = previous; };
}

/**
 * Run `fn` with the clock frozen, and leave the realm's own clock as it was.
 * @template T @param {() => T} fn @returns {T}
 */
function withFrozenClock(fn) {
  const thaw = freeze();
  try {
    return fn();
  } finally {
    thaw();
  }
}

module.exports = { FIXED_MS, freeze, withFrozenClock };
