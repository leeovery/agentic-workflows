The prose should have taken this path:

1. loads the shared framework — instructions, casing conventions, voice,
   altitude, ask-or-decide, and the rule for answering questions about
   how the system works — before any state is read
2. runs the boot pipeline, and since no migrations applied and the
   knowledge base is ready, raises neither the migrations confirmation
   nor the knowledge gate
3. reads `walkthrough: none` on the boot response and fetches the walk's
   first screen with the origin that says this is the first run, emits it
   in the forms its own markers name — title and prose as markdown, the
   diagram as a text code block (```text fence), then the menu — and
   stops
4. on `n`, records the answer through the engine's one verb
   (`walkthrough record walked`) *before* the second screen is fetched:
   the offer is answered at the moment it is taken, not when the walk
   ends
5. renders the second screen in full — title, prose, diagram, menu, the
   same forms as the first — and stops
6. reads the free text as a question rather than an unrecognised key,
   and answers it in a few ordinary sentences drawn from the glossary,
   which it loads at the question and not before: what a phase is, in
   the product's terms and the words the screens have already used, with
   no engine verb, file path or skill name in the answer
7. the question set the menu aside: the answer is followed by a
   question in conversation — no menu, no gate — asking whether they
   are ready to move on, and the walk stops
8. the third scripted answer says yes to being ready, which is never
   the menu's answer. The second screen's menu comes back on its own —
   the menu-only render, fetched once, never the whole screen again —
   and the walk stops
9. on `s`, ends the walk where it stands and hands back to
   workflow-start: nothing further is recorded, because the answer was
   recorded once already
10. passes through the rest of initialisation without a word, then
    gets the workflow state from the discovery gateway script and shows
    the empty-state menu — no active work — whose rows include
    `h/help`, where the rest of the walk stays reachable

Further claims:

- the question is never deflected — the walk does not tell the user to
  pick a key, and does not treat the sentence as an invalid answer
- the answer is a few sentences, not a screen: no reference card is
  rendered for it and nothing is re-emitted above the returning menu
- the menu-only render runs exactly once, after the yes — never
  straight after the answer, and never twice
- no screen past the second is ever fetched
- the project manifest's walkthrough reads `walked` afterwards; nothing
  else about the project changes
- the record is the only write, and it goes through the engine
