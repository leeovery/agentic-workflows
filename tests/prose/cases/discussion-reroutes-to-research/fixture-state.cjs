'use strict';

// A settled epic revisited: both discussions concluded, then synonym-handling
// reopened for one late subtopic (result caching). Behavioural-ranking's
// completed discussion settled batch-only signal ingestion — the ground a
// mid-session feasibility concern will be rerouted onto, research-side. No
// triage queues hold anything; the reroute this case pins originates here,
// it doesn't arrive here.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);

    h.engine('topic', 'reopen', WU, 'discussion', 'synonym-handling');
    h.engine('discussion-map', 'add', WU, 'synonym-handling', 'result-caching');
    h.engine('commit', WU, '--topic', 'discussion/synonym-handling', '-m',
      `discussion(${WU}): reopen synonym-handling for result caching`);
  },
};
