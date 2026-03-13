---
name: view-plan
disable-model-invocation: true
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
---

Display a readable summary of a plan's phases, tasks, and status.

## Step 0: Run Migrations

**This step is mandatory. You must complete it before proceeding.**

Invoke the `/migrate` skill and follow its instructions exactly — if it issues a STOP gate, you must stop.

---

## Step 1: Identify the Plan

If no topic is specified, list available plans:

```bash
ls .workflows/
```

Ask the user which plan to view.

## Step 2: Read the Plan Index

Read the plan file from `.workflows/{work_unit}/planning/{topic}/planning.md` and check the `format` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase planning --topic {topic} format`).

## Step 3: Load Format Reading Reference

Load the format's reading reference:

```
../technical-planning/references/output-formats/{format}/reading.md
```

This file contains instructions for reading plans in that format.

## Step 4: Read Plan Content

Follow the reading reference to locate and read the actual plan content.

## Step 5: Present Summary

Display a readable summary:

> *Output the next fenced block as markdown (not a code block):*

```
**Plan: {work_unit}**

**Format:** {format}

### Phase 1: {phase name}
- [ ] Task 1.1: {description}
- [x] Task 1.2: {description}

### Phase 2: {phase name}
- [ ] Task 2.1: {description}
...
```

Show:
- Phase names and acceptance criteria
- Task descriptions and status (if trackable)
- Any blocked or dependent tasks

Keep it scannable - this is for quick reference, not full detail.

## Notes

- Some formats (like external issue trackers) may not be fully readable without API access - note this if applicable
- If status tracking isn't available in the format, just show the task structure
