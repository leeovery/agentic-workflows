'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a raise (6.1.5, 16.9) — a call Claude has a lean on, put
// through the decision point (decision-point.cjs) and drawn for the person
// by the engine (projections/raise.cjs), never by prose alone (16.9.1); and
// the person's answer to it, recorded by one command in the ledger and the
// trust log (16.13.3).
//
// - The draw: `raise <unit>.<phase>[.<topic>] --answers <question>
//   [--relies-on <id> …] [--always <mark>]`, Claude's call on stdin as one
//   JSON object: the
//   question as the person reads it; its rows, each `{key, name, text,
//   notice}` — the key, a short name for what the person would notice, the
//   answer's text and what they would notice; the lean, a row's key; why
//   Claude leans so; the sort, `one` or `several` (16.3.7); the mechanism,
//   behind the screen's toggle; whether the answer is product-wide; and,
//   where Claude stepped back from the problem before setting out its rows,
//   what that found (`stepped_back`, 19.4.13, 19.4.21), lines drawn above
//   the lean — never in the build, whose park keeps the call's own fields
//   alone in the ledger, nor at an investigation's place, where it makes the
//   screen the fix direction's, while the root cause points at no current
//   entry (investigation-log.cjs); the fix direction's log line takes it
//   from the seal as its body (`steppedBackSealed`). Every field of text is
//   one line but the mechanism, drawn as written; nothing else is taken.
// - A raise on a replacement (16.5.7, 29.5.2): `raise <unit>.<phase>[.<topic>]
//   --replaces <entry> --reason <reason> [--cause <id>] [--relies-on <id>
//   …] [--always <mark>]`, the same call on stdin, its rows Claude's
//   proposed answers in place
//   of the decision's, the lean one of them. The screen adds a row of its
//   own, `keep`, keeping the decision as it stands, its answer as the draw
//   found it, which the seal holds.
// - It refuses, drawing nothing: no session; no state; a place or a link
//   `ledger decide` refuses — `ledger replace`, on a replacement — read and
//   checked by that code before any lock (ledger-write.cjs), since the answer
//   lands as that write; a question answered already, merged into another's
//   answer, or moved to the roadmap as later — after a `/clear` or a
//   compaction Claude can raise one again — whether or not the conversation
//   holds its seal; an entry replaced that is no decision, whose answer the
//   rows give; `--always` given twice, naming no mark, or with `--fact`; a
//   call of another shape;
//   fewer than two rows — on a replacement, no proposal; a key the trust log
//   cannot key, one two rows share, or one that is the screen's own word in
//   any case (`t`, `e`, `technical`, `explain`, `comment`, and `keep` on
//   every raise, so a raise event's `keep` always means a keep); a lean
//   naming no row of Claude's; a proposal whose answer is the decision's as
//   it stands; and a row holding several rules. The one-decision check
//   (ledger-one-decision.cjs) judges each of Claude's rows as the entry it
//   would land as — its answer, and the other rows of Claude's as what it
//   rules out — every row's call put at once; the seal names the rows it
//   judged to hold one rule, and a row the call cannot judge is drawn all the
//   same. The why is not judged with them, so every decision a raise lands
//   lands unchecked, for the late check to judge whole at the next start
//   (ledger-late-check.cjs): the seal's rows judged are the record of what
//   the draw judged, and no call is made at the answer. Beside the checks
//   the labeller labels the call (labeller.cjs) from its question and its
//   rows, each its answer and what the person would notice, null where its
//   call fails: the label is sealed with the call, in the conversation or on
//   its park, so a raise is labelled once — never at `raise show`, a
//   `raise draw` or the answer, and never a fact (16.3.8).
// - A fact (16.3.8): `raise <unit>.<phase>[.<topic>] --answers <question>
//   [--relies-on <id> …] --fact`, a fact Claude cannot check and only the
//   person holds. The call on stdin is the question, its rows, the
//   mechanism and whether the answer is product-wide: no lean, no why, no
//   sort. Its rows may be none or any number, each checked as a call's row
//   is. Nothing of Claude's is in it to judge or to decide, so neither the
//   one-decision check nor the decision point is reached: it always asks,
//   its reason its own. Its answer lands as the person's decision, sealing
//   no lean and moving no one, and logs nothing in the trust log, its "I
//   don't follow" included: a fact takes no label, adds no evidence and
//   meets no threshold (16.3.2). It refuses `--replaces`: a fact that
//   changes is the person's to say, and the decision it changes is replaced
//   as any other.
// - The seal (16.1.2): the call as given, sealed before the person answers, so
//   its lean cannot change — `raise-shown.json` in the conversation's folder
//   (conversation.cjs), each raise drawn there by its id, with a version of
//   its own: the call; the place; the question it answers, null on a
//   replacement, and the entries it relies on, by full id; on a replacement,
//   the decision it replaces by full id, the reason and the cause, and the row
//   keeping the decision as it stands, so the answer needs nothing more;
//   whether it is a fact; the id, minted at the draw, which is the id its line
//   lands as; the menu it is declared as, `raise — <id>`; the rows whose
//   answer and what it rules out the check judged one rule; the label, null
//   for a fact; the model the call was decided under, null for a fact; what
//   the decision point decided it from that the label does not hold
//   (`DecidedFrom`); the decision point's reason; when it was shown; its
//   answer once given — when, and the row's key, null for the person's own
//   words — null until then; and how many times the person did not follow
//   it. It is written before the command answers, and one that cannot be
//   written refuses the raise. Every write to the seals holds a lock of
//   their own beside them, reads them again under it and changes its own
//   raise alone, so raises drawn, answered and not followed at once in one
//   conversation — Claude makes its calls in parallel — keep each other's.
//   A raise of a question, or of a replacement of a decision, the
//   conversation holds an open seal for — the same place, and
//   the same question or the same decision — draws that seal, the call it is
//   given set aside, and says it drew it again: the pick is measured against
//   the first lean — and so does a draw whose seal another, drawn at once,
//   wrote while it waited. A seal of another version is never matched, and
//   stays as written. The layout hook refuses Claude's own writes to it
//   (layout-hook.cjs). A seal waits on the person in the conversation that
//   drew it alone, where it can be shown and answered: a bug's investigation
//   under way, at its topic and its own level, and a quick-fix's fixes under
//   way, at its build and its review, are where a raise of no parked
//   question waits (`raisePlaces`; board-investigation.cjs,
//   board-quick-fix.cjs, waits.cjs).
// - The decision point decides from the call and, beside it (E1): its
//   label; where it is made, and whether it blocks build work — made in the
//   build for a task, which a question asked parks; whose the entry a
//   replacement would replace is — who decided it, read from the entry, or
//   the person where a keep of theirs stands on it since (16.5.7); the mark
//   Claude gives a question that always asks, `--always design-problem` or
//   `--always live-server` (19.4.22, 19.4.20), which a fact, always asked,
//   never takes; whether the conversation sent the raise to check already;
//   the project, by its state root and its name; the model of the session
//   making the call, read once; and the time.
// - The model is the call's (16.4.4): the one it was decided under, sealed
//   with it — in the conversation's seal, or on the park, copied to a task
//   joining it — so every event about the call is logged under it, never
//   under the model of whoever runs the command logging it: a proceed's
//   call, and the person's answer, a keep and "I don't follow", drawn in
//   the conversation though a builder made the call. So is what the
//   decision point decided it from that its label does not hold — whether
//   it blocks build work, whose the decision it would replace is, and
//   Claude's mark — sealed beside it and logged on its raise event, so a
//   replay of the rule over the trust log decides as it did: a task joining
//   a park logs the first park's.
// - The decision point's answer is the response's, with its reason. An ask
//   draws the screen. A proceed lands Claude's call, drawing nothing and
//   sealing nothing: Claude's decision answering the question — the lean
//   row's answer, the other rows what it rules out, and its why — through
//   the lock `ledger decide` lands through, the question checked open under
//   it; on a replacement, Claude's replacement of the decision, through the
//   write `ledger replace` takes, dropping the decision's answer as it
//   stood; either logged as a call carrying the sort, and the label and
//   kind its decision takes. A check draws, seals, parks, lands and logs
//   nothing, and its reason tells Claude to find the answer out (16.3.1):
//   the conversation keeps the raise that was checked — by the question
//   it answers, or the decision it would replace, and the task raising it,
//   none where no task does — as sent to check (`raise-checked.json` in its
//   folder, under a lock of its own), so that task's raise of it again, in
//   any words, is decided as one sent to check already, and asks (16.11.7),
//   and another task's raise of it is not. A blind ask is refused until it
//   is built.
// - A raise is no gate (gate.cjs): drawing it clears the gate shown.
// - In the build (12.13) — and at a quick-fix's places for a question its
//   task's builder asks, `--parks` naming the task; one Claude raises in the
//   quick-fix's conversation, naming none, is drawn as anywhere else,
//   parking nothing (19.5.25, E5) — a raise at a build
//   place, `<unit>.implementation` or `<unit>.review`, names the task it is
//   for, `--parks <phase>.<n>`, where it is made in one — the tracker
//   holding it, not yet ended (task-parks.cjs) — and takes it nowhere else;
//   it takes no `--task`, the flag `ledger` takes there. A call made outside
//   any task — the task writer's, the consolidation agent's, the phase
//   review's — names none (12.5.5, 12.12.12). A proceed lands Claude's call for its task, or
//   for none; a check parks nothing. One that asks, and a fact (16.3.8), which always asks and
//   never meets the decision point, draw nothing and seal nothing in the
//   conversation: each parks its task (12.13.2, 12.13.9), or, with none,
//   waits in the build's queue parking none (12.8.4) — one `parked` line in
//   the ledger holding the question's subject and links, the task or null,
//   its number minted under the writer lock (questions.cjs), and the call
//   sealed with the rows the check judged, the decision point's reason, the
//   label, the model and what it was decided from (12.13.4, 16.1.2) — and
//   answers the one line Claude says (12.13.3). The task stays in progress,
//   held; what depends on it is what the tracker's links hold back. A task
//   parked is raised to the person, so a stop its builder made comes off it
//   (position.cjs). Raised while a
//   question already waits on its subject, it judges no row and asks nothing:
//   where that question parks its task, or it names none — a rerun after a
//   kill among them — it parks nothing and answers that question; else its
//   task joins the question, parked under its number with its first park's
//   call as sealed — its label, its model and what it was decided from
//   among it — copied under the writer lock. Its line, and the one an
//   `already` answers, say the question as it is worded now, and, where it
//   names no task, the tasks the question parks. While a question
//   waits, any raise on its subject outside the build — one asking as one
//   proceeding — is refused, naming its raise: before a row is judged, under
//   the lock as a proceed or an answer lands, and at "I don't follow", for a
//   park that came after it was drawn (questions.cjs).
// - `raise draw <unit> <question>` (12.13.10, 12.13.20): a question waiting,
//   by its number or a park's id, raised in full once the person says they
//   are ready — sealed in the conversation from its first park alone, never
//   from Claude's words, so after a `/clear` it draws as it was sealed; its
//   question as it is worded now, sealed and shown where it was reworded
//   since. A seal of that question the conversation holds open, on the same
//   wording, is drawn again, holding the tasks it parks now; a seal is
//   matched to a question waiting by its park alone. Its screen is headed by
//   its number and the tasks it parks (16.9.5, 12.12.5), and it is answered
//   as any raise is, a fact's as a fact is, with no lean and nothing in the
//   trust log. The tasks it parks are read as its answer lands, under the
//   writer lock, and as "I don't follow" is checked — a task that joined it
//   since the draw among them, one a close took off it since not: its answer
//   carries the first of them, none where it parks none, and frees them;
//   and the answer, or "I don't follow", answers the receipt (questions.cjs).
//   A call's trust log event, its "I don't follow"'s too, says whether it
//   blocked build work as the decision point decided it at the first park,
//   never as the parks stand at the answer (16.4.7). A call's answer
//   other than its lean marks each of them changed after the last round of
//   that task's review reported, so its pair reads it again before its
//   account (round-report.cjs, 12.1.4). A question waiting no
//   longer refuses the draw, and its answer, under the lock, with nothing
//   recorded (20.6.10).
// - `raise show <id> [--technical]` draws a raise again from its seal
//   alone, never from Claude's words; `--technical` shows the mechanism.
// - `raise answer <id> (--pick <key> | --own | --didnt-follow)`: the person's
//   answer, in the conversation that drew the raise, found by its seal — the
//   id or a prefix of it; a raise it never drew, after a `/clear` or a resume
//   under a new session, is raised again. A row picked, or the person's own
//   words, lands as the person's decision at the id the draw minted, where
//   the raise was drawn, answering its question and relying on what it relies
//   on — on a replacement, as their replacement of the decision for the
//   reason and cause sealed, dropping its answer as it stood: a pick's text
//   is the row's, and what it rules out the other rows' of Claude's; their
//   own words bring their text, and what they rule out where Claude gives it,
//   none else, since their words may blend rows. Claude's account of the
//   person's reason, the why, comes on stdin with either. The sealed answer
//   is the lean row's text; whether it is product-wide is the call's; its
//   kind and whether it is hard to undo are the sealed label's.
// - `keep`, picked on a replacement, takes the why on stdin as a pick
//   does: the person's keep of the decision as it stands lands at the id
//   the draw minted, where the raise was drawn — the decision, the reason
//   and the cause sealed, the why, and the lean row's text, Claude's
//   proposal, sealed in it (ledger-events.cjs)
//   — standing over the proposal as the departure rule holds
//   (ledger-verdicts.cjs). Nothing it relies on changes: no replacement
//   lands, so nothing is affected; and where the decision is affected by
//   the replacement the keep names as its cause, keeping it confirms it
//   still holds against it (ledger-affected.cjs).
// - The person's own words on Claude's call are read before anything lands
//   (answer-reader.cjs): the separate call reads their text against
//   Claude's rows for the one it picks, so the entry and the event agree on
//   whether it took the lean (16.19.1). They are read only where the answer
//   would land: first, read as the landing reads under the lock, a raise
//   the ledger holds the answer to is answered already, its words unread,
//   and one no longer answerable — its question closed, its decision
//   replaced, its park gone — is refused as the landing refuses it. A
//   keep, a pick and a fact's words are never read.
// - Who moved whom is the engine's alone (5.3.10): a pick other than the
//   lean, the person's own words read as another row or as none, and a
//   keep stood over it; own words read as the lean's row move no one, and a
//   pick of the lean none, or the person come round to it where Claude says
//   so on stdin. Any other value given refuses the answer. Claude proposed
//   the replacement, so no answer to it is the person's reversal of an
//   agreement of theirs: none logs a reversal.
// - The same command lands the trust log's raise event (16.13.3,
//   ledger-write.cjs): the line it landed — an entry, or a keep — the sort,
//   the lean's key and the answer's — null for the person's own words, free
//   text, typed, with the row the separate call read from them, null for
//   none (16.19.1, 16.19.8) — how it came, whether the person didn't
//   follow, the sealed label and its kind, and what the call was decided
//   from beyond its label, as sealed — whether it blocked build work
//   (16.4.7), whose the decision it would replace was (16.5.7), Claude's
//   mark (19.4.20, 19.4.22) — under the sealed model; never a word of the
//   question, the rows, the why or the person's words. An answer was
//   pressed where the gate mod announced itself and its last press sent
//   that row from this raise's menu after the raise was drawn (gate.cjs);
//   anything else was typed.
// - Once (E3): under the writer lock, a ledger holding the minted id means
//   the raise is answered: a rerun, after a kill past the append or once
//   the answer landed, writes no second line and logs no second event, and
//   says the raise was answered already, with the row the line holds — a
//   keep's `keep`, an entry's the row whose text it holds, else the
//   person's own words — so Claude knows its own answer did not land. A
//   rerun after a kill before the append lands its own answer, the event
//   the killed run kept let go (trust-log.cjs). Else the question must
//   still be open, or the decision a replacement proposes to replace still
//   current, or nothing is recorded, the person's answer staying in the
//   conversation: a decision replaced since is named with what replaced it,
//   to raise again on. The seal is marked answered after the commit, with
//   the answer the ledger holds, and keeps the first it was marked with:
//   the ledger, not the seal, says whether a raise is answered.
// - "I don't follow" logs a raise event in the trust log alone — no entry,
//   no answer, no reading (16.9.3, 16.12.3) — and counts it on the seal;
//   the raise stays open, to be shown again. On a raise the ledger holds
//   the answer to — an old screen's press — it logs and counts nothing,
//   and says the raise was answered already, with the row the line holds.
// - The draw, `raise draw` and `show` take no writer lock: each writes the
//   conversation's folder alone, its seal under the seals' own lock. The
//   answer, a proceed's landing and a park take it around their ledger
//   write, as `ledger` does.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { messageOf, stdinObject } = require('../kernel/call.cjs');
const { LOCK_TIMEOUT_MS, isObject, writeJsonAtomic, withStateLockFile } = require('../kernel/manifest-io.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { findStateRoot } = require('../kernel/state-root.cjs');
const { BUILD_PHASES } = require('../kernel/manifest-schema.cjs');
const { conversationDir } = require('./conversation.cjs');
const { newId, shortId } = require('./ledger-ids.cjs');
const { carrying } = require('./ledger.cjs');
const { ROW_FIELDS, CALL_FIELDS: CALL_SHAPE, entryKind } = require('./ledger-events.cjs');
const { ID_FACTS, readFolded, foldLedger, questionStands, laterOf, answersOf, notCurrent, factsOf, replacementsOf, whoseDecision } = require('./ledger-fold.cjs');
const { liveness, manifestOf } = require('./ledger-units.cjs');
const { topicTitles, quickFixBuild, investigationUnderWay, fixesUnderWay } = require('./derivations.cjs');
const { verbUsage, writePlaced, landRaised, callLogged, staleness } = require('./ledger-write.cjs');
const { OVER_THE_LEAN, BACK_TO_THE_LEAN, derivedMove } = require('./ledger-verdicts.cjs');
const { judgeDecisionAsync } = require('./ledger-one-decision.cjs');
const { labelledBeside, questionText, kindOf } = require('./labeller.cjs');
const { readOnRaise } = require('./answer-reader.cjs');
const { type, TEXT, KEY, LINE, ALWAYS_MARKS, listOf } = require('./event-fields.cjs');
const { isShownTask, parseShownTask } = require('./task-id.cjs');
const { markChanged, beingRead } = require('./round-report.cjs');
const { stepTurn } = require('./task-verbs.cjs');
const { clearStop } = require('./position.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { record, modelOf } = require('./trust-log.cjs');
const { projectName } = require('./state-checks.cjs');
const { RAISE_SHOWN, raiseMenu, clearGateShown, isPressed } = require('./gate.cjs');
const { drawnRows, raiseScreen } = require('./projections/raise.cjs');
const decisionPoint = require('./decision-point.cjs');
const questions = require('./questions.cjs');
const { assertRootCauseAt } = require('./investigation-log.cjs');

/** @typedef {import('./event-fields.cjs').Type} Type */
/** @typedef {import('./decision-point.cjs').Decision} Decision */
/** @typedef {import('./decision-point.cjs').At} At */
/** @typedef {import('./event-fields.cjs').Always} Always */
/** @typedef {import('./ledger-events.cjs').DecidedBy} DecidedBy */
/** @typedef {import('./ledger-fold.cjs').Folded} Folded */
/** @typedef {import('./ledger-write.cjs').Landed} Landed */
/** @typedef {import('./labeller.cjs').Label} Label */
/** @typedef {{key: string, name: string, text: string, notice: string}} Row */
/**
 * Claude's call, as the draw takes it on stdin.
 * @typedef {{question: string, rows: Row[], lean: string, why: string, sort: 'one'|'several', mechanism: string, product_wide: boolean, stepped_back?: string[]}} Call
 */
/**
 * A fact only the person holds, as the draw takes it on stdin: no lean, no
 * why, no sort.
 * @typedef {{question: string, rows: Row[], mechanism: string, product_wide: boolean}} Fact
 */
/** @typedef {import('./ledger-write.cjs').Place} Place */
/** @typedef {import('./ledger-write.cjs').Linked} Linked */
/** @typedef {import('./ledger-write.cjs').Lands} Lands */
/** @typedef {'pressed'|'typed'} Via */
/**
 * The replacement a raise proposes: the decision it replaces, the reason
 * and the cause, by full id; and the row keeping that decision as it
 * stands, its answer as the draw found it.
 * @typedef {{entry: string, reason: string, cause: string|null, keep: Row}} Replacing
 */
/**
 * What a raise is about: the question it answers — null on a replacement —
 * the entries it relies on, and the replacement it proposes, or null.
 * @typedef {{answers: string|null, relies_on: string[], replaces: Replacing|null}} Target
 */
/** The person's answer as the seal keeps it: when, and the row's key, null for their own words. @typedef {{at: string, answer: string|null}} Answered */
/** @typedef {import('./questions.cjs').Parks} Parks */
/**
 * What every raise's seal holds.
 * @typedef {object} Sealed
 * @property {number} v
 * @property {string} id the raise's, and its entry's
 * @property {string} menu the menu it is declared as
 * @property {Place} place
 * @property {string|null} answers the question's id, null on a replacement
 * @property {string[]} relies_on
 * @property {Replacing|null} replaces
 * @property {string[]} rows_judged the rows whose answer and what it rules out the one-decision check judged one rule
 * @property {Label|null} label the labeller's, null where it gave none — a fact's always
 * @property {string|null} model the model the call was decided under, by its id: null where it was unread, and a fact's always
 * @property {boolean} blocks_build whether it blocks build work, as the decision point decided it (`DecidedFrom`)
 * @property {DecidedBy|null} replaced_by whose the decision it would replace is, null on a question
 * @property {Always|null} always Claude's mark that it always asks, null for none
 * @property {string} reason
 * @property {string} at when it was shown
 * @property {Answered|null} answered
 * @property {number} didnt_follow
 * @property {Parks|null} parks the question waiting in the build it was drawn from, or null
 */
/** A raise of Claude's call, as sealed. @typedef {Sealed & {call: Call, fact: false}} CallSeal */
/** A raise of a fact, as sealed. @typedef {Sealed & {call: Fact, fact: true}} FactSeal */
/** A raise as sealed in the conversation's folder. @typedef {CallSeal|FactSeal} Seal */
/**
 * What a draw did: the raise sealed and drawn, or the conversation's open
 * seal of the question, or of the replacement, drawn again; Claude's call
 * landed, the decision point letting it proceed; or Claude sent to check.
 * @typedef {{decision: 'ask', reason: string, seal: Seal, redrawn: boolean, warnings: string[]} | {decision: 'proceed', reason: string, landed: Landed} | Checking} Drawn
 */
/** Claude sent to find the answer out, nothing drawn. @typedef {{decision: 'check', reason: string, warnings: string[]}} Checking */
/**
 * What a raise in the build did that asks: its task parked, or its question
 * waiting parking none — the question's number, the task or null, the
 * park's short id, its commit, and the line Claude says — or found parked
 * already.
 * @typedef {{decision: 'ask', reason: string, parked: string, task: string|null, id: string, committed: string|null, line: string, already?: true, note?: string, warnings?: string[]}} Parked
 */
/**
 * The person's answer as its entry and its event hold it: the entry's
 * text, why, what it rules out and who moved whom; the event's answer — the
 * row's key, null for the person's own words — whether it came as free
 * text, how, and the row the separate call read from free text, null for
 * none.
 * @typedef {{text: string, why: string, rules_out: string[], who_moved_whom: string, answer: string|null, with_text: boolean, via: Via, reading: string|null}} Given
 */
/**
 * How a raise lands, and what is checked under the lock before its links
 * resolve: its write, its links as sealed, what its content holds beyond
 * the answer, and the check.
 * @typedef {{lands: Lands, linked: Linked, content: Record<string, unknown>, checkRead: import('./ledger-write.cjs').ReadCheck}} Landing
 */
/**
 * The person's answer as its raise event holds it: the row's key — `keep`
 * for a keep, null for their own words — how it came, whether it came as
 * free text, and the row the separate call read from free text, null for
 * none.
 * @typedef {{answer: string|null, via: Via, with_text: boolean, reading: string|null}} Logged
 */
/**
 * The person's answer as it lands: its landing, its line's content, the
 * row's key it answers with — null for the person's own words — and what
 * its raise event holds of it, null for a fact's, which logs none.
 * @typedef {Landing & {answer: string|null, logged: Logged|null}} Answering
 */

const SEAL_VERSION = 1;
const SAID = 'raise';
const ANSWER_SAID = 'raise answer';
const DRAW_SAID = 'raise draw';
// What a raise takes no flag for, of the write its answer lands as: the
// task, which a raise in the build names by what it parks.
const NO_TASK = ['task'];
const PARKS = '--parks';
const PARKS_USAGE = `[${PARKS} <phase>.<n>]`;
const ALWAYS = '--always';
const ALWAYS_USAGE = `[${ALWAYS} ${ALWAYS_MARKS.join('|')}]`;
const QUESTION_USAGE = `${verbUsage('decide', SAID, NO_TASK)} ${PARKS_USAGE} ${ALWAYS_USAGE}   (the call as JSON on stdin)`;
const REPLACE_USAGE = `${verbUsage('replace', SAID, NO_TASK)} ${PARKS_USAGE} ${ALWAYS_USAGE}   (the call as JSON on stdin)`;
const FACT = '--fact';
const FACT_USAGE = `${verbUsage('decide', SAID, NO_TASK)} ${FACT}   (the fact's question as JSON on stdin)`;
const SHOW_USAGE = 'raise show <id> [--technical]';
const ANSWER_USAGE = 'raise answer <id> (--pick <key> | --own | --didnt-follow)   (a pick\'s or own words\' answer as JSON on stdin)';
const DRAW_USAGE = 'raise draw <work-unit> <question>   (by its number, Q{n}, or its park\'s id)';
const RAISE_USAGE = [QUESTION_USAGE, REPLACE_USAGE, FACT_USAGE, SHOW_USAGE, ANSWER_USAGE, DRAW_USAGE, questions.ASIDE_USAGE, questions.WAITING_USAGE].join('\n');
// The sub-verbs, each a word where a draw names a place, `<unit>.<phase>`.
const SUB_VERBS = Object.freeze(['show', 'answer', 'draw', 'aside', 'waiting']);
const ONLY_YOU_KNOW = 'Only you know this: it\'s a fact I can\'t check.';
// The key of the row a raise on a replacement draws for keeping the decision.
const KEEP = 'keep';
// The screen's own words, which no row's key may be in any case: the
// mechanism's toggle, "I don't follow", the comment, and keeping a decision
// as it stands — kept on every raise, so a raise event's `keep` always
// means a keep.
const SCREEN_KEYS = ['t', 'e', 'technical', 'explain', 'comment', KEEP];
const SEALS_LOCK = { timeoutMs: LOCK_TIMEOUT_MS, name: 'the lock on the conversation\'s raises' };
// What the conversation sent to check, each by the raise checked (`checkedAs`).
const RAISE_CHECKED = 'raise-checked.json';
const CHECKED_LOCK = { timeoutMs: LOCK_TIMEOUT_MS, name: 'the lock on what the conversation sent to check' };
// The word the screen's "I don't follow" row is sent as (projections/raise.cjs).
const EXPLAIN = 'explain';

const ROWS = type('a list of rows', Array.isArray);
// Who moved whom as stdin gives it: whatever it holds, the engine rules on it (`movedBy`).
const MOVED = type('who moved whom', () => true);

/** What the call holds, each field's type: its rows checked one by one (`checkEachRow`). @type {Readonly<Record<string, Type>>} */
const CALL_FIELDS = Object.freeze({ ...CALL_SHAPE, rows: ROWS });

/** What the call may hold besides: what Claude's step back found. @type {Readonly<Record<string, Type>>} */
const CALL_MAY = Object.freeze({ stepped_back: type('a list of lines, one at least', (v) => Array.isArray(v) && v.length > 0 && v.every((line) => LINE.test(line))) });

/** What a fact holds, each field's type. @type {Readonly<Record<string, Type>>} */
const FACT_FIELDS = Object.freeze({ question: CALL_SHAPE.question, rows: ROWS, mechanism: CALL_SHAPE.mechanism, product_wide: CALL_SHAPE.product_wide });

/**
 * What the answer on stdin holds, by how the person answered — `fact` a
 * pick on a fact, which moves no one: the fields it needs, and those it may
 * give.
 * @type {Readonly<Record<'pick'|'own'|'keep'|'fact', {needs: Readonly<Record<string, Type>>, may: Readonly<Record<string, Type>>}>>}
 */
const ANSWER_FIELDS = Object.freeze({
  pick: { needs: { why: TEXT }, may: { who_moved_whom: MOVED } },
  own: { needs: { text: TEXT, why: TEXT }, may: { rules_out: listOf(TEXT) } },
  keep: { needs: { why: TEXT }, may: {} },
  fact: { needs: { why: TEXT }, may: {} },
});

/**
 * Refuse a value holding a field neither `fields` nor `optional` names,
 * lacking one of `fields`, or holding one of another type, `where` saying
 * where.
 * @param {Record<string, unknown>} value @param {Readonly<Record<string, Type>>} fields @param {string} where
 * @param {Readonly<Record<string, Type>>} [optional]
 */
function checkFields(value, fields, where, optional = {}) {
  const all = { ...fields, ...optional };
  const names = Object.keys(all);
  const stray = Object.keys(value).find((name) => !Object.hasOwn(all, name));
  if (stray !== undefined) throw new Error(`${where} has no field ${stray} — it holds ${names.join(', ')}`);
  for (const name of names) {
    if (!Object.hasOwn(value, name)) {
      if (Object.hasOwn(fields, name)) throw new Error(`${where} needs ${name}`);
    } else if (!all[name].test(value[name])) {
      throw new Error(`${where}'s ${name} is not ${all[name].is}`);
    }
  }
}

/**
 * Refuse a row of another shape, and a key two rows share or the screen
 * keeps.
 * @param {Row[]} rows
 */
function checkEachRow(rows) {
  rows.forEach((row, i) => {
    if (!isObject(row)) throw new Error(`raise: the call's rows[${i}] is not a row — {${Object.keys(ROW_FIELDS).join(', ')}}`);
    checkFields(row, ROW_FIELDS, `raise: the call's rows[${i}]`);
    if (SCREEN_KEYS.includes(row.key.toLowerCase())) throw new Error(`raise: the call's rows[${i}] takes the key ${row.key}, which the screen keeps for itself — ${SCREEN_KEYS.join(', ')} are its own, in any case`);
    if (rows.findIndex((other) => other.key === row.key) !== i) throw new Error(`raise: the call's rows share the key ${row.key} — each row's key is its own`);
  });
}

/**
 * Refuse rows that offer no choice — fewer than two, or on a replacement no
 * proposal, keeping the decision being the screen's own row — a row
 * `checkEachRow` refuses, and a lean naming no row of Claude's.
 * @param {Call} call @param {boolean} replacing
 */
function checkRows({ rows, lean }, replacing) {
  if (replacing && rows.length === 0) throw new Error('raise: the call proposes no answer — a raise on a replacement proposes one at least, beside keeping the entry as it stands');
  if (rows.length < 2 && !replacing) throw new Error(`raise: the call has ${rows.length} row${rows.length === 1 ? '' : 's'} — a raise offers the person a choice of two at least`);
  checkEachRow(rows);
  if (replacing && lean === KEEP) throw new Error(`raise: the call leans to ${KEEP}, the entry as it stands — a raise on a replacement leans to one of its proposals`);
  if (!rows.some((row) => row.key === lean)) throw new Error(`raise: the call leans to ${lean}, and no row has that key — its rows: ${rows.map((row) => row.key).join(', ')}`);
}

/**
 * The call on stdin, checked whole — as a raise on a replacement's where
 * `replacing`.
 * @param {string} stdin @param {boolean} replacing
 * @returns {Call}
 */
function callOf(stdin, replacing) {
  const call = stdinObject(stdin, SAID, 'the call');
  checkFields(call, CALL_FIELDS, 'raise: the call', CALL_MAY);
  checkRows(/** @type {Call} */ (call), replacing);
  return /** @type {Call} */ (call);
}

/**
 * The fact on stdin, checked whole: its rows, where it gives any, each
 * checked as a call's row is.
 * @param {string} stdin
 * @returns {Fact}
 */
function factOf(stdin) {
  const fact = stdinObject(stdin, SAID, 'the call');
  checkFields(fact, FACT_FIELDS, 'raise: the call');
  checkEachRow(/** @type {Row[]} */ (fact.rows));
  return /** @type {Fact} */ (fact);
}

/**
 * The draw's argv without `--fact`, and whether it was given. Refuses it
 * given twice, and given with `--replaces`.
 * @param {string[]} args
 * @returns {{fact: boolean, rest: string[]}}
 */
function factFlag(args) {
  const rest = args.filter((arg) => arg !== FACT);
  const given = args.length - rest.length;
  if (given > 1) throw new Error(`raise takes ${FACT} once — Usage: engine ${FACT_USAGE}`);
  if (given === 1 && rest.includes('--replaces')) throw new Error(`raise ${FACT} takes no --replaces: a fact that changes is the person's to say, and the decision it changes is replaced as any other — Usage: engine ${FACT_USAGE}`);
  return { fact: given === 1, rest };
}

/**
 * The draw's argv without `--parks` and its task, and the task, or null
 * where it is not given. Refuses it given twice or with no task, a task not
 * as screens show one, and `--task` — a raise names its task by what it
 * parks.
 * @param {string[]} args
 * @returns {{parks: string|null, rest: string[]}}
 */
function parksFlag(args) {
  if (args.includes('--task')) throw new Error(`raise takes no --task — a raise in the build names its task with ${PARKS} <phase>.<n>, which a call that proceeds lands for — Usage: engine ${QUESTION_USAGE}`);
  const at = args.indexOf(PARKS);
  if (at === -1) return { parks: null, rest: args };
  if (args.indexOf(PARKS, at + 1) !== -1) throw new Error(`raise takes ${PARKS} once — Usage: engine ${QUESTION_USAGE}`);
  const task = args[at + 1];
  if (!isShownTask(task)) throw new Error(`raise: ${PARKS} takes the task it parks, as screens show it, <phase>.<n> — not ${task === undefined ? 'nothing' : `"${task}"`}`);
  return { parks: task, rest: [...args.slice(0, at), ...args.slice(at + 2)] };
}

/**
 * The draw's argv without `--always` and its mark, and the mark, or null
 * where it is not given. Refuses it given twice, with no mark or one of
 * none, and on a fact, which always asks.
 * @param {string[]} args @param {boolean} fact
 * @returns {{always: Always|null, rest: string[]}}
 */
function alwaysFlag(args, fact) {
  const at = args.indexOf(ALWAYS);
  if (at === -1) return { always: null, rest: args };
  if (fact) throw new Error(`raise ${FACT} takes no ${ALWAYS}: a fact always asks — Usage: engine ${FACT_USAGE}`);
  if (args.indexOf(ALWAYS, at + 1) !== -1) throw new Error(`raise takes ${ALWAYS} once — Usage: engine ${QUESTION_USAGE}`);
  const mark = /** @type {Always} */ (args[at + 1]);
  if (!ALWAYS_MARKS.includes(mark)) throw new Error(`raise: ${ALWAYS} takes ${ALWAYS_MARKS.join(' or ')} — not ${mark === undefined ? 'nothing' : `"${mark}"`}`);
  return { always: mark, rest: [...args.slice(0, at), ...args.slice(at + 2)] };
}

/**
 * Why a raise at the place parks nothing, drawn in the conversation as
 * anywhere else, or null where it is made in the build, which parks: a
 * place outside the build.
 * @param {Place} place @returns {string|null}
 */
function unparkedAt({ phase }) {
  return BUILD_PHASES.includes(phase) ? null : `${phase} is none of its phases — ${BUILD_PHASES.join(' or ')}`;
}

/**
 * Whether a raise parks, as one made in the build does (`unparkedAt`):
 * at a quick-fix's places, only one naming the task it parks, its builder's
 * question — one Claude raises in the quick-fix's conversation is drawn
 * there, parking nothing (19.5.25). Refused where it names a task it parks
 * outside the build, and where the task it parks is one the tracker lacks
 * or that has ended.
 * @param {string} cwd @param {Place} place @param {string|null} parks
 * @returns {boolean}
 */
function checkBuildPlace(cwd, place, parks) {
  const unparked = unparkedAt(place);
  if (unparked !== null && parks !== null) throw new Error(`raise ${PARKS} parks a task in the build, and ${unparked}`);
  if (parks !== null) require('./task-parks.cjs').checkParkable(cwd, place.unit, parks, SAID);
  if (unparked !== null) return false;
  const manifest = /** @type {Record<string, any>} */ (manifestOf(/** @type {string} */ (findStateRoot(cwd)), place.unit));
  return parks !== null || !quickFixBuild(manifest);
}

/**
 * Refuse a proposal whose answer is the decision's as it stands, which
 * `short` names: keeping it is the screen's own row.
 * @param {Call} call @param {Replacing} replacing @param {string} short
 */
function checkProposals({ rows }, { keep }, short) {
  const same = rows.find((row) => row.text === keep.text);
  if (same !== undefined) throw new Error(`raise: the call's row ${same.key} proposes ${short}'s answer as it stands — a replacement changes it, and keeping it is the screen's own row`);
}

/** The row keeping a decision as it stands, its answer `text`. @param {string} text @returns {Row} */
function keepRow(text) {
  return { key: KEEP, name: 'Keep it as it stands', text, notice: 'nothing changes' };
}

/** The row the call leans to. @param {Call} call @returns {Row} */
function leanRow({ rows, lean }) {
  return /** @type {Row} */ (rows.find((row) => row.key === lean));
}

/** The answers of the call's rows but `row`: what that row rules out. @param {Call|Fact} call @param {Row} row */
function othersOf(call, row) {
  return call.rows.filter((other) => other !== row).map((other) => other.text);
}

/**
 * What the one-decision check judges of a row: its answer, and the other
 * rows as what it rules out; the why comes with the person's answer.
 * @param {Call} call @param {Row} row
 */
function entryOf(call, row) {
  return { text: row.text, why: null, rules_out: othersOf(call, row) };
}

/**
 * Every row judged by the one-decision check, the calls put at once, each
 * run logged as `run` says. Answers the keys of the rows it judged to hold
 * one rule; refuses where any row holds several, naming each such row and
 * its rules.
 * @param {Call} call @param {import('./ledger-one-decision.cjs').Run} run
 * @returns {Promise<string[]>}
 */
async function checkedRows(call, run) {
  const judged = await Promise.all(call.rows.map((row) => judgeDecisionAsync(entryOf(call, row), run)));
  const several = call.rows.flatMap((row, i) => {
    const one = judged[i];
    return 'rules' in one && one.rules.length > 1 ? [{ row: row.key, rules: one.rules }] : [];
  });
  if (several.length > 0) {
    const listed = several.map(({ row, rules }) => `  row ${row}:\n${rules.map((rule, n) => `    ${n + 1}. ${rule}`).join('\n')}`).join('\n');
    const err = new Error(`raise: ${several.length === 1 ? `row ${several[0].row} holds` : `rows ${several.map((s) => s.row).join(', ')} each hold`} several rules, and the entry a row lands as holds one — nothing drawn. Make each row one answer to the question, and raise what else it decides as a question of its own:\n${listed}`);
    throw carrying(Object.assign(err, { payload: { several } }), run.warnings);
  }
  return call.rows.filter((_, i) => 'rules' in judged[i]).map((row) => row.key);
}

/** What the labeller reads of a call: its question, and its rows, each its answer and what the person would notice. @param {Call} call */
function labelledText({ question, rows }) {
  return questionText(question, rows.map((row) => `${row.text} — ${row.notice}`));
}

/**
 * Every row judged by the one-decision check (`checkedRows`), and the call
 * labelled beside them: the keys of the rows judged one rule, and the
 * label, null where the labeller gave none.
 * @param {Call} call @param {import('./ledger-one-decision.cjs').Run} run
 * @returns {Promise<{judged: string[], label: Label|null}>}
 */
async function judgedAndLabelled(call, run) {
  const { done: judged, label } = await labelledBeside(checkedRows(call, run), labelledText(call));
  return { judged, label };
}

/** The conversation's seals file. @param {string} session */
function sealFile(session) {
  return path.join(conversationDir(session), RAISE_SHOWN);
}

/**
 * What a file of the conversation's raises keeps by id, as written; none
 * where there is no file. Refuses one that does not read, or holds nothing
 * by id, `what` saying what it holds.
 * @param {string} file @param {string} what
 * @returns {Record<string, unknown>}
 */
function readById(file, what) {
  if (!fs.existsSync(file)) return {};
  let held;
  try {
    held = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`raise: ${what}, ${file}, cannot be read — ${messageOf(err)}`);
  }
  if (!isObject(held)) throw new Error(`raise: ${what}, ${file}, hold no raise by its id`);
  return held;
}

/**
 * `change` run holding the lock `lock` names beside the conversation's
 * `file`, its folder made where it is not: its answer.
 * @template T
 * @param {string} file @param {{timeoutMs: number, name: string}} lock @param {() => T} change
 * @returns {T}
 */
function lockedIn(file, lock, change) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return withStateLockFile(`${file}.lock`, change, lock);
}

