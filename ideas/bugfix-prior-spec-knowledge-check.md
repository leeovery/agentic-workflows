# Bugfix: Check Prior Specs via Knowledge Base Before Locking Fix

## The Idea

During bugfix investigation (or possibly early specification), explicitly query the knowledge base for prior specifications, discussions, and investigations that touch the affected feature/code. Surface them to the user before the fix approach is locked in.

## Why This Matters

A bugfix that fixes the bug but breaks something else isn't a fix. The proposed approach must not undo behaviour that was deliberately put there.

The knowledge base now contains the project's accumulated specifications. It already knows *why* the affected code looks the way it does — what edge cases were already solved, what workarounds were considered, what non-obvious inclusions or exclusions were intentional. Right now nothing in the bugfix flow forces this context to surface. The fix gets designed against the bug symptom and the local code, not against the historical reasoning.

This catches a specific class of regression: the fix unknowingly reverts a previous deliberate decision. Exactly the failure mode prior specs were written to prevent.

## What the Check Would Do

1. After root cause is established, query the knowledge base keyed on the affected files / feature / module
2. Pull back any prior specs, discussions, or investigations that reference that area
3. Present them to the user with a flag for anything that looks load-bearing for the proposed fix shape
4. Ask the user to confirm the fix doesn't trample any of it before proceeding to specification

## Design Consideration

Placement is open. Late investigation feels natural — the fix shape often emerges there, so surfacing prior context at that moment lets the root-cause analysis land against the right backdrop. Early specification is also defensible — that's where the approach gets formalised, and a prior-spec check could gate the spec from being written without it. Investigation feels marginally better because it informs the shape rather than validating it after the fact.

Should also degrade gracefully when the knowledge base is in stub/keyword-only mode — the query still runs, just less precisely, and the user is told the mode.
