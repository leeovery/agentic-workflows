# Invoke the Skill

*Reference for **[workflow-research-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill. The handoff carries session identity plus any interview answers — the durable inputs (carrier description, discovery brief) are read by the processing skill at initialisation, never added to the handoff.

---

## Handoff

#### If source is `continue`

Invoke the **workflow-research-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Research session for: {topic}
Work unit: {work_unit}
Work type: {work_type}

Source: existing research
Output: .workflows/{work_unit}/research/{resolved_filename}
```

#### If the context was gathered by interview

gather-context ran at Step 4 — its answers fill the Context block, the one input only this session holds.

Invoke the **workflow-research-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Research session for: {topic}
Work unit: {work_unit}
Work type: {work_type}

Output: .workflows/{work_unit}/research/{resolved_filename}

Context:
- Prompted by: {problem, opportunity, or curiosity}
- Already knows: {any initial thoughts or research, or "starting fresh"}
- Starting point: {technical feasibility, market, business model, or general direction}
- Constraints: {any constraints mentioned, or "none"}
```

#### Otherwise

The carrier seeded this topic — a feature's discovery record, or an epic topic's brief. No interview ran, so there are no gathered answers to relay: the processing skill reads the carrier itself at initialisation.

Invoke the **workflow-research-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Research session for: {topic}
Work unit: {work_unit}
Work type: {work_type}

Output: .workflows/{work_unit}/research/{resolved_filename}
```
