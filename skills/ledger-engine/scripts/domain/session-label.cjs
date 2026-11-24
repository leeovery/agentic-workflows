'use strict';

// ---------------------------------------------------------------------------
// Domain ring: session labels — an opt-in label on the user's terminal
// session, showing where the Ledger session is working, put there by the
// multiplexer the session runs in: Portal where `$ZMX_SESSION` is set and
// `portal current` answers (session-label-portal.cjs), else tmux where
// `$TMUX` is set (session-label-tmux.cjs). Each labeller reads its session,
// applies a label, and puts the original back; its own module says how.
// Every place labels itself on arrival: a phase's entry — `enter`, or a
// process skill's Step 0 where the phase is not entered through it —
// applies `{own} · {work-unit} · {phase} · {topic}`, `{own}` the label's
// own part as its labeller keeps it, the topic left out where it is the
// work unit, the product's conversation's entry `{own} · product`, the
// epic's menu, as its render draws it (menus.cjs), `{own} · {work-unit}`,
// the roadmap `{own} · roadmap`, and the start skill puts the original back
// through boot's `repair`. Leaving a place is never an event: the label
// changes on arrival, and at session end, where `session cleanup` restores
// it. A resumed session gets its label back: `session resume`, a
// SessionStart hook fired on `claude --resume`, re-applies the
// conversation's position (position.cjs — recorded by the same arrivals,
// labels on or off, and outliving the session) where the project has its
// work unit. The arrivals and the resume also keep the conversations a
// place names to catch up on (catch-up.cjs), labels on or off: an arrival
// marks the conversation's row at the place it left, and a resume records
// it again at its position's place. The label itself never gates a flow:
// for the user who has not opted in, or inside no multiplexer, or on any
// error of one, labelling degrades to a no-op JSON response. (A place the
// project lacks fails loudly whatever the opt-in — that is an authoring
// bug, not an environment condition.)
//
// Opt-in is the project manifest's `defaults.session_labels` boolean —
// absent means never asked, which is what ledger's one-time prompt keys on
// (boot reports it via `labelConfigStatus`).
//
// The hooks live in the project's committed `.claude/settings.json`, where
// the engine installs them (a SessionEnd hook declared in skill frontmatter
// never fires). SessionEnd carries three commands: `session cleanup`,
// present while labels are on, and `presence cleanup` and `conversation
// end`, present in every Ledger project regardless — the heartbeat sweep
// and the conversation's transcript record are Ledger's own, not a
// label preference. SessionStart (matcher `resume`) carries `session
// resume` in every Ledger project regardless, the resumed conversation's
// catch-up record being Ledger's own, its label part a no-op while labels
// are off. PreToolUse carries three groups in every Ledger project, each
// matched to the tools its hook stands before:
// `layout guard` before Write, Edit and NotebookEdit (domain/layout-hook),
// `brief guard` before Agent and SendMessage (domain/brief-guard), and
// `shell guard` before Bash (domain/shell-guard). Recording the choice syncs
// the hooks (`recordLabelChoice`) and every boot re-syncs them
// (`syncSessionHooks`), a hook of ours whose command is not the one the
// sync writes rewritten to it where it stands.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { handedSession } = require('../kernel/process.cjs');
const { readProjectManifest, withProjectLock, writeProjectManifestAtomic } = require('../kernel/manifest.cjs');
const { isObject, jsonText } = require('../kernel/manifest-io.cjs');
const { operationInProgress } = require('../kernel/git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { commitStateTail, commitOwnChange, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { SETTINGS_SPEC, parseSettings, readProjectSettings, writeProjectSettings } = require('./settings.cjs');
const { readPosition, assertPlace, isPlace, recordPosition, dropPosition, placeLine } = require('./position.cjs');
const { placeAt, samePlace } = require('./place-entry.cjs');
const { movedOn, resumedAt } = require('./catch-up.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { loadManifest } = require('./reads.cjs');
const { topicTitles, itemName } = require('./derivations.cjs');
const { LAYOUT_HOOK_TOOLS } = require('./layout-hook.cjs');
const { BRIEF_HOOK_TOOLS } = require('./brief-guard.cjs');
const { SHELL_HOOK_TOOLS } = require('./shell-guard.cjs');
const portalLabeller = require('./session-label-portal.cjs');
const tmuxLabeller = require('./session-label-tmux.cjs');

const HOOK_ENGINE = 'node "$CLAUDE_PROJECT_DIR/.claude/skills/ledger-engine/scripts/engine.cjs"';
const SESSION_CLEANUP_COMMAND = `${HOOK_ENGINE} session cleanup`;
const SESSION_RESUME_COMMAND = `${HOOK_ENGINE} session resume`;
const PRESENCE_CLEANUP_COMMAND = `${HOOK_ENGINE} presence cleanup`;
const CONVERSATION_END_COMMAND = `${HOOK_ENGINE} conversation end`;
const LAYOUT_GUARD_COMMAND = `${HOOK_ENGINE} layout guard`;
const BRIEF_GUARD_COMMAND = `${HOOK_ENGINE} brief guard`;
const SHELL_GUARD_COMMAND = `${HOOK_ENGINE} shell guard`;
// What makes a hook ours: the exact `engine.cjs" <verb>` form. The path
// before it and any arguments after are free, so a hook under another
// install prefix is recognised, never twinned, and rewritten to the command
// the sync writes; the closing quote is part of the mark, so a re-quoted
// command is not.
const hookMark = (/** @type {string} */ command) => command.slice(command.indexOf('engine.cjs"'));
const HOOK_MARKS = wantedGroups({ session: true, ledger: true }).flatMap((g) => g.commands.map(hookMark));

/**
 * The opt-in for this project — `defaults.session_labels` when it is a
 * boolean; null when never asked, or when the project manifest is absent,
 * unreadable, or carries no defaults.
 * @param {string} cwd @returns {boolean|null}
 */
function resolveEnabled(cwd) {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath(cwd, 'manifest.json'), 'utf8'));
    const v = isObject(parsed) && isObject(parsed.defaults) ? parsed.defaults.session_labels : undefined;
    if (typeof v === 'boolean') return v;
  } catch { /* no project manifest */ }
  return null;
}

