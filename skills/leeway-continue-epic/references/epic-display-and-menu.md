# Epic State Display and Menu

*Reference for **[leeway-continue-epic](../SKILL.md)***

---

Display the full phase-by-phase breakdown for the epic, then present an interactive menu of actionable items. The caller is responsible for providing:
- `work_unit` — the epic's work unit name
- `new_arrivals` (optional) — tracker from `topic-discovery.md` listing the topic names added during this boot-up (`gap_analysis`). Drives the "new topics added" callout above the Discovery Map. Empty / absent means no callout.

This reference collects the user's selection and returns it to the caller, which routes it.

---

## A. State Display and Menu

Render the epic snapshot:

```bash
node .claude/skills/leeway-continue-epic/scripts/gateway.cjs view {work_unit}
```

When `new_arrivals` has any names, pass the tracker as a JSON argument instead:

```bash
node .claude/skills/leeway-continue-epic/scripts/gateway.cjs view {work_unit} '{"gap_analysis":["{topic}", "{topic}"]}'
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

#### If `action` is `resume_completed`

→ Proceed to **D. Resume Completed**.

#### If `action` is `cancel_topic`

→ Proceed to **E. Cancel Topic**.

#### If `action` is `reactivate_topic`

→ Proceed to **F. Reactivate Topic**.

#### If `action` is `postpone_topic`

→ Proceed to **G. Postpone Topic**.

#### If `action` is `pull_forward_topic`

→ Proceed to **H. Pull Forward Topic**.

#### If `action` is `new_topic`

A new topic lands on the map in the epic's discovery.

→ Proceed to **C. Route Selection**.

#### If `action` is `back`

→ Load **[start-menu.md](../../leeway/references/start-menu.md)**.

#### Otherwise

A `(code session: …)` marker needs no gate here — implementation and review gate the whole checkout's code slot where each starts; the marked row routes like any other.

**If the selected entry carries an `(in session: …)` marker:**

Another session holds this topic open. Fetch the in-session gate for the selected entry and emit its `MENU: in-session gate — {key}` section verbatim per its marker:

```bash
node .claude/skills/leeway-continue-epic/scripts/gateway.cjs in-session-gate {work_unit} {key}
```

**STOP.** Wait for user response.

**If user chose `back`:**

→ Return to **A. State Display and Menu**.

**If user chose `yes`:**

→ Proceed to **C. Route Selection**.

**Otherwise:**

→ Proceed to **C. Route Selection**.

---

## C. Route Selection

Store the selected entry's `route` (e.g. `/leeway-discussion-process epic {work_unit} {topic}`) and its `topic`. Every `(internal)` entry is resolved from **B. Handle Selection** and never reaches this section.

→ Return to caller.

---

## D. Resume Completed

Render the completed-topics list and pick menu:

```bash
node .claude/skills/leeway-continue-epic/scripts/gateway.cjs completed-menu {work_unit}
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

Render the cancellable-topics list and pick menu — one row per topic, its discussion and experiments together. Every topic is listed: a locked one carries its reason and no key, a unit a live session holds carries its in-session age (a cue, not a lock); when every row is locked the menu opens on a statement over `b/back` alone:

```bash
node .claude/skills/leeway-continue-epic/scripts/gateway.cjs cancel-menu {work_unit}
```

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker. Match the user's input to its `ACTIONS` entry by `key` or `word`.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If the input matches no entry

A locked row's name is the usual case — the row carries its reason. Tell the user in one line: the reason from the row for a locked unit, or that the input matched no option; then re-present the sub-view.

→ Return to **E. Cancel Topic**.

#### If user chose a numbered topic

Store the selected entry's `topic`. Fetch and emit the confirm's `MENU: cancel gate` section verbatim per its marker; its statement names exactly what the cancel takes:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render cancel-gate {work_unit}.discovery.{topic}
```

**STOP.** Wait for user response.

**If user chose `no`:**

→ Return to **A. State Display and Menu**.

**If user chose `yes`:**

Run the cancel transaction — one command cancels the topic (the map row marked, the discussion item under its name stashed and cancelled, every open experiment record abandoned with the cancellation as its reason), stashes the execution order, removes the cancelled artifacts' knowledge-base chunks, and commits:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs topic cancel {work_unit} discovery {topic}
```

**If the response is `ok: false`:**

Surface the engine's error verbatim in one line — nothing was written.

→ Return to **A. State Display and Menu**.

**Otherwise:**

