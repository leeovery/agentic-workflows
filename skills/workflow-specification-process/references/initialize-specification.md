# Initialize Specification

*Reference for **[workflow-specification-process](../SKILL.md)***

---

## A. Create the Specification File

→ Load **[specification-format.md](specification-format.md)** and follow its instructions as written.

Create the file at `.workflows/{work_unit}/specification/{topic}/specification.md` using the body template (title + specification section + working notes section).

Write the file **before** any manifest change. If a crash interrupts here the item stays `proposed` with a file on disk — the resume path recovers it on the next run via restart.

→ On return, proceed to **B. Register or Flip the Item**.

---

## B. Register or Flip the Item

Start the phase item — the engine creates it with `status: in-progress` when absent, or flips an existing proposed (or restarted) item to in-progress:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} specification {topic}
```

Branch on the response's `created` flag:

#### If `created` is `true`

The item is genuinely new (feature/bugfix, or a fresh single-discussion create). Add every source with `status: pending`. For a bugfix the single source is the investigation and its `{source-name}` is `{topic}` — the same name must be used when marking it incorporated:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} sources.{source-name}.status pending
```

→ Proceed to **C. Set Review State**.

#### If `created` is `false`

The item already existed (a proposed grouping, or a restart) and already carries its sources. For any source in this session not already present, add it — never overwrite an existing row:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} sources.{source-name}.status pending
```

→ Proceed to **C. Set Review State**.

---

## C. Set Review State

Set review state and gate modes (both branches) — one batched write, all same-path fields:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} review_cycle=0 finding_gate_mode=gated construction_gate_mode=gated date=$(date +%Y-%m-%d)
```

Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): initialize specification"
```

→ Return to caller.
