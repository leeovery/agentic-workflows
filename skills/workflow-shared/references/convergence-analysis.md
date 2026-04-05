# Convergence Analysis

*Shared reference for review/fix cycle escalation.*

---

When a review or fix cycle reaches its escalation threshold, read prior cycle tracking data and present a diagnostic showing what's converging, what's stuck, and why.

## Parameters

The caller provides these via context before loading:

- `loop_type` — `fix` | `analysis` | `planning-review` | `spec-review`
- `work_unit` — the work unit name
- `topic` — the topic name
- `internal_id` — (fix loop only) the task's internal ID

## Threshold Check

Cross-cycle analysis requires at least 2 data points. Determine the number of available cycles by checking which tracking files exist for this loop type.

#### If fewer than 2 cycles of data exist

→ Return to caller.

#### If 2 or more cycles of data exist

→ Proceed to **A. Gather Cycle Data**.

---

## A. Gather Cycle Data

Read tracking data from all available cycles. Extract only finding titles, key identifiers, and resolutions — not full content. Record the highest cycle number found as `latest_cycle`.

#### If `loop_type` is `fix`

Read the fix tracking cache file:
```
.workflows/.cache/{work_unit}/implementation/{topic}/fix-tracking-{internal_id}.md
```

For each `## Attempt {N}` section, extract:
- Each ISSUE entry (the issue description line and file:line reference)
- The CONFIDENCE level per issue

→ Proceed to **B. Classify Findings**.

#### If `loop_type` is `analysis`

Read analysis reports and task staging files for all available cycles:
```
.workflows/{work_unit}/implementation/{topic}/analysis-report-c{1..N}.md
.workflows/{work_unit}/implementation/{topic}/analysis-tasks-c{1..N}.md
```

For each cycle, extract:
- From report frontmatter: `total_findings`, `deduplicated_findings`, `proposed_tasks`
- From staging file: each task's title, severity, sources, and status (approved/skipped)

→ Proceed to **B. Classify Findings**.

#### If `loop_type` is `planning-review`

Read tracking files for all available cycles:
```
.workflows/{work_unit}/planning/{topic}/review-traceability-tracking-c{1..N}.md
.workflows/{work_unit}/planning/{topic}/review-integrity-tracking-c{1..N}.md
```

For each cycle, extract:
- Each finding's title
- Plan Reference field (which plan area is affected)
- Resolution (Fixed/Skipped)

→ Proceed to **B. Classify Findings**.

#### If `loop_type` is `spec-review`

Read tracking files for all available cycles:
```
.workflows/{work_unit}/specification/{topic}/review-input-tracking-c{1..N}.md
.workflows/{work_unit}/specification/{topic}/review-gap-analysis-tracking-c{1..N}.md
```

For each cycle, extract:
- Each finding's title
- Affects field (which specification section)
- Category
- Resolution (Approved/Skipped)

→ Proceed to **B. Classify Findings**.

---

## B. Classify Findings

Compare findings across cycles. Two findings match if their titles share significant words OR they reference the same area (file:line, plan reference, or spec section).

Treat the highest-numbered cycle as the **latest cycle** and all earlier cycles as **prior cycles**. For each finding identified across all cycles, classify as:

- **Resolved** — appeared in a prior cycle but not in the latest cycle (the underlying issue was addressed)
- **Recurring** — appeared in 2 or more cycles including the latest one (the issue persists despite fixes)
- **New** — first appearance in the latest cycle

Compute:
- `resolved_count` — findings from prior cycles no longer appearing
- `recurring_count` — findings persisting across cycles
- `new_count` — findings appearing for the first time in the latest cycle
- `trend`:
  - **converging** — resolved_count > new_count (progress is being made)
  - **stable** — resolved_count ≈ new_count (treading water)
  - **diverging** — new_count > resolved_count (fixes are creating new issues)

→ Proceed to **C. Display Diagnostic**.

---

## C. Display Diagnostic

> *Output the next fenced block as a code block:*

```
{loop_type_label:(titlecase)} — {latest_cycle} cycle diagnostic

  Trend: {trend:[converging|stable|diverging]}
  Latest cycle: {finding_count} findings ({new_count} new, {recurring_count} recurring)

  @if(resolved_count > 0)
  Resolved:
  @foreach(finding in resolved)
    • {finding.title} (fixed in cycle {finding.last_seen_cycle})
  @endforeach
  @endif

  @if(recurring_count > 0)
  Recurring:
  @foreach(finding in recurring)
    • {finding.title} (cycles {finding.cycle_list})
      {1-line root cause hypothesis based on the finding's history and affected area}
  @endforeach
  @endif

  @if(new_count > 0)
  New this cycle:
  @foreach(finding in new)
    • {finding.title}
  @endforeach
  @endif

  @if(trend = converging)
  ⚑ Continuing is likely to resolve remaining items.
  @endif
  @if(trend = stable)
  ⚑ Same issues are cycling. Consider manual intervention on the recurring items.
  @endif
  @if(trend = diverging)
  ⚑ Fixes are introducing new issues. Consider reviewing the approach.
  @endif
```

Where `loop_type_label` maps:
- `fix` → `Fix Loop`
- `analysis` → `Analysis`
- `planning-review` → `Plan Review`
- `spec-review` → `Spec Review`

→ Return to caller.
