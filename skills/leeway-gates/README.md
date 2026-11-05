# leeway-gates

A Claude Code mod that draws the workflow engine's gates in the band above the
prompt instead of leaving the model to reproduce them.

The engine states each gate as data beside the menu it composed. This mod
announces itself at the session's start so the engine collects that data, arms
the gate off the Bash result that carried it, cuts the menu out of what the
model reads, and draws the rows where they stay put while the transcript
scrolls; while any screen but the terminal or the Desktop app is attached
beside it, it leaves the menu as text so every screen shows it, though a
screen that attaches after a menu was drawn does not get that menu. No gate's
prose names the mod; only leeway's setup step does, with a notice when
the mod could run in Claude Code's terminal app or the Desktop app's Code tab
but is not running.

A click on a row puts its answer in the prompt box; a second click on it sends
it as the next message, which the workflows read as the answer. Once a click
has given the band the keyboard, the arrows move between rows, Enter or a row's
own key picks, and Enter on the picked row sends. A sent answer enters under
the plugin's name, framed for the model and labelled in the transcript as the
plugin's; the mod leaves what it sent in the conversation's own folder (see
below) as `sent.json`. A second plugin, `leeway-gates-rows`
(`../leeway-gates-rows/`), reads that record to draw the row as the question
and the answer, since no plugin can redraw the row of a prompt it submitted.
Beside it the mod leaves the press itself as `pressed.json` — the gate's name,
the row's answer, and when it was sent — which the engine's `gate` reads to
log the answer as pressed rather than typed: a file of its own, since the
second plugin spends `sent.json` once it draws the row. A send that fails, or
that another plugin drops, leaves neither recording a send.
Typing answers too: a key and Enter at the prompt, or Esc then Enter after a
pick. Rows only typing can answer — Ask, Comment, a range — draw dim, and a
click on one says to type it in the prompt. The footer under the rows says
which: how to answer, what is in the prompt, or where to type.

The band is never taller than the rows Claude Code gives it, so it never
scrolls. A gate that fits shows whole: a rule, the statement and the question,
the rows, the footer. One that does not keeps its rule, question and footer in
place and shows its rows a page at a time, every page the same height, over a
line reading `↑ previous   ↓ next   page 1 of 3`; a click on either turns the
page and puts the cursor on its first row. The arrows carry the cursor across
pages, the page following it, and a row's own key picks that row whichever
page it is on.

A turn the person did not start — a background agent's report, a
notification, a schedule — leaves the band as it is, its rows live. The band
comes off when the person starts a turn or replies into a running one, or when
a turn draws a different gate over it. Esc on such a turn leaves the band as it
is, unless the turn had already rendered a different gate: the model now waits
at that gate's stop, so the band empties. A second click while Claude works
holds the answer instead of sending it: its row reads `· queued`, and the
footer says it sends when Claude finishes. A click on the queued row takes it
back to a pick, and a click on another row picks that one instead. As the turn
ends, the held answer sends if the same gate is still on the band; if the turn
rendered a different gate, the answer is dropped unsent, and the new gate's
footer says so; if Esc stopped the turn with the same gate still up, the
answer goes back into the prompt box as a pick. When a pick's gate goes, its
answer leaves the prompt box too, unless the person has edited it there.
Typing while Claude works joins Claude Code's own queue.

Esc on a turn an answer started or joined puts its gate back, dropping
whatever that turn drew, as long as no tool has run in it; once one has, the
band stays empty, since the mod cannot tell a read from a write. A `/clear`
takes the gate off the band.

