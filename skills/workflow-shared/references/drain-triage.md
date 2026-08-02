# Drain Triage

*Shared reference. Loaded by `workflow-discussion-process` (Step 5) and `workflow-research-process` (Step 6) at the session step, before the session loop runs. The session loops re-enter **E. Mid-Session Check** from their findings check.*

---

Surfaces the current topic's triage queue — concerns rerouted here from other topics, one file each — **one at a time, through conversation**. A concern leaves the queue only after it has been discussed: surfaced with its full context, worked with the user, folded into the topic's content as the record of that discussion, and absorbed under its own commit. Runs at every entry to the session step and re-offers at every natural break; an empty queue is a no-op. The conclusion gate backstops the whole loop: a topic cannot conclude while its queue holds entries, so nothing is lost however freely the user moves.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the work unit. Always present.
- `topic` — the current topic, whose queue is drained.
- `phase` — `discussion` or `research`. Selects the artefact and the fold shape.

## A. Read

List the topic's triage queue:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic queue {work_unit} {phase} {topic}
```

#### If `count` is `0`

Nothing landed. No-op — do not commit, surface nothing.

→ Return to caller.

#### Otherwise

Each path in `files` holds one `### {title}` entry (shape pinned in [triage-landing.md](triage-landing.md)). Read every file — the titles and `*From:*` lines feed the agenda; the bodies feed the surfacing.

→ Proceed to **B. Agenda**.

## B. Agenda

Show the user what is waiting before surfacing anything — scope first, one concern at a time after:

> *Output the next fenced block as a code block:*

```
  ⚑ {count} rerouted concern(s) waiting in this topic's triage queue:

  1. {title} — from {origin} ({phase}, {date})
  2. ...
```

→ Proceed to **C. Surface One Concern**.

## C. Surface One Concern

Take the lowest-numbered concern still queued — or whichever the user asks for. Present it whole: name its origin in a sentence, then emit the file's full content verbatim as a code block (with a rendering instruction) — the origin session carried everything it worked out, and the user decides from the substance, never from the title.

Then discuss it as real session material: engage, challenge, connect it to what this topic has already decided. Control belongs to the conversation — this may take one exchange or many.

**If the discussion reaches an outcome** — a decision, a direction, or the user explicitly parking it as a deferred thread:

→ Proceed to **D. Fold and Absorb**.

**If the user moves on without engaging it** — they bounce to another subtopic, another concern, or the main thread:

The concern stays queued, untouched. Follow them — **E. Mid-Session Check** re-offers at the next natural break, and the conclusion gate holds until the queue is empty.

→ Return to caller.

## D. Fold and Absorb

Record the discussion in the topic's content, then absorb the concern:

**If `phase` is `discussion`:**

Attempt to add `{title}` to the Discussion Map:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map add {work_unit} {topic} {title:(kebabcase)}
```

**If the add succeeds** — new ground: create a `## {title}` subtopic section whose `### Context` opens with a provenance line (`*From: {origin} · {phase} · {date}*`) followed by the concern's body, then document what the discussion just concluded in the section's usual shape. Set the subtopic's map state to wherever the conversation actually got it.

**If the add refuses because the subtopic already exists** — ground this discussion already covers: append the provenance line and the concern's body to that subtopic's existing `### Context` — never a new heading of your own — and set the map so the recorded state reflects the re-decision that just happened:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map set {work_unit} {topic} {title:(kebabcase)} {state}
```

**If `phase` is `research`:**

Fold the concern into the freeform body as a `### {title}` thread opening with the provenance line, followed by the body and what the discussion made of it.

Then delete the concern's queue file (`rm`) and commit it by name — one commit per absorbed concern, bracketing its life in history with the delivery commit that landed it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic {phase}/{topic} -m "{phase}({work_unit}/{topic}): absorb {NNN-slug} (from {origin})"
```

**If concerns remain queued:**

→ Return to **C. Surface One Concern**.

**Otherwise:**

The queue is clear.

→ Return to caller.

## E. Mid-Session Check

Entered from the session loop's findings check — notices concerns that landed after the session-entry pass, and re-offers anything the user set aside. Run **A. Read**'s queue command. When `count` is `0`, there is nothing to do — return silently.

Otherwise, surface at the next natural break — the same mid-thread protection agent findings get, never interrupting a live thread:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
{count} concern(s) waiting in this topic's triage queue:

- **`d`/`discuss`** — Surface and discuss the next concern
- **`l`/`later`** — Keep the current thread
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `discuss`:**

→ Return to **A. Read**.

**If `later`:**

Continue the current thread. `later` means *not now*, never *not this session* — the loop's check re-enters here and re-offers at the next natural break, the same cadence review findings keep. The conclusion gate remains the backstop: nothing concludes over an undrained queue.

→ Return to caller.
