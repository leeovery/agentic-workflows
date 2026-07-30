'use strict';

// The canonical epic mainline — `search-relevance`, a search-quality
// overhaul — as staged builders each fixture recipe composes a prefix
// of. Engine calls mirror the sequences the skill prose prescribes (the
// same sequences tests/scripts/test-pipeline-simulation.cjs replays).
//
// `create` reproduces the confirm-trigger's work-type commit and stops
// there: the log's Exploration holds the shaping conversation, the map
// is empty, and the engine-set active_session marker is left in place —
// the epic equivalent of walking away right after creation, which is an
// interrupted sketch the next discovery entry resumes.
//
// Dates are literals matching the frozen recipe clock (2026-01-01).

const WU = 'search-relevance';

function init(h) {
  h.knowledge('setup', '--keyword-only');
  h.engine('boot');
}

function create(h) {
  // Shape per workflow-discovery/references/template.md + confirm-trigger.md:
  // header, carrier sections, Exploration backfilled from the shaping,
  // Edits / Topics Identified / Conclusion left as (none).
  const log = `.workflows/${WU}/discovery/sessions/session-001.md`;
  h.write(log, [
    '# Discovery Session 001',
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
    '(empty — first session)',
    '',
    '## Exploration',
    '',
    'Search relevance across the catalogue is poor, and the shaping',
    'settled that it is several problems at once rather than one.',
    'Ranking barely uses behavioural signals — click and purchase events',
    'land in the events pipeline but nothing feeds them back into the',
    'ranker. Synonyms and misspellings are handled by a hand-maintained',
    'list nobody trusts. And there is no way to tell whether a relevance',
    'change makes results better or worse, so every tweak is decided by',
    'argument. Agreed to take the whole area on as one epic rather than',
    'patch a single piece; the parts still need exploring properly',
    'before any topics are named.',
    '',
    '## Edits',
    '',
    '(none)',
    '',
    '## Topics Identified',
    '',
    '(none)',
    '',
    '## Conclusion',
    '',
    '(none)',
    '',
  ].join('\n'));
  h.engine('workunit', 'create', WU, 'epic',
    '--description', 'Overhaul search relevance across the catalogue',
    '--session-log-file', log);
}

const TOPICS = [
  {
    name: 'behavioural-ranking',
    routing: 'discussion',
    summary: 'Close the loop from click and purchase events into the ranker.',
    description: 'Click and purchase events land in the events pipeline but nothing feeds them back into ranking. The pipeline is reliable; the work is deciding what signals feed the ranker and how.',
    brief_path: 'discovery/briefs/behavioural-ranking.md',
  },
  {
    name: 'synonym-handling',
    routing: 'research',
    summary: 'Replace the hand-maintained synonym and misspelling list.',
    description: 'Synonyms and misspellings are handled by a hand-maintained list nobody trusts. The leaning is to replace it rather than clean it, but with what is unknown.',
    brief_path: 'discovery/briefs/synonym-handling.md',
  },
  {
    name: 'relevance-measurement',
    routing: 'research',
    summary: 'How to tell whether a relevance change makes results better or worse.',
    description: 'There is no evaluation set and no metrics — every ranking tweak is decided by argument. The area the user understands least; they have never built an evaluation harness.',
    brief_path: 'discovery/briefs/relevance-measurement.md',
  },
];

function brief(title, decisions, rejected, open) {
  return [
    `# Discovery Brief — ${title}`,
    '',
    'Drawn from discovery session(s) 001.',
    '',
    '## Soft decisions',
    '',
    decisions,
    '',
    '## Rejected paths',
    '',
    rejected,
    '',
    '## Open questions',
    '',
    open,
    '',
  ].join('\n');
}

// The harvest, as confirm-and-persist lands it: the finalised log, the
// per-topic briefs, the one-batch map persist, and the session close
// that clears the active-session marker.
function harvest(h) {
  const log = `.workflows/${WU}/discovery/sessions/session-001.md`;
  h.write(log, [
    '# Discovery Session 001',
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
    '(empty — first session)',
    '',
    '## Exploration',
    '',
    'Search relevance across the catalogue is poor, and the shaping',
    'settled that it is several problems at once rather than one.',
    'Ranking barely uses behavioural signals — click and purchase events',
    'land in the events pipeline but nothing feeds them back into the',
    'ranker; the pipeline itself is reliable, so the work is choosing',
    'the signals. Synonyms and misspellings are handled by a',
    'hand-maintained list nobody trusts — replace rather than clean was',
    'the leaning, though with what is unknown. And there is no way to',
    'tell whether a relevance change makes results better or worse — no',
    'evaluation set, no metrics, every tweak decided by argument. The',
    'user has never built an evaluation harness and holds measurement as',
    'the part they understand least. The stack is Elasticsearch; two',
    'engineers own search part-time.',
    '',
    '## Edits',
    '',
    '(none)',
    '',
    '## Topics Identified',
    '',
    ...TOPICS.flatMap((t) => [
      `### ${t.name}`,
      '',
      `- Routing: ${t.routing}`,
      `- Why: ${t.summary}`,
      '',
    ]),
    '## Conclusion',
    '',
    '3 topic(s) added. Map now has 3 topics.',
    '',
  ].join('\n'));
  for (const t of TOPICS) {
    h.write(`.workflows/${WU}/${t.brief_path}`, brief(
      t.name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
      t.name === 'behavioural-ranking'
        ? 'Feed behavioural signals into ranking from the existing events pipeline — the pipeline is reliable and already captures clicks and purchases.'
        : t.name === 'synonym-handling'
          ? 'Replace the hand-maintained list rather than keep cleaning it — nobody trusts it and upkeep never ends.'
          : 'Measurement comes before tuning: without a way to score a change, every ranking tweak stays an argument.',
      t.name === 'relevance-measurement'
        ? 'Deciding by argument — rejected as the status quo that motivated the epic.'
        : '(none)',
      t.name === 'relevance-measurement'
        ? 'What a good evaluation harness looks like — the user has never built one and does not know what good is.'
        : t.name === 'synonym-handling'
          ? 'What replaces the list — unexplored.'
          : '(none)',
    ));
  }
  const topicsFile = `.workflows/.cache/${WU}/discovery/topics.json`;
  h.write(topicsFile, JSON.stringify(TOPICS, null, 2));
  h.engine('discovery-map', 'add-batch', WU, '--file', topicsFile);
  h.engine('discovery-session', 'close', WU, '-m', `discovery(${WU}): synthesise 3 new topic(s)`);
}

