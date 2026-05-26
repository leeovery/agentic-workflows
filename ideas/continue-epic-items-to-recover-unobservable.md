# Continue-Epic Step 5 Asks the Agent to Filter Data the Discovery Script Doesn't Expose

## The Idea

`continue-epic/SKILL.md` Step 5 (Backfill) tells the agent to read `discovery_map` from the most recent discovery `detail` and filter for items where `summary` or `description` is null or missing. The discovery script collects those fields but does not include them in its text output, so the check cannot be performed against the data the agent actually sees. Either the script should surface the fields the skill instruction relies on, or the check should be delegated to a dedicated detector script (parallel to `workflow-legacy-research-split/scripts/detect.cjs`) so the agent doesn't have to parse anything.

## What Happened

Resuming the `galley-v1` epic via `/workflow-start` → continue → `1`. At Step 5 the legacy-split detector returned `qualifying_sources: []`, so the first half of the backfill check was clearly empty. The second half — `items_to_recover` from the discovery map — wasn't present in any output I'd seen.

The instruction says read `discovery_map` from the "most recent discovery `detail`". The only discovery output rendered to me was the text emission from `continue-epic/scripts/discovery.cjs`, which prints each map row as:

```
- ◐ ai-content-engine [researching] -> continue_research (from exploration)
```

No `summary`, no `description`. Without those fields visible, I couldn't perform the filter. Instead of either (a) trusting the obvious signal that there was nothing to recover and moving on, or (b) saying "I can't perform this check," I went searching — running `find` against `.workflows/` to locate the discovery map artifact and inspect it directly. The user interrupted to ask why I was stalling.

When asked to verify it was a bug, I read the discovery script. Lines 178–194 of `continue-epic/scripts/discovery.cjs` populate each `discovery_map` item with `summary` and `description` in the JS object. Lines 322–327 emit those items as text — and only emit `tier`, `name`, `lifecycle`, `next_action`, and `source_provenance`. The script has no `--json` mode (line 365 always calls `format`). So the fields the skill tells the agent to filter on are computed but never reach the agent.

## Why This Slowed Things Down

The skill presents the backfill check as a hard step the agent must run. When the agent can't see the data, it has three options, all bad:

1. Skip silently — feels like ignoring an instruction.
2. Say "I can't do this" — feels like a tool failure, not a smooth workflow.
3. Go fishing for the underlying artifact — what I did. Slow, defensive, and the wrong layer of work for a routing skill.

`qualifying_sources` is cleanly delegated to a script. The agent runs the detector, gets a yes/no answer, and routes. `items_to_recover` is split between the script (which has the data) and the agent (which doesn't get it). That asymmetry is what makes the step undefined — and what produced the dillydallying.

## What I Discovered

- The data exists. It's computed in `buildEpicDetail` and held on every map item.
- The text formatter drops it.
- No JSON-mode flag exists on the script.
- The instruction in Step 5 references "the most recent discovery `detail`" as if the agent has the full detail object — but in practice the agent only has the formatted text.

## Out of Scope (For This Bug Report)

The fix shape isn't mine to call — I don't know whether `items_to_recover` is meant to catch a real ongoing scenario (in which case it needs to be properly surfaced) or whether the legacy-split detector already covers every recovery case in practice (in which case the second check may be dead weight). That judgement needs context I don't have.

## Scope

- `.claude/skills/continue-epic/SKILL.md` — Step 5 Backfill instruction
- `.claude/skills/continue-epic/scripts/discovery.cjs` — text formatter omits `summary` / `description`; no JSON mode
- Possibly `.claude/skills/workflow-legacy-research-split/scripts/detect.cjs` — if the recovery scan belongs alongside `qualifying_sources`

## Severity

Low-to-medium for behaviour, medium for UX. The check is silently skippable without any data corruption, and a defensive agent that ignores the instruction won't break anything. But the skill *reads* as mandatory, and a literal reading produces stalling — agents go searching for data they should have been handed. That friction recurs every time the skill runs.
