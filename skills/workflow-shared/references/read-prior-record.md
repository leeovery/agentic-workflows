# Read the Topic's Prior Record

*Shared reference. Loaded by the research and discussion processing skills at initialisation.*

---

A topic pulled onto this epic's map after another epic postponed it carries `prior` — the address of the topic it was there. That epic's brief, research, discussion, and undelivered concerns are this phase's inherited ground, read here as a durable input beside this topic's own carrier.

Caller passes `work_type`, `work_unit`, `topic`, `phase` (`research` or `discussion`).

## A. Read the Record

#### If `work_type` is not `epic`

Only an epic's map rows carry `prior` — nothing to read here.

→ Return to caller.

#### Otherwise

Read the pointer:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discovery.{topic} prior
```

**If the read is empty:**

No prior record — the topic is this epic's own, or came off the roadmap without one.

→ Return to caller.

**Otherwise:**

The value names a work unit and a topic — the epic that postponed this topic, and the name it went by there; `{prior_unit}` and `{prior_topic}` below. Read in full whatever exists, in this order, every path relative to `.workflows/{prior_unit}/`:

1. The brief — the path `engine manifest get {prior_unit}.discovery.{prior_topic} brief_path` names, canonically `discovery/briefs/{prior_topic}.md`.
2. `research/{prior_topic}.md`
3. `discussion/{prior_topic}.md`
4. Every file under `research/.triage/{prior_topic}/` and `discussion/.triage/{prior_topic}/`.

What that epic settled enters here as soft decisions, rejected paths, and open questions — exactly the standing a brief's content has, never as decided. This phase relitigates: a conclusion the record reached is a starting position this session is free to move, and the conclusion this session reaches is its own. Don't dump the record back to the user.

The prior epic's files are its record: read them, never edit, drain, or move them. No engine call touches them — no `topic queue`, no `absorb`, no `requeue`.

→ Proceed to **B. The Queued Concerns**.

## B. The Queued Concerns

Each triage file read at **A** is a concern another topic routed to the topic that waited, never delivered. Judge each against the record just read and against what this phase is here to do: does its ask still apply?

**A concern whose ask still applies** is raised in this session as an opener. This record is the session's own ground, so a concern against what it settled opens the session rather than waiting for a break in it, and several are walked one at a time.

Raise and fold each as **C. Raise One Concern** and **D. Fold** in **[rerouted-concerns.md](rerouted-concerns.md)** prescribe — the entry as the brief, its depth entering as responses, the Discussion Map armed before a discussion's raise, the outcome written by the `{phase}` branch of the fold — composing the raise with source = `reroute` and origin = `{prior_unit}/{prior_topic}`. The queue's own machinery has nothing to act on here: no offer, no requeue, no absorb, and no `remaining` to route on.

**A concern whose ask no longer applies** — the record answers it, or the ground it stood on is gone — takes one line in this phase's opening context, beside what the record left: the discussion's **Context** section, whose **References** name the prior files; the research file's **Starting Point**.

→ Return to caller.
