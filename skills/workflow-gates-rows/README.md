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
way. The folder goes once Claude Code has deleted the conversation's
transcript, and the lines with it, with two exceptions: a conversation whose
end the session-end hook never saw — the session that first installed the
hook, or one that crashed — keeps its folder, and one resumed from another
directory takes its transcript to that project, so its folder in the old one
goes at that project's next boot. The mod names the folder the way the
workflows' engine does. A conversation that does not run the workflows has no
folder: there the mod writes nothing and draws the row as Claude Code does.
