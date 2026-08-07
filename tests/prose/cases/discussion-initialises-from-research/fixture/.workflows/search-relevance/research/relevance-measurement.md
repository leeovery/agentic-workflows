# Research: Relevance Measurement

How to tell whether a relevance change makes results better or
worse — the epic's measurement gap, researched before discussion.

## Starting Point

What we know so far:
- No evaluation set and no metrics: every ranking tweak is decided
  by argument.
- The user has never built an evaluation harness and holds this as
  the area they understand least.
- Measurement comes before tuning (soft decision from discovery).

---

## Judgment Collection

Three viable sources of relevance judgments surfaced. Explicit
editorial grading is precise but slow and needs a rubric nobody
has written. Click-derived implicit judgments are free and plentiful
but position-biased. A hybrid — a small graded set for regression,
implicit signals for breadth — is the pattern the literature keeps
recommending for teams this size.

## Metric Choice

Offline: nDCG@10 is the default for graded judgments; interleaving
win-rate needs live traffic but reads directly as preference.
The two answer different questions — offline metrics guard
regressions, interleaving settles head-to-head changes. Which the
team leans on first is a decision, not a finding.

## Evaluation Set Maintenance

Query distributions drift seasonally. A frozen evaluation set rots;
refreshing it silently moves the baseline. Options found: quarterly
refresh with overlap scoring, or continuous sampling with holdout
pinning. Both workable; neither free.

## Carried into discussion

- Judgment collection: hybrid graded-plus-implicit, or single-source?
- Metric choice: what guards regressions, what settles comparisons?
- Evaluation set maintenance: refresh cadence and baseline stability.
