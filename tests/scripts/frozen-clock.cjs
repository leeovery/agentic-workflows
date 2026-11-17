'use strict';

// The frozen clock: every Date the engine makes in this realm is one fixed
// instant, and `Date.now()` answers it, so a stamp the engine writes — a
// unit's `created`, a ledger entry's `at`, a gate's time — is known before
// the call, never computed from today.
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

/**
 * Run `fn` with the clock frozen, and leave the realm's own clock as it was.
 * @template T @param {() => T} fn @returns {T}
 */
function withFrozenClock(fn) {
  const previous = global.Date;
  global.Date = FrozenDate;
  try {
    return fn();
  } finally {
    global.Date = previous;
  }
}

module.exports = { FROZEN_MS, FROZEN_AT, withFrozenClock };
