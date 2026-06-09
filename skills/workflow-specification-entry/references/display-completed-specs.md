# Completed Specifications

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Loaded from the primary spec menu when the user picks `c`/`completed`. Lists the concluded specs — `status: completed` with `has_pending_sources: false` — from the discovery `specifications[]` array. These have no pending work, so each is a flat one-line Refine entry; no tree.

> *Output the next fenced block as a code block:*

```
Completed Specifications
```

Present one numbered entry per concluded spec, in `specifications[]` order, then a `back` command option.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which completed specification would you like to refine?

- **`1`** — Refine "Auth Flow" — completed
- **`2`** — Refine "Data Model" — completed
- **`b`/`back`** — Return to the specifications menu

Select an option:
· · · · · · · · · · · ·
```

Recreate with actual specs from discovery.

**STOP.** Wait for user response.

#### If user picks a spec

The selected spec and its sources become the context for confirmation.

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions as written.

#### If user picks `b`/`back`

→ Return to caller.