At the end of every turn, and as the conversation ends, the mod keeps what the
band shows — the gate, or nothing — in the conversation's own folder,
`~/.config/leeway/conversations/{session-id}/gate.json` (under
`LEEWAY_CONFIG_DIR` where that is set, beside the workflows' system
config), found by the session id wherever the session's working directory has
moved, and stamped with where the transcript ends, not counting the lines
Claude Code writes around an interrupted turn. A conversation resumed with
`claude --resume` or `/resume`, or picked up again by a restart or a reload of
the mod's files, gets its gate back as long as its transcript still ends
there, with nothing picked or held — a held answer waits on a turn that does
not come back; one that moved on while the mod was not loaded gets nothing. A
session the mod was loaded into after it started carries no announcement, so
there it keeps and reads back nothing, and a conversation that does not run
the workflows has no folder and keeps nothing — nor does one in a process
that names neither a home directory nor `LEEWAY_CONFIG_DIR`. The folder
holds one gate, and goes once Claude Code has deleted the conversation's
transcript, so a kept gate lives as long as its conversation can be resumed,
with one exception: a conversation whose end the session-end hook never saw
keeps its folder — the session that first installed the hook, which Claude
Code picks up only as a session starts, or one that crashed.

The engine emits the menu regardless, so where the mod is off or absent the
model reads the text menu the engine wrote.

The mod is part of the workflows, and it runs in Claude Code's terminal app
and the Desktop app's Code tab, from 2.1.287, with this directory installed in
the project; mods are on by default there, so nothing switches it on. Claude
Code loads a plugin as a session starts, so a session already open when the
mod was installed or updated loads it in the next one. The mod is the
workflows' upgrade layer and the engine's text menus their floor: a
`/leeway` that finds the mod not running — a session started before
the mod was installed or updated, mods turned off by `--safe-mode`, `--bare`,
`"disableAllHooks": true` or an organization's policy, or installed mods
switched off remotely by Anthropic — says so and carries on with typed menus;
one that runs on a Claude Code older than 2.1.287 stops and says why. Anywhere
else — the web, the VS Code extension, a Desktop session that runs in the
cloud, another entrypoint, a project without this directory — the workflows
carry on with the text menus and say nothing.

The Desktop app runs the session as an SDK host: the session starts drawing
nowhere and the app attaches after, so the band reads the screens attached at
each Bash call that states a gate, and the person's own message there arrives
as the host's (an `sdk` origin), which the band reads as theirs.

Claude Code can load the mod where it does not run — another entrypoint, or an
older Claude Code with function hooks switched on — so at the session's start
the mod applies the boot's rules: where `CLAUDE_CODE_ENTRYPOINT` is none of
`cli`, `claude-desktop` and `claude-desktop-3p`, `CLAUDE_CODE_REMOTE` is set,
or the version the session reports is older than 2.1.287 or not a release's (a
development build among them), it announces nothing, so it draws, keeps and
sets nothing — the menus stay text, and Claude Code runs as it would without
it.

## Handoffs

The mod also carries the workflows' handoffs: every move into work, which the
engine names with `engine handoff`, starts in a cleared conversation. At the
session's start, where it announces the gate surface, the mod announces that
it carries handoffs too (`LEEWAY_HANDOFF=1`, a variable of its own, which
the engine reads apart from `LEEWAY_GATE_SURFACE`). The engine then answers
a handoff with a `HANDOFF` payload beside the line naming where the work goes:
the continuation to send (``Invoke `/<skill> <args>`.``) and that line. The
payload on a Bash result of the conversation's own call — never a subagent's —
arms the handoff, and every call has it cut from what the model reads; the
line and the skill stay. As the turn ends the mod clears the conversation and,
in the conversation that follows, leaves what it sends with the line as
`sent.json` in that conversation's folder, then sends the continuation, which
Claude acts on there, and shows a toast naming where the work went
(`Handed off → Specification · auth-flow`) for eight seconds. The clear runs from
a timer started at the turn's end, whatever else there fails: a mod cannot run
a command inside a hook the turn waits on. A send that is dropped or fails
goes into the prompt box for Enter instead; where the box will not take it
either, the toast holds the continuation for the person to send, and stays
longer. A clear that fails sends in place, so the work still goes on. Esc on
the turn that handed off carries nothing: Esc means stop.
`leeway-gates-rows` draws the continuation's transcript row as the line.
Where the mod does not announce, the engine says so and the workflows invoke
the skill in the same conversation.

## What it sets in Claude Code

