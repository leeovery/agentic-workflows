# Investigation: Show Interim Findings Before Check Prompt

## The Idea

In the bugfix investigation phase, present discovery findings to the user *before* asking whether to run the synthesis/check step. Reorder the flow so the validate/skip decision is made against visible content, not a blind prompt.

## Why This Matters

`workflow-investigation-process` currently runs discovery, writes findings to a file, runs the check, and only *then* surfaces anything to the user. The user is asked "do you want to check or skip?" with no presentation of what would be checked or skipped — they can't possibly make an informed decision against a blind prompt.

Most of the machinery is already there. The discovery happens, the content gets stored, the check runs against that content, then findings are presented. The proposal is just to reorder: surface the findings *before* the check prompt.

Even if the findings turn out to be wrong, presenting them as tentative is far more useful than hiding them. The user can spot obvious gaps, confirm a direction, or say "yes, dig into this one specifically" — none of which are possible when the prompt arrives with no context.

## The Reorder

The synthesis agent has a hard rule against modifying the investigation file — it writes only to a cache file. Findings content is therefore unchanged before and after synthesis runs, which means re-rendering the same structured block in two places is duplication.

The fix is a real reorder, not an additive interim render:

1. **Step 7 (`synthesis-agent.md`)** gains a new first section that renders the structured findings block (Root Cause / Contributing Factors / Blast Radius / Why It Wasn't Caught) before the validate/skip prompt. The synthesis result (validated line or gaps summary) prints immediately after, so the user sees findings + any gaps together upthread.
2. **Step 8 (`findings-review.md`)** stops re-rendering the same block on entry. It becomes a pure confirmation gate: "do these match your understanding?" against the content already visible above.

## The Feedback-Loop Split

Removing the entry render from Step 8 creates one wrinkle: the existing feedback branch updates the investigation file and loops back to re-show the findings before re-gating. If Step 8's first entry skips the render, the loop branch still needs one — otherwise the user is gating against stale content the second time around.

Split Step 8 into two sections:

- **Confirm Findings** — first-entry gate, no render. Findings are already visible upthread. Includes a fallback line for resume-after-compaction: if the user lands here without findings in view, ask and re-render.
- **Findings Updated — Re-Present** — feedback branch, with the structured render restored. Re-renders updated findings, then re-gates. Loops on itself until the user accepts.

## Outcome

- One findings render per investigation (two if the user pushes back).
- Two STOP gates on the happy path.
- Validate/skip is no longer blind.
- No content lost from either reference file.

## Design Consideration

The framing matters. Not "here are the conclusions" (which would overclaim and discourage the deeper check), but "root cause documented — verify, or skip?" That keeps the door open to the synthesis step without forcing the user to commit blind.

This pattern probably generalises beyond investigation — anywhere a phase asks "want me to do extra validation?" the user is better served by seeing the candidate output first.
