# workflow-gates

A Claude Code mod that draws the workflow engine's gates in the band above the
prompt instead of leaving the model to reproduce them.

The engine states each gate as data beside the menu it composed. This mod
announces itself at the session's start so the engine collects that data, arms
the gate off the Bash result that carried it, cuts the menu out of what the
model reads, and draws the rows where they stay put while the transcript
scrolls. A press — a click, the row's own key, or Enter on the cursor — arrives
as the person's next message, which is what the workflows already read. Nothing
in the workflows' prose changes.

The engine emits the menu regardless, so a mod that is off, broken or absent
leaves the text menu exactly as it was.

The workflows' start menu asks once per project whether to turn this on, and
records the answer; it is the only thing that does.

## Working on it

    npm run mod:types       # fetch the API declarations into types/ (gitignored)
    npm run typecheck:mod   # tsc against those declarations
    npm run test:mod        # claude plugin test

The declarations come from the Claude Code repository and are regenerable, so
they are not committed. Fetch them before the first typecheck.

Function hooks are early access: the test script turns them on for itself, and
until they ship generally nothing loads this mod without
`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` in the project's settings.
