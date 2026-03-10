# Display: Single Discussion — Grouped Spec

*Reference for **[display-single.md](display-single.md)***

---

This discussion is covered by a specification with multiple sources.

Use the spec for display. Show the spec name as the title. Show ALL the spec's sources (not just this discussion) with their statuses:
- `incorporated` + `discussion_status: completed` or `not-found` → `(extracted)`
- `incorporated` + `discussion_status: other` (e.g. `in-progress`) → `(extracted, reopened)`
- `pending` → `(pending)`

Extraction count: X = sources with `status: incorporated`, Y = total source count from the spec's `sources` array.

## Display

> *Output the next fenced block as a code block:*

```
Specification Overview

Single completed discussion found with existing multi-source specification.

1. {work_unit:(titlecase)}
   └─ Spec: {spec_status:[in-progress|completed]} ({X} of {Y} sources extracted)
   └─ Discussions:
      ├─ {source-name} (extracted)
      └─ {source-name} (extracted, reopened)
```

#### If in-progress discussions exist

> *Output the next fenced block as a code block:*

```
Discussions not ready for specification:
These discussions are still in progress and must be completed
before they can be included in a specification.

  • {discussion-name}
```

### Key/Legend

Show only the statuses that appear in the current display. No `---` separator before this section.

> *Output the next fenced block as a code block:*

```
Key:

  Discussion status:
    extracted — content has been incorporated into the specification
    pending   — listed as source but content not yet extracted
    reopened  — was extracted but discussion has regressed to in-progress

  Spec status:
    in-progress — specification work is ongoing
    completed   — specification is done
```

## After Display

> *Output the next fenced block as a code block:*

```
Automatically proceeding with "{work_unit:(titlecase)}".
```

Auto-proceed uses the spec name. Verb rule:
- Spec is `in-progress` → **"Continuing"**
- Spec is `completed` with pending sources → **"Continuing"**
- Spec is `completed` with all sources extracted → **"Refining"**

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions.
