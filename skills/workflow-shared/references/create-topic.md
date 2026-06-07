# Create Topic

*Shared reference. Loaded by `workflow-discussion-process`, `workflow-research-process`, `workflow-discovery`, and any flow that adds a topic to an epic's discovery map.*

---

Validates a proposed topic name, clears any matching dismissed entry, and atomically creates the discovery-map item (and, when a phase is given, that phase's item). The caller has already picked the name and generated any summary/description — this reference owns the validate → pull → create core only. It writes the manifest but does **not** commit; the caller's commit covers the manifest writes alongside the artefact it creates.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name. Always present.
- `proposed_name` — the caller's kebab-case topic name. May change if the validation loop re-prompts.
- `routing` — the literal `research` or `discussion` (the discovery item's initial intent).
- `source` — the provenance string written to the discovery item (e.g. `discussion-elevation:{parent}`, `research-split:{parent}`, `direct-start`, `incoming:{origin}`).
- `phase` — optional. The literal `research` or `discussion` to also create a phase item. Omit to create the discovery item only.
- `summary` — optional one-line summary for the discovery item.
- `description` — optional paragraph or two of richer context for the discovery item.

After return, the caller reads these from conversation memory:

- `result` — `created` (manifest written, dirty, ready for the caller's commit) or `cancelled` (nothing written; caller handles abandonment).
- `created_topic` — the final validated topic name (the caller uses it for the artefact path, marker, and commit).

## A. Validate the Name

→ Load **[topic-name-validation.md](topic-name-validation.md)** with work_unit = `{work_unit}`, proposed_name = `{proposed_name}`.

Read `result` from the validation reference.

#### If `result` is `collision-active`

The name is taken. Re-prompt the user for an alternative, then re-validate.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
That name is already on the map.

- **`c`/`cancel`** — Drop this topic
- **Pick another** — Tell me a different name to use
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `cancel`:**

Set `result = "cancelled"`.

→ Return to caller.

**If pick another:**

Set `proposed_name` to the user's name (normalised to kebab-case).

→ Return to **A. Validate the Name**.

#### Otherwise

The validation returned `ok` or `matches-dismissed`. Set `created_topic` to the validated name.

→ Proceed to **B. Clear Dismissed**.

## B. Clear Dismissed

User-explicit spawns bypass the dismissed list. Pull the name unconditionally — a no-op when it is absent or the list does not exist:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs pull {work_unit}.discovery dismissed "{created_topic}"
```

→ Proceed to **C. Create the Topic**.

## C. Create the Topic

Run `create-topic`. Include `--phase {phase}` only when `phase` is set; include `--summary` / `--description` only when those values are present:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs create-topic {work_unit}.{created_topic} \
  --phase {phase} \
  --routing {routing} \
  --source "{source}" \
  --summary "{summary}" \
  --description "{description}"
```

The discovery item lands with `status`, `routing`, `source`, and any `summary`/`description`; `--phase` additionally creates that phase's item with status only. The write is atomic — a single locked write, no half-built state.

Set `result = "created"`. The manifest is dirty; the caller's commit covers it.

→ Return to caller.
