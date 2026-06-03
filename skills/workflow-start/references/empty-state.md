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
> Pick a type if you know it, or start unsure and we'll figure out
> the shape together. Each type follows its own pipeline.

· · · · · · · · · · · ·
What would you like to start?

- **`s`/`start`** — Not sure what kind yet — describe it and we'll shape it
- **`f`/`feature`** — Single topic: (research →) discussion → spec → plan → implement → review
- **`e`/`epic`** — Multiple topics, multi-session, same pipeline per topic
- **`b`/`bugfix`** — Investigation → spec → plan → implement → review
- **`q`/`quick-fix`** — Scoping → implement → review (no formal planning)
- **`c`/`cross-cutting`** — (Research →) discussion → spec (patterns or policies that inform other work)
@if(has_inbox)
- **`i`/`inbox`** — View the inbox and start from an item ({inbox_count} items)
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

#### If user chose a start-new option (`s`, `f`, `e`, `b`, `q`, or `c`)

Set the work-type pre-seed from the pick — `s` → `none`, otherwise the matching type (feature / epic / bugfix / quick-fix / cross-cutting).

→ Load **[route-to-discovery.md](route-to-discovery.md)** with work_type = `{work_type}`, inbox_seeds = `none`.

#### If user chose `v`/`view`

→ Load **[view-completed.md](view-completed.md)** and follow its instructions as written.

Re-run discovery to refresh state after potential changes.

→ Return to caller.
