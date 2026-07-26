The prose should have taken this path:

1. loads the shared casing conventions before any state is read
2. runs the boot pipeline as a single engine call
3. the response reports no migrations applied — this world is already
   migrated — so the migrations summary and its confirmation gate are
   not raised, and the skill says so rather than stopping
4. the response reports the knowledge base ready, so the knowledge gate
   is not entered and initialisation completes

Further claims:

- booting an already-migrated project changes nothing on disk
- the user is asked nothing: neither gate in initialisation can fire
  against a world that is already migrated and already has a store
