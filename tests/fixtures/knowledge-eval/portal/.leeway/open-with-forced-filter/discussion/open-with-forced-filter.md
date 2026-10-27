# Discussion: Open With Forced Filter

## Context

What the thing after `portal open` means — the whole argument surface, not just
one addition to it.

Two threads arrive here together, and discovery committed them as one feature
because they are two facets of the same question.

**The filter shortcut.** The seed describes the user's dominant real-world
Portal flow: type `x`, wait for the picker, press `/`, type three or four
characters, `Enter`, `Space` through the two or three survivors to see which is
which, `Enter` to attach. Everything before the last two steps is ceremony —
the shape of the target is already known before the picker paints. The ask is a
single shell-level form (`x /port`, or a no-space `x/port` if possible) that
lands straight in the sessions list with `port` already in the filter box, the
list narrowed, cursor on the first match, and the rest of the flow unchanged.

The seed's stated hard property: the term must be **forced as filter text** and
must never enter the bare-positional resolution grammar, which is too eager and
too fuzzy — it will decide `port` names a zoxide directory or an alias and mint
a new session, when what was wanted is "show me the live sessions whose names
contain this, and let me pick". The driving scenario is three live Portal
sessions, one or two custom-named and the rest `portal-<nanoid>`: the goal is
not to resolve to one session, it is to narrow to the right handful fast and
choose by preview.

**The bare-positional grammar.** Discovery widened past the shortcut. The user
raised `portal open xxx` itself as "not quite right" after living with Portal
for an extended period. Two things came out of it:

*Predictability.* A bare argument walks an ordered chain of guesses and the
first hit wins, with a zoxide hit minting a new session. The user does not
remember the order, cannot predict which branch will answer for a given word,
and has consequently stopped using the bare form altogether — the habit is now
`x`, then the picker, every time. One of the command's main surfaces is dead in
practice.

