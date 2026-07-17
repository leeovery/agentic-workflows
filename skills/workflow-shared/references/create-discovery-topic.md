# Create Discovery Topic

*Shared reference. Loaded by `workflow-research-process` (research split) and `triage-landing.md` (reroute to a new topic), and any flow that spawns a new discovery-map topic.*

---

Validates a proposed topic name, then writes the discovery item and — when a `phase` is given — its initial phase item via the engine's topic commands. The caller owns the user-facing framing around the new topic (seed file creation, map markers, the commit); this reference owns only the validate → create sequence and reports back through `result`.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name. Always present.
- `proposed_name` — the topic name the caller has picked and confirmed with the user. Always present.
- `routing` — the literal `research` or `discussion`. The new topic's initial routing intent.
- `source` — the provenance string for the discovery item (e.g. `research-split:{parent}`, `reroute:{origin}`).
- `phase` — optional, `research` or `discussion`. When set, the matching phase item is created alongside the discovery item.
- `summary` — optional one-line summary. Written only when provided and non-empty.
- `description` — optional paragraph or two of richer context. Written only when provided and non-empty.

After return, the caller reads these from conversation memory:

- `result` — `created` (topic written) or `cancelled` (user abandoned at the collision prompt).
- `created_topic` — the validated topic name. A distinct variable from any caller-side `{topic}`, so it never collides with a parent topic the caller is already tracking.

## A. Validate the Name

→ Load **[topic-name-validation.md](topic-name-validation.md)** with work_unit = `{work_unit}`, proposed_name = `{proposed_name}`.

#### If `result` is `collision-active`

The rejection is already rendered by topic-name-validation.md. Offer the choice:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
How would you like to proceed?

- **`c`/`cancel`** — Abandon creating this topic
- **Pick another** — Tell me a different name
· · · · · · · · · · · ·
```

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

Create the discovery item — `--force-dismissed` clears any matching dismissed entry (the user has confirmed this topic by name, so a prior dismissal never blocks it):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discovery-map add {work_unit} {created_topic} --routing {routing} --source "{source}" --summary "{summary}" --description "{description}" --force-dismissed
```

Assemble the flags as follows:

- `--routing {routing}`, `--source "{source}"`, and `--force-dismissed` — always included.
- `--summary "{summary}"` — included only when `summary` is present and non-empty.
- `--description "{description}"` — included only when `description` is present and non-empty.
- When `summary` is absent, pass `--backfill` in place of both fields — the next epic entry's summary-backfill drafts them.

Single-quote any value containing characters zsh would interpret — backticks, `$`, `[]`, `{}`, `~` — so the shell passes it through literally.

**If `phase` is set**, create the phase item:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} {phase} {created_topic}
```

Set `result = created`. No commit here — the caller folds these writes into its own commit.

→ Return to caller.
