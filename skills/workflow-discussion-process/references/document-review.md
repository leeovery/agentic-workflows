# Document Review

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

The review agent catches *topical* gaps — areas that should have been explored. This check catches *conversational* gaps — substance that was discussed in the session but never made it into the discussion file. Only the main orchestrator can do this: you were in the conversation, a sub-agent wasn't.

Discussion is higher-stakes than research for this check. The Context → Options → Journey → Decision structure creates pressure to polish rationale beyond what was actually said, Journey sections are usually written after-the-fact and easy to clean up post-hoc, and tentative leans can harden into documented decisions. The specification phase builds directly from this file — drift here compounds downstream.

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Document Review`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reconciling the session conversation against the discussion file. Checking for gaps, hallucinations, and accuracy drift before concluding.
```

## A. Re-Read the Discussion Document

Read the discussion file in full: `.workflows/{work_unit}/discussion/{topic}.md`

Pull the current Discussion Map state fresh as well:

```bash
node .claude/skills/workflow-discussion-process/scripts/gateway.cjs map {work_unit} {topic}
```

Don't rely on your memory of what you wrote earlier. Pay particular attention to:

- The **Discussion Map** — every subtopic's state from the call's DATA section
- Each subtopic section (Context → Options → Journey → Decision)
- The **Summary** section (Key Insights, Open Threads, Current State)

→ Proceed to **B. Compare and Reconcile**.

## B. Compare and Reconcile

Walk the conversation against the document and check seven dimensions (the last two sweep the document alone):

1. **Undocumented substance** — threads, tangents, trade-offs, edge cases, provisional positions, or concerns that came up in conversation but never made it into a subtopic section or the Summary. Not verbatim — the *substance* of what was explored. This is the most common failure mode as sessions grow long and later exchanges crowd out earlier ones. Journey sections are especially vulnerable: they're supposed to capture the arc of how a decision was reached, and it's easy to write them tersely after the fact in a way that skips the actual back-and-forth.

2. **Hallucinated or embellished content** — claims, options, rationale, or Journey details in the document that don't trace back to anything actually discussed. Synthesis that drifted from what was said into what you *think* should have been said. Plausible-sounding filler in Decision sections that wasn't in the conversation.

3. **Accuracy drift** — positions documented as firmer than they were, tentative leans written as decisions, softened user pushback, competing options understated to make the chosen one look cleaner, or a subtopic marked `decided` on the Discussion Map when it was really `converging`. Check the Discussion Map itself for drift — child subtopics absorbed into a parent decision when they weren't fully resolved, Open Threads in the Summary that don't match what was actually left unresolved in the conversation.

