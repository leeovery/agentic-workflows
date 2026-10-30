# Spikes and Assets

*Reference for **[leeway-discussion-process](../SKILL.md)***

---

What informs a decision lives in the unit as a file, linked from the ledger entry it informs. The asset verb never moves a file: write it where it lives, then link it by its path from the state root.

## A Spike

A spike is anything to look at or press that is never wired into the product — a design board, a constrained design generator, draft code, a format trial, a prototype to scroll and feel — whatever its size. Spikes are encouraged: they settle what guessing would not.

`asset spike {work_unit} {slug}` starts one and answers its folder and the folder's twin under the cache. The source goes in the folder as it is written, a design spike's rounds in `round-N/` inside it; dependencies, builds and run output go in the cache twin.

A spike is evidence only for what the person reviewed in it: scaffolding nobody discussed is never cited as decided. The record states what a spike settled and points at the file, never re-describing it. Where an entry and the design it points at disagree, the entry wins on what exists and how it behaves, the design on how it looks.

## Linking

`asset add {work_unit} {path} --entry {id} [--status {status:[canonical|reference]}]` links a file to an entry, with the status you propose:
- **canonical** — the spec carries it and the builder builds to it: linked from a decision.
- **reference** — the builder consults it before re-solving anything it covers: linked from a finding, or for what the log tells. A spike's file is reference unless said.

The person changes a status in their own words, any time: `asset status {work_unit} {path} {status}`. Your own spike's files are linked as reference to the call they settled, so what you decided without the person shows how you found out.

## A Design Lock

A design spike ends in a lock: "which design?" is a question on the map, closed by the person's choice — a decision linking the chosen design canonical where it lies, never a copy. The designs that lost stay reference, the reason they lost in the log. Nothing tracked is deleted; only the cache's output may go. A later spike that challenges the lock states its hypothesis, and a decision replacing the lock gives its reason.

## Lifting Spike Code

A piece of spike code lifted into the product is recorded, never drift: `asset lift {work_unit} {path} --into {path_in_project} --entry {id}`.

## A Shared File

A file the person shares is saved to `.leeway/{work_unit}/assets/` and linked from the entry it informs. A design living in an outside tool is kept as both: its exported image saved and linked, its live link in the linking entry. A path that names no file is asked about again, to be corrected or skipped, before anything lands; an image pasted with no file behind it is asked for as a saved file.
