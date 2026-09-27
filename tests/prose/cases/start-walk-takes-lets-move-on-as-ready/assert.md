The prose should have taken this path:

1. loads the shared framework — instructions, casing conventions, voice,
   altitude, ask-or-decide, and the rule for answering questions about
   how the system works — before any state is read
2. runs the boot pipeline, and since no migrations applied and the
   knowledge base is ready, raises neither the migrations confirmation
   nor the knowledge gate
3. reads `walkthrough: none` on the boot response and fetches the walk's
   first screen with the origin that says this is the first run, emits it
   in the forms its own markers name, and stops
4. on `n`, records the answer through the engine's one verb
   (`walkthrough record walked`) before the second screen is fetched
5. renders the second screen in full and stops
6. reads the free text as a question rather than an unrecognised key,
   and answers it in a few ordinary sentences drawn from the glossary —
   what a phase is, and how it sits with a team that works in one pass —
   with no engine verb, file path or skill name in the answer
7. the question set the menu aside: the answer ends without a menu or a
   gate, and the walk stops
8. the third scripted answer — "ok, let's move on" — says the user is
   ready, whether or not the previous turn asked. It is never the menu's
   answer: it is not taken as `n/next`, so no third screen is fetched and
   nothing is recorded. In that same turn the second screen's menu comes
   straight back — the menu-only render, fetched once, never the whole
   screen — with no question first about whether they are ready, and the
   walk stops
9. on `s`, ends the walk where it stands and hands back to
   workflow-start: nothing further is recorded, because the answer was
   recorded once already
10. passes through the rest of initialisation without a word, then gets
    the workflow state from the discovery gateway script and shows the
    empty-state menu — no active work — whose rows include `h/help`

Further claims:

- the turn answering "ok, let's move on" asks nothing — no readiness
  question, no "shall I continue?" — and puts the menu back
- the go-ahead is never read as a pick: the walk never advances past the
  second screen until `s` is pressed at the menu the go-ahead brought back
- the menu-only render runs exactly once, after the go-ahead — never
  straight after the answer, and never twice
- the project manifest's walkthrough reads `walked` afterwards; nothing
  else about the project changes
- the record is the only write, and it goes through the engine
