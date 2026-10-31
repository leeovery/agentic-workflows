# Changing the Map

*Reference for **[leeway-discovery](../SKILL.md)***

---

A change the person asks for in their own words is made as they asked and reported in one line, with no confirm; only a cancel confirms. A change you would make yourself — a topic split, merged or reordered beyond what they asked — goes onto approve the map, never straight to the map. Each verb names a topic by its name or the title a rename gave it, commits itself and answers its one-line report: emit its DISPLAY section verbatim per its marker. A refusal names the way on: say it in a line.

- **The map** — `render discovery-map {home}`: emit its DISPLAY section verbatim per its marker. Its DATA names each unstarted topic's brief, and the topics struck from the map.
- **A new topic** — its brief drafted under `.leeway/.cache/{home}/discovery/{home}/` as the skill's **A Brief** says; `--from-roadmap {item}` where it takes a waiting roadmap item in, and `--re-add` where the person asked for a struck name back:

  ```bash
  node .claude/skills/leeway-engine/scripts/engine.cjs topic add {home} {name} --summary "{summary}" --brief {draft} [--description "{description}"] [--from-roadmap {item}] [--re-add]
  ```

  Several at once go in one `topic add-batch {home} --file {topics.json}`, each entry `{"name", "summary", "brief", "description"?, "from_roadmap"?, "re_add"?}`.
- **A rename, an edit, a removal, the order** — `topic rename {home} {name} {new}`; `topic edit {home} {name} --summary "{summary}" --description "{description}"`, either or both; `topic remove {home} {name}`; `topic order {home} {topic}={n} …`.
- **A brief rewritten** — before its topic starts, read the brief the map's DATA names for it, draft the rewrite from it, then `topic brief {home} {name} --brief {draft}`; once it has started, what bears on it goes as a message (**A Message to a Topic**).
- **A postpone** — on the horizon the person named; where they named none, fetch `render horizon-pick --park {name}`, emit its MENU verbatim per its marker, and take the horizon picked, or the one the person names; a pick that refuses has none to offer, so ask in the conversation. Then `topic postpone {home} {topic} --horizon "{horizon}"`, and its receipt.
- **A cancel** — fetch the confirm, `render cancel-gate {home}.discovery.{topic}`, emit its MENU verbatim per its marker and follow the answer's `next`; then its receipt, `--inbox {n}` where its `inbox` lists the waiting messages it moved.
- **A topic reactivated** — `topic reactivate {home} discovery {topic}`, and its receipt.
- **A roadmap item pulled forward** — `roadmap pull-forward {item} --into {home}`, said in a line.
- **A decided topic reopened** — a message carrying why (**A Message to a Topic**): it reopens the topic.

A receipt is `render topic-receipt {home}.discovery.{topic} --verb {verb:[postpone|cancel|reactivate]} [--warn] [--inbox {n}]`, `--warn` where the response carries warnings: emit its sections verbatim per their markers.
