The prose should have taken this path:

1. the empty project is shown as such, and starting an epic routes into
   discovery with the work unit given as `none`
2. the work type is put to the user at the gate and committed on their
   answer — the pre-seed is a hint, and the several interacting strands
   they describe are what makes it an epic rather than the menu key they
   pressed
3. a name is checked against existing work before anything is created,
   and one engine transaction then creates the work unit, installs the
   session log staged in the cache, and commits
4. resume detection is skipped: it answers whether an earlier session was
   interrupted, and work created moments ago cannot have been
5. the commit does not conclude the work as it would for a single-phase
   type — discovery is run for the new work unit, and the conversation
   carries on into topic territory

Further claims:

- the shaping conversation continues rather than restarting: the session
  the confirm-trigger opened is the one the work carries forward, and no
  second session log is authored

EXPECTED WORLD — the walk should have produced, from a project that held
no work at all:

- an epic work unit named `search-relevance`, in progress, registered in
  the project manifest alongside its own manifest
- a description drawn from what the user said about ranking signals,
  synonyms and measurement — not invented, and not narrowed to one of them
- exactly one discovery session log, `session-001.md`, naming no seeds and
  no imports
- that log recording the map as empty at the start of this first session,
  which is the epic's shape — not the "not applicable" a single-topic work
  type would carry
- the epic marked as having a discovery session open, which is the state a
  feature never acquires
- no topics anywhere: no map items, no research or discussion directories.
  The work unit exists and its topics have not been named yet