/**
 * Record the opt-in as the project manifest's `defaults.session_labels`,
 * every other key preserved — under the project lock, the manifest's own
 * atomic write. A manifest that does not parse refuses loudly through the
 * kernel read: silently replacing it would drop every registered work unit.
 * @param {string} cwd @param {boolean} value
 * @returns {{session_labels: boolean}}
 */
function setLabelConfig(cwd, value) {
  withProjectLock(cwd, () => {
    const manifest = readProjectManifest(cwd);
    const defaults = isObject(manifest.defaults) ? manifest.defaults : {};
    manifest.defaults = { ...defaults, session_labels: value };
    writeProjectManifestAtomic(cwd, manifest);
  });
  return { session_labels: value };
}

/** The mark a hook of ours carries, or null for a foreign one. @param {unknown} hook */
function ourMark(hook) {
  if (!isObject(hook) || hook.type !== 'command' || typeof hook.command !== 'string') return null;
  return HOOK_MARKS.find((m) => hook.command.includes(m)) || null;
}

/** The marks of ours a hook group carries. @param {unknown} group */
function marksOf(group) {
  return isObject(group) && Array.isArray(group.hooks) ? group.hooks.map(ourMark).filter(Boolean) : [];
}

/**
 * Whether a settings document carries a hook of ours, under any event.
 * @param {Record<string, any>} settings @returns {boolean}
 */
function carriesOurHooks(settings) {
  const hooks = isObject(settings.hooks) ? settings.hooks : {};
  return Object.values(hooks).some((groups) => Array.isArray(groups) && groups.some((group) => marksOf(group).length > 0));
}

/** @typedef {{event: string, matcher?: string, commands: string[]}} WantedGroup */

/**
 * The groups wanted, each under its event: the label hook while labels are
 * on (`session`) — SessionEnd restores the name — and Ledger's own
 * (`ledger`), where SessionEnd sweeps the heartbeats and records the
 * conversation's transcript, SessionStart records a resumed conversation
 * again where it was and brings its label back, its matcher having Claude
 * Code fire it on `claude --resume` alone, and PreToolUse runs the layout
 * hook before every write, the brief hook before every dispatch and the
 * shell hook before every shell command. A group with no command wanted is never written.
 * @param {{session: boolean, ledger: boolean}} want
 * @returns {WantedGroup[]}
 */