Every session in either app, from 2.1.287, starts with Claude Code's
`SendUserMessage` tool switched on (`CLAUDE_CODE_PEWTER_OWL_TOOL=true`):
Claude Code builds its tool list just after the session starts, so that is the
only moment the switch counts. The mod keeps the tool behind ToolSearch in
every such session, one answer that never changes and so never spends the
prompt cache; a plain session's tool list is Claude Code's own.

In a conversation that runs the workflows there, the mod sets
`CLAUDE_CODE_THINKING_DISPLAY_UPDATES=false`, which stops one-line summaries of
Claude's thinking printing as if they were output, and
`CLAUDE_CODE_SILENT_TURN_REMINDER=false`, which stops the nudge to say what
Claude is doing; project settings cannot set the second. Claude Code reads
both per request. Every engine call marks the conversation that made it — a
`workflow` file in its folder, named by the session id Claude Code hands every
command — and the mod reads that mark by its own session id after each of the
conversation's Bash calls and when it starts, so a command that only mentions
the engine marks nothing. What the settings replace, the person's own value or
none, is kept in the process's environment (`LEEWAY_HARNESS_REPLACED`),
which a reload of the mod's files keeps, and a `/clear` or a resume puts it
back exactly — except the clear a handoff runs, which leads into a workflow
conversation by construction and so leaves the workflow values on, the
person's own put back as that conversation ends. A marked conversation gets
the workflow values back when the mod next follows it, whether
`claude --resume`, a restart or `/resume` in the same process brings it back.
A plain conversation in the same project keeps Claude Code's defaults and the
person's own settings: the mod never touches either there.

## What the spinner says

In a session that announced, in a conversation the engine has marked, on the
terminal app and the Desktop app, the spinner keeps Claude Code's animation
and ellipsis, its word the phase the conversation works in — `Discussing`,
`Specifying`, `Implementing task 2.3` with one task in flight and
`Implementing 3 tasks` with several, `Shaping` in discovery and the
product's conversation, `Roadmapping` — from the position the engine keeps in the
conversation's folder (`position.json`). The drawing alone changes, never what
Claude reads. The mod reads the position once for each conversation the
spinner draws in, and again after each engine call that moves it (`enter`,
`session label`, `session repair`, `boot`, `task start`, `task done`, `task
close`), never per frame. At a work unit's menu or the start
menu it keeps Claude Code's word, and on the Desktop app a step that names
itself (`Creating notes.md`) keeps its words.

## How it compacts a workflow conversation

Claude Code compacts a workflow conversation as it compacts any other — its
summary, and the recent messages it keeps as they were, the person's waiting
message among them — and the mod appends one message last: the engine's
`conversation position` note. It says the conversation was just compacted and
where it is working, the work unit named by its work type, then what to do
before anything else. In discussion the note carries the recovery whole: the
skill and its framework re-read in full, the topic's record and its log, the
log caught up from the conversation's transcript, then carry on from where the
conversation was, as if the break never happened. In a phase whose skill keeps
its own "Resuming After Context Refresh" steps, it tells Claude to follow
them — the skill and its framework re-read in full, then the topic's
documents, each by its absolute path — and those steps end by carrying on.
A `/compact` starts no turn of its own, so after one the mod sends a short
continuation once the command is done — into the prompt box for Enter where
the send is dropped — and Claude follows the note without the person typing
anything.
Words typed after `/compact` go to Claude Code's summary as they always do.

Claude Code stores the note as an ordinary user row and would draw it as a
prompt the person typed. So the mod records every note it hands up in the
conversation's folder as `compacted.json`, each with the place the engine
names (`fumi › discussion › management-window`), and `leeway-gates-rows`
draws the note's row from it as one dim line.

It does so in a session that announced, in a conversation the engine has
marked, in its main loop, at a position that names a skill. A subagent's
transcript, a plain conversation, a work unit's menu or the start menu, a
place no longer open, and an engine that cannot answer all compact as Claude
Code does, with nothing appended; so does a compaction Claude Code skips. The
compaction Claude Code computes ahead of time passes through untouched, and
the compaction that comes reuses it beneath the note.

## How it keeps each task's builder and reviewers

