'use strict';

// Frozen clock preload for fixture recipes (injected via NODE_OPTIONS
// --require). Recipes must be byte-deterministic — the same recipe always
// builds the same snapshot — but the engine stamps real times (work-unit
// `created`, agent-state rows, cache payload headers). Pinning Date in
// every recipe subprocess removes the only nondeterministic input.
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

global.Date = FrozenDate;
