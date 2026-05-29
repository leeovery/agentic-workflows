# Investigation: Show Interim Findings Before Check Prompt

> **✅ Done.** Investigation now renders and confirms findings before the validation gate via `references/findings-review.md` (A. Confirm Findings, with a re-present feedback loop), landed in `51be34f1`/`bd9b35dd` (PR #282).

## The Idea

In the bugfix investigation phase, present discovery findings to the user *before* asking whether to run the synthesis/check step. Frame them as interim — "this is what I have so far. Want me to verify these, go deeper to confirm they're right, or is this enough?"

## Why This Matters

`workflow-investigation-process` currently runs discovery, writes findings to a file, runs the check, and only *then* surfaces anything to the user. The user is asked "do you want to check or skip?" with no presentation of what would be checked or skipped — they can't possibly make an informed decision against a blind prompt.

Most of the machinery is already there. The discovery happens, the content gets stored, the check runs against that content, then findings are presented. The proposal is just to reorder: surface the findings *before* the check prompt.

Even if the findings turn out to be wrong, presenting them as tentative is far more useful than hiding them. The user can spot obvious gaps, confirm a direction, or say "yes, dig into this one specifically" — none of which are possible when the prompt arrives with no context.

## Design Consideration

The framing matters. Not "here are the conclusions" (which would overclaim and discourage the deeper check), but "here's what I've gathered so far — worth verifying, or good enough?" That keeps the door open to the synthesis step without forcing the user to commit blind.

This pattern probably generalises beyond investigation — anywhere a phase asks "want me to do extra validation?" the user is better served by seeing the candidate output first.
