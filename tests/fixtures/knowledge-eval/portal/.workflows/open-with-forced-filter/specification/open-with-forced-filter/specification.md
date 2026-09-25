# Specification: Open With Forced Filter

## Specification

### 1. Purpose and Scope

#### 1.1 The gap this fills

`portal open`'s argument surface reaches a live session by an exact session name (bare or pinned with `-s`), or by a session glob — bare or pinned, which resolve identically (`sed -n '31,41p' cmd/open_surfaces.go` → both `ResolveBareAll` and `ResolveSessionPinAll` dispatch a glob to `expandSessionGlobAll`). The glob form answers ambiguity by opening a window per match rather than by narrowing — one match degenerates to a direct open, two or more run the multi-window burst (`sed -n '90p' cmd/open_burst.go` → `if len(surfaces) == 1 {`) — and it demands quoted glob syntax, because an unquoted `x port*` is consumed by zsh's `nomatch` before Portal sees it. Every other route on the surface mints: a bare path, alias or zoxide hit, and the `-p` / `-a` / `-z` pins.

Nothing on the surface searches live sessions and then lets the user choose among the matches. This feature adds that route.

#### 1.2 What it adds

A positional beginning with `/` — `x /port` — declares session-search intent. The term after the slash is forced into the sessions list as filter text and never enters the resolution chain, and the number of live sessions it matches decides what happens (§3.2).

The flow it collapses is the user's dominant one today: `x`, wait for the picker, `/`, type three or four characters, `Enter`, `Space` through the two or three survivors to see which is which, `Enter` to attach. After this feature the leading five steps are one keystroke sequence: `x /port`.

#### 1.3 Scope

This specification covers the sigil's shape and recognition rule (§2), its resolution semantics (§3), what the search matches and by what rule (§4), what else may share its command line (§5), how a matched row is displayed (§6), its cold-start classification (§7), tab completion for the form together with the pre-existing defect that stops the `x` function completing at all (§8), and the help-text and README changes the form obliges (§9).

What this feature deliberately leaves untouched is stated in §10; how it stands against a sibling specification, and the correction already applied there, is §11.

---

### 2. The Sigil Form

#### 2.1 Shape

The form is a positional argument beginning with `/`, with a space between the command and the argument: `x /port`, `portal open /port`. The character after the `/` begins the search term.

The seed's no-space form `x/port` is ruled out permanently — not because the shape is unclaimable, but because claiming it buys nothing. Both shells will define a function whose literal name is `x/port` and dispatch that word to it (`bash --noprofile --norc -c 'x/port() { echo RAN-FUNC; }; x/port'` → `RAN-FUNC`, GNU bash 5.3.15; `zsh -f -c 'x/port() { echo RAN-FUNC }; x/port'` → `RAN-FUNC`, zsh 5.9) — but the name must be the search term, so it would take a function per term anyone might ever type. Without one the word falls through to a path, a command named `port` inside a directory named `x`. The only other interception is a global unknown-command hook, which would put Portal in the path of every mistyped command on the machine. Neither is built.

#### 2.2 The recognition rule

**A positional argument is a sigil when it begins with `/` and contains no further `/`.**

A leading `/` today makes an argument a path unconditionally (`sed -n '14p' internal/resolver/path.go` → `return strings.Contains(arg, "/") || arg[0] == '.' || arg[0] == '~'`), so this rule narrows the path test for one shape and leaves every other path argument exactly as it is.

| Argument | Reading |
|---|---|
| `/port` | sigil — session search on `port` |
| `/Users/leeovery/Code/portal` | path — mints, unchanged |
| `/tmp/` | path — mints, unchanged; the trailing slash is the second one |
| `./port`, `~/port`, `port` | unchanged — the rule tests a leading `/` only |

Completion cannot turn one shape into the other (§8.1). Portal answers every completion request with `ShellCompDirectiveNoFileComp`, and the shell switches its filename fallback off on that directive wherever it is able to: zsh and fish always (fish is registered `complete -c <name> -f`), bash only where `compopt` is a builtin — 4.0 and later — and the `bash-completion` package is installed, because cobra's generated script gates the switch-off on `type -t compopt` and its completion function reaches `_get_comp_words_by_ref` from that package before it runs at all. So `portal open /tm<TAB>` never becomes `/tmp/` on a shell that can honour the directive, and neither does `x /tm<TAB>` once the corrected `portal init` output is live in the user's shell — until then Tab after that function is answered by the shell rather than by Portal and still falls through to filenames (§8.2, §8.5). Where the shell cannot honour it — macOS's stock `/bin/bash` 3.2 is the case in the wild — the standing `complete -o default` registration supplies filenames, and it does so for `portal open` exactly as much as for `x`. The trailing slash that keeps an argument a path is therefore always one the user types, and a single-segment absolute directory typed without it is a sigil however it was reached.

#### 2.3 Recognition is positional-independent

The **shape** is what makes a positional a sigil, wherever it sits on the command line. `portal open ~/Code/api /tmp` is therefore a usage error under §5 rather than a two-mint burst — `/tmp` is a sigil, and a sigil with another target on the line is refused.

The alternative — recognising the shape only as the sole positional — was rejected because it makes the outcome depend on argument order: `portal open /tmp ~/Code/api` would error while `portal open ~/Code/api /tmp` succeeded, with the same two arguments. No error message can explain that rule.

**The command payload is not searched for the shape.** Recognition applies to the arguments `open` parses as targets, and stops at a `--` separator: the words after it are the trailing command's own, passed to that command untouched, so a `/word` among them is that command's argument and never a sigil. `portal open ~/Code/api -- ls /tmp` is unaffected by this feature. The rule loses nothing by stopping there, because a sigil line carries no command at all (§5.1) — a line holding both is a usage error on the target it names. A command carried as a flag value is a value rather than a positional and was never in reach of the rule.

#### 2.4 Accepted cost

Single-segment absolute directories typed *without* a trailing slash — `x /tmp`, `x /opt`, `x /srv` — stop minting and start filtering. The escape is `-p`, the pin that exists for exactly this: `portal open -p /tmp` mints there, and `portal open -p ~/Code/api -p /tmp` bursts two mints unchanged.

The cost is affordable because of what it shadows: minting a session directly in a root-level directory is not something the user does, so the directories the rule takes out of the minting domain are ones nobody opens a session in. The recognition rule stays a test of the argument's shape and never consults the filesystem — a rule that minted when the single-segment path happened to exist would read the same command differently on two machines.

#### 2.5 The bare slash

`x /` — the sigil with no term — opens the picker with the filter **open and empty, the cursor in it, ready to type**. It is `x` followed by `/`, not plain `x`, and not an error. It does not mean "mint at root".

`-f`'s refusal of an empty value does not transfer: `-f ""` is a flag given no argument, while `/` on its own is the gesture that opens a filter.

