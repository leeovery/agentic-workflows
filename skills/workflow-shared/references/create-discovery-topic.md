# Create Discovery Topic

*Shared reference. Loaded by `triage-landing.md` (reroute to a new topic) and any flow that creates a new discovery-map topic.*

---

Validates a derived topic name, then writes the discovery item via the engine's topic commands. The caller owns the user-facing framing around the new topic (seed file creation, map markers, the commit); this reference owns only the validate → create sequence and reports back the name it wrote.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name. Always present.
- `proposed_name` — the topic name the caller derived. Always present.
- `routing` — the literal `research` or `discussion`. The new topic's initial routing intent.
- `source` — the provenance string for the discovery item (e.g. `reroute:{origin}`).

After return, the caller reads this from conversation memory:

- `created_topic` — the validated topic name. A distinct variable from any caller-side `{topic}`, so it never collides with a parent topic the caller is already tracking.

## A. Validate the Name

→ Load **[topic-name-validation.md](topic-name-validation.md)** with work_unit = `{work_unit}`, proposed_name = `{proposed_name}`.

#### If `result` is `collision-active`

The name is on the map already. Derive a different kebab-case name from the concern in hand — never the current topic's name — set `proposed_name` to it, and re-validate:

→ Return to **A. Validate the Name**.

#### Otherwise

Set `created_topic` to the validated `proposed_name`.

→ Proceed to **B. Create the Topic**.

## B. Create the Topic

Create the discovery item — `--backfill` stands in for the summary and description the next epic entry's summary-backfill drafts, and `--force-dismissed` clears any matching dismissed entry (the creation is explicit — a reroute, a gap, a session add — so a prior dismissal never blocks it):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discovery-map add {work_unit} {created_topic} {routing} --source "{source}" --backfill --force-dismissed
```

Single-quote any value containing characters zsh would interpret — backticks, `$`, `[]`, `{}`, `~` — so the shell passes it through literally.

#### If the response is `ok: false` naming an active duplicate

The map moved since validation — a concurrent session landed the same name. Derive a different kebab-case name from the concern in hand, set `proposed_name` to it, and re-validate against the fresh map:

→ Return to **A. Validate the Name**.

#### Otherwise

No commit here — the caller folds this write into its own commit.

→ Return to caller.
