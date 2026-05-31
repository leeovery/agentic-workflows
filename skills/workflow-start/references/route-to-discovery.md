# Route to Discovery

*Reference for **[workflow-start](../SKILL.md)***

---

Construct the discovery handoff and invoke the umbrella discovery skill. Every new-work pick routes here — the work type is a pre-seed (a hint discovery still confirms), or `(none)` for the unknown-shape `s`/start path.

Parameters the caller provides via context before loading:

- `work_type` — `epic` / `feature` / `bugfix` / `quick-fix` / `cross-cutting`, or `(none)`.
- `inbox_seed` — path to the chosen inbox file, or `(none)`.

Render the handoff:

```
Discovery handoff
Mode: new
Work type (pre-seed): {work_type}
Inbox seed: {inbox_seed}

Invoke the workflow-discovery skill.
```

Invoke the [workflow-discovery](../../workflow-discovery/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.
