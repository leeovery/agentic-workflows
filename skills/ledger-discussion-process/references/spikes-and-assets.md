# Spikes and Assets

*Reference for **[ledger-discussion-process](../SKILL.md)***

---

What informs a decision lives in the unit as a file, linked from the ledger entry it informs. The asset verb never moves a file: write it where it lives, then link it by its path from the state root.

## A Spike

`asset spike {work_unit} {slug}` starts one, answering `spike`, its name, `path`, its folder from the state root as a link names it, and `folder` and `cache`, that folder and its twin under the cache. The source goes in `folder` as it is written, a design spike's rounds in `round-{N}/` inside it; dependencies, builds and run output go in `cache`.

## Linking

`asset add {work_unit} {path} --entry {id} --status {status:[canonical|reference]}` links a file to an entry, with the status you propose:
- **canonical** — the spec carries it and the builder builds to it: linked from a decision.
- **reference** — the builder consults it before re-solving anything it covers: linked from a finding, or for what the log tells.

Your own spike's files are linked with the status reference to the call they settled, so what you decided without the person shows how you found out.

## A Design Lock

A design spike ends in a lock: "which design?" is a question on the map, closed by the person's choice — a decision linking the chosen design canonical where it lies, never a copy. The designs that lost keep the status reference, the reason they lost in the log. Nothing tracked is deleted; only the cache's output may go. A later spike that challenges the lock states its hypothesis, and a decision replacing the lock gives its reason.

## Lifting Spike Code

A piece of spike code lifted into the product is recorded, never drift: `asset lift {work_unit} {path} --into {path_in_project} --entry {id}`.
