# Create Discovery Topic

*Shared reference. Loaded by `triage-landing.md` (reroute to a new topic) and any flow that creates a new discovery-map topic.*

---

Validates a proposed topic name, then writes the discovery item via the engine's topic commands. The caller owns the user-facing framing around the new topic (seed file creation, map markers, the commit); this reference owns only the validate → create sequence and reports back through `result`.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name. Always present.
- `proposed_name` — the topic name the caller has picked and confirmed with the user. Always present.
- `routing` — the literal `research` or `discussion`. The new topic's initial routing intent.
- `source` — the provenance string for the discovery item (e.g. `reroute:{origin}`).

After return, the caller reads these from conversation memory:

- `result` — `created` (topic written) or `cancelled` (user abandoned at the collision prompt).
- `created_topic` — the validated topic name. A distinct variable from any caller-side `{topic}`, so it never collides with a parent topic the caller is already tracking.

## A. Validate the Name

→ Load **[topic-name-validation.md](topic-name-validation.md)** with work_unit = `{work_unit}`, proposed_name = `{proposed_name}`.

#### If `result` is `collision-active`

The rejection is already rendered by topic-name-validation.md. Offer the choice:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render topic-collision-gate
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If `cancel`:**

Set `result = cancelled`.

→ Return to caller.

**If pick another:**

Set `proposed_name` to the new name.

→ Return to **A. Validate the Name**.

#### Otherwise

Set `created_topic` to the validated `proposed_name`.

→ Proceed to **B. Create the Topic**.

## B. Create the Topic

Create the discovery item — `--backfill` stands in for the summary and description the next epic entry's summary-backfill drafts, and `--force-dismissed` clears any matching dismissed entry (the user has confirmed this topic by name, so a prior dismissal never blocks it):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discovery-map add {work_unit} {created_topic} {routing} --source "{source}" --backfill --force-dismissed
```

Single-quote any value containing characters zsh would interpret — backticks, `$`, `[]`, `{}`, `~` — so the shell passes it through literally.

#### If the response is `ok: false` naming an active duplicate

The map moved since validation — a concurrent session landed the same name. Surface the engine's error verbatim, set `proposed_name` to the clashing name, and re-validate against the fresh map:

→ Return to **A. Validate the Name**.

#### Otherwise

Set `result = created`. No commit here — the caller folds this write into its own commit.

→ Return to caller.
