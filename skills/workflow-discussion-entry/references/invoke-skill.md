# Invoke the Skill

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

The output path is `.workflows/{work_unit}/discussion/{topic}.md`.

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill.

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

Invoke the workflow-discussion-process skill.
```

Invoke the [workflow-discussion-process](../../workflow-discussion-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.

#### If source is `new-with-research`

```
Discussion session for: {topic}
Work unit: {work_unit}
Output: {output_path}

Research files:
- .workflows/{work_unit}/research/{filename1}.md
- .workflows/{work_unit}/research/{filename2}.md
Topic context: {brief orientation from user context}

Invoke the workflow-discussion-process skill.
```

Invoke the [workflow-discussion-process](../../workflow-discussion-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.

#### If source is `continue`

```
Discussion session for: {topic}
Work unit: {work_unit}
Source: existing discussion
Output: {output_path}

Invoke the workflow-discussion-process skill.
```

Invoke the [workflow-discussion-process](../../workflow-discussion-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.

#### If source is `fresh` or `new`

```
Discussion session for: {topic}
Work unit: {work_unit}
Source: fresh
Output: {output_path}

Invoke the workflow-discussion-process skill.
```

Invoke the [workflow-discussion-process](../../workflow-discussion-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.
