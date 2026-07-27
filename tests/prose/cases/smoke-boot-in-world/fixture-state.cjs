'use strict';

// A bare installed project: migrations applied, knowledge base set up
// keyword-only, no work units at all.

module.exports = {
  build(h) {
    h.knowledge('setup', '--keyword-only');
    h.engine('boot');
  },
};
