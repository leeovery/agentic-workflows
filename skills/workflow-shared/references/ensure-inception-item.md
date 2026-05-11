# Ensure Inception Item

*Shared reference. Loaded by `workflow-research-entry`, `workflow-discussion-entry`, and any flow that needs to auto-create a direct-entry inception item.*

---

Idempotently ensures a `phases.inception.items.{topic}` entry exists for the given topic on the given work unit. If the item already exists, this reference is a no-op. Otherwise, it pulls the topic from `dismissed[]` (if present) and creates the item with `source: direct-start` and the caller-supplied `routing`.

The reference assumes `topic` is already kebab-case — callers normalise before invoking. No summary is set; direct-entry items have no source content to summarise. The user can backfill via refinement's edit-summary later.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name. Always present.
- `topic` — the kebab-case topic name. Always present.
- `routing` — the literal `research` or `discussion`. Set by the caller based on which entry verb the user picked.

## A. Check Existence

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.inception.{topic}
```

#### If exists (`true`)

The topic is already on the map. Nothing to do — fall through to the caller's existing flow.

→ Return to caller.

#### If not exists (`false`)

→ Proceed to **B. Check Dismissed and Pull**.

## B. Check Dismissed and Pull

Read the dismissed list:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception dismissed
```

#### If `{topic}` is in the returned array

User-explicit spawns bypass the dismissed list — pull the name before writing the new item:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs pull {work_unit}.inception dismissed "{topic}"
```

→ Proceed to **C. Create Inception Item**.

#### Otherwise

→ Proceed to **C. Create Inception Item**.

## C. Create Inception Item

Initialise the item and set provenance fields:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.inception.{topic}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{topic} routing {routing}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{topic} source direct-start
```

No commit here — the manifest writes are folded into the next commit produced by the calling phase's process.

→ Return to caller.
