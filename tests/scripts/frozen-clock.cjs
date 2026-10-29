'use strict';

// The frozen clock: every Date the engine makes in this realm is one fixed
// instant, and `Date.now()` answers it, so a stamp the engine writes — a
// unit's `created`, a ledger entry's `at`, a gate's time — is known before
// the call, never computed from today. A module of its own, requiring
// nothing: a spawned engine loads it through NODE_OPTIONS `--require`
// before its own entry (the prose harness's `fake-clock-preload.cjs`).
//
// Never around a call that waits on a lock or reads a file's age: the
// deadline it counts to never comes, and every file is from the future.

const FROZEN_MS = 1767225600000;

/** The frozen instant, as the engine stamps it to the millisecond. */
const FROZEN_AT = new Date(FROZEN_MS).toISOString();

const RealDate = Date;

class FrozenDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(FROZEN_MS);
    else super(...args);
  }

  static now() {
    return FROZEN_MS;
  }
}

/** Freeze the calling realm's clock: answers the thaw. @returns {() => void} */
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

module.exports = { FROZEN_MS, FROZEN_AT, freeze, withFrozenClock };
