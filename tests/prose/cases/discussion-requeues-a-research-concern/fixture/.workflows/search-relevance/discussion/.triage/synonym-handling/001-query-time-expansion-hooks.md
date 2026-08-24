### Does the engine expose expansion hooks at query time?
*From: relevance-measurement · discussion · 2026-07-22*

Behaviour-driven expansion assumes the engine lets us inject
expansions while a query is being analysed. Nobody has verified
that the deployed engine's query-analysis chain exposes such a
hook — the vendor documentation is ambiguous about whether custom
analysers run per-query or only at index time, and if expansion
can only happen at index time the behaviour-driven approach
changes shape entirely. Settling this needs the engine's
query-pipeline documentation read against our deployed version
and a small spike proving an injected synonym actually reaches
matching — exploration, not a decision.
