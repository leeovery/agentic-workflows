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

=== structural ===
Structure-only walk: read the named prose and trace the logic. Execute
nothing — no commands, no writes.

Repository root: {{root}}

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
