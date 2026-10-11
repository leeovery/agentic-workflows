The prose should have taken this path:

1. resolves the topic to the work unit
2. the code-slot check runs immediately, before anything is validated or
   written — it reads the whole project rather than this work unit, and
   comes back carrying the gate: both its sections are emitted verbatim,
   the blocking fact naming who holds the slot, where, and how long ago
   they were active, then the menu
3. the walk stops there for the user's answer — the gate is a stop, not a
   notice
4. on `back` the leave-it-alone line is emitted, then — a feature, not
   an epic — the start menu is rendered in place: the arrival recorded
   (the label put back where the user opted in), the workflow state
   re-read, and `pay` shown with its menu, the flow stopped there for the
   user

Further claims:

- nothing past the gate ran at all: the prerequisite gate was never
  rendered, the review status was never read, no review item was
  touched, and the plan — its format included — was never read
- no verifier agents are dispatched
- the back neither ends the session nor tells the user to run
  `/workflow-start` — the start menu is rendered from inside the review
  skill
- the holding session's heartbeat is left exactly as it was — the gate
  names how to release it, and reading a gate never releases anything

EXPECTED WORLD — the fixture, unchanged.
