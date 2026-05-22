# Refinement Session

*Reference for **[workflow-inception-process](../SKILL.md)***

---

This reference drives the re-entry path into inception. Items already exist on the discovery map; the user's intent is to refine — add, edit, remove, rename, or re-route topics.

The convention is conversational, not menu-driven. STOP gates wrap manifest writes, scaled to destructiveness — additive operations batch, destructive operations are per-item. The map-operations reference owns parsing, validation, and persistence; this file owns the conversation shape.

State for this reference comes from the discovery script at `skills/workflow-inception-process/scripts/discovery.cjs`. Sections invoke it via Bash and read the structured output — they never invoke the underlying Node helpers inline.

Two anti-patterns to avoid:

- **Do not call `knowledge index`.** Inception session logs (initial or refinement) are journey records, not retrievable artifacts.
- **Do not set a phase-level `status: completed`.** Inception remains alive as long as the work unit is in-progress.

## A. Read State

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the current discovery map, dismissed list, and the latest
> session log status.
```

Run discovery for the work unit:

```bash
node .claude/skills/workflow-inception-process/scripts/discovery.cjs {work_unit}
```

The output drives the rest of this file:

- **`map_summary`** — `{total} topics — ...` line. Used in **D** (session log header) and **E** (render).
- **`discovery_map`** — per-topic `tier`, `lifecycle`, `current_phase`, `routing`, `source`, `summary`. Used in **E** (render).
- **`dismissed`** — names of topics previously removed via refinement. Used by `show-dismissed.md`.
- **`latest_session`** — `{filename, number, is_refinement, is_in_progress, conclusion_text, relative_path}`. Used in **B** (resume detection).
- **`next_session_number`** — zero-padded next session number to seed in **D**.

→ Proceed to **B. Resume Check**.

## B. Resume Check

Read `latest_session` and `next_session_number` from the discovery output produced in **A**.

#### If `latest_session` is null or `latest_session.is_refinement` is `false`

No refinement is in flight (only the initial session log exists, or no logs at all).

→ Proceed to **C. Self-Healing Check**.

#### If `latest_session.is_refinement` is `true` and `latest_session.is_in_progress` is `false`

The prior refinement concluded normally. Treat this as a fresh entry.

→ Proceed to **C. Self-Healing Check**.

#### If `latest_session.is_refinement` is `true` and `latest_session.is_in_progress` is `true`

The prior refinement was interrupted (Conclusion is `(none)`). Offer continue or restart:

> *Output the next fenced block as markdown (not a code block):*

```
Found an in-progress refinement session log for **{work_unit:(titlecase)}**: `{latest_session.filename}`.

· · · · · · · · · · · ·
- **`c`/`continue`** — Pick up where you left off
- **`r`/`restart`** — Delete the draft refinement log and start fresh
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `continue`:**

The active session log is `{latest_session.filename}`. No new log is initialised; subsequent operations append to the existing log.

→ Proceed to **E. Render and Prompt**.

**If `restart`:**

Delete the in-progress log and commit:

```bash
rm {latest_session.relative_path}
git add -- .workflows/{work_unit}/
git commit -m "inception({work_unit}): restart refinement session"
```

→ Proceed to **C. Self-Healing Check**.

## C. Self-Healing Check

Read `analysis_caches` from the discovery output produced in **A**. The shape is:

- `analysis_caches.research_analysis` — `{status, generated, files}` for the research-analysis cache. `status` is `valid` | `stale` | `absent`.
- `analysis_caches.gap_analysis` — same shape for gap-analysis.

#### If both caches are `valid` or `absent`

No analyses to run. The map is up to date relative to the source files.

→ Proceed to **D. Initialise Session Log**.

#### If at least one cache is `stale`

> *Output the next fenced block as markdown (not a code block):*

```
> Source files have changed since the last analysis. Running
> self-healing analyses to surface any new themes or gaps before
> opening refinement.
```

→ Load **[self-healing.md](../../workflow-shared/references/self-healing.md)** with work_unit = `{work_unit}`.

On return, read the orchestrator's `new_arrivals` tracker. The session log isn't created until **D**, so hold the arrivals in conversation memory and append them under **Self-Healing Arrivals** in **D** after the template is written.

→ Proceed to **D. Initialise Session Log**.

## D. Initialise Session Log

Re-run discovery to pick up any state changes from a `restart` in **B** or self-healing arrivals from **C**:

