# Changing the Map

*Reference for **[ledger-discovery](../SKILL.md)***

---

A change the person asks for in their own words is made as they asked, with no confirm; only a cancel confirms. A change you would make yourself — a topic split, merged or reordered beyond what they asked — goes onto approve the map, never straight to the map. Each verb names a topic by its name or the title a rename gave it, and answers its one-line report.

- **The map** — `render discovery-map {home}`. Its DATA names each unstarted topic's brief, and the topics struck from the map.
- **A new topic** — its brief drafted under `.ledger/.cache/{home}/discovery/{home}/`; `--from-roadmap {item}` where it takes a waiting roadmap item in, and `--re-add` where the person asked for a struck name back:

  ```bash
  node .claude/skills/ledger-engine/scripts/engine.cjs topic add {home} {name} --summary "{summary}" --brief {draft} [--description "{description}"] [--from-roadmap {item}] [--re-add]
  ```

  Several at once go in one `topic add-batch {home} --file {topics.json}`, each entry `{"name", "summary", "brief", "description"?, "from_roadmap"?, "re_add"?}`.
- **A rename, an edit, the order** — `topic rename {home} {name} {new}`; `topic edit {home} {name} --summary "{summary}" --description "{description}"`, either or both; `topic order {home} {topic}={n} …`.
- **A removal** — `topic remove {home} {name}`, then follow its `next`.
- **A brief rewritten** — before its topic starts, the brief the map's DATA names for it rewritten as a draft, then `topic brief {home} {name} --brief {draft}`; once it has started, what bears on it goes as a message (A Message to a Topic).
- **A postpone** — on the horizon the person named; where they named none, the horizon as Putting Something Aside says. Then `topic postpone {home} {topic} --horizon "{horizon}"`.
- **A cancel** — fetch the confirm, `render cancel-gate {home}.discovery.{topic}`, then follow the cancel's `next`.
- **A topic reactivated** — `topic reactivate {home} discovery {topic}`.
- **A roadmap item pulled forward** — `roadmap pull-forward {item} --into {home}`.
- **A decided topic reopened** — a message carrying why (A Message to a Topic): it reopens the topic.
