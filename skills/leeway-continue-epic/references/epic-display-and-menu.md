# Epic State Display and Menu

*Reference for **[workflow-continue-epic](../SKILL.md)***

---

Display the full phase-by-phase breakdown for the epic, then present an interactive menu of actionable items. The caller is responsible for providing:
- `work_unit` — the epic's work unit name
- `new_arrivals` (optional) — tracker from `topic-discovery.md` listing the topic names added during this boot-up (`gap_analysis`). Drives the "new topics added" callout above the Discovery Map. Empty / absent means no callout.

This reference collects the user's selection and returns it to the caller, which routes it.

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

- **DATA** — reasoning surface: state flags and the `ACTIONS` table — one line per menu key, `key  word  action  topic  → route`, with `(recommended)` / `(in session: …)` / `(code session: …)` markers. Reason from it; never display or restate it.
- **TITLE** — the view's chrome heading. Emit verbatim per its marker, directly above the display.
- **DISPLAY** — the dashboard and key. Emit verbatim per its marker. Never redraw, reflow, or trim it.
- **MENU** — the selection menu. Emit verbatim per its marker.

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker.

**STOP.** Wait for user response.

→ Proceed to **B. Handle Selection**.

---

## B. Handle Selection

Match the user's input to its `ACTIONS` entry — a number or a command option's letter by `key`, its long form by `word`. Every decision below reads the entry's `action` value, never its label text.

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

#### If `action` is `postpone_topic`

→ Proceed to **H. Postpone Topic**.

#### If `action` is `pull_forward_topic`

→ Proceed to **I. Pull Forward Topic**.

#### If `action` is `new_discussion`

→ Load **[new-topic.md](new-topic.md)** with phase = `discussion`.

→ On return, proceed to **C. Route Selection**.

#### If `action` is `new_research`

→ Load **[new-topic.md](new-topic.md)** with phase = `research`.

→ On return, proceed to **C. Route Selection**.

#### If `action` is `analyze_discussions`

→ Load **[specification-display-and-menu.md](specification-display-and-menu.md)** and follow its instructions as written.

→ On return, proceed to **C. Route Selection**.

#### If `action` is `back`

→ Load **[start-menu.md](../../workflow-start/references/start-menu.md)**.

#### Otherwise

A `(code session: …)` marker needs no gate here — implementation and review gate the whole checkout's code slot where each starts; the marked row routes like any other.

**If the selected entry carries an `(in session: …)` marker:**

Another session holds this topic open. Fetch the in-session gate for the selected entry and emit its `MENU: in-session gate — {key}` section verbatim per its marker:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs in-session-gate {work_unit} {key}
```

**STOP.** Wait for user response.

**If user chose `back`:**

→ Return to **A. State Display and Menu**.

**If user chose `yes`:**

Continue with the **Soft gate check** below.

**Soft gate check** — before routing, the engine checks whether the selection conflicts with a phase-completion recommendation or the build order. Advisory, not blocking. Fetch the gate for the selected entry — `--topic` carries the entry's topic and is omitted for the topic-less command options:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render epic-soft-gate {work_unit} --action {action} [--topic {topic}]
```

**If the output is empty:**

The selection raises no concern.

→ Proceed to **C. Route Selection**.

**If a `MENU: epic soft gate` section is returned:**

Emit the section verbatim per its marker.

**STOP.** Wait for user response.

**If user chose `back`:**

→ Return to **A. State Display and Menu**.

**If user chose `yes`:**

→ Proceed to **C. Route Selection**.

---

## C. Route Selection

Store the exact skill invocation the selection hands off along as `route`, and the topic it carries as `{topic}` — for a new topic, `/workflow-{phase}-process epic {work_unit} {topic}`, with the phase it was started for and the name it was given; for the specification the specification menu returned, `/workflow-specification-process epic {work_unit} {topic}`; otherwise the selected entry's own `route` (e.g. `/workflow-discussion-process epic {work_unit} {topic}`) and its `topic`. The `new_discussion`, `new_research` and `analyze_discussions` entries carry route `(internal)` and arrive here with the topic their flow named; every other `(internal)` entry is resolved from **B. Handle Selection** and never reaches this section.

