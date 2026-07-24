'use strict';

// The canonical empty project — a real install straight after
// /workflow-start Step 0: migrations applied (the log is the durable
// trace), knowledge set up keyword-only, boot run. No work units yet.
// Every richer fixture starts from this world's shape.

module.exports = {
  build(h) {
    h.knowledge('setup', '--keyword-only');
    h.engine('boot');
  },
};
