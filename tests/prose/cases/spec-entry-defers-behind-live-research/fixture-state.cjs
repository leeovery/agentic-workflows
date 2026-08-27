'use strict';

// The state that routes specification entry straight into the grouping
// analysis — two concluded discussions, a stamped gap analysis, no
// specification items anywhere — with one thing changed: the third
// topic's research is under way right now, in another session.
//
// The hold is declared rather than beaten. Heartbeats are excluded from
// every snapshot, so materialise stamps this one from the sidecar with
// a fresh mtime; it carries no identity, the legacy record's shape,
// which reads `held` from mtime alone — held for longer than any walk
// runs, and owned by nobody, so the walking session cannot mistake it
// for its own.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);

    // The live peer: a research session part-way through the topic the
    // epic's own map routed to research.
    h.engine('topic', 'start', WU, 'research', 'relevance-measurement');
    h.write(`.workflows/${WU}/research/relevance-measurement.md`, [
      '# Research: Relevance Measurement',
      '',
      '## Question',
      '',
      'What does a usable evaluation harness look like for a catalogue',
      'search of this size, and what does it cost to keep the judgements',
      'fresh?',
      '',
      '## Findings',
      '',
      'Offline evaluation over a judged query set is the common shape.',
      'Whether the judgements come from human raters or from behavioural',
      'proxies is still open, and the answer changes what the harness',
      'has to read.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `research(${WU}/relevance-measurement): first pass`,
      '--topic', 'research/relevance-measurement');

    h.write('.world-presence.json', JSON.stringify([
      { work_unit: WU, phase: 'research', topic: 'relevance-measurement' },
    ], null, 2));
  },
};
