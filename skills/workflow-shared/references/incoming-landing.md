# Incoming Landing

*Shared reference. Loaded by `workflow-discussion-process` and `workflow-research-process` when an off-topic concern belongs to a **different** topic.*

---

Lands an off-topic concern in a target topic's `## Incoming` section so the target picks it up when its phase next runs. The landing is **dumb and symmetric**: it writes only the `## Incoming` entry (creating a seed artefact stub when the target has none yet). It never injects into the target's Discussion Map or research threads — folding Incoming into the working map is the consuming session's job (see [drain-incoming.md](drain-incoming.md)).

Epic-only. Single-topic work types (feature, bugfix, quick-fix) have no second topic to route to — their callers handle an off-topic concern by ignoring it, surfacing it to the inbox, or pivoting to an epic, and never load this reference.

The caller has already confirmed the target is a **different** topic from the current one (a concern that belongs to the current topic is normal subtopic work, not Incoming). This reference writes the manifest and artefact but does **not** commit — the caller's commit covers them.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic. Always present.
- `target` — the destination topic the concern belongs to (an existing map name, or a new kebab-case name the caller proposes).
- `concern` — the off-topic concern as captured.
- `origin` — the topic the concern surfaced in (the current session's topic).
- `phase` — the current session's phase, `research` or `discussion` (recorded in the entry, and the routing for a brand-new target).
- `date` — today's date.

After return, the caller reads these from conversation memory:

- `result` — `landed` (entry written; manifest/artefact dirty, ready for the caller's commit) or `cancelled` (a new target's name was dropped; nothing written).
- `landed_topic` — the final target name (a new target may have been renamed during validation).

## Incoming Entry Shape

Each landed concern is appended to the target artefact's `## Incoming` section as one subsection, replacing the `(none)` placeholder when it is the first entry. Pin this exact shape — the drain and the conclusion gate detect against it:

```
### {concern}
*From: {origin} · {phase} · {date}*

{concern as captured}
```

## A. Classify the Target

Resolution is computed against the **live** map at landing time, never cached — a target elevated or created earlier in the same session must resolve correctly:

```bash
node .claude/skills/workflow-discovery/scripts/discovery.cjs {work_unit}
```

Find the row whose `name` is `target` in `discovery_map`.

#### If no row matches

The target is not on the map.

→ Proceed to **B. New Target**.

#### If the row's `lifecycle` is `fresh`

A discovery item exists but no research or discussion work has started.

→ Proceed to **C. Fresh Target**.

#### Otherwise

An artefact already exists (the row's `current_phase` names it).

→ Proceed to **D. Existing Target**.

## B. New Target

Create the target via the shared topic-creation core, routed at the current phase:

→ Load **[create-topic.md](create-topic.md)** with work_unit = `{work_unit}`, proposed_name = `{target}`, phase = `{phase}`, routing = `{phase}`, source = `incoming:{origin}`.

**If `result` is `cancelled`:** the user dropped the new target — nothing was written.

→ Return to caller.

**Otherwise** the topic was created (`{created_topic}` holds the validated name). Set `landed_topic = {created_topic}`.

Create the artefact stub at `.workflows/{work_unit}/{phase}/{created_topic}.md` from the `{phase}` template — [discussion template](../../workflow-discussion-process/references/template.md) or [research template](../../workflow-research-process/references/template.md). Write the concern into its `## Incoming` section using the entry shape above, replacing the `(none)` placeholder. Leave the rest of the stub as the bare template (its Context / Starting Point fill in when the target is picked up).

Set `result = "landed"`.

→ Return to caller.

## C. Fresh Target

The discovery item exists; read its `routing` from the map row. Create that phase's item:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.{routing}.{target}
```

Create the artefact stub at `.workflows/{work_unit}/{routing}/{target}.md` from the `{routing}` template — [discussion template](../../workflow-discussion-process/references/template.md) or [research template](../../workflow-research-process/references/template.md). Write the concern into its `## Incoming` section using the entry shape above, replacing the `(none)` placeholder.

Set `landed_topic = {target}` and `result = "landed"`.

→ Return to caller.

## D. Existing Target

The live artefact is the map row's `current_phase` file: `.workflows/{work_unit}/{current_phase}/{target}.md`.

Append the concern as a `### {concern}` subsection under that file's `## Incoming` heading, using the entry shape above. If the section is the `(none)` placeholder, replace it with the entry; otherwise add the entry below the existing ones.

#### If the row's `lifecycle` is `decided` or `ready_for_discussion`

The `current_phase` item is `completed` — reopen it so the target recomputes to actionable:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.{current_phase}.{target} status in-progress
```

→ Proceed to the return below.

#### Otherwise

The `current_phase` item is already `in-progress` — no reopen needed.

→ Proceed to the return below.

Set `landed_topic = {target}` and `result = "landed"`.

→ Return to caller.
