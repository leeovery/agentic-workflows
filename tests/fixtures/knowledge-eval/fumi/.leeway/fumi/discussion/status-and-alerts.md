# Discussion: Status And Alerts

## Context

Fumi is an `LSUIElement` app with no Dock icon whose windows are furniture the user may not be looking at. When something happens that the user needs to know about — a file refused, sync stopped, a feature that quietly stopped working, an engine that died — there is no window guaranteed to be on screen to say so. This topic owns the composition: which classes of message exist, which channel carries each, and what happens when the chosen channel is unavailable.

The topic arrived from gap analysis. Four completed topics each hit a moment where the app must tell the user something, and each solved it locally with no shared surface. Nobody owns the join.

### Inherited ground

**The reader decides the surface** (`engine-architecture`, Observability). *"State a person reads in the app is exposed to the management window in-process and never presented by the engine. Everything read after the fact goes to the system log."* Diagnostics go to Apple's unified log (`os_log`), never a Fumi-owned file; a **Copy Diagnostics** action runs the `log show` export, placed in `management-window`. **No health subsystem and no `fumi status` operation** — both rejected as building for a reader nobody named. This rule is the frame this topic works inside, not something to re-decide; what it leaves open is which *live* conditions are worth a person's attention at the moment they occur, which the rule does not answer.

**The engine records the state; the surface belongs elsewhere** (`storage-and-sync`, generalised by `engine-architecture`). Sync state is recorded by the engine as an overall state (syncing / paused / stopped) and a per-note state (synced / pending / rejected); `management-window` renders it.

**A system notification, not an in-app toast** (`note-window`, twice). An in-app toast was proposed and rejected both times, on the ground that it means *"inventing a component used exactly once"*. A system notification is the platform primitive, is the natural voice for a menu-bar app, and persists in Notification Centre. Two notifications exist by decision:

- **First-delete education** — one-time, on the very first delete: *"Deleted. You can always recover this from Recently Deleted."* Explicitly education, not safety; the safety net is Recently Deleted + no auto-purge, so the notification never appearing is acceptable. Notification permission was **rerouted to `onboarding-and-permissions`** from here.
- **Oversized-file refusal** — one notification per transfer carries the *reason* a dropped or pasted file was refused. Nothing lands in the note. This one is weaker than the first-delete precedent and `note-window` says so: it is *"the only channel carrying the why"*, and *"notification permission and Focus mode both swallow the reason silently"*. Accepted there, with two consequences handed onward — the refusal state must be unmistakable on its own, and **the limit wants a discoverable home** rather than existing only at the moment of failure. That second consequence was **rerouted to `management-window` triage** and has no receiving decision.
- **An agent-caused refusal does not notify** — a notification for something an agent did, possibly while the user is away, is the *announce it* pattern already killed for sync arrivals and agent writes. The agent gets the error in its own conversation. Rerouted to `agent-surface` as an error-contract constraint.

**Quota is an OS concern** (`storage-and-sync`). macOS surfaces "iCloud Storage Full" itself; Apple's own apps lean on that rather than reimplementing it. Fumi follows: a system notification plus a line in the management window, **never on the fumi itself**. Third-party comparables (Bear, Things, Ulysses, Obsidian Sync) keep any indication modest and in settings or a sidebar; **none annotate content**.

**An absent CloudKit zone always means "I have lost my sync relationship"** (`storage-and-sync`, 2026-07-31). Fumi cannot distinguish a deliberate purge from a token expiry or an Apple-side fault, so it never reads intent into it. Behaviour: *stop syncing, leave local truth completely untouched, **tell the user**, require an explicit re-enable.* The same section names the wider problem directly: several decisions there *"degrade quietly by design"* and *"silent degradation needs somewhere to become visible or the guarantee lapses without anyone noticing"* — then assigns the state to the engine and the surface to `management-window`. Nothing was decided about a *live* announcement.

**A crashed engine stays dead until the user reopens it** (`engine-architecture`, Fork 1 reversal). Taken deliberately, on the ground that the failure is self-announcing: *"every note on every Space vanishes at once and the menu-bar icon goes with them"*, recovery is one Spotlight invocation. The contrast drawn was Keyboard Maestro, which *"dies silently, and the user finds out weeks later"* — **protect the invisible failure, not the important one**. A wedged main thread is covered from two sides: a watchdog thread **logs and never acts**, and an arriving app process finding the lock held with no answer draws an alert — *"Fumi isn't responding"* — with a **force-quit-and-reopen** offer. Socket clients receive a distinct *not responding* error. This alert is the one user-facing presentation the engine's own area admits.

**A not-active login-item registration is surfaced, not swallowed** (`engine-architecture`). Registration can succeed without taking effect (pending approval, or user-disabled), which is observationally identical to not being registered: no engine at next login, nothing for the user to look at. A **quiet indicator** is owed, *"to `observability` and to the onboarding wizard"* — the failure it prevents being *"everything works today, nothing works tomorrow, and nothing ever said why"*. Where it renders and what it says is `management-window`'s.

**A broken placement surface degrades silently, logged, never surfaced** (`space-homing`, OS Range And Degradation; restated by `platform-support`). On an OS where the hook does not resolve, fumis open on the current Space; verification reads the landed Space back and records a whole-set miss. The deciding factor was stated in those terms: *"this is quiet-furniture software, and a notice that fires on a broken OS release is exactly the kind of thing that ends up firing for the wrong reason. A wrong Space is visible on its own."* Trade-off accepted explicitly: *"a user whose Space homing has silently stopped working learns it by noticing, not by being told."* The asymmetry that governs it: a restore burst has nobody waiting, so it is silent; an explicit target (`fumi new --space 7`) has a caller waiting, so it fails loudly to that caller. **No kill switch** — rejected because on the chosen route the disabled state and the broken state are the same state.

**The build order** (`platform-support`, user 2026-09-11). Build for macOS 26 and perfect it there; the floor is 15.0.0 and gets a sitting with the app before release. Findings asking for matrices, checklists or pre-purchase caveats are answered with *state the minimum and leave the rest until there is something to run.*

### What this topic has to settle

The open questions the join leaves:

- Which channel carries which class of message — a system notification, the menu-bar item, the management window, or silence — and what makes a condition qualify for each.
- What happens when notifications are denied or suppressed. `note-window`'s refusal reason is the only statement of *why* a file was rejected and it is carried by the one channel that can vanish.
- Whether there is any persistent surface for a condition the user was not present for, or whether every non-live signal is the system log's.
- Whether notification permission is requested at all, and when. `onboarding-and-permissions` has to know this and cannot derive it.

### References

- Discovery map item `fumi.discovery.status-and-alerts` — no brief was generated; the item `description` served as the carrier
- `.workflows/fumi/discussion/note-window.md` — decided; first-delete education, oversized-file refusal, the toast rejection, the size-limit reroute
- `.workflows/fumi/discussion/storage-and-sync.md` — decided; absent-zone stop, quota split, sync-state record, the silent-degradation problem stated
- `.workflows/fumi/discussion/engine-architecture.md` — decided; the Observability reader rule, crash-stays-dead, the wedge alert, the login-item indicator
- `.workflows/fumi/discussion/space-homing.md` — decided; placement verification logged-never-surfaced, the quiet-furniture argument, no kill switch
- `.workflows/fumi/discussion/platform-support.md` — decided; the build order, the macOS 15 floor and the pre-release sitting
- `.workflows/fumi/discussion/management-window.md`, `.workflows/fumi/discussion/agent-surface.md` — triage only, no sessions yet; both hold rerouted concerns from the above
- `.workflows/fumi/research/onboarding-and-permissions.md` — triaged, no session yet; holds the notification-permission reroute from `note-window`

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture. Not every subtopic needs its own section — minor items resolved in passing can be folded into their parent. The Discussion Map (which subtopics exist and their states) lives in the manifest, not this file.*

---

## Standing Surface

### Context

`storage-and-sync` decided that when Fumi loses its sync relationship it stops, leaves local truth untouched, and **tells the user** — then assigned the state to the engine and the surface to `management-window`. That is a complete answer for someone who opens the management window. Nobody does.

The worked case: on Tuesday a CloudKit change token expires. Fumi stops syncing, correctly, and records the stopped state. It is Friday. The user has not opened the management window since August, there is no Dock icon to bounce, and three days of notes exist on one Mac — under a product whose pitch is that your notes are files you own and they are safe. The state was recorded and rendered exactly as decided, and the user still does not know.

Two neighbouring conditions have the same shape. A **not-active login-item registration** means no engine at next login — `engine-architecture` calls the failure it prevents *"everything works today, nothing works tomorrow, and nothing ever said why"* and owes a quiet indicator. A **note permanently rejected** by CloudKit sits in the recorded per-note state and nothing looks at it.

The one part of Fumi always on screen is the menu-bar icon. Its **presence** is already load-bearing — `engine-architecture` rests the crash-stays-dead decision on *"the menu-bar icon is present or absent"* being how the user knows the engine is alive. Whether its **appearance** carries anything beyond that was never decided.

### The rule the sibling record already holds

Read together, the four decided topics are consistent about channel:

| Condition | Channel | Decided in |
|---|---|---|
| A consequence of something the user just did | system notification carries the *why* | `note-window` (oversized refusal, first-delete) |
| An ongoing condition | engine records, management window renders | `storage-and-sync` (sync state), `engine-architecture` (login item) |
| Visible on its own | silence, plus a log line | `space-homing` (fumis on the wrong Space) |
| Caused by an agent | the agent's own error channel, never a notification | `note-window` → `agent-surface` |

The rule is sound. The gap is in row two: *renders it where the user is not looking* is not the same as telling them.

### Options Considered

**A. The icon carries state, and nothing else changes.** Anything the manager would show as wrong marks the icon; clicking routes to the detail.
- Pros: always visible, costs no permission, never fires at the wrong moment.
- Cons: needs the user to glance at a 16px icon they have no reason to look at.

**B. A notification at the transition; the manager holds it afterwards.** Sync stops Tuesday, one notification Tuesday.
- Pros: reaches the user at the moment the guarantee changes.
- Cons: fails in exactly the case the topic exists for — away from the machine, Focus on, or permission never granted. And the icon stays clean while the condition persists.

