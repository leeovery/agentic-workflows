# The Review Page

*Reference for **[leeway-specification-process](../SKILL.md)***

---

The person's review of the spec, on a page published as a private artifact, with a tick and a comment on every numbered line. It is between the person and this session alone: nothing on it reaches you by itself, and nothing you publish brings another Claude in.

## Publishing

The review row's `next` builds the page, `spec page {work_unit}`. Publish its `page` with the Artifact tool, as a private artifact with the `title`, `icon` and `capabilities` the answer gives and nothing more, then send each of its `batches` with ArtifactData's batch writes, in order. Then record the artifact's address, `{url}`, which opens the page:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs spec published {work_unit} {url}
```

Until it is recorded, the page is not open. The answer names `read_back`, the file its marks are read back to. Give the person the page's address in a line: they can check all of it, the parts they care about, or none, stop or ask at any time, and tell you here when they have left comments. Then draw ready to build again.

## Reading the Marks

The engine sees the page only through the marks read back to it: they are read back fresh before ready to build is drawn while the page is open, before a `next` that takes them runs, and when the person says they have left comments. Read the page's `marks` collection with ArtifactData `list`, following its cursor past the first 100 documents, and write every document, by its id, as one JSON object — `{"s1": {…}, "s2": {…}}` — to the read-back file: the one the `next` names, else the `read back` file `spec published` answered, which the spec's entry names too. Unless a `next` takes them, store them:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs spec marks {work_unit} --file {read_back}
```

Its `waiting` lists each comment waiting for you: **Answering a Comment**. A line the person ticked after your answer agrees it: **An Agreed Change**.

## Answering a Comment

Answer each comment beneath its line, as it stands when read. While you answer, keep the page told: ArtifactData `set` on `live/status`, `{"x": "Answering {number}", "at": "{now}"}`, then `{"x": "", "at": "{now}"}` once done, `{now}` in ISO 8601. Each answer is ArtifactData `update` on its `doc` of `marks`, pinned to the version listed, with `{"m": {"{id}": {"t": {"c{ms}": {"by": "c", "x": "{answer}"}}}}}` and nothing else — `{id}` the line's id, `{ms}` the time now in epoch milliseconds, read from the clock. Say in plain words what will change, or ask back. The person can answer back as often as they like, each answered the same way. Never write a tick, a mark's state or the person's messages. A comment that turns on what the person wants is a call: raise it as a gap is raised (**[writing-and-review.md](writing-and-review.md)**), and answer beneath the line once it is decided.

## An Agreed Change

A tick on a line you answered is the person agreeing your last answer. Where the answer changes the spec, the writer makes the change, its land goes through the review's next pass, and the cut is made again:

- **Wording alone** — the line says what it said, better: it never touches the ledger. Write each such change agreed, one a line, naming the line by its number and giving the wording agreed, to `.leeway/.cache/{work_unit}/specification/wording.md`, and brief the writer with it — every writer's brief until the spec lands, a refused land's among them:

  ```bash
  node .claude/skills/leeway-engine/scripts/engine.cjs brief spec-writer {work_unit} --wording .leeway/.cache/{work_unit}/specification/wording.md
  ```

- **What the product does** — the answer decides something: it lands at the spec as the person's decision, as a change asked for at ready to build does (**[ready-to-build.md](ready-to-build.md)**), and the writer rewrites from it.

The page takes the person's tick off a line whose wording changed, for them to tick again: never write it back.

## Pushing a Change

Each land while the page is open reaches it without republishing. List the store's `spec`, `history`, `changes` and `assess` collections with ArtifactData `list` and `out_dir` `.leeway/.cache/{work_unit}/specification/store`, following each cursor past the first 100 documents, then plan the push. `--reason` says in one line what changed and why; `--from` names the lines whose conversations led to it, comma-separated, and is left out where none did:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs spec push {work_unit} --store .leeway/.cache/{work_unit}/specification/store --reason "{reason}" [--from {lines}]
```

Send each of its `batches` with ArtifactData's batch writes, in order, each write to a document named under `existing` taking `if_version`, the version the listing gave it. A push that stops part way is planned again from a fresh listing, and finishes the change it started.
