# Name Derivation

*Reference for **[workflow-discovery](../SKILL.md)***

---

Derive the work unit's name. Loaded by [confirm-trigger.md](confirm-trigger.md) and by the roadmap pull ([pull.md](../../workflow-roadmap/references/pull.md)). On return, `work_unit` holds a kebab-case name.

Inputs held from earlier steps: `work_type`, `inbox_seeds` (the promoted inbox file path(s), if the work came from the inbox), and the shaped one-line `description`.

A name the user gave during shaping is the name. Otherwise, with a **single** inbox seed as the origin, use its **filename slug** — strip the `YYYY-MM-DD--` date prefix and the `.md` extension. With several seeds (no single slug to borrow) or none at all, derive it from the shaped `description`.

Kebab-case it and hold it as `work_unit`. Never put the name to the user.

→ Return to caller.
