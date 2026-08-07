# Invoke the Skill

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

The output path is `.workflows/{work_unit}/discussion/{topic}.md`.

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill. The handoff carries session identity plus any interview answers — the durable inputs (carrier description, discovery brief, completed research) are read by the processing skill at initialisation, never added to the handoff.

---

## Handoff

#### If source is `continue`

Invoke the **workflow-discussion-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Discussion session for: {topic}
Work unit: {work_unit}
Work type: {work_type}
Source: existing discussion
Output: {output_path}
```

#### If the context was gathered by interview

gather-context-fresh ran at Step 3 — its answers fill the Context block, the one input only this session holds.

Invoke the **workflow-discussion-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Discussion session for: {topic}
Work unit: {work_unit}
Work type: {work_type}
Output: {output_path}

Context:
- Core problem: {the problem or decision the user named}
- Constraints: {any constraints mentioned, or "none"}
- Files to review: {the codebase files the user named, or "none"}
```

#### Otherwise

Invoke the **workflow-discussion-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Discussion session for: {topic}
Work unit: {work_unit}
Work type: {work_type}
Output: {output_path}
```
