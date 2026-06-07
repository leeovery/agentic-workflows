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

→ Proceed to **C. Create Discovery Item**.

## C. Create Discovery Item

The item does not exist. Create it via the shared topic-creation core, which pulls the name from the dismissed list (a no-op when absent) and writes the discovery item atomically. Pass `summary`/`description` only when the caller supplied non-empty values — omit the parameter otherwise so the key is left absent:

→ Load **[create-topic.md](create-topic.md)** with work_unit = `{work_unit}`, proposed_name = `{topic}`, routing = `{routing}`, source = `direct-start`, summary = `{summary}`, description = `{description}`.

No commit here — the manifest write is folded into the next commit produced by the calling phase's process.

→ Return to caller.
