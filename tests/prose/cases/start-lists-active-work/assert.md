The prose should have taken this path:

1. loads the shared casing conventions before any state is read
2. runs the boot pipeline, and since no migrations applied and the
   knowledge base is ready, raises neither the migrations confirmation
   nor the knowledge gate
3. gets the workflow state from the discovery gateway script rather than
   listing directories or reading files itself
4. shows `pay` as the only active work, with a menu whose continue action
   leads into the per-type navigation for a feature

Further claims:

- showing work is a read: nothing is created, recorded, or committed
