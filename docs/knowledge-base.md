# The knowledge base

The knowledge base is Ledger's memory across pieces of work, and the first place a session looks: a cheap pointer to what was decided before, reaching across every work unit in the project. It is searched by meaning rather than by matching words, and what comes back is the actual decision someone reasoned their way to, with which piece of work it came from and where to read more.

## What it remembers

Every question, finding and decision lands on the [ledger](trust.md#the-ledger) as it is made, and each topic's current decisions are drawn from it into the topic's **record**: each decision with its why and what it rules out, the answers it replaced folded beneath it. The knowledge base indexes those records — each topic's, each work unit's own for the decisions made at the work unit's level, and the findings about the product as a whole, made outside any piece of work — through a copy the engine renders for indexing alone, in the ignored `.ledger/.knowledge/`. A bugfix's root cause, findings and fix are entries like any other, so they reach it through its record. A quick-fix's short record after the work, saying what changed and why, is indexed too, each fix under its own heading so a search for one fix finds that fix.

It remembers what is current. When a decision is replaced, the topic's record is rendered again and the old answer drops out of search the moment the new one lands, so a search never hands back something you have since changed your mind about. The decisions of a cancelled topic or work unit, and of a postponed topic while it waits on the roadmap, are not current, and are not indexed.

## What it never keeps

Some things are deliberately left out:

- **Logs.** A conversation's log is its journey — the options weighed, the false paths, why minds changed — and it is read by the topic's own sessions, never searched. Discovery's sessions and the product's are reached through the pointers into them.
- **The ledger itself.** It holds every entry ever made, the replaced ones among them; the records hold what stands.
- **The specification.** It is assembled from the records, which are indexed in its place.
- **The build.** Its log, its notes for later, each task's account and its reports describe how the work got done, not what was decided. Indexing them would flood every search with task ids and diffs instead of decisions.
- **Seeds, assets, inbox items and the product record's own file.** A file you shared is reached through the entry that links it, in its record.

The rule underneath is that the knowledge base stores decisions, not execution, which keeps recall sharp instead of noisy.

## How the past resurfaces

You rarely go looking for it. At the start of a topic, and whenever the conversation brushes ground that might have been covered before — an edge of the topic, a dependency upstream or down — Claude checks it and folds in the one or two things that bear on the work, never a wall of old material. If nothing relevant exists, you see nothing at all. You can also just ask: "have we discussed this?", "what did we decide about X?"

Each find reaches Claude as the passage closest to what was asked, with the headings it sits under and the lines it came from, rather than the whole record around it; Claude reads the record itself only where a passage looks load-bearing. Where depth matters and a query doesn't answer it, a plain search of the project's files runs in a helper agent, so its cost stays out of your conversation.

## Why old material fades

Left alone, the memory would grow forever and stale thinking would crowd the results. So material decays, and eventually is pruned, but staleness is not a wall-clock timer. A record fades as later work completes past its work unit: a dormant month completes nothing, so the clock stands still. Once a work unit's material has sunk out of reach, it can be pruned from the store. The rate and the floor are settings, described under [knowledge configuration](configuration.md#knowledge-configuration).

## Switching it on

The knowledge base is switched on once in each copy of the project. Where your machine already holds a configuration, the project adopts it, saying so in a line, and asks nothing. Otherwise this is the one moment you are asked to configure something by name: how it should search. The first session walks you through the choice — an embedding service, or keyword-only. The one part Claude cannot do for you is a cloud service's API key: that goes in through a private prompt in your own terminal, `node .claude/skills/ledger-engine/scripts/engine.cjs knowledge setup --key-only`, and never travels through the chat. To set the whole thing up yourself, `node .claude/skills/ledger-engine/scripts/engine.cjs knowledge setup` runs the same choices as a wizard in your terminal.

Keyword-only is a fully supported mode, not a broken one. You lose search by meaning — it won't know that "sign-in" and "authentication" are related — but search by words still works, a word finding its other forms, and everything else behaves the same. Add a provider later by running setup again: everything already remembered gains search by meaning, and nothing is rebuilt. With an embedding service configured, each record's text and each search are sent to that service to be embedded; keyword-only, or a model on your own machine, keeps everything local.

None of it enters git — not the store, which is built from the committed records, and not the choice you made at setup. A fresh clone asks once, like any new copy, while a worktree Claude creates for you shares the main checkout's, where Ledger's state lives. A copy that is set up but has lost its store rebuilds it at the next start without asking, as long as your machine's configuration says how. It never quietly falls back to keyword-only on a machine that has made no choice.

## Kept in step

Every start brings the store in line with the records: a record not yet remembered is added, one changed since is read again, one whose work was cancelled is dropped, pruning runs, and anything remembered by its words alone is handed to a background task that gives it its meaning, so the start never waits on the embedding service. When all is well, all of it is silent. Where the knowledge base hasn't been set up in this copy, the start stops cleanly and points you at setup, so there is always somewhere for the thinking to be remembered.

The embedding service is never a reason for work to stop. When it is down, rate-limited or out of credit, or its key can't be found, a search runs on words alone and says why in a single line. A record is remembered by its words at once and gets its meaning in the background moments later; where the service could not take it in, the next search and the next start say so, and the next start tries again. A failure to render or index a record after its entries change is a warning, never a reason to abort real work: the store is derived from the records and can always be rebuilt.