Fetch and emit the receipt — the `DISPLAY: kb warning` advisory (when carried) then the `DISPLAY: confirmation` section, each verbatim per its marker — adding `--warn` when the response's `warnings` is non-empty, and `--inbox {n}` when its `inbox` lists the waiting messages the cancel moved, `{n}` their count. When the response's `abandoned` is non-empty, name the experiment records the cancel closed; when `released_waits` is non-empty, say where the ball sits — each waiting point reverts to open, surfaced when the topic is reactivated and that conversation next runs:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render topic-receipt {work_unit}.discovery.{topic} --verb cancel [--warn] [--inbox {n}]
```

→ Return to **A. State Display and Menu**.

---

## F. Reactivate Topic

Render the cancelled-topics list and pick menu — one row per cancelled topic, each naming what a reactivate returns:

```bash
node .claude/skills/leeway-continue-epic/scripts/gateway.cjs reactivate-menu {work_unit}
```

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker. Match the user's input to its `ACTIONS` entry by `key` or `word`.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If the input matches no entry

Tell the user in one line that the input matched no option, then re-present the sub-view.

→ Return to **F. Reactivate Topic**.

#### If user chose a numbered topic

Store the selected entry's `topic`. Run the reactivate transaction — one command restores the topic's stashed statuses (an item cancelled with no stash returns to never started) and its map order (a number returns only while no live topic holds it — otherwise the next sequencing pass seats the topic), re-indexes each restored `completed` artifact into the knowledge base, and commits:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs topic reactivate {work_unit} discovery {topic}
```

**If the response is `ok: false`:**

Surface the engine's error verbatim in one line — nothing was written.

→ Return to **A. State Display and Menu**.

**Otherwise:**

Fetch and emit the receipt — the `DISPLAY: kb warning` advisory (when carried) then the `DISPLAY: confirmation` section naming the statuses the unit's items returned to, each verbatim per its marker — adding `--warn` when the response's `warnings` is non-empty. The receipt lists only items that came back with a status: for each `restored` row whose `status` is `null`, tell the user in one line that its phase returned to never started:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render topic-receipt {work_unit}.discovery.{topic} --verb reactivate [--warn]
```

→ Return to **A. State Display and Menu**.

---

## G. Postpone Topic

Render the postponable-topics list and pick menu — one row per Discovery unit, the topic with its discussion and experiments together. Every unit is listed: a locked one carries its reason and no key, a unit a live session holds carries its in-session age (a cue, not a lock); when every row is locked the menu opens on a statement over `b/back` alone:

```bash
node .claude/skills/leeway-continue-epic/scripts/gateway.cjs postpone-menu {work_unit}
```

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker. Match the user's input to its `ACTIONS` entry by `key` or `word`.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If the input matches no key

A locked row's name is the usual case — the row carries its reason. Tell the user in one line: the reason from the row for a locked unit, or that the input matched no option; then re-present the sub-view.

→ Return to **G. Postpone Topic**.

#### If user chose a numbered topic

Store the selected entry's `topic` as `{name}`. The horizon, the confirm, and the transaction are the shared door's.

→ Load **[postponing-the-topic.md](../../leeway-shared/references/postponing-the-topic.md)** with work_unit = `{work_unit}`, name = `{name}`, phase = `none`, topic = `none`.

→ On return, return to **A. State Display and Menu**.

---

## H. Pull Forward Topic

The postpone's return leg: this menu let the topic go, so this menu takes it back. Render the postponed-topics list and pick menu — one row per topic this epic postponed that still waits on the roadmap, the horizon it waits under on the row. A topic whose item another epic has since taken is not among them:

```bash
node .claude/skills/leeway-continue-epic/scripts/gateway.cjs pull-forward-menu {work_unit}
```

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker. Match the user's input to its `ACTIONS` entry by `key` or `word`.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If the input matches no key

Tell the user in one line that the input matched no option, then re-present the sub-view.

→ Return to **H. Pull Forward Topic**.

#### If user chose a numbered topic

Store the selected entry's `topic` and its `(item: …)` value — the roadmap item the topic waits as, which the pull addresses. Run the return — one command restores the unit (the marker cleared, every stashed status returned, the map order back unless a live row took the number, each restored `completed` artifact re-indexed), re-records the join, and commits both manifests:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs roadmap pull-forward {item} --into {work_unit}
```

**If the response is `ok: false`:**

Surface the engine's error verbatim in one line — nothing was written.

→ Return to **A. State Display and Menu**.

**Otherwise:**

Fetch and emit the receipt — the `DISPLAY: kb warning` advisory (when carried) then the `DISPLAY: confirmation` section naming the statuses the unit's items returned to, each verbatim per its marker — adding `--warn` when the response's `warnings` is non-empty. The receipt lists only items that came back with a status; a topic that had never been started comes back with none named:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render topic-receipt {work_unit}.discovery.{topic} --verb restore [--warn]
```

→ Return to **A. State Display and Menu**.
