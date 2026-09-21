'use strict';

// The frozen clock as a preload, for the processes a recipe spawns: injected
// through NODE_OPTIONS --require, so it runs before the child's own entry and
// every Date the child stamps is the fixed one. A preload has nobody to hand
// an undo to, so it freezes and stays frozen for the child's life.

require('./fake-clock.cjs').freeze();
