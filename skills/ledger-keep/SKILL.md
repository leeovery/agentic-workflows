---
name: ledger-keep
description: Use whenever something of substance comes up in this project, in any conversation, to keep it where Ledger keeps it — an idea, a bug or a fix for later, a view of the product said in passing or a direction dropped, a fact about the code or the platform, a reference or a file shared, the project's setup or an instruction for working in it, a point for work under way.
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

  One the person places in time goes on the roadmap instead, on the horizon they name; where they named none, the horizon is theirs, among those `roadmap state` lists: `roadmap add {name} --horizon "{horizon}" --summary "{summary}" [--kind {kind:[bug|quick-fix]}] --origin park:product`.
- **One of those dropped at their word** → `inbox archive {path}`, the path the capture answered, or `roadmap archive {name}` for an item with no work behind it.
- **A view of the product said in passing** — a principle, a direction, who it is for, a constraint, a lean, as the person's → `discovery-log view product --text '{view}'`.
- **A direction dropped**, with why → `discovery-log not-taken product --direction '{direction}' --why '{why}'`.
- **A spike** — its source in the folder `asset spike product {slug}` answers, its dependencies, builds and output in the cache twin it answers beside it; what it showed → `discovery-log spike product {spike} --tool '{tool}' --showed '{what it showed}' [--link {live link}]`.
- **A fact about the code or the platform**, with how it is known — where this conversation works a piece of Ledger's work, at that work's place as its phase records one; else → `ledger find product.discovery`, `{"text", "how", "known", "by": "claude", "who_moved_whom": "none"}` on stdin, `known` one of `read` in the code, `documented` with its source, or `exploratory` with `command` and `result`.
- **A reference** — what it shows, as a finding `"known": "documented"`, its link the `how`. A file shared → `asset import product '{path}'`, then `asset add product {imported} --entry {id} --status reference`, `{imported}` the path the import answered and `{id}` the finding's.
- **The project's setup** — how it builds, tests and runs, what a worktree needs, what cannot run at once, its linters, on the person's yes → `environment show`, then `environment set {part:[run|prepare|concurrency|linters]}`, the part whole as JSON on stdin.
- **An instruction for working in this project** — a rule or a gotcha of its code, not of the product, on the person's yes → a line in its `CLAUDE.md`. Where this conversation holds a build or a quick-fix, the line is a one-line task of that work, committed through the door as that work commits one; else commit the person's line on its own, `git add CLAUDE.md && git commit -m "{message}" -- CLAUDE.md`.
- **A point for a topic of work under way, before its spec**, on the person's stated intent — what was found or said, and what the topic is asked to decide — written to `.ledger/.cache/product/discovery/product/message-{slug}.md`, its first line the title → `topic send {work_unit} {topic} --from product --content .ledger/.cache/product/discovery/product/message-{slug}.md --slug {slug}`, then `render send-report {work_unit}.{topic} --sent {path}`, the path the send answered. Past its spec, the work's own conversation settles it.

## A Migration Owed

A call refused because this checkout owes Ledger's migration: say Ledger has been updated and its migration runs first, and ask. On the person's yes:

Load **[boot.md](../ledger/references/boot.md)** and follow its instructions as written from its `boot` call, with words = none — no banner.

Once boot answers `go`, where its `gates` name `migration-review`:

Load **[migration-review.md](../ledger/references/migration-review.md)** and follow its instructions as written.

Nothing else of the start runs. Then make the call again, and carry on where the conversation was.
