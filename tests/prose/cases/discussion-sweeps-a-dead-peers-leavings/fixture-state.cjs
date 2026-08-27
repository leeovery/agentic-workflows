'use strict';

// Three topics of one epic, held by three different sessions.
//
// behavioural-ranking is this session's: discussed to a fully decided
// map, its document written and committed, ready to close.
//
// synonym-handling belongs to a session that died mid-write. The
// manifest carries the topic as in-progress; the document it was
// writing was never committed. That is a dead session's leavings, and
// the sweep at the conclusion is what collects them — so the file is
// declared as world dirt, held back from the world's commits and
// written after them, which is the only way a materialised world can
// carry an uncommitted file.
//
// relevance-measurement belongs to a session that is still alive: same
// shape, uncommitted document and all, plus a heartbeat. The heartbeat
// is declared rather than beaten — presence files are excluded from
// every snapshot, so materialise stamps it last with a fresh mtime. It
// carries no identity, the legacy record's shape, which reads `held`
// from mtime alone: held for far longer than a walk runs, and owned by
// nobody, so the concluding session cannot mistake it for its own.
//
// The pair is the point. Identical dirt, opposite verdicts.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);

    // --- this session's topic, decided and ready to close ---------------
    h.engine('topic', 'start', WU, 'discussion', 'behavioural-ranking');
    h.write(`.workflows/${WU}/discussion/behavioural-ranking.md`, [
      '# Discussion: Behavioural Ranking',
      '',
      '## Context',
      '',
      'Click and purchase events land in the events pipeline but nothing',
      'feeds them back into ranking. This discussion settles what signals',
      'feed the ranker and how they get there.',
      '',
      '---',
      '',
      '## Signal Ingestion',
      '',
      '### Context',
      'The events pipeline reliably captures clicks and purchases. The open',
      'question was how those signals reach ranking features.',
      '',
      '### Options Considered',
      '',
      '**Batch nightly aggregation**',
      '- Pros: simple, replayable, fits the existing warehouse jobs',
      '- Cons: signals lag up to a day',
      '',
      '**Real-time streaming**',
      '- Pros: fresh signals',
      '- Cons: new infrastructure and operational burden nobody has asked for',
      '',
      '### Journey',
      'We started assuming fresher is better, then worked through what any',
      'consumer actually does with sub-day freshness — nothing today. A',
      'streaming layer would be new infrastructure for a benefit nobody',
      'could name, so we rejected it as over-engineering.',
      '',
      '### Decision',
      'Signal ingestion is a batch nightly aggregation job from the events',
      'pipeline into ranking features. Real-time streaming is rejected as',
      'over-engineering.',
      '',
      '---',
      '',
      '## Signal Weighting',
      '',
      '### Context',
      'Clicks are plentiful and noisy; purchases are scarce and decisive.',
      'The question was how much each is worth to the ranker.',
      '',
      '### Journey',
      'Weighting the two equally lets a curiosity click count as much as a',
      'sale. Dropping clicks entirely leaves the long tail with no signal',
      'at all. A purchase carrying materially more weight than a click',
      'keeps both, without letting browsing behaviour dominate.',
      '',
      '### Decision',
      'A purchase weighs ten times a click. Both decay over a rolling',
      'ninety-day window, so a product that stops selling stops ranking on',
      'last year\'s sales.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Key Insights',
      '1. Freshness has no consumer today — batch wins on simplicity.',
      '2. Purchases and clicks are different evidence, not different',
      '   volumes of the same evidence.',
      '',
      '### Current State',
      '- Signal ingestion decided: batch nightly aggregation, no streaming.',
      '- Signal weighting decided: purchases at ten times clicks, ninety-day decay.',
      '',
      '## Triage',
      '',
      '(none)',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, 'behavioural-ranking', 'signal-ingestion');
    h.engine('discussion-map', 'add', WU, 'behavioural-ranking', 'signal-weighting');
    h.engine('discussion-map', 'set', WU, 'behavioural-ranking', 'signal-ingestion', 'decided');
    h.engine('discussion-map', 'set', WU, 'behavioural-ranking', 'signal-weighting', 'decided');
    h.engine('commit', WU, '-m', `discussion(${WU}/behavioural-ranking): decide ingestion and weighting`,
      '--topic', 'discussion/behavioural-ranking');

    // --- the dead peer, mid-write ----------------------------------------
    h.engine('topic', 'start', WU, 'discussion', 'synonym-handling');
    h.write(`.workflows/${WU}/discussion/synonym-handling.md`, [
      '# Discussion: Synonym Handling',
      '',
      '## Context',
      '',
      'The hand-maintained synonym and misspelling list is untrusted, and',
      'replace-rather-than-clean was settled at shaping. This discussion',
      'settles what replaces it.',
      '',
      '---',
      '',
      '## Expansion Source',
      '',
      '### Context',
      'If the list goes, something has to produce expansions at query time.',
      '',
      '### Options Considered',
      '',
      '**Curated replacement list (managed service)**',
      '- Pros: known shape, quick to adopt',
      '- Cons: recreates the upkeep problem that killed the current list',
      '',
      '**Behaviour-driven expansion**',
      '- Pros: learns from what users actually click after reformulating',
      '- Cons: needs behavioural signals available to the expansion service',
      '',
      '### Journey',
      '',
      '## Summary',
      '',
      '### Current State',
      '- Expansion source exploring.',
      '',
      '## Triage',
      '',
      '(none)',
      '',
    ].join('\n'));
    h.engine('discussion-map', 'add', WU, 'synonym-handling', 'expansion-source');
    h.engine('discussion-map', 'set', WU, 'synonym-handling', 'expansion-source', 'exploring');

    // --- the live peer, mid-write ----------------------------------------
    // This one committed at its first cadence and has kept writing since,
    // so its dirt is a modification of a tracked file — the shape a live
    // session actually leaves, and the shape that names its own path in
    // `git status` rather than collapsing to an untracked directory.
    const RESEARCH = `.workflows/${WU}/research/relevance-measurement.md`;
    const researchCommitted = [
      '# Research: Relevance Measurement',
      '',
      '## Question',
      '',
      'What does a usable evaluation harness look like for a catalogue',
      'search of this size, and what does it cost to keep the judgements',
      'fresh?',
      '',
    ].join('\n');
    h.engine('topic', 'start', WU, 'research', 'relevance-measurement');
    h.write(RESEARCH, researchCommitted);
    h.engine('commit', WU, '-m', `research(${WU}/relevance-measurement): open the question`,
      '--topic', 'research/relevance-measurement');
    h.write(RESEARCH, [
      researchCommitted,
      '## Findings',
      '',
      'Offline evaluation over a judged query set is the common shape.',
      'Whether the judgements come from human raters or from behavioural',
      'proxies is still open, and the answer changes what the harness has',
      'to read.',
      '',
    ].join('\n'));

    // The topic registrations commit; the two documents above do not.
    h.engine('commit', WU, '-m', `workflow(${WU}): register the peer topics`);

    h.write('.world-dirt.json', JSON.stringify([
      `.workflows/${WU}/discussion/synonym-handling.md`,
      { path: RESEARCH, committed: researchCommitted },
    ], null, 2));
    h.write('.world-presence.json', JSON.stringify([
      { work_unit: WU, phase: 'research', topic: 'relevance-measurement' },
    ], null, 2));
  },
};
