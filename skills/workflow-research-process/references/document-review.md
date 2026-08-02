# Document Review

*Reference for **[workflow-research-process](../SKILL.md)***

---

The review agent catches *topical* gaps — areas that should have been explored. This check catches *conversational* gaps — substance that was discussed in the session but never made it into the research file. Only the main orchestrator can do this: you were in the conversation, a sub-agent wasn't.

> *Output the next fenced block as a code block:*

```
·· Document Review ······························
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reconciling the session conversation against the research file.
> Checking for gaps, hallucinations, and accuracy drift before
> concluding.
```

## A. Re-Read the Research Document

Read the research document(s) in full:

- Feature: `.workflows/{work_unit}/research/{topic}.md`
- Epic: all files in `.workflows/{work_unit}/research/` relevant to the current topic

Pull the current state fresh into context — don't rely on your memory of what you wrote earlier.

→ Proceed to **B. Compare and Reconcile**.

## B. Compare and Reconcile

Walk the conversation against the document and check four dimensions:

1. **Undocumented substance** — threads, insights, constraints, open questions, tradeoffs, or preliminary positions that came up in conversation but never made it into the document. Not verbatim — the *substance* of what was explored. This is the most common failure mode as sessions grow long and later exchanges crowd out earlier ones.

2. **Hallucinated or embellished content** — claims in the document that don't trace back to anything actually discussed. Synthesis that drifted from what was said into what you *think* should have been said. Numbers, names, specifics that weren't in the conversation.

3. **Accuracy drift** — positions documented as firmer than they were, tentative leans written as decisions, softened user views, tradeoffs reframed beyond what the conversation supported, or context omitted that changes how a position should read.

4. **Misdirected knowledge** (epics only) — prose addressed to another topic instead of recording this topic's own ground: notes to carry forward ("→ {topic}: …"), findings owed to a sibling, "tell {topic} about X" asides, wherever they sit. A citation of a sibling's conclusions as context is fine — only knowledge *owed to* another document qualifies. The sanctioned path for these is the session's own reroute at the moment the finding is known; anything found here is a miss to repair, not a convention to preserve.

**Apply the reconciliation.** For each finding:

- Gap → add the missing substance to the research file at the appropriate place
- Hallucination → remove or correct to match what was discussed
- Drift → rewrite to faithfully reflect the conversation
- Misdirected knowledge → set aside for **C. Route Misdirected Knowledge** — never silently deleted, never landed without the gate

Commit the changes (`engine commit {work_unit} --topic research/{topic} -m "..."`) with a descriptive message (e.g., `docs(research): capture undocumented tradeoff thread`, `docs(research): correct drift on storage preference`).

→ Proceed to **C. Route Misdirected Knowledge**.

## C. Route Misdirected Knowledge

#### If the work type is not `epic`

Single-topic work has no sibling to route to. Surface each note now, one sentence apiece — what it says and which work unit it points at; the prose stays where it is and the user decides what to do with it.

→ Proceed to **D. Brief the User**.

#### If no unhandled note remains

Every note set aside in **B** has been gated (or none existed). When any reroute record was written, commit it — each landing already committed itself:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic research/{topic} -m "research({work_unit}/{topic}): document review — reroute carry-notes via triage"
```

→ Proceed to **D. Brief the User**.

#### Otherwise

Take the next unhandled note. Handled-ness lives in the walk and is recoverable from the document itself: a landed note reads as a reroute record, a kept note stays as prose — so a re-run after a context refresh re-presents kept notes, which costs a repeat ask, never a silent loss. A note addressed to *this* topic is not a reroute — treat it as undocumented substance: fold it into the document, no gate.

Judge the target topic from the note's own addressing, and judge `landing_phase` from its nature — an open question needing exploration → `research`; a correction or decision owed → `discussion`. Present it:

> *Output the next fenced block as markdown (not a code block):*

```
{the note, quoted}

*Addressed to: {target} — lands in its {landing_phase} triage queue*
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Land this note in "{target}"'s triage queue? If "{target}" is
completed, landing reopens it.

- **`y`/`yes`** — Land it there; this document keeps a reroute record
- **`s`/`skip`** — Leave it as prose in this document
- **Comment** — Tell me what to change (target, phase, or content)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

Build the concern from the note *plus* the session context it stems from — the finding, the reasoning, what the target needs to know — the target resolves it from cold.

→ Load **[triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{target}`, concern = `{the note's full context}`, origin = `{topic}`, phase = `research`, landing_phase = `{landing_phase}`, date = `{today}`.

On return: if `result` is `landed`, the note is handled — replace the stranded prose with a reroute record in place, `Rerouted to {landed_topic} triage ({date}).`, and when the landing response carried `reconcile_flagged`, tell the user the target's completed discussion was flagged to reconcile. If `result` is `cancelled`, nothing was written — the note stays unhandled and re-presents; dropping it for good is the `skip` arm's job.

→ Return to **C. Route Misdirected Knowledge**.

**If `skip`:**

The note is handled — the prose stands as written, by the user's choice.

→ Return to **C. Route Misdirected Knowledge**.

**If comment:**

Adjust the target, landing phase, or concern content per the user's feedback; the note stays unhandled and re-presents.

→ Return to **C. Route Misdirected Knowledge**.

## D. Brief the User

#### If changes were made

Summarise conversationally — do not dump a diff. One short paragraph or a handful of bullets describing what was added, removed, or corrected and why.

> *Output the next fenced block as markdown (not a code block):*

```
> Document review complete. {N} gap(s) captured, {M} correction(s)
> applied. Proceeding to the final compliance check.
```

→ Return to caller.

#### If the document is complete and accurate

> *Output the next fenced block as a code block:*

```
Document review — research file reflects the session. No changes needed.
```

→ Return to caller.