function wantedGroups({ session, ledger }) {
  /** @param {(string|false)[]} candidates */
  const on = (candidates) => candidates.filter(/** @returns {c is string} */ (c) => typeof c === 'string');
  return [
    { event: 'SessionEnd', commands: on([session && SESSION_CLEANUP_COMMAND, ledger && PRESENCE_CLEANUP_COMMAND, ledger && CONVERSATION_END_COMMAND]) },
    { event: 'SessionStart', matcher: 'resume', commands: on([ledger && SESSION_RESUME_COMMAND]) },
    { event: 'PreToolUse', matcher: LAYOUT_HOOK_TOOLS.join('|'), commands: on([ledger && LAYOUT_GUARD_COMMAND]) },
    { event: 'PreToolUse', matcher: BRIEF_HOOK_TOOLS.join('|'), commands: on([ledger && BRIEF_GUARD_COMMAND]) },
    { event: 'PreToolUse', matcher: SHELL_HOOK_TOOLS.join('|'), commands: on([ledger && SHELL_GUARD_COMMAND]) },
  ];
}

/**
 * The wanted groups gathered by event, in the table's order.
 * @param {{session: boolean, ledger: boolean}} want
 * @returns {Map<string, WantedGroup[]>}
 */
function wantedByEvent(want) {
  /** @type {Map<string, WantedGroup[]>} */
  const byEvent = new Map();
  for (const group of wantedGroups(want)) byEvent.set(group.event, [...(byEvent.get(group.event) || []), group]);
  return byEvent;
}

/**
 * One event's groups with ours reconciled to the wanted groups. Where the
 * marks found already make up exactly the wanted set, wherever and however
 * they sit, nothing is twinned or moved: null when each hook of ours runs
 * the command the sync writes, else the groups with each that does not
 * rewritten to it, its other fields kept. Otherwise ours are stripped from
 * every group — a group emptied by that goes, one still holding foreign
 * hooks keeps them and its matcher — and each wanted group lands after
 * them, one per matcher.
 * @param {any[]} groups @param {WantedGroup[]} wanted
 * @returns {any[]|null}
 */
function reconcileEventGroups(groups, wanted) {
  const commands = new Map(wanted.flatMap((w) => w.commands.map((command) => [hookMark(command), command])));
  if (groups.flatMap(marksOf).sort().join('\n') === [...commands.keys()].sort().join('\n')) return currentCommands(groups, commands);
  const kept = groups.flatMap((g) => {
    if (marksOf(g).length === 0) return [g];
    const foreign = g.hooks.filter((/** @type {unknown} */ h) => !ourMark(h));
    return foreign.length > 0 ? [{ ...g, hooks: foreign }] : [];
  });
  const ours = wanted.filter((w) => w.commands.length > 0).map(({ matcher, commands }) => {
    const hooks = commands.map((command) => ({ type: 'command', command }));
    return matcher ? { matcher, hooks } : { hooks };
  });
  return [...kept, ...ours];
}

/**
 * The groups with each hook of ours running the command the sync writes for
 * its mark, or null where every one runs it already.
 * @param {any[]} groups @param {Map<string, string>} commands
 * @returns {any[]|null}
 */
function currentCommands(groups, commands) {
  let rewritten = false;
  const next = groups.map((group) => {
    if (marksOf(group).length === 0) return group;
    return {
      ...group,
      hooks: group.hooks.map((/** @type {any} */ hook) => {
        const mark = ourMark(hook);
        const command = mark === null ? undefined : commands.get(mark);
        if (command === undefined || hook.command === command) return hook;
        rewritten = true;
        return { ...hook, command };
      }),
    };
  });
  return rewritten ? next : null;
}

/**
 * A settings document with the session hooks as wanted: SessionEnd carries
 * `session cleanup` iff `session`, and `presence cleanup` and `conversation
 * end` iff `ledger`; SessionStart carries `session resume` iff `ledger`;
 * PreToolUse carries `layout guard`, `brief guard` and `shell guard`, each
 * in its own group, iff `ledger` — each event reconciled on its own,
 * every other key (permissions, other events, foreign groups and their
 * matchers) preserved, an event emptied by a removal gone. Null where the
 * document already carries exactly those, each running the command the
 * sync writes.
 * @param {Record<string, any>} settings @param {{session: boolean, ledger: boolean}} want
 * @returns {Record<string, any>|null}
 */
