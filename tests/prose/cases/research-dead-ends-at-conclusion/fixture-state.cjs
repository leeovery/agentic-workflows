'use strict';

// A second discovery session added one more topic to the harvested map —
// vector-search-migration, research-routed — and its research then ran to
// the end. The file's own finding is that the answer is no and that nothing
// under this topic's name is left for anyone to choose: the dead end the
// conclude gate exists to offer. Nothing else on the map has moved.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;
const TOPIC = 'vector-search-migration';

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);

    // Session 002 — one topic named and harvested, same shape as the first.
    const draft = `.workflows/.cache/${WU}/discovery/session-draft.md`;
    h.write(draft, [
      '# Discovery Session {NNN}',
      '',
      'Date: 2026-01-01',
      `Work unit: ${WU}`,
      '',
      '## Description (as of session)',
      '',
      'Overhaul search relevance across the catalogue.',
      '',
      '## Seed',
      '',
      '(none)',
      '',
      '## Imports',
      '',
      '(none)',
      '',
      '## Map State at Start',
      '',
      '3 topics: behavioural-ranking, synonym-handling, relevance-measurement.',
      '',
      '## Exploration',
      '',
      'Came back with one more question the first session never reached:',
      'whether the recall problem is worth answering by moving retrieval off',
      'the lexical index onto embeddings altogether, rather than by any of',
      'the three topics already on the map. Nobody in the room knew what a',
      'vector index would cost to run at this catalogue size or who would',
      'own keeping the embeddings current, so it goes on the map as its own',
      'research question rather than as an assumption inside ranking.',
      '',
      '## Edits',
      '',
      '(none)',
      '',
      '## Topics Identified',
      '',
      `### ${TOPIC}`,
      '',
      '- Routing: research',
      '- Why: Whether retrieval should move off the lexical index onto embeddings.',
      '',
      '## Conclusion',
      '',
      '1 topic(s) added. Map now has 4 topics.',
      '',
    ].join('\n'));
    h.engine('discovery-session', 'open', WU, '--session-log-file', draft);

    h.write(`.workflows/${WU}/discovery/briefs/${TOPIC}.md`, [
      '# Discovery Brief — Vector Search Migration',
      '',
      'Drawn from discovery session(s) 002.',
      '',
      '## Soft decisions',
      '',
      'Answer the question on its own before letting it shape ranking — an',
      'embeddings assumption buried inside behavioural ranking would be',
      'decided by nobody.',
      '',
      '## Rejected paths',
      '',
      '(none)',
      '',
      '## Open questions',
      '',
      'What a vector index costs to run at this catalogue size, and who',
      'would own keeping embeddings current.',
      '',
    ].join('\n'));

    const topicsFile = `.workflows/.cache/${WU}/discovery/topics-002.json`;
    h.write(topicsFile, JSON.stringify([{
      name: TOPIC,
      routing: 'research',
      summary: 'Whether retrieval should move off the lexical index onto embeddings.',
      description: 'The recall complaints could be answered by replacing lexical retrieval with an embedding index rather than by tuning what exists. Nobody knows what that costs to run at this catalogue size, or who would keep the embeddings current.',
      brief_path: `discovery/briefs/${TOPIC}.md`,
    }], null, 2));
    h.engine('discovery-map', 'add-batch', WU, '--file', topicsFile);
    h.engine('discovery-session', 'close', WU, '-m',
      `discovery(${WU}): synthesise 1 new topic(s)`);

    // The research ran to the end. Its own finding is the dead end.
    h.engine('topic', 'start', WU, 'research', TOPIC);
    h.write(`.workflows/${WU}/research/${TOPIC}.md`, [
      '# Research: Vector Search Migration',
      '',
      'Whether relevance is better served by replacing lexical retrieval',
      'with an embedding index than by tuning the Elasticsearch stack that',
      'exists.',
      '',
      '## Starting Point',
      '',
      'What we knew going in:',
      '- The catalogue is roughly 400k items, served from a three-node',
      '  Elasticsearch cluster two engineers own part-time.',
      '- Recall complaints are real, but nobody had traced them to the',
      '  retrieval model rather than to the query side.',
      '',
      '---',
      '',
      '## Cost Envelope',
      '',
      'Three managed vector services were priced against the catalogue at',
      'current query volume. All three land between six and nine times the',
      'monthly cost of the entire existing search cluster, and the shape is',
      'the same in each: the price is driven by keeping the whole index',
      'resident, which a catalogue this size cannot amortise. Quotes are',
      'from published pricing pages, sized at 400k vectors and the last',
      'quarter of query volume.',
      '',
      'Self-hosting removes the licence line and replaces it with an',
      'embedding-refresh pipeline: every catalogue edit has to re-embed and',
      'reindex, which is a new always-on job with its own failure modes.',
      'Two part-time owners is the whole search team, and no one on it has',
      'run a model-serving path in production.',
      '',
      '## What Actually Motivated the Question',
      '',
      'Working back through the recall complaints, none of the sampled',
      'failures are cases a dense retriever answers. They are query-side:',
      'the search term and the catalogue term are different words for the',
      'same thing. That is not a retrieval-model gap.',
      '',
      '## Conclusion',
      '',
      'The answer is no, and it is not a close call. The cost is an order',
      'of magnitude away from anything this catalogue can justify, the',
      'operational shape needs a capability the team does not have, and the',
      'problem that prompted the question is not the problem this would',
      'solve. There is no version of this worth building at the current',
      'size, and nothing here that would be chosen differently by weighing',
      'options — the question is answered, not opened.',
      '',
      'What is worth keeping is the sizing itself: if the catalogue or the',
      'team changes shape by an order of magnitude, the arithmetic above is',
      'the arithmetic to redo.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '--topic', `research/${TOPIC}`, '-m',
      `research(${WU}/${TOPIC}): cost envelope, operational fit, and the answer`);
  },
};