// Two concluded discussions carrying a seeded coherence conflict.
// behavioural-ranking deliberately decides batch-only signal ingestion —
// real-time streaming rejected, the events pipeline exposes batch
// aggregates only. synonym-handling, discussed later (rerouted from
// research), decides behaviour-driven expansion and in passing has its
// freshness rest on a live click-signal stream — the capability the
// earlier discussion settled will not exist — without citing that
// decision. The map is sequenced, so the next boot skips sequencing.
//
// The prior boot's self-healing stamped gap-analysis over the concluded
// pair (a nothing-new pass: no staging, no dismissals). No coherence
// cache exists — the analysis postdates that boot — so the next boot
// reads it stale over the two discussions.
function completeDiscussions(h) {
  h.engine('discovery-map', 'reroute', WU, 'synonym-handling', 'discussion');
  h.engine('discovery-map', 'sequence', WU,
    'behavioural-ranking=1', 'synonym-handling=2', 'relevance-measurement=3');

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
    'over-engineering — the events pipeline exposes batch aggregates',
    'only, and no live signal stream will be built.',
    '',
    '---',
    '',
    '## Summary',
    '',
    '### Key Insights',
    '1. Freshness has no consumer today — batch wins on simplicity.',
    '',
    '### Current State',
    '- Signal ingestion decided: batch nightly aggregation, no streaming.',
    '',
    '## Triage',
    '',
    '(none)',
    '',
  ].join('\n'));
  h.engine('discussion-map', 'add', WU, 'behavioural-ranking', 'signal-ingestion');
  h.engine('commit', WU, '-m', `discussion(${WU}): initialize behavioural-ranking discussion`);
  h.engine('discussion-map', 'set', WU, 'behavioural-ranking', 'signal-ingestion', 'decided');
  h.engine('topic', 'complete', WU, 'discussion', 'behavioural-ranking');
  h.engine('commit', WU, '-m', `discussion(${WU}): complete behavioural-ranking discussion`);

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
    'A managed list just moves the upkeep somewhere else. Deriving',
    'expansions from reformulation-and-click pairs kept winning on both',
    'upkeep and quality. For freshness we want expansions reacting',
    'within the session, so the expansion service reads the live',
    'click-signal stream at query time.',
    '',
    '### Decision',
    'Synonym expansion is behaviour-driven: the expansion service',
    'consumes the live click-signal stream at query time, keyed on',
    'reformulation-and-click pairs. The hand-maintained list is retired',
    'once behavioural coverage matches it.',
    '',
    '---',
    '',
    '## Summary',
    '',
    '### Key Insights',
    '1. Any curated list recreates the upkeep problem — derive',
    '   expansions from behaviour instead.',
    '',
    '### Current State',
    '- Expansion source decided: behaviour-driven, reading the live',
    '  click-signal stream.',
    '',
    '## Triage',
    '',
    '(none)',
    '',
  ].join('\n'));
  h.engine('discussion-map', 'add', WU, 'synonym-handling', 'expansion-source');
  h.engine('commit', WU, '-m', `discussion(${WU}): initialize synonym-handling discussion`);
  h.engine('discussion-map', 'set', WU, 'synonym-handling', 'expansion-source', 'decided');
  h.engine('topic', 'complete', WU, 'discussion', 'synonym-handling');
  h.engine('commit', WU, '-m', `discussion(${WU}): complete synonym-handling discussion`);

  h.write(`.workflows/${WU}/.state/discovery-gap-analysis.md`, [
    '# Discovery Gap Analysis Cache',
    '',
    '## Topics',
    '',
    '(none — the concluded discussions surfaced no new topics)',
    '',
  ].join('\n'));
  h.engine('cache', 'stamp', WU, 'gap-analysis');
  h.engine('commit', WU, '-m', `discovery(${WU}): stamp gap analysis`);
}

module.exports = { WU, TOPICS, init, create, harvest, completeDiscussions };