---

### 3. Resolution

#### 3.1 The sigil is session-domain by declaration

A sigil argument never enters the bare-positional resolution chain. It reaches neither the path, alias nor zoxide domain, and it can never mint a session. Its term is a search over live sessions and nothing else.

This is what makes eager resolution safe. The sibling `cli-verb-surface-redesign` specification rejected project-prefix session matching (`api` resolving to the sole live `api-*` session) because it reintroduces attach-versus-create guessing with a cliff at the second match. The sigil has the same cliff at the same place and is nevertheless sound, because both sides of its cliff are session-domain: the worst case is a picker the user was already heading for, not a stray session minted where an attach was wanted.

#### 3.2 Outcomes by match count

Let K be the number of live sessions matching the term under §4.

**A term-less sigil takes no count.** `x /` carries nothing to match, so no count is evaluated and none of the rows below apply: it opens the picker on the whole live session list as §2.5 sets it, on a machine holding one live session as on a machine holding twenty.

The searched set is the set the picker lists. Portal's own internal sessions — the `_portal-saver` daemon host and the `_portal-bootstrap` server anchor — are absent from that list and are never search candidates: no term counts one toward K, and none can be attached by a sigil.

| K | Outcome |
|---|---|
| 0 | The picker opens on the Sessions page, landing as §3.3 sets it, with no session surviving the term. |
| 1 | The matching session is attached directly. No picker. |
| >= 2 | The picker opens on the Sessions page, landing as §3.3 sets it, with the cursor on the first matching row. The narrowed list holds the K matching sessions except in the collision case §4.4 carves out, where it holds a subset of them. |

**The sigil never fails.** The form is the pre-filtered picker, and the single-match attach is the one shortcut past it; a count of zero is a filter result rather than an error. Zero matches is indistinguishable from typing `/` inside the picker and filtering to nothing — `Esc` clears the filter and the session list is there. Nothing is written to stderr and the exit status is not a failure.

Eager attach on a single session-search match is already shipped behaviour rather than a new one (§1.1).

#### 3.3 The committed-filter landing

Whenever a term opens the picker — K = 0 and K >= 2 alike — it lands exactly as `-f` already lands it: filter text set and filter state committed rather than focused, cursor re-anchored onto the post-filter visible set, so arrows, `Space` and `Enter` work immediately on the narrowed list (`sed -n '1261,1273p' internal/tui/model.go`). The user is not left inside a live filter input.

The bare slash is the exception, and deliberately so: `x /` carries no term to commit, so its filter is **focused and empty** (§2.5).

#### 3.4 When the count is taken

K is evaluated against the live session set once the tmux server is ready to answer for it. On a warm server that is immediately. On a cold server the sigil takes the picker's concurrent-bootstrap path (§7), so the count is taken once that bootstrap has run to completion — every step of it, not merely the restore that reconstructs the saved sessions. Nothing the sigil decides fires earlier: the loading page stands until the count can be taken, and is then replaced by the attach when K turns out to be 1, or by the picker at any other count. Acting at the end of restore would replace the process mid-bootstrap and abandon the steps that follow it — among them the clearing of the `@portal-restoring` marker, which must not outlive bootstrap. The loading page's own minimum display span is untouched by this (§7.6): where the count can be taken before that span has elapsed, the page stands for the remainder of it, and the attach or the picker follows when it lifts.

#### 3.5 Accepted cost

The user cannot predict before typing whether they land in a session or in the picker. That was taken knowingly: the cost of the wrong side of the cliff is a screen they were already opening.

#### 3.6 No `resolve` log line

The sigil emits no `resolve` component line. That component records one INFO line per bare positional resolved through the guessing chain; deterministic targets — globs and domain pins — emit none, and a sigil declares its domain in the same way a pin does.

*Derived, not decided in discussion: the source material settles the sigil's domain but never names its logging. The derivation is the `resolve` component's own stated rule.*

#### 3.7 How an attach is performed, and the one failure that is not a search result

**An attach under K = 1 uses the connector the invocation already selects** — `syscall.Exec` into `tmux attach-session` outside tmux, `switch-client` inside it. The sigil introduces no third connection mode.

**A session list that could not be read is not a zero match.** K = 0 says the search ran and found nothing, which is a filter result and opens the picker (§3.2); a failed read has searched nothing, and opening an empty picker on it would tell the user their sessions are gone when they are running. A tmux read failure is therefore reported in tmux's own terms and exits non-zero — the one failure path on this form, and it belongs to tmux rather than to the search. On a cold boot it reaches the user after teardown; it is not a bootstrap fatal and takes no in-TUI error frame.

The usage errors of §5.1 are ordinary usage errors, carrying the same shape as `-f`'s own mutual-exclusion refusal. They are refusals of a malformed command line, not outcomes of a search.

*Derived, not decided in discussion: the sources settle that one match attaches but never name the connection mode, and never treat a failed session-list read separately from an empty one. The derivations are `open`'s existing connector selection, and the sigil's own rule that a zero count is a filter result — which a read that never ran cannot be.*

---

### 4. Match Domain and Matching Rule

#### 4.1 The matched fields

**A session matches on its name and on its recorded directory.** Project records and tags stay out of the match domain.

The recorded directory is the `@portal-dir` tmux session user-option, stamped at creation and returned with the session list at no extra cost — `ListSessions` appends `#{@portal-dir}` to its `list-sessions -F` format and parses it into `Session.Dir` (`grep -n '@portal-dir' internal/tmux/tmux.go`). Matching on it therefore costs no additional tmux round-trip.

**Never a derived directory.** The picker can derive a missing directory by asking a session's pane where it is, but only in the grouped views, and it caches the answer — so a session would be findable or not depending on which view the user last left the picker in. The shell form has it worse: K (§3.2) is taken before a single session row has been rendered — on a cold machine while the loading page still stands (§3.4) — so a derived value has nowhere to come from and nowhere to be kept; the recorded directory that rides back with the session list is the only one there is. Matching the recorded value alone makes the answer identical everywhere — the count and the list, the shell and the picker — and keeps the sigil path free of a per-session pane read on a path whose whole point is to feel instant.

**The searched form is the displayed form.** A recorded directory under the user's home is searched home-abbreviated (`~/Code/portal`), not as tmux recorded it (`/Users/leeovery/Code/portal`) — the same abbreviation the row displays (§6.2). Otherwise a term hitting the home prefix (`/lee`, `/user`) would match every session the user has while every returned row displayed no such text, and on a lone survivor would attach outright with nothing on screen accounting for the choice. What was matched is what is shown.

**Known limitation, unconditional and self-correcting:** a session created before the directory stamp shipped carries no recorded directory and matches on name alone, in every view. Such sessions age out as they are killed and replaced. Deriving the missing value everywhere was rejected for its cost — one pane read per unrecorded session on every `/term`.

