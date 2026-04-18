# Knowledge Usage

*Shared reference for processing skills (research, discussion, investigation, scoping, planning, implementation, review).*

---

This reference sets expectations for how you use the knowledge base *during* a phase — when to query, how to construct queries, how to interpret results, and what to do if a query fails. Load it early in the phase so the guidance is active from the first substantive step.

For API details (commands, flags, output format, confidence tiers, two-step retrieval), load **[SKILL.md](../../workflow-knowledge/SKILL.md)** — the knowledge skill's API documentation.

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

Use **natural language** describing what you're looking for. Not topic slugs — slugs are weak semantic signal. A query should read like a sentence the original author would have written.

- Good: `"OAuth2 PKCE flow for mobile clients"`
- Good: `"why we ruled out email as a primary identity field"`
- Poor: `"auth-flow"` (slug, weak signal)
- Poor: `"auth"` (too broad)

Use the CLI flags to filter, not the query string:

- `--work-type <type>` — filter to a work type (hard filter)
- `--phase <phase>` — filter to a phase (hard filter)
- `--topic <topic>` — filter to a topic (hard filter)
- `--work-unit <wu>` — **re-ranking hint, not a filter** — boosts results from the current work unit while still returning cross-work-unit context

For batch queries (multiple angles in one invocation), pass multiple positional terms. See the knowledge skill for details.

## C. Two-step retrieval

Results include chunks with provenance. Don't read source files for every chunk — read only when a chunk looks load-bearing for what you're doing. The chunk text alone is usually enough to judge relevance; the source file is there for deep dives.

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

Re-run the query. If it fails again, surface again. Same choice.

#### If `skip`

Note in the current phase's working file that the knowledge query was skipped and continue. Example: append a short note under a relevant section — *"Knowledge base query skipped ({YYYY-MM-DD}) — prior context may be missing."* — so the user can audit later.

## E. Phase-specific notes

- **Research** — query at the start of the phase (via the contextual query step) and throughout. Early phases have the highest chance of overlapping with prior work — research is often where the same ground gets explored twice if we don't check.
- **Discussion** — query at the start and throughout. Decisions being made now often echo or contradict decisions made elsewhere. Check before committing to a direction.
- **Investigation** — query at the start (after initial symptoms are gathered) and throughout. Symptoms and root causes may have been seen before — a matching prior investigation can save hours.
- **Specification** — **do not query during this phase.** The spec turns discussion decisions into a golden document. Cross-cutting concerns merge at planning time via an explicit cross-cutting query, not during spec authoring. Querying mid-spec pulls the document away from its own source material.
- **Scoping** — query throughout. Quick-fix scoping benefits from knowing if the issue was discussed or investigated elsewhere — a "mechanical change" often has a history.
- **Planning** — query throughout, especially when designing phases and tasks. Cross-cutting context is handled explicitly at planning entry (a targeted `--work-type cross-cutting` query replaces the old manual approach) — don't duplicate that work here.
- **Implementation** — query when a task touches unfamiliar territory or intersects with areas covered by prior work. Use it to check assumptions before writing code, not to retro-justify decisions after.
- **Review** — query to verify decisions against prior context. When something in the implementation looks inconsistent with how similar decisions were made elsewhere, the knowledge base is the quickest way to check.

→ Return to caller.
