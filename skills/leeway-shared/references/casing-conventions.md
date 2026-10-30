# Casing Conventions

*Shared reference for all workflow skills.*

---

Template placeholders use casing hints to transform identifiers for display. The syntax is `{name:(casing)}`.

When a casing hint is present, apply the transformation below. When no hint is present, output the value as-is.

## Transformations

**titlecase** — Human-readable display name. Split on hyphens and underscores, capitalize the first letter of each word, join with spaces.

- `auth-flow` → `Auth Flow`
- `data-model` → `Data Model`
- `user_settings` → `User Settings`

**kebabcase** — Lowercase identifier with hyphens. Split on spaces and underscores, lowercase all characters, join with hyphens.

- `Auth Flow` → `auth-flow`
- `Data Model` → `data-model`

**lowercase** — Lowercase all characters. Separators (spaces, hyphens) are preserved.

- `Discussion` → `discussion`
- `In-Progress` → `in-progress`

→ Return to caller.
