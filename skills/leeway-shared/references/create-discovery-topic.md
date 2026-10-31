# Create Discovery Topic

*Shared reference. Loaded by `sending-a-message.md` (a message to a new topic) and any flow that creates a new discovery-map topic.*

---

Lands a new topic on the map with its brief. The caller owns the user-facing framing around the new topic; this reference owns only the create and reports back the name it wrote.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name. Always present.
- `proposed_name` — the topic name the caller derived. Always present.
- `source` — the provenance string for the discovery item (e.g. `message:{origin}`).
- `message` — what the new topic is created to receive. Always present.

After return, the caller reads this from conversation memory:

- `created_topic` — the name the topic landed under. A distinct variable from any caller-side `{topic}`, so it never collides with a parent topic the caller is already tracking.

## A. Create the Topic

Set `created_topic` to `proposed_name`, kebab-cased. Draw the topic's brief from `message` — a few lines on what it raises and why the topic needs it — and write it to `.leeway/.cache/{work_unit}/discovery/{created_topic}/brief-draft.md` with the Write tool. Derive `summary`, one line on what the topic covers.

Land the topic with its brief. `--re-add` brings back a name struck from the map: the creation is explicit — a message, a gap, a session add — so a prior dismissal never blocks it.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs topic add {work_unit} {created_topic} --source "{source}" --summary "{summary}" --brief .leeway/.cache/{work_unit}/discovery/{created_topic}/brief-draft.md --re-add
```

Single-quote any value containing characters zsh would interpret — backticks, `$`, `[]`, `{}`, `~` — so the shell passes it through literally.

#### If the response is `ok: false` naming a waiting roadmap item of the name

The topic is that item's work, so it takes the item in, `item` the one the refusal names.

→ Proceed to **B. Take the Roadmap Item In**.

#### If the response is `ok: false` naming the name taken or not a legal name

Another topic holds or goes by the name, or it is not a kebab-case name. Derive a different kebab-case name from the point in hand — never the current topic's name — set `proposed_name` to it, and land it again:

→ Return to **A. Create the Topic**.

#### Otherwise

The add commits itself.

→ Return to caller.

## B. Take the Roadmap Item In

Land the topic again, taking the item in:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs topic add {work_unit} {created_topic} --source "{source}" --summary "{summary}" --brief .leeway/.cache/{work_unit}/discovery/{created_topic}/brief-draft.md --re-add --from-roadmap {item}
```

#### If the response is `ok: false`

The item cannot be taken in, and the refusal says why. Surface the engine's error verbatim in one line; nothing was written.

**STOP.** Wait for user response.

#### Otherwise

The add commits itself.

→ Return to caller.
