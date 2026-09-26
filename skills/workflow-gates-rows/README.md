# workflow-gates-rows

A Claude Code mod that draws the transcript row of an answer the
`workflow-gates` mod sent as the question and the answer —
`Approve this task? → yes · Commit and continue to next task` — in place of
Claude Code's framing of a plugin's prompt. It is a plugin of its own because
Claude Code skips a plugin's own render hooks on the row of a prompt that
plugin submitted. It pairs a row with the record the mod leaves in
`.workflows/.cache/.gates/sent.json` as it sends; a row it cannot pair shows
the answer alone. It changes only the drawing: the model reads Claude Code's
framing, and ctrl+o shows the message in full.

Each line it draws is kept in the conversation's own folder,
`.workflows/.cache/.conversations/{session-id}/rows.json`, under the row's
message id, so scrolling back and a resumed conversation draw the row the same
way. The folder goes once Claude Code has deleted the conversation, and the
lines with it. The mod names the folder the way the workflows' engine does. A
conversation that does not run the workflows has no folder: there the mod
writes nothing and draws the row as Claude Code does.
