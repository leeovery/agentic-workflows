# Ensure Discovery Item

*Shared reference. Loaded by `workflow-research-entry`, `workflow-discussion-entry`, and any flow that needs to auto-create a direct-entry discovery item.*

---

Idempotently ensures a `phases.discovery.items.{topic}` entry exists for the given topic on the given work unit. If the work unit is not an epic, returns immediately — only epics have a discovery map. Otherwise: if the item already exists, this reference is a no-op; if not, it pulls the topic from `dismissed[]` (when present) and creates the item with `source: direct-start` and the caller-supplied `routing`.

The reference assumes `topic` is already kebab-case — callers normalise before invoking. Callers may pass `summary` and `description` when they have material to derive from (e.g. the user's opening response to "what topic"); when omitted, the item is created with routing + source only and the user can backfill via a later discovery session.

## Parameters

The caller provides these via context before loading:

- `work_type` — the work unit's type. The reference no-ops for any value other than `epic`.
- `work_unit` — the epic's work unit name. Always present.
- `topic` — the kebab-case topic name. Always present.
- `routing` — the literal `research` or `discussion`. Set by the caller based on which entry verb the user picked.
- `summary` — optional one-line summary. Written only on creation, only when provided and non-empty.
- `description` — optional paragraph or two of richer context. Written only on creation, only when provided and non-empty.

## A. Gate on Work Type

The discovery *map* is epic-only — a multi-topic map only makes sense when there's more than one topic. Single-phase work types (feature, bugfix, quick-fix, cross-cutting) have a single topic that *is* the work unit, so there's no map item to ensure. (They still pass through the discovery phase, and `phases.discovery` is a valid manifest location for every type — there's just no map to populate here.)

#### If `work_type` is `epic`

→ Proceed to **B. Check Existence**.

#### Otherwise

→ Return to caller.

## B. Check Existence

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery.{topic}
```

#### If output is non-empty (item exists)

The topic is already on the map. Nothing to do — fall through to the caller's existing flow.

→ Return to caller.

#### If output is empty (item does not exist)

→ Proceed to **C. Check Dismissed and Pull**.

## C. Check Dismissed and Pull

Most epics never dismiss anything, so the dismissed list is usually absent. Read it directly — empty stdout means the list is absent:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery dismissed
```

#### If output is empty (no dismissed list)

Nothing to pull.

→ Proceed to **D. Create Discovery Item**.

#### Otherwise

If `{topic}` appears in the returned JSON array, pull it (user-explicit spawns bypass dismissal):

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs pull {work_unit}.discovery dismissed "{topic}"
```

→ Proceed to **D. Create Discovery Item**.

## D. Create Discovery Item

Create the item with its routing and `source: direct-start` in one atomic call:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs create-discovery-topic {work_unit}.{topic} --routing {routing} --source direct-start --summary "{summary}" --description "{description}"
```

Assemble the flags as follows:

- `--routing {routing}` and `--source direct-start` — always included.
- `--summary "{summary}"` — included only when `summary` was supplied and is non-empty.
- `--description "{description}"` — included only when `description` was supplied and is non-empty (multi-paragraph values are fine).

Single-quote any value containing characters zsh would interpret — backticks, `$`, `[]`, `{}`, `~`.

No commit here — the manifest writes are folded into the next commit produced by the calling phase's process.

→ Return to caller.