**C. Both.** Notification when the condition begins, a mark on the icon for as long as it lasts.
- Pros: each covers the other's failure. Deny notifications and the dot remains; miss the dot and the notification already fired.
- Cons: two surfaces for one condition.

**D. Neither — the manager is the surface, and that is the deal.** Consistent with quiet-furniture software and with `space-homing`'s accepted trade-off that a user learns a degradation *"by noticing, not by being told"*.
- Pros: adds nothing; matches the project's demonstrated posture.
- Cons: the worked case above is the cost, and it is data-shaped rather than cosmetic.

### Journey

D was taken seriously, because the record leans quiet hard and `space-homing` accepted this exact trade in its own area. What separates the two is the thing that made its silence defensible: **a wrong Space is visible on its own.** The user can see where their fumis are, so the notice would be telling them something they are already looking at. A stopped sync is visible nowhere. The same argument that licenses silence for placement refuses it here.

B alone fails on its own premise. The topic exists because Fumi has no window guaranteed to be on screen; a channel that can be denied, suppressed by Focus, or simply missed while the user is out is the wrong single answer for a condition that persists.

C won on an asymmetry `storage-and-sync` already used to decide nearly everything in its topic — *"rare silent loss is worse than rare visible annoyance"* — and on the observation that C's shape is already in the record: quota gets *"a system notification plus a line in the management window"*. This generalises that pairing rather than inventing it.

### Decision

*(Amended 2026-09-12 — both claims below were narrowed later the same day by `Dot Qualification`, which this text predates. **The mark has two levels**, red and amber, defined there; "red for a condition that is wrong now" describes only the red one. And **"gets both" holds only for a condition about this Mac's backup relationship as a whole** — a per-note condition keeps the notification and loses the mark, which is why a permanently rejected note carries no dot. `Dot Qualification` argues this is the same rule applied rather than an exception to it, so the text below is an under-specification rather than a live alternative; it stays as the reasoning that reached the pairing.)*

**A condition that persists gets both: a system notification when it begins, and a mark on the menu-bar icon for as long as it lasts.**

The mark is a small status dot on the icon — red for a condition that is wrong now. Seeing it is the prompt to click, and clicking routes to where the problem is stated. The notification carries the transition; the dot carries the duration. Neither is sufficient alone and the reason is symmetric: notification permission or Focus can swallow the transition, and nobody stares at a menu-bar icon waiting for it to change.

**Named residual, accepted: the icon is not guaranteed to be on screen.** macOS truncates status items when the menu bar runs out of room — on a notched laptop with a dozen of them, Fumi's may simply not be drawn — and users of this class of app routinely hide items themselves. When that coincides with a swallowed notification, every channel is dark at once and the user learns nothing until they open the manager.

Accepted rather than closed, because there is nothing to close it with: a menu-bar app has no other always-visible surface, forcing the item to be non-hideable fights the user for a slot macOS may take regardless, and Fumi cannot reliably detect that it is not being drawn, so it cannot fall back either. The claim that the icon is *always* on screen is therefore softened to *the only part of Fumi that can be on screen without the user opening anything* — which is what the decision actually needs.

This does not disturb `engine-architecture`'s Observability rule. The engine still records and exposes; it never presents. What changes is that the management window is no longer the only in-process surface reading that state — the menu-bar manager reads it too, and renders the summary.

*Sibling check: `storage-and-sync` — its rule that the engine records sync state (overall syncing / paused / stopped, per-note synced / pending / rejected) and `management-window` renders it is adopted unchanged; this adds a second reader of the same recorded state and does not move the state's owner. Its absent-zone decision requires Fumi to "tell the user" and never said how, so this answers its open half rather than contradicting it. `engine-architecture` — its Observability rule that the reader decides the surface and the engine never presents is adopted as written; the menu-bar manager is one of the in-process surfaces that rule already contemplates (the document lists "the note windows, the menu-bar manager and the management window" as in-process observers of the engine's model). Its owed quiet indicator for a not-active login-item registration is a caller of this decision rather than a separate mechanism. `space-homing` — its logged-never-surfaced decision for placement failure stands untouched, and the reason it stands is stated above: a wrong Space is visible on its own. `management-window` — no session yet; it already owns where sync state and Copy Diagnostics render, and this adds the quick menu's problem row and the icon's dot to the surfaces it will own.*

---

## Dot Qualification

### Context

`standing-surface` decided that a persistent condition marks the menu-bar icon, and left open which conditions qualify. The set is not "everything the manager could show": a mark that appears for something the user can already see trains them to ignore it, which is the failure `space-homing` named when it refused a notice on placement failure. Four candidates sat on the table, drawn from what the completed topics already record.

### Options Considered

Four candidates, walked one at a time rather than weighed as alternatives — they are not competing, they each either qualify or don't.

**Sync stopped** (an absent CloudKit zone, an expired change token). The case `standing-surface` was decided for.

**Login item not active.** No engine at next login, and nothing about today looks wrong.

**A note permanently rejected** by CloudKit (`serverRejectedRequest`, an oversized record). One fumi is not syncing and every other one is; overall sync reads healthy.

**iCloud quota full.** Initially set aside on the reading that macOS announces this itself and `storage-and-sync` deliberately deferred to it.

### Journey

**The login-item candidate was pushed back on, correctly: a disabled login item is a preference, not an error.** `engine-architecture` holds both halves and does not reconcile them — *"the user's Login Items choice is authoritative and is never silently reversed"*, and separately *"a not-active registration is surfaced, not swallowed"*, because *"registration can succeed without taking effect — pending approval, or disabled — which is observationally identical to not being registered: no engine at next login, and nothing for the user to look at."* Only the second is an error: nobody chose it. The same document then flags that Fumi may not be able to tell the two apart — *"the exact `SMAppService.Status` value a user-disabled job reports"* is on its spike list, *"flagged for verification, not decided here"*. A dot that cannot distinguish them scolds the user for their own setting.

**The quota reading was wrong, and correcting it is what gave the second level a definition.** `storage-and-sync` deferred the *usage figure* to the OS because no CloudKit API exposes container or account usage — so Fumi never had a number to show. The state it decided directly: `quotaExceeded` → notes stay in local truth, editing is never blocked, **"a persistent non-nagging indicator says backup is paused"**, retry when space frees. That indicator has never had a home in any topic. It is the archetype of a condition that is degraded rather than broken and that the user can act on.

That turned a two-colour preference into a criterion. **Amber: the backup guarantee is reduced and there is something you can do about it. Red: the guarantee is gone, and restoring it takes an explicit act** — which is precisely the absent-zone stop, where `storage-and-sync` already *"requires an explicit re-enable"* before it will re-upload or adopt anything.

**The rejected note was argued in on that definition, and then back out of it — the reversal is what sharpened the criterion.** It was first excluded on the reading that one stuck note is not "Fumi is broken", then admitted on the ground that the user *can* act on it by editing or deleting the note, which made it quota's shape at a narrower blast radius.

That admission does not survive examination, and the objection to it was the right one: **editing a note until CloudKit accepts it, or deleting it, is not a remedy — it is abandoning the thing you wanted to keep.** Quota is genuinely fixable and genuinely ends; an absent zone is genuinely fixable and genuinely ends. A rejected note ends only when the note stops being the note. Worse, Fumi cannot tell which case it is in: an oversized record might be fixable by trimming, a permanent `serverRejectedRequest` is not, and nothing available on a 16px icon can carry that distinction. A dot there would be making a promise the app cannot keep.

So the condition keeps the transition half of `standing-surface`'s split and loses the standing half — the rule applied rather than an exception to it. *The notification carries the transition; the dot carries the duration*, and a duration of "forever, unless you give up on this note" carries no action worth signalling. The precedent for what replaces it is already in the record: `note-window`'s first-delete notification, which teaches a permanent fact **once** rather than nagging about it.

The reversal is what turned the criterion from a description into a test. *The guarantee is reduced and there is something you can do about it* admitted the rejected note; **the dot appears only where there is something you can do right now** excludes it, and says why.

**Then a fifth candidate broke the test, and the repair was to separate two things it had been doing at once.** `storage-and-sync` named three states nothing in the product would reveal — *"a note that is stuck, permanently rejected (`serverRejectedRequest`, an oversized record) or simply hasn't synced in weeks"*. The rejected note is the middle one. The third is a Mac that has quietly stopped reaching iCloud: notes pile up at `pending`, which the first pass filed under normal operation, correctly for `pending` as an instant and wrongly for `pending` as a duration.

The worked case is the topic's founding one with a longer clock — three weeks at a desk, connected, nothing landing, every note on one machine, clean icon, silence.

**Staleness splits on what the user already knows, not on what they can do.** Someone who took their laptop away from the network knows exactly why nothing is syncing; marking the icon tells them what they are already aware of, and a rule that fires on every flight teaches people to ignore the dot. Someone sitting at a working desk whose sync has silently stopped cannot know. Same state, opposite entitlement to be told. `storage-and-sync` is already halfway here: it decided a persistent transient failure should *"surface only if persistent"* and never said where.

**That inverts *something you can do right now*, which is fatal to it as the criterion.** Connected-but-not-syncing is exactly the case with no user remedy, and offline — where there *is* a remedy — is the case that should stay quiet. Keeping the old test would have excluded the one condition that most needs telling.

**The repair: the criterion was carrying two jobs, and separating them preserves every call made under it.** What actually distinguished the surviving conditions was never actionability — it was *scope*. `storage-and-sync`'s own model splits an **overall** state (`syncing / paused / stopped`) from a **per-note** state (`synced / pending / rejected`), and every condition that earned a mark is a fact about this Mac's backup relationship as a whole, while every condition excluded is about one note. Once that is said out loud, the second job shrinks to a threshold — *would the user want to know, and could they have worked it out themselves* — which is what admits connected staleness and still excludes an offline Mac.

**The rejected note stays excluded, on a better ground than the one that excluded it.** Under a bare *would you want to know* test it would qualify: you would, and you could not have known. It is out because it is one note, not this Mac's relationship with iCloud — which is also the ground that keeps a conflicted note off the icon without a separate argument. The actionability reasoning above is kept as the path that reached the answer; the scope rule is why the answer holds.

