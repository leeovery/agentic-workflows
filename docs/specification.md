# Specification

The specification is where decisions become the one document a build reads. Every epic, feature and bugfix writes one spec, `spec.md`, assembled by area from the topics' records on the ledger: each statement cites the entries it comes from, so nothing reaches the spec that was not decided, and nothing decided is lost on the way. A cross-cutting concern writes none — its decisions stand in the ledger — and a quick-fix's scoping carries its own.

## Where it starts

The spec waits until every topic is settled. On an epic that means every topic decided, cancelled or postponed — postponing a topic to the roadmap is how an epic moves on without it — and the epic's menu offers the spec only then. A feature's one topic must be decided, and a bugfix's investigation concluded. Groups drawn from half the records come out differently once the rest are decided, so there is no starting early on a decided subset.

Once `spec.md` is written the epic's map is closed: no topic is added, reopened, cancelled or pulled forward, and a change is settled in the spec instead.

## How it gets written

The conversation orchestrates; named agents do the writing, each from a brief the engine fills from the records, never from the conversation. On an epic of more than one topic, a sweep reads across the decided topics once, before the spec is written, for what fell between them: a decision it carries into a topic goes there as a message, reopening it, and a topic it finds missing comes to you to take or strike on the map.

The writer then writes the spec, and the engine takes it only once every statement traces to the ledger. Review passes read it — each bound to the version it reviews, reading only what changed — until one changes nothing. A gap the spec meets is decided as any call is: Claude's where the record or first principles settle it, yours where the tie-break is product intent, and either way it lands on the ledger as an entry, never as wording only the spec holds. You can read the spec line by line on its review page and leave marks there for Claude to read back.

## Ready to build

Once the review has settled, the phase cut splits the spec into the build's phases. Ready to build is the one gate before building: it shows the short outline and the phase cut, once, and there you choose the build's position — auto by default, or step. No construction, finding, re-loop or sign-off gate comes before it. For a feature, decided and ready to build are one screen.

## What you are left with

A concluded spec is never corrected. A later change replaces the entry on the ledger, and the entries that relied on it are flagged in the work that made the change; the spec stays as it was concluded, with no corrigendum and no re-index. The [knowledge base](knowledge-base.md) returns the topics' records, never the spec. From here the build works through the cut, phase by phase.
