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

=== transcript ===

The walk's transcript follows under `=== TRANSCRIPT ===`.
