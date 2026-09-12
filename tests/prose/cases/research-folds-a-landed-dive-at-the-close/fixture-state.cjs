'use strict';

// The harvested epic with the relevance-measurement research near its
// end and one deep dive landed but never folded: the slice-regression
// thread is still digging, its report sits pending in the store after the
// sitting that dispatched it ended. The brief's harness question is
// learned, the user's label-freshness question open, a human-raters idea
// parked with its reason. The triage queue is empty; no experiment exists.
// The user comes back only to conclude — the close must fold what landed
// before it reads the in-flight gate.

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

// The agent's report, in its definition's contract. The brief asked one
// question, so Answers carries A1; Opened carries one question the topic
// will carry and one number a decision rests on, named as the measurement
// it would take — at the close, both ride the register into Open Threads.
function report() {
  return [
    '# Deep Dive: How do search evaluation harnesses handle a change that lifts the aggregate metric while a query slice regresses?',
    '',
    '## Brief',
    '',
    'The relevance-measurement research has NDCG@10 over click-derived',
    'judgments as its working metric and noticed that the aggregate can',
    'climb while long-tail product searches get worse. The brief asked',
    'whether harnesses with public code or documentation hold such a',
    'change back or weigh it, and what a declared query slice looks like.',
    '',
    '## Answers',
    '',
    '### A1: Do harnesses hold a slice-regressing change back, or weigh the loss against the gain?',
    '',
    'Three of the four surveyed hold it back. Each declares its query slices',
    'in a config file — `slices.yaml` in two of them — and a `guard_slices()`',
    'step in the evaluation job raises `SliceRegression` when any declared',
    'slice drops more than a tolerance (0.005 NDCG in the defaults) against',
    'the baseline run; the promotion job treats the exception as a failed',
    'gate. The fourth weighs: `slice_weights` in its metrics table multiplies',
    'the tail slice\'s delta by 3.0 before it is summed into the headline',
    'number, so a large enough gain elsewhere still carries the change. All',
    'four size a slice with a minimum query count before it counts, and',
    'rebuild slice membership from the query log on a schedule (nightly in',
    'three, weekly in one) rather than declaring queries by hand.',
    '',
    '## Material',
    '',
    'The hold-back pattern: the evaluation job runs the candidate ranker',
    'and the baseline over the same judged query set, computes the metric',
    'per declared slice, and fails the run when any slice\'s delta is below',
    '-tolerance. The weighted pattern: per-slice deltas are multiplied by a',
    'declared weight and summed; the sign of the sum decides. Slice',
    'declaration: a name, a membership rule (a query-frequency band, or a',
    'category), a minimum size below which the slice reports no verdict.',
    'Rebuild cadence is a scheduled job over the query log; two of the',
    'four version the resulting membership so a verdict can be replayed.',
    '',
    '## Opened',
    '',
    '- How large must a declared tail group be before its verdicts are not',
    '  noise — the surveyed floors range from 200 to 2,000 queries.',
    '- Whether the shop\'s own query log holds a tail worth declaring: count',
    '  the distinct queries with fewer than five impressions over ninety',
    '  days against the total — a measurement, and it settles whether a',
    '  tail slice exists to guard.',
    '',
    '## Limitations',
    '',
    'Only harnesses with public code or documentation were surveyed; the',
    'weighting factor and tolerances are the projects\' defaults, not',
    'measured on this catalogue.',
    '',
    '## Sources',
    '',
    '- https://example.com/rank-eval/docs/slices — slice declaration and the guard step',
    '- https://example.com/tail-aware-eval — the weighted alternative',
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
    h.engine('research-threads', 'set', WU, TOPIC, 'evaluation-harness', 'learned');
    h.engine('research-threads', 'set', WU, TOPIC, 'offline-judges', 'parked',
      '--note', 'no budget for human raters this year');

    // The dive, driven through the store's real lifecycle: dispatch
    // allocates deep-dive-001-tail-regressions in flight and the thread
    // goes digging (the sitting's last commit carries that); the agent's
    // report lands after the sitting ended; a scan promotes the row to
    // pending. Nothing has folded it.
    const dispatched = JSON.parse(h.engine('agent', 'dispatch', WU, 'research', TOPIC,
      '--kind', 'deep-dive', '--label', 'tail-regressions'));
    h.engine('research-threads', 'set', WU, TOPIC, 'tail-regressions', 'digging');
    h.engine('commit', WU, '--topic', `research/${TOPIC}`, '-m',
      `research(${WU}/${TOPIC}): candidate metrics, judgment collection, human raters parked`);
    h.write(dispatched.file, report());
    h.engine('agent', 'scan', WU, 'research', TOPIC);
  },
};
