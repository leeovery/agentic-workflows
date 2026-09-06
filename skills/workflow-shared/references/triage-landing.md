# Triage Landing

*Shared reference. Loaded by `workflow-discussion-process` (off-topic concerns), `workflow-research-process` (topic awareness), and `workflow-specification-process` (gaps and resolutions routed to a source discussion) when a concern must be rerouted to a different topic.*

---

Lands a rerouted concern in a target topic's **triage queue** — one engine-numbered file per concern, installed and committed by the engine — so the target surfaces it when its phase next runs. Epic-only — single-topic work types (feature, bugfix, quick-fix) have no second topic to route to; their callers ignore the concern, surface it to the inbox, or pivot to an epic, and never load this reference.

The caller has already resolved and confirmed the target, and confirmed it is a **different** topic from the current one (a concern that belongs to the current topic is normal subtopic or thread work, not a reroute). A specification raiser is the exception: its target is a source discussion — a different phase item even when it shares the spec topic's name. The delivery is a self-committing engine transaction — the concern file and manifest land action-scoped under the reroute message; the caller commits nothing for the landing itself. (`topic reactivate` in **D** likewise commits itself.)

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic. Always present.
- `target` — the destination topic the concern belongs to (an existing map name, or a new kebab-case name the caller proposed and confirmed).
- `concern` — the concern as a short title, plus the full context discussed about it.
- `origin` — the topic the concern surfaced in (the current session's topic).
- `phase` — the current session's phase, `research`, `discussion`, or `specification`. Recorded in the entry.
- `landing_phase` — where the concern lands on the target, `research` or `discussion`: judged by the origin session per **Judging the Landing Phase** below, recommended and confirmed at the caller's gate. Any target state is legal — the delivery parks, leaves live work untouched, or reopens completed work as needed.
- `date` — today's date.

After return, the caller reads these from conversation memory:

- `result` — `landed` (concern delivered and committed by the engine) or `cancelled` (the reroute was dropped or blocked; nothing written).
- `landed_topic` — the final target name (a new target may have been renamed during validation).

## Judging the Landing Phase

The concern's nature decides, never the target: an open question needing exploration → `research`; a decision owed → `discussion`; a correction lands in the phase whose document records the material it corrects — `discussion` when the target has recorded nothing yet. The target's map `routing` and live state have no vote — a question landing on a discussion-routed topic still lands research-side.

## Triage Entry Shape

Each rerouted concern is one queue file. Pin this exact content shape — the fold reads against it:

```
### {short title}
*From: {origin} · {phase} · {date}*

{the full context discussed about this concern}
```

Carry **everything** worked out about the concern — as many paragraphs as it takes. Do not summarise or trim: the target topic processes this entry from cold when it next runs, so it needs the whole context, not a one-line pointer. One paragraph or ten, write whatever conveys what was discussed. (In practice a concern caught early carries little; that's fine too.)

**One ask per file.** Depth is unbounded; width is one decision. When the worked-out material makes several asks of the target — points it could accept or reject independently — each ask is its own concern: its own entry with its own title, delivered through **C** in turn under the one confirmed reroute, repeating whatever shared context each needs (every entry is read cold). A single ask with several consequences stays one file — the test is whether the target could take one part and refuse another, never paragraph count. The target surfaces queue entries one at a time; a bundled entry defeats that walk before it starts.

## A. Resolve the Target

Resolution is computed against the **live** state at landing time, never cached — a target created earlier in the same session must resolve correctly:

```bash
node .claude/skills/workflow-discovery/scripts/gateway.cjs {work_unit}
```

Find the row whose name is `{target}`.

#### If no row matches

The target is not on the map yet.

→ Proceed to **B. New Target**.

#### If the row's lifecycle is `handled` or `cancelled`

The topic is closed — no future session will surface its queue, and concluded artefacts may exist beneath it. Record the row's lifecycle as `lifecycle`.

→ Proceed to **D. Closed Target**.

#### Otherwise

The landing phase is already judged and confirmed — `{landing_phase}` decides, not the target's live state. The delivery handles every item state (absent → parked; live → untouched; completed → reopened), and a terminal item refuses loudly with its recovery path.

→ Proceed to **C. Land the Concern**.

## B. New Target

Create the target via the shared topic-creation core, routed at the judged landing phase. The core writes the map item alone — the phase item is created as `triaged` in **C**, never started:

→ Load **[create-discovery-topic.md](create-discovery-topic.md)** with work_unit = `{work_unit}`, proposed_name = `{target}`, routing = `{landing_phase}`, source = `reroute:{origin}`.

**If `result` is `cancelled`:**

The user dropped the new target — nothing was written.

→ Return to caller.

**Otherwise:**

The topic was created — `{created_topic}` holds the validated name. Set `target = {created_topic}`.

→ Proceed to **C. Land the Concern**.

## C. Land the Concern

One engine transaction owns the whole delivery: `topic triage` handles the item status (absent → created as `triaged`, parked, not started; `triaged` or `in-progress` → untouched; `completed` → reopened to `in-progress`), installs the concern as the next numbered file in the target's queue, consumes the scratch file, and commits the delivery action-scoped (concern file + manifest).

1. Derive `slug` — kebab-case of the concern's short title.
2. Write the full entry (shape above) to `.workflows/.cache/{work_unit}/{phase}/{origin}/concern-{slug}.md` with the Write tool.
3. Deliver:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic triage {work_unit} {landing_phase} {target} --concern .workflows/.cache/{work_unit}/{phase}/{origin}/concern-{slug}.md --slug {slug} -m "{phase}({work_unit}/{origin}): reroute concern to {target}"
   ```

**If the response is `ok: false`:**

Surface the engine's error verbatim — it names the recovery path (e.g. a cancelled item routes through `topic reactivate`). Nothing has been written; set `result = cancelled`.

→ Return to caller.

**Otherwise:**

Set `landed_topic = {target}` and `result = landed`. When the response carries `reconcile_flagged` or `sources_staled`, the landing marked downstream work to reconcile — on a research-side landing, the target's discussion, live or decided (a live one can no longer conclude until the research lands); on a discussion-side landing, the specification(s) sourcing the target, named in `sources_staled`, whose extracted rows are now `stale` (`sources_staled` can arrive alone when the spec already carried a flag). The caller's landing line should say which.

→ Return to caller.

## D. Closed Target

Never stub over a concluded artefact, and never land an entry no session will surface. Present the state and let the user decide — the surface derives which closed state the target is in and words the reopen row for it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render triage-closed-target {work_unit}.discovery.{target}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If `open`:**

Reopen the topic — for `handled`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discovery-map unhandle {work_unit} {target}
```

For `cancelled` (an engine transaction — it commits itself) — reactivate the phase item that is actually cancelled, never the map `routing` (the initial intent may name a phase, or be absent, while the cancelled work sits elsewhere). Read both phase item statuses (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.{discussion|research}.{target} status`) and set `{cancelled_phase}` to the phase whose item is `cancelled` — when both are, `discussion` (the later phase):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reactivate {work_unit} {cancelled_phase} {target}
```

If the response is `ok: false`, surface the engine's error verbatim and re-fetch the gate above — the concern is still unlanded. Otherwise re-resolve against the fresh state:

→ Return to **A. Resolve the Target**.

**If `elsewhere`:**

Ask the user which topic the concern should land in, set `target` to their answer, and re-resolve:

→ Return to **A. Resolve the Target**.

**If `drop`:**

Nothing written. Set `result = cancelled`.

→ Return to caller.

