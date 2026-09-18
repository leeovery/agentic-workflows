'use strict';

// The harvested `search-relevance` epic with its map sequenced, and the
// behavioural-ranking discussion two sittings in: one subtopic decided
// and written up, a second still being explored. Nothing downstream
// exists — no specification groups the discussion, no experiment is
// open, no rerouted concern is parked — so the topic's Discovery unit is
// one discussion item and the map row above it.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;
const TOPIC = 'behavioural-ranking';

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    h.engine('discovery-map', 'sequence', WU,
      'behavioural-ranking=1', 'synonym-handling=2', 'relevance-measurement=3');
    h.engine('commit', WU, '-m', `discovery(${WU}): sequence the map`, '--discovery');

    h.engine('topic', 'start', WU, 'discussion', TOPIC);
    h.write(`.workflows/${WU}/discussion/${TOPIC}.md`, [
      '# Discussion: Behavioural Ranking',
      '',
      '## Context',
      '',
      'Click and purchase events land in the events pipeline but nothing',
      'feeds them back into ranking. This discussion settles which signals',
      'feed the ranker and how they get there.',
      '',
      '---',
      '',
      '## Signal Set',
      '',
      '### Context',
      'Which behavioural events are worth feeding the ranker at all.',
      '',
      '### Options Considered',
      '',
      '**Clicks alone**',
      '- Pros: the densest signal, available for every result page',
      '- Cons: rewards a tempting title over a satisfying one',
      '',
      '**Clicks weighted by purchase**',
      '- Pros: a click that ends in a purchase is the outcome we want',
      '- Cons: sparse on the long tail, where relevance is worst',
      '',
      '### Journey',
      'Clicks alone kept surfacing the same failure — a result people open',
      'and abandon reads as a good result. Weighting by purchase fixes that',
      'where the data is dense and leaves the tail on clicks, which is no',
      'worse than today.',
      '',
      '### Decision',
      'The ranker consumes clicks weighted by purchase, falling back to',
      'unweighted clicks where purchase volume is too thin to weight.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Current State',
      '- Signal set decided — clicks weighted by purchase, clicks alone on the tail.',
      '- Refresh cadence still open — how often the ranking features are',
      '  rebuilt from the pipeline, and what staleness costs.',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, TOPIC, 'signal-set');
    h.engine('discussion-map', 'add', WU, TOPIC, 'refresh-cadence');
    h.engine('discussion-map', 'set', WU, TOPIC, 'signal-set', 'decided');
    h.engine('discussion-map', 'set', WU, TOPIC, 'refresh-cadence', 'exploring');
    h.engine('commit', WU, '--topic', `discussion/${TOPIC}`, '-m',
      `discussion(${WU}/${TOPIC}): decided the signal set`);
  },
};
