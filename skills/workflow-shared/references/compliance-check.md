# Compliance Self-Check

*Shared reference for all processing skills.*

---

Before concluding this phase, verify that the skill instructions were followed correctly throughout this session. This check exists because context drift is real — after a long session, the original instructions may be buried under pages of conversation. Re-reading pulls them fresh into attention so the audit is actually effective.

## A. Re-Read Skill Instructions

1. **Re-read the processing skill's SKILL.md** — the top-level file of the current processing skill (the backbone that loaded this reference, or its parent backbone if loaded from within a reference file). Read it completely.
2. **Re-read every reference file that was loaded during this session.** The SKILL.md's step directives list them. Re-read each one.

This is non-negotiable. Do not skip this step or rely on your memory of what the instructions said. The re-read IS the mechanism.

## B. Audit the Session

With the instructions fresh in context, review the conversation transcript and compare what happened against what the instructions prescribed:

1. **Step compliance** — Were all steps followed in the correct order? Were any skipped or executed out of sequence?
2. **STOP gate compliance** — Were STOP gates respected? Was user input awaited where required?
3. **Output compliance** — Did outputs match the display and rendering conventions specified in the instructions?
4. **Hard rules** — Were any hard rules (if specified in the skill) violated?
5. **Artifact correctness** — Are all working artifacts (discussion files, specifications, plans, investigation files, review reports, code) correct and consistent with what the instructions prescribed?
6. **Manifest correctness** — Was the manifest updated via the CLI with the right fields, values, and paths? Were any manual edits made that should have gone through the CLI?
7. **Commit discipline** — Were changes committed at natural breaks as required?

## C. Assess and Act

#### If no issues found

Proceed silently. No output.

→ Return to caller.

#### If minor issues found

Issues are minor when they have no downstream impact — nothing the user has seen is wrong, no artifacts are incorrect, no course correction is needed. Examples: a commit that could have happened one step earlier, a display convention that was slightly off but the user already moved past it.

Self-correct where possible (e.g., make a missing commit now). No need to surface to the user.

→ Return to caller.

#### If significant issues found

Issues are significant when they affect artifacts, code, manifest state, tracking files, or require the user to understand what happened before proceeding. Examples: a skipped step that produced incomplete artifacts, manifest state that doesn't reflect actual progress, code that doesn't match what the plan or specification called for, multiple steps executed out of order.

Surface to the user:

> *Output the next fenced block as a code block:*

```
Compliance Check — Issues Found

{number} issue(s) detected during self-check.
```

For each issue, explain:

1. **What happened** — which instruction was not followed and what occurred instead
2. **Impact** — what was affected (files, manifest, code, tracking state, etc.)
3. **Correction** — what needs to happen to fix it

Apply corrections that are safe to make without user input (file updates, manifest fixes, missing commits). For corrections that would change code or artifacts the user has already seen and approved, explain the proposed change and get confirmation first.

**STOP.** Wait for user response before proceeding.

After corrections are applied:

→ Return to caller.
