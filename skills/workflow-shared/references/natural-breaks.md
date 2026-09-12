# Natural Breaks

*Shared reference. Loaded by `rerouted-concerns.md` (the triage check) and discussion's `background-agent-surfacing.md` (the findings surfacing).*

---

Natural breaks are points in the conversation where introducing something new won't derail the current thread. Use this checklist when deciding whether to raise what is waiting — a background agent's return, a queued concern — or bring up deferred items.

This is guidance, not hard-enforced. Err toward NOT interrupting when uncertain — deferring one turn is cheap, interrupting an active thread is expensive.

## A. Signals That It IS a Natural Break

Any of these qualifies:

- The current thread landed — a subtopic reached `decided` or `converging`, a research thread went `learned` or `parked`
- The user just said "what's next?", "move on", "anything else?", "ok", "done", or similar navigation cues
- The user just raised a new topic themselves (a clear pivot away from the current thread)
- A commit just landed AND the exchange prior to that commit resolved your outstanding question
- The phase is about to conclude (convergence menu, the conclude gate, wrap-up)
- The user explicitly asked about background-agent state ("anything come back yet?", "any results?")
- The session just opened or resumed and no conversation thread is underway yet — a pending announcement lands here, before momentum builds, rather than falling to **C**'s default

## B. Signals That It Is NOT a Natural Break

Any of these means defer:

- You asked the user a direct question in your previous response and their reply hasn't yet arrived
- A subtopic is actively `exploring`, or a thread is being dug, and you are mid-probe on a specific concern within it
- The user is mid-response to a question you initiated (said "hold on", "let me think", or has only partially answered)
- You are mid-synthesis or mid-summary and haven't closed out the current point
- The current exchange is the first turn of a newly started subtopic or thread — momentum belongs there, not to a new announcement
- The user just raised a new concern that you haven't yet engaged with
- The user picked `later` on an announce or offer menu (background-agent findings, the triage queue) in their most recent turn — treat the next few turns as continuation, not a fresh break. Re-raising the menu on the very next turn would ignore their deferral. Wait until the conversation has genuinely moved on before re-raising — unless the user is now concluding: a conclusion attempt is the break the deferral was waiting for, and it holds over the `later`.

## C. When Uncertain

Default to NOT interrupting. What is waiting persists — the agent store row, the triage queue — and the session loop's next iteration reconsiders the same question.

→ Return to caller.
