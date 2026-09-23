# workflow-gates

A Claude Code mod that draws the workflow engine's gates in the band above the
prompt instead of leaving the model to reproduce them.

The engine states each gate as data beside the menu it composed. This mod
announces itself at the session's start so the engine collects that data, arms
the gate off the Bash result that carried it, cuts the menu out of what the
model reads, and draws the rows where they stay put while the transcript
scrolls; while any screen but the terminal is attached, it leaves the menu as
text so every screen shows it, though a screen that attaches after a menu was
drawn on the terminal does not get that menu. The workflows' prose never names
the mod.

A click on a row puts its answer in the prompt box; a second click on it sends
it as the next message, which the workflows read as the answer. Once a click
has given the band the keyboard, the arrows move between rows, Enter or a row's
own key picks, and Enter on the picked row sends. A sent answer enters under
the plugin's name, framed for the model and labelled in the transcript as the
plugin's; the mod leaves what it sent in `.workflows/.cache/.gates/sent.json`.
A second plugin, `workflow-gates-rows` (`../workflow-gates-rows/`), reads that
record to draw the row as the question and the answer, since no plugin can
redraw the row of a prompt it submitted. Typing answers too: a key and Enter
at the prompt, or Esc then Enter after a pick. Rows only typing can answer —
Ask, Comment, a range — draw dim, and a click on one says to type it in the
prompt. The footer under the rows says which: how to answer, what is in the
prompt, or where to type.

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
band shows — the gate, or nothing — in its own store, stamped with where the
transcript ends, not counting the lines Claude Code writes around an
interrupted turn. A conversation resumed with `claude --resume` or `/resume`,
or picked up again by a restart or a reload of the mod's files, gets its gate
back as long as its transcript still ends there, with nothing picked or held —
a held answer waits on a turn that does not come back; one that moved on while
the mod was not loaded gets nothing. A session the mod was loaded into after it
started carries no announcement, so there it keeps and reads back nothing. The
store holds at most one entry per conversation, and each session's start drops
any older than 30 days, how long Claude Code keeps a transcript unless told
otherwise.

The engine emits the menu regardless, so where the mod is off or absent the
model reads the text menu the engine wrote.

The mod is part of the workflows, and nothing asks whether to use it: every
`/workflow-start` puts `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` into the `env` of
the project's `.claude/settings.json` where it is missing. Claude Code reads
its settings only when it starts, so a start that writes it while the mod is
not yet running ends by asking for a restart, and the next session loads the
mod.

## Working on it

    npm run mod:types       # fetch the API declarations into types/ (gitignored)
    npm run typecheck:mod   # tsc against those declarations
    npm run test:mod        # claude plugin test

The declarations come from the Claude Code repository and are regenerable, so
they are not committed. Fetch them before the first typecheck.

Function hooks are early access: Claude Code loads this mod only where
`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` is set, in the `env` of any of its
settings files or in the shell, and the test script sets it for itself.
