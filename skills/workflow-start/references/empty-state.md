# Empty State

*Reference for **[workflow-start](../SKILL.md)***

---

No active work found. Offer to start something new, with option to view completed/cancelled work if any exist.

## A. Display and Menu

Render the workflow overview snapshot — with no active work it carries the empty-state display and start menu:

```bash
node .claude/skills/workflow-start/scripts/gateway.cjs view
```

The output is one snapshot in three demarcated sections:

- **DATA** — reasoning surface: state flags, counts, and the `ACTIONS` table — one line per menu key, `key  action  work_unit  → route`, with `(pre_seed: …)` markers on start-new entries. Reason from it; never display or restate it.
- **DISPLAY** — the empty-state overview. Emit verbatim as a code block. Never redraw, reflow, or trim it.
- **MENU** — the start menu. Emit verbatim as markdown (not a code block).

Emit the DISPLAY section, then the signpost blockquote below, then the MENU section. A section is everything beneath its `===` marker up to the next marker — the marker lines themselves are never emitted.

> *Output the next fenced block as markdown (not a code block):*

```
> Pick a type if you know it, or start unsure and we'll figure out
> the shape together. Each type follows its own pipeline.
```

**STOP.** Wait for user response.

→ Proceed to **B. Handle Selection**.

---

## B. Handle Selection

Match the user's input to its `ACTIONS` entry by `key` — a command option's letter or long form. Every decision below reads the entry's `action` value, never its label text.

#### If `action` is `view_inbox`

Load **[start-from-inbox.md](start-from-inbox.md)** and follow its instructions as written.

→ Return to **A. Display and Menu**.

#### If `action` is `start_new`

→ Load **[route-to-discovery.md](route-to-discovery.md)** with work_type = `{pre_seed}`, inbox_seeds = `none`.

#### If `action` is `view_completed`

Load **[view-completed.md](view-completed.md)** and follow its instructions as written.

Re-run discovery to refresh state after potential changes.

→ Return to caller.
