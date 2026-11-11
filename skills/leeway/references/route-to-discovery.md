# Route to Discovery

*Reference for **[leeway](../SKILL.md)***

---

Hand the working set's items to discovery at no work unit, the product's conversation, as new work: the work type is a pre-seed (a hint discovery still confirms), or `none` for a set of no one shape, which travels as `start` so discovery opens on a piece of work rather than on the product's conversation.

Parameters the caller provides via context before loading:

- `work_type` — `epic` / `feature` / `bugfix` / `quick-fix`, or `none`.
- `inbox_seeds` — comma-joined path(s) of the chosen inbox file(s), one or more.

`{way_in}` is `work_type`, or `start` where it is `none`.

→ Load **[handing-off.md](../../leeway-shared/references/handing-off.md)** with route = `/leeway-discovery {way_in} none "{inbox_seeds}"`.
