'use strict';

// A gap-analysis gate caught mid-walk. Both discussions concluded and the
// relevance-measurement research completed after the last stamp, so the
// cache reads stale; a prior boot staged two candidates and the session
// died before the gate walked either — both rows still `pending`,
// gate_mode `gated`. The next boot must reuse that staging rather than
// re-run the analysis, and walk straight into candidate 1.

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
      '## Judgment Collection',
      '',
      'Click-derived labels are free and plentiful; a small graded set',
      'guards regressions. A hybrid is the pattern that keeps recurring',
      'for teams this size.',
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

    // The interrupted gate's leavings: the staged candidate content plus
    // the manifest rows that make both `pending` under a `gated` mode.
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
      '',
      '## search-analytics-dashboard',
      'summary: Give merchandisers a dashboard over the relevance metrics.',
      'description: |',
      '  Both discussions and the measurement research assume somebody reads',
      '  the resulting numbers, and none of them says who or through what. A',
      '  merchandiser-facing view over the metric set is the shape the gap',
      '  suggests.',
      'routing: discussion',
      'source: gap-analysis',
      '',
    ].join('\n'));
    h.engine('manifest', 'set', `${WU}.discovery`,
      'analysis_staging.discovery-gap-analysis.gate_mode=gated',
      'analysis_staging.discovery-gap-analysis.candidates.signal-freshness-contract.status=pending',
      'analysis_staging.discovery-gap-analysis.candidates.search-analytics-dashboard.status=pending');
    h.engine('commit', WU, '-m',
      `discovery(${WU}): stage gap analysis candidates`);
  },
};
