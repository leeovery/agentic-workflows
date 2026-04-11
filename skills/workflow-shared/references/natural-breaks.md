# Natural Breaks

*Shared reference for identifying conversational breakpoints.*

---

Natural breaks are points in the conversation where introducing something new won't derail the current thread. Use this checklist when deciding whether to surface background-agent results or bring up deferred items.

This is guidance, not hard-enforced. Err toward NOT interrupting when uncertain — deferring one turn is cheap, interrupting an active thread is expensive.

## A. Signals That It IS a Natural Break

Any of these qualifies:

- A subtopic just transitioned to `decided` or `converging` — the current thread landed
- The user just said "what's next?", "move on", "anything else?", "ok", "done", or similar navigation cues
- The user just raised a new topic themselves (a clear pivot away from the current thread)
- A commit just landed AND the exchange prior to that commit resolved Claude's outstanding question
- The phase is about to conclude (convergence menu, final review, wrap-up)
- The user explicitly asked about background-agent state ("anything come back yet?", "any review results?")

## B. Signals That It Is NOT a Natural Break

Any of these means defer:

- Claude asked the user a direct question in its previous response and the user's reply hasn't yet arrived
- A subtopic is actively `exploring` and Claude is mid-probe on a specific concern within it
- The user is mid-response to a Claude-initiated question (said "hold on", "let me think", or has only partially answered)
- Claude is mid-synthesis or mid-summary and hasn't closed out the current point
- The current exchange is the first turn of a newly started subtopic — momentum belongs there, not to a new announcement
- The user just raised a new concern that Claude hasn't yet engaged with

## C. When Uncertain

Default to NOT interrupting. The cache file persists; the `acknowledged` state is designed to let you defer safely. The next iteration of the session loop's check-for-results will reconsider the same question.
