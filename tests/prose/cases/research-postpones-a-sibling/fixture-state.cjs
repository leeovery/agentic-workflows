'use strict';

// The harvested `search-relevance` epic with its map sequenced, and the
// synonym-handling research one sitting in: the file holds what the
// first pass turned up and the thread register carries two open
// questions. No deep dive has ever been dispatched, the triage queue is
// empty, and no discussion has been born under the name — so the topic's
// Discovery unit is the map row and the one in-progress research item.
//
// `relevance-measurement` sits beside it, fresh: a map row with nothing
// under it. That is the topic this session sends away, and with no
// roadmap anywhere on the project the horizon the user names is what
// creates one.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;
const TOPIC = 'synonym-handling';

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    h.engine('discovery-map', 'sequence', WU,
      'behavioural-ranking=1', 'synonym-handling=2', 'relevance-measurement=3');
    h.engine('commit', WU, '-m', `discovery(${WU}): sequence the map`, '--discovery');

    h.engine('topic', 'start', WU, 'research', TOPIC);
    h.write(`.workflows/${WU}/research/${TOPIC}.md`, [
      '# Research: Synonym Handling',
      '',
      'What replaces the hand-maintained synonym and misspelling list, and',
      'what it would take to run.',
      '',
      '## Starting Point',
      '',
      'What we knew going in:',
      '- The list holds roughly 1,200 hand-written pairs, edited by whoever',
      '  last fielded a complaint, and nobody trusts it.',
      '- Replace rather than clean was settled at shaping; with what is the',
      '  open question.',
      '',
      '---',
      '',
      '## The Shapes on Offer',
      '',
      'Three shapes came up. A managed expansion service takes the list off',
      'our hands and puts the upkeep on someone else — cheap to adopt, and',
      'the catalogue vocabulary is ours, not theirs, so coverage on the',
      'terms that actually fail is unknown. Deriving expansions from search',
      'behaviour — reformulation-and-click pairs — needs the behavioural',
      'signals to reach the query path, which is another topic entirely.',
      'An embedding-based expansion sits between the two and is the least',
      'explored.',
      '',
      '## Open',
      '',
      'Nothing here is settled yet. What the failing queries actually look',
      'like has not been sampled, and without that none of the three shapes',
      'can be told apart on coverage.',
      '',
    ].join('\n'));
    h.engine('research-threads', 'add', WU, TOPIC, 'failing-query-shape',
      '--question', 'What do the queries the list fails on actually look like?',
      '--origin', 'seed');
    h.engine('research-threads', 'add', WU, TOPIC, 'expansion-source',
      '--question', 'Which expansion source covers the catalogue vocabulary?',
      '--origin', 'seed');
    h.engine('commit', WU, '--topic', `research/${TOPIC}`, '-m',
      `research(${WU}/${TOPIC}): the shapes on offer`);
  },
};
