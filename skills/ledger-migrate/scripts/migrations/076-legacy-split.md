# Legacy Split

## Touches

- Each source's plan, in the folder the check names for it: `plan.json`,
  and each theme's research beside it.

## Asks

- For each source, epic by epic: the themes it splits into, confirmed
  before any is drafted, or the source kept whole.
- Then its drafted plan: taken as it stands, edited, or the source kept
  whole; and once the check names what to mend, any mend that changes a
  theme.

## What It Does

An old migration seeded each epic's map from its research, so some epics still hold broad research in progress: one file covering several themes, on one item of the map. Each such file, a source, is cut into topic-sized research files, each its own item on the map, the person choosing the cut. This session stages each source's plan; the next step applies every plan by code. Nothing in `.workflows/` changes here.

Each source is one piece of the check. A source not yet done is named with its file, under `.workflows/` in the project's folder in the main checkout, and the folder its plan goes in.

## A Source's Plan

The plan, `plan.json`, holds the source's themes:

```json
{"themes": [
  {"kebab_name": "{name}", "summary": "{one line}", "description": "{a paragraph or two drawn from the source}"}
]}
```

Beside it, each theme's research is `{name}.md`: the body of its new research file, which the apply heads with its title, its summary and the source it came from. Where the person keeps the source whole, the plan is `{"whole": true}` alone.

The plan is written only once the person takes it or keeps the source whole. Research staged beside no plan is no plan, and the check names the source as having none.

A theme's name is one a topic can take: lowercase letters, digits and hyphens. No other item of the epic's map holds it, no research file or item of the epic has it, and no other source's plan in the epic names a theme by it. The source's own name is free, since the apply sets the source aside first, and so is a name the map dismissed.

## Cutting a Source into Themes

Each theme becomes a topic of its own, with its own conversation and records. A narrow theme costs a topic's overhead and fences in work that wants to cross its edges. The source's substance decides how many themes there are, never a number aimed at.

- **The independence test.** Where working on one theme would keep needing another, they are one theme. Themes sharing a domain, a schema, a user journey or a decision space merge.
- **Not a theme for each concern of one domain.** A source on API authentication, password hashing, session management, OAuth, token refresh and rate limiting is not six themes: the same user, the same security boundary and the same session lifecycle make it one, `auth`.
- **Not a theme for each part of one system.** A source on a pipeline's ingestion, schema validation, transformation rules, error handling, retries and dead-letter queue is not six themes: each is a stage of the same pipeline, which makes it one, `data-pipeline`.
- **When to split.** Themes stand apart where their stakeholders, concerns or decision spaces differ, each explored without the other.
- **Framing is input, not a verdict.** How the source carved its material, its own sections or a "split them" said in the conversation it records, informs the test and never answers it. Hold the test to the substance; where its shape and the framing disagree, propose the test's shape. At step 3 the person may still take the framing's, with the proposal in view.

A fragment too small to stand alone joins the theme nearest it, never dropped.

One theme is a split too: the source is set aside as superseded and carried on in one research file, and its map item is replaced by the theme's, with a summary and a description. Where the theme keeps the source's name, so does the item; under a new name, the source's name leaves the map. Kept whole, the source stays its own research file and its map item stays as it stands.

## The Interview

Work through the epics in the check's order, and through each epic's sources one at a time. A source the check names as you come to it is planned from the start, its plan's folder cleared first: what an earlier session left of it is never resumed.

1. Read the source end to end. Everything in it reaches a theme: the apply sets the source aside, and what no theme holds is lost to the topics.
2. Find its themes. Its headings and the subjects it turns between show where to look; Cutting a Source into Themes decides the cut.
3. Put the themes to the person, each its name and a line: they confirm them, or rename, merge, split, add or remove one, or keep the source whole. Draft nothing until they confirm.
4. Draft each theme's research from the source's own words, moved as written, into `{name}.md` in the plan's folder. Rewrite a passage only where it would leave its reader stranded, such as a reference to a part now in another theme. Repeat what the source itself repeats, and nothing more. Take one theme at a time through the whole source, in its order, so material it interleaves is not missed. Write no plan yet.
5. Show the person the plan: each theme's name, its summary, how many paragraphs its research holds and how it opens. They take it, edit it as before, or keep the source whole. A theme removed now takes its research with it: confirm before removing one. Write the plan only on their answer: its themes where they take it; where they keep the source whole, the folder cleared and `{"whole": true}` alone.
6. Once the plan is written, the check passes the source or names what to mend in its plan. Mend it, putting any change to a theme to the person first, then go on to the next source.