This holds *within* a single picker as well as across launches. The grouped views derive a missing directory while the sigil's own narrowed list is on screen, and retain what they derive; that value belongs to grouping and to nothing else. **A session therefore carries the two as separate values — the recorded directory, which may be absent, and the derived one, which grouping alone reads and writes. A derived value never lands in the recorded one.** Neither the match (§4.4) nor the directory column (§6.1) ever reads it, so a regroup can never make a session findable by a path it was not findable by a moment earlier, and can never put a path beside a name that showed none.

#### 4.2 The matched fields are shared across all three filter entry points

`-f/--filter`, the sigil, and typing `/` by hand inside the picker all narrow the same list through the same filter value. Widening the matched fields to include the directory widens them for all three. That is deliberate: the same list narrowing on different *fields* depending on how the user arrived at it is harder to predict than one wider rule.

The *form* is shared with them too: all three match the recorded directory home-abbreviated, exactly as §4.1 fixes it, never the absolute path tmux recorded. The abbreviation belongs to the value rather than to the sigil's rule — what diverges between the three entry points is the rule (§4.4) and nothing else. Matching the raw path on the fuzzy routes would make every session on the machine answer to the user's own account name.

#### 4.3 The matching rule

**The sigil matches by containment** — the typed characters appearing as a run in the matched text — case-folded.

The two fields are tested separately **for the sigil**: a session matches when the term appears as a run in its name, or as a run in its recorded directory. They are never joined into a single string on this path — a term matching across the join would return a session that neither field contains, and the sigil can act on a lone match without showing it.

**The term is literal text.** `*`, `?` and `[` are characters to find rather than wildcards: `/port*` matches a session whose name or recorded directory contains `port*`, and nothing else does. The glob forms answer ambiguity by opening a window per match; the sigil answers it by narrowing, and the two rules are not mixed.

**On the two fuzzy routes the fields are joined**, as the picker's stock matcher expects, so a cross-field match is possible there — the first letters of the term found in the name and the rest in the path. **The joined text is the session name, one space, then the recorded directory in its home-abbreviated form** — the two values the row is built from (§6.2), so what the matcher scores and what the eye reads are the same text; a session carrying no recorded directory joins to its name alone, with no trailing separator. The join is over those two values and nothing else, and it is taken before the row is laid out: the width-driven left-truncation and the floor that drops the directory altogether (§6.2) narrow what is displayed and never what is matched, and the row's count and attached slots are no part of the matched text. That is accepted: those routes always show their rows, their rule was already the loose one (§4.4), and separating the fields would cost the list its ranking through the stock matcher.

The picker's own filter does not. The sessions list filters through `charm.land/bubbles/v2/list.DefaultFilter`, which is `fuzzy.Find` from `sahilm/fuzzy` — subsequence matching, anywhere, case-folded and rank-sorted — and `internal/tui` installs no filter of its own, so that default stands (`grep -rn 'SetFilterFunc\|DefaultFilter' internal/tui/*.go | grep -v _test` → no matches). Case-folding is the one property the sigil keeps from it: the two rules diverge on subsequence against containment and on nothing else. Under that rule a session at `~/Projects/rust-tools` satisfies `port`: **p** in `projects`, **o** in `projects`, **r** in `rust`, **t** in `tools`, with the four letters never appearing together.

That is harmless inside the picker, where the user reads the results and skips the nonsense rows. It is not harmless for the sigil, because two decisions compound: matching directories gives the matcher a long absolute path to find scattered letters in, and eager resolution (§3.2) means a lone match is acted on without ever being shown. Together they can attach the user to a session they never saw and would not have chosen. `/port` finding nothing is a better failure than `/port` attaching `rust-tools`.

Portal's own `internal/fuzzy` package is not what the picker uses and has no production consumer (`grep -rln 'internal/fuzzy' . --include='*.go' | grep -v '^./internal/fuzzy/'` → `internal/fuzzy/match_test.go`).

#### 4.4 The rule diverges by entry point; the fields do not

| Entry point | Matched fields | Matching rule |
|---|---|---|
| Sigil — the count deciding §3.2, and its list for as long as its filter text stands untouched | name + recorded directory | containment |
| `-f/--filter` | name + recorded directory | the picker's own fuzzy |
| `/` typed by hand in the picker | name + recorded directory | the picker's own fuzzy |

**The containment set holds for as long as the sigil's filter text stands untouched.** The narrowed list does not sit still — a `Space` preview and back, an `s` regroup, a refresh after a session is killed elsewhere all re-render it — and every one of those reproduces the containment set. The list the user is choosing from is the list they were handed, subject to the collision carve-out below — which withholds the same rows on every one of those re-renders, so the list is narrower than the containment set rather than unstable. Only a hand edit of the filter text returns the list to the picker's own rule, and the test is the text rather than the act: while the committed filter value is character-identical to the term the sigil supplied, containment stands — opening the filter input and leaving it as it was, or editing back to the same characters, keeps it. Any other value, a cleared filter included, is the picker's own rule.

**Containment narrows the list; it does not reorder it.** Rows keep the order the sessions list gives them in whatever grouping mode is current, with non-matching rows removed and nothing re-ranked — the picker's rank-sorting is a property of its fuzzy rule, which the sigil does not use. The first matching row (§3.2) is the first surviving row of that existing order.

**A matching session is withheld where two sessions render to one filter value.** The picker's filter is handed target strings rather than sessions, and a target is the session name joined to its home-abbreviated recorded directory (§6.2) — a form that is not unique: a session *named* `api ~/Code/api` and a session `api` recorded at `~/Code/api` produce the same target. Where the sessions behind one target disagree about the term, every row behind that target is withheld, so the narrowed list is a subset of the K sessions §3.2 counts — K is taken per session and the list is decided per target, and the two can disagree. Withholding is the only safe answer available: the filter cannot rank one of two identical targets and withhold the other, and ranking both would surface a session neither of whose fields contains the term — precisely what §4.3 separates the fields to prevent, and what `Enter` would then attach.

**The disagreement is judged over the picker run, not over the list as it stands.** The test is taken across every distinct pair of fields any generation of the list has produced for that target since the picker opened — the record accumulates for the run's life and nothing is ever evicted from it. That retention is what makes the withholding above reproduce identically on every one of those re-renders, and it is what lets a filter pass answering for a generation the list has since rebuilt rank its own targets by containment rather than find the record empty of them: such a pass omits only where a collision is on the record, never merely because a rebuild landed under it. **Accepted with it:** killing or renaming one of two colliding sessions does not return the other's row — the pair that disagreed is still on the record, and only relaunching the picker clears it. Eviction is the alternative, and it would make the withholding blink off mid-run, which is the instability this section rules out. Both cases are rare, both fail toward showing less, and neither widens the set.

