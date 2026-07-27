The walker's per-case payload. Sections are delimited by `=== name ===`
lines and assembled by lib/prompts.cjs; `{{placeholders}}` are filled
from the case.

Only what varies per case lives here. How a walker behaves — follow
literally, never repair, never investigate, the markers, the transcript
format — is standing instruction and lives in
`.claude/agents/prose-walker.md`.

Nothing from `assert.md` may ever appear in this file or in anything
assembled from it. That is the boundary the design rests on.

=== world ===
Project directory — your cwd for EVERY command: {{world_dir}}
The workflow skills are installed at .claude/skills/ inside that project.
Mutations are expected and safe: the project is a disposable test world.

=== situation ===

SITUATION — where the project stands as you begin:
{{situation}}

=== task ===

TASK
{{task}}

SCOPE — the prose under walk:
{{scope}}

=== answers ===

SCRIPTED USER ANSWERS — consume in order, one per question the prose asks:
{{answers}}

=== conduct ===

PLAYING THE USER — how they behave where the prose stops being scripted.

A scripted answer covers a question with one right response. Some prose
does not work that way: it explores, and keeps exploring until it judges
it has enough. There is no fixed number of turns to script, so this says
what kind of person is on the other side instead. Answer as they would,
in their words, for as long as the prose keeps asking.

It describes the user, never the walk. It does not tell you which arm to
take, when to stop, or what the prose ought to do — those are yours to
derive as always, and nothing here relieves you of following the prose
literally.

{{conduct}}

=== stubs ===

HARNESS SUBSTITUTIONS — these are NOT part of the process you are walking.
They stand in for steps this framework deliberately does not simulate.
Apply each only at the moment stated, then resume the prose exactly where
you left it.
{{entries}}

=== stub-entry ===

### {{name}}
WHEN: {{trigger}}
WHAT IT IS: {{description}}
CONTENT (write these exact bytes where the substitution calls for a file):
{{content}}
