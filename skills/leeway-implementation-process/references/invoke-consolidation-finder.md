# Invoke Consolidation Finder

*Reference for **[consolidation-pass.md](consolidation-pass.md)***

---

This step invokes the `workflow-implementation-consolidation-finder` agent (`.claude/agents/workflow-implementation-consolidation-finder.md`) to sweep one phase's combined surface.

---

## Identify Scope

The phase files are the `files` of this phase's task commits, read across every repo in the project:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs code log {work_unit} {topic} --phase {N}
```

Read the bank (an absent field is empty — dispatch with an empty list):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.implementation.{topic} bank
```

---

## Invoke the Agent

**Agent path**: `.claude/agents/workflow-implementation-consolidation-finder.md`

Dispatch a **fresh** agent via the Task tool — fresh context is the point: the finder reads the phase's final surface with no memory of how it was built.

> **CRITICAL**: Pass **only** the nine inputs listed below — no reviewer observations, no findings held in conversation, no notes from earlier tasks. The bank is the only route by which a task-time finding reaches the sweep.

Pass:

1. **Phase files** — the file list from scope identification
2. **Bank entries** — the full bank JSON (the finder confirms or drops each against the phase's final state)
3. **Specification path** — from the specification (if available)
4. **Project skill paths** — from `project_skills` in the manifest (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.implementation.{topic} project_skills`)
5. **code-quality.md path** — `.claude/skills/workflow-implementation-process/references/code-quality.md`
6. **finding-floor.md path** — `.claude/skills/workflow-implementation-process/references/finding-floor.md`
7. **Work unit** — the work unit name (for path construction)
8. **Topic name** — the implementation topic
9. **Phase number** — `{N}`

The agent writes its findings to `.workflows/{work_unit}/implementation/{topic}/consolidation-findings-p{N}.md`.

The dispatch runs in the background (`run_in_background: true`) and ends the turn on exactly `The consolidation finder agent has been dispatched for phase {N}.`

---

## Expected Result

The agent returns a brief status:

```
STATUS: findings | clean
FINDINGS_COUNT: {N}
BANK: {confirmed M | no entries}
SUMMARY: {1 sentence}
```

- `findings`: the findings file is written — a finding survived the bar, a spec defect is recorded, or a comment correction is owed; the judge reads all three from the file
- `clean`: none of the three — no file is written

→ Return to caller.
