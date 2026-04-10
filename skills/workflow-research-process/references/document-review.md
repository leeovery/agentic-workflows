# Document Review

*Reference for **[workflow-research-process](../SKILL.md)***

---

The review agent catches *topical* gaps — areas that should have been explored. This check catches *conversational* gaps — substance that was discussed in the session but never made it into the research file. Only the main orchestrator can do this: you were in the conversation, a sub-agent wasn't.

> *Output the next fenced block as a code block:*

```
·· Document Review ·······························
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

Walk the conversation against the document and check three dimensions:

1. **Undocumented substance** — threads, insights, constraints, open questions, tradeoffs, or preliminary positions that came up in conversation but never made it into the document. Not verbatim — the *substance* of what was explored. This is the most common failure mode as sessions grow long and later exchanges crowd out earlier ones.

2. **Hallucinated or embellished content** — claims in the document that don't trace back to anything actually discussed. Synthesis that drifted from what was said into what you *think* should have been said. Numbers, names, specifics that weren't in the conversation.

3. **Accuracy drift** — positions documented as firmer than they were, tentative leans written as decisions, softened user views, tradeoffs reframed beyond what the conversation supported, or context omitted that changes how a position should read.

**Apply the reconciliation.** For each finding:

- Gap → add the missing substance to the research file at the appropriate place
- Hallucination → remove or correct to match what was discussed
- Drift → rewrite to faithfully reflect the conversation

Commit the changes with a descriptive message (e.g., `docs(research): capture undocumented tradeoff thread`, `docs(research): correct drift on storage preference`).

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
Document review — research file reflects the session. No changes needed.
```

→ Return to caller.
