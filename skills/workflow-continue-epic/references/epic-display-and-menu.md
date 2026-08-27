# Epic State Display and Menu

*Reference for **[workflow-continue-epic](../SKILL.md)***

---

Display the full phase-by-phase breakdown for the selected epic, then present an interactive menu of actionable items. The caller is responsible for providing:
- `work_unit` — the epic's work unit name
- `new_arrivals` (optional) — tracker from `topic-discovery.md` listing the topic names added during this boot-up (`gap_analysis`). Drives the "new topics added" callout above the Discovery Map. Empty / absent means no callout.

This reference collects the user's selection and returns control to the caller. The caller decides what to do with the selection (invoke a skill directly, enter plan mode, etc.).

---

## A. State Display and Menu

Render the epic snapshot:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs view {work_unit}
```

When `new_arrivals` has any names, pass the tracker as a JSON argument instead:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs view {work_unit} '{"gap_analysis":["{topic}", "{topic}"]}'
```

The output is one snapshot in four demarcated sections:

- **DATA** — reasoning surface: state flags, `phase_counts` (in-progress / proposed / total per phase), and the `ACTIONS` table — one line per menu key, `key  action  topic  → route`, with `(recommended)` / `(in session: …)` / `(code session: …)` markers. Reason from it; never display or restate it.
- **TITLE** — the view's chrome heading. Emit verbatim as markdown, directly above the display.
- **DISPLAY** — the dashboard and key. Emit verbatim as a code block. Never redraw, reflow, or trim it.
- **MENU** — the selection menu. Emit verbatim as markdown (not a code block).

Emit the TITLE section (markdown), then the DISPLAY section, then the MENU section. A section is everything beneath its `===` marker up to the next marker — the marker lines themselves are never emitted.

**STOP.** Wait for user response.

→ Proceed to **B. Handle Selection**.

---

## B. Handle Selection

Match the user's input to its `ACTIONS` entry by `key` — a number, or a command option's letter / long form. Every decision below reads the entry's `action` value, never its label text.

#### If `action` is `unblock_plan`

→ Proceed to **G. Unblock Plan**.

#### If `action` is `resequence_build_order`

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Sequence Build Order`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Re-deriving the build order across the specification topics.
```

→ Load **[sequence-build-order.md](../../workflow-shared/references/sequence-build-order.md)** with work_unit = `{work_unit}`.

→ On return, return to **A. State Display and Menu**.

#### If `action` is `resume_completed`

→ Proceed to **D. Resume Completed**.

#### If `action` is `cancel_topic`

→ Proceed to **E. Cancel Topic**.

#### If `action` is `reactivate_topic`

→ Proceed to **F. Reactivate Topic**.

#### Otherwise

A `(code session: …)` marker needs no gate here — implementation and review are gated at their entry skill, which reads the whole checkout's code slot; the marked row routes like any other.

**If the selected entry carries an `(in session: …)` marker:**

Another live session holds this topic open. Fetch and emit the `MENU: in-session gate — {key}` section for the selected entry:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs in-session-gate {work_unit} {key}
```

**STOP.** Wait for user response.

**If user chose `back`:**

→ Return to **A. State Display and Menu**.

**If user chose `proceed`:**

Continue with the **Hard gate check** below.

**Hard gate check** — specification reads the settled record; this refusal comes before the soft gate. Read `phase_counts` from DATA. (Blocked items never reach here — a blocked spec or a dep-blocked plan carries no menu row; the display tree shows the `blocked` cue and the ⚑ list carries the detail.)

**If `action` is `analyze_discussions` and `phase_counts` shows discussion items in-progress and no specification items exist:**

Tell the user in one line: {N} discussion(s) are still in-progress — the grouping analysis reads the settled record; conclude them and return. (With specification items already on the board, the route passes — the specification menu shows what is workable and withholds the analysis itself.)

→ Return to **A. State Display and Menu**.

**Soft gate check** — before routing, the engine checks whether the selection conflicts with a phase-completion recommendation or the build order. Advisory, not blocking. Fetch the gate for the selected entry — `--topic` carries the entry's topic and is omitted for the topic-less command options:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render epic-soft-gate {work_unit} --action {action} [--topic {topic}]
```

