# Bugfix: check prior specs via knowledge base before locking the fix

A bugfix that fixes the bug but breaks something else isn't a fix. It's deeply important that the proposed approach doesn't undo behaviour that was deliberately put there.

The knowledge base now contains prior specifications, discussions, and investigations. Before the bugfix flow locks in an approach, it should query the knowledge base for context on the affected feature/code: why does this code exist? What edge cases were already solved here? Were there workarounds we explicitly chose? Are there non-obvious inclusions or exclusions that the fix might trample?

Right now this doesn't happen robustly. There's no explicit step that says "before you commit to this fix, check what we already know about this code and why it looks the way it does." Adding that step would catch a class of regressions where the fix unknowingly reverts a previous deliberate decision — exactly the kind of thing prior specs were written to prevent.

Placement is open. Late investigation feels natural — the fix shape often emerges there, and surfacing prior context at that moment lets the root-cause analysis land against the right backdrop. Early specification is also defensible — that's where the approach gets formalised, and a prior-spec check could gate the spec from being written without it. Either is workable; investigation feels marginally better because it informs the shape rather than validating it after the fact.

A simple version: a single knowledge-base query keyed on the affected files/feature, results presented to the user with a flag for anything that looks load-bearing for the proposed fix.