#### If `route` enters the specification

Fetch the confirm for `{topic}`, adding `--unify` when this selection is the specification menu's unify — empty unless the start incorporates a started specification or unifies the groupings, what the pick did not show:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render spec-confirm-gate {work_unit}.specification.{topic} [--unify]
```

**If the output is empty:**

→ Return to caller.

**If a `MENU: spec confirm gate` section is returned:**

Emit the call's DISPLAY and MENU sections verbatim per their markers.

**STOP.** Wait for user response.

**If user chose `no`:**

→ Return to **A. State Display and Menu**.

**If user chose `yes`:**

→ Return to caller.

#### Otherwise

→ Return to caller.

---

## D. Resume Completed

Render the completed-topics list and pick menu:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs completed-menu {work_unit}
```

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker. Match the user's input to its `ACTIONS` entry by `key` or `word`.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If user chose a topic

Store the selected entry's `phase`, `topic`, and `route`.

→ Return to caller.

---

## E. Cancel Topic

Render the cancellable-topics list and pick menu — one row per unit, a topic (its research, discussion, and experiments together) or a specification (with its plan). Every unit is listed: a locked one carries its reason and no key, a unit a live session holds carries its in-session age (a cue, not a lock); when every row is locked the menu opens on a statement over `b/back` alone:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs cancel-menu {work_unit}
```

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker. Match the user's input to its `ACTIONS` entry by `key` or `word`.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If the input matches no entry

A locked row's name is the usual case — the row carries its reason. Tell the user in one line: the reason from the row for a locked unit, or that the input matched no option; then re-present the sub-view.

→ Return to **E. Cancel Topic**.

#### If user chose a numbered topic

Store the selected entry's `phase` — the unit's stage, `discovery` or `specification` — and `topic`. Fetch and emit the confirm's `MENU: cancel gate` section verbatim per its marker; its statement names exactly what the cancel takes:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render cancel-gate {work_unit}.{phase}.{topic}
```

**STOP.** Wait for user response.

**If user chose `no`:**

→ Return to **A. State Display and Menu**.

**If user chose `yes`:**

Run the cancel transaction — one command cancels the unit (a topic: the map row marked, every research and discussion item under its name stashed and cancelled, every open experiment record abandoned with the cancellation as its reason, any proposed grouping over its discussion discarded; a specification: the specification and its plan), stashes the execution order, removes the cancelled artifacts' knowledge-base chunks, and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic cancel {work_unit} {phase} {topic}
```

**If the response is `ok: false`:**

Surface the engine's error verbatim in one line — nothing was written.

→ Return to **A. State Display and Menu**.

**Otherwise:**

Fetch and emit the receipt — the `DISPLAY: kb warning` advisory (when carried) then the `DISPLAY: confirmation` section, each verbatim per its marker — adding `--warn` when the response's `warnings` is non-empty. When the response's `discarded` is non-empty, tell the user in one line which proposed grouping(s) went with the topic; when `abandoned` is non-empty, name the experiment records the cancel closed; when `released_waits` is non-empty, say where the ball sits — each waiting point reverts to open, surfaced when the topic is reactivated and that conversation next runs:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render topic-receipt {work_unit}.{phase}.{topic} --verb cancel [--warn]
```

→ Return to **A. State Display and Menu**.

---

## F. Reactivate Topic

Render the cancelled-topics list and pick menu — one row per cancelled unit, each naming what a reactivate returns. A specification whose sources are unavailable — a source topic cancelled, or a source another started specification has since taken — carries its reason and no key; when every row is locked the menu opens on a statement over `b/back` alone:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs reactivate-menu {work_unit}
```

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker. Match the user's input to its `ACTIONS` entry by `key` or `word`.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If the input matches no entry

A locked row's name is the usual case — the row carries its reason. Tell the user in one line: the reason from the row for a locked unit, or that the input matched no option; then re-present the sub-view.

→ Return to **F. Reactivate Topic**.

#### If user chose a numbered topic

Store the selected entry's `phase` — the unit's stage, `discovery` or `specification` — and `topic`. Run the reactivate transaction — one command restores the unit's stashed statuses (an item cancelled with no stash returns to never started) and its execution order (the map's for a topic, the build order's for a specification; a number returns only while no live topic holds it — otherwise the next sequencing pass seats the topic), discards any proposed grouping over a specification's returning sources, re-indexes each restored `completed` artifact into the knowledge base, and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reactivate {work_unit} {phase} {topic}
```