### Decision

**Two rules decide what marks the icon, and they do different jobs.**

> **Scope — the dot reports this Mac's backup relationship as a whole, never the state of one note.** `storage-and-sync` records an **overall** state (`syncing / paused / stopped`) and a **per-note** state (`synced / pending / rejected`); the dot answers to the first. A per-note condition, however serious, lives in the manager's row for that note.
>
> **Threshold — within that scope, a condition marks the icon when the user would want to know and could not have worked it out for themselves.** Both channels answer only to conditions Fumi *observes*, never to states the user *selected*.

**The two levels:**

> **Red — the backup relationship is gone and restoring it takes an explicit act.** Currently one condition: sync stopped, the absent-zone state.
>
> **Amber — the backup relationship is degraded.** Currently two (a not-active login-item registration was listed here until 2026-09-12; see below):
> - `quotaExceeded` — backup paused, notes safe in local truth, editing never blocked, clears when space frees.
> - **This Mac has been connected and has still not completed a sync for a long while.** Whatever the cause — an Apple-side fault, a persistent rejection, a store problem — the user is at a working machine and their notes have stopped reaching iCloud. How long is long enough is implementation's; the product decision is that staleness is a condition at all.

`quotaExceeded`'s amber **is** the *"persistent non-nagging indicator"* `storage-and-sync` asked for and never placed. This is where it lives.

**When more than one condition is true, the dot shows the most severe level any live condition holds — red if any red condition holds, amber otherwise.**

**Settled by derivation** — not discussed. Determined by the two levels above being an ordering over a single guarantee rather than two independent flags, and by `Notification Lifecycle`'s single destination (review-002 F5). Showing amber while a red condition holds would report a *reduced* guarantee to a user whose guarantee is *gone* — and red is precisely the level whose remedy the user will not know to perform unprompted. Co-occurrence is ordinary rather than contrived: an absent zone and a quota ceiling have no common cause, and the two amber conditions can hold together for the same reason — a full quota and a Mac that has not completed a sync in a long while are the same story from two ends. Collapsing to one mark costs nothing because the click already lands on the manager's problem list, which is where more than one condition is enumerated; how that list renders multiple rows is `management-window`'s.

**A permanently rejected note gets the notification and no dot.** When CloudKit first rejects a fumi, one system notification says that note will not sync until it changes; the manager's per-note `rejected` row holds it from then on. **Rejections coalesce per sync pass, not per note** — several notes refused in one pass produce one notification naming the count rather than one per note, and the manager lists which. This is `note-window`'s cap on the same channel, which fixed the refusal notification at *"one notification per transfer"* rather than one per file. The concentrating case is the first-run backfill: `storage-and-sync` triggers a *"background, non-blocking, resumable bulk backfill of the whole library"* when the toggle is first switched on, so a pre-existing library's first pass is where a batch of rejections is most likely, at the moment a new user is forming an impression. No mark on the icon, **because it is one note rather than this Mac's backup relationship** — the scope rule, which keeps it out whatever else is true of it. Two further reasons stood behind the original exclusion and still hold: the only ways out are to edit the note into something acceptable or delete it, and neither is a fix; and Fumi cannot tell a trimmable oversized record from a permanent rejection. One notification teaching a permanent fact is `note-window`'s first-delete shape.

**Not on the icon:**

- **Sync switched off by the user** — `storage-and-sync` records the toggle as *"pause, not destroy"*, and it is a choice, not a condition. Overall state `paused` renders in the manager, marks nothing, **and announces nothing**: a condition Fumi *observes* gets both channels, a state the user *chose* gets neither. Telling someone what they just did is the pattern `note-window` already ruled out when it decided an agent-caused refusal does not notify — the actor already knows.
- **`syncing`, `pending`, `synced` as instantaneous states** — normal operation. It is the *duration* of a stall that is a condition, not a note sitting at `pending` right now.
- **A Mac that is simply off the network.** The user who took their laptop away from wifi knows why nothing is syncing, so the threshold rule excludes it — and a rule that lit up on every flight would teach people to ignore the dot. This is the `space-homing` discriminator applied to knowledge rather than to pixels.
- **Any per-note condition** — by the scope rule: a rejected note, and a conflicted note, both stay in the manager.
- **A broken or unresolvable Space placement** — `space-homing`'s logged-never-surfaced decision stands untouched, for the reason `standing-surface` gave: a wrong Space is visible on its own.

**A not-active login-item registration gets the notification and no dot** *(revised 2026-09-12 — see below).* When Fumi first observes that its registration succeeded without taking effect, one notification says the engine will not start at next login; the manager's row holds it after. Same shape as a permanently rejected note, for a different reason.

*Trigger: review finding — an amber dot was appearing on a Mac whose every note is safely in iCloud, which is not what amber says (review-004 F1).*

**It is out because it is not a backup condition.** The scope rule admits conditions about this Mac's backup relationship, and a lost automatic start costs the whole app rather than the backup leg — nothing is degraded about syncing, today or tomorrow. Admitting it would have widened the scope to *any whole-Mac condition*, which is exactly the widening `Indexing Notice` refuses on the grounds that it converts a backup light into a general status light.

**`engine-architecture`'s own framing settles the level question too.** It calls the indicator *"purely informational; nothing behaves differently"* — which does not earn a step on a two-level severity scale about whether the user's notes are safe.

**The alternative considered and rejected: widen the dot** to *this Mac's ability to do its job*, covering both backup and running at all. It would have kept the login item on the icon and cost only a restated rule, since indexing still excludes on its other ground. Rejected because the narrow rule is load-bearing in three places and the condition it would have been widened for is the one its own owner describes as informational.

**The accepted cost, stated plainly.** The failure `engine-architecture` wanted prevented — *"everything works today, nothing works tomorrow, and nothing ever said why"* — now rests on a notification the user may miss and a manager they may not open. Mitigated by the condition announcing itself where it bites: at the next login no fumis come back, and reopening Fumi by hand still works, since *"launching Fumi manually always runs the engine, whatever the login-item preference says."*

**The user's own opt-out still gets nothing at all**, and `engine-architecture`'s spike still gates the rest: if `SMAppService.Status` cannot separate a user-disabled job from a system-disabled one, the condition gets **no notification either**, because a false alarm about someone's own setting is the app overriding a choice the record calls authoritative.

*Sibling check: `storage-and-sync` — its recorded state enumeration (overall `syncing / paused / stopped`, per-note `synced / pending / rejected`) is adopted as the vocabulary and not re-decided; this selects which values mark the icon and adds nothing to the set. Its `quotaExceeded` ruling — degrade with a visible signal, never silently, via a persistent non-nagging indicator — is answered rather than contradicted: the indicator it asked for had no home, and amber is it. Its absent-zone stop and explicit re-enable requirement are what define red. Its toggle-off-is-pause ruling is why `paused` marks nothing. `engine-architecture` — its not-active-registration indicator and its authoritative-user-choice rule are both adopted; the conflict between them is its own document's, already flagged to its spike list, and this decision names what the spike's answer settles on this surface rather than guessing it. Its rule that launching manually always runs the engine is what makes the case amber rather than red. Its per-note `rejected` state now also drives a one-time notification, which it never decided either way — added here as app-global composition, which `standing-surface` established is this topic's, and its assignment of the per-note *display* to `management-window` is untouched. `note-window` — its one-time first-delete notification is cited as the precedent for teaching a permanent fact once, and its rule that a system notification is the platform primitive rather than an in-app toast is adopted; neither is revised, and no note-window surface is touched, since this notification is app-global rather than a note's own. `space-homing` — untouched; its silence stands on its own argument. `management-window` — no session yet; it inherits two levels rather than one, and what the quick menu says for each is its surface.*

---

## Notification Lifecycle

### Context

`standing-surface` decided that *the notification carries the transition; the dot carries the duration*, and never said what counts as a transition. The gap shows up on an ordinary Monday-to-Friday:

```
Tue  sync stops           → notification fires · you are out, Focus on · missed
Thu  Mac shut down
Fri  login, engine starts → reads the stopped state · dot appears
                          → notification? or was Tuesday your one chance?
```

It matters more since `Dot Qualification` took the dot away from a permanently rejected note. For sync stopped and quota the dot is a safety net: miss the words and the mark is still there. For a rejected note the notification is now the only thing that ever says it out loud.

A second unstated case sits with it: a condition that *begins* while Fumi is not running. Nobody was there for the transition at all.

### Options Considered

**A. Once per condition, ever.** The transition happened Tuesday; that was the announcement.
- Pros: tidiest rule, no bookkeeping beyond a flag.
- Cons: a condition that begins while Fumi is off has no transition anyone witnessed, so it is never announced — which is the worked case the topic was opened for.

**B. Once per first observation by this Mac.** The notification fires the first time *this* engine sees the condition.
- Pros: Friday's login announces, because that engine had never seen this stopped state. A condition that began while Fumi was off is announced at next start.
- Cons: needs per-condition-instance state on the Mac, and the same Mac stays quiet after telling you once.

**C. Re-announce on every engine start while the condition holds.** 
- Pros: nothing is ever permanently missed.
- Cons: it is the nag `storage-and-sync` already refused for quota — *"a persistent **non-nagging** indicator"* — and a condition with no remedy would announce itself at every login forever.

### Journey

A is wrong for a reason that reads as a technicality and isn't: **a transition with no observer is not an announcement.** If the engine is not running when sync stops, "the transition already happened" means the user is never told, and that is the failure this whole topic exists to close — restated at the level of a single missed startup rather than a whole product.

C fails on ground already settled elsewhere. Nagging was refused explicitly for the one condition that most invites it, and re-announcing an unfixable state at every login is the purest form of it.

B is what a transition actually is once you ask *transition for whom*. The engine is the observer; the first time it sees a condition is the moment there is something new to say. That makes Friday's login a first observation rather than a repeat, and it makes a condition that arrived during downtime announceable at the next start without inventing a separate rule for it.

What B does not repair is the Tuesday case — the same Mac, already told, stays quiet. That was put on the table as the accepted cost and taken deliberately: *if it's missed then it's missed.*

### Decision

**The notification fires the first time this Mac's engine observes the condition, and never again for that condition on that Mac.**

