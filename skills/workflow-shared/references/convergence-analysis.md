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

Cross-cycle analysis requires at least 2 data points. Determine the number of available cycles from how the loop type stores them: the `fix` loop appends every cycle as an `## Attempt {N}` section inside its single tracking file — count those sections; the other three loop types write numbered `-c{N}` files, up to two per cycle — count the **distinct `{N}` suffixes**, never the files.

#### If fewer than 2 cycles of data exist

→ Return to caller.

#### If 2 or more cycles of data exist

→ Proceed to **A. Gather Cycle Data**.

---

## A. Gather Cycle Data

Read tracking data from all available cycles. Extract only finding titles, key identifiers, and resolutions — not full content. Record the highest cycle number found as `latest_cycle`.

#### If `loop_type` is `fix`

Read the fix tracking file:
```
.workflows/{work_unit}/implementation/{topic}/fix-tracking-{internal_id}.md
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
- From the report's **Stats** section: total findings, deduplicated findings, proposed tasks
- From the staging file: each task's title, severity, and sources; its approved/skipped outcome from the manifest's `staging.c{N}.tasks` (`manifest get {work_unit}.implementation.{topic} staging`)

→ Proceed to **B. Classify Findings**.

#### If `loop_type` is `planning-review`

Read tracking files for all available cycles:
```
.workflows/{work_unit}/planning/{topic}/review-traceability-tracking-c{1..N}.md
.workflows/{work_unit}/planning/{topic}/review-integrity-tracking-c{1..N}.md
```

For each cycle, extract:
- Each finding's title
- Which stream it came from (traceability or integrity — by tracking file)
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
- Which stream it came from (input review or gap analysis — by tracking file)
- Affects field (which specification section)
- Category
- Resolution (Approved/Adjusted/Skipped)

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
- `stream_counts` — (two-stream loop types only: `spec-review`, `planning-review`) latest-cycle finding counts per tracking stream
- `trend` (first match wins):
  - **churning** — recurring_count is 0 or near 0 while resolved_count and new_count are both above 0 and roughly equal (every cycle's findings are new — the edits themselves are generating them)
  - **converging** — resolved_count > new_count (progress is being made)
  - **stable** — resolved_count ≈ new_count (treading water)
  - **diverging** — new_count > resolved_count (fixes are creating new issues)

→ Proceed to **C. Display Diagnostic**.

---

## C. Display Diagnostic

Open with one markdown sentence above the block — what the cycles show, in plain terms: what is resolving and what keeps coming back.

> *Output the next fenced block as a code block:*

```
{loop_type_label:(titlecase)} — cycle {latest_cycle} diagnostic

  Trend: {trend:[churning|converging|stable|diverging]}
  Latest cycle: {finding_count} findings ({new_count} new, {recurring_count} recurring)
  @if(loop_type is spec-review or planning-review)
  Per stream: {stream_a_label} {stream_a_count} · {stream_b_label} {stream_b_count}
  @endif

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
      {1-line root cause hypothesis in plain behaviour terms, from the finding's history and affected area}
  @endforeach
  @endif

  @if(new_count > 0)
  New this cycle:
  @foreach(finding in new)
    • {finding.title}
  @endforeach
  @endif

  @if(trend = churning)
  ⚑ Findings resolve but are replaced at the same rate — the edits are
    likely generating new findings. Consider consolidating duplicated
    statements rather than running another cycle.
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

Stream labels map:
- `spec-review` → `input review` / `gap analysis`
- `planning-review` → `traceability` / `integrity`

→ Return to caller.
