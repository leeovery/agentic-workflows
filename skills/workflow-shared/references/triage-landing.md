# Triage Landing

*Shared reference. Loaded by `workflow-discussion-process` (off-topic concerns) and `workflow-research-process` (topic awareness) when a concern must be rerouted to a different topic.*

---

Lands a rerouted concern in a target topic's `## Triage` section so the target drains it when its phase next runs. Epic-only — single-topic work types (feature, bugfix, quick-fix) have no second topic to route to; their callers ignore the concern, surface it to the inbox, or pivot to an epic, and never load this reference.

The caller has already resolved and confirmed the target, and confirmed it is a **different** topic from the current one (a concern that belongs to the current topic is normal subtopic or thread work, not a reroute). This reference writes the manifest and artefact but does **not** commit — the caller's commit covers both.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic. Always present.
- `target` — the destination topic the concern belongs to (an existing map name, or a new kebab-case name the caller proposed and confirmed).
- `concern` — the concern as a short title, plus the full context discussed about it.
- `origin` — the topic the concern surfaced in (the current session's topic).
- `phase` — the current session's phase, `research` or `discussion`. Recorded in the entry, and the routing for a brand-new target.
- `date` — today's date.

After return, the caller reads these from conversation memory:

- `result` — `landed` (entry written; manifest/artefact ready for the caller's commit) or `cancelled` (a new target's name was dropped; nothing written).
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

Resolution is computed against the **live** map at landing time, never cached — a target created earlier in the same session must resolve correctly:

```bash
node .claude/skills/workflow-discovery/scripts/discovery.cjs {work_unit}
```

Find the row whose name is `{target}`.

#### If no row matches

The target is not on the map yet.

→ Proceed to **B. New Target**.

#### If the row has no `phase=` field

A discovery item exists but no research or discussion artefact does yet.

→ Proceed to **C. Fresh Target**.

#### Otherwise

The artefact named by the row's `phase=` field already exists.

→ Proceed to **D. Existing Target**.

## B. New Target

Create the target via the shared topic-creation core, routed at the current phase:

→ Load **[create-discovery-topic.md](create-discovery-topic.md)** with work_unit = `{work_unit}`, proposed_name = `{target}`, phase = `{phase}`, routing = `{phase}`, source = `reroute:{origin}`.

**If `result` is `cancelled`:**

The user dropped the new target — nothing was written.

→ Return to caller.

**Otherwise:**

The topic was created — `{created_topic}` holds the validated name. Set `landed_topic = {created_topic}`.

Create the artefact stub at `.workflows/{work_unit}/{phase}/{created_topic}.md` from the `{phase}` template — [discussion template](../../workflow-discussion-process/references/template.md) or [research template](../../workflow-research-process/references/template.md). Write the concern into its `## Triage` section using the entry shape above, replacing the `(none)` placeholder. Leave the rest of the stub as the bare template — its working sections fill in when the target is picked up.

Set `result = landed`.

→ Return to caller.

## C. Fresh Target

The discovery item exists; read its `routing=` value from the map row. Create that phase's item:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.{routing}.{target}
```

Create the artefact stub at `.workflows/{work_unit}/{routing}/{target}.md` from the `{routing}` template — [discussion template](../../workflow-discussion-process/references/template.md) or [research template](../../workflow-research-process/references/template.md). Write the concern into its `## Triage` section using the entry shape above, replacing the `(none)` placeholder.

Set `landed_topic = {target}` and `result = landed`.

→ Return to caller.

## D. Existing Target

Read the row's `phase=` value as `{current_phase}`. The live artefact is `.workflows/{work_unit}/{current_phase}/{target}.md`.

Append the concern as a `### {short title}` subsection under that file's `## Triage` heading, using the entry shape above. If the section holds the `(none)` placeholder, replace it; otherwise add the entry below the existing ones. If the file has no `## Triage` heading at all — an artefact created outside the template — add the heading at end of file with the entry beneath it.

Reopen the target if it has concluded, so it recomputes as actionable:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.{current_phase}.{target} status
```

**If the status is `completed`:**

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.{current_phase}.{target} status in-progress
```

Set `landed_topic = {target}` and `result = landed`.

→ Return to caller.

**Otherwise:**

The item is already in progress — no reopen needed. Set `landed_topic = {target}` and `result = landed`.

→ Return to caller.
