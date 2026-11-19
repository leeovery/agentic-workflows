---
name: ledger-keep
description: Use whenever something of substance comes up in this project, in any conversation, to keep it where Ledger keeps it — an idea, a bug or a fix for later, a view of the product or a direction dropped, a fact about the code or the platform, a reference or a file shared, a point for work under way.
user-invocable: false
allowed-tools: Bash(node .claude/skills/ledger-engine/scripts/engine.cjs *)
---

Keep each thing of substance where it goes below, the moment it settles, then carry on where the conversation was. What is kept is the person's own words or a fact checked, never a suggestion of yours they did not take up; their word keeps a thing or drops it. What this conversation's own Ledger work records stays with that work.

Every call is `node .claude/skills/ledger-engine/scripts/engine.cjs {verb} …`; emit any section it answers per its marker. A value in single quotes writes a single quote inside it as `'\''`.

## Where Each Kind Goes

- **An idea, a bug or a fix for later** — the inbox, as an H1 title over as much as was said, up to 500 words, 300 for a fix, never padded; `quick-fix` is settled work needing no decision. Where it concerns another Ledger project, add `--project {folder}`, that project's folder:

  ```bash
  node .claude/skills/ledger-engine/scripts/engine.cjs inbox capture {kind:[idea|bug|quick-fix]} [--project {folder}] <<'ITEM'
  {text}
  ITEM
  ```

  One the person places in time goes on the roadmap instead, on the horizon they name; where they named none, ask which in a line, naming those `roadmap state` lists: `roadmap add {name} --horizon "{horizon}" --summary "{summary}" [--kind {kind:[bug|quick-fix]}] --origin park:product`.
- **A view of the product** — a principle, a direction, who it is for, a constraint, a lean, as the person's → `discovery-log view product --text '{view}'`.
- **A direction dropped**, with why → `discovery-log not-taken product --direction '{direction}' --why '{why}'`.
- **A spike** — its files in the folder `asset spike product {slug}` answers; what it showed → `discovery-log spike product {spike} --tool '{tool}' --showed '{what it showed}' [--link {live link}]`.
- **A fact about the code or the platform**, with how it is known → `ledger find product.discovery`, `{"text", "how", "known", "by": "claude", "who_moved_whom": "none"}` on stdin, with `command` and `result` for one measured.
- **A reference** — what it shows, as a finding `"known": "documented"`, its link the `how`. A file shared → `asset import product '{path}'`, then `asset add product {path} --entry {id} --status reference`, `{id}` the finding's.
- **A point for a topic of work under way, before its spec**, on the person's stated intent — what was found or said, and what the topic is asked to decide — written to `.ledger/.cache/product/discovery/product/message-{slug}.md`, its first line the title → `topic send {work_unit} {topic} --from product --content .ledger/.cache/product/discovery/product/message-{slug}.md --slug {slug}`, then `render send-report {work_unit}.{topic} --sent {path}`, the path the send answered. Past its spec, the work's own conversation settles it.

## A Migration Owed

A call refused because this checkout owes Ledger's migration: say Ledger has been updated and its migration runs first, and ask. On the person's yes, read the start skill, **[SKILL.md](../ledger/SKILL.md)**, and run boot as its **Boot** says, with no words, each stop carried out as **Boot's Stops** says; once boot answers `go`, work its `migration-review` gate alone, as **The Setup Gates** says, and nothing else of the start. Then make the call again, and carry on where the conversation was.
