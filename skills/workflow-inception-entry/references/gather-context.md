# Gather Context

*Reference for **[workflow-inception-entry](../SKILL.md)***

---

Inception is curatorial — the only context the session needs upfront is the work-unit description and any imported seed material. There are no interview questions; the conversation begins with the description as background and an open prompt to the user.

## A. Read Description

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} description
```

Store the output as `description`. If the field is empty or the command exits non-zero with code `2` (path not found), set `description` = `(none)`.

→ Proceed to **B. Read Imports**.

## B. Read Imports

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit} imports
```

#### If exists (`true`)

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} imports
```

Parse the JSON array. Store the list of `path` values as `imports`. Files were already copied to `imports/` and indexed into the knowledge base when the user provided them at start-epic — this read is just to surface the filenames in the inception handoff.

→ Return to caller.

#### If not exists (`false`)

Set `imports` = `[]`.

→ Return to caller.
