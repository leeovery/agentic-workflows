The prose should have taken this path:

1. the entry resolves the topic from the work unit, the research reads in
   progress, and the resume gate is answered `continue` — no context
   gathering, no interview
2. the session loop opens on a clean topic: the triage queue is empty,
   there is no reconcile flag, and no dive has ever been dispatched
3. **the path the user offers is landed, not questioned.** One call —
   `workunit import pay 'notes/rival-checkout.png' --from research/pay` —
   the path quoted, the origin naming the phase and topic this session is
   sitting in. Nothing is asked first: the session does not check whether
   the file exists before calling, and does not offer to land it
4. the call refuses: `ok: false` with `missing_imports` naming the path.
   Nothing landed
5. **the refusal is the engine's to say.** The session writes the payload
   to the topic's own cache —
   `.workflows/.cache/pay/research/pay/import-reprompt.json`, carrying
   the refused path — and renders `import-reprompt` against it, emitting
   the surface's DISPLAY and MENU sections. It does not compose a
   re-prompt of its own, and it does not ask for the path in its own
   words
6. the turn ends there for the user's answer. Nothing is written to the
   research file while the landing is unsettled, and no second call is
   made before the user has answered
7. the corrected path lands on the second call —
   `workunit import pay 'notes/Rival Checkout Permissions.PNG' --from
   research/pay`, the quoting holding its spaces as one argument. The
   response reports the landing at
   `imports/rival-checkout-permissions.png` — the stem lowercased and
   hyphenated, the extension kept and lowercased, nothing normalised to
   `.md` — and the session runs no commit of its own for it: the verb
   committed itself
8. the landed file is read where it landed — a read of
   `.workflows/pay/imports/rival-checkout-permissions.png`, not of the
   `notes/` original — and what the user says it shows is worked into the
   conversation as material for the open thread
9. the research file's next write carries the file by reference: an
   inline link on the relative path
   `../imports/rival-checkout-permissions.png`, the landed name and not
   either name the user typed, its text saying what the screenshot shows.
   The write commits on the session's own cadence,
   `commit pay --topic research/pay`

Refusal claims — the lens is the behaviour under test:

- the first call is made with the path the user gave, exactly as they
  gave it — the session never corrects, guesses or globs it, and never
  goes looking on disk for a file of a similar name
- one bad path refuses the whole batch: nothing is on disk after the
  refusal, `imports/` does not exist yet, and the manifest gains no entry
  from the first call
- the re-prompt is rendered, never authored: the paths the user sees are
  the ones the engine put in its DISPLAY, and no hand-written list of
  missing files appears in the session's own prose
- the refusal ends the turn. The walk waits for the user rather than
  carrying on with the conversation and landing the file later

Further claims:

- exactly two `workunit import` calls run, and only the second lands
  anything
- the file lands through the engine and only through the engine: it is
  never copied, moved or written into `.workflows/` by hand, and no
  directory is invented beside the research file to hold it
- the source file stays where the user put it: `notes/` is untouched, and
  the landing is a copy
- the screenshot is never handed to the knowledge base — a PNG is tracked
  on the manifest alone
- the research item stays `in-progress`; no completion, no reopen, no
  triage delivery, no experiment

EXPECTED WORLD — the fixture plus: the screenshot at
`.workflows/pay/imports/rival-checkout-permissions.png`, byte-identical
to the one in `notes/` (which is still there); exactly one `imports[]`
entry on the work-unit manifest, carrying that path and
`origin: "research/pay"`; the research file grown with what the exchange
made of the screenshot and linking it on the relative path; the research
item still `in-progress`; no file at `.workflows/pay/imports/` under
either name the user typed.
