# Display: Specs Menu

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Shows when multiple completed discussions exist, specifications exist, and cache is none or stale. Displays existing specs from discovery manifest data (NOT from cache), lists unassigned discussions, and offers analysis or continue options.

## A. Display

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Specification Overview
●───────────────────────────────────────────────●

{N} completed discussions found. {M} specifications exist.

Existing specifications:
```

For each non-superseded specification from discovery output, display as nested tree:

> *Output the next fenced block as a code block:*

```
1. {work_unit:(titlecase)}
   └─ Spec: {spec_status:[in-progress|completed]} ({X} of {Y} sources extracted)
   └─ Discussions:
      ├─ {source-name} (extracted)
      └─ {source-name} (extracted)
```

Determine discussion status from the spec's `sources` array:
- `incorporated` + `discussion_status: completed` or `not-found` → `extracted`
- `incorporated` + `discussion_status: other` (e.g. `in-progress`) → `extracted, reopened`
- `pending` → `pending`

Extraction count: X = sources with `status: incorporated`, Y = total source count from the spec's `sources` array.

### Unassigned Discussions

List completed discussions that are not in any specification's `sources` array:

> *Output the next fenced block as a code block:*

```
Completed discussions not in a specification:
  • {discussion-name}
  • {discussion-name}
```

#### If in-progress discussions exist

> *Output the next fenced block as a code block:*

```
Discussions not ready for specification:
These discussions are still in progress and must be completed
before they can be included in a specification.

  • {discussion-name}
```

### Key/Legend

Show only the statuses that appear in the current display. No `---` separator before this section.

> *Output the next fenced block as a code block:*

```
Key:

  Discussion status:
    extracted — content has been incorporated into the specification
    reopened  — was extracted but discussion has regressed to in-progress

  Spec status:
    in-progress — specification work is ongoing
    completed   — specification is done
```

### Cache-Aware Message

No `---` separator before these messages.

#### If cache status is `none`

> *Output the next fenced block as a code block:*

```
No grouping analysis exists.
```

→ Proceed to **B. Menu**.

#### If cache status is `stale`

> *Output the next fenced block as a code block:*

```
A previous grouping analysis exists but is outdated — discussions
have changed since it was created. Re-analysis is required.
```

→ Proceed to **B. Menu**.

---

## B. Menu

List "Analyze for groupings (recommended)" first, then one entry per existing non-superseded specification. The verb depends on the spec's state:

- Spec is `in-progress` → **Continue** "{Name}" — in-progress
- Spec is `completed` with pending sources → **Continue** "{Name}" — {N} source(s) pending extraction
- Spec is `completed` with no pending sources → **Refine** "{Name}" — completed

**Example assembled menu** (2 specs exist):

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
1. Analyze for groupings (recommended)
   `All discussions are analyzed for natural groupings. Existing`
   `specification names are preserved. You can provide guidance`
   `in the next step.`
2. Continue "Auth Flow" — in-progress
3. Refine "Data Model" — completed

Select an option (enter number):
· · · · · · · · · · · ·
```

Recreate with actual topics and states from discovery.

Menu descriptions are wrapped in backticks to visually distinguish them from the choice labels.

**STOP.** Wait for user response.

#### If user picks `Analyze for groupings`

If cache is stale, delete it first:
```bash
rm .workflows/{work_unit}/.state/discussion-consolidation-analysis.md
```

→ Load **[analysis-flow.md](analysis-flow.md)** and follow its instructions as written.

#### If user picks `Continue` or `Refine` for a spec

The selected spec and its sources become the context for confirmation.

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions as written.