A build runs several tasks at once, each dispatching one builder agent and a
pair of reviewer agents, and sends the task's later rounds — a fix to the
builder, a re-review to the pair — to those same agents by their ids, so they
keep what they learned. In a session that announced, in a conversation the
engine has marked, when the main loop dispatches `leeway-builder` or
`leeway-reviewer` with its brief's pointer (`brief:{id}`), the mod hands the
agent id the dispatch answers with, foreground or background, and the brief's
id to the engine's `conversation builder`, which records it on the position
against the task the brief was issued for — a builder in place of any before
it, a reviewer beside the pair's other; with that task not in flight it
records nothing. The ids ride with their task and go when it ends, so a compaction's note names each task
with its agents (``on task 2.3 (internal id `ledger-2-3`), its builder agent
`aa76bd7f82a2ef3e4`, its reviewer agents `ab12` and `cd34` ``) and the next
round continues them rather than dispatching fresh ones. Another agent, a
build's agent whose prompt is not its brief's pointer alone, a subagent's own
dispatch, a dispatch that was refused or errored, a plain conversation and a
session that did not announce record nothing, and whatever the engine
answers, the dispatch's result is Claude Code's own.

## The workflows board

In a session that announced, in a conversation the engine has marked, the mod
draws the workflows board: a banner on the band's last line, directly above the
prompt, and a pane beside the conversation, its tab titled `workflows` — beside
sitrep's where both are open. Anywhere else nothing draws, and nothing draws
while another screen — Remote Control's, say — is attached beside the band's.

The banner names the work and where it stands: the session's mark — ◐ running,
⚑ waiting on you, ✓ done, none where neither — the work's name in bold, then
its facts in grey, each one that waits on you in peach behind a ⚑ — the
messages waiting in a topic, and at a unit's menu what waits on you there,
peach with no ⚑ — and at its right the buttons Ready to discuss gives it
(below), then `▸ show board` while the pane is hidden, `hide board` while it
is up. A banner too long for the band is cut from its right end, its buttons
kept. It sits beneath a gate's rows, which are drawn in the rows it leaves; a
survey holds the band alone.

The pane has three tabs: `⌂ This session`, the unit's own (`≡ {unit}`), and
`≡ All work`. This session shows the most specific place the session is, and
follows it as its position moves; a page opened over a tab — a task, an entry,
another unit — is read in the unit it was opened in and stays until back is
pressed, however the session moves beneath it, to the start menu or another
unit. A page whose target has gone says why, beneath the way back, and stays.
Where the engine refuses what the pane asks — a ref it cannot read, a unit gone
from the project — the pane unwinds a level at a time, each page and then the
unit's tab, to This session's top, which asks nothing of the pane's; a read
that times out moves nothing. Back names what it returns to: the page under it,
else what the tab shows beneath it now. A tab opens at its top. Docked beside a
fullscreen transcript the pane has the full height; inline above the prompt it
draws the same lines spread to its width. Each view and page is drawn by its
kind (`hooks/views/`), with the drawing kit (`hooks/draw.ts`): colours with one
meaning each — peach waits on you, seafoam runs, sage is done, rose failed,
slate has not started, lavender this view and every button — a section's
heading with its rule and count, one line per item, its state at the right, a
complete section folding to its heading. A line whose words say what is
happening or what waits — a facts line, a progress line, a unit's standing —
wraps under its mark or indent rather than lose them at the edge; a title
gives way with "…". A topic under way that a session is in turns its ◐ in
seafoam; one no session is in is sky blue and still.

In the build, This session shows the build's progress, then what waits on you,
each question with its `▸ discuss`, then the phases, each task on its line with
its state at the right. A task opens its page: its standing, the evidence its
runs gave, what it does, what it fixes, the questions it waits on, what was
done and what differs from the task, its reviews and Claude's calls, each a
press away, a scenario opening on what its run drove and checked and the
evidence kept with the run. The page holds its questions wherever the session
goes; each has its `▸ discuss` while the session is in the task's unit, the
discussion being the session's. In the review phase it shows the round: each
area's read, the fix tasks a failing round brought, what was found, the
checks not proven, what went to the inbox and the verdict, and what waits on
you: the review's own questions, as the build's do, and finish once the
review is over and no question waits; a finding opens its page, while the
round is read as its reviewer's report holds it. A line whose
words carry a state, a standing or what waits on you wraps under its mark and
is never cut at the edge; only a title gives way, with `…`.

