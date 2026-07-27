The prose should have taken this path:

1. the plan gate renders empty, and no implementation item exists, so
   this is a new entry
2. dependency validation returns immediately — external dependencies are
   an epic concern
3. the environment check finds no setup document and asks the question,
   gathering the answer without acting on it
4. resume detection initialises tracking and reports the created mode —
   the fresh path, which commits the start of implementation, never the
   resuming-from-a-previous-session note
5. environment setup records the answer as a setup document and commits
   it, so the question is not asked again in a later session
6. reads the plan through the format's own reading procedure and finds
   pay-1-1 next: phase one, first task, nothing completed
7. starts pay-1-1 and stops where the prose hands over to building

Further claims:

- the second task is neither started nor touched
