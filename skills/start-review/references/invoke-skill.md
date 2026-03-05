# Invoke the Skill

*Reference for **[start-review](../SKILL.md)***

---

After completing the steps above, this skill's purpose is fulfilled.

## Set Review Status

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js init-phase {work_unit} --phase review --topic {topic}
```

## Save Session Bookmark

> *Output the next fenced block as a code block:*

```
Saving session state so Claude can pick up where it left off if the conversation is compacted.
```

```bash
.claude/hooks/workflows/write-session-state.sh \
  "{work_unit}" \
  "skills/technical-review/SKILL.md" \
  ".workflows/{work_unit}/review/{topic}/r{N}/review.md"
```

---

## Invoke the Skill

Invoke the [technical-review](../../technical-review/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded - it contains the instructions for how to proceed.

Each plan is reviewed independently. When multiple plans are selected, pass all plans in the handoff — the orchestrator will loop through them one at a time.

**Example handoff:**
```
Review session
Work type: {work_type}
Plans to review:
  - work_unit: {work_unit_1}
    plan: .workflows/{work_unit_1}/planning/{topic}/planning.md
    format: {format}
    specification: .workflows/{work_unit_1}/specification/{topic}/specification.md (exists: {true|false})
    review_version: r{N}
  - work_unit: {work_unit_2}
    plan: .workflows/{work_unit_2}/planning/{topic}/planning.md
    format: {format}
    specification: .workflows/{work_unit_2}/specification/{topic}/specification.md (exists: {true|false})
    review_version: r{N}

Invoke the technical-review skill.
```

**Example handoff (analysis-only):**
```
Analysis session for: {work_unit}
Work type: {work_type}
Review mode: analysis-only
Review path: .workflows/{work_unit}/review/{topic}/r{N}/
Format: {format}
Specification: .workflows/{work_unit}/specification/{topic}/specification.md

Invoke the technical-review skill.
```
