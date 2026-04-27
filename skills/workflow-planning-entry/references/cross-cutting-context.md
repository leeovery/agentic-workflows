# Cross-Cutting Context

*Reference for **[workflow-planning-entry](../SKILL.md)***

---

Surface cross-cutting specifications as context for planning. Applies to ALL work types.

Issue a semantic query filtered to `work_type: cross-cutting` so only specs relevant to the current plan surface. In-progress cross-cutting work is called out separately — a semantic query can't see unfinished specs, and the user needs that awareness before planning around assumptions that might change.

## A. Build the query text

Read the current topic's specification at `.workflows/{work_unit}/specification/{topic}/specification.md`. Extract a short natural-language description of the feature — the opening summary, the problem statement, or the first substantive paragraph after the frontmatter. Aim for 1-3 sentences that describe *what the plan is about*.

Do not use the topic slug as the query term — slugs are weak semantic signal. If the spec is unusually terse and yields no natural description, construct a descriptive phrase from the spec's headings.

Store the resulting text as `{query_text}`.

## B. Flag in-progress cross-cutting specs

A semantic query only surfaces completed work. An in-progress cross-cutting spec may contain decisions that will bind this plan but aren't yet indexed — the user needs to be aware.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs project list --type cross-cutting
```

#### If no output (no cross-cutting work units exist)

→ Proceed to **C. Query the knowledge base**.

#### If cross-cutting work units found

For each name, check specification status:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {cc_work_unit}.specification.{cc_work_unit} status
```

Collect work units whose spec status is `in-progress`, then assess whether any are relevant to the feature being planned (by topic overlap — a caching strategy is relevant if the feature involves data retrieval or API calls).

**If no in-progress specs exist, or none are relevant:**

→ Proceed to **C. Query the knowledge base**.

**If relevant in-progress specs exist:**

> *Output the next fenced block as a code block:*

```
Cross-cutting specifications still in progress:
These may contain architectural decisions relevant to this plan.

  • {cc_work_unit}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Proceed without these, or complete them first?

- **`c`/`continue`** — Plan without them
- **`s`/`stop`** — Complete them first
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If user chose `s`/`stop`:**

**STOP.** Do not proceed — terminal condition.

**If user chose `c`/`continue`:**

→ Proceed to **C. Query the knowledge base**.

## C. Query the knowledge base

Run a targeted semantic query filtered to completed cross-cutting specs:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs query "{query_text}" --work-type cross-cutting --phase specification --limit 10
```

#### If the command exits with a non-zero code

Load **[knowledge-usage.md](../../workflow-knowledge/references/knowledge-usage.md)** for **D. Query failure handling** and follow its instructions. When D returns:

- **If the user chose `skip`** — → Return to caller (plan proceeds without cross-cutting context).
- **If a retry succeeded** — re-evaluate stdout using the `[0 results]` or results-returned branches below.

#### If stdout is `[0 results]`

No cross-cutting specs are semantically relevant to this plan. Proceed without cross-cutting context.

→ Return to caller.

#### If results are returned

Read the returned chunks. Group by work unit — each unique `work_unit/topic` in the provenance lines represents one cross-cutting spec. For each, if the chunks alone are not enough to judge relevance, read the source file (`Source:` line) for full detail.

Keep only the specs that are genuinely relevant to the plan being built. A chunk matching on generic vocabulary (e.g., both mention "authentication") but addressing unrelated concerns should be dropped.

> *Output the next fenced block as a code block:*

```
Cross-cutting specifications to reference:
  • {cc_work_unit}: {brief summary of key decisions relevant to this plan}
```

These specifications contain validated architectural decisions that should inform the plan. The planning skill will incorporate them as a "Cross-Cutting References" section in the plan.

Store the confirmed cross-cutting specs (work unit name and source file path) for handoff to the planning process.

→ Return to caller.