/**
 * Every raise sealed in the conversation, by id, each as written — a seal
 * another release wrote among them.
 * @param {string} session
 * @returns {Record<string, unknown>}
 */
function readSeals(session) {
  return readById(sealFile(session), 'the conversation\'s raises');
}

/** @param {unknown} value @returns {value is Seal} */
function isSeal(value) {
  return isObject(value) && value.v === SEAL_VERSION;
}

/**
 * The question's chain in `folded`: the question, every wording of it, and
 * each decision that answered it or replaced one that did.
 * @param {Folded} folded @param {string} question @returns {{root: string, decisions: Set<string>}}
 */
function questionChain(folded, question) {
  const root = factsOf(folded, question).root;
  const answered = factsOf(folded, root).answered_by;
  return { root, decisions: new Set([...answered, ...answered.flatMap((id) => replacementsOf(folded, id))]) };
}

/**
 * Whether a raise is down the question's chain: one answering the question,
 * any wording of it, or one replacing a decision of its chain.
 * @param {Folded} folded @param {string} question @returns {(seal: Seal) => boolean}
 */
function downChain(folded, question) {
  const { root, decisions } = questionChain(folded, question);
  return (seal) => (seal.answers !== null && folded.facts.get(seal.answers)?.root === root)
    || (seal.replaces !== null && decisions.has(seal.replaces.entry));
}

