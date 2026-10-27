# Discussion: Lazy Resume On Attach

## Context

Portal restores every saved session on each reboot, and every restored pane fires its registered resume hook as part of coming back — whether or not the user ever looks at that pane. The firing is unconditional in the hydrate helper's exec chain: once scrollback replay finishes, `execShellOrHookAndExit` looks the pane's baked hook key up in `hooks.json` and, on a hit, execs `sh -c '<HOOK>; exec $SHELL'` (`cmd/state_hydrate.go:172-196`). There is no third state — a restored pane either runs its hook immediately or is a plain shell.

The cost is memory, and it scales with the saved-session count rather than with what the user is working on. Measured on the user's 64 GB M1 MacBook Pro on 2026-08-21 and recorded in the seed: 42 live Claude processes, 13.1 GB resident between them, averaging 318 MB each and peaking at 702 MB, with the pageout counter over a million — roughly a fifth of the machine committed to sessions the user was mostly not looking at. Every new piece of work adds a session that will be resumed on every subsequent reboot, indefinitely, regardless of whether it is still active work.

The feature holds the hook behind an in-pane confirmation prompt instead of firing it at boot. Everything else about restore is unchanged — skeleton, geometry and scrollback all replay as today, so the pane still reads as restored; what changes is that the live process behind it starts when the user says so.

### Inherited position

Discovery settled these with the user. They are this discussion's working ground, not questions to re-open unless something surfaced here contradicts them.

