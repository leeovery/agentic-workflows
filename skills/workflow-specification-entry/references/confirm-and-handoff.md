# Confirm and Handoff

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

## Verb Rule

- No spec exists → **"Creating"**
- Spec is `in-progress` → **"Continuing"**
- Spec is `completed` with pending sources → **"Continuing"**
- Spec is `completed` with all sources extracted → **"Refining"**

## Route

#### If selection is `Unify all`

→ Load **[confirm-unify.md](confirm-unify.md)** and follow its instructions as written.

#### If verb is `Creating`

→ Load **[confirm-create.md](confirm-create.md)** and follow its instructions as written.

#### If verb is `Continuing`

→ Load **[confirm-continue.md](confirm-continue.md)** and follow its instructions as written.

#### If verb is `Refining`

→ Load **[confirm-refine.md](confirm-refine.md)** and follow its instructions as written.
