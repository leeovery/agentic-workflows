# Initialize Specification

*Reference for **[workflow-specification-process](../SKILL.md)***

---

## A. Create the Specification File

→ Load **[specification-format.md](specification-format.md)** and follow its instructions as written.

Create the file at `.workflows/{work_unit}/specification/{topic}/specification.md` using the body template (title + specification section + working notes section).

Write the file **before** any manifest change. If a crash interrupts here the item keeps the status it had, and the next start writes the file again.

→ On return, proceed to **B. Register or Flip the Item**.

---

## B. Register or Flip the Item

Start the phase item — the engine creates it with `status: in-progress` when absent, or flips an existing proposed (or restarted) item to in-progress:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} specification {topic}
```

Branch on the response's `created` flag:

#### If `created` is `true`

The item is genuinely new (a feature, bugfix, or cross-cutting unit — an epic's specification starts from the proposed grouping its menu landed). Add its one source with `status: pending` — the unit's discussion, or a bugfix's investigation, named `{topic}` either way; the same name is used when marking it incorporated:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} sources.{topic}.status pending
```

→ Proceed to **C. Set Review State**.

#### If `created` is `false`

The item already existed (a proposed grouping, or a restart) and already carries its sources.

→ Proceed to **C. Set Review State**.

---

## C. Set Review State

Set review state and gate modes (both branches) — one batched write, all same-path fields:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} review_cycle=0 finding_gate_mode=gated construction_gate_mode=gated date=$(date +%Y-%m-%d)
```

Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): initialize specification" --topic specification/{topic}
```

→ Return to caller.
