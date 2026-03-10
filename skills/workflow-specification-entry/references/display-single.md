# Display: Single Discussion

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Auto-proceed path — only one completed discussion exists, so no selection menu is needed.

## Route by Spec Coverage

Check if a spec covers this discussion — either by name match (`has_individual_spec`) or by listing it in a spec's `sources` array.

#### If a spec covers this discussion and has a single source

→ Load **[display-single-has-spec.md](display-single-has-spec.md)** and follow its instructions.

#### If a spec covers this discussion and has multiple sources

→ Load **[display-single-grouped.md](display-single-grouped.md)** and follow its instructions.

#### Otherwise

→ Load **[display-single-no-spec.md](display-single-no-spec.md)** and follow its instructions.
