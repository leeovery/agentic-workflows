# Route Based on State

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Route on `scenario` from the Step 1 DATA section. Load exactly ONE reference file.

#### If `scenario` is `single`

→ Load **[display-single.md](display-single.md)** and follow its instructions as written.

#### If `scenario` is `groupings`

Proposed items *are* the groupings.

→ Load **[display-groupings.md](display-groupings.md)** and follow its instructions as written.

#### If `scenario` is `analysis-rerun`

The analysis ran but its groupings were never reconciled into proposed items (an in-flight epic with a valid checksum from before proposed items existed). Re-run the analysis to materialize them.

→ Load **[analysis-flow.md](analysis-flow.md)** and follow its instructions as written.

#### If `scenario` is `analyze`

→ Load **[display-analyze.md](display-analyze.md)** and follow its instructions as written.

#### If `scenario` is `specs-menu`

Materialized specs exist — offer analysis plus continue/refine. Mixed states (some specs started, some not yet) land here.

→ Load **[display-specs-menu.md](display-specs-menu.md)** and follow its instructions as written.