4. **Revision landing** — a decision changed this session that was recorded in an earlier sitting must carry a dated timeline entry with a substance-bearing trigger line (the template's revision convention); earlier entries and the wrapped `#### Initial` must be unedited. A plain Decision block is fine when nothing recorded earlier was re-decided.

5. **Misdirected knowledge** (epics only) — prose addressed to another topic instead of recording this topic's own ground: notes to carry forward ("→ {topic}: …"), corrections owed to a sibling whose decided text this session's decisions superseded, "tell {topic} about X" asides. Usually stranded in Summary → Open Threads, but check everywhere. A citation of a sibling's decision as context is fine — only knowledge *owed to* another document qualifies. The sanctioned path for these is the session's own reroute at the moment the correction is known; anything found here is a miss to repair, not a convention to preserve.

6. **Pipeline meta** — the document stating its own pipeline position: readiness declarations ("ready for specification"), decided-subtopic counts, review-cycle tallies — whether written this session or in an earlier sitting. Usually lands in Summary → Current State, but check everywhere except earlier dated entries and the wrapped `#### Initial`, which stay as written. Per-subtopic resolution prose ("X decided — {substance}") is substance and stays; the aggregate goes. The manifest carries that state.

7. **Unverified claims** — every load-bearing empirical claim about the codebase or toolchain, whatever session wrote it. Re-run its recorded command; construct the obvious measurement where none is recorded (and record it with the result — the command alone in its span so it re-runs by copy: `` `cmd` `` → result). The documents' own figures, and anything asserted as verified earlier, are claims — not measurements. A load-bearing claim no command can check is softened to observation.

**Apply the reconciliation.** For each finding:

- Gap → add the missing substance to the discussion file at the appropriate place (subtopic section, Journey, or Summary)
- Hallucination → remove or correct to match what was discussed
- Drift → rewrite to faithfully reflect the conversation; correct Discussion Map states where needed (`node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map set {work_unit} {topic} {subtopic} {state}`)
- Mislanded re-decision → restructure the block into the timeline shape (wrap the original prose as `#### Initial`, place the dated entry above it); restore any edited earlier entry from git
- Misdirected knowledge → set aside for **C. Route Misdirected Knowledge** — never silently deleted, never landed without the gate
- Pipeline meta → remove it — fold any genuine substance it carries back into the document (an open condition becomes an Open Thread), never the status itself
- False claim → correct to the measured value, recording the command, and repair citing prose — except where the corrected value undermines a decision or insight built on the claim: hold that one for the raise below, never patched silently

Commit the changes (`engine commit {work_unit} --topic discussion/{topic} -m "..."`) with a descriptive message (e.g., `docs(discussion): capture undocumented trade-off thread`, `docs(discussion): correct drift on caching decision`, `docs(discussion): soften Map state to converging`).

#### If a corrected value undermines a decision or insight built on the claim

Put the measurement to the user — what the document asserts, the command and its result, and which decision or insight leans on it. What the conclusion means under the true value is theirs to re-weigh.

**STOP.** Wait for user response.

Land their answer in the document — a changed decision as the template's dated timeline revision, the citing prose repaired either way — and commit.

→ Proceed to **C. Route Misdirected Knowledge**.

#### Otherwise

→ Proceed to **C. Route Misdirected Knowledge**.

## C. Route Misdirected Knowledge

#### If the work type is not `epic`

Single-topic work has no sibling to route to. Surface each note now, one sentence apiece — what it says and which work unit it points at; the prose stays where it is and the user decides what to do with it.

→ Proceed to **D. Brief the User**.

#### If no unhandled note remains

Every note set aside in **B** has been gated (or none existed). When any reroute record was written, commit it — each landing already committed itself:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic discussion/{topic} -m "discussion({work_unit}/{topic}): document review — reroute carry-notes via triage"
```

→ Proceed to **D. Brief the User**.

#### Otherwise

The unhandled notes go on screens of at most five — the same batch the surfacing protocol sends rerouted findings on, over the same kind of item; an approved screen returns here for the next. Handled-ness lives in the document itself: a landed note reads as a reroute record, a kept note stays as prose — so a re-run after a context refresh re-presents kept notes, which costs a repeat ask, never a silent loss. A note addressed to *this* topic is not a reroute — treat it as undocumented substance: fold it into the document, no gate.

Judge each note's target topic from its own addressing, and its `landing_phase` per **Judging the Landing Phase** in **[triage-landing.md](../../workflow-shared/references/triage-landing.md)**. Write the payload with the Write tool (`{"lane": "route", "items": [{"title": "…", "target": "…", "detail": "…"}], "remaining": N}`, one entry per unhandled note — up to five, `remaining` counting those beyond the screen: `title` is the note's own claim, `target` is the topic, `detail` is why it is theirs and which queue it lands in), then render it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render finding-batch {work_unit}.discussion.{topic} --file .workflows/.cache/{work_unit}/discussion/{topic}/carry-notes.json
```

Emit the call's DISPLAY and MENU sections, each verbatim per its marker.

**STOP.** Wait for user response.

**If `yes`:**

Deliver each note in turn. Build its concern from the note *plus* the session context it stems from — the decision that superseded the sibling's text, the reasoning, what the sibling needs to change — the target resolves it from cold.

→ Load **[triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{target}`, concern = `{the note's full context}`, origin = `{topic}`, phase = `discussion`, landing_phase = `{landing_phase}`, date = `{today}`.

On return: if `result` is `landed`, the note is handled — replace the stranded prose with a reroute record in place, `Rerouted to {landed_topic} triage ({date}).`, and when the landing response carried `reconcile_flagged` or `sources_staled`, tell the user what it flagged — the target's completed discussion (research landing) or the specification(s) named in `sources_staled` (discussion landing, their extraction now stale). If `result` is `cancelled`, nothing was written — the note stays unhandled and re-presents on the next run.

→ Return to **C. Route Misdirected Knowledge**.

**If the user asks about a number:**

Answer it — what the note says, where it sits, why that target. A note the user says belongs here is handled: the prose stands as written, by their choice. Adjust a target, landing phase, or concern content they correct. The screen re-renders for the notes still unsent.

→ Return to **C. Route Misdirected Knowledge**.

**If the user moves on without answering** — they bounce to another concern or the main thread:

Nothing lands. The notes stay as prose and stay unhandled — a later run re-presents them, and the conclusion gate still sees them.

→ Proceed to **D. Brief the User**.

## D. Brief the User

#### If changes were made

Summarise conversationally — do not dump a diff. One short paragraph or a handful of bullets describing what was added, removed, or corrected and why.

> *Output the next fenced block as markdown (not a code block):*

```
> Document review complete. {N} gap(s) captured, {M} correction(s) applied. Proceeding to the final compliance check.
```

→ Return to caller.

#### If the document is complete and accurate

> *Output the next fenced block as a code block:*

```
Document review — discussion file reflects the session. No changes needed.
```

→ Return to caller.
