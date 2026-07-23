# Discovery

Every piece of work begins here. Discovery's job is deliberately narrow: figure out what kind of work this is, sketch its shape, save it, and hand it to the right next phase. It does not solve the problem — feasibility, design decisions, root-cause analysis all belong to the phases discovery routes *into*. It settles what the work is and where it goes.

**Why every work type starts here.** The system runs five different pipeline shapes, and each begins with a different first phase. You cannot route the work until you know which shape it is. Discovery is the single funnel where that decision gets made, once, before the pipeline branches. It is also the one place designed to catch a wrong guess cheaply — the type you named at the start is only a hint, and reshaping it here costs nothing, whereas discovering the mismatch three phases later costs a great deal.

You never choose how discovery runs. If you are starting something new, it decides the type, shapes it, saves it, and routes it. If you are returning to an epic you already created, it re-opens that epic's map of topics to refine it. Which mode you are in is decided by how you arrived, not by anything you pick.

## Starting something new

Discovery opens by reading anything you have already handed it, then inviting you to describe the work in your own words. Two kinds of material can come in at this opener. If you started this work by promoting something from your [inbox](capture-and-inbox.md) — a logged idea, bug, or quick-fix — discovery has already read it and opens by reflecting back the shape it picked up rather than parroting your note. And whatever you are working on, the opener invites you to share paths to related files: notes, design docs, error reports, prior research. That invitation is woven into the opening question, never a separate step, so having nothing to share costs you nothing. Anything you point at gets read to shape the conversation and saved into the work later.

Then comes the heart of it: a shaping conversation whose only goal is to settle which of the five shapes this is. Discovery asks one open question at a time — never a rapid-fire checklist — and as patterns emerge it floats tentative reads softly, easy to redirect: *"I'm hearing a few distinct things — this might be more than one feature. Want to pull on that, or stay focused?"* It works out the cheap, terminal shapes first, because they confirm fast: a **bugfix** is something that used to work and now fails; a **quick-fix** is a small mechanical change with nothing to debate. If it is neither, the work is something to build or define, and the question becomes how many distinct concerns are in scope — one coherent thing is a **feature**, a concern that fans out into several is an **epic**, and a pattern or policy with nothing shippable at the end is **cross-cutting**.

Two habits keep this conversation from sprawling. If a tangential concern surfaces that does not belong to the shape, discovery offers to park it as a fresh inbox note rather than let it creep the scope — and if you accept, it saves that note immediately, so the thought survives even if you abandon the session. And if the conversation tunnels into substance — mechanism, feasibility, root cause — discovery pulls back out: *"That's the kind of thing we'll get into once this is set up. For now, let's pin down what this is."* Staying in its lane is the whole discipline; the depth comes later, in the phase built for it.

### The moment work becomes real

When the signals have converged and held steady, discovery states its read and the specific signals that drove it — concrete enough that you can challenge a particular cue — and asks:

> **Have I read this right?**
> - **`y`/`yes`** — that's the right shape, set it up
> - **`o`/`other`** — it's something else (tell me what)
> - **Keep shaping** — tell me what I'm missing

This gate is the single most important moment in discovery. **Until you say yes here, nothing exists on disk.** The entire shaping conversation is ephemeral — if you walk away before confirming, there is no half-created work, no stray files, nothing to clean up. The instant you confirm, everything persists at once, in a single commit: the work unit gets its own home and a name (which you confirm), your shared files are copied in as **imports**, any inbox notes that seeded the work are *moved* in as its **seeds** — its permanent record of origin — and a first session log captures the shaping conversation.

Making this the one hinge is deliberate. Shaping is exploratory and often abandoned, so an abandoned exploration should leave zero residue, and a confirmed one should land completely and atomically. Everything downstream can then trust that "the work unit exists" means "its whole origin story exists."

Once saved, the work is routed by its type. A **feature** or **cross-cutting** concern gets one more question — start in research or discussion? — with discovery leading on its read and one reason. A **bugfix** goes straight to investigation, a **quick-fix** straight to scoping. An **epic** does not stop at all; the same conversation deepens into shaping the epic itself.

## Shaping an epic

Confirming an epic does not end the conversation — it opens it up. This is a genuine design conversation, framed as two senior engineers throwing an idea around: opinionated, willing to disagree, ready to counter-propose and push on the weak points. It holds tensions open instead of smoothing them over — the friction between two competing goals is usually where the real shape is — and it makes real decisions and writes them down plainly rather than hedging. Those decisions are *soft* not because they are worded tentatively but because of where they sit in the pipeline; the per-topic discussion phase is where they harden.