> A condition that begins while Fumi is running announces at the moment it begins. A condition that begins while Fumi is not running announces at the next start, because that start is the first observation. A restart while the condition still holds announces nothing — this engine has already told you.

**"That condition" means this occurrence of it, not the class.** When a condition clears, the Mac forgets it announced it, so a later occurrence is a first observation of something new and announces again. Every current condition is designed to clear — quota when space frees, a stall when a sync completes, red on an explicit re-enable — so recurrence is part of the model rather than a curiosity, and a second loss of the sync relationship after the user deliberately restored it is news by any reading.

Accepted cost: a user living at their quota ceiling could cross it, clear it and cross again, and be told each time — which resembles the nagging `storage-and-sync` refused for that exact condition. Taken because crossing the line means adding data and clearing it means deleting data, so the state does not oscillate on its own, and the alternative is a second real failure arriving in silence.

**A missed notification is missed, and Fumi does not chase it.** No re-announcement, no reminder, no escalation. For the three dot conditions — sync stopped, `quotaExceeded`, a connected stall — the dot is standing there regardless, so the words are the faster path rather than the only one. For a permanently rejected note, and for a login-item registration that did not take effect, there is no dot and the manager's per-note row is where the user finds it — the residual cost of `Dot Qualification`, named there and accepted here rather than worked around.

**Each Mac announces for itself.** An account-wide condition observed by two Macs notifies at each, because each is telling the person sitting in front of it — who may only ever sit at one of them. This is not a repeat; it is two first observations.

**Tapping any notification Fumi posts opens the management window — always, every notification, without exception.** Where a condition is behind it, at that condition's row. One destination, two doors: the dot's click and the notification's tap land in the same place. No per-message destination and no special case.

That covers `note-window`'s two as well as this topic's — the oversized-file refusal and the first-delete education. For the education it is the useful answer, since Recently Deleted lives in the manager; for the refusal it adds nothing, because the refused fumi is already on screen, and it costs nothing either. One rule beats a rule plus two exemptions. *(Stated as "every condition" when first written, which read as excluding the two that are not conditions — see the channel table's row one. The rule was always every notification.)*

The alternative was a tap that merely activates the app, which on an `LSUIElement` product with no window on screen shows the user nothing — they acted on the alert and landed nowhere. That is not a design, and the path is routine rather than unlucky: `note-window` chose the system notification over an in-app toast partly *because* it *"persists in Notification Centre"*, so being read hours or days later is the expected reading.

The rejected note was the one case with a plausible second answer — its row explains why CloudKit refused the fumi, while the fumi itself is the only place the user can act, since editing or deleting it are the only exits. It folds into the single rule anyway: the manager is a note organiser with a list, so the note is one step from its own row, and buying that step costs a rule that would otherwise hold everywhere.

*Sibling check: `engine-architecture` — its lifecycle decision holds that a cold start restores the desk and shows **no** management window while *"the manager is what a reopen means"*; a notification tap is a reopen gesture and lands where that table already sends one, so nothing there is revised or extended. Its rule that a crashed engine stays dead until the user reopens it is what makes "the condition began while Fumi was not running" an ordinary case rather than an edge one; untouched. `management-window` — no session yet; where the condition's row sits, what it says, and how the window scrolls to it are all its surface, and this decides only that the tap's destination is that window. `note-window` — its two notifications take the same tap destination as this topic's, which it never decided either way, so nothing there is revised. Its first-delete notification is the precedent for teaching a fact once and accepting that a swallowed notification means the lesson never lands. **It decided the cadence explicitly, and decided per machine**: *"the flag is per machine, not synced… re-showing once on a second Mac costs nothing, whereas a synced flag means a second machine never teaches the safety net at all."* So the rule above agrees with a decision already made rather than deriving something new beside an open question, and the app has one cadence rather than two. *(Amended 2026-09-12 — this check originally reported that `note-window` "did not state whether 'once' is per Mac or per account", and framed the per-Mac rule as this topic's own derivation standing next to an unanswered question. False about the other document: it had decided, and had corrected itself to per-machine from an earlier synced reading. Nothing in this topic changes; only its account of the sibling was wrong.)* Its accounting of notification permission and Focus mode as silent swallowers is adopted as the reason a miss is possible at all. `storage-and-sync` — its `quotaExceeded` ruling for a persistent **non-nagging** indicator is what rules out re-announcement, and its engine-records-the-state rule is what makes "this engine has already told you" a fact the engine can hold; neither is revised, and whether that flag is machine-local or synced is its tiering question rather than this topic's.*

---

## Notification Permission

### Context

Every decision in this topic leans on a channel Fumi is not yet known to have. macOS system notifications require authorisation, and nothing anywhere decides whether Fumi asks for it, when, or what it does when the answer is no. `onboarding-and-permissions` needs that answer to build its first-run flow and cannot derive it — the composition is this topic's.

`note-window` rerouted the question there on 2026-07-27 with a stated lean and an explicit condition for revisiting it:

> *"Notifications are far less critical than Accessibility — it may be better requested lazily, at the moment of first use, rather than front-loading a second permission prompt during onboarding."*
>
> *"If the first-delete education is the **only** use, asking for the permission at all may not be worth the friction. If sync conflicts, agent activity, or version-history events would also notify, the case is stronger and the request should be framed around the broader set."*

That condition is met. Notifications now carry six messages, and three are about whether the user's notes are backed up:

| Message | Also on the dot? |
|---|---|
| Sync stopped | yes — red |
| `quotaExceeded` | yes — amber |
| This Mac connected but not completing a sync | yes — amber |
| A fumi permanently rejected by CloudKit | **no — the notification is its only live channel** |
| A login-item registration that did not take effect | **no — the notification, then the manager's row** |
| First-delete education, oversized-file refusal reason | no — `note-window`'s, both accepted as losable |

*From: onboarding-and-permissions · research · 2026-09-15*

Raised as **"The notification permission is not a sync feature — the backup framing and the sequencing built on it are both withdrawn"**.

Two entries from this topic reached `onboarding-and-permissions`' research queue and have now been worked. `004-notification-permission-is-decided` fixed that Fumi asks for notification authorisation once during first run, *"with its own reason shown before the system dialog — framed on backup: Fumi will tell you if your notes ever stop backing up"*, and left sequencing and wording to onboarding. `005-sequence-the-permission-ask-after-the-sync-decision` then made the ordering binding — the ask comes after the sync decision so the backup framing is true when it appears — and rejected asking only the users who enable sync.

**What survives:** that the permission is asked, once, up front rather than at first use. Adopted unchanged.

**What does not:** the backup framing, and therefore the sequencing rule built to protect it.

**The user's correction, which is the root of it.** Notifications are a general capability, not a sync feature. In their words: *"Why would we attach notifications to syncing? That's spurious logic. Notifications can be used for other things other than sync. They're just notifications that happen to be used mostly for syncing, but not exclusively."*

Today's message set happens to be sync-heavy — sync stopped, `quotaExceeded`, a permanently rejected fumi — but `note-window`'s first-delete education and oversized-file refusal reason are not sync, and nothing constrains what gets added later. Framing the permission on backup describes a snapshot of its current uses as though it were the permission's purpose.

**The concrete harm in the sequencing rule.** Entry 005 ordered the ask after the sync decision precisely because the backup framing is false for a user who declines sync. `onboarding-and-permissions` initially went further and proposed asking *only* sync-on users, keeping the one prompt in reserve for whenever they later enabled sync. Both shapes weld two unrelated choices together: a user who declines sync would have silently also declined notifications — permanently, since macOS asks once — without ever being told that is what they had done. The first-delete education and the oversized refusal would simply never reach them, for a reason having nothing to do with either.

**Fixing the framing dissolves the problem the sequencing existed to solve.** A framing that describes what notifications actually are is true for every user, sync or no sync. There is then nothing for the ordering constraint to protect.

**What `onboarding-and-permissions` has settled, within what you handed over.** The ask is unconditional and sits in the first-run flow with no dependency on the sync decision in either direction. Everyone is asked, once.

**What is asked of you:** withdraw the backup framing as the decided reason, and with it the rule that the ask must follow the sync decision. The wording and position are onboarding's, as you said — this is about the framing you fixed, which is yours.

*Related but separable, and delivered as its own entry: whether a pre-dialog reason screen survives at all. That is a distinct ask you could take or refuse independently of this one.*

*From: onboarding-and-permissions · research · 2026-09-15*

Raised as **"The pre-dialog reason screen does not survive the under-explain steer"**.

Queue entry `004-notification-permission-is-decided` fixed not only that Fumi asks for notification authorisation during first run, but that it does so *"with its own reason shown before the system dialog"* — an explanatory screen preceding the macOS Allow/Don't Allow prompt, carrying the backup framing.

A separate concern from this topic withdraws the *backup* part of that framing. **This entry is about the reason screen itself**, which is a different ask: you could accept a changed framing and still keep a pre-dialog explanation, or drop the screen and keep neither.

**The user's position, stated directly while settling the ask:**

> *"We shouldn't just frame notifications as us telling you when your sync isn't working. They're how we notify you. We don't really even have to explain what we're using them for, they're just notifications. It's pretty standard stuff. We don't have to over-explain these things to the user."*

The steer is against enumerating use cases or justifying the permission at length. A macOS user has seen a notification permission dialog many times and knows what it is; an app that stages its own explanatory screen in front of it is treating an ordinary platform ask as though it needed defending.

**Context on how first run now looks, since it bears on the cost of an extra screen.** `onboarding-and-permissions` has first run carrying three decisions: an iCloud sync offer (recommended and positively framed, never loss-framed), the notification ask, and a launch-at-login offer. Each configures how the product behaves. A pre-dialog rationale screen would be a fourth surface that configures nothing, standing between a new user and writing their first fumi.

**What is asked of you:** reconsider whether the pre-dialog reason screen stands. It was decided here, so dropping or keeping it is yours — `onboarding-and-permissions` has not quietly discarded it, but its own settled position is that the ask is not explained or justified at length.

*From: onboarding-and-permissions · research · 2026-09-15*

Raised as **"'A denial has no route back inside the app' is narrower than stated — macOS lets the user reset it"**.