**If the output is empty:**

The selection raises no concern.

→ Proceed to **C. Route Selection**.

**If a `MENU: epic soft gate` section is returned:**

Emit the section verbatim.

**STOP.** Wait for user response.

**If user chose `back`:**

→ Return to **A. State Display and Menu**.

**If user chose `yes`:**

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

Emit the TITLE section (markdown), then the DISPLAY section, then the MENU section. Match the user's input to its `ACTIONS` entry by `key`.

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

Emit the TITLE section (markdown), then the DISPLAY section, then the MENU section. Match the user's input to its `ACTIONS` entry by `key`.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If user chose a numbered topic

Store the selected entry's `phase` and `topic`. Fetch and emit the confirm's `MENU: cancel gate` section:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render cancel-gate {work_unit}.{phase}.{topic}
```

**STOP.** Wait for user response.

**If user chose `no`:**

→ Return to **A. State Display and Menu**.

**If user chose `yes`:**

Run the cancel transaction — one command stashes the current status, marks the item cancelled, stashes the topic's execution order (a research/discussion cancel stashes the discovery map's, a specification cancel the build order's), removes its knowledge-base chunks, and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic cancel {work_unit} {phase} {topic}
```

**If the response is `ok: false` naming specification(s) the cancel collapses** — a live spec is built from this topic; killing the source kills them together. Fetch the collapse confirm and emit its section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render cancel-cascade-gate {work_unit}.{phase}.{topic}
```

**STOP.** Wait for user response. On `no`: → Return to **A. State Display and Menu**. On `yes`, re-run with the cascade — one transaction cancels the topic and the named spec(s):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic cancel {work_unit} {phase} {topic} --cascade
```

Then continue below with the receipt.

Fetch and emit the receipt — the `DISPLAY: kb warning` advisory (when carried) then the `DISPLAY: confirmation` section — adding `--warn` when the response's `warnings` is non-empty. When the response carries `cascaded` or `discarded`, tell the user in one line which specification(s) went with the topic:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render topic-receipt {work_unit}.{phase}.{topic} --verb cancel [--warn]
```

→ Return to **A. State Display and Menu**.

---

## F. Reactivate Topic

Render the cancelled-topics list and pick menu:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs reactivate-menu {work_unit}
```

Emit the TITLE section (markdown), then the DISPLAY section, then the MENU section. Match the user's input to its `ACTIONS` entry by `key`.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If user chose a numbered topic

Store the selected entry's `phase` and `topic`. Run the reactivate transaction — one command restores the stashed status and execution order (a build-order number returns only while no live topic holds it — otherwise the next sequencing pass seats the topic), removes `previous_status`, re-indexes the artifact into the knowledge base when the restored status is `completed` in an indexed phase (research / discussion / investigation / specification), and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reactivate {work_unit} {phase} {topic}
```

Fetch and emit the receipt — the `DISPLAY: kb warning` advisory (when carried) then the `DISPLAY: confirmation` section — adding `--warn` when the response's `warnings` is non-empty:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render topic-receipt {work_unit}.{phase}.{topic} --verb reactivate [--warn]
```

→ Return to **A. State Display and Menu**.

---

## G. Unblock Plan

A dep-blocked plan carries no implementation row — this is its escape hatch. Render the blocked-plans list and pick menu:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs unblock-menu {work_unit}
```

Emit the TITLE section (markdown), then the DISPLAY section, then the MENU section. Match the user's input to its `ACTIONS` entry by `key`.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If user chose a numbered dependency

Store the selected entry's `topic` (the plan) and its `(dep: …)` value (the dependency to mark). Record the user's call — the dependency is satisfied outside the workflow:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} external_dependencies.{dep}.state satisfied_externally
```

The record belongs to the plan, and the menu is not the session working it — `--sweep`, so the commit stamps no identity there:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic planning/{topic} --sweep -m "impl({work_unit}): mark {dep} dependency as satisfied externally"
```

→ Return to **A. State Display and Menu**.
