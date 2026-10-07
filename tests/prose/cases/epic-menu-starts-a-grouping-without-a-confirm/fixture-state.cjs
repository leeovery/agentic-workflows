'use strict';

// Both discussions concluded and the grouping analysis reconciled into one
// proposed grouping over the pair, first in the build order. No
// specification has started, so the grouping's start takes nothing in: the
// epic menu's own start row shows everything the start does.

const e = require('../../mainlines/epic.cjs');
const WU = e.WU;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);

    h.engine('manifest', 'set', `${WU}.specification.search-signals`,
      'status=proposed',
      'sources.behavioural-ranking.status=pending',
      'sources.synonym-handling.status=pending');
    h.engine('build-order', 'sequence', WU, 'search-signals=1');
    h.write(`.workflows/${WU}/.state/discussion-consolidation-analysis.md`, [
      '# Discussion Consolidation Analysis',
      '',
      '## Recommended Groupings',
      '',
      '### Search Signals',
      '- **behavioural-ranking**: settles the signal ingestion the ranker consumes',
      '- **synonym-handling**: settles the behaviour-driven expansion fed by the same signals',
      '',
      '**Coupling**: both read click and purchase behaviour from the events pipeline',
      '',
      '## Analysis Notes',
      '(none)',
      '',
    ].join('\n'));
    h.engine('manifest', 'set', `${WU}.discussion`,
      'analysis_cache.checksum=fixture-stub', 'analysis_cache.generated=2026-01-01T00:00:00.000Z');
    h.engine('commit', WU, '-m', `spec(${WU}): grouping analysis`);
  },
};
