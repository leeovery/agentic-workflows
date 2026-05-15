# Invoke the Skill

*Reference for **[workflow-research-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill.

---

## Load Inception Description

For every source branch except `continue`, attempt to read the inception item's `description` so it can be appended to the handoff. Two preconditions must hold before the read — both must be true, otherwise treat description as null and skip the Description block:

1. `work_type` is `epic`. Non-epic work units (feature, cross-cutting) have no inception phase — skip.
2. The `description` subkey exists on the inception item. Probe with `exists` first to avoid surfacing a "Path not found" error from a bare `get`:

   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.inception.{topic} description
   ```

   If the probe returns `true`, read the value:

   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception.{topic} description
   ```

When `description` is loaded and non-empty, append the Description block shown in each source branch below. When either precondition fails, or the read returns empty, omit the Description block entirely — no header, no empty body.

---

## Handoff

#### If source is `continue`

```
Research session for: {topic}
Work unit: {work_unit}

Source: existing research
Output: .workflows/{work_unit}/research/{resolved_filename}

Invoke the workflow-research-process skill.
```

No description load for `continue` — resuming an existing session, no need to re-prime. Invoke the [workflow-research-process](../../workflow-research-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.

#### If source is `import`

```
Research session for: {topic}
Work unit: {work_unit}

Source: import
Output: .workflows/{work_unit}/research/{resolved_filename}

Imports tracked in manifest.imports[] and indexed into the
knowledge base — relevant chunks will surface via the
session-start contextual query. Starting Point stays empty.

Description:
{description text — paragraph or two, preserved as-is}

Invoke the workflow-research-process skill.
```

The `Description:` block is omitted when `description` is null or empty. Invoke the [workflow-research-process](../../workflow-research-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.

#### Otherwise

```
Research session for: {topic}
Work unit: {work_unit}

Output: .workflows/{work_unit}/research/{resolved_filename}

Context:
- Prompted by: {problem, opportunity, or curiosity}
- Already knows: {any initial thoughts or research, or "starting fresh"}
- Starting point: {technical feasibility, market, business model, or general direction}
- Constraints: {any constraints mentioned, or "none"}

Description:
{description text — paragraph or two, preserved as-is}

Invoke the workflow-research-process skill.
```

The `Description:` block is omitted when `description` is null or empty. Invoke the [workflow-research-process](../../workflow-research-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.
