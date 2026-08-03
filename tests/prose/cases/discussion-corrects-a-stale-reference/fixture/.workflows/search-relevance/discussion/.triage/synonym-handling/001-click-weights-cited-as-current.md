### The click-weights table cited as current; it was retired
*From: behavioural-ranking · discussion · 2026-01-05*

Coherence finding (stale-reference). This document cites the
click-weights table as the current mechanism feeding expansion
scoring; behavioural-ranking retired the table on 2026-01-04 — the
nightly job ships flat pair-counts files consumed directly, and
nothing reads a table.

> synonym-handling.md · Expansion Source · Journey: "the scores are
> computed nightly from the click-weights table their job maintains."

> behavioural-ranking.md · Signal Ingestion · Decision: "The
> aggregates ship as flat pair-counts files consumed directly; the
> interim click-weights table is retired (2026-01-04) — nothing
> reads it."

Two sites cite the table as current: the Journey sentence quoted
above and the Summary's Current State bullet. The decision layer is
coherent — expansion is batch-computed with daily refresh either
way; only the citing prose names a mechanism that no longer exists.
