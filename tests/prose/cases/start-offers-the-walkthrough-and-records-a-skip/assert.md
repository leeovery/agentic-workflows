The prose should have taken this path:

1. loads the shared framework — instructions, casing conventions, voice,
   altitude, ask-or-decide, and the rule for answering questions about
   how the system works — before any state is read
2. runs the boot pipeline, and since no migrations applied and the
   knowledge base is ready, raises neither the migrations confirmation
   nor the knowledge gate
3. reads `walkthrough: none` on the boot response and, before any of the
   setup steps run, fetches the walk's first screen with the origin that
   says this is the first run
4. emits that screen in the forms its own markers name — the title as
   markdown, the prose as markdown rather than a code block, the diagram
   between the prose as a code block, then the menu, whose two keys are
   `n/next` and `s/skip` — and stops for the answer
5. on the decline, records it through the engine's one verb
   (`walkthrough record skipped`), which writes and commits in the same
   call, and hands back to workflow-start
6. passes through the rest of initialisation without a word: the label
   choice is settled, the knowledge base is ready, and the baseline
   verdict is already recorded, so none of the three renders anything
7. gets the workflow state from the discovery gateway script rather than
   listing directories or reading files itself, and shows the empty-state
   menu — no active work — whose rows include `h/help`, where the walk
   stays reachable

Further claims:

- the first screen is rendered exactly once, and nothing is fetched for
  the second screen or any screen after it — the decline ends the walk
  where it stands
- the offer comes before the setup steps, not after them: nothing about
  labels, the knowledge base or the baseline is put to the user ahead of
  it
- the project manifest's walkthrough reads `skipped` afterwards; nothing
  else about the project changes
- the decline is the only write, and it goes through the engine
