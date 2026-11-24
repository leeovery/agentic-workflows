# Changing the Map

*Reference for **[ledger-discovery](../SKILL.md)***

---

A change the person asks for in their own words is made as they asked, with no confirm; only a cancel confirms. Each verb names a topic by its name or the title a rename gave it, and answers its one-line report.

- **The map** — `render discovery-map {home}`. Its DATA names each unstarted topic's brief, and the topics struck from the map.
- **A new topic** — `{draft}` its brief's draft (Writing a Brief); `--from-roadmap {item}` where it takes a waiting roadmap idea in, and `--re-add` where the person asked for a struck name back:

  ```bash
  node .claude/skills/ledger-engine/scripts/engine.cjs topic add {home} {name} --summary "{summary}" --brief {draft} [--description "{description}"] [--from-roadmap {item}] [--re-add]
  ```

  Several at once go in one `topic add-batch {home} --file {topics.json}`, each entry `{"name", "summary", "brief", "description"?, "from_roadmap"?, "re_add"?}`.
- **A rename, an edit, the order** — `topic rename {home} {name} {new}`; `topic edit {home} {name} --summary "{summary}" --description "{description}"`, either or both; `topic order {home} {topic}={n} …`.
- **A removal** — `topic remove {home} {name}`, then follow its `next`.
- **A brief rewritten** — before its topic starts, the brief the map's DATA names for it rewritten as a draft (Writing a Brief), then `topic brief {home} {name} --brief {draft}`; once it has started, what bears on it goes as a message (A Message to a Topic).
- **A postpone** — on the horizon the person named; where they named none, `render horizon-pick --park {topic}` offers the roadmap's horizons and a new one, and for a new one, or where it refuses for an empty roadmap, the person names one in words. Then `topic postpone {home} {topic} --horizon "{horizon}"`.
- **A cancel** — fetch the confirm, `render cancel-gate {home}.discovery.{topic}`, then follow the cancel's `next`.
- **A topic reactivated** — `topic reactivate {home} discovery {topic}`.
- **A topic this epic postponed, brought back** — `roadmap pull-forward {item} --into {home}`, which restores its row; a waiting idea new to the epic comes in as a new topic, `--from-roadmap`.
- **A decided topic reopened** — a message carrying why (A Message to a Topic): it reopens the topic.