function withSessionHooks(settings, want) {
  const hooks = isObject(settings.hooks) ? settings.hooks : {};
  const nextHooks = { ...hooks };
  let changed = false;
  for (const [event, wanted] of wantedByEvent(want)) {
    const groups = reconcileEventGroups(Array.isArray(hooks[event]) ? hooks[event] : [], wanted);
    if (groups === null) continue;
    changed = true;
    if (groups.length > 0) nextHooks[event] = groups;
    else delete nextHooks[event];
  }
  if (!changed) return null;
  const next = { ...settings };
  if (Object.keys(nextHooks).length > 0) next.hooks = nextHooks;
  else delete next.hooks;
  return next;
}

/**
 * What the project's settings file reads with the session hooks as wanted,
 * made from `text` — its committed content, null where there is none; null
 * where `text` already carries exactly those, or does not parse.
 * @param {string|null} text @param {{session: boolean, ledger: boolean}} want
 * @returns {string|null}
 */
function sessionHooksText(text, want) {
  const read = text === null ? { settings: {} } : parseSettings(text);
  const next = read.error ? null : withSessionHooks(read.settings, want);
  return next === null ? null : jsonText(next);
}

/**
 * Bring the session hooks in the project's `.claude/settings.json` in line
 * with what is wanted (`withSessionHooks`). Not while git is in the middle
 * of an operation in the code tree, where a write would wait uncommitted
 * inside it: the sync names the operation it waits on, and the next boot
 * writes them. A settings file that does not parse is left untouched and
 * reported rather than thrown: neither caller may fail over hook plumbing it
 * cannot read.
 * @param {string} cwd @param {{session: boolean, ledger: boolean}} want
 * @returns {import('./settings.cjs').SettingsSync}
 */
function syncSessionHooks(cwd, want) {
  const open = operationInProgress(codeRoot(cwd));
  if (open !== null) return { changed: false, waiting: open.operation };
  const read = readProjectSettings(cwd);
  if (read.error) return { changed: false, error: read.error };
  const next = withSessionHooks(read.settings, want);
  if (next === null) return { changed: false };
  writeProjectSettings(cwd, next);
  return { changed: true };
}

/**
 * Commit Ledger's own change to the session hooks — this call's
 * write, or one an earlier call could not commit (`commitOwnChange`).
 * @param {string} cwd @param {{session: boolean, ledger: boolean}} want
 * @param {string} message @param {string} failure the warning's lead where git refuses @param {string[]} warnings
 */
function commitSessionHooks(cwd, want, message, failure, warnings) {
  commitOwnChange(cwd, SETTINGS_SPEC, (text) => sessionHooksText(text, want), message, failure, warnings);
}

/**
 * ledger's one-time answer: record the opt-in, sync the session
 * hooks to match (Ledger's own stay whatever the answer), and commit
 * each where it lives — the project manifest in the state, the settings in
 * the code tree. The choice is recorded either way: a settings file the
 * sync could not read, hooks left unwritten while git holds an operation
 * open, or a commit git refused, comes back as a warning — boot re-syncs,
 * and the state is saved.
 * @param {string} cwd @param {boolean} value
 * @returns {{session_labels: boolean, warnings?: string[]}}
 */
function recordLabelChoice(cwd, value) {
  setLabelConfig(cwd, value);
  /** @type {string[]} */
  const warnings = [];
  const want = { session: value, ledger: true };
  const sync = withProjectLock(cwd, () => syncSessionHooks(cwd, want));
  if (sync.error) warnings.push(`session hooks not synced: ${sync.error}`);
  if (sync.waiting) warnings.push(`session hooks not written: ${sync.waiting} is in progress in the code tree — the next boot writes them`);
  commitStateTail(cwd, PROJECT_MANIFEST_SPEC, 'chore: record session-label choice', warnings);
  if (!sync.error) commitSessionHooks(cwd, want, 'chore: record session-label choice', 'commit failed', warnings);
  return warnings.length > 0 ? { session_labels: value, warnings } : { session_labels: value };
}

/**
 * @typedef {{labelled: true, name: string} | {labelled: false, reason: 'disabled'|'no-multiplexer'|'tmux-error'|'portal-error'|'stash-error'}} LabelResult
 */

