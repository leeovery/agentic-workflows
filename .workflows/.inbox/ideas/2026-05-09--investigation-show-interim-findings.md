# Bugfix investigation: show interim findings before the check/skip prompt

The investigation processing skill (`workflow-investigation-process`) currently runs discovery, writes its findings to a file, and only *after* the check completes does it surface anything to the user. The user is asked "do you want to check or skip?" without ever seeing what would be checked or skipped — they can't possibly make an informed decision against a blind prompt.

Most of the machinery is already there. The discovery happens, the content gets stored, the check runs against it, then findings are presented. The proposal is just to reorder: surface the findings *before* the check prompt, framed honestly as interim — "this is what I have so far. Want me to verify, go deeper to confirm these are right, or is this enough?"

Even if the findings turn out to be wrong, presenting them as tentative is far more useful than hiding them. The user can spot obvious gaps, confirm a direction, or say "yes, dig into this one specifically" — none of which are possible when the prompt arrives with no context.

The framing matters: not "here are the conclusions" (which would overclaim), but "here's what I've gathered so far — worth checking, or good enough?" That keeps the door open to refinement without making the user wait blind for it.
