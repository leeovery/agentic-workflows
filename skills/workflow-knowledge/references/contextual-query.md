# Contextual Query

*Reference for **[workflow-knowledge](../SKILL.md)** — loaded at phase start in research, discussion, investigation, and scoping processing skills.*

---

At the beginning of these phases, load the context this phase builds on: first read the work unit's own **seed** (the inbox item it was spawned from, if any), then run a focused query against the knowledge base for related prior work that might otherwise surface as a correction ten minutes into the session. If nothing comes back from the query, proceed as normal.

This is **not** a speculative dump. It is a focused check using the best context currently available. When the starting context offers multiple distinct angles (e.g. investigation has both symptoms and a subsystem name), batch them in a single invocation rather than running them serially.

## A. Read the work's seed

The work unit's `seeds[]` is its **origin** — the inbox item this work was spawned from. Read the list from the manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} seeds
```

#### If `work_type` is not `epic` and `seeds` is non-empty

Single-topic work: the seed's scope *is* this phase's scope, so read it in full as the definitional input. Read each `seeds/{filename}.md` (relative to `.workflows/{work_unit}/`) — the exact repro, stack trace, or fully-worked idea — and build the phase on it. The seed is also KB-indexed, so it will surface in the query below; that's fine — you already have it, so treat any `[seeds | …]` chunk there as a duplicate.

→ Proceed to **B. Construct the query**.

#### Otherwise

Either an epic topic (the work-unit seed is broader than this one topic — don't bulk-read it here; it surfaces as the relevant slice via the query below) or there is no seed.

→ Proceed to **B. Construct the query**.

## B. Construct the query

Build a short natural-language description of what this phase is about using whatever context you have at hand: the topic description, the handoff context, bootstrap answers already captured, the problem statement, and — for investigation — the initial symptoms.

Follow the construction rules in **[knowledge-usage.md](knowledge-usage.md)** — **B. How to construct queries** (natural language, not slugs; batch for multiple angles). If you have several distinct framings, batch them in one call.

If the only context available is a topic name, construct the best descriptive query you can. A poor query that returns nothing is acceptable — the cost is one store load.

## C. Run the query

Invoke the CLI with the constructed query (or queries). Use `--boost:work-unit {work_unit}` to bias results toward the current work unit without filtering out cross-work-unit context. Do not use hard filters (`--work-unit`, `--phase`, `--topic`, `--work-type`) unless you have a specific reason — this is meant to surface prior work broadly.

Single framing:

```
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs query "<descriptive query>" --boost:work-unit {work_unit}
```

Multiple framings (batch — one invocation, one merged result set):

```
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs query "<framing 1>" "<framing 2>" "<framing 3>" --boost:work-unit {work_unit}
```

#### If the command exits with a non-zero code

Load **[knowledge-usage.md](knowledge-usage.md)** for **D. Query failure handling** and follow its instructions. When D returns:

- **If the user chose `skip`** — no results to interpret. → Return to caller.
- **If a retry succeeded** — results are now available. → Proceed to **D. Interpret the results**.

#### Otherwise

→ Proceed to **D. Interpret the results**.

## D. Interpret the results

#### If stdout is `[0 results]`

No prior context found. Proceed to the next step silently — no delay, no user noise.

→ Return to caller.

#### If results are returned

Read each chunk and weigh it against the current topic. For a chunk that looks load-bearing, read its source file (the `Source:` line) for full detail. Most results are context — one or two may be directly relevant.

A surfaced `[seeds | …]` chunk is the work's origin. For an **epic topic**, treat it as load-bearing — read its source file for the slice relevant to this topic. For **single-topic work** you already read the full seed in **A**, so it needs no second read; disregard the duplicate.

Briefly acknowledge surfaced context to the user before the main session starts:

> *Output the next fenced block as markdown (not a code block):*

```
> Surfaced prior context from the knowledge base — incorporating into this phase.
> {One short line naming the most relevant piece, e.g. "auth-flow decided on UUID identity (spec, 2026-03-15)."}
```

Carry the context forward into the phase. Do not dump the full chunk list to the user — summarise only if the user asks, or if a chunk materially changes how this phase should start.

→ Return to caller.
