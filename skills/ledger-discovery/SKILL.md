---
name: ledger-discovery
description: Ledger's discovery phase, the product's conversation and an epic's. Reached only through a Ledger handoff, never invoked directly; work comes into Ledger through /ledger.
user-invocable: false
allowed-tools: Bash(node .claude/skills/ledger-engine/scripts/engine.cjs *)
---

# Discovery

Talk, at one of two levels, each one conversation carried on across sessions. The product's conversation is about everything not yet started as work — what the product is, who it serves, where it is going — and leads to the roadmap and the work started from it. An epic's discovery is about the epic as a whole, and leads to its map of topics, each with a brief.

Discovery is not where decisions are made: what the person says is input to the discussion that decides it. None is banned. Follow what the person wants, and record it as below.

## Arguments

- `$0` — **way_in**: `epic`, `feature`, `bugfix` or `quick-fix`, a piece of work of that kind; `start`, a piece of work of no kind yet; `none`, the conversation itself.
- `$1` — **home**: an epic; or `none`, the product's conversation.
- `$2` — **seeds**: comma-joined inbox paths or `roadmap:{item}`s the work starts from, or into an epic the roadmap ideas joining it; `none` or absent, none.

`{home}` is `$1`, or `product` where `$1` is `none`.

## Instructions

Load **[framework.md](../ledger-shared/references/framework.md)** and follow its instructions as written.

## Done When

Start this work created the unit, approve the map landed the epic's map, or the session was closed. The product's conversation never finishes; its sessions do.

## Entering

Where `$0` is not `none`, the entry is the work's type call, `--type-call`, in no session of the product's conversation; should the person want the product's conversation instead, enter again without it.

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs enter discovery {home} [--type-call] [--seeds "{seeds}"]
```

A refusal names the way on: say it in a line. The DATA names what there is to read; read what the work needs. Do what `catch up` says. Each `take in` is a roadmap idea joining the epic as a topic, `--from-roadmap`. Where `research owed` is `yes`, load **[researching-the-code.md](references/researching-the-code.md)** and follow its instructions as written.

## The Record

- **The log**, the DATA's `log` — yours to write, under headings named for what they cover, so a brief can point at a part by its anchor. `## Not taken`, `## Views of the product` and `## Spikes` are the engine's, written only through their doors. Before a session closes — start this work, approve the map, the session's end — the log ends on a line saying where the conversation got to. The type call keeps none.
- **The product picture**, `.ledger/.product/picture.md` — where the product stands now. Re-read it before a rewrite: another window may have rewritten it.
- **A brief** — a topic's, drafted in `.ledger/.cache/{home}/discovery/{home}/`. It lands unchanged in the topic's folder, so its links are paths from the state root.
- **A record from before** — the person's earlier work, where the DATA or the picture names it.

## Tools

- **Research** — online, in the code, in what exists, logged with its sources.
- **A spike** — `asset spike {home} {slug}` answers its folder, for the source, and a cache twin, for dependencies, builds and output.
- **Earlier work** — `knowledge query "{term}" …`.
- **A shared file** — load **[importing-shared-files.md](../ledger-shared/references/importing-shared-files.md)** with home = `{home}`, phase = `discovery`, topic = `{home}`, and follow its instructions as written.

A spike's files and shared files are linked from the log: the link takes them into the state.

## Doors

Every call is `node .claude/skills/ledger-engine/scripts/engine.cjs {verb} …`; a `discovery-log` value is single-quoted, a quote inside written `'\''`.

- A finding read in the code → `ledger find {home}.discovery`, `{"text", "how", "known": "read", "by": "claude", "who_moved_whom": "none"}` on stdin.
- A direction dropped → `discovery-log not-taken {home} --direction '{direction}' --why '{why}'`.
- A view of the product → `discovery-log view {home} --text '{view}'`.
- What a spike showed → `discovery-log spike {home} {spike} --tool '{tool}' --showed '{showed}' [--link {live link}]`.
- A point from before met in an epic → `discovery-log from-before {home} --id '{id}' --point '{point}' --file '{file}'`.
- Something for later → `roadmap add {name} --horizon "{horizon}" --summary "{summary}" [--kind {kind:[bug|quick-fix]}] --origin park:{home} --source {log}`, the horizon the person's (`render horizon-pick --park {name}`); or `inbox capture {kind:[idea|bug|quick-fix]}`, an H1 title over its text on stdin.
- A message to a started topic, written to `.ledger/.cache/{home}/discovery/{home}/message-{slug}.md`, its first line the title → `topic send {home} {topic} --from {home}.discovery --content {file} --slug {slug}`, then `render send-report {home}.{topic} --sent {path}`, the path it answered.

## Starting This Work

The person settles on a piece of work. Load **[starting-this-work.md](references/starting-this-work.md)** and follow its instructions as written.

## Changing the Map

In an epic's discovery, the person asks for a change to the map, or to see it. Load **[changing-the-map.md](references/changing-the-map.md)** and follow its instructions as written.

## Approving the Map

In an epic's discovery, the person calls for the map, or a session in which you changed the topics beyond what they asked is ending. Load **[approving-the-map.md](references/approving-the-map.md)** and follow its instructions as written.

## Moving Levels

The talk turns to an epic whose map is still open, or from an epic out to the product. Say so in a line, then `enter discovery {to} --move`, `{to}` the epic or `product`. A refusal: say it, and stay. Otherwise `{home}` is now `{to}`.

## Ending the Session

The person ends the session. Load **[ending-the-session.md](references/ending-the-session.md)** and follow its instructions as written.
