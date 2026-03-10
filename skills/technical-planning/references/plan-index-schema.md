# Plan Index Schema

*Reference for **[technical-planning](../SKILL.md)***

---

This file defines the canonical structure for Plan Index Files (`.workflows/{work_unit}/planning/{topic}/planning.md`). All agents and references that create or update plan index content **must** follow these templates.

All metadata (topic, format, status, gate modes, progress tracking, etc.) is stored in the manifest via the manifest CLI -- not in file frontmatter. The Plan Index File contains only the plan body content (title, phases, task tables).

---

## Title

```markdown
# Plan: {Topic Name}
```

---

## Phase Entry

```markdown
### Phase {N}: {Phase Name}
status: {status}
ext_id:
approved_at: {YYYY-MM-DD}

**Goal**: {What this phase accomplishes}

**Why this order**: {Why this comes at this position}

**Acceptance**:
- [ ] {First verifiable criterion}
- [ ] {Second verifiable criterion}
```

| Field | Set when |
|-------|----------|
| `status` | Phase design -> `draft`; approval -> `approved` |
| `ext_id` | First task in phase authored -- external identifier for the phase |
| `approved_at` | Phase approval -- today's date. Omit while `draft`. |

---

## Task Table

```markdown
#### Tasks
| ID | Name | Edge Cases | Status | Ext ID |
|----|------|------------|--------|--------|
| {work_unit}-{phase}-{seq} | {Task Name} | {comma-separated list, or "none"} | {status} | |
```

| Field | Set when |
|-------|----------|
| `ID` | Task design -- format: `{work_unit}-{phase}-{seq}` |
| `Name` | Task design -- descriptive task name |
| `Edge Cases` | Task design -- curated list scoping which edge cases this task handles |
| `Status` | Task design -> `pending`; authoring -> `authored` |
| `Ext ID` | Task authored -- external identifier for the task |

---

## Manifest Fields

All metadata is managed via the manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js`). The following fields are set during planning:

| Field (via `--phase planning --topic {topic}`) | Set when |
|------------|----------|
| `status` | Plan creation -> `in-progress`; completion -> `completed` |
| `format` | Plan creation -- user-chosen output format |
| `spec_commit` | Plan creation -- `git rev-parse HEAD`; updated on continue if spec changed |
| `ext_id` | First task authored -- external identifier for the plan |
| `external_dependencies` | Dependency resolution (Step 6) |
| `task_list_gate_mode` | Plan creation -> `gated`; user opts in -> `auto` |
| `author_gate_mode` | Plan creation -> `gated`; user opts in -> `auto` |
| `finding_gate_mode` | Plan creation -> `gated`; user opts in -> `auto` |
| `phase` | Tracks current phase position |
| `task` | Tracks current task position (`~` when between tasks) |
| `review_cycle` | Added by plan-review when review cycle begins |
