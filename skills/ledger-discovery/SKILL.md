---
name: ledger-discovery
description: Ledger's discovery phase, the product's conversation and an epic's. Reached only through a Ledger handoff, never invoked directly; work comes into Ledger through /ledger.
user-invocable: false
allowed-tools: Bash(node .claude/skills/ledger-engine/scripts/engine.cjs *)
---

# Discovery

Discovery is where the work takes shape before anything is committed to: talk, at one of two levels, each one conversation carried on across sessions.

- **The product's conversation** is about everything not yet started as work — what the product is, who it serves, where it is going. It leads to the roadmap, the person's timeline of what comes later, and to each piece of work started from it at start this work. A feature then goes to its discussion and a bugfix to its investigation, each a conversation of its own that opens from the brief written here; an epic carries on into its own discovery, and a quick-fix into its fixes.
- **An epic's discovery** is about the epic as a whole: what it covers, its topics and their order. A topic is a part of the epic that needs decisions of its own. Each gets a discussion, one conversation that opens from the topic's brief and decides it; once every topic is decided, cancelled or postponed, the decided ones make the epic's one spec, which is cut into phases and built. The map of topics lands at approve the map, and changes here until the spec is first written.

Discovery is not where decisions are made, though none is banned: what the person says is input, carried in the log and the briefs to the discussion that decides it.

## Arguments

- `$0` — **way_in**: `epic`, `feature`, `bugfix` or `quick-fix`, a piece of work the person brought as that kind, a hint to trust and confirm lightly once the description fits; `start`, a piece of work of no kind yet; `none`, the conversation itself.
- `$1` — **home**: an epic; or `none`, the product's conversation.
- `$2` — **seeds**: comma-joined inbox paths or `roadmap:{item}`s the work starts from, or into an epic the roadmap ideas joining it; `none` or absent, none.

`{home}` is `$1`, or `product` where `$1` is `none`.

## Instructions

Load **[framework.md](../ledger-shared/references/framework.md)** and follow its instructions as written.

## Done When

Start this work created the unit, approve the map landed the epic's map, or the session was closed. The product's conversation never finishes; its sessions do.

## Entering

Where `$0` is not `none`, the person brings a piece of work, and the entry is its type call, `--type-call`: it opens no session of the product's conversation and keeps no log, so work asked for in one window never stops or ends the product talk in another. The talk settles what kind of work it is, and start this work takes it from there. Should the person want the product's conversation instead, enter again without it.

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs enter discovery {home} [--type-call] [--seeds "{seeds}"]
```

The DATA names what there is to read; read what the work needs. Do what `catch up` says. Each `take in` is a waiting roadmap idea joining the epic as a new topic, added as Changing the Map says, with `--from-roadmap {item}`. Where `research owed` is `yes`, load **[researching-the-code.md](references/researching-the-code.md)** and follow its instructions as written.

## The Record

- **The log**, the DATA's `log` — what was said, kept as the conversation goes: what was explored, the person's leans, the paths dropped and why, the open questions, research with its sources, and a link to each spike and file. A return reads it, and briefs, roadmap items and new work point at its parts by anchor, so it is written under headings named for what they cover; `## Not taken`, `## Views of the product` and `## Spikes` are the engine's, written only through their doors. Before a session closes — start this work, approve the map, the session's end — and before a move to another level, the log is brought up to date and ends on a line saying where the conversation got to. The type call keeps none: what the person said reaches the work through start this work's payload.
- **The product picture**, `.ledger/.product/picture.md` — where the product stands now, the log being the journey there. Each return to the product's conversation reads it, and start this work thins it, moving the started work's detail out to the work. It decides nothing. It is rewritten in place as the talk moves on, re-read first, as another window may have rewritten it.
- **A brief** — what a topic's discussion opens from: what the log holds that bears on the topic, what a spike showed among it, each point linking the part of the log it came from. Nothing in it is decided. It is drafted in `.ledger/.cache/{home}/discovery/{home}/` and lands unchanged in the topic's folder, so its links are paths from the state root.
- **A record from before** — the person's work from before Ledger, where the DATA or the picture names it: notes, a decision log, a model of the product, research. Its points from before are where the person had got to, cited by the record's own ids and files; one becomes the person's view only once they take it up here, and until then its open questions stay open. A brief, a park, a direction not taken or a message carries a point by its id, and approve the map names each point nothing carries yet, for the person to place. A shared file is marked `reference`, searched when a point needs it and never read whole, or `to read`, read when the talk reaches it.

## Tools

- **Research** — for what talk alone cannot tell: online, in the code, in what exists, logged with its sources.
- **A spike** — to show rather than tell, as far as it needs to go: a design board, draft code, a full code example, a prototype to try. `asset spike {home} {slug}` answers its `spike`, the name its door takes, its folder, for the source, and a cache twin, for dependencies, builds and output. What it showed is logged, and lands as a new topic whose brief points at it, as messages to the topics it bears on, or as a direction not taken.
- **Earlier work** — what earlier work decided, `knowledge query "{term}" …`.

