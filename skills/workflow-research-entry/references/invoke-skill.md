# Invoke the Skill

*Reference for **[workflow-research-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill.

---

## Load Inception Description

For every source branch except `continue`, read the inception item's `description` so it can be appended to the handoff. The item exists on the map by this point — every non-`continue` branch passed through `ensure-inception-item` earlier in the flow.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception.{topic} description
```

The CLI may return empty output (no `description` set on legacy items, or migration-seeded items). Treat empty/null output as "skip the Description block in the handoff" — the legacy fallback. When the value is non-empty, append the block below in the position shown for each branch.

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
