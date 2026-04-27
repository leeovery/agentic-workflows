# Knowledge Usage

*Reference for **[workflow-knowledge](../SKILL.md)** — loaded by processing skills (research, discussion, investigation, scoping, planning, implementation, review).*

---

This reference sets expectations for how you use the knowledge base *during* a phase — when to query, how to construct queries, how to interpret results, and what to do if a query fails. Load it early in the phase so the guidance is active from the first substantive step.

For API details (commands, flags, output format, confidence tiers, two-step retrieval), load **[SKILL.md](../SKILL.md)** — the knowledge skill's API documentation.

---

## A. When to query

Query proactively throughout the phase. Under-querying is the bigger risk — the knowledge base is cheap to check and valuable when prior work exists. Trust your judgement and err on the side of querying.

Four trigger heuristics. If any fires, query:

1. **Topic boundaries** — the conversation is at the edge of the current topic, brushing up against adjacent territory that may have been explored elsewhere. ("This auth discussion is starting to touch session handling — was that covered in another work unit?")
2. **Upstream/downstream dependencies** — something being discussed might affect or be affected by other parts of the system. ("This data-model change has implications for billing — have we discussed billing's assumptions about this field?")
3. **Unfamiliar territory** — you're not sure whether a topic has been explored before in this project. When in doubt, check.
4. **User prompts** — the user asks "have we discussed this?", "is there prior context?", "what was decided about X?", or anything similar.

Multiple queries from different angles are expected and encouraged. One query for the decision, one for the constraint, one for the rejected alternative — each surfaces different context.

## B. How to construct queries

Use **natural language** describing what you're looking for — not topic slugs, which are weak semantic signal. Filter with `--work-type`, `--phase`, `--topic`; bias toward the current work unit with `--work-unit` (a re-rank hint, not a filter). For multiple angles in one invocation, pass multiple positional terms (batch query).

See **[SKILL.md](../SKILL.md)** — query construction examples and the full flag table.

## C. Two-step retrieval

Chunks land in context; read the source file (from the `Source:` line) only when a chunk looks load-bearing. See **[SKILL.md](../SKILL.md)** — two-step retrieval pattern.

## D. Query failure handling

If `knowledge query` exits with a non-zero code, **pause the workflow**. Do not silently proceed without context — the knowledge base is high-value enough that silent skips are worse than a brief interruption.

1. Capture the error output.
2. Surface it to the user using the display block below.
3. Offer two options — fix and retry, or explicitly proceed without knowledge.
4. If the user chooses to proceed, continue the phase but record that knowledge retrieval was skipped so the user knows context may be missing.

> *Output the next fenced block as a code block:*

```
⚑ Knowledge query failed
  {error output}

  Likely causes: expired API key, network outage, corrupted store,
  or provider mismatch. Run `knowledge status` to diagnose.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
How should I proceed?

- **`r`/`retry`** — I'll fix the issue; retry the query
- **`s`/`skip`** — Proceed without knowledge context for this phase
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `retry`

Re-run the query. If it fails again, surface again (same choice). If it succeeds, the caller will interpret the fresh results.

→ Return to caller.

#### If `skip`

Note in the current phase's working file that the knowledge query was skipped. Example: append a short note under a relevant section — *"Knowledge base query skipped ({YYYY-MM-DD}) — prior context may be missing."* — so the user can audit later.

→ Return to caller.

## E. Phase-specific notes

- **Research** — query at the start of the phase (via the contextual query step) and throughout. Early phases have the highest chance of overlapping with prior work — research is often where the same ground gets explored twice if we don't check.
- **Discussion** — query at the start and throughout. Decisions being made now often echo or contradict decisions made elsewhere. Check before committing to a direction.
- **Investigation** — query at the start (after initial symptoms are gathered) and throughout. Symptoms and root causes may have been seen before — a matching prior investigation can save hours.
- **Specification** — **do not query during this phase.** The spec turns discussion decisions into a golden document. Cross-cutting concerns merge at planning time via an explicit cross-cutting query, not during spec authoring. Querying mid-spec pulls the document away from its own source material.
- **Scoping** — query throughout. Quick-fix scoping benefits from knowing if the issue was discussed or investigated elsewhere — a "mechanical change" often has a history.
- **Planning** — **do not query during planning.** The spec is the golden document; planning operates on the spec alone. If a spec gap surfaces during planning, flag it to the user — don't fill it with a KB query. Cross-cutting context is handled at planning entry via the explicit `--work-type cross-cutting` query (existing mechanism, not discretionary).
- **Implementation** — code is the source of truth for *what* exists during implementation. Read the code; don't query the KB for it. The KB is useful only for the *why* behind an existing pattern or decision (e.g., "why does this use UUID v7?" — the rationale lives in spec/discussion, not the code). Rare in practice. Never use it to fill spec gaps — those are blockers.
- **Review** — query only for cross-work-unit consistency checks ("does this mirror how similar decisions were made elsewhere?"). Consistency with the current spec is already in scope — no KB needed for that.

→ Return to caller.