*Intent.* The user believes that when they type `x portal` they mean "open a new
session in the Portal project directory" and would never expect an attach —
because the default `{project}-{nanoid}` naming makes existing sessions
unrecognisable by name. They flagged their own uncertainty ("I might be wrong
there"), so this is a belief to test here, not a settled requirement.

Discovery framed the desired outcome loosely on purpose: the landing may be
nothing more than adding the filter shortcut and leaving the resolution chain
untouched. That is a legitimate result, not a reason to shrink the work — the
shortcut is being designed as one route within a grammar rather than as a
bolt-on.

### Current state of the code

Measured against the tree at the start of this discussion.

- The picker behaviour the seed wants already exists behind a flag.
  `portal open -f/--filter <text>` skips resolution and opens the picker
  pre-filtered (`cmd/open.go`), and the model applies it as a *committed*
  filter — filter text set and filter state `FilterApplied`, not focused — then
  re-anchors the cursor, so arrows/`Space`/`Enter` work immediately on the
  narrowed list (`internal/tui/model.go:1261`). `-f` is mutually exclusive with
  a target and with every domain pin.
- The shell function is a pass-through, so any new syntax is parsed by Portal,
  not by the shell. `portal init` emits `x() { portal open "$@"; }` for bash,
  zsh and fish (`cmd/init.go`) — `x /port` reaches `portal open` as the single
  positional `/port`. A no-space `x/port` reaches the emitted `x` function only if
  a function is defined under that exact name — so it cannot work for an arbitrary
  search term without a different mechanism.
- The bare chain is exact session → path → alias → zoxide → miss
  (`internal/resolver/query.go`), with globs handled separately (a glob is not
  expanded by `Resolve`; it falls through to a miss on the single-target path,
  and expands only on the multi-target/burst path and under `-s`). A total miss
  hard-fails — there is no implicit picker fallback.
- **A leading `/` is currently a path argument.** `IsPathArgument` returns true
  for any value containing `/`, or beginning with `.` or `~`
  (`internal/resolver/path.go:10`), so `/port` resolves in the path domain and
  errors `Directory not found: /port`. Absolute paths are a live, legitimate
  bare-positional input, which is a direct collision with a `/`-prefix filter
  sigil.
- Domain pins already exist and hard-fail rather than falling through:
  `-s/--session` (attach only, never mints), `-p/--path`, `-a/--alias`,
  `-z/--zoxide`.
- Sessions are named `{project}-{nanoid}` by `internal/session/naming.go`, which
  is the naming the user cites as making the attach branch unusable by name.

### References

- `.workflows/open-with-forced-filter/seeds/2026-08-17-open-with-forced-filter.md` — the seed (inbox:idea)
- `.workflows/open-with-forced-filter/discovery/sessions/session-001.md` — discovery session log (the carrier)

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture. The Discussion Map lives in the manifest.*

---

## bare-positional-grammar

### Context

Discovery arrived with two complaints about `portal open <word>`: that the
outcome is unpredictable because a bare argument walks five branches whose order
nobody remembers, and that the user's own intent when typing `x portal` is "mint
a session in the Portal directory, never attach" — a belief they flagged as
possibly wrong.

Both were tested against the code and against the decision of record before
anything else was discussed, because a conversation reasoned over a false
premise stays poisoned however well the document is corrected later.

### Journey

**The intent belief is already the behaviour, and was decided deliberately.**
`x portal` mints in the Portal directory today. `portal` is not an exact session
name — sessions are `{project}-{nanoid}` — so the session branch cannot answer
and the chain falls through to a directory domain, which always mints. The
`cli-verb-surface-redesign` specification locked this as **Axiom 2 (no
find-or-create)**, recorded the consequence under its own heading ("Bare project
shorthand does not reattach"), and **explicitly rejected** project-prefix session
matching — `api` resolving to the sole live `api-*` session — on the grounds that
it "reintroduces attach-vs-create guessing with an ambiguity cliff the moment a
second `api-*` session exists". The user was right about their own intent, and
the product already serves it.

**The chain is three live branches for a plain word, not five.** A bare word can
reach neither the path domain nor the glob branch:

`sed -n '13,15p' internal/resolver/path.go` → `return strings.Contains(arg, "/") || arg[0] == '.' || arg[0] == '~'`

A path argument needs a `/`, or a leading `.` or `~`; a glob needs one of
`*?[` (`internal/resolver/glob.go`, `globMeta`). So for `portal` the live set is
exact session name → alias → zoxide, and the last two both mint at a directory.

**But the session branch is not dead — rename makes it live.** The first draft of
this reasoning claimed the exact-session branch "never fires for a project word
by naming convention", and that is false. `Resolve` tests `isExactSession`
before anything else (`internal/resolver/query.go`), and renaming a session is a
shipped user action — the picker's `r` modal, through `tmux.RenameSession`. A
user who renames a session to `portal` and then types `x portal` is **attached**
to it; the same word typed before that rename, or after that session is killed,
mints a new session at whatever directory zoxide ranks first. Same keystrokes,
opposite outcome, decided by what happens to be running.

So the unpredictability is a mirage **only for generated names**. For the
custom-named sessions the seed says are part of the real session set, attach-vs-
mint genuinely does vary with live state. What survives of the reframe is
narrower and still useful: the outcome of a bare word is invariant *as long as
no live session is named exactly that word*, and the residual variation is which
directory zoxide picked — frecency ranking rather than branch ordering.

**What is actually missing.** The first draft of this reasoning also claimed the
argument surface has "no route that searches live sessions". That is false too.
`x -s 'port*'` is a search route, measured against the code:

- one match → the burst degenerates and attaches it outright, no picker
  (`dispatchOpenBurst`, `len(surfaces) == 1` → `openResolved`, `cmd/open_burst.go:90`)
- two or more matches → a window opens per match (`runOpenBurst`)
- zero matches → hard fail carrying the `-f` hint

So eager attach on a single session-search match is **already shipped
behaviour**, not a new idea — which matters for `unambiguous-direct-attach`,
where it is precedent rather than invention.

What `-s <glob>` is not is *ergonomic*, and it answers multi-match the opposite
way to what the seed wants:

- it demands glob syntax, and the glob must be quoted — unquoted `x -s port*` is
  eaten by zsh's `nomatch` before Portal sees it
- it is a flag plus a quoted pattern, which is further from muscle memory than
  the `-f` it is meant to beat
- on two or more matches it **opens every match** rather than letting the user
  choose — the seed wants precisely the opposite: narrow, then pick by preview

So the gap is real but narrower than first stated. The argument surface has
three routes that mint, one route that searches — awkward to type, and
burst-on-ambiguity by design — and no route that searches *and narrows*. The bare
form is not broken; it is complete for minting and, rename aside, blind to
attaching.

This reframes the feature. It is not "add a filter shortcut, and separately
consider fixing the chain". It is: **the argument surface is missing its search
route, and this feature adds it.**

The user confirmed the reframe, and named two things they want from the result:
a shortened syntax for opening the picker pre-filtered, and going straight to a
session when the term is unambiguous.

### Decision

The bare-positional resolution chain is **not** altered by this feature. Its
ordering, its domains, and Axiom 2 stand as the `cli-verb-surface-redesign`
specification set them. Project-prefix session matching stays rejected for the
reason that specification gave.

The user put this landing themselves once the reframe held — "maybe we are ok as
we are? I wonder if simply adding `x /xyz` would be a good addition and leave
everything else as-is" — and the sigil subtopics have since filled the missing
search route without touching a single branch of the chain.

**This also settles the intent question discovery raised.** The user's belief that
`x portal` means "mint in the Portal directory, never attach" is what the product
already does, and it was decided deliberately rather than by accident. The one
qualification is the rename case: a session renamed to exactly `portal` *is*
attached by `x portal`, because the exact-session branch is tested first. That is
the chain working as specified — an exact session name is a session-domain hit —
and the user has a deliberate route to the other outcome in the three domain pins.
No change is owed.

Trade-off accepted: the residual unpredictability stands. Which directory a bare
word mints at is zoxide's frecency call, and a live session whose name exactly
matches a bare word changes that word's outcome for as long as it exists.

Confidence: high. The chain's behaviour was measured rather than recalled, and the
decision is to leave shipped, specified behaviour alone.

Sibling check: `cli-verb-surface-redesign` specification — holds Axiom 2 (no
find-or-create), the accepted consequence that bare project shorthand does not
reattach, and the explicit rejection of project-prefix session matching. This
discussion ratifies all three rather than contradicting them; no correction is
owed.

---

## unambiguous-direct-attach

### Context

The user wants two things from the result: a shorter spelling for opening the
picker pre-filtered, and going straight to a session when the term is
unambiguous. The second is the load-bearing one, because "unambiguous" splits
two ways with very different products, and one of the two is a design the
`cli-verb-surface-redesign` specification already rejected by name.

### Options Considered

**Read A — the bare word gains a search branch.** `x port` looks at live
sessions; exactly one match attaches it, otherwise the chain falls through to
minting as today.

- Pros: nothing new to learn, no sigil, the shortest possible spelling.
- Cons: the outcome flips on invisible state. `x portal` attaches while one
  Portal session lives and silently mints a second the moment two exist — same
  keystrokes, opposite destination, with nothing on screen saying which world
  the user is in. This is exactly the `api` → `api-*` matching the sibling
  specification rejected, and for exactly the reason it gave.

**Read B — the search sigil resolves eagerly.** The forced-filter form is
session-domain by declaration and can never mint. One match attaches straight
away with no picker; two or more open the picker pre-filtered with the cursor on
the first; zero is an honest failure.

- Pros: no attach-vs-mint guess survives, because the sigil has already declared
  the domain. Collapses the seed's flow to its floor on the common day and
  degrades to exactly the screen the user was heading for on the ambiguous one.
- Cons: the *timing* is unpredictable — sometimes the user lands in a session,
  sometimes in a picker, and they cannot tell which before typing.

### Journey

The document's own Decision on `bare-positional-grammar` had just ratified the
sibling's rejection of project-prefix session matching, which made Read B look
like the same cliff wearing a sigil: K=1 behaving differently from K=2 is
identical in both reads.

What separates them is **what is at risk on the wrong side of the cliff**. Under
Read A the two sides are *attach an existing session* and *mint a brand-new one*
— different in kind, and the wrong one leaves a stray session behind. Under Read
B both sides are session-domain and neither mints: the only variable is whether
Portal finishes the job or hands the user the narrowed list. Degrading to a
picker is not a wrong guess; it is the destination the user was walking to
anyway. The sibling's rationale objects to reintroducing *attach-vs-create*
guessing, and Read B reintroduces none.

The argument was then strengthened by a measurement that falsified an earlier
claim in this discussion: **eager attach on a single session-search match is
already shipped**. `x -s 'port*'` attaches outright when the glob matches one
session — the burst degenerates to a direct open
(`cmd/open_burst.go:90`, `len(surfaces) == 1` → `openResolved`). So Read B is
consistent with a route the user already lives with, rather than a new
behaviour; what the shipped route does differently is answer *multi*-match by
opening a window per session instead of narrowing.

### Decision

#### 2026-09-11 — revised
*Trigger: user reversal — the zero-match case does not fail. "Nothing errors from
using `/`. Worst case it populates a filter with zero results. The same as me
opening the TUI now and filtering to zero results. No difference."*

**Read B, with no failure path.** The forced-filter form is session-domain by
declaration, never mints, and resolves eagerly: exactly one matching session
attaches directly with no picker; **every other count opens the picker
pre-filtered**, zero included. A term matching nothing lands in the picker showing
an empty list under its filter — indistinguishable from typing `/` inside the
picker and filtering to nothing — where `Esc` clears the filter and the session
list is there. Nothing is written to stderr and the exit status is not a failure.

What changed from the entry below: it made zero a hard failure at the shell. That
was the wrong shape. The form *is* the pre-filtered picker, and the single-match
attach is the one shortcut past it; a count of zero is a filter result, not an
error, and answering it with a message strands the user at a prompt having done
nothing where an empty list is one keystroke from recovery.

Read A — a search branch on the bare positional — stays rejected, on the
sibling's own grounds.

#### Initial

**Read B.** The forced-filter form is session-domain by declaration, never
mints, and resolves eagerly: exactly one matching session attaches directly with
no picker; two or more open the picker pre-filtered; zero fails honestly. Read A
— a search branch on the bare positional — stays rejected, on the sibling's own
grounds.

Deciding factor: the sigil removes the attach-vs-mint guess entirely, which is
what the sibling's rejection was actually protecting against; the residual
K=1/K=2 difference costs the user a picker they were already opening.

Trade-off accepted: the user cannot predict before typing whether they land in a
session or in the picker.

Confidence: high on the shape.

*Amended 2026-09-11 — this line previously read "The zero-match case, what the
term searches over, and how the form composes with the rest of the argv are
open." All three have since been decided: the zero-match case by this subtopic's
own Decision above ("zero fails honestly"), the match domain by
`search-match-domain`, and argv composition by `argv-composition`. The subtopic's
only residual is the trade-off already stated above. (resolves review-002 F5)*

Sibling check: `cli-verb-surface-redesign` specification — its rejection of
project-prefix session matching is ratified, not contradicted: that rejection
governs the bare positional, which this decision leaves untouched. Its
domain-pin contract ("every domain pin hard-fails on unresolvable and never
falls back to the TUI picker") is adjacent and **not** binding here — the sigil
is not a domain pin, and its whole purpose is to reach the picker. No correction
is owed.

---

## filter-shortcut-form

### Context

The seed asked for a shell-level form short enough to be muscle memory — `x /port`
— that forces its term into the picker as filter text rather than into the
resolution chain. With `unambiguous-direct-attach` settled on eager session-domain
resolution, the remaining question is what glyph declares that intent.

The glyph is not free real estate. A leading `/` already means something in
Portal: it makes an argument a path, unconditionally.

`sed -n '13,15p' internal/resolver/path.go` → `return strings.Contains(arg, "/") || arg[0] == '.' || arg[0] == '~'`

So `x /tmp` mints a session at `/tmp` today, and `x /port` hard-errors with
`Directory not found: /port`. Claiming `/` overrides a working rule rather than
filling empty space.

### Options Considered

The candidate field is narrower than it looks, because most obvious glyphs are
consumed by the shell before Portal ever sees the argument. Measured under zsh
with `extendedglob` and `nomatch` set — `zsh -c "setopt extendedglob nomatch; echo <candidate>"`:

| Candidate | Result |
|---|---|
| `?port` | `zsh: no matches found` — glob metacharacter |
| `^port` | expands to every non-matching file — `extendedglob` negation |
| `=port` | `zsh: port not found` — equals-expansion |
| `!port` | history expansion (interactive shells) |
| `@port` `:port` `,port` `+port` `%port` | pass through untouched (zsh and bash both) |

**Option A — `/`.** Zero learning cost: `/` is the picker's own filter key, so the
gesture inside the picker and the gesture outside it are the same one.
Overrides the path rule; needs a disambiguation rule and a documented footnote.

**Option B — `:`.** Structurally impossible in a session name — `ValidateSessionName`
rejects a name containing `:` because tmux reserves it as a target separator
(`internal/tmux/errors.go:102`), so `:port` can never be confused with a session
name by construction. Needs no disambiguation rule and no footnote. Costs an
arbitrary mapping the user must install in their fingers.

**Option C — a `+` mint sigil alongside the search sigil.** Rejected. "Add new" is
already the bare form's behaviour: `x port` walks alias then zoxide and mints.
`+port` would be a second spelling for a default that already exists. The only
gap it could fill — forcing a mint when a live session is named exactly `port`,
which the rename case makes possible — is already covered by `-p`, `-a` and `-z`.
Symmetry pressure, not a need, and a fourth mint route is exactly the surface
accretion this work set out not to cause.

**Option E — the seed's no-space form, `x/port`.** Rejected, and not on the ground
that the shape is unclaimable: measured, both shells will define a function whose
literal name is `x/port` and dispatch that word to it
(`bash --noprofile --norc -c 'x/port() { echo RAN-FUNC; }; x/port'` → `RAN-FUNC`,
GNU bash 5.3.15; `zsh -f -c 'x/port() { echo RAN-FUNC }; x/port'` → `RAN-FUNC`,
zsh 5.9). What that buys is nothing, because the name must be the *search term*:
a function per term anyone might ever type is not a mechanism, and without one
the word falls through to a path — a command named `port` inside a directory
named `x`. The only other interception is a global unknown-command hook, which
would put Portal in the path of every mistyped command on the machine to save one
keystroke. Recorded explicitly because it is a stated seed ask, so that silence is
not mistaken for oversight.

**Option D — make `/` configurable, opt-in via global config.** Rejected. A
keybinding and an argv token are different kinds of thing: a keystroke lives in
one user's session, whereas a command string is a shared artifact that goes into
a README, a script, or a bug report. Under a configurable sigil `x /tmp` mints on
one machine and filters on another, and neither user can read the other's
command. It also doubles the documentation rather than removing it (both
behaviours plus the switch), and it would be the first Portal setting to change
*parsing* rather than appearance — `prefs.json` carries six fields today
(`session_list_mode`, `appearance`, `theme`, `theme_light`, `theme_dark`,
`theme_migrated`; `grep -n 'json:"' internal/prefs/store.go`), every one of them
UI state.

### Journey

The discussion ran to `:` first. The case for it was reversibility rather than
aesthetics: shipping `:` does not foreclose `/`, because adding a second accepted
sigil later is additive and breaks nothing — whereas shipping `/`, installing it
in muscle memory, and then discovering the override bites means withdrawing the
very habit the feature exists to build. Start with the glyph that needs no
footnote, keep the door open.

The user weighed that against the ergonomic argument and chose `/`. The deciding
consideration on their side: `/` is the only candidate with no learning cost at
all, because it is already the key they press inside the picker to do the same
thing, and the population of directories the override actually shadows is one
they would never open a session in.

That trade is theirs to make — the cost is a documented rule, and the benefit is
the habit forming on its own.

### Decision

#### 2026-09-11 — revised
*Trigger: user reversal — the bare `x /` is not an error. "Using `/` with no string
is not an error. That's an empty filter, ready to be typed into in the TUI."*

**`x /` — the sigil with no term — opens the picker with the filter open and
empty, the cursor in it, ready to type.** It is `x` followed by `/`, not plain `x`
and not a usage error. The entry below borrowed `-f`'s refusal of an empty value,
which does not transfer: `-f ""` is a flag given no argument, while `/` on its own
is the gesture that opens a filter. Nothing about using `/` errors.

Everything else in the entry below stands: the glyph, the no-second-slash rule,
the shadowed single-segment directories and their `-p` escape, and the permanent
rejection of the no-space form.

#### Initial

**The sigil is `/`.**

A leading `/` declares session-search intent, and the term is forced as filter
text — never entering the resolution chain. Disambiguation follows the
no-second-slash rule: a leading-`/` argument is filter text **only when it
contains no further `/`**.

- `x /port` → session search, filter text `port`
- `x /Users/leeovery/Code/portal` → unchanged, a path that mints
- `x /tmp/` → unchanged, a path that mints — the trailing slash is the second one

Completion offers no help telling the two apart. Portal returns no candidates for
a slash-leading word and switches the shell's filename fallback off
(`portal __complete open /tm` → no candidates, `ShellCompDirectiveNoFileComp`;
`portal completion bash | grep -n 'compopt +o default'`), so `x /tm<TAB>` completes
to nothing rather than to `/tmp/`. The trailing slash that keeps an argument a path
is therefore one the user types, and a single-segment absolute directory typed
without it is a filter however it was reached.

Trade-off accepted: single-segment absolute directories typed *without* a
trailing slash — `x /tmp`, `x /opt`, `x /srv` — stop minting and start filtering.
The escape is `-p /tmp`, the flag that exists for exactly this. The user judges
minting a session directly in a root-level directory as something they would
never do.

The form is `x /term` with a space. The seed's no-space `x/port` is ruled out
permanently (Option E) — the shape is claimable, but only one search term at a
time.

Confidence: high on the glyph. The degenerate `x /` (empty filter text) follows
`-f`'s existing answer — a usage error — rather than meaning "mint at root".

*(resolves review-001 F8)*

Sibling check: `cli-verb-surface-redesign` specification — its resolution
precedence runs every bare positional through `exact session name → path → alias
→ zoxide query`, the path domain named semantically as an existing directory
(`sed -n '55,58p' .workflows/cli-verb-surface-redesign/specification/cli-verb-surface-redesign/specification.md`);
the leading `/` / `.` / `~` test that decides which arguments reach that domain
lives in the code, not in that document
(`sed -n '14p' internal/resolver/path.go`). This decision takes one shape — a
single-segment leading-`/` argument — out of the chain entirely, which is a change
to the precedence that specification states. It is owed a correction once this
feature's own specification exists; noted here so the specification phase carries
it rather than discovering it.

---

## search-match-domain

### Context

`/port` forces its term into the picker as filter text. What that text is matched
*against* decides whether the form actually does its job.

The seed's driving scenario is a session set that is part generated names and
part custom ones: "One or two might be custom-named, the rest are
`portal-<nanoid>`. I genuinely don't know which is which by name." A user with
`portal-a1b2`, `portal-c3d4`, and a third session they renamed `api-work` while
working in the Portal directory types `/port` and gets two rows. The one they
wanted is the third, and nothing in its name contains "port" any more.

Today the sessions list matches on the session name and nothing else —
`SessionItem.FilterValue()` returns `i.Session.Name`
(`internal/tui/session_item.go:80`). Not the directory the session was opened in,
not the project record behind it, not its tags.

### Options Considered

**Name only (today's behaviour).** Precise: every row that comes back contains
the typed text in its name. Misses any session whose name has drifted from its
origin — which is the seed's own scenario.

**Name plus the session's directory.** Finds the renamed session, because the
place it was opened in is the thing the user actually remembers. Less precise:
sessions the user would never think of as "port" appear because their path
happens to contain it.

**Name, directory, project record and tags.** Not pursued — nothing in the
conversation asked for it, and each added field widens the false-positive set
further for a case nobody has hit.

### Journey

The trade was put to the user as a choice about how they would rather lose:
`/port` occasionally missing a renamed session they wanted, or occasionally
showing a couple they did not. They chose to include folders and observe.

Two consequences were then measured rather than assumed.

**The directory is already in hand at no cost.** The picker's own session
enumeration asks tmux for it in the same call — `ListSessions` appends
`#{@portal-dir}` to its `list-sessions -F` format and parses it into
`Session.Dir` (`internal/tmux/tmux.go:128`). So matching on directory adds no
tmux round-trip for any session created since the stamp shipped. This matters
because per-session directory resolution is a known cost elsewhere: the grouped
render's fallback performs one pane read per unstamped session, which is why
Flat mode deliberately performs none.

**There is one filter, not three.** `-f/--filter`, the new `/` form, and typing
`/` by hand inside the picker all narrow the same list through the same
`FilterValue`. Widening the match domain therefore widens it for all three —
this is not a change scoped to the new form.

### The matching rule (settled after the fields, on review)

Deciding the *fields* left the *rule* undecided, and the rule turned out to
matter more. The picker does not look for the typed text inside a row: it matches
letters in order, anywhere. A session at `~/Projects/rust-tools` satisfies `port`
— **p** in `projects`, **o** in `projects`, **r** in `rust`, **t** in `tools` —
with the four letters never appearing together anywhere in it.

Measured: the sessions list filters through `charm.land/bubbles/v2/list.DefaultFilter`,
which is `fuzzy.Find` from `sahilm/fuzzy` — subsequence matching, case-folded and
rank-sorted — and `internal/tui` installs no filter of its own, so that default
stands.

`grep -rn 'SetFilterFunc\|DefaultFilter' internal/tui/*.go | grep -v _test` → no matches

Portal's own `internal/fuzzy` is not what the picker uses, and has no production
consumer at all:

`grep -rln 'internal/fuzzy' . --include='*.go' | grep -v '^./internal/fuzzy/'` → `internal/fuzzy/match_test.go`

Harmless inside the picker, where the user reads the results and skips the
nonsense rows. Not harmless here, because two decisions taken in this discussion
compound it: matching directories gave the matcher a long absolute path to find
scattered letters in, and eager resolution means a lone match is acted on without
being shown. Together they can attach the user to a session they never saw and
would not have chosen.

**The sigil's match is containment — the typed characters in a row — not
subsequence.** Eager attach is only defensible when a single match is one a human
would agree with, and scattered-subsequence over a full filesystem path routinely
is not. `/port` finding nothing is a better failure than `/port` attaching
`rust-tools`.

**The picker's own filter is untouched by this work.** Typing `/` by hand inside
the picker keeps today's fuzzy, rank-sorted behaviour.

This is a deliberate reversal of the "one filter, not three" position taken when
the fields were decided — see the amendment note below. The fields stay shared;
the *rule* diverges, and only on the path that can act without showing the user
anything.

Consequence accepted: the set `/port` acts on — both the count that decides
attach-versus-picker, and what the picker first displays — is the containment set.
If the user then edits the filter by hand inside that picker, the picker's own
rule applies and the row set can widen. The divergence is therefore visible only
by rows appearing, never by rows the user expected going missing.

### Decision

**The session search matches the session name and the session's directory**, by
containment.

*Amended 2026-09-11 — this Decision previously continued: "Scope accepted
deliberately: because the three entry points share one filter, this changes what
`-f` matches and what typing `/` inside the picker matches, not only the new form.
Divergence was rejected as the worse outcome — the same list narrowing differently
depending on how the user arrived at it is harder to predict than a single wider
rule." That position stood for one sitting and was reversed once the picker's
matching rule was measured: the sigil matches by containment while the picker
keeps its fuzzy filter, so the rule now diverges by entry point on purpose. The
divergence is confined to the matching rule; the matched fields remain shared.
The user's call — "only the new `/` part. the main picker should be unchanged
from this work". (resolves review-002 F2)*

Project records and tags stay out of the match domain.

**Which directory value is matched.** Only the directory tmux records against the
session (`@portal-dir`, stamped at creation and returned with the session list at
no extra cost). Never a derived one.

This was written first as "sessions created before the stamp match on name alone",
which was true in Flat mode only. The picker derives a missing directory by asking
each unrecorded session's pane where it is — but only in the grouped views, and it
caches the answer into the session set, so the same session is findable or not
depending on which view the user last left the picker in, and findable again in
Flat once a grouped view has run in the same picker session. The shell form has it
worse: the count deciding attach-versus-picker is taken before any picker exists,
against a session list carrying names only, so `x /port` could hard-fail on a
session the picker would have listed a moment later.

Matching the recorded value alone makes the answer identical everywhere — the
count and the list, the shell and the picker — and keeps the sigil path free of a
per-session pane read on a path whose whole point is to feel instant.

Known limitation, now unconditional rather than mode-dependent, and
self-correcting: a session created before the directory stamp shipped carries no
recorded directory and so matches on name alone, in every view. Such sessions age
out as they are killed and replaced. The alternative — deriving the missing value
everywhere, including before the picker exists — was rejected for its cost: one
pane read per unrecorded session on every `/term`.

*(resolves review-002 F3)*

Trade-off accepted: `/port` is less precise than it would be on names alone, and
the user has taken that knowingly — "happy to include folders too and see how it
goes".

Confidence: medium. The direction is settled; whether the added false positives
are tolerable is something only use will answer, and narrowing back to names is a
cheap reversal if not.

Sibling check: no overlap found. No sibling document decides the picker's filter
match domain — `tui-session-picker` specifies the picker's pages and keymap, and
`session-tagging-and-grouping` decides grouping and tags rather than filtering.

*(resolves review-001 F1)*

---

## argv-composition

### Context

`/term` was designed as "one route within a grammar", which raises what it means
when anything else shares the command line with it.

Two cases, and the first already has a shipped behaviour that would be inherited
by default.

**A trailing command.** `portal open -f port -- claude` does not filter the
sessions list at all — it opens the picker on the **Projects** page with `port` in
the projects filter. That is deliberate and correct for `-f`: a trailing command
can only run in a session about to be minted, so a pending command forces the
picker to the mint side (`applyInitialFilter` routes the term to the projects
list whenever a command is pending, `internal/tui/model.go:1261`). Inherited by
`/term`, it would mean typing a glyph whose entire job is to declare "search my
live sessions, never mint" and landing on the mint page — the sigil contradicting
itself.

**A second target.** Two positionals are what triggers the multi-window burst, so
`x /port api` is a session search and a mint target side by side, one of which
wants a picker.

### Journey

The first case was put as a contradiction rather than a trade: the sigil declares
session-domain and a command declares mint, so honouring both is impossible and
quietly switching pages hides that from the user.

The second was genuinely open. A case was floated for allowing it — wanting an
existing Portal session *and* a fresh session in another project, in two windows,
from one line — and rejected by the user rather than argued down.

Both answers point the same way, and together they change what kind of thing the
sigil is. It is not a target that sits in the grammar alongside other targets: it
is a **whole-invocation mode**, the way `-f` is. `portal open /term` is a complete
invocation, and nothing else belongs on the line.

### Decision

**`/term` composes with nothing. Any other argument on the line is a usage error.**

- `portal open /term -e <cmd>` and `portal open /term -- <cmd>` → usage error. A
  command declares mint; the sigil declares session-domain. Refusing is honest
  where a silent page switch is not.
- `portal open /term <other-target>` → usage error, at every arity. The sigil
  never participates in the multi-target burst.
- The shape is what makes a positional a sigil, wherever it sits on the line. A
  single-segment leading-`/` argument is a sigil in any position, so
  `portal open ~/Code/api /tmp` is a usage error rather than a two-mint burst —
  `/tmp` is a sigil, and a sigil with another target on the line is refused. The
  alternative — recognising the shape only as the sole positional, which would
  have left that line bursting — was rejected on the user's own ground: it makes
  the outcome depend on **argument order**, so `portal open /tmp ~/Code/api`
  errors while `portal open ~/Code/api /tmp` succeeds, with the same two arguments.
  A user cannot hold that rule, and no error message could explain it. Position
  independence is worth more than preserving one uncommon line, and the escape is
  the same `-p` escape already documented for `x /tmp` alone:
  `portal open -p ~/Code/api -p /tmp` bursts two mints unchanged.
  *(resolves review-002 F4)*
- `portal open /term -s|-p|-a|-z <value>` → usage error. **Settled by derivation**
  — not discussed. Determined by the two rulings above, which make the sigil a
  whole-invocation form, together with `-f`'s existing contract, which already
  rejects every domain pin; the sigil is stricter than `-f` in every other
  respect, so it cannot be laxer here.

`-f/--filter` keeps its existing behaviour untouched, including its Projects
redirect under a pending command. `-f` never promised session-domain, so nothing
about that redirect is contradictory; the two forms are deliberately not
symmetrical, which is one more line of help text and no behaviour change to a
shipped flag.

Confidence: high. Both halves were the user's own call, and the second was taken
against a stated case for permitting it.

Sibling check: `cli-verb-surface-redesign` specification — it establishes `-f` as
"the sole non-composing flag", mutually exclusive with positional targets and
every pin, and separately specifies the `-f <text> -e <cmd>` filtered-Projects
variant as a stated exception. This decision adds a second non-composing form
that is stricter than `-f` (it takes no command exception) and leaves `-f`'s own
contract intact. No correction is owed.

*(resolves review-001 F5)*

---

## completion

### Context

The form exists to be muscle memory, and a search term the shell cannot finish
for the user is not muscle memory. `x po<TAB>` offers live session names today;
what `x /po<TAB>` should offer was undecided.

### Journey

Today the sigil form completes to nothing. The slash is part of the word being
completed, no session name begins with one, and Portal suppresses the shell's
filename fallback — so Tab is silently inert rather than misleading. (The review
predicted a fallback to filenames from the root directory; measured, that does
not happen.)

The fix has no real choice in it: look past the sigil, complete the term against
live session names, and leave the sigil in place. Completing `/po` to
`/portal-a1b2` also pays off twice — a completed full session name leaves exactly
one match, which under eager resolution attaches outright, so `/po<TAB><Enter>`
becomes the whole interaction.

Directories are deliberately excluded from what is *offered*, even though they
count for *matching*: a completed `/Users/leeovery/Code/portal` reads as a path
and trips the no-second-slash rule straight back into path territory.

**A dependency surfaced while settling this.** The user reported that `x -s <TAB>`
completes nothing while `portal open -s <TAB>` works, and the cause is broader
than the flag — and broader than a misregistration.

Cobra's emitted script asks the **typed word** for its completions rather than a
registered command name:

`portal init bash | grep -n 'requestComp='` → `requestComp="${words[0]} __complete ${args[*]}"`
(zsh builds the same request from `${words[1]}`).

`${words[0]}` is `x`, and `x` is `portal open`. So Tab after `x` runs
`portal open __complete …` — a real `open` invocation carrying `__complete` as a
positional target — and Portal's completer is never consulted at all. Driving the
emitted script with the two functions stubbed to record what they are handed:

```
x    -> portal open __complete
x    -> portal open __complete -s
x    -> portal open __complete /tm
xctl -> portal __complete
```

That is also why the two functions differ despite carrying identical
registrations (`portal init bash | grep -n '^complete '` → both `x` and `xctl`
take `complete -o default -F __start_portal`): `xctl` expands to bare `portal`, so
its request really is `portal __complete …` and resolves correctly.

Portal's own completer answers correctly when it is actually asked
(`portal __complete open ""` and `portal __complete open -s ""` both return live
session names), so nothing is wrong on that side. What is wrong is that the `x`
path never reaches it — every Tab press there spends an `open` invocation against
the live tmux server and returns no completion output, which is why the shell
falls through to filenames.

The decision below is therefore reachable through `portal open /po<TAB>`
immediately, and through `x /po<TAB>` only once that wiring is corrected.

### Decision

**Completion looks past the sigil.** `/po<TAB>` completes the term after — and
excluding — the `/`, against live session names, leaving the sigil in place.
Directories are matched but never offered as completions.

Confidence: high — the user confirmed the shape ("`/` is the command, followed by
the string; we complete on the string after and excluding the `/`").

Sibling check: `cli-verb-surface-redesign` specification — its Tab Completion
section states the principle "complete every Portal-owned enumerable namespace;
leave the rest to the shell" and assigns the `open` bare positional to session
names. This decision applies that same principle to the sigil form rather than
departing from it. No correction is owed.

*(resolves review-001 F7)*

---

## shell-completion-wiring

### Context

The `x` shell function has never completed correctly. Cobra's emitted script asks
the typed word for its completions, and the typed word is `x`, which expands to
`portal open` — so Tab after `x` runs `portal open __complete …` and never reaches
Portal's completer at all. The user noticed it as "`x -s <TAB>` does nothing";
measured, the breakage is general — every Tab press after `x` spends an `open`
invocation against the live tmux server, returns no completion output, and leaves
the shell to fall through to filenames. It has done so for as long as the function
has existed. The `completion` subtopic's Journey carries the measurements.

All three emitted shells share the mistake. `xctl` is unaffected: it expands to
bare `portal`, so its request really is `portal __complete …` and resolves
correctly — which is what distinguishes the pair, since both carry the identical
registration line.

This is a pre-existing defect rather than anything this feature introduced. It
reaches this discussion because the completion decision — complete the term after
the sigil against live session names — is inert through `x` until the wiring is
right, and `x /term` is the form the whole feature is designed around.

### Options Considered

**Spin it out as its own bugfix work unit.** Keeps this feature's edits within the
argument surface, and gives a pre-existing bug with a three-shell blast radius its
own scope. Costs: this feature ships knowingly half-working — the sigil's
completion reachable only by typing `portal open /term` in full, which nobody
will.

**Fold it into this feature.** The completion decision becomes real on the form
the user actually types. Costs: drags the feature into shell-integration code it
otherwise never touches.

### Decision

#### 2026-09-11 — revised
*Trigger: measurement — `portal init bash | grep -n 'requestComp='` →
`requestComp="${words[0]} __complete ${args[*]}"`, and a stubbed drive of the
emitted script showing Tab after `x` issues `portal open __complete …`. The entry
below located the defect in which name the completer is registered against; both
functions carry the identical registration, and what differs is what the typed
word expands to.*

**Folded into this feature.** `portal init` is corrected so that Tab after the
session-opening function asks Portal for `open`'s completions — reaching the
completer that already answers `portal __complete open …` correctly — across bash,
zsh and fish. `xctl` is untouched: its request already resolves to
`portal __complete …`, which is right.

What changed from the entry below is the shape of the fix, not its goal. Changing
which name the completer is registered against would not help, because the emitted
script does not consult a registered name — it asks the word the user typed. The
correction has to change **what command the emitted script asks for completions**
when that word is the session-opening function.

The severity moves with it: this is not a wrong completion list, it is a real
`open` invocation fired at the live tmux server on every Tab press.

The correction applies to the *configured* function name, not the literal `x` —
`portal init --cmd <name>` renames both emitted functions, and the correction must
follow whatever name was chosen.

#### Initial

**Folded into this feature.** `portal init` is corrected so the session-opening
function completes as `portal open` rather than as `portal`, across bash, zsh and
fish. `xctl` keeps completing at the root level, which is already correct.

Deciding factor: this feature's deliverable is not a parsing rule, it is `x /term`
becoming muscle memory. A completion decision that does not reach that form has
not been delivered.

**Rollout consequence:** the fix lands in the output of `portal init`, which users
evaluate in their shell startup file. An existing install therefore does not pick
it up until the shell is restarted (or `portal init` is re-evaluated), even though
the binary is new. This affects the completion behaviour only — the `/term` form
itself is parsed by Portal and works the moment the new binary is in place.

Confidence: high on the scope call; it was the user's, taken against a stated case
for spinning it out.

Sibling check: `cli-verb-surface-redesign` specification — it records that "the `x`
/ `xctl` shell functions re-emit from `portal init` and keep working untouched"
under its no-back-compat posture, a statement about the functions surviving the
verb redesign rather than a decision about how their completion is registered. No
correction is owed.

---

## surface-reconciliation

### Context

The user raised this as the thread behind the whole feature: the argument surface
has accumulated ways to do things, and adding another risks making it worse. After
this feature there are five ways to reach a live session — a bare exact session
name, a quoted bare glob, `-s <name>`, `-s <glob>`, and `/term` — plus two ways to
open the picker pre-filtered, `-f <text>` and `/term`.

### Journey

The worry turned out to be smaller than it looked once each pair was examined
rather than counted.

**`-f` and `/term` are not two spellings of one behaviour.** They differ exactly
where it matters: with one match, `/term` attaches and `-f` shows a list of one.
`-f` is the explicit form that always lands in the picker, which is what a script
or a keybinding wants; `/term` is the interactive form that finishes the job when
it can. The user's verdict on the pair was direct — "they arent the same. this is
fine."

**The five session routes are not five spellings either.** A bare exact name is a
name you already know. `-s <name>` is the same thing pinned, for a script or for
reaching a name a higher-precedence domain would shadow. A quoted bare glob and
`-s <glob>` open *every* match — a burst, not a search — and resolve identically
(both dispatch through `expandSessionGlobAll`, `sed -n '31,41p' cmd/open_surfaces.go`);
the pin only makes the intent explicit. `/term` narrows and lets the user choose.
Only the last is the everyday human route, and it is the one that did not exist.

The accretion worry was also what produced the two rejections recorded under the
sigil subtopic: a `+` mint sigil (a fourth mint route solving nothing) and a
configurable sigil (one behaviour, two meanings). Both were declined on this
ground rather than on their own merits.

### Decision

**The surface stands as it is, plus `/term`.** Nothing is retired, renamed or
deprecated: `-f`, all four domain pins, and the bare positional chain keep their
current behaviour and their current prominence.

The user's landing, stated twice — "leave everything else as-is", and on the
closest pair, "they arent the same. this is fine."

What this does change is how the pair is *described*: `-f` documented as "open
the picker pre-filtered" invites a reader to assume `/term` is shorthand for it.
The two are better described by outcome — one always shows the list, one takes
you there when there is only one place to go. That is help-text and README work
for the specification to carry, not a behaviour change.

Confidence: high.

Sibling check: `cli-verb-surface-redesign` specification — it is the document that
established this surface and its governing principle ("split the public surface by
outcome, not by input shape"). Adding a form that is distinguished from `-f` by
its *outcome* applies that principle rather than departing from it. No correction
is owed.

---

## session-name-recognisability

### Context

This subtopic was seeded at initialisation, from the discovery log rather than
from anything the user asked for. The log recorded the *reason* behind the user's
intent belief — that `{project}-{nanoid}` names "make existing sessions
unrecognisable by name" — and it was put on the map as the root cause worth
testing.

### Journey

It was never a question the user had. Asked directly whether the naming itch
survived folder matching, the answer was that naming is fine, and that the
subtopic's presence needed explaining rather than answering.

The seeding was a reasonable reading of the discovery log and a wrong call about
scope: the log named naming as an explanation, not as a complaint. The feature's
own answer also removes whatever pressure existed — searching directories as well
as names means a session is found by the place it was opened in, with no need to
recognise `portal-c3d4` at all.

Recorded rather than deleted so the same inference is not drawn again from the
same discovery log.

### Decision

**Session naming stays exactly as it is.** `{project}-{nanoid}` is unchanged, and
no part of this feature touches session creation, the naming scheme, or renaming.

Out of scope and not deferred: there is no open thread here to pick up later.

Confidence: high — the user's answer was direct.

Sibling check: no overlap found. No sibling document proposes changing the naming
scheme; `cli-verb-surface-redesign` cites `{project}-{nanoid}` as a fact its
precedence reasoning relies on, which this decision leaves standing.

---

## search-result-display

### Context

Matching on the session's directory means `/port` can return a row the user
cannot account for. A session named `api-work` appears because it lives in the
Portal checkout, and the row shows a session name, a window count and an attached
marker — nothing about the directory that put it there.

The picker reopens in whichever grouping mode the user last left it in — the mode
is persisted and re-applied at construction, with Flat only the fallback for a user
who has never pressed `s` (`sed -n '612,615p' cmd/open.go`). So the sigil's narrowed
list lands in Flat, By Project or By Tag depending on that history, and in every one
of them the user is looking at a name with no visible relationship to what they
typed. By Project does not rescue it: the grouping survives a committed filter but
the headings do not — a header row's filter value is empty
(`sed -n '93p' internal/tui/session_item.go` → `func (HeaderItem) FilterValue() string { return "" }`),
so a filtered By-Project list shows grouped-indented names with neither heading nor
directory.

This is the seed's own complaint returning by the back door: names are precisely
what the user said they cannot recognise sessions by, the feature answers that by
matching the directory instead, and then displays the name anyway. It bites
hardest in the case the whole feature exists for — two rows back, one obviously
named and one not, and choosing between them is the moment that is meant to be
fast. Without the directory on the row the user falls back to previewing each
one, which is the ceremony being removed.

### Decision

#### 2026-09-11 — revised
*Trigger: measurement — `sed -n '612,615p' cmd/open.go` shows the picker's grouping
mode is loaded from persisted prefs rather than fixed at Flat, and
`sed -n '93p' internal/tui/session_item.go` shows group headings carry an empty
filter value and drop out under a committed filter. The entry below reasoned from
Flat being where the sigil lands and from By Project carrying the directory as a
heading; neither holds.*

**A row in a sigil-opened list shows the directory it matched on, beside the
session name — in every grouping mode the list can be in.** The requirement is
unchanged in kind and broader in reach than the entry below assumed: no mode
displays the matched directory under a committed filter, so scoping the column to
Flat would leave the grouped modes carrying exactly the unaccountable row the
decision exists to remove.

Placement, weight, scope, deciding factor and trade-off are as the entry below
states them.

#### Initial

**A row in a sigil-opened list shows the directory it matched on, beside the
session name.**

Placement and weight follow the user's suggestion, offered as a lean rather than
a ruling ("could go next to the session name perhaps in 'gray' (using theme
tokens obvs)"): alongside the name rather than on its own line, rendered in the
muted weight of the text ramp — the role paths already take elsewhere in the
picker, so this introduces no new colour token and no new convention. (The
selected-row path already has its own established treatment one step brighter;
the sigil row reuses that pattern rather than inventing one.) The exact column
treatment is presentation detail the specification settles.

Scoped to the sigil's own list. How Sessions rows render generally is untouched —
this work changes nothing about the picker reached any other way, consistent with
the matching rule decided under `search-match-domain`.

Deciding factor: it is the only thing that makes a directory match legible. Having
widened the match domain to something invisible, leaving it invisible means the
user cannot audit why a row is in front of them.

Trade-off accepted: the row carries more text, and a long path in a narrow
terminal needs truncating — the delegate already truncates, so this is
presentation detail for the specification rather than an open question.

Confidence: high.

Sibling check: `theming-system` specification — it fixes the token vocabulary at
19 closed semantic roles and forbids raw colour at call sites, with the muted rung
of the text ramp already carrying paths, counts and subtitles. This decision
references that existing role rather than proposing a new token, so nothing in
that vocabulary changes. No correction is owed.

*(resolves review-002 F6)*

---

## cold-path-classification

### Context

On a cold boot — no tmux server running — Portal must start the server, register
hooks, restore every saved session and replay its scrollback before it can list a
single session. That takes seconds, and Portal already has an honest loading page
for it, with a live `Restoring sessions N/M` counter.

Which invocations get that page is decided from the command line before anything
is resolved, and anything positional is classified as not-heading-for-the-picker.
`-f port` is a flag, so it qualifies; `/port` is a positional, so it would not.
The same verdict also decides where soft bootstrap warnings go — on the non-picker
classification they are written straight to the terminal the picker is about to
take over with its alternate screen, which is the corruption the classification
exists to prevent.

So without a decision, `x /port` on a cold boot gives a blank terminal for the
whole bootstrap and can spray a warning into the frame the picker is about to
claim, while `x -f port` on the same boot shows the loading page throughout.

The awkwardness is real rather than an oversight: `/term` does not know whether it
is heading for the picker. That depends on the match count, and on a cold server
there are no sessions to match until restore has finished.

### Decision

**The sigil is classified as a picker invocation.** It gets the concurrent
bootstrap and the loading page, and bootstrap warnings take the in-TUI route
rather than stderr.

Deciding factor: a brief loading page on the way to a direct attach costs a
flicker; a silent multi-second blank terminal on every cold boot reads as a hang,
and it is the first impression the feature makes after every reboot. The warnings
argument points the same way — they need somewhere safe to land, and the picker
path already has one.

Trade-off accepted: when the term resolves to exactly one session, the loading
page appears and is replaced by the attach, so the user sees a brief screen they
did not need.

Confidence: high.

Sibling check: no overlap found. The cold-path startup flip is described in the
project's architecture notes rather than owned by a sibling work unit's
specification; this decision adds the sigil to the set of invocations that take
the concurrent path and changes nothing about how that path behaves.

*(resolves review-002 F1)*

---

## Summary

### Key Insights

1. **The complaint and the defect were in different places.** Discovery arrived
   with "the bare-positional chain is unpredictable". Measured, a plain word can
   reach only three of the five branches and two of those always mint, so the
   *outcome* is near-invariant — the unpredictability is which directory zoxide
   chose. The genuine hole was elsewhere entirely: three routes that mint, one
   that searches but bursts on ambiguity (`-s <glob>`), and none that searches
   and narrows. Testing the complaint before designing against it is what
   located it.

2. **Declaring the domain is what makes eager resolution safe.** The sibling
   specification rejected project-prefix session matching because it reintroduces
   attach-versus-mint guessing with a cliff at the second match. The sigil has
   the same K=1/K=2 cliff and is fine, because both sides of its cliff are
   session-domain: the worst case is a picker the user was already opening, not a
   stray session minted where they wanted an attach. What matters is not whether
   behaviour changes with the match count, but what sits on each side.

3. **Deciding the fields of a match is not deciding the match.** Widening the
   search to include directories was settled as a question about *which fields*,
   and the rule applied to them was left implicit — which would have inherited
   subsequence matching over full filesystem paths and, under eager resolution,
   attached the user to a session with no run of their typed characters anywhere
   in it. The fields and the rule are separate decisions and only one of them was
   visible at the time.

4. **Divergence between entry points is not uniformly bad.** The same property —
   one list narrowing differently depending on how you reached it — was rejected
   for the matched fields and accepted for the matching rule. The distinguishing
   question is whether the path can act without showing the user anything: the
   picker shows its results and can afford a loose rule, the shell form cannot.

5. **A match domain the row does not display is a match the user cannot audit.**
   Matching directories and rendering only names would have put rows in front of
   the user with no visible reason for being there — sending them back to
   previewing each candidate, which is the ceremony the feature exists to remove.

### Open Threads

- **A correction is owed to the `cli-verb-surface-redesign` specification.** Its
  target-resolution section runs every bare positional through the precedence
  chain, which this feature narrows: a single-segment leading-`/` argument becomes
  session-search text and never enters the chain at all. The correction is owed
  once this feature has a specification of its own to name as the superseding
  source; it is recorded in the `filter-shortcut-form` sibling check as well as
  here.

### Current State

**Resolved.** The form is `/term` with a space, recognised by shape in any
position, composing with nothing. It is session-domain and never mints: one match
attaches outright, every other count opens the picker pre-filtered — zero
included, landing on an empty list rather than an error — and `/` alone opens the
picker with an empty filter ready to type into. It
matches session name and recorded session directory, by containment, and shows
the matched directory beside the name. It takes the picker's cold-start
classification, so it gets the loading page and in-TUI warnings. Completion
strips the sigil and completes session names. The bare-positional chain, the four
domain pins, `-f`, and the picker's own fuzzy filter are all untouched. The `x`
function's completion is corrected as part of this work.

**Uncertain.** Whether matching directories produces a tolerable rate of
unwanted rows is a question only use will answer — the user took it as "happy to
include folders too and see how it goes", and narrowing back to names alone is a
cheap reversal. Pre-stamp sessions carrying no recorded directory match on name
alone until they age out.
