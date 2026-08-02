# Rerouted Concerns

*Shared reference. Loaded by the session wrappers of `workflow-discussion-process` and `workflow-research-process`; the session loops enter **A. Check** from their triage check each iteration.*

---

Surfaces the current topic's triage queue — concerns rerouted here from other topics, one engine-numbered file each, shape pinned in [triage-landing.md](triage-landing.md) — one at a time, through conversation. A concern leaves the queue only after it has been raised with its full context, worked with the user, folded into the topic's content as the record of that discussion, and absorbed under its own commit. An empty queue is a no-op. The conclusion gate backstops the whole protocol: the topic cannot conclude while its queue holds entries, so nothing is lost however freely the user moves.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the work unit. Always present.
- `topic` — the current topic, whose queue is surfaced.
- `phase` — `discussion` or `research`. Selects the artefact and the fold shape.

## A. Check

List the topic's triage queue:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic queue {work_unit} {phase} {topic}
```

Route on the response and the session's state — first match wins. The opt-in and the live concern are conversation state: a context refresh loses both — re-offer, never re-assume.

#### If `count` is `0`

Nothing queued. No output.

→ Return to caller.

#### If a raised concern is still open

The conversation owns it — its outcome routes through **D. Fold**, and the user moving on parks the queue. Nothing to do here.

→ Return to caller.

#### If the opt-in is standing

The previous concern's absorb is the natural break.

→ Proceed to **C. Raise One Concern**.

#### If this is the session's first consult

The session is starting: the offer precedes any session output — render it now, before the first question or thread.

→ Proceed to **B. Offer**.

#### If at a natural break

A concern landed mid-session, or the user chose `later` earlier. Consult **[natural-breaks.md](natural-breaks.md)** — a recent `later` defers the re-offer until the conversation has genuinely moved on.

→ Proceed to **B. Offer**.

#### Otherwise

Mid-thread — never interrupt. The next iteration's check reconsiders.

→ Return to caller.

## B. Offer

Read the first two lines only of each queue file — the `### {title}` heading and the `*From: …*` provenance line. Never a body here.

> *Output the next fenced block as a code block:*

```
  ⚑ {count} rerouted concern(s) waiting in this topic's triage queue:

  1. {title} — from {origin} ({from_phase}, {from_date})
  2. ...
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Work through them now?

- **`d`/`discuss`** — Surface and discuss them one at a time
- **`l`/`later`** — Carry on with the session; I'll offer again at the next pause. The queue must be empty before this topic can conclude.
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `discuss`:**

The opt-in now stands — it authorises surfacing each remaining concern in turn, never agreement to any concern's content, and the user can park the queue at any point by saying so.

→ Proceed to **C. Raise One Concern**.

**If `later`:**

No opt-in. The check re-offers at a later break; the conclusion gate holds regardless.

→ Return to caller.

## C. Raise One Concern

Take the lowest-numbered concern still queued — or whichever the user asks for.

**If `phase` is `discussion`, arm the Discussion Map first** — the map tells the truth while the concern is live. Route on the subtopic the concern's title names (`{title:(kebabcase)}`), noting its prior state for the fold:

- Not on the map — new ground. Add it, then arm it:

  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map add {work_unit} {topic} {title:(kebabcase)}
  node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map set {work_unit} {topic} {title:(kebabcase)} exploring
  ```

- `decided` or `deferred` — settled ground is reopening — or `pending` — open ground coming under discussion. Arm it:

  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map set {work_unit} {topic} {title:(kebabcase)} exploring
  ```

- `exploring` or `converging` — already live. Leave it.

Present the concern whole — name its origin in a sentence, then render the entry:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render concern {work_unit}.{phase}.{topic} --file {NNN-slug}.md
```

Emit its `DISPLAY: rerouted concern` section verbatim as markdown (not a code block) — the dot rails frame where the entry starts and ends. The render's output is also your read of the concern: the origin session carried everything it worked out, and the user decides from the substance, never from the title.

