# Confirm Trigger

*Reference for **[workflow-discovery](../SKILL.md)***

---

The single persistence hinge. Until the work-type commit, all shaping is ephemeral — nothing is on disk. This reference fires once, at the commit, and persists the work unit for **every** work type: resolve the name → author the session log → one engine transaction that creates the work unit, lands imports and seed(s), installs the log, and commits. Routing by work type is deferred to **D**.

Inputs held from earlier steps: committed `work_type`, shaped one-line `description`, `import_paths` (paths the user shared during shaping, may be empty), `inbox_seeds` (the list of promoted inbox file paths, may be empty).

## A. Resolve the Name

Load **[name-resolution.md](name-resolution.md)** and follow its instructions as written. On return, `work_unit` is confirmed and collision-free.

→ Proceed to **B. Author the Session Log**.

## B. Author the Session Log

This work unit is brand new, so there are no prior sessions: `session_number` = `001`. Hold it for the epic topic machinery (Step 7 keeps it via `macro_continuation`).

Write the log content to the staging path `.workflows/.cache/{work_unit}/discovery/session-001.md`, following [template.md](template.md): populate the header, **Description (as of session)** (the shaped `description`), **Seed** (one line per `inbox_seeds` entry as `seeds/{filename} ({source})` with `source` = `inbox:{idea|bug|quickfix}` from the item's inbox folder — or `(none)`), **Imports** (one line per `import_paths` entry as `imports/{filename}` — or `(none)`), and **Map State at Start** — `(empty — first session)` for epic, `(n/a — single-topic work)` for the single-phase types. Backfill **Exploration** with a strong-summary of the shaping conversation so far (the intent and any topic seeds — prose, not transcript). Leave **Edits**, **Topics Identified**, and **Conclusion** as `(none)`.

For each listed `{filename}`, derive the landed name the way the engine will: the source basename lowercased, whitespace/punctuation runs collapsed to `-`, `.md` ensured (an inbox basename just collapses its `--` separator).

This session log is the durable carrier: for single-phase types it (plus the manifest `description`) is what the first phase reads; for epic it seeds the topic synthesis. It is installed verbatim by the engine and never KB-indexed — it is shape-talk, not validated substance.

→ Proceed to **C. Create the Work Unit**.

## C. Create the Work Unit

One engine transaction persists everything: the manifest (create-if-absent — an existing work unit is reused, never overwritten), imports copied into `imports/`, inbox seeds moved into `seeds/` (both manifest-tracked and knowledge-base-indexed), the staged session log installed as `discovery/sessions/session-001.md`, the epic `active_session` marker, and the scoped commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit create {work_unit} {work_type} --description "{description}" --session-log-file .workflows/.cache/{work_unit}/discovery/session-001.md --import {path} --seed {path}
```

Pass one `--import` per `import_paths` entry and one `--seed` per `inbox_seeds` entry; omit either flag when its list is empty. `{description}` is the one-line intent compiled from the user's framing during shaping — single-quote it if it contains `[]`, `{}`, `~`, or backticks.

#### If the response is `ok: false` with `missing_imports`

One or more import paths don't exist — nothing was created. Report them and re-prompt:

> *Output the next fenced block as markdown (not a code block):*

```
> One or more paths could not be found:
>   • {missing_path_1}
>   • {missing_path_2}

· · · · · · · · · · · ·
Provide the corrected file path(s):

- **Provide file paths** — one or more, space or newline separated
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

Replace the missing entries in `import_paths` with the corrected value(s).

→ Return to **C. Create the Work Unit**.

#### Otherwise

The work unit is on disk. The response reports what landed — if `skipped_imports` is non-empty (filenames that normalise to dotfiles are skipped), or `warnings` carries knowledge-base indexing failures, mention them to the user in passing; neither blocks.

→ Proceed to **D. Route to the First Phase**.

## D. Route to the First Phase

Route by the committed `work_type`:

#### If `work_type` is `epic`

The work continues into the initial topic sketch — the same shaping, deepened. Hold `macro_continuation` = true and the `session_number` set in **B**.

→ Return to **[the skill](../SKILL.md)** for **Step 7**.

#### Otherwise

Single-phase work (feature / cross-cutting / bugfix / quick-fix). The single-phase endpoint determines the first phase, then the work concludes.

→ Return to **[the skill](../SKILL.md)** for **Step 13**.