**The term-less form supplies nothing for that test to hold.** `x /` lands with an empty, focused filter (§2.5) — the picker's own filter gesture, reached from the shell — so the first character typed there is already a value the sigil did not supply, and the picker's own rule applies from that keystroke on.

**The picker's own filter is untouched by this work.** Once the user edits that text the picker's rule applies and the row set can widen. The divergence is therefore visible only by rows appearing, never by rows the user expected going missing — the collision carve-out above is the one case where the sigil's own list is the narrower one.

The distinguishing question is whether a path can act without showing the user anything: the picker shows its results and can afford a loose rule; the shell form cannot.

#### 4.5 Accepted cost and confidence

`/port` is less precise than it would be on names alone — sessions the user would never think of as "port" appear because their path happens to contain it. Taken knowingly, as something use rather than argument will settle. Narrowing the match domain back to names alone is a cheap reversal if the false-positive rate proves intolerable.

**Accepted with it:** the widening reaches the pickers this feature does not open. There, a session can surface on the strength of a recorded directory no row displays, because the directory column is scoped to a search-opened picker (§6.3). The visible effect is rows appearing, never rows the user expected going missing, and narrowing the fields by entry point is the alternative §4.2 rejects.

---

### 5. Argv Composition

#### 5.1 The rule

**`/term` composes with nothing. Any other target, any trailing command, and any of `open`'s own flags on the same line is a usage error.**

Flags that answer before the command body runs are outside the rule: `portal open /term --help` prints help, and root-level persistent flags apply as they do to any other invocation.

**A refusal names what collided.** Each line above is refused with a single message naming the search form and the element beside it that may not be there — the shape `-f`'s own mutual-exclusion refusal already takes — rather than a generic complaint about the arguments that leaves the user to find the offending word themselves.

The sigil is not a target that sits in the grammar alongside other targets — it is a whole-invocation mode, the way `-f` is. `portal open /term` is a complete invocation, and nothing else belongs on the line.

| Line | Outcome |
|---|---|
| `portal open /term` | the sigil, per §3 |
| `portal open /term -e <cmd>` | usage error |
| `portal open /term -- <cmd>` | usage error |
| `portal open /term <other-target>` | usage error, at every arity |
| `portal open <other-target> /term` | usage error — recognition is positional-independent (§2.3) |
| `portal open /term /other` | usage error — a second sigil is another target |
| `portal open /term -s|-p|-a|-z <value>` | usage error |
| `portal open /term -f <text>` | usage error |
| `portal open /term --ack <batch>:<token>` | usage error |

**A refused line starts nothing.** The refusal is decided from the arguments alone, so it needs no tmux server and takes no loading page: on a cold machine as on a warm one, a refused line prints its usage error and exits without starting the server, restoring a session or painting a frame. The picker classification of §7.1 applies to a complete sigil invocation only. That is what separates a usage error from everything else on this path: a malformed line is knowable from the argv, while the match count — and any failure of the read that produces it (§3.7) — needs a live session list.

#### 5.2 Why a command is refused rather than redirected

A trailing command declares mint: it can only run in a session about to be created. `-f` answers that by routing its term to the **Projects** page instead of the sessions list, which is correct for `-f` — it never promised session-domain (`sed -n '1265,1271p' internal/tui/model.go` → the `commandPending` branch sends the filter to the project list).

Inheriting that would mean typing a glyph whose entire job is to declare "search my live sessions, never mint" and landing on the mint page — the sigil contradicting itself. Refusing is honest where a silent page switch is not.

#### 5.3 Why a second target is refused

The sigil never participates in the multi-window burst. A case was floated for allowing it — wanting an existing Portal session *and* a fresh session in another project, in two windows, from one line — and declined.

#### 5.4 The domain pins and the hidden `--ack`

These are settled by derivation rather than by discussion. The two rulings above make the sigil a whole-invocation form, and `-f`'s existing contract already rejects every domain pin (`sed -n '156,160p' cmd/open.go`); the sigil is stricter than `-f` in every other respect, so it cannot be laxer here. `--ack` is the burst's internal handshake flag and the sigil never bursts, so it falls under the same rule.

*Derivation recorded: `-f`'s mutual-exclusion contract plus §5.1's whole-invocation ruling.*

#### 5.5 What `-f` keeps

`-f/--filter` keeps its argument contract, its fuzzy matching rule and its Projects redirect under a pending command. Its matched fields widen with everything else's (§4.2). The two forms are deliberately not symmetrical — the sigil takes no command exception — which is one more line of help text (§9).

---

### 6. Search Result Display

#### 6.1 The requirement

**Every row in a sigil-opened list shows its recorded directory beside the session name** — the rows found by their directory and the rows found by their name alike, so the column is uniform rather than a signal in itself.

Matching on the recorded directory (§4.1) means `/port` can return a row the user cannot account for: a session named `api-work` appears because it lives in the Portal checkout, while the row shows only a name, a window count and an attached marker.

**In every grouping mode**, not only Flat. The picker reopens in whichever session-list grouping mode the user last left it in — persisted and re-applied at construction, with Flat only the fallback for a user who has never pressed `s` (`sed -n '612,615p' cmd/open.go`) — so the sigil's narrowed list lands in Flat, By Project or By Tag depending on that history. By Project does not carry the information by another route: the grouping survives a committed filter but the headings do not, because a header row's filter value is empty (`sed -n '93p' internal/tui/session_item.go` → `func (HeaderItem) FilterValue() string { return "" }`). A filtered By-Project list therefore shows grouped-indented names with neither heading nor directory.

**Only the recorded directory is displayed.** A session carrying no recorded directory (§4.1) shows none beside its name — the slot is simply empty. The displayed value is never derived from a pane read, for the same reason the match is not: the row must show what the search actually matched against, and the sigil path pays for no per-session pane read.

That is the seed's own complaint returning by the back door. Names are precisely what the user said they cannot recognise sessions by; the feature answers that by matching the directory instead; displaying the name alone sends them back to previewing each candidate, which is the ceremony being removed.

#### 6.2 Placement and weight

**The directory begins one space after the session name** — packed against it rather than anchored to a column of its own, so its start moves with the name's length and both its edges are ragged down the list.

Balance comes from colour rather than alignment. The directory takes the same colour token as the row's window count — the muted rung of the text ramp, the role paths, counts and subtitles already take elsewhere in the picker — so it reads as a second-weight annotation on the name it follows, and the ragged edges do not register as misalignment. A right-anchored column would buy a scannable edge at the cost of a wide, arbitrary gap on every short-named row, and would make the two pieces read as separate columns rather than as one row about one session. This introduces no new colour token and no new convention; the selected row's own treatment one step brighter is the established pattern the sigil row reuses.

