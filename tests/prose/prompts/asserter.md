The asserter's per-case payload. Sections are delimited by `=== name ===`
lines and assembled by lib/prompts.cjs; `{{placeholders}}` are filled
from the case and the computed world delta.

Only what varies per case lives here. How an asserter behaves — quote or
it didn't happen, never explain a failure, volatile versus material, the
verdict format — is standing instruction and lives in
`.claude/agents/prose-asserter.md`.

=== main ===
WHAT THE PROSE SHOULD HAVE DONE:

{{expected}}

=== world ===

EXPECTED WORLD: {{expecting}}.

WORLD DELTA — the factual difference between the world after the walk and
the expected world, computed by code:

{{delta}}

=== actions ===

RECORDED ACTIONS — every tool call the walker made, in order, captured by
a harness hook as it happened. The walker did not write this and could
not have edited or omitted from it. This is what the walk *did*.

{{actions}}

=== transcript ===

The walk's own account follows under `=== TRANSCRIPT ===`. It is the
walker's narrative: evidence of reasoning — which arm it entered, which
guard it read, what it emitted — and nothing more. Where it disagrees
with the recorded actions about what was done, the recorded actions win.
