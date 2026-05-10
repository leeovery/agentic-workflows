# Refinement Session

*Reference for **[workflow-inception-process](../SKILL.md)***

---

This reference drives the re-entry path into inception. Items already exist on the discovery map; the user's intent is to refine — add, edit, remove, rename, or re-route topics.

The convention is conversational, not menu-driven. STOP gates wrap manifest writes, scaled to destructiveness — additive operations batch, destructive operations are per-item. The map-operations reference owns parsing, validation, and persistence; this file owns the conversation shape.

Two anti-patterns to avoid:

- **Do not call `knowledge index`.** Inception session logs (initial or refinement) are journey records, not retrievable artifacts.
- **Do not set a phase-level `status: completed`.** Inception remains alive as long as the work unit is in-progress.

## A. Read State

> *Output the next fenced block as markdown (not a code block):*

```
> Loading current inception items and per-topic lifecycle from
> the manifest. The map is the source of truth — no file reads
> needed for state.
```

Load the work unit's manifest and read `phases.inception.items.*`. For each topic, compute its lifecycle using `computeTopicLifecycle(manifest, topicName)` from `skills/workflow-shared/scripts/discovery-utils.cjs`. The returned `{ lifecycle, tier, current_phase }` informs which operations are allowed in the operations loop.

Also read `phases.inception.dismissed` (an array of previously removed topic names; may be missing or empty). The dismissed list governs name collision and the show-dismissed flow.

→ Proceed to **B. Resume Check**.

## B. Resume Check

Find the highest-numbered session log on disk:

```bash
ls .workflows/{work_unit}/inception/session-*.md 2>/dev/null | sort | tail -1
```

If the result is empty or matches `session-001.md`, no refinement is in flight. Otherwise read the matched `session-NNN.md` and inspect its **Conclusion** section — `(none)` means the prior refinement was interrupted (context refresh or user exit) before finalisation.

#### If only `session-001.md` exists or no log was found

→ Proceed to **C. Self-Healing Check**.

#### If a refinement log exists with non-`(none)` Conclusion

The prior refinement concluded normally. Treat this as a fresh entry.

→ Proceed to **C. Self-Healing Check**.

#### If a refinement log exists with `(none)` Conclusion

The prior refinement was interrupted. Offer continue or restart:

> *Output the next fenced block as markdown (not a code block):*

```
Found an in-progress refinement session log for **{work_unit:(titlecase)}**: `session-{NNN}.md`.

· · · · · · · · · · · ·
- **`c`/`continue`** — Pick up where you left off
- **`r`/`restart`** — Delete the draft refinement log and start fresh
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `continue`:**

The active session log is `session-{NNN}.md`. No new log is initialised; subsequent operations append to the existing log.

→ Proceed to **E. Render and Prompt**.

**If `restart`:**

Delete the in-progress log and commit:

```bash
rm .workflows/{work_unit}/inception/session-{NNN}.md
git add -- .workflows/{work_unit}/
git commit -m "inception({work_unit}): restart refinement session"
```

→ Proceed to **C. Self-Healing Check**.

## C. Self-Healing Check

> *Output the next fenced block as markdown (not a code block):*

```
> Phase 6 placeholder — self-healing analyses (research-analysis,
> gap-analysis) are wired in Phase 7. Nothing runs here yet.
```

No-op for Phase 6. Phase 7 will run the analyses inline at this point and apply results to the map (auto-add with `source: research-analysis` or `source: gap-analysis`, filtered against `phases.inception.dismissed`). Any items added by analyses will be recorded under **Self-Healing Arrivals** in the session log initialised in **D**.

→ Proceed to **D. Initialise Session Log**.

## D. Initialise Session Log

Determine the next session number:

```bash
n=$(ls .workflows/{work_unit}/inception/session-*.md 2>/dev/null | wc -l)
next=$(printf "%03d" $((n + 1)))
```

Counts existing files (initial = `001`, prior refinements = `002+`) and increments to the next zero-padded value.

Create `.workflows/{work_unit}/inception/session-{next}.md` from **[refinement-template.md](refinement-template.md)**. Populate the header (date, work unit) and **Map State at Start** with the summary line computed in **A**. Leave **Self-Healing Arrivals**, **Changes**, and **Conclusion** as `(none)` placeholders — they fill in as operations are applied and at finalisation. The `(none)` Conclusion is the resume-detection signal used by **B**.

Commit:

```bash
git add -- .workflows/{work_unit}/inception/session-{next}.md
git commit -m "inception({work_unit}): seed refinement session log"
```

→ Proceed to **E. Render and Prompt**.

## E. Render and Prompt

> *Output the next fenced block as markdown (not a code block):*

```
> Refining the discovery map. Tell me what to change — add,
> edit, remove, rename, or re-route topics. Multiple changes in
> one message are fine; I'll work through them.
```

Render the current map as a status-display anchor:

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

Then prompt the user:

> *Output the next fenced block as a code block:*

```
What would you like to change?
```

**STOP.** Wait for user response.

→ Proceed to **F. Operations Loop**.

## F. Operations Loop

The user's most recent message names one or more changes in natural language, asks to see dismissed items, or signals they are done.

#### If the user's message is a request to see dismissed items

Triggers include *"show dismissed"*, *"what was removed"*, *"let me see what I dropped"*.

Load **[show-dismissed.md](show-dismissed.md)** and follow its instructions as written. When it returns:

→ Proceed to **G. Anything Else?**.

#### If the user's message signals they are done

Triggers include *"no"*, *"done"*, *"that's it"*, *"all good"*, *"wrap up"*.

→ Proceed to **H. Finalise Session Log**.

#### Otherwise

The message names operations. Load **[map-operations.md](map-operations.md)** and follow its instructions as written. It parses, validates, applies safety-by-destructiveness gating, writes the manifest, appends to the active session log, and commits per its own pattern. When it returns:

→ Proceed to **G. Anything Else?**.

## G. Anything Else?

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Anything else to change?

- **Tell me what's next** — Name more changes (or "show dismissed")
- **`d`/`done`** — Conclude refinement and return to the epic menu
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `done`

→ Proceed to **H. Finalise Session Log**.

#### Otherwise

→ Return to **F. Operations Loop**.

## H. Finalise Session Log

Replace the `(none)` placeholder in the **Conclusion** section of `inception/session-{NNN}.md`. The replacement is non-optional — leaving `(none)` would make the log indistinguishable from an interrupted session on the next refinement entry.

#### If at least one operation was applied during the session

Replace `(none)` with: `{N} changes applied. Map now has {M} topics.`

→ Proceed to **I. Compliance Self-Check**.

#### Otherwise (browse-only refinement, no operations applied)

Replace `(none)` with: `No changes applied — browse only. Map has {M} topics.`

→ Proceed to **I. Compliance Self-Check**.

## I. Compliance Self-Check

Load **[compliance-check.md](../../workflow-shared/references/compliance-check.md)** and follow its instructions as written. The check audits the refinement against this file, the parent SKILL.md, and any other references loaded during the session (`map-operations.md`, `show-dismissed.md`, `refinement-template.md`). Apply silent corrections inline; surface significant issues per the shared protocol.

→ Proceed to **J. Final Sweep**.

## J. Final Sweep

Check `git status`.

#### If the working tree is dirty

```bash
git add -- .workflows/{work_unit}/
git commit -m "inception({work_unit}): finalise refinement session log"
```

→ Proceed to **K. Bridge**.

#### If the working tree is clean

→ Proceed to **K. Bridge**.

## K. Bridge

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
