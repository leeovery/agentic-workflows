# Read the Topic's Discovery Brief

*Shared reference. Loaded by the research and discussion processing skills at initialisation, and by the reconcile advisory over a regenerated brief.*

---

An epic topic's **discovery brief** is its read-in-full starting context for the next phase — one topic's slice of the discovery record, projected from the source-of-truth session logs. It plays the role a seed plays for a work unit, but is a distinct artifact — never call it a seed.

Caller passes `work_type`, `work_unit`, `topic`.

## A. Read the Brief

#### If `work_type` is not `epic`

Nothing to read here — briefs exist only for epics (the inverse of `seed-context.md`, which acts for non-epic work and no-ops for epics).

→ Return to caller.

#### Otherwise

Read the topic's brief pointer:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discovery.{topic} brief_path
```

**If `brief_path` is present and the brief file exists:**

Read the file at `brief_path` in full — the *discovery brief* — and use it as the starting context for this phase. `brief_path` is relative to the work unit directory: `.workflows/{work_unit}/{brief_path}` (canonically `.workflows/{work_unit}/discovery/briefs/{topic}.md`). Don't dump it back to the user verbatim. It is soft by location: provisional rather than fixed. Ratifying it means carrying it forward as the working position and letting this phase's findings test it — never re-eliciting decisions discovery already reached with the user.

→ Proceed to **B. Track the Read**.

**Otherwise:**

No brief — an un-harvested, migration-seeded, or legacy topic. Fall back to the discovery item `description` and seed this phase from it (it may be empty, in which case the session gathers context naturally):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discovery.{topic} description
```

→ Proceed to **B. Track the Read**.

## B. Track the Read

Record that the brief (or its fallback) has been read:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discovery.{topic} brief_incorporated true
```

No commit — this folds into the calling phase's next commit.

→ Return to caller.
