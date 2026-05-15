# Invoke the Skill

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

The output path is `.workflows/{work_unit}/discussion/{topic}.md`.

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

#### If source is `research`

```
Discussion session for: {topic}
Work unit: {work_unit}
Output: {output_path}

Research files:
- .workflows/{work_unit}/research/{filename1}.md
- .workflows/{work_unit}/research/{filename2}.md
Topic context: {summary from analysis cache}

Description:
{description text — paragraph or two, preserved as-is}

Invoke the workflow-discussion-process skill.
```

The `Description:` block is omitted when `description` is null or empty. Invoke the [workflow-discussion-process](../../workflow-discussion-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.

#### If source is `topic-provided-with-research`

```
Discussion session for: {topic}
Work unit: {work_unit}
Output: {output_path}

Research files:
- .workflows/{work_unit}/research/{filename1}.md
- .workflows/{work_unit}/research/{filename2}.md
Topic context: {brief orientation from user context}

Description:
{description text — paragraph or two, preserved as-is}

Invoke the workflow-discussion-process skill.
```

The `Description:` block is omitted when `description` is null or empty. Invoke the [workflow-discussion-process](../../workflow-discussion-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.

#### If source is `gap-analysis`

```
Discussion session for: {topic}
Work unit: {work_unit}
Output: {output_path}

Source discussions:
- .workflows/{work_unit}/discussion/{discussion1}.md
- .workflows/{work_unit}/discussion/{discussion2}.md
Topic context: {summary from gap analysis cache}

Description:
{description text — paragraph or two, preserved as-is}

Invoke the workflow-discussion-process skill.
```

The `Description:` block is omitted when `description` is null or empty. Invoke the [workflow-discussion-process](../../workflow-discussion-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.

#### If source is `continue`

```
Discussion session for: {topic}
Work unit: {work_unit}
Source: existing discussion
Output: {output_path}

Invoke the workflow-discussion-process skill.
```

No description load for `continue` — resuming an existing session, no need to re-prime. Invoke the [workflow-discussion-process](../../workflow-discussion-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.

#### If source is `fresh` or `topic-provided`

```
Discussion session for: {topic}
Work unit: {work_unit}
Source: fresh
Output: {output_path}

Description:
{description text — paragraph or two, preserved as-is}

Invoke the workflow-discussion-process skill.
```

The `Description:` block is omitted when `description` is null or empty. Invoke the [workflow-discussion-process](../../workflow-discussion-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.