Where colour is off entirely the row is unchanged — the same single space, no bracket, glyph or separator introduced to stand in for the weight. The established carve-out asks that *state* never be carried by colour alone; a directory annotates the name rather than reporting state, and a path is legible as a path by its own separators.

The sibling `theming-system` specification fixes the token vocabulary at nineteen closed semantic roles and forbids raw colour at call sites. This section references an existing role rather than proposing a new one, so nothing in that vocabulary changes.

**When the row is too narrow for both, the directory gives way and the session name never does.** The directory is shortened **from the left**, so its tail survives — `…/Code/portal`, not `/Users/leeovery/Cod…` — because the tail is the segment a human recognises a checkout by, and the whole premise of showing it is that the directory is recognisable where the name is not. A path under the user's home is always displayed abbreviated to `~/`, at any width — the abbreviation is how the value is rendered rather than a rung of the truncation ladder, and it commonly reclaims enough width that no truncation is needed at all.

The row already flexes the name against a fixed count slot, a fixed attached slot and a right margin, and already truncates (`grep -n 'ansi.Truncate' internal/tui/session_item.go`); the directory takes whatever width remains after the name and the fixed slots, and applies the left-truncation above.

**Below a floor the directory is dropped rather than truncated to noise.** When the remaining width cannot hold an ellipsis plus one whole path segment, the row shows the session name alone — a row ending in `…l` says nothing and reads as damage, where a bare name at least reads as a name.

The rendering never narrows the search. A term is tested against the whole recorded directory in its home-abbreviated form (§4.1), which is fixed before any row is laid out, so a row can survive on a segment the width pushed out of view or the floor dropped altogether. What the column carries is the recognisable tail of the value that was matched, not a promise that the matched run itself is on screen.

#### 6.3 Scope

Scoped to the picker session a sigil opened — the term-less form of §2.5 included — across every grouping mode that list can be in (§6.1), and for as long as that picker is open. A hand edit of the filter text returns the matching rule to the picker's own (§4.4) but does not take the column with it: the rows can still be present on the strength of their directory, so the accounting is still owed. How Sessions rows render when the picker is reached any other way is untouched.

#### 6.4 Accepted cost

The row carries more text.

---

### 7. Cold-Path Classification

#### 7.1 The requirement

**A sigil invocation is classified as a picker invocation.** It takes the concurrent bootstrap and the honest loading page, and its soft bootstrap warnings take the in-TUI route rather than stderr.

#### 7.2 What the classification decides

