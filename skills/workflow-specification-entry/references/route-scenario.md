# Route Based on State

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Based on discovery state, load exactly ONE reference file. Evaluate the branches in order and take the first that matches.

#### If `completed_count` == 1

→ Load **[display-single.md](display-single.md)** and follow its instructions as written.

#### If `proposed_count` > 0

Proposed items *are* the groupings — load them from the manifest.

→ Load **[display-groupings.md](display-groupings.md)** and follow its instructions as written.

#### If cache status is `valid` and `proposed_count` == 0 and `spec_count` == 0

The analysis ran but its groupings were never reconciled into proposed items (an in-flight epic with a valid checksum from before proposed items existed). Re-run the analysis to materialize them.

→ Load **[analysis-flow.md](analysis-flow.md)** and follow its instructions as written.

#### If `spec_count` == 0 and `proposed_count` == 0 and cache is `none` or `stale`

→ Load **[display-analyze.md](display-analyze.md)** and follow its instructions as written.

#### Otherwise

Materialized specs exist — offer analysis plus continue/refine. Mixed states (some specs started, some not yet) land here.

→ Load **[display-specs-menu.md](display-specs-menu.md)** and follow its instructions as written.