Then break it down in your own voice before asking anything. The reopened ground may be days old and the reader cold — the verbatim entry is the record, the breakdown is what makes it workable: what the concern actually asks of this topic, how it sits against what this topic already decided, and a concrete rendering of the problem — a worked example in the topic's own terms, a small diagram where shape or flow helps, a before/after. Keep it simple and engineer-level, sized to the concern, and vary the shape across a multi-concern queue — identical breakdowns read as a template, not a colleague. The breakdown covers this concern alone: no other queued concern, open item, or finding rides along, and the closing question spans nothing the user hasn't seen. The test: the user can picture the problem before the first question arrives. End in a single opening question.

**STOP.** Wait for user response.

Then discuss it as real session material: engage, challenge, connect it to what this topic has already decided. Control belongs to the conversation — this may take one exchange or many, and the loop's other machinery (documenting, commits, dispatch checks) runs as normal around it. The concern on the table is the session's only subject and the only thing the user's agreement can cover: a tangent it surfaces is parked — on the Discussion Map as `pending`, or bookmarked in the research file — and picked up after the queue empties, and no question or proposal spans another queued concern, however the user phrases their steer.

**If the discussion reaches an outcome** — a decision, a direction, or the user explicitly parking it as a deferred thread:

→ Proceed to **D. Fold**.

**If the user moves on without engaging it** — they bounce to another subtopic, another concern, or the main thread:

The concern stays queued, untouched, and the opt-in is cleared. Follow them; the check re-offers at a later break, and the conclusion gate holds until the queue is empty.

→ Return to caller.

## D. Fold

Record the discussion in the topic's content. An outcome that re-decides ground this topic didn't introduce — it names an entity, field, rule, or classification this topic's artifact didn't define — requires the sibling consult before it is recorded: follow **G. Sibling consult at cross-topic decision points** in **[knowledge-usage.md](../../workflow-knowledge/references/knowledge-usage.md)** — query or cite, and carry the `Sibling check:` line in the recorded decision.

#### If `phase` is `discussion`

Write the concern into its armed subtopic:

- **New ground** (the raise's `add` created the subtopic): create a `## {title}` section whose `### Context` opens with a provenance line (`*From: {origin} · {from_phase} · {from_date}*`) followed by the concern's body, then document what the discussion concluded in the section's usual shape.
- **Pre-existing subtopic**: append the provenance line and the concern's body to that subtopic's existing `### Context` — never a new heading of your own. A map entry whose section was never written has nothing to append to: create the `## {title}` section exactly as the new-ground branch prescribes.

Then set the map state — the fold corrects the record, it never advances open ground:

- **New ground** → wherever the concern's own discussion landed — `decided` with a fully written section when the outcome is a decision.
- **Reopened settled ground** (was `decided` or `deferred` before the raise): the re-decision lands as a dated entry on the block per the template's revision convention → set `decided`. If the discussion left it genuinely open, leave it `exploring`.
- **Previously open ground** (was `pending`, `exploring`, or `converging` before the raise): leave it where the arming put it — never `decided` from a fold, however settled the exchange felt. Deciding open ground is the session's own work after the queue empties.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map set {work_unit} {topic} {title:(kebabcase)} {state}
```

→ Proceed to **E. Absorb**.

#### If `phase` is `research`

Fold the concern into the freeform body as a `### {title}` thread opening with the provenance line, followed by the body and what the discussion made of it.

→ Proceed to **E. Absorb**.

## E. Absorb

Delete the concern's queue file (`rm`) and commit it by name — one commit per absorbed concern, bracketing its life in history with the delivery commit that landed it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic {phase}/{topic} -m "{phase}({work_unit}/{topic}): absorb {NNN-slug} (from {origin})"
```

**If concerns remain queued:**

Not yours to raise here — the loop's next check raises the next one, with this absorb as its natural break.

→ Return to caller.

**Otherwise:**

> *Output the next fenced block as a code block:*

```
Triage queue clear — every rerouted concern is folded in.
```

The session continues wherever the map and conversation point: parked tangents, open threads, or conclusion if everything is settled.

→ Return to caller.
