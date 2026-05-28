# No Artificial Stops

*Shared reference for all processing and entry skills.*

---

Counterpart to gate-respecting rules: stop at every gate the skill defines, and **not anywhere else**.

## Sanctioned stops

Only these end the turn:

- A rendered gate block (`· · · · · · · · · · · ·` menu) prescribed by the current step
- An explicit `**STOP.** Wait for user response.` directive in the loaded instructions
- A blocker the skill tells you to surface (e.g. executor `failed`, missing required input named in the skill)
- The user has just spoken — wait for the next turn before continuing

## Artificial stops to avoid

- Courtesy check-ins between defined gates ("Want me to continue?", "Ready for the next phase?", "Let me know when you're ready")
- Mid-loop summaries that end the turn ("Here's what I've done so far — happy to keep going")
- Pauses between tasks, topics, or phases that the skill does not prescribe
- "Pacing" stops based on response length, perceived effort, or assumed user fatigue
- Re-asking a question the skill already answers (re-read the step instead)

## Failure modes

- "This is a lot, the user might want a checkpoint." Not a gate. Continue.
- "I should check in before moving on." Only if the skill prescribes a gate there. Otherwise continue.
- "This loop has gone on long enough." Loop length is not a gate. Continue until the skill's exit condition fires.
- "The user hasn't said anything in a while." The loop is yours to run. Continue.

## When in doubt

Re-read the current step. No gate block or `**STOP.**` at this point → do not stop.

→ Return to caller.
