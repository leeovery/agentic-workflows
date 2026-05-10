# Refinement Session

*Reference for **[workflow-inception-process](../SKILL.md)***

---

This reference drives the re-entry path into inception. Items already exist on the discovery map; the user's intent is to refine — add, edit, remove, rename, or re-route topics.

The convention is conversational, not menu-driven. STOP gates wrap manifest writes, scaled to destructiveness — additive operations batch, destructive operations are per-item. The map-operations reference owns parsing, validation, and persistence; this file owns the conversation shape.

Two anti-patterns to avoid:

- **Do not call `knowledge index`.** Inception session logs (initial or refinement) are journey records, not retrievable artifacts.
- **Do not set a phase-level `status: completed`.** Inception remains alive as long as the work unit is in-progress.

## A. Read State

> *Output the next fenced block as a code block:*

```
── Read Map State ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading current inception items and per-topic lifecycle from
> the manifest. The map is the source of truth — no file reads
> needed for state.
```

Load the work unit's manifest and read `phases.inception.items.*`. For each topic, compute its lifecycle using `computeTopicLifecycle(manifest, topicName)` from `skills/workflow-shared/scripts/discovery-utils.cjs`. The returned `{ lifecycle, tier, current_phase }` informs which operations are allowed in the operations loop.

Also read `phases.inception.dismissed` (an array of previously removed topic names; may be missing or empty). The dismissed list governs name collision and the show-dismissed flow.

→ Proceed to **B. Self-Healing Check**.

## B. Self-Healing Check

> *Output the next fenced block as a code block:*

```
── Self-Healing Check ───────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Phase 6 placeholder — self-healing analyses (research-analysis,
> gap-analysis) are wired in Phase 7. Nothing runs here yet.
```

No-op for Phase 6. Phase 7 will run the analyses inline at this point and apply results to the map (auto-add with `source: research-analysis` or `source: gap-analysis`, filtered against `phases.inception.dismissed`).

→ Proceed to **C. Open Refinement**.

## C. Open Refinement

> *Output the next fenced block as a code block:*

```
── Open Refinement ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Refining the discovery map. Tell me what to change — add,
> edit, remove, rename, or re-route topics. Multiple changes in
> one message are fine; I'll work through them.
```

### C.1. Initialise the refinement session log

Determine the next session number:

```bash
n=$(ls .workflows/{work_unit}/inception/session-*.md 2>/dev/null | wc -l)
next=$(printf "%03d" $((n + 1)))
```

Create `.workflows/{work_unit}/inception/session-{next}.md` from **[refinement-template.md](refinement-template.md)**. Populate the header (date, work unit), fill **Map State at Start** with the summary line computed in **A. Read State**, leave **Self-Healing Arrivals**, **Changes**, and **Conclusion** as `(none)` placeholders — they fill in during the session.

Commit:

```bash
git add -- .workflows/{work_unit}/inception/session-{next}.md
git commit -m "inception({work_unit}): seed refinement session log"
```

### C.2. Render the map and prompt

Render the current map as a compact anchor for the conversation:

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Refinement — {work_unit:(titlecase)}
●───────────────────────────────────────────────●

  Discovery Map ({summary_line})

@foreach(topic in discovery_map)
  @if(not last_topic) ├─ @else └─ @endif {topic.tier}  {topic.name:(titlecase)}  {lifecycle_label}
@endforeach
```

**Render rules** (subset of continue-epic's discovery map block):

- `summary_line`: `{total} topics — {decided} decided · {in_flight} in flight · {ready} ready · {fresh} fresh · {cancelled} cancelled`. Omit zero-count categories. Always include `{total} topics`.
- Tier and ordering — sort by tier rank `→ ◐ ✓ ○ ⊘`, alphabetical within each tier (matches continue-epic).
- `lifecycle_label` by tier:
  - `→` — `research complete · ready for discussion`
  - `◐` — `researching` or `discussing` (use `current_phase`)
  - `✓` — `decided`
  - `○` — `fresh · routed to {topic.routing}` (omit ` · routed to ...` if `routing` is null)
  - `⊘` — `cancelled`
- No source provenance sub-line, no key block, no menu — this is an anchor, not the continue-epic display.

> *Output the next fenced block as a code block:*

```
What would you like to change?
```

**STOP.** Wait for user response.

→ Proceed to **D. Operations Loop**.

## D. Operations Loop

Phase 6 wiring landed in a follow-up commit. Until then, this section is a stub — when the user's first message arrives, route directly to **E. Conclude** so the bridge still resolves cleanly.

→ Proceed to **E. Conclude**.

## E. Conclude

> *Output the next fenced block as a code block:*

```
── Conclude Refinement ──────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Wrapping up. Finalising the session log, running compliance
> self-check, and bridging back to the epic menu.
```

### E.1. Finalise the session log

Populate the **Conclusion** section of the in-progress `inception/session-{NNN}.md` with the change count and current map size. Skip the line if no changes were made (a "browse-only" refinement is a valid outcome).

### E.2. Compliance self-check

Load **[compliance-check.md](../../workflow-shared/references/compliance-check.md)** and follow its instructions as written. The check audits the refinement against this file and the parent SKILL.md (plus any other references loaded during the session). Apply silent corrections inline; surface significant issues per the shared protocol.

### E.3. Final sweep

Check `git status`. If the working tree is dirty, commit residual changes:

```bash
git add -- .workflows/{work_unit}/
git commit -m "inception({work_unit}): finalise refinement session log"
```

If clean, skip.

### E.4. Bridge

> *Output the next fenced block as markdown (not a code block):*

```
> Refinement complete. Returning to the epic menu so you can
> pick the next move from the updated map.
```

```
Pipeline bridge for: {work_unit}
Completed phase: inception

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

**STOP.** Do not proceed — terminal condition.
