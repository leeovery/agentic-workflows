# Confirm Trigger

*Reference for **[workflow-discovery](../SKILL.md)***

---

The single persistence hinge. Until the work-type commit, all shaping is ephemeral — nothing is on disk. This reference fires once, at the commit, and persists the work unit for **every** work type: derive the name → author the session log → one engine transaction that creates the work unit, lands imports and seed(s), installs the log, and commits. Routing by work type is deferred to **D**.

Inputs held from earlier steps: committed `work_type`, shaped one-line `description`, `import_paths` (paths the user shared during shaping, may be empty), `inbox_seeds` (the list of promoted inbox file paths, may be empty).

## A. Derive the Name

Load **[name-resolution.md](name-resolution.md)** and follow its instructions as written. On return, `work_unit` holds the derived kebab-case name.

→ On return, proceed to **B. Author the Session Log**.

## B. Author the Session Log

This work unit is brand new, so there are no prior sessions: `session_number` = `001`. Hold it for the epic topic machinery (Step 7 keeps it via `macro_continuation`).

Write the log content to the staging path `.workflows/.cache/{work_unit}/discovery/session-001.md`, following [template.md](template.md): populate the header, **Description (as of session)** (the shaped `description`), **Seed** (one line per `inbox_seeds` entry as `seeds/{filename} ({source})` with `source` = `inbox:{idea|bug|quickfix}` from the item's inbox folder — or `(none)`), **Imports** (one line per `import_paths` entry as `imports/{filename}` — or `(none)`), and **Map State at Start** — `(empty — first session)` for epic, `(n/a — single-topic work)` for the single-phase types. Backfill **Exploration** with a strong-summary of the shaping conversation so far (the intent and any topic seeds — prose, not transcript). Leave **Edits**, **Topics Identified**, and **Conclusion** as `(none)`.

For each listed `{filename}`, derive the landed name the way the engine will: split the source basename at its last dot, lowercase the stem, collapse whitespace/punctuation runs to `-` and trim any leading or trailing `-`; a markdown-ish extension (`.md`, `.markdown`, `.txt`, `.text`) or none lands `.md`, any other extension is kept, lowercased (an inbox basename just collapses its `--` separator). A source whose basename leads with a dot lands nothing whatever follows the dot, and so does one whose stem normalises away to nothing — both come back under `skipped_imports`, so neither gets a line.

This session log is the durable carrier: for single-phase types it (plus the manifest `description`) is what the first phase reads; for epic it seeds the topic synthesis. It is installed verbatim by the engine and not KB-indexed at creation; for epics, `engine discovery-session close` indexes it under the `discovery` phase at session close.

→ Proceed to **C. Create the Work Unit**.

## C. Create the Work Unit

One engine transaction persists everything: the manifest, imports copied into `imports/`, inbox seeds moved into `seeds/` (both manifest-tracked; knowledge-base-indexed where the landing is markdown), the staged session log installed as `discovery/sessions/session-001.md`, the epic `active_session` marker, and the scoped commit.

Pass one `--import` per `import_paths` entry and one `--seed` per `inbox_seeds` entry; omit either flag when its list is empty. A shared path is single-quoted — an image's filename carries spaces, and unquoted each word becomes its own positional — a `~` path is written out in full, since the quotes stop the shell expanding it, and a single quote inside a path is written `'\''`. `{description}` is the one-line intent compiled from the user's framing during shaping — single-quote it if it contains `[]`, `{}`, `~`, or backticks.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit create {work_unit} {work_type} --description "{description}" --session-log-file .workflows/.cache/{work_unit}/discovery/session-001.md --import '{path}' --seed {path}
```

#### If the response is `ok: false` with `missing_imports`

One or more import paths have nothing behind them, or name a folder rather than a file — nothing was created. Write the payload to `.workflows/.cache/{work_unit}/discovery/import-reprompt.json` with the Write tool (`{"missing": ["{path}", …]}` — the response's `missing_imports`, in its order), then render the re-prompt:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render import-reprompt --file .workflows/.cache/{work_unit}/discovery/import-reprompt.json
```

Emit the call's DISPLAY and MENU sections verbatim per their markers.

**STOP.** Wait for user response.

**If the answer names a path:**

Replace the refused entries in `import_paths` with the corrected value(s). The session log's **Imports** lines are derived from that list, so they are re-derived before the transaction runs again.

→ Return to **B. Author the Session Log**.

**If the answer is `skip`:**

Drop the refused entries from `import_paths` — they land nothing — and re-derive the log's **Imports** lines over what remains.

→ Return to **B. Author the Session Log**.

#### If the response is `ok: false` naming a work unit that already exists

The derived name is taken and nothing was created. Derive a different kebab-case name from the `description` — more specific than the one refused, never a numeric suffix — and hold it as `work_unit`. The staging path carries the name, so the log re-stages under it.

→ Return to **B. Author the Session Log**.

#### Otherwise

The work unit is on disk. The response reports what landed — if `skipped_imports` is non-empty (a basename leading with a dot, whatever follows it, or a stem that normalises away), or `warnings` carries knowledge-base indexing failures, mention them to the user in passing; neither blocks.

→ Proceed to **D. Route to the First Phase**.

## D. Route to the First Phase

Route by the committed `work_type`:

#### If `work_type` is `epic`

The work continues into the initial topic sketch — the same shaping, deepened. Hold `macro_continuation` = true and the `session_number` set in **B**.

→ Return to **[the skill](../SKILL.md)** for **Step 7**.

#### Otherwise

Single-phase work (feature / cross-cutting / bugfix / quick-fix). The single-phase endpoint determines the first phase, then the work concludes.

→ Return to **[the skill](../SKILL.md)** for **Step 13**.
