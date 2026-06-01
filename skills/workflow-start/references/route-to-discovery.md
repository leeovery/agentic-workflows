# Route to Discovery

*Reference for **[workflow-start](../SKILL.md)***

---

Invoke the umbrella discovery skill for new work. Every new-work pick routes here — the work type is a pre-seed (a hint discovery still confirms), or `none` for the unknown-shape `s`/start path.

Parameters the caller provides via context before loading:

- `work_type` — `epic` / `feature` / `bugfix` / `quick-fix` / `cross-cutting`, or `none`.
- `inbox_seed` — path to the chosen inbox file, or `none`.

Invoke `/workflow-discovery {work_type} none {inbox_seed}`. The work_unit argument is the literal `none` — new work has no work unit until discovery's confirm-trigger creates it.

Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.
