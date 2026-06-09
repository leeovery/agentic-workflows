# Document Review

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

The review agent catches *topical* gaps — areas that should have been explored. This check catches *conversational* gaps — substance that was discussed in the session but never made it into the discussion file. Only the main orchestrator can do this: you were in the conversation, a sub-agent wasn't.

Discussion is higher-stakes than research for this check. The Context → Options → Journey → Decision structure creates pressure to polish rationale beyond what was actually said, Journey sections are usually written after-the-fact and easy to clean up post-hoc, and tentative leans can harden into documented decisions. The specification phase builds directly from this file — drift here compounds downstream.

> *Output the next fenced block as a code block:*

```
·· Document Review ·······························
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reconciling the session conversation against the discussion file.
> Checking for gaps, hallucinations, and accuracy drift before
> concluding.
```

## A. Re-Read the Discussion Document

Read the discussion file in full: `.workflows/{work_unit}/discussion/{topic}.md`

Pull the current state fresh into context — don't rely on your memory of what you wrote earlier. Pay particular attention to:

- The **Discussion Map** and every subtopic's state
- Each subtopic section (Context → Options → Journey → Decision)
- The **Summary** section (Key Insights, Open Threads, Current State)
- The **Triage** section — it must read `(none)` by conclusion

→ Proceed to **B. Compare and Reconcile**.

## B. Compare and Reconcile

Walk the conversation against the document and check three dimensions:

1. **Undocumented substance** — threads, tangents, trade-offs, edge cases, provisional positions, or concerns that came up in conversation but never made it into a subtopic section or the Summary. Not verbatim — the *substance* of what was explored. This is the most common failure mode as sessions grow long and later exchanges crowd out earlier ones. Journey sections are especially vulnerable: they're supposed to capture the arc of how a decision was reached, and it's easy to write them tersely after the fact in a way that skips the actual back-and-forth.

2. **Hallucinated or embellished content** — claims, options, rationale, or Journey details in the document that don't trace back to anything actually discussed. Synthesis that drifted from what was said into what you *think* should have been said. Plausible-sounding filler in Decision sections that wasn't in the conversation.

3. **Accuracy drift** — positions documented as firmer than they were, tentative leans written as decisions, softened user pushback, competing options understated to make the chosen one look cleaner, or a subtopic marked `decided` on the Discussion Map when it was really `converging`. Check the Discussion Map itself for drift — child subtopics absorbed into a parent decision when they weren't fully resolved, Open Threads in the Summary that don't match what was actually left unresolved in the conversation.

4. **Triage consistency** — `## Triage` must read `(none)` by conclusion. The drain at session start normally clears it, but a concern can land mid-session after drain ran. If any `### {title}` entry remains, fold it into the working content — a `pending` subtopic on the Discussion Map plus a seeded `## {title}` section — and clear the section. If the `(none)` placeholder drifted (missing, or replaced by stray text with no real entry), restore it.

**Apply the reconciliation.** For each finding:

- Gap → add the missing substance to the discussion file at the appropriate place (subtopic section, Journey, or Summary)
- Hallucination → remove or correct to match what was discussed
- Drift → rewrite to faithfully reflect the conversation; correct Discussion Map states where needed
- Undrained Triage entry → fold into the Discussion Map and a subtopic section, then reset `## Triage` to `(none)`; restore the placeholder if it drifted

Commit the changes with a descriptive message (e.g., `docs(discussion): capture undocumented trade-off thread`, `docs(discussion): correct drift on caching decision`, `docs(discussion): soften Map state to converging`).

→ Proceed to **C. Brief the User**.

## C. Brief the User

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
Document review — discussion file reflects the session. No changes needed.
```

→ Return to caller.
