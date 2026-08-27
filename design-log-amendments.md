# Design-log amendments — concurrent-phases

Entries for `design/concurrent-phases.md`'s **Decision log**, from the
review pass over the landed stack. Dated 2026-08-28.

---

Settled 2026-08-28, from the review pass:

- **No field write beats (reverses the components section's
  `manifest set`/`apply` line).** The mechanical-beats design gave a
  three-segment `manifest set` a heartbeat: "every state transition on
  the session's own topic is a sign of life." The premise is wrong often
  enough to be dangerous. A three-segment set is frequently a
  *cross-phase* write — the storage-path backfill an implementation or
  review session makes on a planning item, review's `updated` stamp, the
  epic menu's `satisfied_externally` unblock on a plan nobody is in. Each
  of those stamps the writing session's identity onto a topic it does not
  hold, which is exactly the false hold P8 exists to prevent, and nothing
  clears it until the process dies. The verb is gone from the beat table;
  `manifest set` and `apply` now sit together in the never row. The
  session's own cadence commit remains its heartbeat, and it is enough:
  a session that transitions state and does not commit has nothing to
  protect yet.

- **The slot releases at the close.** `topic complete` clears instead of
  beating, and a `--topic` commit keys its beat on the item's own status:
  a terminal status (`completed`, `cancelled`, `superseded`, `promoted`)
  clears, anything live beats, and an item that does not exist does
  neither. `--sweep` still outranks everything. The original design gave
  the `--kb` rider the whole job of clearing, which covered the
  conclusion commit and nothing else — so review's complete-then-commit,
  conclude-plan and conclude-implementation all *re-took* the hold after
  the topic had closed, and the checkout's one code slot stayed occupied
  until the process died. Under the status key, the close is the release
  and everything a session does afterwards is tidying a topic it has
  finished. The code slot's exit is now as mechanical as its entry.

- **`--state`, in two scopes.** The components section deliberately left
  the analysis commits work-unit-wide, "protected by the deferral." The
  deferral does not cover it: it counts `live_sources` (research and
  discussion only), so a live specification, planning or code session in
  the same work unit is invisible to it — and the grouping analysis's
  `engine commit {wu}` then swept that session's half-written document
  into a `spec(…): reconcile proposed groupings` commit. Two finders
  reproduced the theft. `engine commit {wu} --state` is now the unit's
  `.state` dir plus its manifest (plus the store, which those analyses
  dirty), and `engine commit --state` with no work unit is
  `.workflows/.state` alone. Neither beats — an analysis is not a session
  sitting in a topic. Four prose sites convert; the fourth is
  implementation's environment-setup pass, which wrote a project-level
  document with `--workflows` from inside a live code session, sweeping
  the whole tree.

- **The KB rider names its forms.** `commit --plan` and `commit --inbox`
  move to the rider-less door. The rider exists for actions that dirty
  the store as a side effect of their own knowledge sync; a plan
  authoring pass and an inbox transaction never touch it, so carrying its
  dirt is the theft the confinement removes. Bare `{wu}`, `--workflows`,
  `--roadmap` and `{wu} --state` keep it — roadmap imports index
  mid-session and ride the cadence commit, and scoping's bare closing
  commit follows a `knowledge remove`.

- **The code gate precedes every mutation.** PR 7 put the gate at the two
  entry skills as the chokepoint; it went in as the *last* step, after
  phase validation and dependency checking. Both of those mutate — the
  review entry reopens a completed item and burns its one-shot reconcile
  advisory, the implementation entry records dependency decisions — so a
  user answering `back` at the gate left a committed reopen behind and an
  advisory that would never surface again. The gate now runs immediately
  after topic resolution, which is what "the chokepoint every route
  passes through" was always supposed to mean: nothing downstream of it
  runs until the slot is settled. Step 0's intent, restored.

- **Two CONVENTIONS rulings.** (i) The menu-adoption rule ("touching a
  file adopts its menus") gains an exemption: a mechanical edit inside an
  existing fenced command — a flag, an argument, a path — does not count
  as touching the file; prose-level editing does. Without it, a stack
  whose whole subject is commit scope turns into a menu-rendering stack.
  The 17 menus in the 13 files this stack touched are banked as an idea,
  not carried. (ii) Red gains its second sanctioned use: besides a
  blocked state, red marks the system's strongest advisory — a gate whose
  default is refusal and whose override requires stated knowledge the
  machine cannot have ("only proceed if you know that session is no
  longer working"). The code gate is that shape. Those two uses are the
  whole of it; a warning the user may act on or ignore stays plain, so
  red stays rare enough to mean something.

**Correction.** The components section's "Three-segment `manifest
set`/`apply` on a presence phase — beats (every state transition
heartbeats)" line is superseded by the first entry above. Read the
Decision log, not the components section, for the beat table.
