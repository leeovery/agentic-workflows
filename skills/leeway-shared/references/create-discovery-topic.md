# Create Discovery Topic

*Shared reference. Loaded by `sending-a-message.md` (a message to a new topic) and any flow that creates a new discovery-map topic.*

---

Validates a derived topic name, then lands the topic on the map with its brief. The caller owns the user-facing framing around the new topic; this reference owns only the validate → create sequence and reports back the name it wrote.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name. Always present.
- `proposed_name` — the topic name the caller derived. Always present.
- `source` — the provenance string for the discovery item (e.g. `message:{origin}`).
- `message` — what the new topic is created to receive. Always present.

After return, the caller reads this from conversation memory:

- `created_topic` — the validated topic name. A distinct variable from any caller-side `{topic}`, so it never collides with a parent topic the caller is already tracking.

## A. Validate the Name

→ Load **[topic-name-validation.md](topic-name-validation.md)** with work_unit = `{work_unit}`, proposed_name = `{proposed_name}`.

#### If `result` is `collision-active`

The name is on the map already. Derive a different kebab-case name from the point in hand — never the current topic's name — set `proposed_name` to it, and re-validate:

→ Return to **A. Validate the Name**.

#### Otherwise

Set `created_topic` to the validated `proposed_name`.

→ Proceed to **B. Create the Topic**.

## B. Create the Topic

Draw the topic's brief from `message` — a few lines on what it raises and why the topic needs it — and write it to `.leeway/.cache/{work_unit}/discovery/{created_topic}/brief-draft.md` with the Write tool. Derive `summary`, one line on what the topic covers.

Land the topic with its brief. `--re-add` brings back a name struck from the map: the creation is explicit — a message, a gap, a session add — so a prior dismissal never blocks it.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs topic add {work_unit} {created_topic} --source "{source}" --summary "{summary}" --brief .leeway/.cache/{work_unit}/discovery/{created_topic}/brief-draft.md --re-add
```

Single-quote any value containing characters zsh would interpret — backticks, `$`, `[]`, `{}`, `~` — so the shell passes it through literally.

#### If the response is `ok: false` naming a waiting roadmap item of the name

The topic is that item's work, so it takes the item in, `item` the one the refusal names.

→ Proceed to **C. Take the Roadmap Item In**.

#### If the response is `ok: false` naming the name taken

The map moved since validation — a concurrent session landed the same name, or another topic goes by it. Derive a different kebab-case name from the point in hand, set `proposed_name` to it, and re-validate against the fresh map:

→ Return to **A. Validate the Name**.

#### Otherwise

The add commits itself.

→ Return to caller.

## C. Take the Roadmap Item In

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
