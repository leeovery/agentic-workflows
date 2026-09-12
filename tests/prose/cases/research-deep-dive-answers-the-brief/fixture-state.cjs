'use strict';

// The harvested epic with the relevance-measurement research mid-flight
// and a deep dive landed. The register holds the brief's question
// (learned — the file answers it), the slice-regression thread the dive
// was dispatched on (digging), and the user's label-freshness question
// (open). The dive's report sits on disk at the store's content path and
// the store lists the row as pending: landed, never folded — the shape
// the first iteration of a resumed session meets. The report is written
// in code on purpose — function names, files, a snippet — so what the
// session says to the user and what it leaves in the record are both
// checkable against it.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;
const TOPIC = 'relevance-measurement';
const SLUG = 'tail-regressions';
const QUESTION = 'How do search evaluation harnesses handle a change that lifts the aggregate metric while a query slice regresses?';

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
    'whole query log while a real group of shoppers sees worse pages. How',
    'evaluation harnesses elsewhere handle that — whether a slice',
    'regression holds a change back, and how a slice is defined and kept',
    'current — is open.',
    '',
    '## Label Freshness',
    '',
    'Click-derived judgments age: a product that was the right answer last',
    'season may be discontinued, repriced, or outranked by a newer line.',
    'How often the judgments need refreshing before they mislead is open.',
    '',
  ].join('\n');
}

