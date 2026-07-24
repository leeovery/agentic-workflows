# Triage Landing

*Shared reference. Loaded by `workflow-discussion-process` (off-topic concerns) and `workflow-research-process` (topic awareness) when a concern must be rerouted to a different topic.*

---

Lands a rerouted concern in a target topic's `## Triage` section so the target drains it when its phase next runs. Epic-only — single-topic work types (feature, bugfix, quick-fix) have no second topic to route to; their callers ignore the concern, surface it to the inbox, or pivot to an epic, and never load this reference.

The caller has already resolved and confirmed the target, and confirmed it is a **different** topic from the current one (a concern that belongs to the current topic is normal subtopic or thread work, not a reroute). This reference writes the manifest and artefact but does **not** commit — the caller's commit covers both. (The one exception: `topic reactivate` in **D** is an engine transaction that commits itself.)

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic. Always present.
- `target` — the destination topic the concern belongs to (an existing map name, or a new kebab-case name the caller proposed and confirmed).
- `concern` — the concern as a short title, plus the full context discussed about it.
- `origin` — the topic the concern surfaced in (the current session's topic).
- `phase` — the current session's phase, `research` or `discussion`. Recorded in the entry, and the routing for a brand-new target.
- `date` — today's date.

After return, the caller reads these from conversation memory:

- `result` — `landed` (entry written; manifest/artefact ready for the caller's commit) or `cancelled` (the reroute was dropped or blocked; nothing written).
- `landed_topic` — the final target name (a new target may have been renamed during validation).

## Triage Entry Shape

Each rerouted concern is appended to the target artefact's `## Triage` section as one subsection, replacing the `(none)` placeholder when it is the first entry. Pin this exact shape — the drain and the conclusion gate detect against it:

```
### {short title}
*From: {origin} · {phase} · {date}*

{the full context discussed about this concern}
```

Carry **everything** worked out about the concern — as many paragraphs as it takes. Do not summarise or trim: the target topic processes this entry from cold when it next runs, so it needs the whole context, not a one-line pointer. One paragraph or ten, write whatever conveys what was discussed. (In practice a concern caught early carries little; that's fine too.)

## A. Classify the Target

Resolution is computed against the **live** state at landing time, never cached — a target created earlier in the same session must resolve correctly:

```bash
node .claude/skills/workflow-discovery/scripts/gateway.cjs {work_unit}
```

Find the row whose name is `{target}`.

#### If no row matches

The target is not on the map yet.

→ Proceed to **B. New Target**.

#### If the row's lifecycle is `handled` or `cancelled`

The topic is closed — no future session will drain its Triage, and concluded artefacts may exist beneath it. Record the row's lifecycle as `lifecycle`.

→ Proceed to **D. Closed Target**.

#### Otherwise

The dump's `phase=` field only reflects live phase work — completed, cancelled, and superseded items exist without it. Classify by the phase items themselves. Read both statuses (`get` prints nothing for an absent item):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discussion.{target} status
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.research.{target} status
```

Evaluate in order — first match wins:

**If the discussion status is `in-progress`, `completed`, or `triaged`:**

Set `landing_phase = discussion`.

→ Proceed to **C. Land the Concern**.

**If the research status is `in-progress`, `completed`, or `triaged`:**

Set `landing_phase = research`.

→ Proceed to **C. Land the Concern**.

**If both phase items exist in terminal states `topic triage` refuses (`cancelled`, `superseded`, or `promoted`):**

The topic is closed on every side — no phase can accept the concern. Set `lifecycle = cancelled`.

→ Proceed to **D. Closed Target**.

**Otherwise:**

Set `landing_phase` to the row's `routing=` value — unless that phase's item exists in a terminal state `topic triage` refuses (`cancelled`, `superseded`, or `promoted`), in which case set `landing_phase` to the other phase.

→ Proceed to **C. Land the Concern**.

## B. New Target

Create the target via the shared topic-creation core, routed at the current phase. No `phase` is passed — the phase item is created as `triaged` in **C**, never started:

→ Load **[create-discovery-topic.md](create-discovery-topic.md)** with work_unit = `{work_unit}`, proposed_name = `{target}`, routing = `{phase}`, source = `reroute:{origin}`.

**If `result` is `cancelled`:**

The user dropped the new target — nothing was written.

→ Return to caller.

**Otherwise:**

The topic was created — `{created_topic}` holds the validated name. Set `landing_phase = {phase}` and `target = {created_topic}`.

→ Proceed to **C. Land the Concern**.

## C. Land the Concern

`topic triage` owns the item-status handling in one transaction: absent → created as `triaged` (parked, not started); `triaged` or `in-progress` → untouched; `completed` → reopened to `in-progress` (never land an entry in an artefact left concluded).

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic triage {work_unit} {landing_phase} {target}
```

**If the response is `ok: false`:**

Surface the engine's error verbatim — it names the recovery path (e.g. a cancelled item routes through `topic reactivate`). Nothing has been written; set `result = cancelled`.

→ Return to caller.

**If the response has `created: true`:**

Create the artefact stub at `.workflows/{work_unit}/{landing_phase}/{target}.md` from the `{landing_phase}` template — [discussion template](../../workflow-discussion-process/references/template.md) or [research template](../../workflow-research-process/references/template.md). Write the concern into its `## Triage` section using the entry shape above, replacing the `(none)` placeholder. Leave the rest of the stub as the bare template — its working sections fill in when the target is picked up.

Set `landed_topic = {target}` and `result = landed`.

→ Return to caller.

**If the response has `created: false` and the artefact file is unexpectedly missing:**

Create the stub with the entry exactly as in the `created: true` branch. Set `landed_topic = {target}` and `result = landed`.

→ Return to caller.

**If the response has `created: false`:**

The artefact is `.workflows/{work_unit}/{landing_phase}/{target}.md`.

→ Proceed to **E. Append the Entry**.

## D. Closed Target

Never stub over a concluded artefact, and never land an entry no session will drain. Surface the state and let the user decide:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
"{target}" is @if(lifecycle == 'handled') marked handled — fanned out into other topics @else cancelled @endif, so it won't pick up rerouted concerns.

- **`o`/`open`** — @if(lifecycle == 'handled') Clear the handled marker @else Reactivate it @endif and land the concern there
- **`e`/`elsewhere`** — Pick a different target
- **`d`/`drop`** — Drop the reroute; the concern stays with the current topic
· · · · · · · · · · · ·
```

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

If the response is `ok: false`, surface the engine's error verbatim and re-render this menu — the concern is still unlanded. Otherwise re-classify against the fresh state:

→ Return to **A. Classify the Target**.

**If `elsewhere`:**

Ask the user which topic the concern should land in, set `target` to their answer, and re-classify:

→ Return to **A. Classify the Target**.

**If `drop`:**

Nothing written. Set `result = cancelled`.

→ Return to caller.

## E. Append the Entry

Append the concern as a `### {short title}` subsection under `.workflows/{work_unit}/{landing_phase}/{target}.md`'s `## Triage` heading, using the entry shape above. If the section holds the `(none)` placeholder, replace it; otherwise add the entry below the existing ones. If the file has no `## Triage` heading at all — an artefact created outside the template — add the heading at end of file with the entry beneath it.

Set `landed_topic = {target}` and `result = landed`.

→ Return to caller.
