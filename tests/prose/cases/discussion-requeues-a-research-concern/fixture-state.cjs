'use strict';

// A reopened discussion holding one wrong-side concern: both epic
// discussions concluded, synonym-handling reopened for one late subtopic
// (result caching), and its discussion triage queue holds a question that
// belongs research-side — an open empirical ask about the engine's query
// pipeline, landed discussion-side by its origin session. The requeue this
// case pins is the session's repair for exactly this shape.

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

    h.write(`.workflows/.cache/${WU}/discussion/relevance-measurement/concern-query-time-expansion-hooks.md`, [
      '### Does the engine expose expansion hooks at query time?',
      '*From: relevance-measurement · discussion · 2026-07-22*',
      '',
      'Behaviour-driven expansion assumes the engine lets us inject',
      'expansions while a query is being analysed. Nobody has verified',
      'that the deployed engine\'s query-analysis chain exposes such a',
      'hook — the vendor documentation is ambiguous about whether custom',
      'analysers run per-query or only at index time, and if expansion',
      'can only happen at index time the behaviour-driven approach',
      'changes shape entirely. Settling this needs the engine\'s',
      'query-pipeline documentation read against our deployed version',
      'and a small spike proving an injected synonym actually reaches',
      'matching — exploration, not a decision.',
      '',
    ].join('\n'));
    h.engine('topic', 'triage', WU, 'discussion', 'synonym-handling',
      '--concern', `.workflows/.cache/${WU}/discussion/relevance-measurement/concern-query-time-expansion-hooks.md`,
      '--slug', 'query-time-expansion-hooks',
      '-m', `discussion(${WU}/relevance-measurement): reroute concern to synonym-handling`);
  },
};