- **Resumption is explicit, not automatic-on-view.** The fork was put as automatic-on-first-view (a session is already coming back when you reach it, at the cost of resuming panes you only glanced at) against explicit-per-pane (nothing starts by accident, at the cost of a keystroke). The user chose explicit and went further than the fork offered, citing Zellij as the reference.
- **The mechanism is an in-pane prompt.** A modal or popover rendered inside the restored pane, stating what is about to be run, with Enter to approve and Escape to decline. This is a surface Portal has never had.
- **The prompt's copy is generic.** Portal's resume machinery is tool-agnostic and its messaging must stay so — the prompt states the command without naming Claude or any particular tool.
- **The prompt is sticky.** Ignoring it is a legitimate outcome. A pane whose prompt is left unanswered can be detached from and returned to later, with the prompt still waiting. The user's worked example, named as their ideal scenario: a window with three panes, one holding a resumable session and two holding other work — open the window, use the two panes needed, detach, come back later to resume the third if and when it is wanted. This makes surviving detach/reattach a first-class requirement rather than an edge case.
- **The behaviour is configurable.** An install can choose eager resumption (today's behaviour) or lazy prompting. The user framed the scope as "at the server level, at the user level"; the precise scope was not settled.
- **This is one feature, not an epic.** One deliverable, one user-facing behaviour change, one new surface. The trigger semantics, the decline path and the eager/lazy preference are decisions inside it.

### Carried forward undecided

- **What a decline means, as distinct from ignoring.** Ignoring keeps the prompt — the user was clear. Escape is a different act, and whether the pane is then finished for this boot or merely quiet until the next attach changes how the feature behaves in daily use. Deliberately not settled during shaping.

### Surfaces named as relevant

Named in the seed and carried forward rather than explored: the hydrate helper's exec chain (`portal state hydrate`), bootstrap step 6 and the restore engine's phase A/B split in `internal/restore/`, the `client-attached` and `client-session-changed` global hooks, and the eager signal-hydrate pass at bootstrap step 7.

### References

- [Seed: Fire resume hooks on attach, not on reboot](../seeds/2026-08-21-lazy-resume-on-attach.md) (inbox:idea, 2026-08-21)
- [Discovery session 001](../discovery/sessions/session-001.md)

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture. The Discussion Map lives in the manifest.*

---

## Decline Semantics

### Context

Discovery settled that ignoring the prompt keeps it waiting in perpetuity, and deliberately left open what Escape does as a distinct act. The answer changes what the feature is in daily use: whether declining is a "not now" the user can walk back, or a disposal.

Scale, measured on the user's install on 2026-09-17: 44 live tmux sessions, 43 of them holding a single pane and one holding two (`tmux list-panes -a -F '#{session_name}' | sort | uniq -c | awk '{print $1}' | sort -n | uniq -c` → `43 × 1 pane, 1 × 2 panes`), against 41 registered resume hooks (`portal hook list | wc -l` → `41`). So the working shape is one session, one pane, one resumable process — a reboot would present roughly 41 waiting prompts, almost all of them alone in their session.

### Options Considered

**Per-boot decline** — Escape gives a shell and the pane stops offering until the next reboot, when the prompt returns.
- Pros: "no" means no without destroying anything; the reboot is a natural re-decision point.
- Cons: the offer keeps coming back for work the user has already finished with, so the population never shrinks.

**Re-offer on next attach** — Escape gives a shell, but the prompt returns the next time the pane is attached.
- Pros: the offer is never lost.
- Cons: a pane you have declined keeps asking every time you visit it — a pane you cannot put down.

**Destructive decline** — Escape retires the resume permanently; the registration is removed and never comes back, on this boot or any future one.
- Pros: matches the intent — Escape is only ever pressed by someone who has decided this work is finished; gives the growing saved population a cull point.
- Cons: irreversible, behind one keystroke, over a user-authored command with no other copy.

### Journey

The session opened on a false premise: that decline's job is an escape hatch to a usable shell, for the case where you reach a waiting pane and want a terminal in that directory rather than the session. The user rejected the framing outright — a pane holding a resumable process is *for* that process, and if they wanted a plain shell they would open a new session rather than dismiss a prompt to borrow the pane. The pane is occupied and paused, waiting for a yes or a no, and nothing else.

That reframes decline entirely. It is not an escape hatch; it is a retirement. The user's words: "I've decided, actually, I don't need that session." Pressing Escape is an act of disposal, not deferral — which is exactly why it has to be distinguishable from ignoring, and why the re-offer options are wrong. An offer that comes back after you have declined it is treating a decision as a hesitation.

The user drew an equivalence to killing the tmux session outright, which was read too literally — as a proposal that Escape retire the whole session, dropping it from the saved set so it never restores again. That reading was put back to the user as a fork, on the argument that it would turn each reboot into a cull and answer the other half of the seed's complaint: that the saved population only ever grows. It was a false path. The user's phrase meant only that a dismissed resume is irrecoverable, not that the session goes with it. Killing a session stays a separate, deliberate act.

The rejected option is worth keeping on the record because it is the tempting one: it solves the accumulation problem the seed names, and 43 of the 44 live sessions hold a single pane, so the multi-pane hazard that argues against it is rare. It is rejected on intent rather than on that hazard — declining a resume and disposing of a session are two different decisions, and binding them to one keystroke removes the user's ability to make only the first.

**The key binding was then revisited and reversed.** A background review put the destruction's cost against its ceremony: one unmodified keystroke, no confirmation, over a user-authored command with no other copy anywhere. The scenario it was argued from — a user walking dozens of panes pressing the discard key on the ones they are finished with — turned out not to be how the user would ever work; culling a batch of finished sessions happens in the picker, by marking them and killing them, not pane by pane. But the underlying objection survived the scenario that carried it.

The decisive argument was the user's, and it is about consistency rather than danger. Everywhere else in Portal, Escape means *back out* — it reverses, it never acts. Binding it here to an irreversible deletion would make it the one place in the product where the reflex key destroys something. Assuming the positive instead — Enter resumes, a named key discards, a confirmation in front of the discard — restores that meaning everywhere, and leaves Escape on the resume panel with nothing to do, because there is nowhere to back out to. An inert Escape reads as cleaner than a dangerous one.

### Decision

**Discarding removes the pane's resume registration, permanently, and nothing else.** The entry is cleaned out of the store rather than suppressed for the boot, so the prompt does not return on this boot, on the next attach, or after any future reboot. The pane falls through to a plain shell with its replayed scrollback still above it. The tmux session is untouched: it stays live, stays saved, and restores on the next reboot as an ordinary hookless pane — bare shell, scrollback intact, no prompt. Killing it is a separate act the user takes when they want it.

**Escape is not the key that does it.** The discard is bound to its own deliberate key, and confirmed before it lands.

- **Enter resumes.** The positive outcome is the assumed one and takes the most reflexive key.
- **A named key discards**, opening a second confirmation over the first — *this is permanent* — where **`y`** agrees and Escape backs out to the resume panel. *(Amended 2026-09-18 — this had Enter agreeing. Enter resumes on the panel one keystroke earlier, so confirming the discard with it makes the same key mean "bring it back" and "delete it forever" on consecutive screens; a user who presses `d` and then confirms the way they just did has thrown the registration away. Portal's two existing destructive confirmations — killing a session, deleting a project — both take `y` with `esc` to cancel, through one shared builder (`internal/tui/kill_modal.go:13`, `delete_modal.go:12`, `destructive_confirm.go:16`). The panel is modelled on those modals and the discard key `d` was itself derived from the picker's grammar; the confirm key was the one place that grammar was not carried across.)*
- **Escape on the resume panel does nothing at all.** There is nowhere to back out to, so it is inert.

That last property is the point rather than a side effect: it makes Escape mean exactly one thing everywhere in Portal — *back out, change nothing* — with no site where it also destroys something. A key the user's hands press without consulting them can then never be the key that loses work.

The discard key is **`d`**, derived from the picker's existing split rather than chosen fresh: `k` kills a live thing (a session), `d` deletes a persisted record (a project). Nothing is killed here — the session and the pane both survive — and what goes is a stored registration, which is `d`'s side of that line.

**What the discard destroys is recorded.** The removed command is written to the log as it goes. Portal already destroys these entries two ways and treats them differently: the typed removal command records only which entry went, while the automatic stale sweep deliberately records the command itself, its own source comment calling that the recoverable form an operator copies back out of the log (`internal/hooks/store.go:371-373` against `:221`). This path is the sweep's situation rather than the typed command's — it is reached by a keystroke on a panel the user is walking through, not by naming a key on a command line — so it takes the sweep's treatment. The confirmation makes the act deliberate; the log line makes it recoverable anyway, and costs nothing.

There is no "parent process" to fall back to, which the user was unsure about: the pane's only process during restore is Portal's hydrate helper, and it replaces itself with either the hook or the user's shell (`cmd/state_hydrate.go:153-196`). Declining means it takes the shell branch — exactly what a restored pane with no registered hook does today, so a declined pane is indistinguishable from one that never had a hook.

This makes the in-pane `d`, once confirmed, a third removal route alongside the existing `portal hook rm` and a hand edit of the store — reached from where the user already is, instead of by remembering a CLI verb. *(Amended 2026-09-18 — this named Escape as the route; the reversal below rebound the discard to `d` behind a confirmation and left Escape inert.)*

Sibling check: `resume-hooks-silently-lost` — its specification (2026-09-10) owns hook removal, defining the `hook rm` CLI, the rule that removing nothing always exits non-zero, and that a removal never unstamps the pane's durable token. This decision adds a route beside that CLI and contradicts none of those rules; because the key it removes is always a token baked from saved state, it also never touches the old-format entries that specification retains permanently.

Confidence: high.

---

## Waiting Pane Capture

### Context

The feature's premise is that a restored pane still reads as restored before its hook fires — skeleton, geometry and scrollback replay exactly as today, so the pane shows the work the user left there. That holds on the restore side. Nothing held it on the save side, and a background review found the hole.

Portal's saver re-reads every live pane on each tick and rewrites that pane's saved scrollback whenever the capture hashes differently from the last write (`cmd/state_daemon.go:263-290` — `CaptureAndHashPane` then `WriteScrollbackIfChanged`, which is a dedup, not a protection). A pane parked on a full-screen prompt therefore gets captured *as that prompt*, with no history behind it, within one tick of the prompt appearing.

The suppression mechanism already exists and is already used for precisely this hazard: restore stamps each skeleton-restored pane with a marker, and the daemon's capture loop skips any pane carrying one (`cmd/state_daemon.go:244`, `271-273`). But the hydrate helper clears that marker the moment scrollback replay finishes and before it hands off — replay, settle sleep, unset, exec (`cmd/state_hydrate.go:139-148`). Under lazy resume that unset lands at exactly the moment the prompt goes up.

Verified against the tree on 2026-09-17: the skip is scoped to the scrollback write alone. The pane is still enumerated into `sessions.json` by `CaptureStructure` and only its `.bin` rewrite is skipped, so freezing a pane does not drop it from the saved set.

### Journey

The compounding case is what makes this more than a lost file. The saved content becomes a picture of the prompt; the next reboot replays that picture and then draws a real prompt on top of it. The user comes back to a pane showing a dead screenshot of a question with a live copy of the same question over it — and the work they were returning for is gone with no copy anywhere.

No competing option was worth writing up. The user's response on seeing it: there is only one answer here.

### Decision

#### 2026-09-18 — revised

*Trigger: the capture measurement this block rested on was re-run with the saver's own invocation and did not hold. Over a pane holding the alternate screen open, `tmux capture-pane -e -p -S -` returned `T-01…T-20` and the card for a pane carrying `T-01…T-40` — the visible screenful is absent, and `capture-pane -a -p` returned exactly `T-21…T-40`. The capture is not the transcript plus the card; it is the transcript minus its last screenful, plus the card.*

**The pane stays frozen for as long as its resume is unanswered.** The marker that already tells the saver to leave a pane alone is held through the waiting state instead of being cleared at the end of scrollback replay, and is cleared when the user answers — on Enter before the hook runs, and on a confirmed discard before the pane falls through to a shell.

The cost is nil in practice: a pane waiting on a resume has no new content worth saving, so freezing it at its last live state is exactly the desired end state. A waiting pane keeps its place in the saved set throughout, so it restores normally on every subsequent reboot — with its original content and a fresh prompt, however many reboots it waits through.

**The freeze is load-bearing, and what it prevents is lost work rather than clutter.**

The settled panel is painted into the pane's **alternate screen**, and the saver reads a pane with `capture-pane -e -p -S -` (`internal/tmux/tmux.go:752`). Measured against that exact invocation on tmux 3.7c, with a live process holding the alternate screen open over a pane carrying 40 lines of prior output: the capture returns **only the lines that had already scrolled out of view, then the card** — the most recent screenful of real output is absent. Those lines are still in the buffer `capture-pane -a -p` reads, which the saver never calls.

So an unfrozen waiting pane hashes differently from its last write and the saver rewrites its saved file as *transcript-minus-its-last-screenful, plus a picture of the card*. Once, not per tick — identical captures dedup. The lost screenful is the part the user was last reading and the part a resumed session continues from, and there is no copy of it anywhere: the next reboot replays the truncated file, so the work is gone and a dead card image sits in the history where it was, with a live card drawn over that.

The decision stands unchanged and its margin is wider than the earlier reading gave it. The one-tick gap between the two markers is not a tidiness problem — it costs the user a screenful of their own transcript every time it is hit. That raises how durably the freeze is held.

#### Initial

**The pane stays frozen for as long as its resume is unanswered.** The marker that already tells the saver to leave a pane alone is held through the waiting state instead of being cleared at the end of scrollback replay, and is cleared when the user answers — on Enter before the hook runs, and on a confirmed discard before the pane falls through to a shell. *(Amended 2026-09-18 — this said "on Escape"; the decline decision rebound the discard to `d` behind a confirmation.)*

The cost is nil in practice: a pane waiting on a resume has no new content worth saving, so freezing it at its last live state is exactly the desired end state. A waiting pane keeps its place in the saved set throughout, so it restores normally on every subsequent reboot — with its original content and a fresh prompt, however many reboots it waits through.

**The freeze is load-bearing, not insurance.** *(Amended 2026-09-18 — this paragraph argued the freeze was optional: that under a tmux-drawn overlay, which never enters a pane's buffer, a waiting pane's content would be byte-identical to what was already saved and the saver's content-hash dedup would decline the write on its own. That surface was then rejected — a tmux overlay captures the whole client's keyboard, and tmux has no pane-scoped one.)*

The settled panel is painted into the pane's **alternate screen**, and the saver reads a pane with `capture-pane -e -p -S -` (`internal/tmux/tmux.go:752`). Measured against that exact invocation on tmux 3.7c, with a live process holding the alternate screen open over a pane carrying 40 lines of prior output: the capture returns the **primary buffer's history with the alternate screen appended at the tail** — the real transcript, then the card's lines. (An earlier reading here used a bare `capture-pane -p`, which returns the visible screen alone; that is why the card looked like a wholesale replacement rather than an addition.)

So an unfrozen waiting pane hashes differently from its last write and the saver rewrites its saved file as *transcript plus a picture of the card*. Once, not per tick — identical captures dedup. The transcript is not lost, which is milder than a replacement, but it is not recoverable either: the next reboot replays that file, so the dead card image returns as part of the pane's history and a live card is drawn over it. A pane waited on across three reboots accretes three dead cards into a transcript that can never shed them.

The decision stands unchanged, and the freeze is load-bearing rather than insurance: without it a waiting pane's saved history silently accretes junk for as long as it waits. That raises how durably the freeze is held.

### The freeze is held by the pane, not by the pane's position

The marker that suppresses capture today is addressed positionally — session name plus window and pane index. The saver recomputes that address for every live pane each tick and skips only on an exact match (`cmd/state_daemon.go:263-273`), and bootstrap's stale-marker sweep unsets any marker no live positional address answers to, enumerating through the same positional format (`cmd/bootstrap/stale_marker_cleanup.go`). All three components of that address move: closing an earlier window renumbers, `break-pane` and `move-pane` relocate, and a rename changes the session half.

Today that exposure is the few seconds between skeleton restore and handover, which is why it has never mattered. This feature stretches it to the whole waiting life. A pane waited on for a week, whose session is renamed or whose sibling window is closed, loses its protection the moment the address stops matching: the saver recomputes it every tick and the capture lands. Nothing announces it, and the marker itself is then swept away as stale on the next bootstrap that actually runs — a cold server or a version change, rather than every `portal open`, which takes the warm latch's short-circuit and runs no orchestrator at all (`cmd/root.go:108-118`). This is the failure `resume-hooks-silently-lost` already fixed once for hook keys, reappearing on a different marker.

**The saver's skip gains a second condition rather than changing its first.** A pane is left alone when it is mid-restore — the existing positional marker, whose other jobs are unchanged — **or** when it is waiting, read from the pane-scoped pending marker decided in Pending Visibility. That marker travels with the pane through every rearrangement tmux can perform, measured in `resume-hooks-silently-lost` against `break-pane`, `move-pane`, a window close under `renumber-windows`, `respawn-pane -k` and a session rename.

Two consequences follow and are part of the decision:

- **The pending marker is set before the mid-restore marker is cleared.** A gap where neither is set is a one-tick window in which the saver writes the card into the pane's saved history — the whole failure, in the space between two steps.
- **The saver reads it for free.** It already enumerates every pane on the server each tick with a per-pane format to build its structural index, and that format already carries the pane's durable token as a column. The pending marker joins it as another column rather than costing a second tmux call. The arity of that read changes, which is the same contained move the pane token made.

The inverse failure — a marker wrongly left set, freezing a pane's saved content forever — is structurally hard to reach: the marker lives on the pane, the waiting program is the pane's only process, and it dies with the pane. There is no state in which the pane survives while the marker is wrong.

Sibling check: `built-in-session-resurrection` — its specification records the marker lifecycle as "Helper unsets marker after dump + 100ms sleep", which is true of the code as it stands and is what this feature changes. No corrigendum is owed: that text is not a claim that has gone wrong, it is current behaviour this work supersedes, and the same reading applies to that specification's rejection of a Zellij-style confirmation prompt — a decision superseded by new product intent rather than a factual error.

(resolves review-001 F1)

---

## Prompt Surface

### Context

Discovery settled that the restored pane carries an in-pane prompt stating what is about to be run, Enter to approve and Escape to decline, and that it is sticky — ignoring it is legitimate and it must still be waiting after a detach and reattach. What renders it was open, and the answer turned out to decide the feature's memory cost as well as its looks.

### Options Considered

**A resident process per waiting pane** — something sits in each pane drawing the prompt and listening for the keypress.
- Pros: full control of the rendering; redraws itself on resize.
- Cons: reinstates the cost the feature exists to remove — priced at the time against the running daemon (`ps -o rss= -p $(pgrep -f '^portal state daemon')` → `17744` KB on 2026-09-17, `22496` KB on 2026-09-18), roughly 700 MB across a full waiting set of 41. That pricing was later shown to be wrong for a *waiting* process: the daemon's figure is the cost of doing work, not of existing (see Waiting Pane Mechanism's measured floor).

