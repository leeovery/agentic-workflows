The prose should have taken this path:

1. the plan gate renders empty, and no implementation item exists, so
   this is a new entry
2. dependency validation returns immediately — external dependencies are
   an epic concern
3. the entry hands off without touching the environment at all — no
   check, no question, no setup document
4. resume detection initialises tracking and reports the created mode —
   the fresh path, which commits the start of implementation, never the
   resuming-from-a-previous-session note
5. environment setup finds no setup document, consumes the scripted
   answer there, and records it as the document so the question is not
   asked again in a later session

Further claims:

- the setup document is written once, by the setup step and nowhere else
- no task is started: the walk stops before any task is picked up
