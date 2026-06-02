# Invoke the Skill

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

The output path is `.workflows/{work_unit}/discussion/{topic}.md`.

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill.

---

## Load the Carrier Description

For every source branch except `continue`, read the `description` discovery left as the seed carrier, to append it to the handoff. Where it lives depends on the work type — read the matching source (empty stdout means absent):

- **Epic** — the discovery map item carries it:

  ```bash
  node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery.{topic} description
  ```

- **Feature / cross-cutting** — the work-unit manifest carries it (single-phase types have no discovery map item):

  ```bash
  node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} description
  ```

When the read returns non-empty, append the Description block shown in each source branch below. When it returns empty, omit the Description block entirely — no header, no empty body.

---

## Handoff

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