One rule you will feel: **topics are never named during the conversation.** Discovery will not interrupt with "I'm hearing X, Y, and Z as topics." Topics are the *output* of understanding the whole shape, and naming them early would tunnel the conversation onto one item before the full picture exists. Throughout, discovery keeps a running written record — the ideas, the objections, the pivots, and crucially the paths that were rejected and *why* — because that record, not the live conversation, is what survives a context refresh.

When the conversation converges, discovery drops a light, ambient invitation to harvest — woven into normal prose, requiring no answer, never repeated as a nagging check-in. **You** pull the harvest when you are ready ("let's pull topics," "that covers it," "good enough to start"); discovery never forces it. When you pull, it reads out the distinct surfaces the conversation named, merges the ones that share a domain or decision space, proposes a routing for each — research or discussion — and shows you the proposed topic set as a preview:

> **Confirm to commit, or tell me what to adjust.**
> - **`y`/`yes`** — commit these topics and conclude
> - **`e`/`explore`** — go back to exploration; not ready yet
> - **Adjust** — split, merge, rename, re-route, or reword

There is no pressure toward completeness. Two topics is fine; twenty is fine. The map is expected to keep filling as the work progresses.

### Briefs — the reasoning that travels forward

Before the topics are saved, discovery writes a **brief** for each one: a per-topic view projected out of the whole conversation, with three sections — the soft decisions reached and why, the paths rejected and why, and the open questions carried forward. Each topic's downstream research or discussion phase reads its brief in full as its starting context.

Briefs are why an epic's wide, expensive conversation is not wasted on its narrow phases. The rejected paths especially — with the reasons attached — mean a downstream phase inherits the thinking instead of re-deriving it and re-walking the same dead ends. A brief is regenerable, never a record; the durable record is the session log, and a brief can always be re-projected from it. One safety behaviour matters here: if a brief is written or regenerated *after* downstream work on that topic has already begun, discovery does not overwrite that work — it flags the downstream phase to reconcile the change next time it runs. Soft thinking can prompt hardened thinking to re-examine itself; it can never silently overwrite it.

## Returning to an epic

When you come back to an epic to refine it, discovery skips all the type detection and re-opens the map as an anchor, briefs you on where the last conversation had got to, and lets you do two things in any mix: explore new areas (harvested into new topics exactly as the first time) and edit existing ones. You edit by saying what you want in plain language — remove a topic, rename it, change its routing, reword its summary, mark it handled — and discovery shows a proposal and a small confirm before making any change.

Some edits are allowed only while a topic is still fresh, before any research or discussion work exists under its name. Removing, renaming, and re-routing all lock once real work begins — because the map item is the historical record that a topic ever existed, and letting you delete one with work behind it would erase the audit trail. When you ask for something blocked, discovery explains why in plain terms and points you at the right tool (cancelling in-flight work is a separate operation that preserves the record). Removing a fresh topic adds its name to a **dismissed list**, which stops the epic's self-healing analyses from quietly re-proposing something you deliberately dropped — and that stays reversible: ask to "show dismissed" in any session to bring a dropped topic back into the conversation.

## When a session is interrupted

Two recovery paths protect you. If a previous discovery session for an epic was left open, discovery notices and offers to continue it or restart — and restarting keeps any map edits you had already applied, discarding only the narrative record of the abandoned session. Either way it gives you a short "where we'd got to" briefing drawn from the recent session logs, so you resume a conversation rather than a bare topic list.

And if the underlying conversation is compacted mid-discovery, the rule is simple: if the work had not yet been confirmed, the shaping is genuinely gone (nothing was on disk) and discovery re-opens with you; if it had, discovery recovers from the files and git history — which are authoritative, not its own recollection — announces where it thinks it is, and waits for you to confirm before continuing.

## What you are left with

Discovery leaves a small set of artifacts in the work unit's folder, each meaning something specific to you. The **session log** is the durable narrative of each discovery conversation — what was explored, what was decided, and the paths dropped with their reasons — written as prose, not a transcript, and created only once there is a real change to record. For an epic, the **map** is the list of topics with their routing and a lifecycle state computed from what work actually exists, and the **briefs** are the per-topic starting contexts. **Seeds** are the inbox notes the work was born from; **imports** are the reference files you shared. Before an epic session finalises its topics, discovery reconciles the session log against the actual conversation, so what is written down matches what you discussed.

Throughout, discovery stops and waits at every gate — the type confirmation, the name, the routing, each map edit, each harvest. It will not answer these for you, even under pressure to "just proceed." These are the decisions that shape everything downstream, and they are yours to make.
