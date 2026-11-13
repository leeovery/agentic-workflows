# Legacy Split

## Touches

- Each source's plan, in the folder the check names for it: `plan.json`,
  and each theme's research beside it.

## Asks

- For each source, epic by epic: the themes it splits into, confirmed
  before any is drafted, or the source kept whole.
- Then its drafted plan: taken as it stands, edited, or the source kept
  whole.

## What It Does

An old migration seeded each epic's map from its research, so some epics still hold broad research in progress: one file covering several themes, on one item of the map. Each such file, a source, is cut into topic-sized research files, each its own item on the map, the person choosing the cut. This session stages each source's plan; the next step applies every plan by code. Nothing in `.workflows/` changes here.

Each source is one piece of the check. A source with no plan yet is named with its file, under `.workflows/` in the project's folder in the main checkout, and the folder its plan goes in.

## A Source's Plan

The plan, `plan.json`, holds the source's themes:

```json
{"themes": [
  {"kebab_name": "{name}", "summary": "{one line}", "description": "{a paragraph or two drawn from the source}"}
]}
```

Beside it, each theme's research is `{name}.md`: the body of its new research file, which the apply heads with its title, its summary and the source it came from. Where the person keeps the source whole, the plan is `{"whole": true}` alone, and the source stays one research file on its own item.

A theme's name is one a topic can take: lowercase letters, digits and hyphens. No other item of the epic's map holds it, no research file or item of the epic has it, and no other source's plan in the epic names a theme by it. The source's own name is free, since the apply sets the source aside first, and so is a name the map dismissed.

## The Interview

Work through the epics in the check's order, and through each epic's sources one at a time. A source the check names as you come to it is planned from the start, its plan's folder cleared first: what an earlier session left of it is never resumed.

1. Read the source end to end. Everything in it reaches a theme: the apply sets the source aside, and what no theme holds is lost to the topics.
2. Find its themes in its own structure: its headings, the subjects it turns between. The source decides how many. One theme is a split too, the source carried on as it stands. Two themes belong together where working on one would keep needing the other, and a fragment too small to stand alone joins the theme nearest it.
3. Put the themes to the person, each its name and a line: they confirm them, or rename, merge, split, add or remove one, or keep the source whole. Draft nothing until they confirm.
4. Draft each theme's research from the source's own words, moved as written. Rewrite a passage only where it would leave its reader stranded, such as a reference to a part now in another theme. Repeat what the source itself repeats, and nothing more. Take one theme at a time through the whole source, in its order, so material it interleaves is not missed. Then write the plan.
5. Show the person the plan: each theme's name, its summary, how many paragraphs it holds and how it opens. They take it, edit it as before, or keep the source whole. A theme removed now takes its research with it: confirm before removing one.
6. Once the plan is staged, the check passes the source or names what to mend in its plan. Mend it, then go on to the next source.
