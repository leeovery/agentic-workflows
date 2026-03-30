# Empty State

*Reference for **[workflow-start](../SKILL.md)***

---

No active work found. Offer to start something new, with option to view completed/cancelled work if any exist.

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Workflow Overview
●───────────────────────────────────────────────●

No active work found.

@if(completed_count > 0 || cancelled_count > 0)
{completed_count} completed, {cancelled_count} cancelled.
@endif
```

> *Output the next fenced block as markdown (not a code block):*

```
> **Each work type follows a different pipeline.** Features and
> epics can start with research or discussion, bugfixes start with
> investigation, quick-fixes go straight to scoping. If unsure,
> feature is the most common choice.

· · · · · · · · · · · ·
What would you like to start?

- **`f`/`feature`** — Single topic: (research →) discussion → spec → plan → implement → review
- **`e`/`epic`** — Multiple topics, multi-session, same pipeline per topic
- **`b`/`bugfix`** — Investigation → spec → plan → implement → review
- **`q`/`quick-fix`** — Scoping → implement → review (no formal planning)
- **`c`/`cross-cutting`** — (Research →) discussion → spec (patterns or policies that inform other work)
@if(has_inbox)
- **`i`/`inbox`** — Start from an inbox item ({inbox_count} items)
@endif
@if(completed_count > 0 || cancelled_count > 0)
- **`v`/`view`** — View completed & cancelled work units
@endif

Select an option:
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chose `i`/`inbox`

→ Load **[start-from-inbox.md](start-from-inbox.md)** and follow its instructions as written.

→ Return to caller.

#### If user chose `f`/`feature`, `e`/`epic`, `b`/`bugfix`, `q`/`quick-fix`, or `c`/`cross-cutting`

Invoke the selected skill:

| Selection | Invoke |
|-----------|--------|
| Feature | `/start-feature` |
| Epic | `/start-epic` |
| Bugfix | `/start-bugfix` |
| Quick-fix | `/start-quickfix` |
| Cross-cutting | `/start-cross-cutting` |

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.

#### If user chose `v`/`view`

→ Load **[view-completed.md](view-completed.md)** and follow its instructions as written.

Re-run discovery to refresh state after potential changes.

→ Return to caller.
