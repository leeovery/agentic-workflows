The prose should have taken this path:

1. the empty project is shown as such, and starting a feature routes
   into discovery with the work unit given as `none`
2. discovery takes the new-work path, treats the pre-seeded feature
   type as a hint, and shapes from the user's description of the copy
   button
3. the read is stated as prose above the shape gate, and the prose
   stops for the answer
4. the answer is the other choice alone, naming no shape: the prose
   asks what the work is and stops again — no work type is set, no
   read is adjusted, and nothing is persisted on the bare choice
5. the user's next reply names the shape — a quick fix — and it is
   taken as authoritative, without re-litigating it
6. the name is the one the user gave while shaping — nothing is
   suggested back to them, and no gate asks them to confirm it
7. the session log is authored into the cache, and one engine
   transaction creates the work unit as a quick-fix, installs that log
   and commits; the walk stops as the prose turns to first-phase
   routing

Further claims:

- the shape gate is not re-rendered after the user names the shape:
  their call settles it
- this is single-phase work, so no epic machinery runs — no discovery
  map, no topics, no session close — and nothing routes to the roadmap

EXPECTED WORLD — the walk should have produced, from a project that
held no work at all:

- a quick-fix work unit named `copy-order-link`, in progress,
  registered in the project manifest alongside its own manifest
- a description on it drawn from what the user said about the copy
  button, not invented
- exactly one discovery session log for it, `session-001.md`, in the
  work unit's `discovery/sessions/` directory, naming no seeds and no
  imports, its Map State `(n/a — single-topic work)`
- no feature work unit, and no scoping or any other phase directory:
  the work unit exists and nothing has begun
