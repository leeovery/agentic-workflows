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

RECORDED ACTIONS — every tool call the walker made, in order, captured by a
harness hook as it happened: the intent before each call, the result
after it (`→ ok:` with the output, truncated), and any failure. The
walker did not write this and could not have edited or omitted from it.
This is what the walk *did*, and what each command actually returned.

A claim about what a command produced — that a gate rendered empty, that
a menu was absent — is settled here, not by the walker's account of it.
Where the account describes an output the record contradicts, the record
wins and the discrepancy is itself worth reporting.

An output ending `…[truncated]` was cut by the recorder, not by the
command: it settles what appears before the cut and nothing about what
followed it. Never read absence into a truncated output — a row missing
from a cut JSON list is unrecorded, not absent.

An `Agent` row is a dispatch the harness held (`→ held`, with the call's
id): it sits in sequence with the calls around it, and what it carried
is under DISPATCHES.

{{actions}}

=== dispatches ===

DISPATCHES — every agent the walker dispatched, in the order it made the
calls, recorded whole by a harness hook at the moment of each call: the
agent, whether it ran in the background, and the prompt it carried,
uncut. The hook held each one — recorded it and refused it — so no agent
ran; what stood in for each is in the recorded actions and the walk.

A claim about what a dispatch carried — which inputs, which paths, the
background flag — is settled here, never by the walker's account of it.

{{dispatches}}

=== checks ===

DETERMINISTIC CHECKS — run by code over the recorded actions, before you
saw this case. The verdicts below are computed, not judged.

They exist because a world can be reached without following the prose: a
walk that ignored the instructions and wrote the expected files directly
lands the same state as one that earned it. Only the order of what was
done separates them.

Take each verdict as given. A FAIL here is a failure of the case, and you
may not overturn it, explain it away, or weigh it against the walk — the
walk is the walker's account, and these are not. Report every one in your
verdict.

{{checks}}

=== scope ===

UNDECLARED PROSE — files this walk opened that the case does not list,
computed from the record.

The case's file list decides whether editing a file selects this case for
a run, so prose missing from it can be changed without the test that
covers it ever running again. This is a finding about the case, never
about the prose or the walk: report it under markers and let it affect
nothing else.

{{scope}}

=== substitutions ===

HARNESS SUBSTITUTIONS the case armed for this walk. Where the recorded
actions show the walker doing one of these itself — writing a report an
agent would have produced, for instance — that IS the substitution, and
it is expected, following the held dispatch it stands in for.

{{substitutions}}

=== walk ===

THE WALK, TURN BY TURN — the walker's own account as it was told at the
time, lifted from the runtime's transcript by the harness. It was not
summarised, and the walker had no chance to edit it after the fact.

Read it for what only it can show: which section or arm was entered and
the guard line that selected it, the blocks emitted to the user, the
questions asked and the scripted answers consumed. What a command ran and
returned is settled by the recorded actions above, not here.

{{walk}}

