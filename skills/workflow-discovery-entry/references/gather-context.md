# Gather Context

*Reference for **[workflow-discovery-entry](../SKILL.md)***

---

Discovery is curatorial — the only context the session needs upfront is the work-unit description and any imported seed material. There are no interview questions; the conversation begins with the description as background and an open prompt to the user.

#### If `work_unit` is empty (classifier mode)

No manifest exists yet — Discovery resolves shape and name during the conversation. Set `description = (none)` and `imports = []`. The session's seed material is the user's own framing of the work as it unfolds.

→ Return to caller.

## A. Read Description

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} description
```

#### If output is empty (no description)

Set `description` = `(none)`.

→ Proceed to **B. Read Imports**.

#### Otherwise

Store the output as `description`.

→ Proceed to **B. Read Imports**.

## B. Read Imports

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} imports
```

#### If output is empty (no imports)

Set `imports` = `[]`.

→ Return to caller.

#### Otherwise

Parse the JSON array. Store the list of `path` values as `imports`. Files were already copied to `imports/` and indexed into the knowledge base when the user provided them at start-epic — this read is just to surface the filenames in the discovery handoff.

→ Return to caller.
