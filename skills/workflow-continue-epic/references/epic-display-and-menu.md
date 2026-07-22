# Epic State Display and Menu

*Reference for **[workflow-continue-epic](../SKILL.md)***

---

Display the full phase-by-phase breakdown for the selected epic, then present an interactive menu of actionable items. The caller is responsible for providing:
- `work_unit` — the epic's work unit name
- `new_arrivals` (optional) — tracker from `topic-discovery.md` listing topic names added during this boot-up, per analysis. Drives the "new topics added" callout above the Discovery Map. Empty / absent means no callout.

This reference collects the user's selection and returns control to the caller. The caller decides what to do with the selection (invoke a skill directly, enter plan mode, etc.).

---

## A. State Display and Menu

Render the epic snapshot:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs view {work_unit}
```

When `new_arrivals` has any names, pass the tracker as a JSON argument instead:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs view {work_unit} '{"research_analysis":["{topic}", "{topic}"],"gap_analysis":[]}'
```

The output is one snapshot in three demarcated sections:

- **DATA** — reasoning surface: state flags, `phase_counts` (in-progress / proposed / total per phase), and the `ACTIONS` table — one line per menu key, `key  action  topic  → route`, with `(recommended)` / `(blocked: …)` markers. Reason from it; never display or restate it.
- **DISPLAY** — the dashboard and key. Emit verbatim as a code block. Never redraw, reflow, or trim it.
- **MENU** — the selection menu. Emit verbatim as markdown (not a code block).

Emit the DISPLAY section, then the MENU section. A section is everything beneath its `===` marker up to the next marker — the marker lines themselves are never emitted.

**STOP.** Wait for user response.

→ Proceed to **B. Handle Selection**.

---

## B. Handle Selection

Match the user's input to its `ACTIONS` entry by `key` — a number, or a command option's letter / long form. Every decision below reads the entry's `action` value, never its label text.

#### If the selected entry carries a `(blocked: …)` marker

The item is shown for visibility but not selectable. Explain what blocks it, using the marker's `{dep}:{task} — {reason}` detail:

> *Output the next fenced block as a code block:*

```
"{topic:(titlecase)}" cannot start implementation yet.

Blocking dependencies:
  • {dep_topic}:{internal_id} — {reason}
  • {dep_topic} — {reason}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`u`/`unblock`** — Mark a dependency as satisfied externally
- **`b`/`back`** — Return to menu
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If user chose `unblock`:**

Ask which dependency to mark as satisfied. Update via `engine manifest`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} external_dependencies.{dep_topic}.state satisfied_externally
```

Commit the change.

→ Return to **A. State Display and Menu**.

**If user chose `back`:**

→ Return to **A. State Display and Menu**.

#### If `action` is `resume_completed`

→ Proceed to **D. Resume Completed**.

#### If `action` is `cancel_topic`

→ Proceed to **E. Cancel Topic**.

#### If `action` is `reactivate_topic`

→ Proceed to **F. Reactivate Topic**.

#### Otherwise

**Soft gate check** — before routing, check whether the selection conflicts with a phase-completion recommendation. Advisory, not blocking. Read the counts from `phase_counts` in DATA.

| Selected `action` | Condition | Gate message |
|-------------------|-----------|--------------|
| `start_discussion` · `start_discussion_after_research` · `continue_discussion` · `new_discussion` | research items exist with some in-progress | "{N} of {M} research topics still in-progress. Topic analysis works best with all research available." |
| `start_specification` · `continue_specification` · `analyze_discussions` | discussion items exist with some in-progress | "{N} of {M} discussions still in-progress. Grouping analysis works best with all discussions available." |
| `start_planning` · `continue_planning` | specification items exist with some in-progress or proposed | "{N} of {M} specifications not yet completed. Completing all specifications first helps identify cross-cutting dependencies." |
| `start_implementation` · `continue_implementation` | planning items exist with some in-progress | "{N} of {M} plans still in-progress. Task dependencies across plans may be missed." |

**If a soft gate condition matches:**

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
{Gate message}

The system will re-analyse if you revisit later — proceeding
now is safe, but may require rework.

- **`y`/`yes`** — Proceed anyway
- **`b`/`back`** — Return to menu
· · · · · · · · · · · ·
```

Gate messages are self-contained first lines. Compose the count prefix into the message (e.g., "3 of 5 research topics still in-progress. Topic analysis works best with all research available.").

**STOP.** Wait for user response.

**If user chose `back`:**

→ Return to **A. State Display and Menu**.

**If user chose `yes`:**

→ Proceed to **C. Route Selection**.

**If no soft gate condition matches:**

→ Proceed to **C. Route Selection**.

---

## C. Route Selection

Store the selected entry's `action`, `topic`, and `route`. The route is the exact skill invocation for this selection (e.g. `/workflow-discussion-entry epic {work_unit} {topic}`). Entries with route `(internal)` never reach this section — their flows resolve in **B. Handle Selection**.

→ Return to caller.

---

## D. Resume Completed

Render the completed-topics list and pick menu:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs completed-menu {work_unit}
```

Emit the DISPLAY section, then the MENU section. Match the user's input to its `ACTIONS` entry by `key`.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If user chose a topic

Store the selected entry's `phase`, `topic`, and `route`.

→ Return to caller.

---

## E. Cancel Topic

Render the cancellable-topics list and pick menu:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs cancel-menu {work_unit}
```

Emit the DISPLAY section, then the MENU section. Match the user's input to its `ACTIONS` entry by `key`.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If user chose a numbered topic

Store the selected entry's `phase` and `topic`. Confirm with the user:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Cancel "{topic:(titlecase)}" in {phase}? This will mark it as
cancelled. You can reactivate it later.

- **`y`/`yes`** — Confirm cancellation
- **`n`/`no`** — Return to menu
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If user chose `no`:**

→ Return to **A. State Display and Menu**.

**If user chose `yes`:**

Run the cancel transaction — one command stashes the current status, marks the item cancelled, drops the topic's discovery-map order, removes its knowledge-base chunks, and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic cancel {work_unit} {phase} {topic}
```

Emit the response's `DISPLAY: kb warning` section when present, then its `DISPLAY: confirmation` section — each verbatim per its marker.

→ Return to **A. State Display and Menu**.

---

## F. Reactivate Topic

Render the cancelled-topics list and pick menu:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs reactivate-menu {work_unit}
```

Emit the DISPLAY section, then the MENU section. Match the user's input to its `ACTIONS` entry by `key`.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If user chose a numbered topic

Store the selected entry's `phase` and `topic`. Run the reactivate transaction — one command restores the stashed status, removes `previous_status`, re-indexes the artifact into the knowledge base when the restored status is `completed` in an indexed phase (research / discussion / investigation / specification), and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reactivate {work_unit} {phase} {topic}
```

Emit the response's `DISPLAY: kb warning` section when present, then its `DISPLAY: confirmation` section — each verbatim per its marker.

→ Return to **A. State Display and Menu**.
