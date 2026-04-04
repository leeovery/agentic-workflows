# Display: Single Discussion — No Spec

*Reference for **[display-single.md](display-single.md)***

---

No specification exists for this discussion.

## Display

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Specification Overview
●───────────────────────────────────────────────●

Single completed discussion found.

1. {work_unit:(titlecase)}
   └─ Spec: [no spec]
   └─ Discussions:
      └─ {discussion-name} [ready]
```

#### If in-progress discussions exist

> *Output the next fenced block as a code block:*

```
⚑ Discussions not ready for specification:
  These discussions are still in progress and must be completed
  before they can be included in a specification.

  • {discussion-name}
```

### Key/Legend

No `---` separator before this section.

> *Output the next fenced block as a code block:*

```
Key:

  Discussion status:
    ready — completed and available to be specified
```

## After Display

> *Output the next fenced block as a code block:*

```
Automatically proceeding with "{work_unit:(titlecase)}".
```

Auto-proceed with verb **"Creating"**.

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions as written.
