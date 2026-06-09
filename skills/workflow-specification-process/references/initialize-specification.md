# Initialize Specification

*Reference for **[workflow-specification-process](../SKILL.md)***

---

## A. Create the Specification File

→ Load **[specification-format.md](specification-format.md)** and follow its instructions as written.

Create the file at `.workflows/{work_unit}/specification/{topic}/specification.md` using the body template (title + specification section + working notes section).

Write the file **before** any manifest change. If a crash interrupts here the item stays `proposed` with a file on disk — the resume path recovers it on the next run via restart.

→ Proceed to **B. Register or Flip the Item**.

---

## B. Register or Flip the Item

Read the manifest item status:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.specification.{topic} status
```

#### If the output is empty

The item is genuinely new (feature/bugfix, or a fresh single-discussion create). Register it, then add every source with `status: pending`:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.specification.{topic}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.{topic} sources.{source-name}.status pending
```

→ Proceed to **C. Set Review State**.

#### If the status is `proposed`

The grouping already exists as a proposed item — flip it to in-progress. Never run `init-phase`; the item exists and `init-phase` errors on an existing item:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.{topic} status in-progress
```

The proposed item already carries its grouping's sources as `pending` rows. For any source in this session not already present, add it — never overwrite an existing row:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.{topic} sources.{source-name}.status pending
```

→ Proceed to **C. Set Review State**.

---

## C. Set Review State

Set review state and gate modes (both branches):

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.{topic} review_cycle 0
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.{topic} finding_gate_mode gated
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.{topic} construction_gate_mode gated
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.{topic} date $(date +%Y-%m-%d)
```

Commit: `spec({work_unit}): initialize specification`

→ Return to caller.
