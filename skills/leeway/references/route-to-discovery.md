# Route to Discovery

*Reference for **[leeway](../SKILL.md)***

---

Hand new work to discovery at no work unit, the product's conversation. Every new-work pick routes here: the work type is a pre-seed (a hint discovery still confirms), or `none` for the unknown-shape `s/start` path, which travels as `start` so discovery opens on a piece of work rather than on the product's conversation.

Parameters the caller provides via context before loading:

- `work_type` — `epic` / `feature` / `bugfix` / `quick-fix` / `cross-cutting`, or `none`.
- `inbox_seeds` — comma-joined path(s) of the chosen inbox file(s), one or more, or `none`.

`{way_in}` is `work_type`, or `start` where it is `none`.

→ Load **[handing-off.md](../../leeway-shared/references/handing-off.md)** with route = `/leeway-discovery {way_in} none "{inbox_seeds}"`.
