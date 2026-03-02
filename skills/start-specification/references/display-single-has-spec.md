# Display: Single Discussion — Has Spec

*Reference for **[display-single.md](display-single.md)***

---

An individual specification exists for this discussion.

Determine extraction count: check the spec's `sources` array from discovery. Count how many have `status: incorporated` vs total.

## Display

> *Output the next fenced block as a code block:*

```
Specification Overview

Single concluded discussion found with existing specification.

1. {work_unit:(titlecase)}
   └─ Spec: {spec_status:[in-progress|concluded]} ({X} of {Y} sources extracted)
   └─ Discussions:
      └─ {discussion-name} (extracted)
```

### If in-progress discussions exist

> *Output the next fenced block as a code block:*

```
Discussions not ready for specification:
These discussions are still in progress and must be concluded
before they can be included in a specification.

  • {discussion-name}
```

### Key/Legend

No `---` separator before this section.

> *Output the next fenced block as a code block:*

```
Key:

  Discussion status:
    extracted — content has been incorporated into the specification

  Spec status:
    in-progress — specification work is ongoing
    concluded   — specification is complete
```

## After Display

> *Output the next fenced block as a code block:*

```
Automatically proceeding with "{work_unit:(titlecase)}".
```

Auto-proceed. Verb rule:
- Spec is `in-progress` → **"Continuing"**
- Spec is `concluded` with pending sources → **"Continuing"**
- Spec is `concluded` with all sources extracted → **"Refining"**

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions.
