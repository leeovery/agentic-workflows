'use strict';

// The harvested epic with the relevance-measurement research run to its
// end and the register holding a mix: the brief's harness question and
// the slice-regression thread both learned, the user's label-freshness
// question still open, and a human-raters idea parked with its reason.
// No deep dive is in flight and the store is empty; the triage queue is
// empty; no experiment exists for the topic. Open is a fine way to
// conclude — this is the world the conclude gate hands off.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;
const TOPIC = 'relevance-measurement';

function researchFile() {
  return [
    '# Research: Relevance Measurement',
    '',
    'How to tell whether a relevance change makes results better or worse',
    '— there is no evaluation set and no metric, so every ranking tweak is',
    'decided by argument. Measurement comes before tuning.',
    '',
    '## Starting Point',
    '',
    'What we knew going in:',
    '- No evaluation set and no metrics; every ranking change is argued',
    '  rather than scored.',
    '- Measurement before tuning was settled at shaping — without a way to',
    '  score a change, nothing else on the map can be judged.',
    '- The user has never built an evaluation harness and holds this as',
    '  the part they understand least.',
    '- The stack is Elasticsearch; two engineers own search part-time.',
    '',
    '---',
    '',
    '## Candidate Metrics',
    '',
    'Three offline metrics were weighed against what the shop can actually',
    'collect. Precision@k is the easiest to explain and the flattest: it',
    'says how many of the top results are relevant and nothing about their',
    'order. MRR rewards getting one right answer to the top, which fits a',
    'shopper typing a product name and misreads a shopper browsing, where',
    'several results are equally good. NDCG@10 grades the whole first page',
    'by position and takes graded judgments, which is what click data',
    'yields. NDCG@10 is the leading candidate; the other two stay here as',
    'the simpler fallbacks if graded judgments turn out too thin to trust.',
    '',
    '## Judgment Collection',
    '',
    'Nobody is going to hand-label a catalogue of four hundred thousand',
    'items. Judgments come from the clicks and purchases already in the',
    'events pipeline: a purchase after a search is a strong positive for',
    'that result, a click a weak one, a skip past a shown result a weak',
    'negative. Position bias is the known hazard — the top result gets',
    'clicked because it is on top — so judgments are normalised by',
    'position before they are used. This is the working position, not a',
    'decision: it is what the harness would be built on unless something',
    'better turns up.',
    '',
    '## Per-Slice Regressions',
    '',
    'An aggregate metric can climb while a slice of searches gets worse: a',
    'ranking change that lifts the popular searches and drops the rare',
    'product searches would score as an improvement on NDCG@10 over the',
    'whole query log while a real group of shoppers sees worse pages.',
    '',
    'Harnesses elsewhere handle it two ways. Most hold a change back when',
    'any declared group of searches drops past a small allowance — the',
    'check runs in the evaluation job before a ranking change is promoted,',
    'and the group is declared with a minimum size and rebuilt on a',
    'schedule from the query log. One weighs instead: a loss on the rare',
    'searches counts more heavily, but a large enough gain elsewhere still',
    'carries the change. Which of the two the shop wants is a decision,',
    'not a finding, and is left for the discussion; either way the harness',
    'needs a declared tail group, sized so its verdicts are not noise.',
    '',
    '## Human Raters',
    '',
    'A small panel of human raters scoring a fixed query set was',
    'considered as a check on click-derived judgments — the one way to',
    'catch a systematic bias in the clicks themselves. It needs a budget',
    'line the shop does not have this year. Set aside, not rejected.',
    '',
    '## Label Freshness',
    '',
    'Click-derived judgments age: a product that was the right answer last',
    'season may be discontinued, repriced, or outranked by a newer line.',
    'How often the judgments need refreshing before they mislead is open;',
    'nothing in the surveyed harnesses settles it, since none of them',
    'derives judgments at all.',
    '',
  ].join('\n');
}

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);

    h.engine('manifest', 'set', `${WU}.discovery.${TOPIC}`, 'brief_incorporated', 'true');
    h.engine('topic', 'start', WU, 'research', TOPIC);
    h.write(`.workflows/${WU}/research/${TOPIC}.md`, researchFile());
    h.engine('research-threads', 'add', WU, TOPIC, 'evaluation-harness',
      '--question', 'What does a good evaluation harness look like for this catalogue?',
      '--origin', 'brief');
    h.engine('research-threads', 'add', WU, TOPIC, 'tail-regressions',
      '--question', 'How do search evaluation harnesses handle a change that lifts the aggregate metric while a query slice regresses?',
      '--origin', 'conversation');
    h.engine('research-threads', 'add', WU, TOPIC, 'label-freshness',
      '--question', 'How often do click-derived judgments need refreshing before they mislead?',
      '--origin', 'user');
    h.engine('research-threads', 'add', WU, TOPIC, 'offline-judges',
      '--question', 'Would a small panel of human raters catch a bias the click-derived judgments share?',
      '--origin', 'conversation');
    h.engine('research-threads', 'set', WU, TOPIC,
      'evaluation-harness=learned', 'tail-regressions=learned');
    h.engine('research-threads', 'set', WU, TOPIC, 'offline-judges', 'parked',
      '--note', 'no budget for human raters this year');
    h.engine('commit', WU, '--topic', `research/${TOPIC}`, '-m',
      `research(${WU}/${TOPIC}): slice regressions learned, human raters parked`);
  },
};
