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
Typing answers too: a key and Enter at the prompt, or Esc then Enter after a
pick. Rows only typing can answer — Ask, Comment, a range — draw dim, and a
click on one says to type it in the prompt. The footer under the rows says
which: how to answer, what is in the prompt, or where to type.

A turn the person did not start — a background agent's report, a
notification, a schedule — leaves the band as it is, its rows live, and so
does Esc on it. The band comes off when the person starts a turn or replies
into a running one, or when a turn draws a different gate over it. A second
click while Claude works holds the answer instead of sending it: its row reads
`· queued`, and the footer says it sends when Claude finishes. A click on the
queued row takes it back to a pick, and a click on another row picks that one
instead. As the turn ends, the held answer sends if the same gate is still on
the band; if the turn drew a different gate, the answer is dropped unsent and
the new gate's footer says so; if Esc stopped the turn, the answer goes back
into the prompt box as a pick. Typing while Claude works joins Claude Code's
own queue.

Esc on a turn an answer started or joined puts its gate back, dropping
whatever that turn drew, as long as no tool has run in it; once one has, the
band stays empty, since the mod cannot tell a read from a write. A `/clear`
takes the gate off the band.

At the end of every turn, and as the conversation ends, the mod keeps what the
band shows — the gate, or nothing — in its own store, stamped with where the
transcript ends. A conversation resumed with `claude --resume` or `/resume`,
or picked up again by a restart or a reload of the mod's files, gets its gate
back as long as its transcript still ends there, with nothing picked or held —
a held answer waits on a turn that does not come back; one that moved on while
the mod was not loaded gets nothing. The store holds at most one entry per
conversation, and each session's start drops any older than 30 days, how long
Claude Code keeps a transcript unless told otherwise.

The engine emits the menu regardless, so where the mod is off or absent the
model reads the text menu the engine wrote.

## Working on it

    npm run mod:types       # fetch the API declarations into types/ (gitignored)
    npm run typecheck:mod   # tsc against those declarations
    npm run test:mod        # claude plugin test

The declarations come from the Claude Code repository and are regenerable, so
they are not committed. Fetch them before the first typecheck.

Function hooks are early access: Claude Code loads this mod only where
`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` is set, in the `env` of any of its
settings files or in the shell, and the test script sets it for itself.