A factual correction, independent of the framing questions delivered alongside it.

Queue entry `004-notification-permission-is-decided` records, as part of the denial-handling decision: *"No re-prompt, ever. macOS only asks once; anything further is Fumi nagging about a decision it already has."* Entry `005` restates it — *"macOS only asks once, so a denial there has no route back inside the app."*

`onboarding-and-permissions` ran a background dive against Apple's documentation, HIG, developer-forum DTS replies and WWDC material (`deep-dive-001`, recorded in `.workflows/fumi/research/onboarding-and-permissions.md`). Two things came back that bear on this.

**1. The claim as it governs *Fumi's own behaviour* is correct.** Apple's reference is explicit: *"The first time your app calls the method, the system prompts the person... Subsequent calls to this method don't prompt the person again."* Once the user has answered, Fumi cannot raise the dialog again. Your no-re-prompt decision stands on that, unchanged.

**2. But the user has a route back that Fumi does not.** On macOS — unlike iOS — a user can select an app in System Settings ▸ Notifications and press Delete, which returns the app to `.notDetermined`. The next time the app requests authorisation, the dialog appears normally. Two independent developer write-ups document the procedure. **This is developer lore rather than Apple documentation**, and both sources describe it in a development-reset context; whether it behaves identically for an installed, notarized, Developer-ID app on macOS 15/26 is unverified. `onboarding-and-permissions` carries it as a measurement rather than a fact.

**Why it matters to your decision rather than to onboarding's.** Your denial handling has the management window state once, quietly, that notifications are off and what Fumi therefore cannot tell the user, with a route to the System Settings pane. If the reset is real, that line can honestly say more than it currently does — the user is not permanently locked out, they have a self-serve way back, and the System Settings route you already provide is where they would do it. As written, the decision's reasoning assumes a dead end that may not be one.

**What is asked of you:** note that "no route back" is true of Fumi and not necessarily true of the user, and decide whether the management window's line should reflect that. The underlying behaviour is unverified — if the wording would lean on it, it wants measuring first.

*One further platform fact from the same dive, relevant only if you ever consider a silent self-grant: `UNAuthorizationOptions.provisional` exists on macOS but is not a free preview — it silently self-grants on first call and spends the one-shot, after which the explicit Allow/Don't Allow dialog will never be shown for the app.*

### Options Considered

**A. Ask during first run, framed around backup.** Fumi states its reason, then the system dialog.
- Pros: the ask arrives while the user is configuring an app, which is when a permission question belongs; the reason is on screen.
- Cons: an app asking for anything on first launch costs goodwill, and the payoff is invisible until something goes wrong months later.

**B. Ask lazily, at the first notification-worthy moment.** Usually the first delete.
- Pros: the standard advice — ask where the value is visible.
- Cons: the value is *not* visible at that moment. The user is deleting a test note, and a permission prompt is an interruption to an action rather than a question about the app.

**C. Post and let macOS prompt whenever.** B with no control over which moment it lands on.

### Journey

B's worked case is what decided it. A new user tries Fumi out, deletes a throwaway note, and macOS interrupts with *"Fumi would like to send you notifications."* **Don't Allow** is the reflex, because they were deleting something, not configuring anything. Six weeks later their change token expires and the channel that would have told them is gone — from one reflex during a gesture that did not matter.

The asymmetry is what makes B wrong rather than merely riskier: the cost of asking upfront is a moment of friction, and the cost of asking at a bad moment is a permanent channel loss the user never knowingly chose.

**The deciding factor is not the pitch, though — it is that the first-run flow has room it did not have when the lean was written.** `note-window`'s reasoning was explicitly about *front-loading a second permission prompt*, with Accessibility as the first. `engine-architecture` established on 2026-09-02 that **no TCC grant of any kind is requested** to place Fumi's own windows on Spaces, which retired that first prompt entirely. The permission-fatigue argument has lost its premise, and notifications may be close to the only thing the first-run flow still asks for.

### Decision

#### 2026-09-15 — revised
*Trigger: triage from onboarding-and-permissions: "'A denial has no route back inside the app' is narrower than stated — macOS lets the user reset it" — the dead end belongs to Fumi, not to the user, and the manager's line was written as though it belonged to both.*

> **The management window's line says the user can turn notifications back on, not merely where the pane is.** Fumi's own no-re-prompt rule is unchanged; what changes is that the line stops describing a wall.

**The correction, in one line: "no route back" is true of Fumi and not of the user.** Once someone has answered the dialog, Fumi can never raise it again — Apple's reference is explicit that subsequent requests do not prompt, and the no-re-prompt decision rests on that, untouched. But a denied app sits in System Settings ▸ Notifications with a control the user can switch on themselves, whenever they like. The earlier entry's reasoning collapsed the two and wrote the user's position as Fumi's.

**So the line says the fuller thing.** Not *here is the pane* but *notifications are off, here is what Fumi cannot tell you, and you can turn them back on in System Settings*. It costs a clause, and it is owed to precisely the user who most needs the channel — the one whose sync has stopped and who has no words coming.

**The line is live state, not a notice.** It disappears when the user grants the permission. *"Stated, not repeated"* was about not nagging, and it still is; a line that outlives the condition it describes would be worse than nagging, it would be wrong. Fumi therefore reads the authorisation status rather than remembering an answer it got once.

**Rejected as irrelevant rather than as false: the delete-the-row reset.** The concern also carries that a macOS user can delete an app's row in System Settings ▸ Notifications and return it to never-asked, at which point the next request prompts normally. Two things keep it out. It is developer lore, documented in a development-reset context, and unverified for a shipping Developer-ID app. More decisively, it is a story about the never-asked state, and Fumi is never in it — the ask happens at first run, for everyone, so by the time any of this matters the one-shot is spent and the row exists. A route back that requires Fumi to ask again is no route at all under a rule that says Fumi never asks again.

**Confidence.** That a denied app has a row with a user-operable control is the contrast the onboarding dive itself draws when it finds a never-asked app has *no* row and no control to grant with. It is inference from that finding rather than a measured fact, and the new wording leans on it — noted in Open Threads as a measurement.

*Sibling check: `management-window` — no session yet; where this line sits and its exact copy are its surface, and this fixes only what the line must convey and that it clears when the permission is granted. `onboarding-and-permissions` — its dive supplies both platform facts and neither is revised; the never-asked/denied asymmetry it established is what separates Fumi's dead end from the user's open door. `note-window` — untouched.*

#### 2026-09-15 — revised
*Trigger: triage from onboarding-and-permissions: "The pre-dialog reason screen does not survive the under-explain steer" — the reason screen was the other half of the clause revised below, and the setup shape first run is taking leaves nowhere for it to sit.*

> **Nothing precedes the system dialog. Fumi shows no screen of its own explaining why it wants notifications.**

