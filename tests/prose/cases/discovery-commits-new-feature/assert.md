The prose should have taken this path:

1. the empty project is shown as such, and starting a feature routes into
   discovery with the work unit given as `none` — new work has no name to
   pass until it is created
2. discovery reads the mode from that `none` and takes the new-work path,
   with no seed material to read
3. the pre-seeded work type is treated as a hint, not a given: the read is
   put to the user at a gate and only committed on their answer
4. a name is suggested, the user's own name is taken in its place, and it
   is checked against existing work before anything is created
5. the session log is authored into the cache, and one engine transaction
   creates the work unit, installs that log and commits — the log is never
   written into the work unit directory by the walk

Further claims:

- nothing is on disk before the transaction: every earlier step of the
  shaping is ephemeral, however much was said
- this is single-phase work, so no epic machinery runs — no discovery map,
  no topics, no session close

EXPECTED WORLD — the walk should have produced, from a project that held
no work at all:

- a feature work unit named `search-filters`, in progress, registered in
  the project manifest alongside its own manifest
- a description on it drawn from what the user actually said about saved
  filters, not invented
- exactly one discovery session log for it, `session-001.md`, in the work
  unit's `discovery/sessions/` directory
- that log naming no seeds and no imports, since the work came from
  neither
- no research, discussion, or any other phase directory: the work unit
  exists and nothing has begun
