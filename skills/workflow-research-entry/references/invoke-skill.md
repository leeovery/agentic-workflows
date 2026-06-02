# Invoke the Skill

*Reference for **[workflow-research-entry](../SKILL.md)***

---

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

#### If source is `continue`

```
Research session for: {topic}
Work unit: {work_unit}

Source: existing research
Output: .workflows/{work_unit}/research/{resolved_filename}

Invoke the workflow-research-process skill.
```

No description load for `continue` — resuming an existing session, no need to re-prime. Invoke the [workflow-research-process](../../workflow-research-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.

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
