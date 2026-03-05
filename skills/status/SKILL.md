---
name: status
disable-model-invocation: true
allowed-tools: Bash(node .claude/skills/status/scripts/discovery.js), Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
hooks:
  PreToolUse:
    - hooks:
        - type: command
          command: "$CLAUDE_PROJECT_DIR/.claude/hooks/workflows/system-check.sh"
          once: true
---

Show the current state of the workflow for this project.

## Step 0: Run Migrations

**This step is mandatory. You must complete it before proceeding.**

Invoke the `/migrate` skill and assess its output.

---

## Step 1: Discovery State

!`node .claude/skills/status/scripts/discovery.js`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```bash
node .claude/skills/status/scripts/discovery.js
```

If discovery output is already displayed, it has been run on your behalf.

Parse the discovery output. **IMPORTANT**: Use ONLY this script for discovery. Do NOT run additional bash commands (ls, head, cat, etc.) to gather state.

→ Proceed to **Step 2**.

---

## Step 2: Present Status

Build the display from discovery data. Group work units by work type. Only show sections that have content.

### 2a: Summary

> *Output the next fenced block as a code block:*

```
Workflow Status

  Work units: {total} active ({epic} epic, {feature} feature, {bugfix} bugfix)

  Research:       {count} with research
  Discussion:     {count} ({concluded} concluded, {in_progress} in-progress)
  Specification:  {active} active ({feature_spec} feature, {crosscutting} cross-cutting)
  Planning:       {count} ({concluded} concluded, {in_progress} in-progress)
  Implementation: {count} ({completed} completed, {in_progress} in-progress)
```

Only show phase lines that have content. If a phase has zero items but a later phase has content, show the line as `(none)` to highlight the gap. Omit work type counts that are zero.

#### If no workflow content exists at all

> *Output the next fenced block as a code block:*

```
Workflow Status

No active work units found in .workflows/

Start with /start-research to explore ideas,
or /start-discussion if you already know what to build.
```

**STOP.** Do not proceed — terminal condition.

### 2b: Work Units by Type

Group work units by work type (epic, feature, bugfix). Only show groups that have entries.

For each group, show a header then numbered entries with phase state:

> *Output the next fenced block as a code block:*

```
{work_type:(titlecase)} Work

  1. {work_unit:(titlecase)}
     └─ Discussion: @if(has_discussion) {status} @else (none) @endif
     └─ Specification: @if(has_spec) {status} @if(cross_cutting) (cross-cutting) @endif @else (none) @endif
     └─ Planning: @if(has_plan) {status} @else (none) @endif
     └─ Implementation: @if(has_impl) {status} @else (none) @endif

  2. ...
```

**Rules:**

- Show investigation instead of discussion for bugfix work units
- For epic work units, show research phase and individual topics within each phase (discussion items, spec items, etc.)
- Show `(cross-cutting)` after spec status for cross-cutting specs; omit type label for feature specs
- Blank line between numbered items
- For implementation: `in-progress` shows phase and task progress (e.g., `in-progress — phase 2, 5/12 tasks done`); `completed` shows `completed`
- For planning: map raw `planning` status to `in-progress` in the display
- Omit phase lines that are `(none)` unless a later phase has content (to highlight gaps)
- If a spec has sources, show them:

```
     └─ Specification: {status}
        ├─ Source: {src} ({src_status})
        └─ Source: ...
```

- If superseded specs exist, show after the group's numbered list:

```
  Superseded:
    • {work_unit} → {superseded_by}
```

- If a plan has unresolved external dependencies, show them:

```
     └─ Planning: {status}
        └─ Blocked: {dep_work_unit}:{dep_task_id} ({dep_state})
```

### 2c: Unlinked Discussions

Derive which work units have a discussion phase but are NOT referenced in any active (non-superseded) specification's `sources` array. Show only if unlinked discussions exist.

> *Output the next fenced block as a code block:*

```
Discussions not yet in a specification:

  • {work_unit} ({status})
```

### 2d: Key

Show if the display uses statuses that benefit from explanation. Only include statuses actually shown. No `---` separator before this section.

> *Output the next fenced block as a code block:*

```
Key:

  Status:
    in-progress — work is ongoing
    concluded   — complete, ready for next step
    superseded  — replaced by another specification

  Spec type:
    cross-cutting — architectural policy, not directly plannable

  Work type:
    epic    — phase-centric, multi-session, long-running
    feature — topic-centric, single-session, linear pipeline
    bugfix  — investigation-centric, single-session
```

Omit categories with no entries.

---

## Step 3: Suggest Next Steps

Based on gaps in the workflow, briefly suggest 2-3 most relevant actions:

- Concluded discussions not in any spec → `/start-specification`
- In-progress specs → finish with `/start-specification`
- Concluded feature specs without plans → `/start-planning`
- Concluded plans not yet implemented → `/start-implementation`
- Completed implementations → `/start-review`

If plans exist, mention `/view-plan` for detailed plan viewing.

Keep suggestions brief — the user knows their project better than we do.

## Notes

- Keep output scannable — this is a status check, not a deep analysis
- Work units are the primary organizational unit — each has its own directory under `.workflows/`
- Discussions may appear in multiple specifications' sources
- A work unit with a discussion not appearing in any active spec's sources is "unlinked"
- Discovery data comes from the manifest CLI (including spec sources and plan dependencies)