/**
 * @typedef {object} Labeller
 * @property {string} name   the multiplexer, in a reason's prefix
 * @property {string} title  the multiplexer as the prompt names it
 * @property {() => boolean} present whether the session runs inside it
 * @property {() => any} read the session as it stands — null where there is none, a throw where the multiplexer errors
 * @property {(cwd: string, ctx: any, place: string) => LabelResult} apply label the session read with the place
 * @property {(cwd: string, sessionId: string) => boolean} restore the SessionEnd pass
 * @property {(cwd: string, ctx: any) => boolean} repair boot's pass over the session read
 */

/** @type {Labeller[]} */
const LABELLERS = [portalLabeller, tmuxLabeller];

/**
 * @typedef {object} Found
 * @property {Labeller} labeller
 * @property {() => any} read the session as it stands — null where the multiplexer errors
 */

/**
 * The multiplexer labelling this terminal: Portal where `$ZMX_SESSION` is
 * set and `portal current` answers, its answer kept as the session read;
 * then tmux where `$TMUX` is set, its session read only when asked for.
 * Null outside both.
 * @returns {Found|null}
 */
function detect() {
  if (portalLabeller.present()) {
    try {
      const ctx = portalLabeller.read();
      return { labeller: portalLabeller, read: () => ctx };
    } catch { /* Portal did not answer */ }
  }
  if (!tmuxLabeller.present()) return null;
  return {
    labeller: tmuxLabeller,
    read: () => { try { return tmuxLabeller.read(); } catch { return null; } },
  };
}

/**
 * The multiplexer this terminal runs in, as the label prompt names it —
 * null outside both.
 * @returns {string|null}
 */
function multiplexerHere() {
  const found = detect();
  return found === null ? null : found.labeller.title;
}

/**
 * Boot's report for ledger's one-time prompt: `no-multiplexer` (never
 * prompt, never label), `on`/`off` (recorded on the project manifest),
 * `prompt` (inside tmux or Portal, and never asked).
 * @param {string} cwd
 * @returns {'no-multiplexer'|'on'|'off'|'prompt'}
 */
function labelConfigStatus(cwd) {
  if (detect() === null) return 'no-multiplexer';
  const v = resolveEnabled(cwd);
  if (v === true) return 'on';
  if (v === false) return 'off';
  return 'prompt';
}

/**
 * The topic as the label shows it: in a topic phase the name it goes by, in
 * plain form as the handoff line shows it.
 * @param {string} cwd @param {string} name @param {string} [phase] @param {string} [topic]
 */
function shownTopic(cwd, name, phase, topic) {
  if (phase === undefined || topic === undefined) return topic;
  const manifest = loadManifest(cwd, name);
  return manifest === null ? topic : itemName(topicTitles(manifest), phase, topic);
}

/**
 * Label the session to carry the working position: `{name}` alone on
 * arrival at a work unit's menu or a project-level place, `{name} · {phase}
 * · {topic}` inside a phase (topic collapsed when it equals the work unit,
 * a renamed topic by the name it goes by), after the label's own part —
 * tmux's original name, Portal's base. The arguments name a place the
 * project has — a work-unit directory, or in the name-only form a project
 * identity, `roadmap` or `product`, which has no directory and no phase —
 * checked by the caller before anything is labelled (position.cjs
 * `assertPlace`). No-op JSON when the feature is off for the project, the
 * session runs inside no multiplexer, the multiplexer errors, or the stash
 * cannot be written — the label never blocks a flow.
 * @param {string} cwd @param {string} name @param {string} [phase] @param {string} [topic]
 * @returns {LabelResult}
 */
function applySessionLabel(cwd, name, phase, topic) {
  if (resolveEnabled(cwd) !== true) return { labelled: false, reason: 'disabled' };
  const found = detect();
  if (found === null) return { labelled: false, reason: 'no-multiplexer' };
  const ctx = found.read();
  if (!ctx) return { labelled: false, reason: /** @type {'tmux-error'|'portal-error'} */ (`${found.labeller.name}-error`) };
  const place = placeLine({ name, phase, topic: shownTopic(cwd, name, phase, topic) }, ' · ');
  return found.labeller.apply(cwd, ctx, place);
}

