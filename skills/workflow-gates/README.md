# workflow-gates

A Claude Code mod that draws the workflow engine's gates in the band above the
prompt instead of leaving the model to reproduce them.

The engine states each gate as data beside the menu it composed. This mod
announces itself at the session's start so the engine collects that data, arms
the gate off the Bash result that carried it, cuts the menu out of what the
model reads, and draws the rows where they stay put while the transcript
scrolls; while any screen but the terminal is attached, it leaves the menu as
text so every screen shows it. Nothing in the workflows' prose changes.

A click on a row puts its answer in the prompt box; a second click on it sends
it as the next message, which is what the workflows already read. Once a click
has given the band the keyboard, the arrows move between rows, Enter or a row's
own key picks, and Enter on the picked row sends. A sent answer enters under
the plugin's name, framed for the model and labelled in the transcript as the
plugin's; the mod leaves what it sent in `.workflows/.cache/.gates/sent.json`.
Typing still answers: a key and Enter at the prompt, or Esc then Enter after a
pick. Rows only typing can answer — Ask, Comment, a range — draw dim, and a
click on one says to type it in the prompt. The footer under the rows says
which: how to answer, what is in the prompt, or where to type.

Esc on the turn an answer started puts its gate back, dropping whatever that
turn drew, as long as no tool has run in it; once one has, the band stays
empty, since the mod cannot tell a read from a write. A turn the person did
not start — a background agent's report, a scheduled prompt — that ends
without a gate of its own puts back the gate still waiting on them. A `/clear`
takes the gate off the band.

The engine emits the menu regardless, so a mod that is off or absent leaves
the text menu exactly as it was.

`/workflow-start` asks once per project, before its start menu, whether to
turn this on, and records the answer; it is the only thing that asks.

## Working on it

    npm run mod:types       # fetch the API declarations into types/ (gitignored)
    npm run typecheck:mod   # tsc against those declarations
    npm run test:mod        # claude plugin test

The declarations come from the Claude Code repository and are regenerable, so
they are not committed. Fetch them before the first typecheck.

Function hooks are early access: the test script turns them on for itself, and
until they ship generally nothing loads this mod without
`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` in the project's settings.