```bash
node .claude/skills/workflow-inception-process/scripts/discovery.cjs {work_unit}
```

Read `next_session_number` and `map_summary` from the output. The new session log path is `.workflows/{work_unit}/inception/session-{next_session_number}.md`.

Create the file from **[refinement-template.md](refinement-template.md)**. Populate the header (date, work unit) and **Map State at Start** with the `map_summary` text. Leave **Changes** and **Conclusion** as `(none)` placeholders — they fill in as operations are applied and at finalisation. The `(none)` Conclusion is the resume-detection signal used by **B**.

#### If **C** captured at least one arrival

Replace the `(none)` placeholder under **Self-Healing Arrivals** with one bullet per arrival, in the order they were added by the orchestrator:

```markdown
- {topic} (added by research-analysis, source: research-analysis)
- {topic} (added by gap-analysis, source: gap-analysis)
- {topic} (added by research-analysis, source: research-analysis,gap-analysis)
```

Use the `source` value the analysis wrote to the manifest (comma-joined when both surfaced the same theme). When the same name appears in both arrival lists, render it once attributed to research-analysis (per the orchestrator's **D. Dedupe Sources**).

Then commit — single commit covers the new session log plus the analyses' manifest writes:

```bash
git add -- .workflows/{work_unit}/
git commit -m "inception({work_unit}): self-healing added {N} topic(s) to map; seed refinement session log"
```

`{N}` is the total arrival count after dedupe.

→ Proceed to **E. Render and Prompt**.

#### Otherwise (no arrivals captured, or **C** had no analyses to run)

Leave **Self-Healing Arrivals** as `(none)`. Commit the seeded session log:

```bash
git add -- .workflows/{work_unit}/inception/session-{next_session_number}.md
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

Render the current map as a status-display anchor, using `discovery_map` and `map_summary` from **A** (or from the resumed log's matching state if **B** routed `continue`):

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

- `summary_line`: `{total} topics — {decided} decided · {in_flight} in flight · {ready} ready · {fresh} fresh · {cancelled} cancelled`. Omit zero-count categories from the dot-separated tail. Always include `{total} topics`.
- Tier and ordering — discovery output is already tier-sorted (`→ ◐ ✓ ○ ⊘`, alphabetical within tier). Render in the order given.
- `lifecycle_label` by tier:
  - `→` — `research complete · ready for discussion`
  - `◐` — `researching` or `discussing` (use `topic.current_phase`)
  - `✓` — `decided`
  - `○` — `fresh · routed to {topic.routing}` (omit ` · routed to ...` if `topic.routing` is null)
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

→ Load **[show-dismissed.md](show-dismissed.md)** and follow its instructions as written.

When it returns:

→ Proceed to **G. Anything Else?**.

#### If the user's message signals they are done

Triggers include *"no"*, *"done"*, *"that's it"*, *"all good"*, *"wrap up"*.

→ Proceed to **H. Finalise Session Log**.

#### Otherwise

The message names operations.

→ Load **[map-operations.md](map-operations.md)** and follow its instructions as written.

`map-operations.md` re-runs discovery for fresh state, parses, validates, applies safety-by-destructiveness gating, writes the manifest, appends to the active session log, and commits per its own pattern. When it returns:

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

Re-run discovery to pick up the post-operations state:

```bash
node .claude/skills/workflow-inception-process/scripts/discovery.cjs {work_unit}
```

Read `map_summary.total` from the output. Replace the `(none)` placeholder in the **Conclusion** section of the active session log. The replacement is non-optional — leaving `(none)` would make the log indistinguishable from an interrupted session on the next refinement entry.

#### If at least one operation was applied during the session

Replace `(none)` with: `{N} changes applied. Map now has {map_summary.total} topics.`

→ Proceed to **I. Compliance Self-Check**.

#### Otherwise (browse-only refinement, no operations applied)

Replace `(none)` with: `No changes applied — browse only. Map has {map_summary.total} topics.`

→ Proceed to **I. Compliance Self-Check**.

## I. Compliance Self-Check

→ Load **[compliance-check.md](../../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

The check audits the refinement against this file, the parent SKILL.md, and any other references loaded during the session (`map-operations.md`, `show-dismissed.md`, `refinement-template.md`). Apply silent corrections inline; surface significant issues per the shared protocol.

When it returns:

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