**A box painted into the pane, which then goes dead** — the helper draws the prompt as ordinary terminal output and exits; tmux holds the pane open showing it.
- Pros: zero processes; fully designed rendering; durable by construction — the picture is the pane's content, so it survives anything.
- Cons: it is a painting, not a widget. No process remains to re-centre it, so a resize leaves it off-centre or clipped unless a resize hook repaints it. And because it *is* pane content, the saver would capture it — the hazard the waiting-pane-capture section was written against.

**A tmux-drawn overlay, rendered on demand** — nothing is held in the pane at all; the prompt is drawn by tmux when the user lands on a pane that has an unfired resume, and is gone again when they leave.
- Pros: zero processes and nothing painted; tmux owns the drawing, so it is centred, styled from the theme, and re-centres on resize for free; it never enters the pane's buffer, so the saver cannot capture it; Enter and Escape are the overlay's own selections, so no key bindings are touched anywhere.
- Cons: the overlay belongs to the attached client, so it cannot itself be the durable thing — persistence has to come from state the overlay is rendered *from*, and something has to decide when to render it.

### Journey

The first two options were reached by asking what could hold a prompt in a pane, and both answered that question at a cost — one in memory, one in fidelity. The session went a long way down the second, including verifying that a fully styled box (rounded borders, colour, bold heading, dim command text, coloured key hints) survives in a dead pane with no process, and that a dead pane can be repainted in place.

The user then asked the question that dissolved it: does anything need to be displayed at all while the pane is not being looked at? A pane nobody is watching does not need to be holding a picture. What has to survive is the *fact* that a resume is pending — and that fact is already durable, because it is exactly the unfired hook entry. The prompt is a rendering of that fact, not a thing that has to persist.

That reframing turns stickiness from a constraint into a consequence. Ignoring the prompt changes no state, so the next time the pane is looked at, the same state renders the same prompt. Detaching, closing the window, rebooting — none of them are dismissals, so none of them clear anything. Only Enter and Escape change the state, which is precisely the rule the decline-semantics section already settled.

The tmux facility is `display-menu` — the same one behind the user's own Alt-M menu. Its sibling `display-popup` was rejected on sight: a popup runs a command in a floating mini-terminal, which puts a resident process back in the pane and undoes the whole gain.

Two properties were measured on tmux 3.7c before the call was made, both on a disposable `-S` socket:

- **The overlay is client-scoped, not pane-scoped.** Displayed with a client attached, it renders centred and styled over the pane; after a detach and reattach, the pane content is back and the menu is gone. Invoked with no client attached at all, tmux answers `no current client`. This is why the overlay cannot be the durable artifact.
- **The overlay never enters the pane's buffer.** With a menu displayed over a pane, the client's screen shows the menu over the content while `capture-pane -p` on that pane returns the content alone. The saver would therefore record the pane's real scrollback throughout.

### Decision

**The panel is drawn by Portal into the pane's own alternate screen, by a program that stays there until the user answers.** Nothing floats above the pane and nothing tmux draws is involved.

