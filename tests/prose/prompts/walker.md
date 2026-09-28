The walker's per-case payload. Sections are delimited by `=== name ===`
lines and assembled by lib/prompts.cjs; `{{placeholders}}` are filled
from the case.

Only what varies per case lives here. How a walker behaves — follow
literally, never repair, never investigate, the markers, the transcript
format — is standing instruction and lives in
`.claude/agents/prose-walker.md`.

Nothing from `assert.md` may ever appear in this file or in anything
assembled from it. That is the boundary the design rests on.

Two sections are not part of the payload: `dispatch-held` and
`send-held` are the reasons lib/hold-dispatch.cjs refuses a walker's
Agent and SendMessage calls with — the walker reads each the moment it
makes the call, as the call's answer, its `{{agent_id}}` filled from the
held call rather than the case.

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

=== dispatch-held ===
The prose-test harness held this dispatch: the call is recorded as you
made it, and no agent was started. This is not the agent failing,
erroring or timing out — never take the prose's arm for an agent that
fails over it.

This agent's id is `{{agent_id}}`. Where the prose keeps the id a
dispatch returns, keep this one: a later round the prose sends to this
agent goes to it with SendMessage.

Carry on from exactly this point. Where an armed harness substitution's
WHEN names this dispatch, apply it now, record `SUBSTITUTED:`, and take
what it gives as this agent's return. Where none does, read this agent's
file under `.claude/agents/` and play the agent yourself with the inputs
you just passed, taking what it returns as this agent's return. A
dispatch the prose runs in the background returns now, in this turn —
never end your turn to wait for it.

=== send-held ===
The prose-test harness held this send: the message is recorded as you
sent it, and nothing was delivered. This is not a failed send — never
take the prose's arm for a send that fails over it, and never dispatch a
fresh agent in its place.

Carry on from exactly this point, as though the send was delivered.
Where an armed harness substitution's WHEN names this continuation,
apply it now, record `SUBSTITUTED:`, and take what it gives as the
agent's return. Where none does, go on playing the agent this send
continues, from where it left off, with what you just sent, taking what
it returns as the agent's return. A send to an agent the prose runs in
the background returns now, in this turn — never end your turn to wait
for it.