// The agent's report, in its definition's contract: pure markdown, Brief,
// Answers (the brief asked two questions), Material, Opened, Limitations,
// Sources. The Answers are written in code — the altitude test — and the
// Opened list carries one question the topic will carry and one number a
// decision rests on, named as the measurement it would take.
function report() {
  return [
    `# Deep Dive: ${QUESTION}`,
    '',
    '## Brief',
    '',
    'The relevance-measurement research has NDCG@10 over click-derived',
    'judgments as its working metric and noticed that the aggregate can',
    'climb while long-tail product searches get worse. The brief asked how',
    'evaluation harnesses with public code or documentation handle a change',
    'that lifts the aggregate while a query slice regresses — whether the',
    'release is held on the slice and how that is expressed, and how a',
    'slice is defined and kept current as the catalogue changes. A survey',
    'of four harnesses; nothing was run.',
    '',
    '## Answers',
    '',
    '### A1: Do harnesses hold a release on a slice regression, and how is the hold expressed?',
    '',
    'Three of the four hold; the fourth weights. In es-rank-eval the hold',
    'is a per-slice floor in `rank_eval/guards.py`:',
    '',
    '    def assert_slice_floor(run: Run, metric: str = "ndcg@10",',
    '                           slices: list[str] = SLICES,',
    '                           tolerance: float = 0.005) -> None:',
    '        for s in slices:',
    '            drop = run.baseline[s][metric] - run.candidate[s][metric]',
    '            if drop > tolerance:',
    '                raise SliceRegression(slice=s, drop=drop)',
    '',
    '`SliceRegression` propagates out of the `rank-eval-guard` step of',
    '`ci/evaluate.yml`, so the job exits non-zero and the candidate ranking',
    'config is never promoted. trec-eval-ci reaches the same outcome',
    'differently: `trec_eval -q` emits per-query scores, `slice_floor.py`',
    'groups them by `topics/slices.json` and exits 1 when any slice lands',
    'below `baseline - TOLERANCE`. Vespa\'s evaluation notebook calls',
    '`evaluate_slices(run, fail_on_regression=True)`, which raises rather',
    'than returns when a slice regresses. ranx has no hold at all:',
    '`compare(runs, weights=SLICE_WEIGHTS)` folds the slices into',
    '`weighted_ndcg`, and the candidate ships on that single weighted',
    'number even when the tail slice fell. Sources: es-rank-eval',
    '`rank_eval/guards.py` and `ci/evaluate.yml`; trec-eval-ci',
    '`slice_floor.py`; Vespa sample-apps `evaluate_slices.ipynb`; ranx',
    'docs, `compare`.',
    '',
    '### A2: How is a query slice defined and kept current as the catalogue changes?',
    '',
    'Declared, then rebuilt on a schedule — or derived at evaluation time.',
    'es-rank-eval reads `slices.yaml`: one entry per slice with a `match`',
    'predicate over the query log (the sample `tail` slice is',
    '`impressions_90d < 50`) and a `min_queries: 50` floor beneath which',
    'the slice is dropped from the guard with a warning;',
    '`jobs/rebuild_slices.py` runs nightly (`0 3 * * *`), re-evaluates',
    'every predicate over the last ninety days of the log, and rewrites',
    '`slices.generated.yaml`. trec-eval-ci pins slices by hand in',
    '`topics/slices.json` and documents a quarterly refresh. Vespa derives',
    'slices at evaluation time from query-frequency deciles —',
    '`slices = decile_buckets(query_log, n=10)` — so nothing is stored',
    'between runs. ranx has no slice notion beyond the `weights` dict the',
    'caller passes to `compare`. Sources: es-rank-eval `slices.yaml`,',
    '`jobs/rebuild_slices.py`; trec-eval-ci `topics/README.md`; Vespa',
    '`evaluate_slices.ipynb`.',
    '',
    '## Material',
    '',
    '**Where the hold sits.** In every harness that holds, the check runs',
    'in the evaluation job before promotion — never at query time and never',
    'in the ranking service. The candidate configuration is scored against',
    'the baseline over the same judgment set, per slice, and the job\'s',
    'exit code is the whole mechanism (es-rank-eval `ci/evaluate.yml`;',
    'trec-eval-ci `Makefile`, target `guard`).',
    '',
    '**Tolerance.** All three holds allow a small drop before failing:',
    'es-rank-eval defaults to 0.005 NDCG, trec-eval-ci to 0.01, Vespa to 0.',
    'None documents how the figure was chosen.',
    '',
    '**Slice sizing.** es-rank-eval is the only harness that refuses to',
    'score a slice below a query floor (`min_queries: 50`); the others',
    'score whatever the slice holds, and trec-eval-ci\'s README warns that',
    'slices under roughly fifty topics produce noisy verdicts.',
    '',
    '**Weighting instead of holding.** ranx\'s `SLICE_WEIGHTS` is a plain',
    'dict; the sample config weights the tail slice at 2.5 against 1.0 for',
    'the head, so a tail loss counts two and a half times over, but a large',
    'enough head gain still carries the release.',
    '',
    '**What is judged.** Every harness scores against pre-collected',
    'judgments; none derives judgments inside the evaluation run. Where the',
    'judgments come from is out of scope for all four.',
    '',
    '## Opened',
    '',
    '- A slice whose queries are too rare to accumulate clicks has no',
    '  click-derived judgments to score against — how any of the four labels',
    '  such a slice is undocumented',
    '- How many of the shop\'s searches fall below a fifty-impression floor',
    '  over ninety days: count the distinct normalised queries under the',
    '  floor in the query log against the total — the share decides whether',
    '  a tail slice can be formed at all, and so whether holding a release',
    '  on a slice floor is available to the shop or only a weighted',
    '  aggregate is',
    '',
    '## Limitations',
    '',
    'The four harnesses were read from their repositories and',
    'documentation; none was run. Tolerance defaults were taken from source,',
    'not from a maintainer\'s account of why. ranx\'s weighting sample is the',
    'library\'s own example, not a production configuration.',
    '',
    '## Sources',
    '',
    '- es-rank-eval repository — `rank_eval/guards.py`, `ci/evaluate.yml`,',
    '  `slices.yaml`, `jobs/rebuild_slices.py`',
    '- trec-eval-ci template — `slice_floor.py`, `topics/slices.json`,',
    '  `topics/README.md`, `Makefile`',
    '- Vespa sample-apps — `evaluate_slices.ipynb` and its README',
    '- ranx documentation — `compare` and the weighted comparison example',
    '',
  ].join('\n');
}

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);

    // The research started from the brief in an earlier sitting: the read
    // recorded on the map item, the topic registered, the file written,
    // the register seeded and moved as the conversation moved.
    h.engine('manifest', 'set', `${WU}.discovery.${TOPIC}`, 'brief_incorporated', 'true');
    h.engine('topic', 'start', WU, 'research', TOPIC);
    h.write(`.workflows/${WU}/research/${TOPIC}.md`, researchFile());
    h.engine('research-threads', 'add', WU, TOPIC, 'evaluation-harness',
      '--question', 'What does a good evaluation harness look like for this catalogue?',
      '--origin', 'brief');
    h.engine('research-threads', 'add', WU, TOPIC, SLUG,
      '--question', QUESTION,
      '--origin', 'conversation');
    h.engine('research-threads', 'add', WU, TOPIC, 'label-freshness',
      '--question', 'How often do click-derived judgments need refreshing before they mislead?',
      '--origin', 'user');
    h.engine('research-threads', 'set', WU, TOPIC, 'evaluation-harness', 'learned');

    // The dive, driven through the store's real lifecycle — order matters:
    // dispatch allocates deep-dive-001-tail-regressions in flight and the
    // thread goes digging (the sitting's last commit carries that); the
    // agent's report lands on disk after the sitting ended; a scan
    // promotes the row to pending. Nothing has folded it.
    const dispatched = JSON.parse(h.engine('agent', 'dispatch', WU, 'research', TOPIC,
      '--kind', 'deep-dive', '--label', SLUG));
    h.engine('research-threads', 'set', WU, TOPIC, SLUG, 'digging');
    h.engine('commit', WU, '--topic', `research/${TOPIC}`, '-m',
      `research(${WU}/${TOPIC}): candidate metrics, judgment collection, and the slice question`);
    h.write(dispatched.file, report());
    h.engine('agent', 'scan', WU, 'research', TOPIC);
  },
};
