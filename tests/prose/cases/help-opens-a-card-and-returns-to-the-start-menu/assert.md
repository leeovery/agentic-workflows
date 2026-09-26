The prose should have taken this path:

1. loads the shared framework — instructions, casing conventions, voice,
   altitude, ask-or-decide, and the rule for answering questions about
   how the system works — before any state is read
2. runs the boot pipeline; the walkthrough answer is already recorded, so
   no offer is made and no screen of the walk is fetched, and the
   remaining initialisation renders nothing
3. gets the workflow state from the discovery gateway script and shows
   `pay` as the only active work, with a menu carrying the `h/help` row
4. the help row is terminal for workflow-start: it invokes the help skill
   rather than loading a reference of its own, and help opens on its home
   — the title and the menu, nothing else, since the home has no display
5. on `t`, fetches the card list and reads its `DATA` section rather than
   displaying it, taking the slug for row 1 from the `CARDS` table
   (`kinds-of-work`) and never from the menu row's label, then emits the
   title and the menu and stops
6. fetches that card and emits it in the forms its own markers name — the
   title as markdown, the prose sections as markdown (not a code block),
   the diagram between them as a text code block (```text fence) — then
   its menu
7. on `b` from the card, goes back to help and re-renders the home rather
   than recalling what was shown earlier in the conversation
8. on `b` from the home, puts the original session label back and
   re-renders the start menu in place — `pay` and its menu again, the
   flow stopped there for the user

Further claims:

- no screen of the walk is rendered at any point: the walk is the home's
  other row, and it was never taken
- the card's text is emitted as the engine gave it — never summarised,
  reflowed or trimmed
- reading help is a read: nothing is created, recorded or committed, and
  the feature is untouched
- the back neither ends the session nor tells the user to run
  `/workflow-start` — the start menu is rendered from inside help
