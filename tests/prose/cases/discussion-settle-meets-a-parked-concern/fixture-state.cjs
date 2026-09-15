'use strict';

// A live discussion one decision short of settled, with a rerouted
// concern already parked in its queue: both epic discussions concluded,
// then synonym-handling reopened for one late subtopic (result caching),
// and a peer session's concern delivered into the topic's triage queue
// before this sitting opens. The last decision settles the map over the
// parked concern — the moment this case pins.

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

    h.write(`.workflows/.cache/${WU}/discussion/relevance-measurement/concern-expansion-cache-invalidation.md`, [
      '### Expansion Cache Invalidation',
      '*From: relevance-measurement · discussion · 2026-01-03*',
      '',
      'The measurement topic\'s weekly report will read expansion results from',
      'the per-session cache. If cached expansions can outlive an aggregate',
      'refresh, measurements straddle two signal generations. Whether cache',
      'invalidation needs an expansion-side decision — or already falls out',
      'of the caching design — belongs to the expansion topic.',
      '',
    ].join('\n'));
    h.engine('topic', 'triage', WU, 'discussion', 'synonym-handling',
      '--concern', `.workflows/.cache/${WU}/discussion/relevance-measurement/concern-expansion-cache-invalidation.md`,
      '--slug', 'expansion-cache-invalidation',
      '-m', `discussion(${WU}/relevance-measurement): reroute concern to synonym-handling`);
  },
};
