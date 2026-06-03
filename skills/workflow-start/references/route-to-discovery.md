# Route to Discovery

*Reference for **[workflow-start](../SKILL.md)***

---

Invoke the discovery skill for new work. Every new-work pick routes here — the work type is a pre-seed (a hint discovery still confirms), or `none` for the unknown-shape `s`/start path.

Parameters the caller provides via context before loading:

- `work_type` — `epic` / `feature` / `bugfix` / `quick-fix` / `cross-cutting`, or `none`.
- `inbox_seeds` — comma-joined path(s) of the chosen inbox file(s), one or more, or `none`.

Invoke `/workflow-discovery {work_type} none "{inbox_seeds}"`. The work_unit argument is the literal `none` — new work has no work unit until discovery's confirm-trigger creates it. Quote the `{inbox_seeds}` argument so the path(s) pass intact regardless of their characters.

Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.
