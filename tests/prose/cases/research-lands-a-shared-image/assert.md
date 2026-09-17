The prose should have taken this path:

1. the entry resolves the topic from the work unit — a feature's topic is
   its name, so no topic question is put to the user — the research status
   reads in progress, the reconcile flag is absent, and the resume routes
   straight to the handoff: no context gathering, no interview
2. the process reads the status again, finds the file, and the resume gate
   is answered `continue`; initialisation is skipped
3. the walk passes through file strategy and the guidelines, addresses the
   knowledge base once as a contextual query, reads the work type, and
   routes into the single-topic session wrapper — the deep-dive,
   rerouted-concerns and shared-files protocols loaded, nothing run at
   load
4. the loop's first iteration checks what landed: the triage queue reads
   empty, the landed-evidence read finds no reconcile flag, and the dive
   check finds nothing to fold — no dive was ever dispatched
5. **the path the user offers lands before anything is written.** One
   call — `workunit import pay 'notes/Rival Checkout Permissions.PNG'
   --from research/pay` — the path quoted so its spaces stay one argument,
   the origin naming the phase and topic this session is sitting in.
   Nothing is asked first: no gate, no confirmation, no offer to land it.
   The response reports the landing at
   `imports/rival-checkout-permissions.png` — the stem lowercased and
   hyphenated, the extension kept and lowercased, nothing normalised to
   `.md` — and the session runs no commit of its own for it: the verb
   committed itself
6. the landed file is read where it landed — a read of
   `.workflows/pay/imports/rival-checkout-permissions.png`, not of the
   `notes/` original — and what the user says the screenshot shows is
   worked into the conversation as material for the open thread, not
   acknowledged as an attachment and set aside
7. the research file's next write carries the file by reference — an
   inline link on the relative path
   `../imports/rival-checkout-permissions.png`, the landed name and not
   the one the user typed, its text saying what the screenshot shows, with
   the prose around it recording what the exchange made of it. The link
   target is the relative path, never an absolute one and never the
   original `notes/` path
8. the write commits on the session's own cadence —
   `commit pay --topic research/pay` with a research subject — and that is
   the only commit the session runs
9. when the user says they are stopping, the session ends its turn — no
   conclusion is attempted: a sign-off that leaves the topic open is the
   wrapper's pause arm, not its done-signal, so no in-flight check, no
   document review, no wait gate, and no conclude gate run

Landing claims — the lens is the behaviour under test:

- the file lands through the engine and only through the engine: it is
  never copied, moved or written into `.workflows/` by hand, and no
  directory is invented beside the research file to hold it — one home,
  `imports/`, whatever the file type
- the source file stays where the user put it: `notes/` is untouched, and
  the landing is a copy
- the screenshot is never handed to the knowledge base — what embeds is
  the verb's call, and a PNG is tracked on the manifest alone
- the manifest's `imports[]` gains exactly one entry, carrying the landed
  path, a timestamp, and `origin: "research/pay"` — the origin is the
  session's own phase and topic, never `discovery`
- a landing is not a phase event: no thread is required to move for it, no
  status changes, and the register is not rendered for it

Further claims:

- the research item stays `in-progress`; no completion, no reopen, no
  triage delivery, no map operation, no experiment
- nothing about the landing is put to the user as a choice — the whole of
  it is the call, the read, and the link

EXPECTED WORLD — the fixture plus: the screenshot at
`.workflows/pay/imports/rival-checkout-permissions.png`, byte-identical to
the one in `notes/` (which is still there); one `imports[]` entry on the
work-unit manifest with `origin: "research/pay"`; the research file grown
with what the exchange made of the screenshot and linking it on the
relative path; the research item still `in-progress`; no experiment item,
no discussion item, and no agent row in the topic's cache.