/**
 * What the step back found, as the calling conversation's latest raise down
 * the question's chain sealed it; null where the conversation sealed none
 * holding it, or no conversation is handed.
 * @param {Folded} folded @param {string} question @returns {string[]|null}
 */
function steppedBackSealed(folded, question) {
  const session = handedSession();
  if (session === null) return null;
  const down = downChain(folded, question);
  const sealed = Object.values(readSeals(session))
    .filter((seal) => isSeal(seal) && !seal.fact && seal.call.stepped_back !== undefined && down(seal))
    .sort((a, b) => /** @type {Seal} */ (a).at.localeCompare(/** @type {Seal} */ (b).at));
  const latest = /** @type {CallSeal|undefined} */ (sealed.at(-1));
  return latest?.call.stepped_back ?? null;
}

/**
 * Every raise the conversation sealed at `place`, oldest first, read
 * without the seals' lock, as the board reads them: a seal of another
 * version passed over.
 * @param {string} session @param {Place} place @returns {Seal[]}
 */
function sealsAt(session, { unit, phase, topic }) {
  return /** @type {Seal[]} */ (Object.values(readSeals(session)).filter((seal) => isSeal(seal) && seal.place.unit === unit && seal.place.phase === phase && seal.place.topic === topic))
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** A bug's investigation's places: its topic, and its own level. @param {string} unit @returns {Place[]} */
const investigationPlaces = (unit) => [unit, null].map((topic) => ({ unit, phase: 'investigation', topic }));

/** A quick-fix's fixes' places: its build, and its review. @param {string} unit @returns {Place[]} */
const fixPlaces = (unit) => BUILD_PHASES.map((phase) => ({ unit, phase, topic: null }));

/** The places a raise of no parked question waits at in the unit now (the header's). @param {Record<string, any>} manifest @returns {Place[]} */
function raisePlaces(manifest) {
  if (investigationUnderWay(manifest)) return investigationPlaces(manifest.name);
  return fixesUnderWay(manifest) ? fixPlaces(manifest.name) : [];
}

/**
 * Whether a raise the conversation sealed still waits on the person:
 * unanswered, its question open, or the decision it would replace current.
 * @param {import('./ledger-fold.cjs').Folded} folded @param {Seal} seal
 */
function sealWaits(folded, seal) {
  if (seal.answered !== null) return false;
  return seal.answers !== null ? questionStands(folded, seal.answers) === 'open' : notCurrent(folded, /** @type {NonNullable<Seal['replaces']>} */ (seal.replaces).entry) === null;
}

/**
 * The open seal of the question, or of the replacement of the decision,
 * `target` names: drawn for the question waiting in the build whose first
 * park is `park`, or, where it is null, raised at `place` for no question
 * waiting; or null.
 * @param {Record<string, unknown>} seals @param {Place} place @param {Target} target @param {string|null} park
 * @returns {Seal|null}
 */
function openSeal(seals, place, { answers, replaces }, park) {
  const open = Object.values(seals).find((seal) => isSeal(seal) && seal.answered === null && seal.answers === answers
    && (seal.replaces?.entry ?? null) === (replaces?.entry ?? null) && (seal.parks?.park ?? null) === park
    && seal.place.unit === place.unit && seal.place.phase === place.phase && seal.place.topic === place.topic);
  return /** @type {Seal|undefined} */ (open) ?? null;
}

/**
 * Change the conversation's raises holding a lock of their own, read again
 * as they stand under it, so raises drawn, answered or not followed at once
 * in one conversation keep each other's: `change` is given them, and `put`,
 * which writes one seal beside the rest. Answers what `change` answers.
 * @template T
 * @param {string} session @param {(seals: Record<string, unknown>, put: (seal: Seal) => void) => T} change
 * @returns {T}
 */
function changeSeals(session, change) {
  const file = sealFile(session);
  return lockedIn(file, SEALS_LOCK, () => {
    const seals = readSeals(session);
    return change(seals, (seal) => writeJsonAtomic(file, { ...seals, [seal.id]: seal }));
  });
}

/**
 * `seal` kept beside the conversation's raises, drawn; or, where an open
 * seal of its question or replacement was sealed while the draw waited, that
 * one, drawn again — a question waiting in the build holding the tasks it
 * parks as `seal` read them now. Refuses the raise where it cannot be
 * sealed.
 * @param {string} session @param {Place} place @param {Target} target @param {Seal} seal
 * @returns {{seal: Seal, redrawn: boolean}}
 */
function sealDrawn(session, place, target, seal) {
  try {
    return changeSeals(session, (seals, put) => {
      const open = openSeal(seals, place, target, seal.parks?.park ?? null);
      if (open === null) {
        put(seal);
        return { seal, redrawn: false };
      }
      if (seal.parks === null) return { seal: open, redrawn: true };
      const now = { ...open, parks: seal.parks };
      put(now);
      return { seal: now, redrawn: true };
    });
  } catch (err) {
    throw new Error(`raise: the raise could not be sealed in the conversation's folder — nothing drawn: ${messageOf(err)}`);
  }
}

/**
 * Where the question `answers` is no longer open — answered, merged into
 * another's answer, or moved to the roadmap as later — the question and
 * what closed it, said; null while it is open.
 * @param {string} answers @param {Folded} read
 * @returns {string|null}
 */
function notOpen(answers, read) {
  const stands = questionStands(read, answers);
  if (stands === 'open') return null;
  const short = (/** @type {string} */ id) => shortId(id, read.facts.keys());
  if (stands === 'later') return `${short(answers)}, which is moved to the roadmap as later, ${laterOf(read, answers)}`;
  const by = answersOf(read, answers).map(short).join(', ');
  return `${short(answers)}, which is ${stands === 'merged' ? `merged into the answer ${by}` : `answered by ${by}`}`;
}

/**
 * Refuse a raise of a question that is no longer open, naming what answers
 * it.
 * @param {string} answers @param {Folded} read
 */
function checkOpen(answers, read) {
  const stands = notOpen(answers, read);
  if (stands !== null) throw new Error(`raise --answers names ${stands} — a raise asks an open question`);
}

/**
 * Refuse, under the writer lock, the answer to a raise whose question is no
 * longer open, naming what answers it: nothing is recorded.
 * @param {string} answers @param {Folded} read
 */
function checkStillOpen(answers, read) {
  const stands = notOpen(answers, read);
  if (stands !== null) throw new Error(`${ANSWER_SAID}: the raise answers ${stands} now — nothing recorded: a raise answers an open question, and the person's answer stays in the conversation`);
}

/**
 * Refuse, under the writer lock, the answer to a raise on a replacement
 * whose decision is no longer current, naming the decision, what became of
 * it and what is current now, and the way on: raising it again. Nothing is
 * recorded.
 * @param {string} entry @param {Folded} read
 */
function checkStillCurrent(entry, read) {
  const why = notCurrent(read, entry);
  if (why === null) return;
  const short = (/** @type {string} */ id) => shortId(id, read.facts.keys());
  throw new Error(`${ANSWER_SAID}: the raise proposes replacing ${short(entry)}, ${staleness(read, entry, why, short)} — nothing recorded: raise it again on what is current, where it still calls for a change, and the person's answer stays in the conversation`);
}

/** The calling conversation's session id; refuses a command handed none. @param {string} said */
function sessionOf(said) {
  const session = handedSession();
  if (session === null) throw new Error(`${said}: no conversation to raise it in — Claude Code hands every command it runs a session id, and this one has none`);
  return session;
}

/**
 * What a raise's landing checks under the lock, in the words of the command
 * landing it: the question it answers still open; the decision it replaces
 * still current.
 * @typedef {{open: (answers: string, read: Folded) => void, current: (entry: string, read: Folded) => void}} Stands
 */

/** A proceed's, at the draw: a decision replaced since is `ledger replace`'s own refusal, in the draw's words. @type {Stands} */
const AT_THE_DRAW = Object.freeze({ open: checkOpen, current: () => {} });

/** The person's answer's. @type {Stands} */
const AT_THE_ANSWER = Object.freeze({ open: checkStillOpen, current: checkStillCurrent });

/**
 * How what a raise is about lands, the person's answer or Claude's call it
 * lets proceed, made for `task` in the build, else null: answering its
 * question, checked still open under the lock; or replacing the decision
 * for the reason and cause sealed, dropping its answer as it stood, checked
 * still current — each by `stands`.
 * @param {Target} target @param {Stands} stands @param {string|null} task
 * @returns {Landing}
 */
function landsAs({ answers, relies_on: reliesOn, replaces }, stands, task) {
  if (replaces === null) {
    const question = /** @type {string} */ (answers);
    return { lands: 'decide', linked: { answers, relies_on: reliesOn, task }, content: {}, checkRead: (read) => stands.open(question, read) };
  }
  const { entry, reason, cause, keep } = replaces;
  return { lands: 'replace', linked: { replaces: entry, reason, cause, relies_on: reliesOn, task }, content: { drops: [keep.text] }, checkRead: (read) => stands.current(entry, read) };
}

/**
 * Claude's call landed where the decision point lets it proceed: Claude's
 * decision answering the question, or its replacement of the decision —
 * the lean row's answer, the other rows what it rules out, and Claude's
 * why, its kind the label's — made for its task in the build, else for
 * none, logged as a call carrying its sort and label, under the model it
 * was decided under.
 * @param {string} cwd @param {Raising} raising @param {Call} call @param {Label|null} label @param {string[]} warnings
 * @returns {Landed}
 */
function proceeded(cwd, { place, target, task, model }, call, label, warnings) {
  const lean = leanRow(call);
  const { lands, linked, content, checkRead } = landsAs(target, AT_THE_DRAW, task);
  const { landed } = landRaised(cwd, {
    said: SAID,
    place,
    lands,
    linked,
    content: { by: 'claude', who_moved_whom: 'none', ...content, text: lean.text, why: call.why, rules_out: othersOf(call, lean), product_wide: call.product_wide },
    label,
    id: null,
    logs: callLogged(call.sort, model),
    checkRead: (read) => {
      checkRead(read);
      questions.checkUnparked(read, subjectOf(target), SAID);
    },
  }, warnings);
  return landed;
}

/** What a raise is about, as a question waiting in the build can be: the question it answers, or the decision it would replace. @param {Target} target */
function subjectOf({ answers, replaces }) {
  return { answers, replaces: replaces?.entry ?? null };
}

/**
 * A raise of Claude's call as drawn, beyond the call: the conversation, where
 * it is made and what it is about, whose the entry it would replace is,
 * the mark it always asks by, the task it is made for in the build, null
 * where none, and the model of the session making the call, read once: the
 * model the call is decided under, sealed with it.
 * @typedef {{session: string, place: Place, target: Target, replacedBy: DecidedBy|null, always: Always|null, task: string|null, model: string|null}} Raising
 */
/**
 * What a raise asked seals beside its call: the rows the one-decision check
 * judged one rule, the label, the model the call was decided under — none
 * of each for a fact — and the decision point's reason.
 * @typedef {{rows_judged: string[], label: Label|null, model: string|null, reason: string}} Asking
 */
/**
 * What the decision point decides a call from that its label does not hold
 * (E1), sealed with the call — in the conversation, or on its park — and
 * logged on its raise event, so a replay of the rule over the trust log
 * decides as it did: whether it blocks build work, made in the build for a
 * task (16.4.7); whose the decision it would replace is (16.5.7); and
 * Claude's mark that it always asks (19.4.20, 19.4.22).
 * @typedef {{blocks_build: boolean, replaced_by: DecidedBy|null, always: Always|null}} DecidedFrom
 */

/** What `raising`'s call is decided from beyond its label (`DecidedFrom`). @param {Raising} raising @returns {DecidedFrom} */
function decidedFrom({ task, replacedBy, always }) {
  return { blocks_build: questions.blocksBuild(task === null ? [] : [task]), replaced_by: replacedBy, always };
}

/** The file of what the conversation sent to check. @param {string} session */
function checkedFile(session) {
  return path.join(conversationDir(session), RAISE_CHECKED);
}

/**
 * What the conversation sent to check: when, by the raise that was checked
 * (`checkedAs`).
 * @param {string} session @returns {Record<string, unknown>}
 */
function readChecked(session) {
  return readById(checkedFile(session), 'the conversation\'s raises sent to check');
}

/**
 * A raise marked as sent to check in the conversation, by the raise that was
 * checked, under the lock on what it sent, read again under it.
 * @param {string} session @param {string} checked
 */
function markChecked(session, checked) {
  const file = checkedFile(session);
  lockedIn(file, CHECKED_LOCK, () => writeJsonAtomic(file, { ...readChecked(session), [checked]: new Date().toISOString() }));
}

/**
 * The raise that was checked, as the conversation keeps it sent to check:
 * by the question it answers, or the decision it would replace, by its id,
 * and the task raising it, `<id> for <task>` — `for no task` where none
 * does — so only a raise whose own check came back is decided as one sent
 * to check already (16.11.7), whatever its words.
 * @param {Target} target @param {string|null} task
 */
function checkedAs({ answers, replaces }, task) {
  return `${answers ?? replaces?.entry} for ${task ?? 'no task'}`;
}

/**
 * Claude's call, labelled `label`, put through the decision point with what
 * it decides from (E1), blocking build work where it is made in the build
 * for a task: its answer. Where it sends Claude to check, the conversation
 * keeps the raise as sent to check.
 * @param {string} cwd @param {Raising} raising @param {Call} call @param {Label|null} label
 * @returns {{decision: Decision, reason: string}}
 */
function decided(cwd, raising, call, label) {
  const { session, place, target, task, model } = raising;
  const checked = checkedAs(target, task);
  /** @type {At} */
  const at = {
    label, place, ...decidedFrom(raising),
    checked: Object.hasOwn(readChecked(session), checked),
    project: { root: /** @type {string} */ (findStateRoot(cwd)), name: projectName(cwd) }, model, now: Date.now(),
  };
  const answer = decisionPoint.decide(call, at);
  if (answer.decision === 'check') markChecked(session, checked);
  return answer;
}

/**
 * Where a raise is drawn and what it is about, its argv read and checked as
 * the write its answer lands as checks it before the lock — `ledger
 * replace`'s where it names `--replaces`, else `ledger decide`'s — in the
 * raise's words: a question it answers still open; a decision it replaces
 * a decision, its answer as it stands kept for the screen's own row, and
 * whose it is — who decided it, or the person where they kept it since. Its
 * usage is a fact's where `fact`.
 * @param {string} cwd @param {string[]} args @param {string[]} warnings @param {boolean} fact
 * @returns {{place: Place, target: Target, replacedBy: DecidedBy|null, short: (id: string) => string, read: import('./ledger-fold.cjs').Folded}}
 */
function placedRaise(cwd, args, warnings, fact) {
  const verb = args.includes('--replaces') ? 'replace' : 'decide';
  const usage = `Usage: engine ${fact ? FACT_USAGE : { decide: QUESTION_USAGE, replace: REPLACE_USAGE }[verb]}`;
  const { at, linked, read, replacing } = writePlaced(cwd, verb, args, SAID, usage, warnings, NO_TASK);
  const place = { unit: at.unit, phase: at.phase, topic: at.topic };
  const short = (/** @type {string} */ id) => shortId(id, read.facts.keys());
  const reliesOn = /** @type {string[]} */ (linked.relies_on);
  if (replacing === null) {
    const answers = /** @type {string} */ (linked.answers);
    checkOpen(answers, read);
    return { place, target: { answers, relies_on: reliesOn, replaces: null }, replacedBy: null, short, read };
  }
  const entry = /** @type {string} */ (linked.replaces);
  const kind = entryKind(replacing);
  if (kind !== 'decision') throw new Error(`raise --replaces names ${short(entry)}, a ${kind} — a raise replaces a decision, the person picking its answer`);
  const replaces = { entry, reason: /** @type {string} */ (linked.reason), cause: /** @type {string|null} */ (linked.cause), keep: keepRow(/** @type {string} */ (replacing.text)) };
  return { place, target: { answers: null, relies_on: reliesOn, replaces }, replacedBy: whoseDecision(read, entry), short, read };
}

/**
 * A raise asked: sealed, with what it was decided from, and drawn — or the
 * conversation's open seal of its question or replacement, sealed while the
 * draw waited, drawn again.
 * @param {Raising} raising
 * @param {{call: Call, fact: false} | {call: Fact, fact: true}} what what is asked, and whether it is a fact
 * @param {Asking} asking @param {string[]} warnings
 * @returns {Drawn}
 */
function askedRaise(raising, what, asking, warnings) {
  const { session, place, target } = raising;
  const id = newId();
  /** @type {Seal} */
  const seal = {
    v: SEAL_VERSION, id, menu: raiseMenu(id), place, ...target,
    ...what, ...asking, ...decidedFrom(raising), at: new Date().toISOString(), answered: null, didnt_follow: 0, parks: null,
  };
  const drawn = sealDrawn(session, place, target, seal);
  clearGateShown(session);
  return { decision: 'ask', reason: asking.reason, ...drawn, warnings };
}

/**
 * The park of a question in the build: its links — what it is about, what
 * its answer relies on, and the task, or none — checked as the answer it
 * waits for is; and, set under the lock, its number and its call as sealed:
 * where a question waits on what it is about, which its task joins, that
 * question's, else the next number and `sealed`.
 * @param {Place} place @param {Target} target @param {import('./questions.cjs').Sealed} sealed @param {string|null} task
 * @returns {import('./ledger-write.cjs').Raised}
 */
function parking(place, target, sealed, task) {
  const { answers, relies_on: reliesOn, replaces } = target;
  const { checkRead } = landsAs(target, AT_THE_DRAW, task);
  return {
    said: SAID,
    place,
    lands: 'park',
    linked: { question: answers, replaces: replaces?.entry ?? null, reason: replaces?.reason ?? null, cause: replaces?.cause ?? null, relies_on: reliesOn, task },
    content: sealed,
    id: null,
    logs: null,
    checkRead,
    mints: (read, entryAt) => questions.parkedUnder(read, entryAt, place.unit, subjectOf(target), sealed),
  };
}

/**
 * The line Claude says as a task parks on the question `name`, which asks
 * `asks` — naming each path a quick-fix's park set aside, `aside` — or, for
 * a raise naming no task, as the question waits parking the tasks it does,
 * `tasks` — the build or the review carrying on, as its place `phase` is
 * the one or the other (12.13.3).
 * @param {string|null} task @param {string} name @param {string} asks @param {string[]} tasks @param {string} phase @param {string[]} aside
 */
function parkedLine(task, name, asks, tasks, phase, aside) {
  if (task === null) return `${name} waits for you, parking ${questions.parkedTasks(tasks)}: ${asks} The ${phase === 'review' ? 'review' : 'build'} carries on.`;
  const kept = aside.length === 0 ? '' : ` What the checkout held not committed is set aside until it starts again: ${aside.join(', ')}.`;
  return `Task ${task} parks on ${name}, waiting for you: ${asks}${kept} The other tasks carry on.`;
}

/** A fact as its park seals it: as a call, with no lean, why or sort. @param {Fact} fact */
function parkedFact({ question, rows, mechanism, product_wide: productWide }) {
  return { question, rows, lean: null, why: null, sort: null, mechanism, product_wide: productWide };
}

/**
 * A task parked: the park landed, and what it answers — the question's
 * number, the task, the park's id and commit, and the line Claude says,
 * the question as it is worded now.
 * @param {string} cwd @param {import('./ledger-write.cjs').Raised} park @param {string} reason @param {string[]} warnings
 * @returns {Parked}
 */
function parkLanded(cwd, park, reason, warnings) {
  const task = /** @type {string|null} */ (park.linked.task);
  const aside = task === null ? [] : setAsideFor(cwd, park.place.unit, task);
  const { landed, line } = landRaised(cwd, park, warnings);
  if (task !== null) clearStop(sessionOf(SAID), park.place.unit, task);
  const { name, asks, tasks } = questions.parkedQuestion(cwd, park.place.unit, /** @type {string} */ (/** @type {Record<string, unknown>} */ (line).id), warnings);
  const { id, committed, ...rest } = landed;
  return { decision: 'ask', reason, parked: name, task, id, committed, line: parkedLine(task, name, asks, tasks, park.place.phase, aside), ...rest, ...(aside.length === 0 ? {} : { set_aside: aside }) };
}

/**
 * What a quick-fix's fix had not committed, set aside as a question parks
 * it while it holds the checkout, so the next fix starts on a clean one
 * (fix-aside.cjs): each path, from the project — none where the task holds
 * no checkout, a parked or freed fix waiting behind another, or any task
 * of a unit that is no quick-fix.
 * @param {string} cwd @param {string} unit @param {string} task @returns {string[]}
 */
function setAsideFor(cwd, unit, task) {
  const turn = turnNow(cwd, unit);
  if (turn === null || !turn.checkout || turn.inFlight !== task) return [];
  return require('./fix-aside.cjs').setAside(cwd, parseShownTask(unit, task), SAID);
}

/**
 * A raise in the build, for its task, or for none. Where a question already
 * waits on what it is about, no row is judged and nothing asked: a question
 * parking the task already, or any with no task named, is answered as it
 * stands, parking nothing; else the task joins it, parked under its number
 * with its first park's call as sealed. Else a fact parks with it as asked;
 * a call's rows are judged and the call put through the decision point —
 * landed as Claude's for the task where it proceeds, Claude sent to check
 * where it checks, else parked with it.
 * @param {string} cwd @param {Raising} raising
 * @param {{call: Call, fact: false} | {call: Fact, fact: true}} given what is raised, and whether it is a fact
 * @param {string[]} warnings
 * @returns {Promise<Parked|Drawn>}
 */
async function parkedRaise(cwd, raising, given, warnings) {
  const { place, target, task } = raising;
  const waiting = questions.waitingOn(cwd, place.unit, subjectOf(target), warnings);
  if (waiting !== null) {
    const { name, id, tasks, asks } = waiting;
    const sealed = questions.sealedOf(waiting.line);
    if (task === null || tasks.includes(task)) return { decision: 'ask', reason: sealed.why_asking, parked: name, task, id, committed: null, line: parkedLine(task, name, asks, tasks, place.phase, []), already: true, ...(warnings.length > 0 ? { warnings } : {}) };
    return parkLanded(cwd, parking(place, target, sealed, task), sealed.why_asking, warnings);
  }
  if (given.fact) return parkLanded(cwd, parking(place, target, { call: parkedFact(given.call), rows_judged: [], why_asking: ONLY_YOU_KNOW, label: null, model: null, ...decidedFrom(raising) }, task), ONLY_YOU_KNOW, warnings);
  const { call } = given;
  const { judged, label } = await judgedAndLabelled(call, { cwd, unit: place.unit, verb: 'raise', warnings });
  const { decision, reason } = decided(cwd, raising, call, label);
  if (decision === 'check') return { decision, reason, warnings };
  if (decision === 'proceed') return { decision, reason, landed: proceeded(cwd, raising, call, label, warnings) };
  if (decision === 'blind') throw new Error('raise: the decision point answered blind, and asking blind is 29.19\'s, not built yet — nothing parked');
  return parkLanded(cwd, parking(place, target, { call, rows_judged: judged, why_asking: reason, label, model: raising.model, ...decidedFrom(raising) }, task), reason, warnings);
}

/**
 * `raise <place> (--answers <question> | --replaces <entry> --reason
 * <reason> [--cause <id>]) [--relies-on <id> …] [--parks <phase>.<n>]
 * [--always <mark>]`: the call on stdin put through the decision point and,
 * where it asks, sealed in the conversation and drawn — or the
 * conversation's open seal of the question or the replacement drawn again,
 * said redrawn; in the build, parked with its task; where it proceeds,
 * landed as Claude's; where it checks, nothing drawn. With `--fact`, the
 * fact on stdin is asked, the decision point never reached.
 * @param {string} cwd @param {string[]} args @param {() => string} stdin
 * @returns {Promise<Drawn|Parked>}
 */
async function drawRaise(cwd, args, stdin) {
  const session = sessionOf(SAID);
  if (findStateRoot(cwd) === null) throw new Error('raise: there is no workflows state here — the question a raise answers is in the ledger, which the state holds');
  /** @type {string[]} */
  const warnings = [];
  const { fact, rest: unfact } = factFlag(args);
  const { parks, rest: unparked } = parksFlag(unfact);
  const { always, rest } = alwaysFlag(unparked, fact);
  const { place, target, replacedBy, short, read } = placedRaise(cwd, rest, warnings, fact);
  const raising = { session, place, target, replacedBy, always, task: parks, model: modelOf(cwd) };
  const inBuild = checkBuildPlace(cwd, place, parks);
  if (!inBuild) questions.checkUnparked(read, subjectOf(target), SAID);
  const given = fact ? factOf(stdin()) : callOf(stdin(), target.replaces !== null);
  if (inBuild && 'stepped_back' in given) throw new Error('raise: a raise in the build takes no stepped_back — its call parks in the ledger, which keeps the call\'s own fields alone');
  if (place.phase === 'investigation' && 'stepped_back' in given) assertRootCauseAt(cwd, place.unit, SAID, warnings);
  if (target.replaces !== null) checkProposals(/** @type {Call} */ (given), target.replaces, short(target.replaces.entry));
  if (inBuild) return parkedRaise(cwd, raising, fact ? { call: /** @type {Fact} */ (given), fact: true } : { call: /** @type {Call} */ (given), fact: false }, warnings);
  const open = openSeal(readSeals(session), place, target, null);
  if (open !== null) {
    clearGateShown(session);
    return { decision: 'ask', reason: open.reason, seal: open, redrawn: true, warnings };
  }
  if (fact) return askedRaise(raising, { call: /** @type {Fact} */ (given), fact: true }, { rows_judged: [], label: null, model: null, reason: ONLY_YOU_KNOW }, warnings);
  const call = /** @type {Call} */ (given);
  const { judged, label } = await judgedAndLabelled(call, { cwd, unit: place.unit, verb: 'raise', warnings });
  const { decision, reason } = decided(cwd, raising, call, label);
  if (decision === 'check') return { decision, reason, warnings };
  if (decision === 'proceed') return { decision, reason, landed: proceeded(cwd, raising, call, label, warnings) };
  if (decision === 'blind') throw new Error('raise: the decision point answered blind, and asking blind is 29.19\'s, not built yet — nothing drawn');
  return askedRaise(raising, { call, fact: false }, { rows_judged: judged, label, model: raising.model, reason }, warnings);
}

/**
 * `raise draw <unit> <question>`: a question waiting in the build, by its
 * number or a park's id, sealed in the conversation from its first park
 * alone — its question as it is worded now, which it shows where it was
 * reworded since — and drawn; or the conversation's open seal of that
 * question, on that wording, drawn again, said redrawn. Refuses a question
 * waiting no longer.
 * @param {string} cwd @param {string[]} args
 * @returns {{seal: Seal, redrawn: boolean, warnings: string[]}}
 */
function drawParked(cwd, args) {
  if (args.length !== 2) throw new Error(`Usage: engine ${DRAW_USAGE}`);
  const session = sessionOf(DRAW_SAID);
  /** @type {string[]} */
  const warnings = [];
  const { question, line, asks, answers, keeps } = questions.foundPark(cwd, args[0], args[1], DRAW_SAID, DRAW_USAGE, warnings);
  const place = { unit: line.unit, phase: line.phase, topic: null };
  /** @type {Target} */
  const target = {
    answers,
    relies_on: line.relies_on,
    replaces: line.replaces === null ? null : { entry: line.replaces, reason: line.reason, cause: line.cause, keep: keepRow(/** @type {string} */ (keeps)) },
  };
  const id = newId();
  const { lean, why, sort, ...fact } = line.call;
  /** @type {Seal} */
  const seal = {
    v: SEAL_VERSION, id, menu: raiseMenu(id), place, ...target,
    ...(lean === null ? { call: { ...fact, question: asks }, fact: true } : { call: { ...line.call, question: asks }, fact: false }),
    rows_judged: line.rows_judged, label: line.label, model: line.model, blocks_build: line.blocks_build, replaced_by: line.replaced_by, always: line.always,
    reason: line.why_asking, at: new Date().toISOString(), answered: null, didnt_follow: 0,
    parks: { park: question.park, number: question.number, tasks: question.tasks },
  };
  const drawn = sealDrawn(session, place, target, seal);
  clearGateShown(session);
  return { ...drawn, warnings };
}

/**
 * The raise a prefix of its id names among the conversation's, refused in
 * the words of `said`, the command asking.
 * @param {Record<string, unknown>} seals @param {string} prefix @param {string} said
 * @returns {Seal}
 */
function sealNamed(seals, prefix, said) {
  const named = Object.keys(seals).filter((id) => id.startsWith(prefix));
  if (named.length === 0) throw new Error(`${said}: this conversation has drawn no raise ${prefix} — a raise is answered in the conversation that drew it, so after a /clear, or a resume under a new session, raise the question again`);
  if (named.length > 1) throw new Error(`${said}: "${prefix}" begins the ids of ${named.length} raises this conversation drew — give more of the id`);
  const seal = seals[named[0]];
  if (!isSeal(seal)) throw new Error(`${said}: ${named[0]} was sealed by a release this engine does not read`);
  return seal;
}

/**
 * `raise show <id> [--technical]`: a raise the conversation drew, from its
 * seal alone, the mechanism shown with `--technical`.
 * @param {string[]} args
 * @returns {{seal: Seal, technical: boolean}}
 */
function showRaise(args) {
  const [prefix, ...flags] = args;
  if (prefix === undefined || prefix === '' || prefix.startsWith('--') || flags.some((flag) => flag !== '--technical') || flags.length > 1) {
    throw new Error(`Usage: engine ${SHOW_USAGE}`);
  }
  const session = sessionOf('raise show');
  const seal = sealNamed(readSeals(session), prefix, 'raise show');
  clearGateShown(session);
  return { seal, technical: flags.length === 1 };
}

/**
 * `raise answer`'s argv read: the raise's id or a prefix of it, how the
 * person answered, and the row a pick names.
 * @param {string[]} args
 * @returns {{prefix: string, form: 'pick'|'own'|'didnt-follow', key: string|null}}
 */
function answerArgs(args) {
  const [prefix, flag, ...rest] = args;
  if (prefix !== undefined && prefix !== '' && !prefix.startsWith('--')) {
    if (flag === '--pick' && rest.length === 1 && rest[0] !== '' && !rest[0].startsWith('--')) return { prefix, form: 'pick', key: rest[0] };
    if (flag === '--own' && rest.length === 0) return { prefix, form: 'own', key: null };
    if (flag === '--didnt-follow' && rest.length === 0) return { prefix, form: 'didnt-follow', key: null };
  }
  throw new Error(`Usage: engine ${ANSWER_USAGE}`);
}

/**
 * How the person's answer `sent` came: pressed, where the mod's last press
 * sent it from this raise's menu after the raise was drawn; else typed.
 * @param {string} session @param {Seal} seal @param {string} sent
 * @returns {Via}
 */
function cameBy(session, seal, sent) {
  return isPressed(session, (declared) => declared === seal.menu, sent, seal.at) ? 'pressed' : 'typed';
}

/**
 * Who moved whom on the person's pick of `key` (5.3.10), the engine's
 * alone: the person stood over the lean where the row is not it; else none,
 * or the person came round to it where Claude says so. Refuses any other
 * value `given`.
 * @param {string} lean @param {string} key @param {unknown} given undefined where stdin gives none
 * @returns {string}
 */
function movedBy(lean, key, given) {
  if (key !== lean) {
    if (given !== undefined) throw new Error(`${ANSWER_SAID}: who_moved_whom is the engine's — row ${key} is not the lean, ${lean}, so the person's answer stood over it: ${OVER_THE_LEAN}`);
    return OVER_THE_LEAN;
  }
  if (given === undefined) return 'none';
  if (given !== BACK_TO_THE_LEAN) throw new Error(`${ANSWER_SAID}: on a pick of the lean who_moved_whom is none, which the engine gives, or ${BACK_TO_THE_LEAN} where the person came round to it — not ${JSON.stringify(given)}`);
  return BACK_TO_THE_LEAN;
}

/**
 * The answer on stdin, checked for how the person answered.
 * @param {'pick'|'own'|'keep'|'fact'} form @param {string} stdin
 * @returns {Record<string, any>}
 */
function answerOn(form, stdin) {
  const given = stdinObject(stdin, ANSWER_SAID, 'the answer');
  checkFields(given, ANSWER_FIELDS[form].needs, `${ANSWER_SAID}: the answer`, ANSWER_FIELDS[form].may);
  return given;
}

/**
 * The row `key` among the raise's own. Refuses a key that is no row.
 * @param {Seal} seal @param {string} key
 * @returns {Row}
 */
function rowOf(seal, key) {
  const row = seal.call.rows.find((r) => r.key === key);
  if (row === undefined) throw new Error(`${ANSWER_SAID}: the raise has no row ${key} — its rows: ${drawnRows(seal).map((r) => r.key).join(', ') || 'none'}`);
  return row;
}

/**
 * The person's pick of the row `key`, one of Claude's: its answer, the
 * other rows of Claude's what it rules out, the why on stdin, who moved
 * whom as the engine rules, and how it came.
 * @param {string} session @param {CallSeal} seal @param {string} key @param {string} stdin
 * @returns {Given}
 */
function picked(session, seal, key, stdin) {
  const { call } = seal;
  const row = rowOf(seal, key);
  const { why, who_moved_whom: moved } = answerOn('pick', stdin);
  return {
    text: row.text, why, rules_out: othersOf(call, row), who_moved_whom: movedBy(call.lean, key, moved),
    answer: key, with_text: false, via: cameBy(session, seal, key), reading: null,
  };
}

/**
 * The person's pick of the row `key` on a fact: its answer, the other rows
 * what it rules out, and the why on stdin.
 * @param {FactSeal} seal @param {string} key @param {string} stdin
 */
function factPicked(seal, key, stdin) {
  const row = rowOf(seal, key);
  const { why } = answerOn('fact', stdin);
  return { text: row.text, why, rules_out: othersOf(seal.call, row) };
}

/**
 * The person's own words: their text and why, and what they rule out where
 * Claude gives it.
 * @param {string} stdin
 * @returns {{text: string, why: string, rules_out: string[]}}
 */
function ownWords(stdin) {
  const { text, why, rules_out: rulesOut = [] } = answerOn('own', stdin);
  return { text, why, rules_out: rulesOut };
}

/**
 * Whether the person's answer to `seal` is still to land, read as the
 * landing reads under the lock: false where the ledger holds its answer
 * already, or no state is found, either of which the landing says itself.
 * Refuses, as the landing would, an answer it would refuse. The landing
 * reads the ledger again, and its warnings are the ones said.
 * @param {string} cwd @param {Seal} seal
 */
function stillToLand(cwd, seal) {
  const root = findStateRoot(cwd);
  if (root === null) return false;
  return questions.readQuestions(root, [], (read) => {
    if (read.facts.has(seal.id)) return false;
    questions.checkAnswerable(read, seal.parks, subjectOf(seal), ANSWER_SAID);
    landsAs(seal, AT_THE_ANSWER, null).checkRead(read);
    return true;
  });
}

/**
 * The person's own words on Claude's call — free text, typed — read by the
 * separate call against Claude's rows before anything lands, where
 * `toLand` says it will: read as the lean's row, an agreement, moving no
 * one; read as another, or as none, standing over the lean.
 * @param {CallSeal} seal @param {string} stdin @param {() => boolean} toLand
 * @returns {Given}
 */
function ownWordsOn({ call }, stdin, toLand) {
  const words = ownWords(stdin);
  const reading = toLand() ? readOnRaise(call.question, call.rows, words.text) : null;
  return { ...words, who_moved_whom: reading === call.lean ? 'none' : OVER_THE_LEAN, answer: null, with_text: true, via: 'typed', reading };
}

/**
 * The raise's event in the trust log, about the call it sealed, so logged
 * under the model the call was decided under (16.4.4): its entry, or null
 * where the person didn't follow; the kind of its sealed label, and the
 * label; its sort; the lean's key and the answer's; how it came, and the
 * row read from free text; and what the call was decided from beyond its
 * label, as sealed (`DecidedFrom`).
 * @param {CallSeal} seal @param {Logged & {entry: unknown, didnt_follow: boolean}} answer
 * @returns {{type: string, fields: Record<string, unknown>, model: string|null}}
 */
function raiseEvent({ call, label, model, blocks_build: blocks, replaced_by: replacedBy, always }, { entry, answer, via, with_text: withText, reading, didnt_follow: didntFollow }) {
  return {
    type: 'raise',
    fields: {
      entry, kind: kindOf(label), label, sort: call.sort, sealed: call.lean, answer,
      via, with_text: withText, reading, didnt_follow: didntFollow, blocks_build: blocks, replaced_by: replacedBy, always,
    },
    model,
  };
}

/**
 * The row the line `held` landed by: a keep's `keep`; an entry's, the row
 * of `call` whose answer it holds, by its text — its key, or null for the
 * person's own words.
 * @param {Call|Fact} call @param {Record<string, unknown>} held
 * @returns {string|null}
 */
function heldAnswer({ rows }, held) {
  if (held.event === 'kept') return KEEP;
  return rows.find((row) => row.text === held.text)?.key ?? null;
}

/**
 * The raise `id` marked answered with `answer`, where it is not already:
 * the first answer marked stands.
 * @param {string} session @param {string} id @param {string|null} answer
 */
function markAnswered(session, id, answer) {
  changeSeals(session, (seals, put) => {
    const seal = seals[id];
    if (isSeal(seal) && seal.answered === null) put({ ...seal, answered: { at: new Date().toISOString(), answer } });
  });
}

/**
 * The line the ledger holds at a raise's id — its answer, landed — or null
 * where it holds none.
 * @param {string} cwd @param {string} id @param {string[]} warnings
 * @returns {Record<string, unknown>|null}
 */
function heldLine(cwd, id, warnings) {
  const root = findStateRoot(cwd);
  if (root === null) return null;
  return readFolded(root, ID_FACTS, warnings, (facts, entryAt) => {
    const facted = facts.get(id);
    return facted === undefined ? null : entryAt(facted.place);
  });
}

/**
 * A raise the ledger holds the answer to, answered again: the seal marked
 * with the row the line holds, where it is not; that row, said.
 * @param {string} session @param {Seal} seal @param {Record<string, unknown>} held
 */
function answeredAlready(session, seal, held) {
  const answer = heldAnswer(seal.call, held);
  markAnswered(session, seal.id, answer);
  return { already: /** @type {const} */ (true), answer };
}

/**
 * The person's answer as it lands: their decision answering the raise's
 * question, or their replacement of its decision — `moved` who moved whom,
 * `sealed` Claude's lean, whether it is product-wide the call's — its task
 * set as it lands (`recordAnswer`).
 * @param {Seal} seal @param {{text: string, why: string, rules_out: string[]}} answer @param {string} moved @param {string|null} sealed
 * @returns {Landing}
 */
function answerLanding(seal, { text, why, rules_out: rulesOut }, moved, sealed) {
  const { lands, linked, content, checkRead } = landsAs(seal, AT_THE_ANSWER, null);
  return {
    lands, linked, checkRead,
    content: { by: 'person', who_moved_whom: moved, ...content, text, why, rules_out: rulesOut, product_wide: seal.call.product_wide, sealed },
  };
}

/**
 * The person's row or own words, on Claude's call, as they land — the lean
 * row's text sealed — and its raise event.
 * @param {CallSeal} seal @param {Given} given
 * @returns {Answering}
 */
function answeredWith(seal, given) {
  const { answer, via, with_text: withText, reading } = given;
  return { ...answerLanding(seal, given, given.who_moved_whom, leanRow(seal.call).text), answer, logged: { answer, via, with_text: withText, reading } };
}

/**
 * The person's answer to a fact, their own words or a row picked, as it
 * lands: their decision, sealing no lean and moving no one, logging nothing
 * in the trust log.
 * @param {FactSeal} seal @param {'pick'|'own'} form @param {string|null} key @param {string} stdin
 * @returns {Answering}
 */
function factAnswered(seal, form, key, stdin) {
  const own = form === 'own';
  const given = own ? ownWords(stdin) : factPicked(seal, /** @type {string} */ (key), stdin);
  return { ...answerLanding(seal, given, 'none', null), answer: own ? null : key, logged: null };
}

/**
 * The person keeping the decision a raise on a replacement proposed to
 * replace, as it stands: a keep of it, for the reason and cause sealed,
 * the why on stdin, Claude's proposal — the lean row's text — sealed in it,
 * who moved whom the departure rule's; and how it came.
 * @param {string} session @param {CallSeal} seal @param {Replacing} replacing @param {string} stdin
 * @returns {Answering}
 */
function keeping(session, seal, { entry, reason, cause }, stdin) {
  const { why } = answerOn('keep', stdin);
  return {
    lands: 'keep',
    linked: { entry, reason, cause },
    content: { by: 'person', who_moved_whom: derivedMove({ event: 'kept', by: 'person' }, null, reason, null), why, sealed: leanRow(seal.call).text },
    checkRead: (read) => checkStillCurrent(entry, read),
    answer: KEEP, logged: { answer: KEEP, via: cameBy(session, seal, KEEP), with_text: false, reading: null },
  };
}

/**
 * In step or in a quick-fix, the task in flight and those waiting behind
 * it, read as any read of the tracker is (task-verbs.cjs, `stepTurn`); null
 * in auto.
 * @param {string} cwd @param {string} unit
 */
function turnNow(cwd, unit) {
  const root = /** @type {string} */ (findStateRoot(cwd));
  return withStateLock(root, () => stepTurn(cwd, unit, /** @type {Record<string, any>} */ (manifestOf(root, unit))));
}

/**
 * The person's answer landed at the raise's id, its raise event with it —
 * none for a fact — then the seal marked answered. Before anything lands,
 * under the lock, it is checked answerable (questions.cjs): where its
 * question waited in the build, still waiting, the unit's parks waiting
 * noted, and the tasks it parks then — a task that joined it since the
 * draw among them, one a close took off it since not — read for its line,
 * which a decision or a replacement lands for the first of them, and for
 * the tasks an answer against the lean marks changed; its event logs what
 * the call was decided from, as sealed. The response adds the receipt of
 * what the answer freed. Where the ledger held the line already, the seal
 * is marked with the answer it holds, and the response says the raise was
 * answered already, and with which row.
 * @param {string} cwd @param {string} session @param {Seal} seal @param {Answering} answering
 * @returns {Landed & {raise: string, already?: true, answer?: string|null, receipt?: string}}
 */
function recordAnswer(cwd, session, seal, { lands, linked, content, checkRead, answer, logged }) {
  /** @type {string[]} */
  const warnings = [];
  const { parks } = seal;
  /** @type {string[]} */
  let waitedBefore = [];
  /** @type {string[]} */
  let parked = [];
  const { landed, held } = landRaised(cwd, {
    said: ANSWER_SAID,
    place: seal.place,
    lands,
    linked,
    content,
    label: seal.label,
    id: seal.id,
    logs: logged === null ? null : ({ id }) => raiseEvent(/** @type {CallSeal} */ (seal), { ...logged, entry: id, didnt_follow: false }),
    checkRead: (read) => {
      waitedBefore = questions.checkAnswerable(read, parks, subjectOf(seal), ANSWER_SAID);
      parked = questions.parkedOn(read, parks);
      checkRead(read);
    },
    mints: () => (Object.hasOwn(linked, 'task') ? { task: parked[0] ?? null } : {}),
  }, warnings);
  if (held !== null) return { raise: seal.id, ...landed, ...answeredAlready(session, seal, held) };
  markAnswered(session, seal.id, answer);
  if (parks === null) return { raise: seal.id, ...landed };
  if (!seal.fact && answer !== seal.call.lean) for (const task of parked) markChanged(cwd, parseShownTask(seal.place.unit, task));
  const receipt = questions.answeredReceipt(cwd, seal.place.unit, parks, waitedBefore, warnings, () => turnNow(cwd, seal.place.unit), (task) => beingRead(cwd, parseShownTask(seal.place.unit, task), session));
  return { raise: seal.id, ...landed, receipt, ...(warnings.length > 0 ? { warnings } : {}) };
}

/**
 * "I don't follow": a raise event in the trust log alone — none for a
 * fact — logging what the call was decided from, as sealed, and the count
 * on the seal; the raise stays open, and where its question waited in the
 * build, the receipt says so. On a raise the ledger holds the answer to — an old screen's press —
 * nothing is logged or counted, and the raise is said answered already,
 * with the row the line holds. It is refused as an answer is where it is
 * not answerable (questions.cjs).
 * @param {string} cwd @param {string} session @param {Seal} seal
 * @returns {{raise: string, open: true, receipt?: string, warnings?: string[]} | {raise: string, already: true, answer: string|null, warnings?: string[]}}
 */
function didntFollow(cwd, session, seal) {
  /** @type {string[]} */
  const warnings = [];
  const said = (/** @type {object} */ answer) => ({ raise: seal.id, ...answer, ...(warnings.length > 0 ? { warnings } : {}) });
  const held = heldLine(cwd, seal.id, warnings);
  if (held !== null) return said(answeredAlready(session, seal, held));
  questions.answerable(cwd, seal.parks, subjectOf(seal), ANSWER_SAID, warnings);
  if (!seal.fact) {
    const { type, fields, model } = raiseEvent(seal, { entry: null, answer: null, via: cameBy(session, seal, EXPLAIN), with_text: false, reading: null, didnt_follow: true });
    record(type, fields, { cwd, warnings, model });
  }
  changeSeals(session, (seals, put) => {
    const sealed = seals[seal.id];
    if (isSeal(sealed)) put({ ...sealed, didnt_follow: sealed.didnt_follow + 1 });
  });
  if (seal.parks === null) return said({ open: true });
  return said({ open: true, receipt: questions.explainedReceipt(cwd, seal.place.unit, seal.parks, warnings) });
}

/**
 * How the person's answer lands: an answer to a fact; their own words; on a
 * replacement, a keep of the decision; else their pick of a row.
 * @param {string} cwd @param {string} session @param {Seal} seal @param {'pick'|'own'} form @param {string|null} key @param {() => string} stdin
 * @returns {Answering}
 */
function answering(cwd, session, seal, form, key, stdin) {
  if (seal.fact) return factAnswered(seal, form, key, stdin());
  if (form === 'own') return answeredWith(seal, ownWordsOn(seal, stdin(), () => stillToLand(cwd, seal)));
  if (key === KEEP && seal.replaces !== null) return keeping(session, seal, seal.replaces, stdin());
  return answeredWith(seal, picked(session, seal, /** @type {string} */ (key), stdin()));
}

/**
 * `raise answer <id> (--pick <key> | --own | --didnt-follow)`: the
 * person's answer to a raise this conversation drew — a row, `keep` on a
 * replacement, their own words, or that they didn't follow.
 * @param {string} cwd @param {string[]} args @param {() => string} stdin
 */
function answerRaise(cwd, args, stdin) {
  const { prefix, form, key } = answerArgs(args);
  const session = sessionOf(ANSWER_SAID);
  const seal = sealNamed(readSeals(session), prefix, ANSWER_SAID);
  if (form === 'didnt-follow') return didntFollow(cwd, session, seal);
  return recordAnswer(cwd, session, seal, answering(cwd, session, seal, form, key, stdin));
}

/** Whether `raise` with `args` answers later: the draw, which waits on the one-decision check. @param {string[]} args */
function raiseWaits([verb]) {
  return !SUB_VERBS.includes(verb);
}

/**
 * Of the points a migration directive raises at its end, each still to
 * raise: its question in the ledger and open, and no raise of it sealed in
 * the calling conversation — drawn, answered or left open. Each answers
 * with its question's short id.
 * @template {{place: string, answers: string, text: string}} P
 * @param {string} cwd @param {P[]} points
 * @returns {P[]}
 */
function unraised(cwd, points) {
  const root = findStateRoot(cwd);
  if (root === null || points.length === 0) return [];
  const read = { facts: foldLedger(root, ID_FACTS, []), live: liveness(root) };
  const session = handedSession();
  const sealed = new Set(Object.values(session === null ? {} : readSeals(session)).filter(isSeal).map((seal) => seal.answers));
  return points.filter(({ answers }) => read.facts.has(answers) && questionStands(read, answers) === 'open' && !sealed.has(answers))
    .map((point) => ({ ...point, answers: shortId(point.answers, read.facts.keys()) }));
}

/**
 * The raise's screen, the topic of its place by the name it goes by
 * (8.8.17).
 * @param {string} cwd @param {Seal} seal @param {{technical?: boolean}} [opts]
 * @returns {string}
 */
function raiseScreenOf(cwd, seal, { technical = false } = {}) {
  const root = findStateRoot(cwd);
  const manifest = root === null ? null : manifestOf(root, seal.place.unit);
  return raiseScreen(seal, { technical, titles: topicTitles(manifest ?? {}) });
}

module.exports = { RAISE_USAGE, drawRaise, drawParked, showRaise, answerRaise, raiseWaits, unraised, raiseScreenOf, steppedBackSealed, downChain, sealsAt, sealWaits, investigationPlaces, fixPlaces, raisePlaces };