A spike's files and shared files are linked from the log: the link takes them into the state.

## Doors

Every call is `node .claude/skills/ledger-engine/scripts/engine.cjs {verb} …`; a `discovery-log` value is single-quoted, a quote inside written `'\''`. The product's views and directions not taken reach every topic's opening through the product record.

- A finding, what reading the code showed → `ledger find {home}.discovery`, `{"text", "how", "known": "read", "by": "claude", "who_moved_whom": "none"}` on stdin.
- A direction dropped, with why → `discovery-log not-taken {home} --direction '{direction}' --why '{why}'`.
- A view the person holds of the product as a whole → `discovery-log view {home} --text '{view}'`.
- What a spike showed → `discovery-log spike {home} {spike} --tool '{tool}' --showed '{showed}' [--link {live link}]`, `{spike}` as `asset spike` answered it, the link where it lives in an outside tool.
- A point from before met in an epic → `discovery-log from-before {home} --id '{id}' --point '{point}' --file '{file}'`.
- An inbox item the person has had fixed outside any piece of work → `inbox close none {path}`.

## What Already Waits

The roadmap's waiting items (`roadmap state`) and the live inbox (`.ledger/.inbox/`) may hold the work taking shape already. A match, by name or theme, is offered to the person: in the product's conversation as a seed, which start this work's payload takes as `seeds` or `roadmap`; in an epic's, as a topic taking the roadmap item in, `--from-roadmap`.

## Putting Something Aside

The person puts something off — "roadmap it", "that's a v2 thing", "not now" — or a tangent surfaces that does not fit what is taking shape. The roadmap is the person's timeline: placed on it, on a horizon they name, the item goes there at once, whatever its kind. The inbox holds what is not yet decided, an idea, a bug or a quick-fix, for the person to triage later. Their words say which; where they do not, the choice is theirs. A topic already on the map is postponed instead (Changing the Map).

- **On the roadmap**, the horizon is the person's. Where they named none, `render horizon-pick --park {name}` offers the roadmap's; where it refuses, the roadmap has none to offer, and they name one in words. Then `roadmap add {name} --horizon "{horizon}" --summary "{summary}" [--kind {kind:[bug|quick-fix]}] --origin park:{home} --source {log}`: a kebab-case name, a one-line summary in the product's terms, `--kind` for a bug or a quick-fix, `{log}` the log's path from the state root. Say the line its answer's `said` holds.
- **In the inbox** → `inbox capture {kind:[idea|bug|quick-fix]}`, an H1 title over its text on stdin.

## A Shared File

The person shares a file, a path or an image. Load **[importing-shared-files.md](../ledger-shared/references/importing-shared-files.md)** with home = `{home}`, phase = `discovery`, topic = `{home}`, and follow its instructions as written. Each path it lands is linked from the log.

## A Message to a Topic

In an epic's discovery, something found bears on a topic that has started. A started topic's brief is never rewritten: what bears on it reaches it as a message, decided there in its own frame, and a message carrying why is also how a decided topic is reopened. One message is one ask: what was found, the reasoning, and what the topic is asked to decide, a point from before named by its id. Write it to `.ledger/.cache/{home}/discovery/{home}/message-{slug}.md`, its first line the title, then send it with `topic send {home} {topic} --from {home}.discovery --content {file} --slug {slug}`, and draw `render send-report {home}.{topic} --sent {path}`, `{path}` the `message_path` the send answered, or its `inbox_path` where the topic is cancelled or removed.

## Moving Levels

The talk turns to an epic whose map is still open, or from an epic out to the product. The move ends this home's log on a pointer, and no entry catches that log up afterwards: bring it up to date first (The Record), and from the product's conversation the picture too. Say so in a line, then `enter discovery {to} --move`, `{to}` the epic or `product`. Its DATA reads as on entering, and `{home}` is now `{to}`.

## Starting This Work

The talk settles on a piece of work — something to build, fix or change — or a type call has found its kind. Load **[starting-this-work.md](references/starting-this-work.md)** and follow its instructions as written.

## Changing the Map

In an epic's discovery, the person asks for a change to the map or to see it, or the entry has a roadmap idea to take in. Load **[changing-the-map.md](references/changing-the-map.md)** and follow its instructions as written.

## Approving the Map

In an epic's discovery, the person calls for the map, or a session in which you changed the topics beyond what they asked is ending. Load **[approving-the-map.md](references/approving-the-map.md)** and follow its instructions as written.

## Ending the Session

The person ends the session. In an epic's discovery where you changed the topics beyond what they asked, it ends on approve the map instead, which closes it (Approving the Map); anywhere else, it ends here. Load **[ending-the-session.md](references/ending-the-session.md)** and follow its instructions as written.
