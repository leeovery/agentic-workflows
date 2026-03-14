# Route Based on State

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Based on discovery state, load exactly ONE reference file:

#### If `completed_count` == 1

→ Load **[display-single.md](display-single.md)** and follow its instructions as written.

#### If cache status is `valid`

→ Load **[display-groupings.md](display-groupings.md)** and follow its instructions as written.

#### If `spec_count` == 0 and cache is `none` or `stale`

→ Load **[display-analyze.md](display-analyze.md)** and follow its instructions as written.

#### Otherwise

→ Load **[display-specs-menu.md](display-specs-menu.md)** and follow its instructions as written.
