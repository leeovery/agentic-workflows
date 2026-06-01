# Confirm Trigger

*Reference for **[workflow-discovery](../SKILL.md)***

---

The single persistence hinge. Until the work-type commit, all shaping is ephemeral — nothing is on disk. This reference fires once, at the commit, and persists everything uniformly for **every** work type: resolve the name → create the work unit → land imports → archive the inbox seed → write the session log. No work-type branching here; the only parameter is `--work-type`.

Inputs held from earlier steps: committed `work_type`, shaped one-line `description`, `import_paths` (paths the user shared during shaping, may be empty), `inbox_seed` path (may be none).

## A. Resolve the Name

Load **[name-resolution.md](name-resolution.md)** and follow its instructions as written. On return, `work_unit` is confirmed and collision-free.

→ Proceed to **B. Create the Work Unit**.

## B. Create the Work Unit

Create-if-absent — in new mode the manifest never exists yet; the guard is plain correctness:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}
```

#### If output is `false` (absent)

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init {work_unit} --work-type {work_type} --description "{description}"
```

`{description}` is the one-line intent compiled from the user's framing during shaping. Single-quote the value if it contains `[]`, `{}`, `~`, or backticks.

→ Proceed to **C. Land Imports**.

#### Otherwise

The work unit already exists (defensive — should not occur after a clean name resolution). Do not overwrite. Reuse it as-is.

→ Proceed to **C. Land Imports**.

## C. Land Imports

#### If `import_paths` is non-empty

The user shared reference files during shaping. Land them now — copied into `imports/`, tracked in `manifest.imports[]`, indexed into the knowledge base so they surface via retrieval in this and every future phase.

→ Load **[import-files.md](import-files.md)** with work_unit = `{work_unit}`, import_paths = `{import_paths}`.

→ Proceed to **D. Archive the Inbox Seed**.

#### Otherwise

No imports.

→ Proceed to **D. Archive the Inbox Seed**.

## D. Archive the Inbox Seed

#### If an inbox seed was the origin

The seed is consumed — its substance has shaped the conversation (and is backfilled into the session log in **E**). Archive it (never delete, never copy into `imports/`). Match the folder to the seed's source (`bugs`, `quickfixes`, or `ideas`):

```bash
mkdir -p .workflows/.inbox/.archived/{folder}
mv .workflows/.inbox/{folder}/{file} .workflows/.inbox/.archived/{folder}/{file}
```

Archival fires at the same trigger as manifest creation — there is no window where a manifest exists but the inbox file is still pending.

→ Proceed to **E. Write the Session Log**.

#### Otherwise

No inbox seed.

→ Proceed to **E. Write the Session Log**.

## E. Write the Session Log

This work unit is brand new, so there are no prior sessions: `session_number` = `001`. Hold it for the epic topic machinery (Step 7 keeps it via `macro_continuation`).

Ensure the directory exists and create the log from [template.md](template.md):

```bash
mkdir -p .workflows/{work_unit}/discovery/
```

Write `.workflows/{work_unit}/discovery/session-001.md` populating the header, **Description (as of session)** (the shaped `description`), **Imports** (the landed import paths, or `(none)`), and **Map State at Start** — `(empty — first session)` for epic, `(n/a — single-topic work)` for the single-phase types. Backfill **Exploration** with a strong-summary of the shaping conversation so far (the intent and any topic seeds — prose, not transcript). Leave **Edits**, **Topics Identified**, and **Conclusion** as `(none)`.

This session log is the durable carrier: for single-phase types it (plus the manifest `description`) is what the first phase reads; for epic it seeds the topic synthesis. Do not KB-index it — it is shape-talk, not validated substance.

Set the active-session marker — only for epics, the sole work type with a resumable discovery session loop:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery active_session "001"
```

→ Proceed to **F. Commit**.

## F. Commit

Stage and commit the new work unit:

```bash
git add -- .workflows/{work_unit}/ .workflows/.inbox/
git commit -m "discovery({work_unit}): create work unit ({work_type})"
```

The `.workflows/.inbox/` path is staged so the inbox archival (if any) lands in the same commit.

→ Proceed to **G. Route to the First Phase**.

## G. Route to the First Phase

The work unit is on disk. Route by the committed `work_type`:

#### If `work_type` is `epic`

The work continues into the initial topic sketch — the same shaping, deepened. Hold `macro_continuation` = true and the `session_number` set in **E**.

→ Return to **[the skill](../SKILL.md)** for **Step 7**.

#### Otherwise

Single-phase work (feature / cross-cutting / bugfix / quick-fix). The single-phase endpoint determines the first phase, then the work concludes.

→ Return to **[the skill](../SKILL.md)** for **Step 13**.
