# Cross-Cutting Context

*Reference for **[workflow-planning-entry](../SKILL.md)***

---

Surface completed cross-cutting specifications as context for planning. Applies to ALL work types.

## A. Discover Cross-Cutting Work Units

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js project list --type cross-cutting
```

#### If no output (no cross-cutting work units exist)

→ Return to caller.

#### If cross-cutting work units found

Store the list of names. For each, check specification status:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {cc_work_unit}.specification.{cc_work_unit} status
```

Collect only those with `status: completed`. Also note any with `status: in-progress`.

→ Proceed to **B. Assess Relevance**.

## B. Assess Relevance

#### If no completed cross-cutting specifications exist and no in-progress ones are relevant

→ Return to caller.

#### If in-progress cross-cutting specs exist

Assess relevance of each in-progress spec to the feature being planned (by topic overlap — e.g., a caching strategy is relevant if the feature involves data retrieval or API calls).

**If relevant in-progress specs exist:**

> *Output the next fenced block as a code block:*

```
Cross-cutting specifications still in progress:
These may contain architectural decisions relevant to this plan.

  • {topic}
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

→ Proceed to **C. Summarize Completed**.

#### Otherwise

→ Proceed to **C. Summarize Completed**.

## C. Summarize Completed

#### If no completed cross-cutting specifications exist

→ Return to caller.

#### If completed cross-cutting specifications exist

For each completed cross-cutting spec, read the specification file at `.workflows/{cc_work_unit}/specification/{cc_work_unit}/specification.md` to build a brief summary. Assess relevance to the feature being planned.

**If relevant completed specs exist:**

> *Output the next fenced block as a code block:*

```
Cross-cutting specifications to reference:
  • {topic}: {brief summary of key decisions}
```

These specifications contain validated architectural decisions that should inform the plan. The planning skill will incorporate these as a "Cross-Cutting References" section in the plan.

Store confirmed specs for handoff to planning process.

→ Return to caller.

**If no completed specs are relevant:**

→ Return to caller.
