# Confirm Trigger

*Reference for **[workflow-discovery](../SKILL.md)***

---

The single persistence hinge. Until the work-type commit, all shaping is ephemeral — nothing is on disk. This reference fires once, at the commit, and persists the work unit for **every** work type: resolve the name → create it → land imports → land the seed(s) → write the session log. Persistence is uniform except two epic-specific touches in **E** (the session log's *Map State at Start* wording and the active-session marker); routing by work type is deferred to **G**.

Inputs held from earlier steps: committed `work_type`, shaped one-line `description`, `import_paths` (paths the user shared during shaping, may be empty), `inbox_seeds` (the list of promoted inbox file paths, may be empty).

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

→ Proceed to **D. Land the Seeds**.

#### Otherwise

No imports.

→ Proceed to **D. Land the Seeds**.

## D. Land the Seeds

#### If inbox seeds were the origin

Land each promoted inbox file as a seed of the work unit. For every path in `inbox_seeds`, derive the seed's type from its inbox folder (`bugs` → `bug`, `quickfixes` → `quickfix`, `ideas` → `idea`) and land it — repeat until all are landed:

→ Load **[land-seed.md](land-seed.md)** with work_unit = `{work_unit}`, seed_path = `{path}`, source = `inbox:{type}`.

→ Proceed to **E. Write the Session Log**.

#### Otherwise

No inbox seeds.

→ Proceed to **E. Write the Session Log**.

## E. Write the Session Log

This work unit is brand new, so there are no prior sessions: `session_number` = `001`. Hold it for the epic topic machinery (Step 7 keeps it via `macro_continuation`).

Ensure the directory exists and create the log from [template.md](template.md):

```bash
mkdir -p .workflows/{work_unit}/discovery/sessions/
```

Write `.workflows/{work_unit}/discovery/sessions/session-001.md` populating the header, **Description (as of session)** (the shaped `description`), **Seed** (the landed seed path(s) from **D** — read from `manifest.seeds[]`, listing each — or `(none)`), **Imports** (the landed import paths from **C** — read from `manifest.imports[]` — or `(none)`), and **Map State at Start** — `(empty — first session)` for epic, `(n/a — single-topic work)` for the single-phase types. Backfill **Exploration** with a strong-summary of the shaping conversation so far (the intent and any topic seeds — prose, not transcript). Leave **Edits**, **Topics Identified**, and **Conclusion** as `(none)`.

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

The `.workflows/.inbox/` path is staged so the inbox seeds' removal (for any promoted in **D**) lands in the same commit as their new home under `seeds/`.

→ Proceed to **G. Route to the First Phase**.

## G. Route to the First Phase

The work unit is on disk. Route by the committed `work_type`:

#### If `work_type` is `epic`

The work continues into the initial topic sketch — the same shaping, deepened. Hold `macro_continuation` = true and the `session_number` set in **E**.

→ Return to **[the skill](../SKILL.md)** for **Step 7**.

#### Otherwise

Single-phase work (feature / cross-cutting / bugfix / quick-fix). The single-phase endpoint determines the first phase, then the work concludes.

→ Return to **[the skill](../SKILL.md)** for **Step 13**.
