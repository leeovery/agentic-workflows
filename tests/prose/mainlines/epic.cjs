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

module.exports = { WU, TOPICS, init, create, harvest };