*(Amended 2026-09-18 — this section's decision was first written as "a tmux-drawn overlay rendered on demand, not an artifact held in the pane", with the durable thing being the pending resume and the prompt merely its rendering. The reframing behind it survives and is what made the rest of the design possible; the mechanism does not. The paragraphs below record why in the order they were established, and Waiting Pane Mechanism settles what holds the panel.)*

The reframing that got here is worth keeping separately from the mechanism it first suggested: what has to survive is the *fact* that a resume is pending, not a picture. That fact is already durable — it is the unfired registration — so stickiness is a consequence rather than something to engineer, and only Enter and the discard key change it.

**The overlay is a near-full-pane bordered panel, not a small centred menu.** It is inset a little from the pane's edges, carries a border and a title, is styled from the Portal theme the user has chosen, and has room along its edges for metadata about what is being offered — the shape of Portal's own scrollback preview rather than a list of choices. The user's framing: "a floating overlay that's sort of slightly indented, but basically full screen… it has a border, a bit like the quick preview in Portal."

That rules out `display-menu`, which renders a list of items sized to its contents and admits no arbitrary body. It initially selected `display-popup`, which takes explicit dimensions, a border style, a title and a body of Portal's own drawing, and which produced exactly the described panel when rendered on a disposable socket over a pane carrying unrelated content.

**The popup was then rejected outright: a tmux overlay captures the whole client's keyboard.** The user set a hard constraint — a waiting pane must never block the panes beside it — and the popup violates it. Measured on tmux 3.7c: with a two-pane window, the *right* pane selected as the active pane, and a popup opened over the *left* pane, keystrokes sent from the attached client were delivered to the popup and never reached the focused right pane at all. The intuition that panes are independent is correct and does not apply, because a popup is not a pane; tmux's own description is "a rectangular box drawn over the top of any panes", and it intercepts the client's input ahead of pane routing. `display-menu` is the same kind of object.

**There is no pane-scoped overlay facility in tmux.** Both of its overlay primitives are client-scoped by construction, and nothing else in the command set draws over a pane — the remaining candidates put text in the pane's own content (`remain-on-exit-format`, pane borders) or in the status line. An overlay that floats above one pane while the others stay live is not something tmux offers.

The user's own observation is what resolves it: Portal's rename modal — the reference for this panel — was never a tmux overlay either. It is Portal drawing with Lipgloss into a surface it owns. The painted panel is closer to how Portal already works than the popup ever was.

**Panes with no pending resume are untouched.** In the user's worked example — one window, a left pane that held a resumable session and a right pane that held a bare shell — the right pane restores exactly as it does today, its scrollback in place, and goes on capturing normally. Work done in it during one attachment shows up in its scrollback on the next, unchanged by this feature.

**The panel is a full-pane canvas with a small card centred on it, not a large box with text adrift in it.** The overlay fills the pane, painted in the active Portal theme so nothing behind it shows through, and the decision itself sits in a compact bordered card in the middle — the shape of Portal's existing rename modal: a header row carrying the title and a state badge, a body, and a footer row of key hints. A box stretched to near-full size with a few lines in the middle "might look quite lost on a big terminal window"; the canvas-plus-card shape is what Portal already uses everywhere else for exactly this reason.

The reuse is at the presentation layer, not the code path: the picker's modals are Bubble Tea components rendering into its own model, while this panel is drawn straight into a pane by the program that then waits there. What carries across is the theme tokens and the modal's visual grammar, which is what makes it read as Portal rather than as a tmux dialog.

**The panel is painted into the pane's alternate screen, so it never enters the scrollback.** The user's one hesitation about painting was that the panel is not user content — it is a hold placed on the session, never asked for — and once it is gone it should leave no trace in the history. The alternate screen is exactly that facility: the buffer `vim` and `less` draw on, which is not added to a pane's scrollback ring.

Measured on tmux 3.7c, on the dead-pane variant that was live when the property was first checked: a pane printed two lines of real content, entered the alternate screen, painted a card, and exited without leaving it. The pane held the card with `alternate_on` set; `capture-pane -p` returned the card, while `capture-pane -a -p` returned the two original lines, intact underneath. The alternate screen's isolation is the property being measured and does not depend on whether a process remains — re-measured against the settled shape, with a **live** process holding the alternate screen open, the same isolation holds (see the capture measurement in Waiting Pane Capture). The panel is therefore visible without ever being part of the pane's history, and the genuine scrollback is preserved beneath it the whole time it waits.

Nothing blocks: the panel is the pane's own content and the program holding it reads only the keys sent to that pane. Panes beside it are fully live throughout, which is the constraint that eliminated every floating alternative.

**Answering hands the pane over in place; nothing is wiped and nothing is re-laid.** *(Amended 2026-09-18 — this paragraph described answering as clearing the pane and re-dumping the scrollback, and attributed the capture freeze's purpose to keeping the saved file available for that re-dump. That was the dead-pane design, which the waiting-pane-mechanism decision rejected: a pane revived by `respawn-pane -k` does lose its history, but the settled design never respawns.)* The replayed transcript is already in the pane's primary buffer, underneath the alternate screen the panel is drawn on, so leaving the alternate screen reveals it and the resume command starts over it. The freeze's purpose is what the waiting-pane-capture section states, not this.

Confidence: high on the surface itself. *(Amended 2026-09-18 — this left the repaint on resize open, which it was while the painted-then-dead pane was the live design: a picture with no process behind it cannot re-centre itself. The waiting-program decision settled it — a resize is the same handover run backwards, the waiter replacing itself with a fresh draw at the new width and handing back to a fresh wait.)*

---

## Pending Pane State

### Context

A pane whose resume has not fired still restores its saved scrollback — which, for the case that motivated this work, is a photograph of a session that is no longer running. Whether that content should be replayed at all behind the waiting prompt was put as a fork: replay it as today, or suppress it for panes with a pending resume so the pane is clean underneath.

### Journey

The case for suppressing rested on a claim that the replayed content is *deceptive*: it looks live and is not, and for a tool that redraws its own history on resume it is redundant as well.

The user rejected the framing and the argument moved the call. A scrollback ending in an exited session is not a lie — it is an accurate record of what happened, and it is exactly what the pane would show if the session had been quit by hand. The visible end of the transcript says plainly that the thing is gone. There is nothing to be protected from.

The second argument was decisive on scope: restoring a pane's content and resuming its process are two separate concerns, and making the first conditional on the second buys a small presentational gain at the cost of a conditional in the middle of the restore path. The user also noted that the resume is not the only route back — the tool's own resume picker is always available — so a pane that keeps its history is strictly more useful than one that does not.

The presentational worry that prompted the fork is answered by the surface rather than by the restore path: the panel's canvas covers the pane while the decision is pending, so the old transcript is hidden until the user has chosen, and revealed only once they have declined and know what they are looking at.

### Decision

**Scrollback replays exactly as it does today, for every restored pane, whether or not a resume is pending.** Nothing in the restore path branches on whether a pane has an unfired hook. A declined pane is left showing its genuine history above a bare shell — the same end state as quitting the session by hand.

---

## Waiting Pane Mechanism

### Context

Two designs for what a pane *is* while its resume waits, indistinguishable to the user and close on merit:

- **A waiting program.** The helper restore already puts in each pane does not finish. It lays down the scrollback, paints the card, and blocks on a keypress. Enter drops the card and hands the pane to the resume command in place — no restart, nothing re-laid.
- **A dead pane.** The helper paints the card and exits. tmux holds the pane open with no process in it. Enter and Escape are tmux key bindings that restart the pane with the right payload.

### Options Considered

**A waiting program**
- Pros: an insert at a branch that already exists — the helper's hook lookup already forks on hook-present, and the wait goes between that fork and the existing handover. Restore stays ignorant of hooks. No tmux state to unwind. Live rendering, so a resize repaints itself. Failure modes are a process's: killable, interruptible, and it leaves the pane in a defined state. Testable in the fast lane, beside the helper's existing nine unit-test files and its handover injection seam.
- Cons: a resident process per waiting pane, whose cost scales with the saved set — the very quantity the seed says only grows. Measured floor: a minimal Go binary blocked on a read is 1.7 MB resident, so the real helper is several MB, a few hundred across a population of 41.

**A dead pane**
- Pros: no cost curve at all — the pending state is tmux's, not a process's. Nothing to OOM or kill. Inspectable: `portal doctor` could ask tmux which panes are pending. A better substrate for the agent-aware direction than "a process is blocked in there".
- Cons: eight or nine distinct pieces against one, three of them tmux state with a lifecycle to unwind on every exit path — including a pane closed or a session killed mid-wait. The helper's flow must reorder (it dumps before it looks up today). The resize repaint becomes required machinery, because a dead pane cannot redraw itself. And a dead pane is a state the user has no intuition for: if its bindings fail, the prompt is visible and no key does anything.

### Journey

From first principles the dead pane looked like the better design, and the reasoning stood on the feature's own thesis: a cost proportional to a set that only grows is the shape of problem this work exists to remove. At 41 sessions a waiting program is a few hundred MB; at 200 it is a gigabyte, and 200 is where the seed says this is heading. The user reached the same place independently — "the right engineering design here is zero load + memory."

Its containment was worked through and looked tractable. One module owning the pending state as a single concept, arming and disarming three tmux settings together and never independently; an idempotent disarm, so every plausible cleanup site can call it without first checking, which removes the need to enumerate exit paths; and a bootstrap sweep as the backstop, which is the idiom the codebase already uses for stale skeleton markers and orphan FIFOs. The leak window is further bounded by tmux itself: `remain-on-exit` and key bindings are server state, so a reboot clears them and the exposure is one server lifetime.

**Then the key interception was measured, and it does not scope to a pane.** `key-table` is a session option, not a pane option. tmux accepts `set-option -p -t <pane> key-table <name>` without complaint and resolves it upward: set on one pane of a two-pane session, it reads back set on the session *and on the sibling pane that was never named*. Verified on tmux 3.7c — before the write, all three scopes report the option unset; after it, all three report `portal-wait`. And a custom key table swallows every key, not only its bound ones: with the table active, `Enter` fired the binding and the word typed after it never reached the pane's process at all.

So arming one waiting pane's keys arms every pane in its session, and locks them. In the worked example — left pane waiting, right pane a shell the user wants to work in — the right pane's keyboard would be dead exactly as it was under the rejected popup, and for the same reason: the interception is not pane-scoped.

That is the hard constraint the user set, and it is the constraint that already eliminated the tmux overlay.

One route survives for the dead pane, and it is worse. Bind `Enter` and `Escape` in tmux's **root** table globally, each wrapped in a conditional that fires Portal's command when the focused pane is waiting and passes the key through otherwise. It satisfies the letter of the constraint, at the price of Portal permanently rebinding two keys across the user's entire tmux server, with a conditional evaluated on every press — `Escape` most of all, which every modal program on the machine depends on. That is not a trade worth making for a memory curve.

### Decision

**A waiting program in the pane.** The dead pane cannot intercept its own keys without locking its sibling panes or globally rebinding two keys for the whole server, and neither is acceptable. A process in a pane reads the keys sent to it and nothing else — the scoping the design needs is a property of processes, not something tmux has to provide.

The choice was forced rather than preferred, and the reasoning that favoured the dead pane still stands on its own terms; it simply rests on a capability tmux does not have at pane granularity.

**The resident cost is the runtime floor, not the binary.** Go pages in lazily, so linking a library costs disk rather than memory. Measured on this machine: a Go binary linking the rendering library and never touching it, blocked on a read, is **1680 KB** resident — indistinguishable from one importing nothing at all at 1696 KB, and 4.8 MB on disk. The 22 MB the daemon carries is the cost of doing work, not of existing.

So no separate binary is warranted: the waiter is the same Portal binary entered on a path that does almost nothing. Roughly 2 MB per waiting pane, some 80 MB across a population of 41, against the 13.1 GB the seed measured.

**The process that draws must hand off to a fresh one before waiting.** Drawing touches the theme and the rendering path, and those pages stay resident for that process's life. Drawing and then blocking in the same process would carry all of it for as long as the pane waits. Drawing and then replacing the process image with a minimal wait puts the resting state back at the floor — the helper already ends in exactly that kind of handover, so this is the shape the code is already built around, not a new one.

A resize is the same handover run backwards: the waiter replaces itself with a fresh draw, which draws at the new width and hands back to a fresh wait. The resting state stays at the floor and the cost is paid only at the moment of the resize.

**Enter and `d` act; every other key is swallowed, signals included.** *(Amended 2026-09-18 — this read "Enter and Escape act"; the decline decision rebound the discard to `d` and made Escape inert on this panel. Escape is live only inside the confirmation `d` opens, where it backs out.)* The waiter is the pane's only process, so anything that kills it takes the pane with it — Ctrl-C, Ctrl-D, Ctrl-Z. It must refuse to die rather than exit. The rule that falls out is a safety property as much as a mechanism: a stray paste, an errant `send-keys`, or a key pressed in the wrong window cannot answer the prompt, because nothing but those keys means anything to it.

**The command is read at the moment the user answers, not carried from when the panel was drawn.** The waiting program has to look the registration up before it draws, to know whether to draw at all — but it reads it again when Enter is pressed, and runs what the store holds then.

**Settled by derivation** (2026-09-18) — not discussed. Determined by how long the gap now is: a pane can wait for days, and in that time the entry can be removed by `portal hook rm --pane-key`, rewritten by a re-registration, or hand-edited. Acting on a value read days earlier would resume something the user had already deregistered — the one case where the two readings differ, and the one where the stale reading is plainly wrong. Re-reading costs a single file read at a moment that is already doing far more, and an entry that has gone drops the pane through to a shell exactly as an unregistered pane does, which is a path the helper already has.

**That refusal covers what a person at the keyboard can send, and stops there.** When tmux tears the pane down — the user kills the session, closes the window, or the server shuts down — the waiter exits. It does not decline the hangup, and a closed terminal ends it.

**Settled by derivation** (2026-09-18) — not discussed. Determined by the feature's own purpose: the rule as first written was unbounded, and a waiter that declines every signal outlives the destruction of its own pane, so culling fifteen finished sessions from the picker would leave fifteen Portal processes running with nothing to attach to — the resident cost this work exists to remove, reinstated on the cleanup path. Neither the bootstrap marker sweep nor the tmux server's own exit reaps a process that has refused the hangup. The swallow rule's stated purpose is that nothing accidental can *answer* the prompt, and pane teardown is not an answer. (review-002 F7)

---

## Render Trigger

### Context

Held open from the moment the prompt became something rendered on demand rather than something painted and left: if the panel is drawn when the user arrives at the pane, something has to notice them arriving. "Landing on a pane" is several different events — taking focus, switching to the session, attaching to a window where the pane is one of three — and picking the wrong one either flashes prompts at a user cycling past on their way somewhere else, or never offers a pane split into an existing session.

### Journey

The question dissolved rather than being answered. Once the waiting program was settled, there is nothing to trigger: the panel is drawn by the helper at hydration, which bootstrap already drives for every restored pane, and it simply stays on the pane's alternate screen until the user answers. Arriving at the pane is not an event Portal needs to observe, because the panel is already there.

What made the trigger necessary was the assumption that a waiting pane holds nothing — and that assumption was what the key-scoping measurement retired.

### Decision

**No trigger.** The panel is drawn once, at restore, by the machinery that already runs for every pane. No focus hooks, no attach hooks, no per-event rendering. `client-attached` and `client-session-changed`, named in the seed as likely surfaces, are not touched by this feature.

*Folded in:* the seeded **trigger-and-timing** and **prompt-persistence** subtopics are both answered here and by the mechanism above. Timing has no remaining question — the panel exists from restore, so there is no moment at which it must be produced. Persistence likewise needs no machinery of its own: the waiting program holds the panel for as long as it waits, so ignoring the prompt, detaching, closing the window and reattaching all leave it exactly as it was, and a reboot restores the pane and draws it again from the still-unfired registration. Stickiness is the absence of any dismissal path rather than a feature — only Enter and the discard key change anything.

---

## Pending Visibility

### Context

A reboot leaves roughly forty-one panes each holding a pending decision, and the panel exists only inside its own pane. A background review asked whether the feature owes any surface outside the pane at all — there is otherwise no way to ask what is waiting, short of walking into every pane to find out.

### Journey

The scenario the review argued from — walking dozens of panes pressing discard on the finished ones — is not how the user works. A batch of finished sessions gets culled from the picker: mark them, kill them. That kills the session outright, which takes its pending resume with it, so the bulk path already exists for the case that matters.

It exists but it is not bulk. Measured against the tree: multi-select deliberately ignores the kill key, with the source stating why — none of the row actions compose with a marked set (`internal/tui/model.go:2588-2594`). So culling fifteen finished sessions today is fifteen rounds of select, confirm, repeat. That is the picker's gap rather than this feature's, and this feature neither widens nor narrows it.

What the feature does owe is an answer to "what is waiting", because it creates a state that previously did not exist and puts it somewhere invisible.

A dashboard was rejected: a pending-resume list is a second feature wearing this one's clothes, and the pane is the right place to decide, because the pane is where the context is. The decision needs the transcript above it, which no list can carry.

### Decision

**The panel in the pane is the whole interaction surface.** No list, no bulk answer path, no way to resume or discard from outside the pane it belongs to.

**Pending panes are visible as a passing count in `portal doctor`**, which already reports on this machinery, and as a single glyph on the picker's session row — the state is new, and the picker is where the user would notice it. The row already carries an attached indicator; attached and pending-resume are independent, so it is a second glyph rather than a second meaning for the first. The wider row rework that would give those glyphs a proper home is parked on the roadmap (see Open Threads).

**A pending pane is marked explicitly, with a pane option.** *(Amended 2026-09-18 — this said "the waiting program sets the marker when it starts waiting", which lands after the panel is painted and after the handover to a fresh waiter, leaving the one-tick window Waiting Pane Capture makes part of its decision.)* **The helper sets the marker before it clears the mid-restore marker, and therefore before it paints** — so the pane is never unprotected. Resume and discard each clear it, both in the waiting program, at the moment the user answers.

Deriving the state instead was argued for and rejected. tmux reports what is actually running in every pane in one read, so a pane running the waiter is a waiting pane by definition — nothing to set, nothing to clear, nothing that can go stale. It was rejected on two counts. It does not compose: every consumer — the picker, doctor, and whatever an agent-aware Portal wants later — has to re-derive it and re-handle its ambiguity, since tmux reports a process's name without its arguments, so any pane briefly running another Portal command reads as pending. And it carries nothing: a marker set at the moment a pane starts waiting can hold metadata about the pause, which a process name cannot. What that metadata should be is open — the point is only that the facility exists, and that a derivation forecloses it.

The lifecycle objection that favoured deriving was overstated, and more so than it first appeared. *(Amended 2026-09-18 — this said the one leak was "a pane closed mid-wait, which is what bootstrap's existing stale-marker sweep is for". There is no such leak and no such role: that sweep enumerates `@portal-skeleton-*` **server** options and unsets them as server options (`cmd/bootstrap/stale_marker_cleanup.go:50-58`, `internal/state/markers.go:12,45,82`), so it is structurally blind to a pane option — which is exactly why the saver's skip had to gain a second condition rather than reuse the existing marker.)*

**The pending marker has no staleness case and owes no sweep.** A pane option is destroyed with its pane, so a pane closed mid-wait leaves nothing behind and there is no address by which a sweep could reach one. The clears are the two explicit actions the feature already has, and the unreachability argument below carries the rest. Portal models every other pane and session condition as a tmux option — the restore markers, the restoring flag, the spawn acks, the directory stamp, the pane token — and this is that vocabulary rather than an addition to it.

**A non-zero pending count never fails the check and never changes doctor's exit code.** It is reported on an informational line — doctor's own status for a fact that is not a health verdict.

**Settled by derivation** (2026-09-18) — not discussed. Determined by what doctor's exit code means against what this feature produces. The stale-hook and stale-project counts fail the moment their count is non-zero, and pending resumes are not a fault: a correctly functioning install presents roughly forty-one of them after a reboot, which is precisely the state this feature is built to produce, so wiring the count like those neighbours would make `portal doctor` report failure on success and break the scriptable exit code its whole design rests on. (review-002 F8) *(Corrected 2026-09-19 — this read "a check passes or fails, the exit code is zero only if all pass", which measurement refuted: doctor declares five statuses and two of them never drive the exit code (`cmd/doctor.go:34-42`), with `checkInfo` reserved for a fact that is not a health verdict — its own comment, against the host-terminal line, reads "an environmental state, not a Portal-health defect". A pending count is that kind of fact, so it takes that status rather than an always-true passing check. The decision above is unchanged; only its premise and the rendering that followed from it were wrong.)*

**A pane option rather than a server option keyed by position.** `resume-hooks-silently-lost` established this directly: positional keys go stale when tmux renumbers panes, and its measurements confirmed a pane user-option survives `break-pane`, `move-pane`, a window close under `renumber-windows`, `respawn-pane -k` and a session rename. The whole-server enumeration for pane options already exists, so the picker and doctor each cost one read.

---

## Eager Lazy Preference

### Context

Discovery settled that an install can choose eager resumption — today's behaviour, everything fires at boot — or lazy prompting, and framed the scope as "at the server level, at the user level" without settling it. A background review asked whether one setting is enough: the store holds arbitrary user-authored commands, and a thing the user walks up to behaves very differently under a prompt that waits forever than a thing that needs to be *up* whether or not anyone looks at it — a dev server, a tunnel, a watcher. The mechanism assumes every registration is the first kind; nothing requires it.

### Journey

The measured install does not settle it either way: every registration on it is the same kind of thing. So the question was put as whether the case exists at all, and the answer was to cover it rather than bet on it — the cost of the finer model turned out to be small enough that betting was the worse trade.

### Decision

**An install-wide default, with a three-state per-hook override.** A registration carries eager, lazy, or nothing; nothing means inherit, so an entry with no setting follows the install and changes with it. An entry that sets either one holds that choice regardless of what the install says. A user who wants a particular resume to always come back automatically sets it eager; one who wants a particular resume to always ask sets it lazy; everything else is governed centrally.

**Two equally primary shapes for a stored registration.** *(Amended 2026-09-18 — this said the override was "additive on the stored entry, exactly as the pane token was added to the saved pane schema without a migration". That was wrong: the pane token went onto a Go struct with tolerant decode, while `hooks.json` is `map[hook_key]map[event]command` (`internal/hooks/store.go:28-31`) — strings all the way down, with no slot for an attribute that is not a command. The cost was weighed as free and is not.)*

An event's value is **either** the command as a string **or** an object carrying the command alongside its settings:

```json
{
  "0gT5gC": { "on-resume": "cd \"/Users/leeovery/Code/flowx\" && claude --resume 45604077-…" },
  "2zyjmp": { "on-resume": { "command": "cd \"/Users/leeovery/Code/nod\" && claude --resume d89f89ab-…",
                             "resume": "eager" } }
}
```

**Neither shape is legacy and neither deprecates the other.** The string form is the primary shape for a registration that is only a command; the object form is the primary shape for one that carries configuration. Both are permanently valid, there is no migration, and there is no future pass that converts one into the other. The writer picks by whether there is anything to carry.

That last rule is load-bearing rather than cosmetic. The external Claude Code `SessionStart` hook fires `portal hook set` on every session start, and each call rewrites the whole file — so a writer that always emitted the object form would convert every entry on the install to the verbose shape on the next Claude start. Emitting the string form when there is nothing to carry keeps a hand-edited file looking as it does today, with the occasional expanded entry where something has been pinned. The object is open-ended, so it is room for whatever comes later rather than a slot cut for this one setting.

**The out-of-repo consumers were checked before the shape was chosen.** `~/.claude/hooks/portal-resume-hook.sh:125` reads `portal hook list` and filters on the event column rather than parsing the file, and that output does not change shape — the command lands in the same column out of either form. `~/.claude/hooks/portal-resume-backfill.sh:71` does parse the file with `jq`, and would read an object where it expects a string — but it looks entries up by the pre-token `session:window.pane` key and so already matches nothing on the current install; the user confirms it is no longer used, having been a backstop for the hook-loss defect that has since been fixed. Measured on 2026-09-18: all 41 keys in the live file are token-shaped, none are old-format, and `portal doctor` reports no stale hooks across 7 passing checks.

The alternative — a second entry beside `on-resume` in the same inner map — was rejected on that first consumer. It keeps `jq` working, but it puts a non-event in the event namespace and adds a row to `hook list`, which is a machine interface the live script parses. Nesting keeps that output honest and disturbs only the script that is already inert.

**A registration is written whole; nothing survives a re-registration it was not given.** `portal hook set` writes exactly what it is handed. A mode the caller does not pass is not a mode — no attribute from the entry being replaced is carried forward, and the store's existing wholesale overwrite of an event's value is the correct behaviour rather than something to work around.

The alternative was argued and rejected: that a `hook set` carrying no mode flag should leave an existing mode alone, on the grounds that a pinned entry re-registered by an external script would otherwise be silently un-pinned. The user rejected it on the model rather than the mechanics. A registration replaces its predecessor completely; inheriting configuration from a dead one means a writer's output depends on state it never saw, which is the behaviour nobody can account for when it surprises them later. Policing that is not Portal's job. The practical exposure is smaller than the argument suggested in any case: the external `SessionStart` hook writes only for panes running a session, its `SessionEnd` counterpart usually removes the entry first, and the one collision — a pinned pane whose hook is re-registered — resolves by re-passing the flag.

The consequence is stated rather than mitigated: **a pin lives on the registration, not on the pane.** Anything that re-registers without the flag drops it, and that is the contract rather than a defect.

**The override is set where the registration is made: `portal hook set`.** A flag on the command that writes the entry, alongside `--on-resume`. This follows from who writes registrations — the external `SessionStart` hook is a shell script, not a person at a screen, so the route has to be something a script can pass. The waiting panel is not the place for it: a panel offering "always resume this one without asking" would be setting a durable preference from a surface whose whole job is answering one instance of a question.

**A pinned registration is readable from `portal hook list`, as a fifth column.** The listing is where a registration is read back, and a mode that could only be seen by opening `hooks.json` would be configuration you can set and cannot check.

Today the output is four tab-separated columns — key, event, command, location. The mode is **appended** as a fifth rather than inserted, so anything reading the first four positionally is untouched; this is how the location column itself arrived. The cell holds `eager` or `lazy` when the registration carries one and is **empty when it does not**, matching how the location column already reads when it has nothing to say. So the column reports what is stored, and an empty cell means the entry follows the install.

The install-wide default is deliberately **not** in that listing. It is one value for the whole install rather than a property of any row, and the only place to put it is a header or footer line — which breaks naive parsers of a machine interface for a fact that does not vary between rows.

**It is reported by `portal doctor` instead, on an informational line.** Doctor already reports on this machinery and this feature already gives it such a line for the pending-pane count; the install's resume mode is the same shape in the same place. Like that count, it never fails the check and never changes the exit code.

**The install-wide setting has a home already; the way to change it does not.** `prefs.json` holds the install's UI preferences — the theme and the session-list grouping mode — and is the natural place for this. What does not exist is any surface for setting it: the theme picker is the only preference with a UI, so until a settings screen exists this one is changed by hand-editing a file. That raises the stakes on the default rather than changing where it lives.

**The install-wide default is lazy.** The feature ships on rather than waiting to be discovered, and an install that upgrades and reboots meets prompts rather than processes.

Defaulting eager was weighed and rejected. It is the conservative choice — an upgrade changes nothing, and the new behaviour is opted into — but it leaves the feature switched off behind a setting with no UI, which is a poor place to leave the thing the work exists to deliver. What makes lazy safe is that it is not a silent change: a pane holding a prompt says what it is and what key answers it, so the worst first-boot outcome is a few extra keypresses landing the user exactly where eager would have put them. The risk that would have changed this is an install belonging to someone who did not choose the upgrade and reboots expecting their processes back; against one extra keypress on a self-explaining panel, it was not enough.

A settings screen to change it without hand-editing `prefs.json` is parked on the roadmap (see Open Threads).

---

## Restore Pipeline Integration

### Context

The feature inserts an indefinite pause into the middle of a pipeline built on the assumption that hydration completes in seconds. The surfaces named in the seed — the hydrate helper's exec chain, the restore engine's phase split, the eager signal pass at bootstrap, and the global attach hooks — were carried forward to be checked rather than assumed safe.

### Journey

The edges were measured against the tree rather than reasoned about, and most of them turned out to need nothing.

**A second bootstrap does not disturb a waiting pane.** Most `portal open` runs never reach the orchestrator at all: a version-satisfied `@portal-bootstrapped` latch short-circuits the pre-run after a saver liveness check and returns (`cmd/root.go:108-118`), so restore only runs on a cold server or after a version change. When it does run, it skips any saved session whose name is already live (`internal/restore/restore.go:118`). A session holding a waiting pane is live, so it is never re-restored and its pane is never respawned out from under the user.

**A frozen pane is not dropped from the saved set.** The freeze suppresses that pane's scrollback write, and the structural capture merges the pane's *previous* record back into the fresh index rather than omitting it — guarded so that a stale marker cannot resurrect a pane whose session, window or pane is gone (`internal/state/capture.go:96-127`). So a pane can wait indefinitely and still be restored on the next boot, with the transcript it had when it paused.

**Bootstrap's two sweeps leave it alone.** The stale-marker sweep only unsets markers whose pane is no longer live, and a waiting pane is live. The orphan-FIFO sweep has nothing to reclaim: the helper unlinks its FIFO as soon as the hydrate signal arrives, long before the panel is drawn.

**The eager signal pass is unchanged.** It still writes the hydrate byte to every freshly-armed pane, and the helper still replays on receiving it. What changes is only what the helper does afterwards.

**The pending state is never persisted.** It is recomputed on each boot from a registration that has not fired, so nothing about it needs to reach `sessions.json` and no schema moves.

### Decision

**Nothing in the restore pipeline changes except the helper's own tail.** No new bootstrap step, no change to step ordering, no change to the eager signal pass, and no change to the global hooks the seed flagged. The insertion is contained to the one process that was already the last thing to run in a restored pane.

The one open question this section carried — whether the marker the freeze rides on survives a pane rearrangement mid-wait — is answered in Waiting Pane Capture: it does not, and the freeze gains a second condition read from the pane-scoped pending marker instead.

---

## Panel Visual Design

### Context

The panel is the one genuinely new surface in Portal, and everything else about it was settled before what it says and shows. Three frames were built in the Paper file (`Portal`) against the Nord artboards the user actually runs, so the new work sits beside the existing designs in the same palette: **Resume panel — waiting (Nord)**, **Resume panel — discard confirm (Nord)**, and **Sessions — pending resume dot (Nord)**.

### Decision

**The waiting panel is the kill modal's shell with the rename modal's header.** It was built by duplicating the Nord kill modal, so its card geometry — 480px wide, header and footer rules, padding — is identical rather than approximate. It carries, and carries nothing else:

- **Header**: `Resume session` on the left, a `● PAUSED` badge on the right in Nord's orange — the slot the rename modal uses for `EDIT MODE`.
- **Body**: an `ON RESUME` label in the same violet the rename modal gives `NEW NAME`, with the registered command beneath it.
- **Footer**: `⏎ resume` and `d discard`.

A meta line carrying the directory and how long the pane had been paused was drafted and cut. It was invented rather than decided, and on the page it added nothing the command and the badge did not already say. The marker can carry metadata (see Pending Visibility) — this panel does not need it to.

**The discard confirmation is the kill modal, retitled.** `▲ Discard resume?`, the command rendered in the destructive colour where the kill modal puts the session name, a plain-language consequence line, and `y discard   esc cancel`. Nothing structural differs, which is the point: it is the same act the picker's kill confirm performs, so it should be the same object.

**The session row drops the word `attached` and gains a second dot.** The green attached indicator loses its label and stands alone; a pending resume shows as a second dot in Nord's orange.

**The dots pack to the right in a fixed order — green, then orange — rather than holding reserved lanes.** A row with one dot puts it hard right whichever it is; a row with both shows green pushed left to make room for orange. This was built the other way first, with a reserved lane per indicator so the columns aligned down the list, and the user rejected it: an indicator should not claim space it is not using.

**Dropping `attached` is pulled into this feature; the rest of the row rework stays parked.** Removing the word is what makes room for a second indicator, so it cannot wait for the roadmap item — but the window count, the session paths, and the wider right-hand rework stay on `picker-row-redesign` (see Open Threads). One consequence rides with it: a bare dot carries no meaning on its own, so the help modal gains the legend in the same change rather than after it.

---

## Colourless Indicator Rendering

### Context

The session row's two indicators are distinguished by hue: green for attached, orange for a pending resume, both drawn as the same filled circle. Portal has a `NO_COLOR` carve-out where the picker renders colourless on the terminal's native foreground and background, and the rule for that mode is that state stays glyph-backed and never colour-only — enforced at each site it matters (`internal/tui/destructive_confirm.go:37`, `loading_view.go:31`). The picker builds the mode from the environment (`internal/tui/build.go:137`) and the session delegate already carries it as a first-class branch.

Under today's row the rule holds without effort, because the attached indicator carries a word: `● attached` loses its hue in that mode and still says what it is. Dropping the word to make room for a second indicator removes the only signal that survives, and two identically-shaped circles then read as one ambiguous mark, or as an indistinguishable pair.

### Options Considered

**Distinct glyphs in both modes** — attached keeps the filled circle, pending takes a different one.
- Pros: one rendering satisfies both modes; geometry identical throughout.
- Cons: changes the coloured design, where a matched pair separated by hue is what was drawn.

**Letters under `NO_COLOR` only** — the circles and their colours are unchanged wherever colour exists; in the colourless mode each indicator renders as a letter in the same cell.
- Pros: the coloured row is exactly as designed; a letter occupies the one cell a circle does, so the right-packing order is untouched and no second geometry exists.
- Cons: a second rendering to hold, in a mode that is rarely looked at.

**Loosen the rule for these two indicators** — accept colour-only, on the grounds that neither indicator is load-bearing.
- Pros: nothing to build.
- Cons: the rule stops being applicable — the next indicator has none to follow, and it may be one that matters.

### Journey

The collision is only visible from the colourless side. In Nord the two circles are unambiguous, and the mode where they are not is the one nobody looks at while designing.

The first instinct was to split the glyphs in both modes, which satisfies the rule with a single rendering. It was rejected on the design: the matched pair of circles is what was drawn, and the hue is doing work in the coloured row that a shape change would take over.

Loosening the rule was weighed honestly — neither indicator is essential, and a colourless user losing an at-a-glance attached hint is not data loss. It was rejected on what the rule is for rather than on this case's stakes. The rule is what stops the *next* indicator from being colour-only, and that one may matter; a carve-out turns it into "glyph-backed unless someone decided it wasn't essential", which nobody can apply. The cost of keeping it is one conditional in a function that already branches on the same flag.

### Decision

**The circles and their colours are unchanged; `NO_COLOR` substitutes a letter for each indicator's glyph.** Attached renders `A`, a pending resume renders `P`, each in the one cell its circle occupies — so the fixed right-packing order of Panel Visual Design is untouched and there is no second row geometry: `A` alone, `P` alone, or `AP` when both.

Uppercase rather than lowercase: a lone `a` in a status column reads as a typo, `A` reads as a status code, which is what it is.

Confidence: high.

---

## Panel Theme Resolution

### Context

The panel is painted in the theme the user has chosen, which is what makes it read as Portal rather than as a tmux dialog. Portal's theme setting is not always a single answer: it is either one named theme, or a light/dark pair, and a pair is only half a decision until something establishes which half the terminal is.

The picker settles that before it paints anything — a query to the terminal raced against a 50ms timeout, resolving dark when nothing answers (`internal/tui/appearance_gate.go:12`). The panel is painted by a different process, in a pane, at restore, and nothing said what that process does with a pair.

### Journey

The derivation runs from what the drawing process is already doing. It has to touch the theme and the rendering path to paint at all, and it hands off to a fresh wait immediately afterwards, so a gate placed there is paid once per draw and nothing of it is held while the pane waits. There is no cheaper moment and no later one — after the handover the waiter has neither the theme nor a reason to resolve it.

What settles the choice is the shape of the failure rather than the cost. A pair resolved to the wrong half is not one pane looking odd: it is every restored pane at once, forty panels in the half of the user's own theme they do not use, with nothing in the product that looks like the cause. Against that, a bounded query the picker already runs is not a cost worth avoiding.

The two alternatives are the same answer stated twice — resolving a pair straight to its dark half with no query, or having the panel ignore the pair and paint the shipped dark default. Both are free, and both are simply wrong on a light terminal that would have answered.

### Decision

**Settled by derivation** — not discussed. Determined by the appearance gate the picker already runs and the moment the panel is drawn: the drawing process is the only point that holds the theme, and it hands off immediately, so the gate rides there or nowhere. (review-input-c1 F4)

**The theme resolves as it does everywhere else in Portal.** A named theme paints from the first frame with no gate at all. A light/dark pair runs the same detect-or-timeout gate the picker runs — a query to the terminal raced against the same short timeout, resolving dark when there is no answer — in the process that draws, which hands off before it waits, so nothing of it stays resident while the pane waits.

The consequence is stated rather than hidden: **a pane drawn with no client attached to it gets no answer and resolves dark.** That is the picker's own fallback reached by the ordinary route, not a second rule — most panes are drawn at restore with nobody watching them, so under a pair the dark half is what most first draws land on, and a redraw with a client present resolves against the terminal in front of it.

Confidence: high.

---

## Unreadable Stored Registrations

### Context

The store is hand-editable by design, and the object form invites exactly the mistakes a hand edit makes: `"resume": "Lazy"`, `"resume": true`, a stray key, or an object that carries settings and no command at all. What the user gets in each case was never established, and the readings pull in opposite directions. Read an unrecognised mode as eager and one typo turns the whole restored set back into processes launching at boot — the cost this work exists to remove. Read it as a hard error and a single bad character can fail a pane's restore.

### Journey

The derivation runs from what Portal already does with a value it cannot read. `prefs.json` decodes every field tolerantly and independently, resolving anything missing, empty, corrupt or unrecognised to the shipped default rather than failing. The resume path's own answer to a lookup it cannot satisfy is the same shape: a lookup failure gives a bare shell, so the pane stays usable.

Both alternatives were weighed against that. Treating an unrecognised mode as eager matches today's unconditional firing, and is the one reading whose failure is silent and expensive — the typo does not announce itself and the whole install resumes at boot. Refusing the entry loudly makes the typo visible at the cost of a pane that will not come back, which trades a cosmetic fault for a functional one.

### Decision

**Settled by derivation** — not discussed. Determined by `prefs.json`'s tolerant-decode rule and the resume path's existing degradation to a usable pane. (review-gap-c1 F2)

**A stored value the reader cannot make sense of never fails a pane.** An object whose `resume` attribute is absent, empty, or holds anything other than `eager` or `lazy` carries no mode — the registration inherits the install-wide default exactly as a string-form entry does, and the mode column reads empty for it. An object carrying no command, or an empty one, is not a registration: the pane falls through to a plain shell as an unregistered pane does.

Nothing is rewritten to correct either case. The file stays as the user left it.

**The writer's side is the opposite, and deliberately so.** `portal hook set --resume-mode` takes `eager` or `lazy` and nothing else; any other value exits non-zero and writes nothing. The two rules differ because the people on each side of them do. The tolerant read exists for a file the user hand-edits, where failing a pane over a typo costs more than ignoring it. The flag is an explicit assertion by a writer still at the keyboard — or by a script whose exit code is checked — where refusing is free and silence is not: a mistyped pin on the one registration that has to come back automatically reports success, quietly follows the install default instead, and shows nothing for it but an empty cell in `hook list` the user has no reason to read.

The alternatives keep one rule for both sides and pay for it in silence — storing the value verbatim and letting the tolerant read drop it, which leaves a pin that does not exist, or accepting the flag and dropping it unwritten, which is the same silence with less on disk.

Confidence: high.

---

## Discarding At The Edges

### Context

Three things about the discard were settled — what it removes, what confirms it, what it records — and three edges of the same act were not. The entry can already be gone by the time the key is pressed, days having passed since the panel was drawn. The write can fail, against a file another process can be holding. And once the confirmation is up, whether the keys from the screen underneath still act was never said.

### Journey

The first two derive from what a discard is. It is irreversible, over the only copy of a user-authored command, so the outcome worth refusing is not a failed discard — it is the user believing something was removed that was not. An already-gone entry is therefore not a failure at all: the end state the user asked for is the state the store is already in. A failed write is the opposite: the screen must not claim an outcome the disk does not hold.

The third follows from the swallow rule and from why `y` was chosen over Enter. Enter resumes one keystroke earlier, and a user who presses `d` and then reflexively Enter — the reflex every confirmation dialog in the world trains — would get the session resumed, which is the opposite of what they just asked for. The swallow rule exists so nothing accidental can answer; a live Enter on the confirmation is precisely the accidental answer the two screens' key choices were arranged to avoid. The alternative — Enter stays live and resumes from the confirmation too, on the grounds that resuming is the non-destructive answer — was rejected because backing out to it is already what Escape does, so the live Enter buys nothing and costs the reflex.

### Decision

**Settled by derivation** — not discussed. Determined by what a discard is (irreversible, over the only copy of the command) and by the swallow rule that already governs the waiting panel. (review-gap-c1 F4, F7)

**A discard that finds nothing to remove is still a discard.** If the entry has already gone — removed by `portal hook rm`, replaced by a re-registration, or hand-edited away while the pane waited — the marker clears and the pane falls through to a shell as it would after a removal.

**A discard that cannot be written leaves the pane waiting and says so on the panel.** An unreadable store or an unavailable lock is reported in place, the registration and the marker both stand, and the key can be pressed again. The one outcome ruled out is a pane that drops its panel while the registration it named survives.

**While the confirmation is up, `y` and Escape are the only keys that act.** Enter, `d` and everything else are swallowed there exactly as they are on the waiting panel — the pane never acts on a key the screen in front of the user does not offer.

Confidence: high.

---

## Panel Rendering Limits

### Context

The panel's shape was settled against a full-size pane and a short string, and neither is guaranteed. A real registration is long — the measured install's entries run to a quoted directory path plus a `--resume <id>` tail — while the card is the rename modal's geometry, sized for a session name. And restored panes come back at whatever size the user left them, which can be smaller than the card.

### Journey

Both derive from what the panel is for. The command is the only content on the panel that says which piece of work this pane is holding, and the same string is rendered again on the discard confirmation, where the user is being asked to destroy it permanently with nothing else to go on. Cutting it loses exactly the part that identifies the pane — at the tail the id that distinguishes one waiting pane from the next, at the head the directory that says which project it is. Three lines holds a realistic registration whole without the card growing to the size the canvas-plus-card shape exists to avoid.

The small pane is the sharper of the two, because its failure is quiet in the worst way. A pane that declines to draw looks like an ordinary restored pane with its transcript in place, while silently swallowing everything the user types into it: no sign that the pane holds a decision, no clue that Enter answers it, and a keyboard that appears to be broken. The canvas is what distinguishes a waiting pane from a restored one, so it is the part that must survive at any size. Dropping the command below the floor was weighed and rejected — it keeps the smallest pane legible at the cost of not saying what would run, which is the one thing the panel exists to say.

### Decision

**Settled by derivation** — not discussed. Determined by what the panel is for — the command is its only identifying content and the canvas is what says the pane is waiting — and by the swallow rule, which makes a pane that draws nothing read as a working pane with a dead keyboard. (review-gap-c1 F5, F6)

**A command longer than the card wraps rather than being cut.** It wraps within the card's inner width over at most three lines, with anything beyond marked `…`; the card's width is unchanged. The discard confirmation renders the command the same way.

**A pane too small for the card still says what it is.** Below the size the card needs, the panel degrades instead of disappearing: the canvas is painted as always, and the title, the command and the key hints stack plainly without the card frame, down to the smallest pane a restore can produce. Enter and `d` act at every size.

**The discard confirmation degrades the same way.** Below that size its frame goes too and its parts stack plainly on the canvas — the title, the command, the consequence line and its two key hints — with both keys acting at every size. The reason the panel has this rule applies harder one keystroke later: a panel that drew nothing leaves a pane that swallows keys, while a confirmation that drew nothing leaves the user pressing the key the footer offered them a moment earlier against a question they never saw, and what goes is the only copy of a user-authored command. Refusing the discard key below the floor was weighed and rejected — it leaves a pane that can never be discarded from where the user is — as was letting the card clip, which shows a confirmation with its consequence line cut off.

Confidence: high.

---

## When The Marker Cannot Be Written Or Cleared

### Context

The freeze rests on a marker written onto the pane in the moment before the panel goes up, and cleared when the user answers. Both are tmux writes, and both can fail. The design takes as given that no moment exists in which a pane is waiting without a marker, and that the marker goes when the wait does; neither was established as a rule.

### Journey

The two failures are not symmetric, and each derives from its own consequence.

A wait with no marker is the one state the design refuses. The saver rewrites that pane's saved transcript as history-minus-its-last-screenful plus the card at the first tick that lands, for as long as the user takes to answer — which can be days — with no copy anywhere and nothing reporting it. Against that, the sanctioned place to degrade to is the one the feature already names: landing the user where eager would have put them. Painting anyway and accepting that a tick may cost a screenful trades the protection for the appearance of it; dropping to a plain shell loses the resume for that boot with nothing saying so.

The failure to clear is worse, because the damage outlives the answer. The marker stays on the pane and the saver refuses that pane's scrollback write for the rest of the pane's life: the user resumes, works there for weeks, and every reboot restores the transcript it held at the moment it paused. Nothing reports it and nothing reclaims it — the reason for believing a marker can never be wrongly left set is that the waiting program dies with the pane, which stops being true the instant it hands the pane over, and no sweep reaches a marker carried by a pane. Handing the pane over anyway trades a saved transcript for a usable pane, which is the wrong way round for a feature whose whole point is not losing work.

### Decision

**Settled by derivation** — not discussed. Determined by the freeze's own purpose — protection against lost work rather than clutter — and by the rule already taken for a discard the store will not accept: what the screen claims and what the pane holds never disagree. (review-gap-c2 F3, F4)

**A pane that cannot be marked does not wait.** If the pending marker cannot be written, the helper does not paint: it fires the hook as an eager registration does, and the pane comes back as today's restore leaves it. **The fall-through is recorded**: the helper emits one WARN as it fires, naming the pane and the error that refused the marker — one more event on its existing hydrate catalog rather than a new component. This is the only degradation the feature introduces that the user cannot read off the pane in front of them, since a pane that fell through looks exactly like a pane configured eager and the pending count reads zero for it.

**A freeze that cannot be lifted holds the answer.** If the marker cannot be cleared, the pane keeps the panel and says so in place; neither the hook nor the fall-through to a shell runs while the marker stands, and the key can be pressed again.

Confidence: high.

---

## The Panel's Report Row And Its Redraw

### Context

Two consequences of decisions already taken had nowhere to land. The panel's contents were enumerated exhaustively — header, command under its label, two key hints, nothing else — while the discard rules require the panel to report in place when an answer cannot be carried out. And the resize handover was described as a cost paid at the moment of the resize, which a terminal being dragged does not deliver once.

### Journey

The report row follows from why the report exists. It is there so the screen and the store never disagree, and a report that can expire unseen fails exactly that: a user who looked away reads the unchanged panel as the key not registering, presses the discard key again, and never learns that nothing was removed — the one outcome the discard rules set out to rule out. A row inside the card also keeps the panel one object, on a pane that has room for nothing else.

The redraw follows from what a drag actually produces. A terminal dragged to a new size delivers a stream of size changes to every pane in the window, and a full waiting set answering each of them with a fresh draw is hundreds of process launches a second for the length of the drag — the machine stalling and the panels stuttering, from an action the user takes without thinking about it. The panel holds nothing that moves, so a draw mid-drag shows nothing the user will still be looking at a moment later. Leaving the card as drawn until the next keypress costs nothing and leaves a mis-sized card on screen, which is the cheaper answer to the wrong question.

### Decision

**Settled by derivation** — not discussed. Determined by why the report exists (the screen and the store never disagree) and by what a resize actually delivers against the resting-cost argument the waiter rests on. (review-gap-c2 F5, F6)

**A card with something to report carries one more row.** The reason is stated on a single line between the command and the key hints, and it stays there until the next key is pressed rather than timing out. The row is present only when there is something to say; a panel with nothing to report carries exactly its three parts.

**The report lands on the screen the key was pressed on.** A discard the store will not accept fails with the confirmation in front of the user, so the confirmation carries the row and the confirm key retries from there. A confirmation that closed on a failed write would be indistinguishable from one that was backed out of — the user reads a discard that did nothing as a discard they cancelled, presses the key again, confirms again, and never learns that nothing was removed either time. Closing the confirmation and reporting on the panel instead was weighed and rejected on exactly that reading.

**The redraw is taken once the size has settled, not once per size change.** One draw at the end of the stream is the whole of what a resize owes, so the cost stays a single handover per pane.

Confidence: high.

---

## When The Waiter Itself Goes Away

### Context

Two ways a wait ends were settled — the user answers, or tmux tears the pane down — and a third was left open: the waiting program going away on its own. It is killed by name, it crashes, the machine reclaims it under memory pressure. The waiter is the pane's only process, so the ordinary consequence of that is the pane closing.

### Journey

The consequence is larger than a lost pane. On an install where nearly every session holds a single pane, the pane closing closes the session, and the next capture drops it from the saved set with its whole transcript — a thing the feature exists to protect. A single `pkill portal` would take every waiting pane on the machine at once, and a crash would take one at random.

The route that looked right first was to have the pane outlive its waiter and come back to the panel. It does not survive contact: nothing is watching to respawn the waiter, and holding a dead pane open with the panel on it is precisely the design the key-scoping measurement already ruled out.

The answer was already in the codebase. The hydrate helper does not hand a pane to a hook and hope; it runs `sh -c '<HOOK>; exec $SHELL'`, so a hook that ends by any route leaves the user a usable pane rather than a closed one. The same shape applies here, with one addition: the chain clears the pending marker before it execs the shell, so a pane whose waiter died is not left frozen.

The cost is honest and worth naming: a resident shell parent per waiting pane, a megabyte or so on top of the floor, which works against the argument for handing off before waiting. It buys a waiting pane not taking its session and its transcript with it.

### Decision

**Settled by derivation** — not discussed. Determined by the chain the hydrate helper already runs for a hook, and by what a closed pane costs on an install of single-pane sessions. (review-gap-c5 F1)

**A waiter that exits without having handed the pane over drops the pane to a plain shell.** It runs as the tail of a chain that takes the pane off the panel's screen, clears the pending marker, and then execs the user's shell, so a killed, crashed or reclaimed waiter leaves the pane alive with its transcript above it, the session intact, the marker cleared so capture resumes, and the registration untouched — the next reboot offers the panel afresh. Those first two steps keep the order every answer takes: the pane is showing its own transcript again before its protection is dropped, because a tick landing while the card is still up writes that pane's saved transcript as history-minus-its-last-screenful plus the card, and a `pkill portal` puts every waiting pane on the install through that window at once.

**The chain hands the pane over whether or not the clear succeeded, and records a clear that failed.** A closed pane is the failure this fallback exists to prevent, so the shell runs either way; but a clear that did not land leaves the second way a pane can be wrongly frozen, and the worse of the two. The pane looks entirely normal while its saved transcript stands still, and the picker dot and the pending count both go on claiming a decision is waiting there. The rule that holds an answer until the marker clears is unavailable here by definition — there is no waiter left to hold it — so the record is the only thing that makes the state findable, and it is the same WARN a marker that could not be written already gets. Whether the clear is retried before the chain gives up is the builder's; the record is not.

Confidence: high.

---

## Input Already In Flight

### Context

The swallow rule's stated purpose is that nothing accidental can answer the panel: a stray paste, an errant `send-keys`, or a key pressed in the wrong window means nothing to it, because only two keys mean anything at all.

### Journey

The claim does not survive the keys it was written beside. `d` and `y` are ordinary characters in ordinary text — `cd ~/dev && yarn` contains both, in order — so a line delivered to the wrong pane opens the confirmation on the `d` and agrees to it on the `y`, from the same buffer, faster than anything can be seen. The registration is gone, it was the only copy of a user-authored command, and nobody watched either screen.

That is exactly the outcome the rule claims to prevent, which makes the claim false as written rather than merely incomplete. Leaving it and narrowing the claim alone was weighed — the confirmation is already a second deliberate act — and rejected: a second act that arrives in the same paste is not a second act.

Changing the keys was not on the table. `d` and `y` were each derived from Portal's existing grammar and neither has a safer sibling; the problem is not which characters they are but that a burst of input is read as two decisions.

### Decision

**Settled by derivation** — not discussed. Determined by the swallow rule's own stated purpose, read against the characters the two keys actually are. (review-gap-c5 F2)

**Input already in flight when the confirmation opened is dropped rather than read as agreement.** Only a keystroke that arrives after the confirmation is on screen can confirm it. The keys are unchanged: `y` and Escape remain the only keys that act there.

The swallow rule is stated as what it delivers — nothing accidental can *answer* the panel, and a burst of input cannot carry the discard through both screens.

Confidence: high.

---

## Summary

### Key Insights

1. **The durable thing is the pending registration, not the prompt.** Once the prompt was understood as a rendering of an unfired hook rather than an object that had to persist, stickiness stopped being a requirement to engineer and became a consequence: ignoring changes no state, so the same state renders the same prompt next time. It also dissolved an entire subtopic — nothing has to notice the user arriving at a pane.

2. **tmux has no pane-scoped way to draw over a pane or to capture a key.** Both overlay primitives belong to the client and swallow its whole keyboard; `key-table` is a session option that tmux accepts a `-p` write on and then resolves upward, arming every pane in the session. Measured, not assumed. The only thing that can own one pane's input is a process inside it — which is what forced the waiting program over the cheaper dead pane, against the design reasoning that favoured it.

3. **Measuring with the caller's exact invocation changes the answer, and the same subject took three readings to settle.** A bare `capture-pane -p` returns the visible screen and made the alternate-screen card look like it replaced a pane's saved transcript. The saver's own `capture-pane -e -p -S -` was then read as returning the primary history with the card appended — accretion rather than loss — and that reading was wrong too: re-run over a pane holding the alternate screen, it returns the scrolled-out history and the card with the *visible screenful missing*. The failure is loss of the most recent screenful, plus accretion of a dead card.

4. **Go's resident cost is what a process touches, not what it links.** A binary linking the rendering library and never touching it is indistinguishable from one importing nothing — which is why the waiter is the same Portal binary rather than a sidecar, and why the drawing process must hand off to a fresh one instead of blocking with its rendering pages resident.

5. **A reflex key must never destroy anything.** Escape means *back out* everywhere else in Portal, so binding it to an irreversible deletion would have made this the one place it acted. Assuming the positive — Enter resumes, a named key discards behind a confirmation — restores that meaning and leaves Escape with nothing to do here, which reads as cleaner than a guarded Escape would have.

6. **Figures about the install are point-in-time, not constants.** The saved population moves between sittings — 44 live sessions and 41 registrations on 2026-09-17, 42 and 41 on 2026-09-18, 43 and 40 by the end of it. Each measurement below is dated and none supersedes another; the shape they agree on is one session, one pane, one registration, and a set that grows over months.

### Open Threads

- **Preferences UI** — parked on the product roadmap (`preferences-ui`, horizon `next`). A settings screen in the picker for install preferences, so `prefs.json` is not hand-edited. The theme picker is currently the only preference with any UI, and this feature adds a second setting that needs one — and the agent-aware direction will add more.
- **Picker row redesign** — parked on the product roadmap (`picker-row-redesign`, horizon `next`). Dropping the window count, which reads "1 window" on every row of the measured install (42 of 42 live sessions hold a single window, `tmux list-windows -a -F '#{session_name}' | sort | uniq -c`), showing each session's directory path beside its name, and finishing the right-hand status strip. It changes every row for every session and is driven by its own rationale rather than by this feature. **Narrowed since parking**: dropping the `attached` word and adding the pending-resume dot came back into this feature, because the word had to go to make room for a second indicator — the roadmap entry was amended to say so rather than leaving both records claiming the same work.

### Current State

**Resolved.** What a waiting pane is (a Portal process holding a panel on the pane's alternate screen), what it shows and how it is styled (three frames in the Paper file, against the Nord artboards), what the keys do (Enter resumes, `d` discards behind a `y` confirmation, Escape inert, everything else swallowed), what discarding destroys and what it records, what protects the pane's saved transcript while it waits and which marker holds that protection, that scrollback replays unconditionally, that nothing in the restore pipeline changes but the helper's tail, how a pending pane is visible outside itself, and how eager and lazy are configured — install-wide default lazy, per-registration override written whole, readable from `hook list` and `doctor`.

**Uncertain.** Two figures the feature's shape leans on are estimates rather than measurements, because they cannot be taken until something exists to measure: the waiter's actual resident size on the settled code path (~2 MB is the Go floor plus a guess at what its startup touches), and whether the draw-then-hand-off split keeps it at that floor in practice. Both are bounded — the floor is measured and the ceiling is the daemon's 22 MB — and neither changes a decision, but the memory case for the whole feature is stated against the lower one.

**Not carried here.** Two capabilities this work touched but does not build — a preferences UI and the picker row rework — are on the roadmap rather than left as loose ends, and the one piece of the row rework this feature needs (dropping the `attached` word) was pulled forward explicitly, with the roadmap entry amended so neither record claims the other's work.
