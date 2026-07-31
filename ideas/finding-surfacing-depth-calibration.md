# Finding Surfacing: Calibrate Depth to Stakes, and Lead With a Concrete Instance

**Scope:** `workflow-shared/references/background-agent-surfacing.md` (§D + Never-Dump Checklist) and `workflow-discussion-process/references/guidelines.md` / `meeting-assistant.md`.

**Type:** Instruction-only. Two related defects — one specific to background-agent surfacing, one general to discussion.

---

## How it surfaced

A live discussion run — `fumi` epic, `storage-and-sync` topic. The topic had been closed as fully decided, then had 11 concerns rerouted back into it from sibling topics. A review agent returned **16 findings**, and the orchestrator walked them one at a time exactly as the surfacing protocol prescribes: one finding per turn, one question, engage, document, commit, surface the next.

The protocol worked — nothing was dumped, nothing was lost, every finding got its own turn. After roughly seven findings the maintainer stopped the run anyway:

> "I'm struggling to track with these descriptions. I think what would be useful is examples. But more important than that, if there's not really a decision to make, it maybe doesn't need quite so much explanation, because it seems most of these decisions are actually not really decisions at all. Most of the time, you're just describing something that's happening or that needs to happen, and then we have an obvious solution for it that really is a no-brainer, and then I just end up saying, 'Yes,' or, 'I agree.'"

And, on why that matters rather than being merely tedious:

> "reading that wall of text is very mentally draining. If I can't visualise the problem or track it, then I'm not really in a good place to make a decision. And that becomes quite a stressful moment."

Explicitly **not** a request to surface less:

> "I'm not suggesting that these shouldn't be surfaced to me for collaboration, because sometimes you might get it wrong, but I just wonder if there's a better way than what we're doing."

Asked whether this was findings-specific or general, the maintainer's own read — which matches the evidence below:

> "review findings is quite specific because you're in a loop bringing up stuff that generally is probably only being surfaced because it's like gaps or errors within the existing document, as opposed to a natural conversation that probably flows okay. In fact, that does match up with my experience."

---

## The problem

**Two distinct defects, one specific and one general.**

### 1. The surfacing protocol sizes the *move* but not the *presentation*

`background-agent-surfacing.md` §D specifies three beats — **Present**, **Position**, **Move** — and calibrates only the last:

> **Move** — sized to how settled the finding is: a clear resolution — propose it; genuinely open — sketch the option space; needs investigation — suggest research or a deep-dive.

The **Present** beat has the opposite instruction, and no upper bound:

> orientation before any assessment … in plain, self-contained terms a user returning after hours can follow. Restate any term borrowed from another subtopic or an earlier decision; never reference it bare.

That guidance is *correct* — findings genuinely do arrive cold — but it is applied uniformly. A finding whose answer is "yes, obviously, recorded" gets the same full orientation as one that forks the architecture. Across a 16-finding queue the reader spends most of their attention re-loading context in order to say "agreed" for the seventh time.

The Never-Dump Checklist enforces *volume per turn* (one finding, one question) but says nothing about *depth per finding*, so the protocol is satisfied while the effect it was written to prevent — cognitive overload — occurs anyway, spread across turns instead of within one.

### 2. Nothing anywhere says "lead with an instance, not a mechanism"

The discussion guidelines cover "multiple-choice preferred", "journey over destination", "why over what" — but never say that an abstract description of a mechanism is much more expensive to read than a worked example of it going wrong.

**Evidence from the same session, outside the findings loop.** Opening the `per-device-settings` subtopic, the orchestrator presented two storage shapes (a record per `{note, device}` vs one record per device) with trade-offs. Response:

> "I'm a bit confused here. Again, maybe an example would help … I'm a little confused what we're talking about."

It only landed after a concrete scenario — *three fumis arranged on a Studio, the same three notes on a laptop, wipe the Studio and you want its arrangement back*. Same content, same length, comprehensible because it was an instance rather than a description. No review agent involved, so this half is a general discussion defect.

### Why findings need ceremony that ordinary conversation doesn't

Worth recording, because it justifies fixing these in two different places rather than one:

- Findings arrive **unbidden, cold, and queued** — the user didn't ask, there's no narrative thread between consecutive findings, and each references parts of a document last seen hours ago. Hence the full-orientation rule.
- In ordinary conversation the user is driving, already holds the context, and **their own question signals what kind of answer they want**.

So the classification tag below is worth its overhead *only* in the surfacing path. Tagging ordinary conversational turns would be ceremony for its own sake.

---

## Suggested fixes

### A. Classify before raising *(surfacing protocol, §D)*

A step ahead of the existing Present/Position/Move beats: decide whether the finding is a **confirmation** or a **fork**, and make the tag **user-visible** so the reader knows which mode is being asked of them before they start reading.

- **`[confirm]`** — no real choice. The finding is correct, the consequence follows, and the resolution is a no-brainer.
- **`[decide]`** — a genuine fork with more than one defensible answer.

### B. Budget the confirmations hard *(surfacing protocol, §D + Never-Dump Checklist)*

A `[confirm]` gets a strict cap — what it spotted, what follows, and "recording it that way unless you object". If it doesn't fit the cap, it wasn't a confirmation and should be re-tagged.

Add a matching checklist line, e.g. *"□ If tagged `[confirm]`, it fits the cap — if it doesn't, it's a `[decide]`."*

### C. Concrete before abstract *(discussion guidelines — general, not findings-only)*

State the rule the guidelines currently lack:

> Lead with a worked instance, not a description of a mechanism. Show the case where it goes wrong — specific values, two named machines, an actual sequence — then generalise. A reader who can picture the failure can judge the fix; a reader parsing a mechanism is still building the picture when the question arrives.

This belongs with the existing "multiple-choice preferred" guidance, and applies to orchestrator-initiated exploration as much as to agent findings.

### Risk, and its mitigation

**Mis-tagging a genuine fork as `[confirm]` gets it rubber-stamped** — the user skims, says yes, and a real decision passes unexamined. That is strictly worse than the fatigue this fixes. Two guards:

1. **When unsure, tag it `[decide]`.** The cost of over-explaining once is trivial next to a silently rubber-stamped architectural choice.
2. **A `[confirm]` must still state what would change if the user disagreed** — otherwise there is nothing to disagree *with*, and the tag becomes a rubber stamp by construction.

---

## Notes

- The protocol is shared, so A and B also affect synthesis tensions and deep-dive findings across research, investigation and review — not just discussion reviews.
- Neither fix changes lifecycle state, engine surfaces, or file formats. Instruction-only, and both are small.
- Surfaced live rather than by audit; the maintainer stopped a 16-finding run mid-queue to raise it, which is itself a signal about the load.
