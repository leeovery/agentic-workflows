The prose should have taken this path:

1. the entry resolves the topic from the work unit — a feature's topic
   is its name, so no topic question is put to the user — and the
   discovery-item check no-ops without an engine call: only an epic has
   a map; the research status reads in progress, the resuming phase
   note is emitted, the reconcile flag is absent, and the feature
   context arm reads the discovery log's Exploration, finds the shaping
   there, and gathers nothing — no interview; the handoff is the
   continue shape
2. the process reads the status again, finds the file, renders the
   thread register once above resume detection — three threads, all
   open, so the header carries no breakdown — and the user continues;
   initialisation is skipped
3. the walk passes through file strategy and the guidelines, addresses
   the knowledge base once as a contextual query, reads the work type,
   and routes into the single-topic session wrapper — the deep-dive and
   rerouted-concerns protocols loaded, nothing run at load
4. the loop's first iteration checks what landed: the triage queue reads
   empty, and the dive check finds nothing to fold — no dive was ever
   dispatched, and the store says so
5. the conversation bends the register as the user brings what they
   know, each move recorded through the engine as it happens and the
   file carrying the substance behind it:
   - the hosted-fields question is **reframed** in place when the
     user's answer reshapes it — hosted fields exist but only on the
     gateway's newer integration, so the question becomes what moving
     the checkout onto that integration takes; the slug and the `seed`
     origin are untouched, the status stays open, and the file records
     why the question changed
   - the user's follow-on — whether the newer integration changes how
     capture is confirmed back to the shop — is **added** as a thread
     nested under the reframed one, origin `user`, the parent named on
     the add; it is carried, not sent out: the user has their own route
     to the answer, so no dive is offered
   - the 3-D Secure question is answered from the user's own knowledge
     — the shop sells into markets where strong customer authentication
     applies, so a hosted challenge step is mandatory on most card
     payments — the file holds the answer, and only then is the thread
     set **learned**
   - the second-provider question is set aside at the user's word, the
     thread set **parked** with the user's reason as its one-line note
     — the note travelling with `parked` and with no other state
6. the register is rendered at the natural breaks where a thread had
   moved since the last render — never twice for one state, and never
   after an exchange that moved nothing; the closing render shows the
   reframed question with its child beneath it, the learned thread, and
   the parked thread with its reason on the line below
7. when the user says they are stepping away, the session documents
   what the exchange left, commits with the cadence message, renders
   the register if a thread moved since the last render, and ends its
   turn — no conclusion is attempted: the user was explicit the research
   is not finished, and a sign-off is not the done-signal

Register claims — the lens is the behaviour under test:

- every thread verb is called with its prescribed shape: `reframe`
  with `--question` and nothing else; `add` with `--question`,
  `--origin user`, and `--parent hosted-fields`; `set … learned` bare;
  `set … parked --note "…"` with the reason; no `--note` ever rides
  `learned` or `open`
- the register moves with the conversation and nothing gates on it: no
  thread's state is checked before another moves, and no state blocks
  the session from doing anything
- across the transcript, the number of register renders after the
  resume is at most the number of thread moves, every render follows at
  least one move the previous render had not shown, and at least one
  exchange that moved no thread produced no render
- no deep dive is offered anywhere: every question raised was answered
  in the room or carried at the user's own ask
- no review of any kind is dispatched, considered, or mentioned —
  research has none; no experiment is offered; no concern is rerouted

Further claims:

- each write to the research file is followed by a cadence commit —
  writes are never batched across exchanges
- the file gains the 3-D Secure answer, the reshaped hosted-fields
  question with the reason it changed, and the parked reason; it gains
  no Open Threads section — that is written once, at conclusion, and
  the research did not conclude
- the research item stays `in-progress`; no completion, no reopen, no
  triage delivery, no map operation

EXPECTED WORLD — the fixture plus: the register holding `hosted-fields`
open with its rewritten question and `seed` origin, a child thread
under it (origin `user`, status `open`) carrying the capture-confirmation
question, `three-d-secure` learned, and `second-provider` parked with a
one-line note; the research file grown with the session's substance —
the SCA answer, the reshaped hosted-fields question, the parked reason;
the research item still `in-progress`; no agent row in the topic's
cache, no experiment item, no discussion item.