**The question was already closed by the shape of first run, and this only removes what would have contradicted it.** First run is a single setup screen — the sync offer and the launch-at-login offer, then Continue, with the notification dialog firing on the way out. A separate explanatory screen in front of the dialog is not a variation on that shape; there is no position in it for one. *(The shape is `onboarding-and-permissions`', where it stands as a derived lean its own record marks unconfirmed; the user confirmed it here — "we had agreed elsewhere to have a single screen which handles it all in one go". Rerouted to onboarding-and-permissions triage (2026-09-15).)*

**And the ask does not want defending.** A macOS user has answered this dialog many times and knows what it is. An app that stages its own explanation first is treating an ordinary platform ask as though it needed justifying — and the explanation would be the only surface in first run that configures nothing. This second argument stands on its own, so the decision does not depend on the screen shape holding.

**What is not being decided here.** Whether anything is said about notifications *anywhere* in the setup screen's copy is `onboarding-and-permissions`' — this fixes only that Fumi draws no surface between the user and the dialog.

*Sibling check: `onboarding-and-permissions` — it owns the first-run flow, and its record carries both the single-screen shape (two toggles, Continue, the notification dialog on exit) and its settled position that the ask is not explained or justified at length. Neither is revised; this withdraws the one thing this topic had fixed that could not fit inside them, and leaves the screen's own copy where it already sat. `note-window` — untouched; its two notifications are unaffected by how the permission is asked for.*

#### 2026-09-15 — revised
*Trigger: triage from onboarding-and-permissions: "The notification permission is not a sync feature — the backup framing and the sequencing built on it are both withdrawn" — notifications are a general capability, so a backup framing states this month's message list as though it were the permission's purpose, and the ordering rule built to keep that framing honest has nothing left to protect.*

> **Fumi requests notification authorisation once, during the first-run flow. The ask is not framed on backup, and it does not depend on the sync decision in either direction — everyone is asked, once.**

**What the entry below keeps.** That the permission is asked at all, and asked during first run rather than at first use. The Journey above is untouched: its worked case — a new user deleting a throwaway note, interrupted by a system dialog, pressing **Don't Allow** out of reflex — is an argument about *when* to ask, and it still decides the same way.

**What goes, and why.** Notifications are a general capability that happens to be mostly used for sync today. The first-delete education and the oversized-file refusal reason are not sync, and nothing constrains what gets added later. A backup framing is therefore a snapshot of the current message set presented as the permission's purpose — and it is plainly false for a user who declines sync, who is shown a reason describing something they do not have.

**The ordering rule goes with it, because it only ever existed to keep the framing honest.** The ask was sequenced after the sync decision so its wording could follow what the user picked. A framing that describes what notifications are is true for everyone, so there is nothing left for the sequencing to protect.

**The pairing carried a real harm, not just an untruth.** Conditioning the permission on the sync choice — the ordering rule's weaker form, and the ask-only-sync-on users shape its owner proposed — welds two unrelated choices together: decline sync and you would have silently also declined notifications, permanently, without ever being told that is what you did.

**The rejection of *ask only when the user enables sync* survives; its stated reason does not.** The entry below rejected that shape on the ground that *"macOS asks once, so a user who enables sync in month three never sees a prompt, and Fumi cannot raise one."* That platform claim is wrong. `onboarding-and-permissions`' documentation dive established that the one-shot is spent by the app **making its first authorisation request**, not by elapsed time, install date or launch count — a never-asked app can raise the dialog whenever it likes, and Apple's own guidance recommends deferring the ask to the moment the feature is used. The trap named there does not exist. The conditional shape is still out, on the welding ground above rather than on a platform limit.

**Not touched here:** whether a pre-dialog reason screen survives at all. It was fixed in the same clause as the framing and is a separable question, delivered as its own concern.

**Denial handling is unchanged by this entry** — the management window states it once, no re-prompt, no dot.

*Sibling check: `onboarding-and-permissions` — its settled position (2026-09-15) is that the ask is unconditional and sits in the first-run flow with no dependency on the sync decision in either direction; adopted, and this withdraws the framing and ordering constraint that would have contradicted it. Its dive's finding about what spends the macOS one-shot is adopted as the correction to this block's own platform claim. Sequence and wording remain its surface, as the entry below already held. `note-window` — its rulings that the first-delete education and the oversized-refusal reason are each losable under denial are untouched, and they are what make both non-sync messages real rather than hypothetical; its position that the education may never justify pushing for the grant is unaffected by an unconditional ask that is never repeated. `storage-and-sync` — its default-off sync toggle is no longer load-bearing here: the entry below leaned on it to argue the framing was false for sync-off users, and with the framing gone the toggle constrains nothing about the permission. Its own decision is unchanged.*

#### 2026-09-12

> **Fumi requests notification authorisation once, during the first-run flow, with its own reason shown before the system dialog — framed on backup: Fumi will tell you if your notes ever stop backing up.**

**The ask comes after the sync decision in the first-run flow, so its framing is true when it appears.** `storage-and-sync` has the iCloud sync toggle **default-off** with onboarding encouraging it, so a user who leaves it off would otherwise be promised something that cannot happen — both backup-framed notifications presuppose a sync relationship, and what remains for that user is the two notifications `note-window` records as losable, which is its own stated case for not asking at all. Sequencing the ask after the choice lets the wording follow what the user actually picked.

**Rejected: asking only when the user enables sync.** Cleaner in principle and a trap in practice — macOS asks once, so a user who enables sync in month three never sees a prompt, and Fumi cannot raise one. The same *"macOS only asks once"* fact that rules out a re-prompt after denial rules out deferring the first ask to an event that may never fall inside the wizard.

Where exactly it sits in the sequence, and how it is worded, is `onboarding-and-permissions`'. What is fixed here is that it is asked, that it is asked during first run rather than at first use, that it follows the sync decision, and what it is asked *for*.

**Under denial, the management window states it once and Fumi never asks again.** A quiet line where sync state already lives, saying notifications are off and what Fumi therefore cannot tell the user, with a route to the System Settings pane. Stated, not repeated.

- **No re-prompt.** macOS only asks once; after a denial the user must change it in System Settings, so anything further would be Fumi nagging about a decision it already has.
- **No dot.** A denied permission is a state the user chose, and both channels answer only to conditions Fumi observes — the rule `Dot Qualification` already states, and the same respect for an explicit choice that `engine-architecture` draws around Login Items.
- **What denial actually costs, and why it is survivable:** the three dot conditions keep their dot, so the words are the faster path rather than the only one. The first-delete education and the oversized-refusal reason simply never appear, which `note-window` accepted for each. The one real loss is a permanently rejected fumi, whose notification is its only live channel — it falls back to the manager's per-note row, which is also why the manager must say the channel is off rather than looking complete.

**Unverified and worth knowing:** `note-window` records Focus mode as swallowing a notification *"silently"*, alongside a denied permission. Whether Focus actually drops a notification or merely defers it into a summary is not established anywhere in this project, and the two differ for every argument above — a deferred notification is late, a dropped one is lost. Not load-bearing for this decision, since it is asked and framed the same way either way.

*Sibling check: `note-window` — its reroute entry's lean toward a lazy ask is superseded rather than contradicted: the entry named the condition under which the case gets stronger, and states its own position is "not a blocker". Its rulings that the first-delete education and the oversized-refusal reason are each losable under denial are adopted unchanged and are what make denial survivable. The entry itself sits in `onboarding-and-permissions`' research queue and is theirs to walk; nothing here edits it. `onboarding-and-permissions` — it owns the first-run flow, the wording, and where in the sequence the ask lands, plus the graceful-degradation remit its brief already claims; this answers only the whether-and-when its own queued entry says must be decided. `engine-architecture` — its 2026-09-02 finding that no TCC grant is requested is adopted as the reason the fatigue argument no longer applies; its rule that an explicit user choice is authoritative and never silently reversed is applied by analogy to a denied permission. Neither is revised. `management-window` — no session yet; where the notifications-are-off line sits and how it reads is its surface.*

---

## Message Taxonomy

### Context

Four subtopics decided a channel each without ever stating the rule they were applying. The rule exists — every subtopic applied it and none stated it — and `standing-surface` recorded a four-row draft of it early, before three of the decisions that refined it. This subtopic writes it out, and completes the channel inventory: the draft covered notifications, the dot, the manager and silence, and omitted the surfaces that belong to a process rather than to a condition.

### Decision

> **The channel follows who can see the problem and who can act on it — never how serious it is.**

| Situation | Channel |
|---|---|
| The user did something and it did not work | a notification carries the **why**, at the moment; the failure itself shows in place |
| A condition about **this Mac's backup relationship** | a notification when it begins, a dot for as long as it lasts |
| **One note's** promise is broken | one notification, coalesced per sync pass; the manager's row after |
| The user can already see it, or knows why | nothing, plus a log line |
| The user **chose** it | no notification, no dot — the manager still renders it where it renders state |
| An **agent** caused it | the agent's own error, in its own conversation — never a notification |
| **Fumi itself is broken** and no in-app channel can run | a modal alert, drawn by whatever process still can |
| Anything read **after the fact** | the system log |
| A **caveat on the truthfulness of a surface's answers** | that surface, for as long as it is true |

Each row is a decision made elsewhere and cited below, not a new rule — the last of them decided in `Indexing Notice` in this document, which is why it has no external citation. The ordering is not a precedence — a message matches one row by construction, because the rows ask different questions about who is present.

**The complete channel inventory**, which no earlier table carried in full: a system notification; the menu-bar dot; the management window's rows; a surface on the fumi itself (`note-window`'s conflict banner, deleted banner, oversized-refusal state); a modal alert; an agent's error reply over the socket; the unified system log; and macOS itself, which `storage-and-sync` leans on for the iCloud-full message rather than reimplementing it.

**A dot condition also emits a log line at its transition.** Not a new channel and not an exception — `engine-architecture`'s Observability rule already sends everything read after the fact to the system log, and a condition that changed a backup guarantee is exactly what a post-mortem needs. Stated because no earlier decision said it out loud.

### The modal row, and why it is a row rather than a one-off

The initial reading was that the modal should stay a one-off: it is the most intrusive surface in the app, it is the one channel a denied notification permission cannot switch off, and making it a category invites a second and third use.

**That was the wrong reason, and the right scoping makes it safe.** The modal is not chosen for volume — it is chosen because **every other channel requires a working Fumi**. A notification needs a live engine to post it, the dot needs a running menu-bar item, the manager needs a process to draw it. When Fumi itself is the broken thing, the modal is not the loudest option available; it is the only one. That cannot be stretched to an ordinary condition, because for an ordinary condition the other channels work.

**First established, and not OS-level.** A wedged engine holds the lock and cannot answer — *"the wedged one by definition cannot"* report, so the **arriving** process the user launched draws the alert and offers force-quit-and-reopen. macOS cannot do this for Fumi: it never learns that a second launch failed to take a lock. The OS beachball needs a focused window, which a menu-bar app with nothing on screen does not have.

**Narrowed: a crash does not qualify.** `engine-architecture` decided a crashed engine stays dead until the user reopens it, and reopening simply works. The modal belongs to the wedge specifically — alive, holding the lock, not answering — where reopening appears to do nothing.

*Sibling check: `engine-architecture` — the *"Fumi isn't responding"* alert, its force-quit-and-reopen offer, the arriving process as the reporter, and the crashed-engine-stays-dead decision are all adopted exactly as decided; this generalises the alert's **condition for use** without touching the alert, its wording, or any lifecycle call. Its Observability rule is what puts a log line at each transition, and its rule that the engine records and never presents is unaffected — every channel here belongs to a client. `note-window` — its in-note surfaces (conflict banner, deleted banner, oversized-refusal state) are listed in the inventory as decided there and are not re-decided; its rule that an agent-caused refusal returns to the agent rather than notifying is row six. `storage-and-sync` — Fumi leaning on macOS for the iCloud-full message is its decision and is listed, not revised. `agent-surface` — no session yet; the shape and codes of an agent's error reply remain theirs, and row six constrains only that a notification is not used in its place.*

---

## Silent By Design

### Context

Several completed topics chose silence deliberately, and each chose it when a standing surface did not exist. Now one does, and cheaply. This subtopic walks the corpus and asks of each silence whether it was a judgement about the condition or an absence of anywhere to put it — the second kind is a decision to revisit, the first is not.