/**
 * Arrive at a place — the entry's (enter.cjs), `session label`'s, the
 * epic's menu's and the roadmap's as each is drawn (menus.cjs), and a
 * unit's finish's or cancel's return to where its start was made
 * (topic-leave.cjs): a place this project lacks refused before anything is labelled or recorded,
 * then the session labelled and the conversation's position recorded,
 * labels on or off, with the laboratory's experiment, `record`, where its
 * entry named one; and, arriving from another place, the conversation
 * marked moved on there (catch-up.cjs). Answers the label's own answer.
 * @param {string} cwd @param {string} name @param {string} [phase] @param {string} [topic] @param {string} [record]
 */
function arriveAt(cwd, name, phase, topic, record) {
  assertPlace(cwd, name, phase, topic);
  const labelled = applySessionLabel(cwd, name, phase, topic);
  const own = handedSession();
  const left = placeAt(own === null ? null : readPosition(own));
  recordPosition(cwd, name, phase, topic, record);
  if (left !== null && !samePlace(left, placeAt({ name, phase, topic }))) movedOn(cwd, left);
  return labelled;
}

/**
 * A resumed conversation back at its position — `session resume`, the
 * SessionStart hook's target on `claude --resume`: recorded again at the
 * position's place for catch-up (catch-up.cjs, `resumedAt`), labels on or
 * off, then its label re-applied through `applySessionLabel`, so the
 * label's gates are `label`'s own (disabled, no multiplexer, its error all
 * no-op), the stash records the resuming process's identity, and a label
 * already worn costs no rename. A position naming a place this project does
 * not have — the conversation resumed in another checkout, or its unit gone
 * — records and labels nothing and is kept: its folder's tidy-up owns its
 * lifetime. Never throws: a hook must exit clean.
 * @param {string} cwd @param {string|null} sessionId
 * @returns {{resumed: boolean}}
 */
function resumeSession(cwd, sessionId) {
  if (!sessionId) return { resumed: false };
  const position = readPosition(sessionId);
  if (!position) return { resumed: false };
  try {
    if (!isPlace(cwd, position.name, position.phase, position.topic)) return { resumed: false };
    const place = placeAt(position);
    if (place !== null) resumedAt(cwd, sessionId, place);
    return { resumed: applySessionLabel(cwd, position.name, position.phase, position.topic).labelled };
  } catch {
    return { resumed: false };
  }
}

/**
 * Put the original back — `session cleanup`, the SessionEnd hook's target:
 * every labeller's pass is run, since the hook's environment may lack what
 * detection reads (session-label-tmux.cjs, session-label-portal.cjs).
 * Without a session id nothing is touched (an id-less sweep could take a
 * live peer's label — the presence sweep refuses the same way). Never
 * throws: a hook must exit clean.
 * @param {string} cwd @param {string|null} sessionId
 * @returns {{restored: boolean}}
 */
function restoreSessionLabel(cwd, sessionId) {
  if (!sessionId) return { restored: false };
  const restored = LABELLERS.map((labeller) => labeller.restore(cwd, sessionId));
  return { restored: restored.includes(true) };
}

/**
 * Boot's pass over the current terminal — the start skill is the place
 * whose label is the original, and no position: the calling conversation's
 * own position comes off first, labels on or off — its tasks in flight kept
 * at the place left (position.cjs) — while a dead owner's stays — that
 * session may yet be resumed. Then the multiplexer's own pass puts back a
 * label of the calling session's or of a gone owner's. Gated exactly like
 * `label` (a disabled project must never touch the terminal), no-op inside
 * no multiplexer or on its error, and a peer's label whose owning process
 * still runs is live — left alone.
 * @param {string} cwd
 * @returns {{repaired: boolean}}
 */
function repairSessionLabels(cwd) {
  dropPosition(handedSession());
  return repairTerminalLabel(cwd);
}

/**
 * The multiplexer's own pass of `repairSessionLabels`, the position left as
 * it stands: what a quick-fix left in place puts back (topic-leave.cjs).
 * @param {string} cwd
 * @returns {{repaired: boolean}}
 */
function repairTerminalLabel(cwd) {
  if (resolveEnabled(cwd) !== true) return { repaired: false };
  const found = detect();
  const ctx = found === null ? null : found.read();
  if (found === null || !ctx) return { repaired: false };
  return { repaired: found.labeller.repair(cwd, ctx) };
}

module.exports = {
  arriveAt, restoreSessionLabel, repairSessionLabels, repairTerminalLabel, resumeSession,
  resolveEnabled, labelConfigStatus, multiplexerHere, syncSessionHooks, commitSessionHooks, carriesOurHooks, recordLabelChoice,
};
