# Display: Specs Menu

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Shows when materialized specifications exist and no proposed groupings remain (every grouping has already been started). Displays existing specs from discovery manifest data (NOT from cache), lists unassigned discussions, and offers analysis or continue options.

## A. Display

The tree and menu render only **actionable** specs — every spec except the concluded ones (`status: completed` with `has_pending_sources: false`). Concluded specs move to the `c`/`completed` submenu. Render actionable specs in the discovery script's `specifications[]` order (already sorted in-progress → completed-with-pending). The numbered tree and the menu options use the same ordering and numbering.

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Specification Overview
●───────────────────────────────────────────────●

{N} completed discussions found. {M} specifications exist.
```

#### If actionable specs exist

> *Output the next fenced block as a code block:*

```
Existing specifications:
```

For each actionable specification from discovery output, display as nested tree:

> *Output the next fenced block as a code block:*

```
1. {work_unit:(titlecase)}
   └─ Spec: {spec_status:[in-progress|completed]} ({X} of {Y} sources extracted)
   └─ Discussions:
      ├─ {source-name} [extracted]
      └─ {source-name} [extracted]
   └─ Consult:
      ├─ {ref-name} [{status:[pending|addressed]}]
      └─ ...
```

#### If no actionable specs remain (every spec is concluded)

> *Output the next fenced block as a code block:*

```
All specifications are completed — see Manage completed specifications.
```

Determine discussion status from the spec's `sources` array:
- `incorporated` + `discussion_status: completed` or `not-found` → `extracted`
- `incorporated` + `discussion_status: other` (e.g. `in-progress`) → `extracted, reopened`
- `pending` → `pending`

Extraction count: X = sources with `status: incorporated`, Y = total source count from the spec's `sources` array.

Consult status comes from the spec's `consult_references` array (`pending` or `addressed`). Omit the `Consult:` branch for specs with no consult references.

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
⚑ Discussions not ready for specification:
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

  Consult status:
    pending   — sibling correction not yet read in and reconciled
    addressed — correction applied or cited; reconciliation recorded

  Spec status:
    in-progress — specification work is ongoing
    completed   — specification is done
```

### Cache-Aware Message

No `---` separator before these messages.

#### If cache status is `valid`

The grouping analysis is current and every grouping has been started. No message.

→ Proceed to **B. Menu**.

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

List "Analyze for groupings (recommended)" first, then one numbered entry per **actionable** spec — the same set the tree showed, in the same order. The verb depends on the spec's state:

- Spec is `in-progress` → **Continue** "{Name}" — in-progress
- Spec is `completed` with pending sources → **Continue** "{Name}" — {N} source(s) pending extraction

Concluded specs (`completed` with no pending sources) are not numbered here — they live behind `c`/`completed`.

When the spec has pending consult references, append `— {N} consult ref(s) pending` to its description. The verb is unchanged — consult references gate completion but introduce no new action.

After the numbered options, append the command option (only when `concluded_count > 0`):

- **`c`/`completed`** — Manage completed specifications — {concluded_count} completed

**Example assembled menu** (1 actionable spec, 1 concluded spec):

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`1`** — Analyze for groupings (recommended)
   `All discussions are analyzed for natural groupings. Existing`
   `specification names are preserved. You can provide guidance`
   `in the next step.`
- **`2`** — Continue "Auth Flow" — in-progress

- **`c`/`completed`** — Manage completed specifications — 1 completed

Select an option:
· · · · · · · · · · · ·
```

When no actionable specs remain (every spec is concluded), the menu shows only Analyze and `c`/`completed`:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`1`** — Analyze for groupings (recommended)
   `All discussions are analyzed for natural groupings. Existing`
   `specification names are preserved. You can provide guidance`
   `in the next step.`

- **`c`/`completed`** — Manage completed specifications — 2 completed

Select an option:
· · · · · · · · · · · ·
```

Recreate with actual topics and states from discovery.

Menu descriptions are wrapped in backticks to visually distinguish them from the choice labels. Omit the `c`/`completed` option when `concluded_count` is 0.

**STOP.** Wait for user response.

#### If user picks `Analyze for groupings`

If cache is stale, delete it first:
```bash
rm .workflows/{work_unit}/.state/discussion-consolidation-analysis.md
```

→ Load **[analysis-flow.md](analysis-flow.md)** and follow its instructions as written.

#### If user picks `Continue` for a spec

The selected spec and its sources become the context for confirmation.

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions as written.

#### If user picks `c`/`completed`

→ Load **[display-completed-specs.md](display-completed-specs.md)** and follow its instructions as written.

→ Return to **B. Menu**.
