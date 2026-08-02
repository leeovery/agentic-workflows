'use strict';

// A live discussion with an empty queue: both epic discussions concluded,
// then synonym-handling reopened for one late subtopic (result caching).
// Mid-walk, an armed substitution acts as a peer session and delivers a
// concern into this topic's queue — the world itself starts with nothing
// queued, so everything the drain surfaces arrives during the session.

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
