'use strict';

// One gap candidate staged and never walked. Both discussions concluded
// and the relevance-measurement research completed after the last stamp,
// so the cache reads stale; the staged block carries the artifacts the gap
// was read out of and its type, which is what the candidate's brief is
// written from. The next boot reuses the staging and walks the one
// candidate — a gap that is real and belongs to a later release, so it
// lands on the map with its brief and leaves for the roadmap in the same
// turn. The project has no roadmap yet, so the horizon is asked for in
// prose and the postpone creates the map.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);

    // A completed research file lands after the gap-analysis stamp — the
    // input set moved, so the cache reads stale on the next entry.
    h.engine('topic', 'start', WU, 'research', 'relevance-measurement');
    h.write(`.workflows/${WU}/research/relevance-measurement.md`, [
      '# Research: Relevance Measurement',
      '',
      'How to tell whether a relevance change makes results better or',
      'worse. No evaluation set and no metrics exist today.',
      '',
      '## Starting Point',
      '',
      'What we know so far:',
      '- Click and purchase events land reliably in the events pipeline,',
      '  which exposes nightly batch aggregates.',
      '- The team has never built an evaluation harness.',
      '',
      '---',
      '',
      '## Candidate Metrics',
      '',
      'NDCG@10 is the leading offline candidate — rank-sensitive, standard,',
      'comparable across runs. Interleaving win-rate answers a different',
      'question and needs live traffic.',
      '',
      '## Signal Timeliness',
      '',
      'Every metric here reads the same aggregates ranking reads, so how',
      'fresh those aggregates are shapes what a measurement even means.',
      'The pipeline\'s freshness guarantees are recorded nowhere.',
      '',
      '## Open Questions',
      '',
      '- How large must an eval query set be before per-run comparisons',
      '  are trustworthy?',
      '',
    ].join('\n'));
    h.engine('commit', WU, '--topic', 'research/relevance-measurement', '-m',
      `research(${WU}/relevance-measurement): metrics, judgments, signal timeliness`);
    h.engine('topic', 'complete', WU, 'research', 'relevance-measurement');
    h.engine('commit', WU, '--topic', 'research/relevance-measurement', '-m',
      `research(${WU}): complete relevance-measurement research`);

    // The staged candidate, as the analysis leaves it: content in the
    // staging file, the row `pending` under a `gated` mode.
    h.write(`.workflows/${WU}/.state/discovery-gap-analysis-candidates.md`, [
      '## signal-freshness-contract',
      'summary: Settle what signal freshness every consumer of the events pipeline can rely on.',
      'description: |',
      '  Behavioural ranking settled batch nightly aggregation and rejected a',
      '  live signal stream outright. Synonym handling then settled',
      '  behaviour-driven expansion resting on a live click-signal stream read',
      '  at query time. Both decisions are recorded, neither cites the other,',
      '  and the measurement research assumes the same aggregates again without',
      '  saying how fresh they are.',
      '',
      '  No topic owns the join: what freshness the events pipeline actually',
      '  offers, what each consumer is entitled to assume, and which of the two',
      '  recorded positions gives way.',
      'routing: discussion',
      'source: gap-analysis',
      'source_artifacts: behavioural-ranking.md, synonym-handling.md, relevance-measurement.md',
      'gap_type: integration',
      '',
    ].join('\n'));
    h.engine('manifest', 'set', `${WU}.discovery`,
      'analysis_staging.discovery-gap-analysis.gate_mode=gated',
      'analysis_staging.discovery-gap-analysis.candidates.signal-freshness-contract.status=pending');
    h.engine('commit', WU, '-m',
      `discovery(${WU}): stage gap analysis candidate`);
  },
};