On a cold boot — no tmux server running — Portal must start the server, register hooks, restore every saved session and replay its scrollback before it can list a single session. Which invocations get the loading page for that is decided from the command line before anything is resolved, and a pre-dash positional is classified as not-heading-for-the-picker, while post-dash words are not (`cmd/root.go`'s `isTUIPath` → `return len(preDashPositionals(cmd, args)) == 0 || len(searchFormPositionals(cmd, args)) > 0`, after a domain-pin veto).

The same verdict decides where soft bootstrap warnings go: on the non-picker classification they are written straight to the terminal the picker is about to take over with its alternate screen, which is the corruption the classification exists to prevent.

Without this section, `x /port` on a cold boot would give a blank terminal for the whole bootstrap and could spray a warning into the frame the picker is about to claim, while `x -f port` on the same boot showed the loading page throughout.

#### 7.3 Why the awkwardness is real

`/term` does not know whether it is heading for the picker — that depends on K (§3.2), and on a cold server there are no sessions to match until restore has finished. The classification is therefore taken on the form rather than on the outcome.

A brief loading page on the way to a direct attach costs a flicker. A silent multi-second blank terminal on every cold boot reads as a hang, and it is the first impression the feature makes after every reboot. The warnings argument points the same way — they need somewhere safe to land, and the picker path already has one.

#### 7.4 Accepted cost

When K turns out to be 1, the loading page appears and is replaced by the attach, so the user sees a brief screen they did not need.

#### 7.5 A sigil that resolves to a direct attach still delivers its warnings

On K = 1 the TUI tears down before the connector runs, so the notice band never surfaces. The accumulated soft warnings are written to the terminal at that point instead — after teardown, before the attach — which is where a warm-server sigil attach already puts them. The alternate screen is gone by then, so the corruption this classification prevents cannot occur.

#### 7.6 The concurrent path itself is unchanged

This section adds the sigil to the set of invocations that take the concurrent bootstrap, and the implementation added a second member alongside it: `portal open -- <command>`, which the pre-dash reading of `isTUIPath` no longer disqualifies. The concurrent bootstrap's own machinery is unchanged for the sigil, which the loading page gates as it gates every other member.

**The command-pending picker is the one member with no loading gate, and it holds its mint instead.** `WithCommand` forces `PageProjects`, so that member paints an actionable picker from frame one — for the `-- <command>` spelling admitted here as much as for the pre-existing `-e <command>` one. What protects it is not a gate in front of the picker but a hold behind it: **while the bootstrap is in flight, choosing a project stages the chosen directory rather than minting at it**, so no session is created against a half-restored server. The staged directory is replayed as a mint from the bootstrap's own terminal event, the notice band announces the wait in place of the pick-a-project banner while the hold stands, **the first stage wins** — a second choice made during the wait does not displace it — and a bootstrap fatal ends the run rather than minting.

---

### 8. Tab Completion

#### 8.1 Completion looks past the sigil

**`/po<TAB>` completes the term after — and excluding — the `/`, against live session names, leaving the sigil in place.** `/po` completing to `/portal-a1b2` normally leaves that session as the only match, which under §3.2 attaches outright, so `/po<TAB><Enter>` becomes the whole interaction; where a second session's name or recorded directory also contains the completed name, the same keystrokes land in the picker on those two.

Offered words carry the sigil — `/po` completes to `/portal-a1b2`, never to `portal-a1b2`, which would replace the whole word and drop the slash the user typed. The words offered are the searched set's session names the typed term prefixes: the shell discards any candidate that is not an extension of the word being completed, so completion is prefix-shaped even though the form itself matches by containment (§4.3). `/ort<TAB>` therefore offers nothing, while `/ort` still finds `portal-a1b2` on Enter.

**What is offered is the set the sigil can reach, not the whole live enumeration.** The searched set is the set the picker lists (§3.2), which omits the session the caller is attached to: inside tmux, that session is therefore never offered, because completing to it would produce a term landing on a picker filtered to zero rows. Outside tmux, and whenever the attached-session read fails or answers nothing, nothing is held back on that account — the same degrade-rather-than-drop rule the count follows, and the only one available here, since completion carries no channel for a failure.

`/<TAB>` — the sigil with nothing after it — offers every session in the searched set, since every name is prefixed by the empty term. Left as typed it opens the picker on an empty filter (§2.5); accepting a completion instead narrows the term to one session and attaches it, which is what makes completing the bare slash worth doing.

**Completion is bounded by the `--` separator, as recognition is (§2.3), and by nothing else.** A `/word` the separator leaves among the trailing command's own arguments is that command's argument, never a sigil, so it is answered with no candidates and the shell's own filename completion left on, rather than offered sigil candidates — offering one there would complete to a term the parser will not honour, and would suppress the filenames the user actually wanted in the same breath. One position is outside the bound and stays as it is: the word immediately after the separator is, at the flag layer the completer reads, indistinguishable from the next ordinary positional, so it keeps the sigil arm.

**Everywhere else a search form could be typed, one is offered — including on a line the composition rule (§5.1) refuses.** `open api /po<TAB>` offers `/portal-a1b2`, and so does a line already carrying `-f`, a domain pin, `-e` or `--ack`; pressing Enter on the assembled line is then refused by `validateSearchFormCollisions`, which judges the whole line rather than the word. Completion judges the word in front of the cursor and not the line around it: the word there genuinely *is* a search form, only its company is illegal, and the user may delete the other target before pressing Enter. The separator's reason does not reach these cases — past it the word is not a search form at all and offering sigil candidates costs the user their filenames, so that bound corrects two wrongs where this one would correct none.

Directories are deliberately excluded from what is *offered*, even though they count for *matching* (§4.1): a completed `/Users/leeovery/Code/portal` reads as a path and trips the no-second-slash rule (§2.2) straight back into path territory.

A live session name carrying a `/` is held back for the same reason — tmux permits one, and `ValidateSessionName` refuses only `:`, a leading `$` and a leading `-`. Completing `/foo` to `/foo/bar` would produce a word with a second slash, which §2.2 reads as a path, taking the user out of the search form they typed. Such a session stays reachable: a term stopping short of the slash matches it by containment like any other. It is only never offered.

Today the sigil form completes to nothing — the slash is part of the word being completed, no session name begins with one, and the shell's filename fallback is off (§2.2), so Tab is silently inert rather than misleading (`portal __complete open /po` → no candidates, `ShellCompDirectiveNoFileComp`).

#### 8.2 The `x` function's completion is registered one level too high

This is a pre-existing defect, not one this feature introduces, and it is **folded into this feature** rather than spun out.

**Cobra's emitted script asks the typed word for its completions**, not a registered command name (`portal init bash | grep -n 'requestComp='` → `requestComp="${words[0]} __complete ${args[*]}"`; zsh builds the same request from `${words[1]}`). The typed word is `x`, and `x` expands to `portal open` — so Tab after `x` runs `portal open __complete …`, a real `open` invocation carrying `__complete` as a positional target, and Portal's completer is never consulted.

Driving the emitted script with both functions stubbed to record what they are handed:

```
x    -> portal open __complete
x    -> portal open __complete -s
x    -> portal open __complete /tm
xctl -> portal __complete
```

That is why the pair differ despite carrying identical registrations (`portal init bash | grep -n '^complete '` → both take `complete -o default -F __start_portal`): `xctl` expands to bare `portal`, so its request resolves correctly. All three emitted shells share the mistake for the session-opening function.

Portal's completer answers correctly whenever it is actually asked:

| Probe | Result |
|---|---|
| `portal __complete open ""` | live session names — correct |
| `portal __complete open -s ""` | live session names — correct |

Nothing is wrong on that side. What is wrong is that the `x` path never reaches it — every Tab press there spends an `open` invocation against the live tmux server and returns no completion output, which is why the shell falls through to filenames. It has done so for as long as the function has existed.

#### 8.3 The correction

**`portal init` is corrected so that Tab after the session-opening function asks Portal for `open`'s completions**, reaching the completer that already answers `portal __complete open …` correctly — across bash, zsh and fish. `xctl` is untouched: its request already resolves to `portal __complete …`.

The correction changes **what command the emitted script asks for completions** when the typed word is the session-opening function. Registering the completer against a different name would not help, because the script does not consult a registered name (§8.2).

It applies to the **configured** function name, not the literal `x`: `portal init --cmd <name>` renames both emitted functions, and the correction must follow whatever name was chosen.

The correction brings the session-opening function onto `open`'s existing completion contract: live session names, and no filename fallback. Path arguments — `x ~/Code/pro<TAB>` — complete to filenames today only because Portal is never asked and the shell has nothing else to offer; once Portal answers, the shell switches that fallback off wherever it can honour the directive (§2.2), and it must, since a filename fallback on the same word is what would turn `x /tm<TAB>` into `/tmp/` and a search into a mint. The loss is taken deliberately, and it is the contract `portal open` has always had.

#### 8.4 Why it is folded in rather than spun out

This feature's deliverable is not a parsing rule, it is `x /term` becoming muscle memory. A completion decision that does not reach that form has not been delivered — without the fix, §8.1 is reachable only by typing `portal open /term` in full.

#### 8.5 Rollout consequence

The fix lands in the output of `portal init`, which users evaluate in their shell startup file. An existing install does not pick it up until the shell is restarted (or `portal init` is re-evaluated), even though the binary is new. This affects completion behaviour only — the `/term` form itself is parsed by Portal and works the moment the new binary is in place.

---

### 9. Documentation

#### 9.1 Why documentation is a deliverable here

After this feature the surface reaches a live session by a bare exact session name, a quoted bare glob, `-s <name>`, `-s <glob>`, and `/term`, and opens the picker pre-filtered by `-f <text>` and `/term`. None of them is a duplicate, but the closest pair reads like one when described by input shape.

`-f` documented as "open the picker pre-filtered" invites a reader to assume `/term` is shorthand for it. They differ exactly where it matters: with one match, `/term` attaches and `-f` shows a list of one. **The pair must be described by outcome — one always shows the list, one takes you there when there is only one place to go.**

The outcome carries a use with it, and the documentation says which to reach for: `-f` is the form for a script or a keybinding, which needs to land in the same place every time; `/term` is the interactive form.

This is wording work, not behaviour change.

#### 9.2 What the documentation must carry

- The sigil form and its recognition rule, including the single-segment absolute-directory cost and the `-p` escape (§2.2, §2.4).
- The three outcomes by match count (§3.2).
- The term-less form as §2.5 sets it, and that it is not an error.
- What the search matches, and that it matches by containment while the picker's own filter stays fuzzy (§4).
- That the form composes with nothing (§5.1).
- `-f` and `/term` distinguished by outcome rather than by input shape, and which of the two to reach for (§9.1).
- That the form completes against live session names after the slash (§8.1).
- That the corrected completion offers live session names after the session-opening function, and no longer falls through to filenames for a path argument (§8.3).
- That the corrected completion reaches an existing install only once the output of `portal init` is re-evaluated — a new shell, or re-running `portal init` (§8.3, §8.5).

**`portal open --help`** (`cmd/open.go`'s `Long`) carries the points about `open`'s own surface: the form and its recognition rule, the outcomes by match count, the term-less form, that it composes with nothing, and the `-f` / `/term` distinction. The `-f` flag description stays a one-liner — none of these fits there.

**The README's `x (open)` section** carries those same points and, additionally, the completion correction and its rollout consequence, which belong to `portal init` rather than to `open` and have nowhere to live in a command's help. The README's resolution table is where the sigil row belongs, alongside the domain pins and `-f` (`grep -n -- '-f, --filter' README.md` → the pin table row).

#### 9.3 CHANGELOG

No CHANGELOG entry is written as part of this work — the release process owns that file.

---

### 10. Out of Scope and Unchanged

Each entry below was reached as a decision, not left out by omission.

#### 10.1 The bare-positional resolution chain

**Unchanged.** Its ordering, its domains, and the sibling `cli-verb-surface-redesign` specification's Axiom 2 (no find-or-create) stand exactly as that specification set them. Project-prefix session matching stays rejected, on that specification's own grounds (§3.1).

The complaint that opened this work — that a bare argument walks branches whose order nobody remembers — was measured and does not hold as stated. A plain word can reach neither the path domain nor the glob branch (§2.2 for the path test; a glob needs one of `*?[`, `grep -n 'globMeta =' internal/resolver/glob.go`), so its live set is exact session name → alias → zoxide, and the last two both mint at a directory. The outcome of a bare word is invariant as long as no live session is named exactly that word.

The residual variation is accepted: which directory a bare word mints at is zoxide's frecency call, and a session renamed to exactly that word changes the word's outcome for as long as it lives. That is the exact-session branch working as specified, and the domain pins are the deliberate route to the other outcome.

A search branch on the bare positional — `x port` attaching when exactly one session matches — was considered and rejected. Under it the two sides of the cliff are *attach an existing session* and *mint a brand-new one*, which is the guess the sibling specification refused. The sigil avoids it by declaring its domain first (§3.1).

#### 10.2 A `+` mint sigil

**Not built.** "Add new" is already the bare form's behaviour. The only gap such a sigil could fill — forcing a mint when a live session is named exactly the term — is already covered by `-p`, `-a` and `-z`. A fourth mint route is the surface accretion this work set out not to cause.

#### 10.3 A configurable sigil

**Not built.** A keybinding and an argv token are different kinds of thing: a keystroke lives in one user's session, a command string is a shared artifact that goes into a README, a script, or a bug report. Under a configurable sigil `x /tmp` mints on one machine and filters on another, and neither user can read the other's command. It would also be the first Portal setting to change *parsing* rather than appearance — every field `prefs.json` carries today is UI state (`grep -n 'json:"' internal/prefs/store.go`).

#### 10.4 Session naming

**Unchanged.** `{project}-{nanoid}` stays exactly as it is, and no part of this feature touches session creation, the naming scheme, or renaming. The feature's own answer removes whatever pressure existed: searching directories as well as names means a session is found by the place it was opened in, with no need to recognise `portal-c3d4` at all.

Out of scope and not deferred — there is no open thread here to pick up later.

#### 10.5 The rest of the argument surface

**Nothing is retired, renamed or deprecated.** `-f`, all four domain pins, and the bare positional chain keep their current prominence, and the domain pins and the bare positional chain keep their current behaviour exactly. Two changes are owed to the existing surface: the widened match domain, which reaches `-f` and the filter typed by hand in the picker alike (§4.2), and how the `-f` / `/term` pair is described (§9.1).

#### 10.6 The picker reached any other way

**Unchanged** — its own filter as §4.4 sets it, its rows as §6.3 scopes them.

#### 10.7 Match-domain widening beyond name and directory

Project records and tags stay out (§4.1). Nothing in the source material asked for them, and each added field widens the false-positive set further for a case nobody has hit.

---

### 11. Relationship to `cli-verb-surface-redesign`

That specification's target-resolution section ran every bare positional through the precedence chain `exact session name → path → alias → zoxide query`, naming the path domain semantically as an existing directory. The leading `/` / `.` / `~` test that decides which arguments reach that domain lives in the code rather than in that document (§2.2). What §2.2 changes in the sibling's own terms is the chain: a single-segment leading-`/` argument is session-search text and never enters it at all.

That is a change to shipped behaviour the sibling specification described, and this specification is the superseding source for it. **The correction has been applied** — no further edit to that document is owed, and applying one again would duplicate it. Its precedence section now opens with a numbered search-sigil pre-check pointing here as the owner of the form, and its `## Corrigenda` section carries one dated entry naming this work unit:

`grep -n 'open-with-forced-filter' .workflows/cli-verb-surface-redesign/specification/cli-verb-surface-redesign/specification.md` → the pre-check step and the corrigendum entry.

Nothing else in that specification is contradicted. Axiom 2, the accepted consequence that bare project shorthand does not reattach, the rejection of project-prefix session matching, `-f` as a non-composing flag, and the tab-completion principle are all ratified rather than changed (§10.1, §3.1, §5.5, §8.1).

**The pinned-domain contract is adjacent rather than breached.** That contract holds that every domain pin hard-fails on an unresolvable target and never falls back to the TUI picker. The sigil is not a domain pin: reaching the picker is its purpose (§3.2) rather than a fallback from a failure, and it has no unresolvable case to fall back from — a term matching nothing is a filter result that opens the picker on an empty list (§3.2).

---

## Working Notes

---

## Corrigenda

> **Corrigendum 2026-09-14** (from `implementation/open-with-forced-filter`): §2.2's "Portal switches the shell's filename fallback off wherever it is asked for completions", restated as a requirement at §8.3 — corrected: the switch-off is the shell's, not Portal's, and bash can only perform it where `compopt` is a builtin (4.0 and later) and the `bash-completion` package is present. Measured against cobra v1.10.2's generator: `bash_completionsV2.go:132-138` gates `compopt +o default` on `type -t compopt`, and `:432-438` reaches `_get_comp_words_by_ref` from the bash-completion package before any completion runs. On macOS's stock `/bin/bash` 3.2 the standing `complete -o default` therefore supplies filenames — for `portal open /tm<TAB>`, which the original claim named as the safe case, as much as for `x /tm<TAB>`.

> **Corrigendum 2026-09-14** (from `implementation/open-with-forced-filter`): §7.6's "Nothing about how the concurrent bootstrap behaves changes. This section adds the sigil to the set of invocations that take it", and §7.2's quoted `isTUIPath` body — corrected: the implementation added two members to that set, not one. Phase 4's approved consolidation task (`eae96c47c`) re-read the classifier through `preDashPositionals`, which admits `portal open -- <command>` alongside the sigil; the quoted line no longer exists in the tree. The claim that the concurrent bootstrap's behaviour is unchanged holds for the sigil but not for the command-pending picker, which `WithCommand` (`internal/tui/model.go:508-514`) forces onto `PageProjects` — the one member of the set with no loading gate. That behaviour is a live defect rather than a documentation gap and is tracked as this phase's own consolidation finding.

> **Corrigendum 2026-09-14** (from `implementation/open-with-forced-filter`): §8.1's "The words offered are the live session names the typed term prefixes" and "`/<TAB>` — the sigil with nothing after it — offers every live session name" — corrected: the offered set is the searched set, which §3.2 defines as the set the picker lists and which omits the session the caller is attached to (`internal/tui/picker_sessions.go:13-23`). §8.1 stated the offered set as the whole live enumeration and never took that exclusion up; offering a name the search cannot reach completes to a term landing on a picker filtered to zero rows, with nothing on screen to account for it. Outside tmux, and whenever the attached-session read fails or answers nothing, nothing is held back on that account.

> **Corrigendum 2026-09-15** (from `implementation/open-with-forced-filter`): §7.6's "It is **not** unchanged for the command-pending picker … that member paints an actionable picker from frame one with no loading gate between the user and a half-bootstrapped server", and the 2026-09-14 corrigendum's restatement of it as "a live defect … tracked as this phase's own consolidation finding" — corrected: that defect is closed. Phase 7's approved consolidation task holds the mint rather than adding a gate: `createSession` (`internal/tui/model.go:1821-1843`) stages the chosen directory while `bootstrapInFlight()`, first stage winning; the `BootstrapCompleteMsg` arm (`internal/tui/model.go:1661-1670`) replays it through `mintSession` from the bootstrap's terminal event; `activeProjectNoticeBand` (`internal/tui/notice_band.go:35-37`, `:205-209`) displaces the pick-a-project banner with the wait message; and `BootstrapFatalMsg` (`internal/tui/model.go:1685`) quits a command-pending model outright. §7.6 now carries that behaviour as the requirement it had no owning text for.

> **Corrigendum 2026-09-15** (from `implementation/open-with-forced-filter`): §8.1 stated the sigil's completion rule with no `--` bound — the section names the offered set and its exclusions and never reaches the separator, which appears only in §2.3's recognition rule — corrected: completion is bounded by the separator too. `cmd/completion.go`'s sigil arm is gated on `completingPreDashPositional` (`cmd/open_search.go`, read from `cmd.ArgsLenAtDash()`), so a `/word` among a trailing command's own arguments is completed against session names like any other word. The code is right: §5.1 makes the sigil non-composing and §2.3 bounds recognition at the separator, so offering a sigil past it would complete to a term the parser will not honour. §8.1 now carries the bound, together with the one position outside it — the word immediately after the separator, which the completer cannot distinguish from the next ordinary positional at the flag layer it reads.

> **Corrigendum 2026-09-15** (from `implementation/open-with-forced-filter`): §8.1 stated the offered set unconditionally — "The words offered are the searched set's session names the typed term prefixes" — and bounded the sigil arm in exactly one place, the `--` separator, on the reason that "offering one there would complete to a term the parser will not honour". That reason reads as though it extends to every other line the composition rule (§5.1) refuses — a second target, `-f`, a domain pin, `-e`, `--ack` — which §8.1 never took up, so `open api /po<TAB>` offering `/portal-a1b2` on a line `validateSearchFormCollisions` then refuses looked like an oversight — corrected: the separator is the only bound, and the reason does not extend. Past the separator the word is not a search form at all and it is not Portal's to complete, so that bound corrects two wrongs; before it the word *is* a search form and only the surrounding line is illegal, which the user may fix by deleting the other target before pressing Enter. Completion completes the word in front of the cursor; `validateSearchFormCollisions` is what refuses an illegal line. §8.1 now carries both rules, and `completeOpenPositional` (`cmd/completion.go`) states the same in its doc comment.

> **Corrigendum 2026-09-15** (from `implementation/open-with-forced-filter`): §8.1's separator paragraph — "so it is completed against session names like any other word rather than offered sigil candidates" — and the 2026-09-15 corrigendum above it — "offering session names there also suppresses the filenames the user wanted" — corrected: the session-name arm carries `ShellCompDirectiveNoFileComp` (`cmd/completion.go`), so selecting it past the separator suppressed the very filenames both passages named as the cost worth avoiding, and `portal open ~/Code/api -- ls src/<TAB>` answered with silence. A post-separator word is now answered with no candidates and `cobra.ShellCompDirectiveDefault`, so the shell's own filename completion runs and the word Portal passes to the trailing command untouched is one Portal neither completes nor suppresses. The bound now preserves the filenames §8.1 twice names, and the "corrects two wrongs" conclusion holds as stated. Every pre-separator positional is unchanged, keeping the session-name arm and its suppression, as is the boundary word immediately after the separator.

> **Corrigendum 2026-09-16** (from `implementation/open-with-forced-filter`): §3.2's `>= 2` row, and §4.4's "The list the user is choosing from is the list they were handed", "with non-matching rows removed" and "never by rows the user expected going missing" — corrected: the narrowed list is a subset of the containment set, not the whole of it. The picker's filter is handed target strings, and `SessionItem.FilterValue()` joins the name to the home-abbreviated directory (`internal/tui/session_item.go:87-89`), a form that is not injective — so two distinct sessions can share one target. Phase 13's approved task (`2fe01e014`) settled the ambiguity by withholding every row behind a target whose sessions disagree about the term (`internal/tui/search_filter.go:82`, `:92-99`), on the direction the file's own contract and phase 12's criterion already fixed: omission is the sanctioned failure, surfacing a non-matching row is the forbidden one. K is counted per session at `cmd/open_search.go:186-194` and the list is decided per target, so the two can disagree. §4.4 now carries the carve-out and §3.2's row points at it.

> **Corrigendum 2026-09-16** (from `implementation/open-with-forced-filter`): §4.4's "Where the sessions behind one target disagree about the term, every row behind that target is withheld", which states the test over the sessions currently behind a target, and "A filter pass answering for a list generation the source has since rebuilt omits in the same direction" — corrected: the test is taken over every distinct field pair any generation of the list has produced for that target since the picker opened, and the stale-pass omission no longer happens. Phase 14's approved task made the filter's record cumulative (`internal/tui/search_filter.go:41-62`) rather than last-generation-wins, on the derivation that a bounded window reopens the hole for any pass older than it: a pass belonging to an earlier generation now ranks its own targets by containment (`internal/tui/search_filter_test.go:265-277`) and omits only on a collision. The retention carries one residual §4.4 had no owning text for — a collider that is killed or renamed keeps withholding the other session's row until the picker is relaunched (`internal/tui/search_filter_test.go:251-263`) — which §4.4 now records as the accepted cost, eviction being the alternative that would make the withholding blink off mid-run and reopen the stale-pass hazard.