**If the response is `ok: false`:**

Surface the engine's error verbatim in one line — nothing was written.

→ Return to **A. State Display and Menu**.

**Otherwise:**

Fetch and emit the receipt — the `DISPLAY: kb warning` advisory (when carried) then the `DISPLAY: confirmation` section naming the statuses the unit's items returned to, each verbatim per its marker — adding `--warn` when the response's `warnings` is non-empty. The receipt lists only items that came back with a status: for each `restored` row whose `status` is `null`, tell the user in one line that its phase returned to never started; when the response's `discarded` is non-empty, tell the user in one line which proposed grouping(s) went with the reactivate:

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

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker. Match the user's input to its `ACTIONS` entry by `key` or `word`.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If user chose a numbered dependency

Store the selected entry's `topic` (the plan) and the `(dep: …)` value on its `ACTIONS` row (the dependency to mark — the key it is recorded under; the `{plan}:{task}` reference the menu row shows names the blocking task, never the key).

→ Load **[mark-dependency-satisfied.md](../../workflow-shared/references/mark-dependency-satisfied.md)** with work_unit = `{work_unit}`, topic = `{topic}`, dep = `{dep}`.

→ On return, return to **A. State Display and Menu**.

---

## H. Postpone Topic

Render the postponable-topics list and pick menu — one row per Discovery unit, the topic with its research, discussion, and experiments together. Every unit is listed: a locked one carries its reason and no key, a unit a live session holds carries its in-session age (a cue, not a lock); when every row is locked the menu opens on a statement over `b/back` alone:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs postpone-menu {work_unit}
```

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker. Match the user's input to its `ACTIONS` entry by `key` or `word`.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If the input matches no key

A locked row's name is the usual case — the row carries its reason. Tell the user in one line: the reason from the row for a locked unit, or that the input matched no option; then re-present the sub-view.

→ Return to **H. Postpone Topic**.

#### If user chose a numbered topic

Store the selected entry's `topic` as `{name}`. The horizon, the confirm, and the transaction are the shared door's.

→ Load **[postponing-the-topic.md](../../workflow-shared/references/postponing-the-topic.md)** with work_unit = `{work_unit}`, name = `{name}`, phase = `none`, topic = `none`.

→ On return, return to **A. State Display and Menu**.

---

## I. Pull Forward Topic

The postpone's return leg: this menu let the topic go, so this menu takes it back. Render the postponed-topics list and pick menu — one row per topic this epic postponed that still waits on the roadmap, the horizon it waits under on the row. A topic whose item another epic has since taken is not among them:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs pull-forward-menu {work_unit}
```

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker. Match the user's input to its `ACTIONS` entry by `key` or `word`.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If the input matches no key

Tell the user in one line that the input matched no option, then re-present the sub-view.

→ Return to **I. Pull Forward Topic**.

#### If user chose a numbered topic

Store the selected entry's `topic` and its `(item: …)` value — the roadmap item the topic waits as, which the pull addresses. Run the return — one command restores the unit (the marker cleared, every stashed status returned, the map order back unless a live row took the number, each restored `completed` artifact re-indexed), re-records the join, and commits both manifests:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs roadmap pull-forward {item} --into {work_unit}
```

**If the response is `ok: false`:**

Surface the engine's error verbatim in one line — nothing was written.

→ Return to **A. State Display and Menu**.

**Otherwise:**

Fetch and emit the receipt — the `DISPLAY: kb warning` advisory (when carried) then the `DISPLAY: confirmation` section naming the statuses the unit's items returned to, each verbatim per its marker — adding `--warn` when the response's `warnings` is non-empty. The receipt lists only items that came back with a status; a topic that had never been started comes back with none named:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render topic-receipt {work_unit}.discovery.{topic} --verb restore [--warn]
```

→ Return to **A. State Display and Menu**.
