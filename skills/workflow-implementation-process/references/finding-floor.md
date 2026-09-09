# Finding Floor

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

Every implementation finding clears this floor before it is written — an analysis finding, a consolidation finding, a BANK entry, a staged proposal — and every party that judges one re-applies it.

## The Floor

A finding names the failure it prevents: what goes wrong, for whom, and how it would be noticed. A finding that cannot is not written.

## Duplication

Duplication is a finding only when the copies encode a rule whose divergence would be silent — no test, no compile error, no visible symptom — and consequential. Two similar things that would fail loudly if they drifted are not a finding. Names, file placement, argument order, symmetry between test helpers, and unrouted call sites of a helper never are.

## Test Files

A test file is in scope only for a failure-mode finding — a guard that passes while checking nothing, an isolation hole that reaches the developer's machine, a reproduced flake on the thing being shipped. Never for reuse, naming, or symmetry.

## Comment-Only Remedies

A finding whose entire remedy is comment text is not a finding. Report it as a comment correction — the file and line, what is wrong, the OLD text verbatim, the NEW text (empty to delete) — in the shape your output format names. A correction must itself clear the comment bar in **[code-quality.md](code-quality.md)** → Comments: a comment earns its place only by carrying what the code cannot, and a comment that cannot is deleted, never reworded.

→ Return to caller.
