### Offline Metrics Baseline
*From: behavioural-ranking · discussion · 2026-01-02*

Signal ingestion landed as batch nightly aggregation, which means
ranking changes ship against day-old signals. Before any ranking
change goes out we need an offline metrics baseline computed from
those same batch aggregates — which metrics constitute it, and what
movement against the baseline blocks a ship, are open decisions
this topic owns.