Both draw the board's model as `engine board <session-id>` answers it for where
the person is on the pane (`--tab`, `--unit`, `--page`, `--page-unit`): read
afresh after every engine call, the conversation's or a subagent's, without
holding up the call's result; on every press that moves the pane; and once for
each conversation the board draws in — the session's first, a `/clear`'s or a
resume's. Each read is one call, and the reads asked while one runs are
answered by one more after it. Nothing is read on a clock: while the pane is
up, what runs turns its ◐ a quarter every 250 ms and its clock ticks each
second, from the model already read; while it is hidden, nothing turns.

The model is versioned. A version the mod does not know is refused rather than
drawn wrongly: no banner, and the pane says so in a line. An engine that
refuses what the pane asks unwinds it to This session, which is drawn; one
that refuses This session itself, or fails, draws nothing. The conversation
gets every summary and question whether the board is up or hidden, and
nothing the board does fills the prompt box.

### Ready to discuss

The questions waiting on the person in a build are a mailbox the board shows
and never answers. Each has `▸ discuss` beside it in WAITING ON YOU, whose
heading carries `▸ discuss all` while more than one waits and any is neither
queued nor under discussion, and the banner
carries `▸ discuss` for one question or `▸ discuss all` for several. A press
queues the question in READY TO DISCUSS — `discuss all` every one waiting not
yet queued, oldest first — and its row reads `queued ▸ unqueue`; `▸ unqueue`,
a queued row's `✕` and the box's `▸ cancel all` take questions back out. None
of these says anything to Claude. The box is the same on every tab: docked,
it stays at the pane's foot while what is above it scrolls, the pane moving
that itself; inline, it follows the list, and Claude Code scrolls the whole
board.

`▸ send to Claude`, in the box or on the banner, sends the box as one message
in the order it was queued — `Ready to discuss Q1: {the question}` for one,
`Ready to discuss {all }N waiting questions, in this order: Q1, Q2, Q3.` for
several — and those questions become the discussion: the one under discussion
and those after it, which a box sent meanwhile joins at the end (`Also ready
to discuss Q2, after Q1.`). While one is discussed the banner names it and
the task it parks, with `▸ skip` and `▸ cancel all` while more follow it,
else `▸ cancel`; on the board it reads `being discussed` with the same
button, the ones after it name the one they follow, and WAITING ON YOU's
heading carries `▸ cancel all`. `▸ skip` sets it back to waiting and moves to
the next (`Skip Q1 for now; it stays waiting. Next: Q2.`); a cancel sets it
and every one after it back (`Set Q1, Q2 aside; they stay waiting.`). Each of
these sends exactly one line, and nothing else on the board sends anything.
A line Claude Code drops leaves the box and the discussion as they were, and
a second press while one is being sent sends nothing more.

The mod keeps the discussion in the conversation's folder as
`discussing.json`, `{"discussing", "queue"}` by question number, which the
engine's `raise` reads for the next question its receipt names; the box is
the board's alone and is never kept. A receipt from the conversation's own
`raise answer` or `raise aside` saying a question was answered or set aside
takes it out of the discussion, the next after it then under discussion; "I
don't follow", a draw and a subagent's call leave it as it stands. What waits
is always the engine's: a question the board's model no longer lists leaves
the box and the discussion wherever it stood. A conversation picked up again
— a restart, a reload, a resume — finds its discussion as its folder keeps
it.

## Working on it

    npm run test:mod        # claude plugin test

`test:mod` runs the suites against the installed Claude Code. Claude Code
lays its own build's API declarations into a mod's `.claude-plugin/types/`
whenever it loads the mod for development, with a `tsconfig.json` this mod's
own extends, so an editor reads the mod's types once a session has loaded it;
the folder ignores itself.

The suites run on Claude Code 2.1.287 or newer, where mods are on by
default.
