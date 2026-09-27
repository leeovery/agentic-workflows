# workflow-gates-rows

A Claude Code mod that draws the transcript row of an answer the
`workflow-gates` mod sent as the question and the answer —
`Approve this task? → yes · Commit and continue to next task` — in place of
Claude Code's framing of a plugin's prompt. It is a plugin of its own because
Claude Code skips a plugin's own render hooks on the row of a prompt that
plugin submitted. It pairs a row with the record the mod leaves in the
conversation's own folder as `sent.json` as it sends; a row it cannot pair
shows the answer alone. It changes only the drawing: the model reads Claude
Code's framing, and ctrl+o shows the message in full.

Each line it draws is kept in that folder,
`~/.config/workflows/conversations/{session-id}/rows.json` (under
`WORKFLOWS_CONFIG_DIR` where that is set, beside the workflows' system
config), under the row's message id, so scrolling back and a resumed
conversation draw the row the same way, wherever the session's working
directory has moved. The folder goes once Claude Code has deleted the
conversation's transcript, and the lines with it, with one exception: a
conversation whose end the session-end hook never saw — the session that first
installed the hook, or one that crashed — keeps its folder. The mod names the
folder the way the workflows' engine does. A conversation that
does not run the workflows has no folder, nor does one in a process that names
neither a home directory nor `WORKFLOWS_CONFIG_DIR`: there the mod writes
nothing and draws the row as Claude Code does.