The audit reads each silence against the two rules `Dot Qualification` settled: **scope** (this Mac's backup relationship, never one note) and **threshold** (would the user want to know, and could they have worked it out themselves).

### Findings — four silences had no surface rather than a reason

Each of these was decided *to be surfaced* and left without anywhere to appear. All four now have one, decided in this topic:

| Condition | What the owning topic said | Now |
|---|---|---|
| An absent CloudKit zone | *"stop, leave local truth untouched, **tell the user**, require an explicit re-enable"* — surface assigned to `management-window`, never placed | **red** |
| `quotaExceeded` | *"a persistent non-nagging indicator says backup is paused"* — no home in any topic | **amber** |
| A persistent transient failure | *"surface only if persistent"* — no surface named for the persistent case | **amber**, as connected staleness |
| A login-item registration pending or disabled | *"surfaced quietly… purely informational"* — indicator owed to `observability` and the wizard | **a notification, then the manager's row** — no dot; it is not a backup condition *(revised 2026-09-12, review-004 F1 — recorded here as amber until then)* |

These were never arguments for silence. `storage-and-sync` said so itself: *"silent degradation needs somewhere to become visible or the guarantee lapses without anyone noticing."*

### Findings — the remaining silences hold

Each of these was a judgement about the condition, and the two rules confirm rather than overturn it:

- **A wrong Space after a broken or unresolvable placement** (`space-homing`) — visible on its own. This is the discriminator `standing-surface` borrowed to justify its own refusal of silence, so overturning it here would be incoherent.
- **An unreconciled Mac declining to purge** (`storage-and-sync`) — nothing is lost, the behaviour is protective, and it resolves itself once the Mac reconciles.
- **Sync arrivals** (`note-window`) — *mark the change, don't announce it*. The mark explains itself when the user looks, which is what makes announcing redundant rather than merely noisy.
- **A future-dated timestamp, left uncorrected** (`note-model`) — visible on its own: the note sits at the top of sort-by-recent until the clocks agree. Correcting it silently would be the worse failure, as that topic argued.
- **A damaged bundle, repaired internally and never surfaced** (`note-model`) — per-note by scope, and excluded by threshold on that topic's own reasoning.
- **A Mac simply offline, and a user with no iCloud account at all** — excluded by threshold: both users know exactly why nothing is reaching iCloud. The second looks like it should be loud, since there is no backup leg but Time Machine, and it is the offline case at a longer duration.

### Decision

> **The audit changes nothing further. The four conditions above were silences for want of a surface and now have one; every remaining silence in the corpus is a judgement about its condition and stands.**

**The strongest confirmation came from `note-model`, which reached the threshold rule independently and earlier.** Rejecting a per-note "this was repaired" notice, it argued: *"it can only ever fire in the sync-off case, where nothing better was recoverable anyway. **A notice that fires only when nothing can be done about it is noise.**"* That is this topic's threshold rule in one sentence, written weeks before it, about a different surface. A rule two topics derive separately is more likely to be the real one than a rule invented once.

**The discipline the audit actually enforces** is telling the two kinds apart. *This is not worth telling the user* and *there is nowhere to tell them* read identically in a finished document — both appear as a decision to stay quiet — and only the second is a debt. `storage-and-sync` flagged exactly this risk about itself: *"designing the panel later and finding the state was never recorded, so there is nothing to render."* Four of its own silences were of the second kind.

*Sibling check: `space-homing` — its logged-never-surfaced decision for placement failure and its restore-burst aggregate predicate are both re-examined and left standing, on the argument it made itself; nothing is revised. `storage-and-sync` — its absent-zone, `quotaExceeded` and persistent-transient rulings are each answered with a surface rather than contradicted, exactly as `Dot Qualification` and `standing-surface` record; its unreconciled-Mac purge refusal is confirmed unchanged. `note-model` — its damaged-bundle silence, its rejection of a repaired-value notice, and its refusal to correct a future-dated timestamp are all confirmed and none revised; its reasoning is cited as independent support for this topic's threshold rule. `note-window` — *mark the change, don't announce it* is confirmed for sync arrivals and unchanged. `engine-architecture` — its owed quiet indicator for a not-active registration is answered by `Dot Qualification` (a notification at first observation plus the manager's row, not a dot — the indicator's placement was always that document's to assign to `management-window`, and this keeps it there), and its `SMAppService.Status` spike remains the condition that decision waits on; its Observability rule is untouched.*

---

## Indexing Notice

### Context

*From: search-and-retrieval · discussion · 2026-09-12*

Raised as **"Something must say the library is still indexing — and keep saying it."**

`search-and-retrieval` decided that **every index rebuild is a background job that never blocks the app, and the interface says the library is still indexing while one is running.** The precedent taken was Spotlight: a Mac is usable while it indexes, results are simply incomplete for a while, and the system says so rather than pretending. Incompleteness is accepted deliberately, and the notice is the entire mechanism that keeps it honest rather than broken. That decision then stops at *"the interface"*, and composing it is this topic's.

It is not cleanly one of the classes already decided here. Fumi is `LSUIElement` — no Dock icon, no window guaranteed to be on screen — and this is neither a one-shot event nor a recorded sync state nor a process failure. It is a **long-running caveat on the truthfulness of another surface's answers**, live for as long as a job runs.

Three occasions it fires, differing in character: **first launch after install or restore** (the whole library indexes — expected, finite, and the user has just done something that explains it); **a second Mac still receiving its library** (same shape); and **after a derivation-rule change** (an app update triggers a reprojection the user did not ask for and has no model of).

And one that does not end: `search-and-retrieval` also decided *the incomplete-index state does not clear while any note remains unindexable* — a bundle whose bytes never arrived or will not parse is retried indefinitely with no job running. So the condition can persist for days with nothing progressing. Two consequences for the composition: a channel suited to a five-minute post-restore job may be wrong for a permanent one, and `note-model`'s rule that **a damaged bundle is never surfaced to the user as damaged** constrains the wording — *"still indexing"* is true and says nothing about damage, which is why search chose it.

What search needs from the answer is only that the user can find out results may be incomplete. It does not need a particular channel, a progress figure, or a count.

### Journey

**The dot was the obvious candidate and its own definition excludes it.** `Dot Qualification`'s scope rule is that the dot reports **this Mac's backup relationship**, and indexing completeness is a different axis — whether search is telling the truth, not whether notes are safe. Admitting it means widening the scope to *any whole-Mac condition*, which converts a backup light into a general status light and costs the dot the single meaning four decisions were spent establishing.

**A notification is wrong on shape.** This is a caveat with a duration, not a transition, and it recurs on every install, restore and reprojection. `Notification Lifecycle`'s per-occurrence rule would fire it repeatedly for something nobody needs announced.

**The never-ending case is what settles it, because it breaks both of those and not the third.** One unparseable bundle keeps the state true indefinitely. A permanent dot for it would be a standing mark about something outside the dot's scope, on a condition nobody can clear — and the repeated *announcement* such a state invites is what this topic refused for `quotaExceeded`. (`quotaExceeded`'s own dot *is* persistent, and deliberately so: it is the *"persistent non-nagging indicator"* `storage-and-sync` asked for. What was refused there was re-announcing it, never the standing mark.) A permanent caveat beside a search field is not a nag at all — it is only ever read by someone who just searched, and for them it is the most useful sentence on screen.

**Which points at the general answer: the surface that gives the incomplete answer carries the caveat.** You care about index completeness at exactly one moment — when you search — and nowhere else. That is also what the agent surface already does: `agent-surface` carries the same completeness state on the response envelope, so the human half and the agent half end up with the same shape rather than two unrelated mechanisms.

### Decision

> **The indexing caveat lives beside the manager's search results, and nowhere else. No dot, no notification.** While an index rebuild is running — or while any note remains unindexable — the manager's search surface states that results may be incomplete. Everywhere else, Fumi says nothing about indexing.

This adds a ninth row to `Message Taxonomy`'s inventory in kind rather than in mechanism: **a caveat on the truthfulness of a surface's answers belongs on that surface, for as long as it is true.** It is distinguished from every existing row by having no event to announce and no guarantee at risk — only an answer that is not yet complete.

**Wording is constrained but not decided here.** *"Still indexing"* is true in the never-ending case and says nothing about damage, which is what keeps it inside `note-model`'s rule that a damaged bundle is never surfaced as damaged. Exact copy and placement are `management-window`'s.

**Nothing is owed back to `search-and-retrieval`.** Its honesty argument rests on the notice existing, and it does — on the search surface rather than app-wide. Its concern invited a report only if this composition concluded the notice was the wrong instrument for the never-finishing case; it concluded the opposite, that the search surface is the one channel where a permanent caveat is honest rather than nagging.

*Sibling check: `search-and-retrieval` (in session elsewhere) — its background-rebuild decision, its Spotlight precedent, its accepted incompleteness and its rule that the state does not clear while a note remains unindexable are all adopted as given and none revised; this answers the interface question it deferred. `management-window` — no session yet; the manager's search surface is where the caveat lives, and its exact copy and placement are theirs. `note-model` — its rule that a damaged bundle is never surfaced to the user as damaged is adopted as a constraint on the wording, not revised. `agent-surface` — no session yet; the response-envelope half of this state remains theirs, and this covers the human-facing half only. `Dot Qualification` and `Notification Lifecycle`, in this document — neither is revised: the dot's scope rule is what excludes indexing, and the per-occurrence notification rule is what makes a notification the wrong shape.*

---

## Launch During Restart

### Context

*From: engine-architecture · discussion · 2026-09-14*

Raised as **"A launch during a restart stands down and says so — but no channel carries that message."**

`engine-architecture`'s `Single instance` rule (2026-08-18) holds that *"a restart in progress belongs to whoever asked for it. An arriving process that learns the engine is `restarting` stands down rather than taking the lock, and says what is happening."* Standing down is what stops a pre-update binary seizing the lock and leaving the user on the old engine with the update apparently not applied.

The reporting half was load-bearing in that argument rather than decorative: *"standing down does not reintroduce the 'user launches Fumi and nothing happens' silence the branch exists to prevent, because the process reports the restart instead of exiting mutely."* Which surface carries the report was deliberately left to this topic, and it is a class with no row in the channel inventory.

The moment:

```
user clicks Update now       the engine drains, the fumis vanish, the icon goes
user reaches for Fumi         ← "did that do anything?"
                              the arriving process finds the lock held, connects,
                              is told `restarting`, and stands down rather than
                              taking it
Sparkle's relauncher reopens Fumi — the desk returns
```

None of the three existing channels obviously takes it. The menu-bar item is seconds from disappearing with the engine. A notification would be posted by a process that is itself about to exit, and would outlive by hours the moment it describes. The modal alert is scoped to the wedge specifically — *alive, holding the lock, not answering* — and a draining engine is answering: returning the going-down frame is how the arriving process learned about the restart at all.

### Journey

**The first answer reached was "none", on the wrong reason.** The argument put was that the silence is real but self-correcting: *"user launches Fumi and nothing happens"* names a permanent silence, and this one ends when the relauncher reopens the app — so the gesture is answered by the desk returning rather than by a message, and every available channel is worse than that.

**The user re-grounded it, and the replacement reason is stronger: this is standard macOS app behaviour and Fumi does not have to handle it.** The difference is not cosmetic. The self-resolving argument concedes the premise — that there is a Fumi-shaped hole here, and the silence is merely tolerable because it is short. It invites the question back the moment someone times the gap and finds it longer than expected. The platform reading refuses the premise: an app that closes and reopens during an update, and does not respond to a launch gesture in between, is what macOS apps do, so there was never a hole to fill. Duration stops being load-bearing.

The original argument is kept below as the supporting reason it is — it explains why the silence costs nothing — rather than as the deciding one.

### Decision

> **This class gets no channel. A launch that lands in the restart gap is answered by the app reappearing, and Fumi says nothing.**

**The deciding factor is that there is nothing here belonging to Fumi.** An app that closes and reopens during an update, and does not respond to a launch gesture in the seconds between, is ordinary macOS behaviour. Building a surface for it would be Fumi handling something the platform already handles by being what it is.

The silence also costs nothing, which is why no residual is being accepted here. *"User launches Fumi and nothing happens"* names a permanent silence; this one ends when the relauncher reopens the app — `engine-architecture` observes the window is brief and that the relauncher is actively minimising it, and no number is fixed anywhere. The gesture is answered by the desk returning, which is what the user wanted from it.

Both alternatives are worse than the silence they would replace. A modal is a dialog the user must dismiss while the app reappears behind it, drawn by a process that then exits. A notification persists in Notification Centre — which is the property `note-window` chose the channel *for* — so *Fumi is updating* is read hours later about an update that finished, and under `Notification Lifecycle`'s rule it would open the management window pointing at a condition that no longer exists.

**No new row in `Message Taxonomy`.** The case lands on the existing *the user can already see it, or knows why* row: they clicked Update, and the drain is logged like every other transition under `engine-architecture`'s Observability rule. A row whose channel is silence would be a category kept warm for an instance that has already been answered.

The mitigation that matters is placed elsewhere and unchanged: `engine-architecture` rerouted expectation-setting in the update flow to `build-and-release` on 2026-08-20 — an update that says *Fumi will close and reopen* makes the vanishing desk the expected thing, and the user does not reach for Spotlight at all.

**`engine-architecture` is owed an amendment**, rerouted back to it: its `Single instance` block argues from a report that has no surface, and the clause needs to rest on the gap being brief and self-resolving instead.

*Sibling check: `engine-architecture` — its `Single instance` rule that an arriving process stands down on `restarting` rather than taking the lock is adopted unchanged; only the "and says what is happening" clause is contradicted, and that is rerouted to it rather than revised here. Its scoping of the modal alert to a wedged engine — alive, holding the lock, not answering — is applied as written and is what excludes the modal from this case. Its accepted residual, that a launch between the engine's exit and the relaunch finds no socket and takes the lock, is untouched. Its Observability rule is what puts the log line here. `build-and-release` — no session yet; the update flow's expectation-setting already sits in its triage queue and is the real answer to this case, unchanged by this decision. `note-window` — its reasoning that a system notification persists in Notification Centre is cited as a cost here, not revised.*

---

## Summary

### Key Insights

1. **A channel is chosen by whether the condition is visible on its own, not by how serious it is.** The four completed topics turn out to agree on this without ever stating it, and it is what separates this topic's refusal of silence from `space-homing`'s acceptance of it: a wrong Space is something the user is already looking at, a stopped sync is visible nowhere.
2. **Two surfaces for one condition is not redundancy when each covers the other's failure mode.** Notification permission or Focus can swallow a transition; nobody watches a menu-bar icon waiting for it to change. The pairing was already in the record once (quota's notification plus a manager line) before it was stated as a rule.
3. **An orphaned indicator is a decision looking for a surface.** `storage-and-sync` decided `quotaExceeded` needed *"a persistent non-nagging indicator"* and had nowhere to put it; the dot's second level was defined by finding out what that indicator had to be. The severity criterion came out of the orphan rather than being invented for it.
4. **A severity level defined by what the user can do survives contact with new conditions; one defined by how bad it feels does not.** Red-versus-amber was a preference until quota forced it into *the guarantee is gone and needs an explicit act* versus *the guarantee is reduced and you can act*. (The *you can act* half did not survive either — see 6; what held is that the levels are defined by something checkable rather than by feel.)
5. **"Something you can do" is not the same as "something you can do about it", and the gap is where a criterion leaks.** The rejected note passed the first test — edit it, delete it — and fails the second, because both of those abandon the note rather than fixing it. Tightening the criterion to *there is something you can do right now* is what excluded it.
6. **A criterion that keeps producing right answers can still be the wrong criterion, and the case that breaks it is the test.** *Something you can do right now* survived four conditions and inverted on the fifth: a Mac that is connected and silently not syncing has no remedy and most needs telling, while an offline Mac has an obvious remedy and should stay quiet. The repair was not a new exception but noticing the criterion was doing two jobs — **scope** (this Mac's backup relationship, never one note) and **threshold** (would the user want to know, and could they have worked it out) — after which every earlier call held, for better stated reasons. A criterion worth keeping explains the answers it already gave.
7. **The most intrusive channel can be the safest choice, when every other one is structurally unavailable.** The modal alert looked like a category to keep closed because it is the loudest surface Fumi has. Scoping it by *volume* would have been arbitrary; scoping it by *what still works* is not — when Fumi itself is broken, a notification has no engine to post it, the dot has no menu-bar item, and the manager has no process to draw it. The rule that makes a channel safe is sometimes a fact about availability rather than a judgement about taste.
8. **A surface the user cannot act on is a nag, not a signal — so a condition with no remedy keeps the transition and loses the duration.** That falls out of `standing-surface`'s own split rather than being an exception to it: a duration of "forever, unless you give up" carries nothing worth rendering, and `note-window`'s one-time first-delete notification was already the shape for teaching a permanent fact once.

9. **"Not worth telling the user" and "nowhere to tell them" look identical in a finished document, and only one is a debt.** Four conditions across three topics had each been *decided to be surfaced* and left without a surface — and read, later, exactly like decisions to stay quiet. Separating the two is the only thing this audit did, and it is what turned `storage-and-sync`'s own warning about itself — *"designing the panel later and finding the state was never recorded"* — into four corrections rather than a worry.

10. **Before asking which channel carries a message, ask whether the message is the app's to send.** Every channel question in this topic assumed something needed saying, and one did not: an app that closes and reopens during an update, unresponsive to a launch gesture for the seconds in between, is what macOS apps do. A channel invented for it would be Fumi narrating the operating system.

11. **A permission framed on what it currently carries is framed wrong.** Notifications were framed on backup because backup is what three of today's six messages are about — which made a general capability look like a feature of one leg of the product, false for any user without that leg, and invited an ordering rule to keep the untruth from showing. Framing on what the thing *is* removed both. The tell is that the framing needed a supporting rule at all.

12. **Two answers can agree on the outcome and differ on whether the question stays closed.** The restart gap was first answered *no channel, because the silence is brief and self-correcting* — which concedes there is a hole and only argues it is small, and reopens the moment someone finds the gap longer than expected. Re-grounding the same answer on *this is the platform's behaviour, not ours* refuses the premise instead, and duration stops being load-bearing. When two reasons reach the same decision, the one that removes the question is worth more than the one that survives it.

### Open Threads

- **A not-active login-item registration's notification is conditional** on whether `SMAppService.Status` distinguishes a user-disabled job from a system-disabled one — `engine-architecture`'s existing spike. A negative result means the condition gets no channel at all, because a false alarm about someone's own setting is worse than silence.
- **How long "a long while" is** for the connected-staleness condition is implementation's to size, and nothing here fixes a number.
- **Whether Focus mode drops a notification or defers it** is unestablished anywhere in the project, and `note-window` records it as a silent swallower. A deferred notification is late; a dropped one is lost.
- **That a denied app carries a user-operable control in System Settings ▸ Notifications** is inferred from `onboarding-and-permissions`' finding that a *never-asked* app has no row and no control at all. The manager's denial line now tells the user they can turn notifications back on, so the claim is load-bearing and wants measuring on a shipping build.
- **The menu-bar icon is not guaranteed to be drawn** — menu-bar truncation and user-hidden status items are accepted residuals with no mitigation available. They weaken, without overturning, the reasoning that a missed notification is tolerable because the dot stands regardless.
- `note-window`'s size-limit *"discoverable home"* concern still has no receiving decision; it sits in `management-window`'s triage queue.
- `engine-architecture`'s `Single instance` block is owed an amendment — its *"and says what is happening"* clause has no surface, and the rule now rests on the restart gap being brief and self-resolving. Rerouted to its triage queue.

### Current State

- **Resolved** — that a persistent condition gets both a transition notification and a standing mark on the menu-bar icon; that the mark answers to this Mac's backup relationship rather than to any one note, and within that to conditions the user would want to know and could not work out themselves; that it has two levels and shows the most severe one any live condition holds; which recorded sync states qualify for which level, which mark nothing, and that a permanently rejected note and a login-item registration that did not take effect each get the notification without a mark — the first because it is one note, the second because it is not about backup.
- **Also resolved** — when the transition notification fires (first observation by this Mac), that it never repeats within one occurrence but does announce a later occurrence after the condition clears, that a missed notification is accepted rather than chased, and that tapping one always opens the management window at the condition's row.
- **Also resolved** — that notification authorisation is requested once during first run, unconditionally and with no dependence on the sync decision in either direction, not framed on backup, and with no Fumi-drawn screen preceding the system dialog *(revised 2026-09-15 — the earlier entry framed it on backup, sequenced it after the sync choice, and put a reason screen in front of the dialog)*, and that a denial is never re-asked but is stated in the manager as something the user can reverse in System Settings, the line clearing when they do.
- **Also resolved** — the channel rule stated as a rule, the complete channel inventory, a log line at each dot transition, and the modal alert as a scoped row (Fumi itself broken, the wedge specifically) rather than a one-off.
- **Also resolved** — that the indexing caveat lives beside the manager's search results and nowhere else, which is a class of message with no event and no guarantee at risk.
- **Also resolved** — the corpus audit: four conditions were silent for want of a surface and now have one; every other silence in the project is a judgement about its condition and stands.
- **Also resolved** — a launch landing in the gap while Fumi restarts for an update gets no channel at all: the app reappearing is the answer, and ordinary macOS behaviour is not Fumi's to narrate.
