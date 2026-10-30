'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the mailboxes between topics (§10). A topic has one mailbox,
// `{unit}/topics/{topic}/mail/`, a queue of files, one message each,
// `NNN-{slug}.md` numbered in the order they landed; a message's first line
// is its title. Three verbs:
// - `topic send <unit> <topic> --content <file> --slug <kebab>` lands a
//   message, the scratch it was written to consumed. It takes the next
//   number under the writer lock, so a send racing another takes the one
//   after it, and parks the topic's conversation as a landing does: created
//   not started where absent, set back in progress where decided (10.2.7),
//   so the next decided needs a fresh close and the gate's yes. A postponed
//   topic is left as it stands, the message waiting in its mailbox for its
//   return (10.1.8). A message to a cancelled topic, or a cancelled unit's,
//   goes to the inbox as an idea instead, its first line the title (10.1.6,
//   10.1.8). Any other target the entry would refuse is refused, by the
//   entry's own rule (topic-standing.cjs), the scratch kept: a unit not in
//   progress, a topic it lacks or has closed, and any topic once the unit
//   has its spec, from which a change is settled where it is found (10.2.2).
//   Each send commits what it wrote.
// - `topic mailbox <unit> <topic>` lists what waits, lock-free, for the
//   conversation's loop to raise (10.1.5).
// - `topic answered <unit> <topic> <NNN-slug> --entry <id>` removes a
//   message, named whole since a number comes back once the highest is
//   answered, once the topic holds the question it raised (5.3.8): the entry
//   a question raised on this topic, wherever it stands since; the unit in
//   progress, as for any work on it. Git keeps the file.
// A commit a send to the mailbox or a removal leaves pending is retried in
// the topic's scope as a sweep, which takes no hold on the topic.
// The send report and the waiting mail are drawn by projections/mail.cjs.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, ensureContainer } = require('../kernel/manifest.cjs');
const { KEBAB_SLUG_PATTERN, workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { stateRoot, statePath, stateRelative } = require('../kernel/state-root.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { computeTopicLifecycle, mailboxDir, mailboxFiles, mailPhase } = require('./derivations.cjs');
const { parkMessageItem, flagDownstream, assertLegalTopicName } = require('./transitions.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { ID_FACTS, foldLedger } = require('./ledger-fold.cjs');
const { assertInProgress, topicClosure } = require('./topic-standing.cjs');
const { resolveId, shortId } = require('./ledger-ids.cjs');
const { todayStamp } = require('./dates.cjs');
const { sendReport } = require('./projections/mail.cjs');

const SEND_USAGE = 'topic send <work-unit> <topic> --content <file> --slug <kebab>';
const MAILBOX_USAGE = 'topic mailbox <work-unit> <topic>';
const ANSWERED_USAGE = 'topic answered <work-unit> <topic> <NNN-slug> --entry <id>';

/** Where a cancelled topic's mail goes: the inbox's ideas (10.1.6). */
const INBOX_IDEAS = '.inbox/ideas';

/** A message's title: its first line, any heading marks taken off. @param {string} text */
function titleOf(text) {
  return text.split('\n', 1)[0].replace(/^#+\s*/, '').trim();
}

/** What follows a message's title, its leading blank lines dropped. @param {string} text */
function bodyOf(text) {
  return text.split('\n').slice(1).join('\n').replace(/^\s*\n/, '').replace(/\s+$/, '');
}

/**
 * The message a send was handed: the scratch under `.cache/`, so a path
 * passed by mistake never consumes a live file, holding a title.
 * @param {string} cwd @param {string} contentFile @returns {{scratch: string, content: string}}
 */
function messageIn(cwd, contentFile) {
  const scratch = path.resolve(cwd, contentFile);
  if (!(stateRelative(cwd, scratch) ?? '').startsWith('.cache/')) {
    throw new Error(`--content must point inside ${statePath(cwd, '.cache')}/ — got "${contentFile}"`);
  }
  let content;
  try {
    content = fs.readFileSync(scratch, 'utf8');
  } catch {
    throw new Error(`message file not found: ${contentFile}`);
  }
  if (titleOf(content) === '') throw new Error(`a message's first line is its title, and ${contentFile}'s is blank`);
  return { scratch, content: content.endsWith('\n') ? content : `${content}\n` };
}

/**
 * A unit's manifest, refused where the project has no such unit.
 * @param {string} cwd @param {string} unit @returns {Record<string, any>}
 */
function unitManifest(cwd, unit) {
  const manifest = workUnitNameRefusal(unit) === null ? manifestOf(stateRoot(cwd), unit) : null;
  if (manifest === null) throw new Error(`there is no work unit "${unit}"`);
  return manifest;
}

/** A topic's next message number, three digits or more. @param {string} cwd @param {string} unit @param {string} topic */
function nextNumber(cwd, unit, topic) {
  const taken = mailboxFiles(stateRoot(cwd), unit, topic).map((name) => Number(/^(\d+)-/.exec(name)?.[1] ?? 0));
  return String(Math.max(0, ...taken) + 1).padStart(3, '0');
}

/**
 * @typedef {object} Landed
 * @property {string} rel  where the message landed, state-relative
 * @property {string[]} paths  what the send commits, state-relative
 * @property {string} message  the commit's message
 * @property {string} retry  the scope a pending commit's retry takes
 * @property {Record<string, unknown>} fields  the response's own fields
 */

/**
 * A message to a cancelled topic, landed in the inbox as an idea (10.1.6).
 * @param {string} cwd @param {string} unit @param {string} topic @param {string} content @param {string} slug
 * @returns {Landed}
 */
function toInbox(cwd, unit, topic, content, slug) {
  const rel = `${INBOX_IDEAS}/${todayStamp()}--${slug}.md`;
  if (fs.existsSync(statePath(cwd, rel))) throw new Error(`the inbox already holds ${statePath(cwd, rel)} — send it under another slug`);
  const body = bodyOf(content);
  fs.mkdirSync(statePath(cwd, INBOX_IDEAS), { recursive: true });
  fs.writeFileSync(statePath(cwd, rel), `# ${titleOf(content)}\n${body === '' ? '' : `\n${body}\n`}`);
  return { rel, paths: [rel], message: `mail(${unit}): ${slug} to the inbox — ${topic} is cancelled`, retry: '--inbox', fields: { inbox_path: statePath(cwd, rel) } };
}

/** The scope a pending commit on a topic's mailbox is retried in. @param {string} unit @param {string|null} phase @param {string} topic */
function mailboxRetry(unit, phase, topic) {
  return `${unit} --topic ${phase}/${topic} --sweep`;
}

/**
 * A message landed in the topic's mailbox, the topic's conversation parked
 * as a landing parks it — a postponed topic left as it stands.
 * @param {string} cwd @param {Record<string, any>} manifest @param {string} phase @param {string} topic @param {string} content @param {string} slug
 * @returns {Landed}
 */
function toMailbox(cwd, manifest, phase, topic, content, slug) {
  const unit = manifest.name;
  const { lifecycle } = computeTopicLifecycle(manifest, topic);
  /** @type {Record<string, unknown>} */
  const fields = {};
  if (lifecycle !== 'postponed') {
    const phases = ensureContainer(manifest, 'phases', 'phases');
    const items = ensureContainer(ensureContainer(phases, phase, `phases.${phase}`), 'items', `phases.${phase}.items`);
    const park = parkMessageItem(items, phase, topic);
    const flags = flagDownstream(manifest, manifest.work_type, phase, topic);
    if (park.reopened) fields.reopened = true;
    if (flags.flagged.length > 0) fields.reconcile_flagged = true;
    if (flags.staled.length > 0) fields.sources_staled = flags.staled;
    if (park.dirty || flags.flagged.length > 0 || flags.staled.length > 0) saveWorkUnitManifest(cwd, unit, manifest);
  }
  const name = `${nextNumber(cwd, unit, topic)}-${slug}.md`;
  const rel = `${mailboxDir(unit, topic)}/${name}`;
  fs.mkdirSync(statePath(cwd, mailboxDir(unit, topic)), { recursive: true });
  fs.writeFileSync(statePath(cwd, rel), content);
  return {
    rel, paths: [`${unit}/manifest.json`, rel], message: `mail(${unit}): send ${name} to ${topic}`, retry: mailboxRetry(unit, phase, topic),
    fields: { message_path: statePath(cwd, rel), ...fields },
  };
}

/**
 * Where a message to a topic of a unit in progress lands: the inbox for a
 * cancelled topic, else its mailbox — refused where the topic takes nothing.
 * @param {string} cwd @param {Record<string, any>} manifest @param {string} topic @param {string} content @param {string} slug
 * @returns {Landed}
 */
function toTopic(cwd, manifest, topic, content, slug) {
  assertInProgress(manifest);
  const phase = mailPhase(manifest.work_type);
  if (phase === null) throw new Error(`a ${manifest.work_type} has no conversation for a message to wait in`);
  const closure = topicClosure({ cwd, phase, unit: manifest.name, topic, manifest });
  if (closure !== null) throw new Error(closure);
  return computeTopicLifecycle(manifest, topic).lifecycle === 'cancelled'
    ? toInbox(cwd, manifest.name, topic, content, slug)
    : toMailbox(cwd, manifest, phase, topic, content, slug);
}

/**
 * `topic send`: the message landed — in the topic's mailbox, or for a
 * cancelled topic in the inbox — its scratch consumed, and committed.
 * @param {string} cwd @param {string} unit @param {string} topic @param {{contentFile?: string, slug?: string}} opts
 * @returns {Record<string, unknown>}
 */
function sendMessage(cwd, unit, topic, { contentFile, slug }) {
  if (!contentFile || !slug) throw new Error(`Usage: engine ${SEND_USAGE}`);
  assertLegalTopicName(topic);
  if (!KEBAB_SLUG_PATTERN.test(slug)) throw new Error(`--slug must be kebab-case, got "${slug}"`);
  unitManifest(cwd, unit);
  const { scratch, content } = messageIn(cwd, contentFile);
  const landed = withWorkUnitLock(cwd, unit, () => {
    const manifest = loadWorkUnitManifest(cwd, unit);
    return manifest.status === 'cancelled' ? toInbox(cwd, unit, topic, content, slug) : toTopic(cwd, manifest, topic, content, slug);
  });
  fs.rmSync(scratch, { force: true });
  /** @type {string[]} */
  const warnings = [];
  const outcome = commitStateTail(cwd, landed.paths, landed.message, warnings);
  /** @type {Record<string, unknown>} */
  const result = { unit, topic, ...landed.fields, committed: outcome.committed };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome, landed.retry);
  return result;
}

/**
 * `topic mailbox`: what waits in a topic's mailbox, in the order it landed,
 * as absolute paths. Takes no lock.
 * @param {string} cwd @param {string} unit @param {string} topic
 * @returns {{unit: string, topic: string, count: number, files: string[]}}
 */
function mailboxOf(cwd, unit, topic) {
  assertLegalTopicName(topic);
  unitManifest(cwd, unit);
  const files = mailboxFiles(stateRoot(cwd), unit, topic).map((name) => statePath(cwd, mailboxDir(unit, topic), name));
  return { unit, topic, count: files.length, files };
}

/**
 * The question the message raised, by a prefix of its id: refused where the
 * id names no entry, an entry other than a question, or a question raised on
 * another topic.
 * @param {string} cwd @param {string} unit @param {string} topic @param {string} prefix @param {string[]} warnings
 * @returns {string} its short id
 */
function raisedQuestion(cwd, unit, topic, prefix, warnings) {
  const root = stateRoot(cwd);
  const facts = foldLedger(root, ID_FACTS, warnings);
  const short = (/** @type {string} */ id) => shortId(id, facts.keys());
  let id;
  try {
    id = resolveId(prefix, facts.keys());
  } catch (err) {
    throw new Error(`topic answered --entry: ${messageOf(err)}`);
  }
  const named = /** @type {import('./ledger-fold.cjs').IdFacts} */ (facts.get(id));
  if (named.kind !== 'question') throw new Error(`topic answered --entry names ${short(id)}, ${named.kind === null ? `a ${named.event} line` : `a ${named.kind}`} — it must name the question the message raised`);
  const raised = /** @type {import('./ledger-fold.cjs').IdFacts} */ (facts.get(named.root));
  if (raised.unit !== unit || raised.topic !== topic) {
    throw new Error(`topic answered --entry names ${short(id)}, a question raised on ${raised.topic ?? 'no topic'} of ${raised.unit} — the question the message raised was raised on ${topic}`);
  }
  return short(id);
}

/** A message's name, `NNN-{slug}`. @param {string|undefined} name */
function isMessageName(name) {
  const [, slug] = /^\d{3,}-(.+)$/.exec(name ?? '') ?? [];
  return slug !== undefined && KEBAB_SLUG_PATTERN.test(slug);
}

/**
 * `topic answered`: the message `name` removed from the topic's mailbox once
 * `entry` names the question it raised on the topic, under the writer lock,
 * and the removal committed.
 * @param {string} cwd @param {string} unit @param {string} topic @param {string} message @param {{entry?: string}} opts
 * @returns {Record<string, unknown>}
 */
function answerMessage(cwd, unit, topic, message, { entry }) {
  if (!isMessageName(message) || !entry) throw new Error(`Usage: engine ${ANSWERED_USAGE}`);
  assertLegalTopicName(topic);
  const manifest = unitManifest(cwd, unit);
  assertInProgress(manifest);
  /** @type {string[]} */
  const warnings = [];
  const { rel, name, question, remaining } = withWorkUnitLock(cwd, unit, () => {
    const files = mailboxFiles(stateRoot(cwd), unit, topic);
    const file = `${message}.md`;
    if (!files.includes(file)) throw new Error(`no message ${message} waits in ${topic}'s mailbox${files.length === 0 ? ' — it is empty' : ` — it holds ${files.join(', ')}`}`);
    const short = raisedQuestion(cwd, unit, topic, entry, warnings);
    const at = `${mailboxDir(unit, topic)}/${file}`;
    fs.unlinkSync(statePath(cwd, at));
    return { rel: at, name: file, question: short, remaining: files.length - 1 };
  });
  const outcome = commitStateTail(cwd, [rel], `mail(${unit}): ${topic} answered ${name}`, warnings);
  /** @type {Record<string, unknown>} */
  const result = { unit, topic, answered: name, entry: question, remaining, committed: outcome.committed };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome, mailboxRetry(unit, mailPhase(manifest.work_type), topic));
  return result;
}

/**
 * What waits in a topic's mailbox, in the order it landed: each message's
 * path, absolute, its title and what follows it.
 * @param {string} cwd @param {string} unit @param {string} topic
 * @returns {{path: string, title: string, body: string}[]}
 */
function waitingMessages(cwd, unit, topic) {
  return mailboxFiles(stateRoot(cwd), unit, topic).map((name) => {
    const at = statePath(cwd, mailboxDir(unit, topic), name);
    const text = fs.readFileSync(at, 'utf8');
    return { path: at, title: titleOf(text), body: bodyOf(text) };
  });
}

const SEND_REPORT_USAGE = 'render send-report <work-unit>.<topic> --sent <path>';

/**
 * The send report for the message a send landed at `sent`, the path its
 * response answered: in the topic's mailbox, or the inbox for a cancelled
 * topic.
 * @param {string} cwd @param {string} address `<work-unit>.<topic>` @param {string} [sent]
 * @returns {string}
 */
function sendReportOf(cwd, address, sent) {
  const [unit, topic, ...rest] = (address ?? '').split('.');
  if (!unit || !topic || rest.length > 0 || !sent) throw new Error(`Usage: engine ${SEND_REPORT_USAGE}`);
  const manifest = unitManifest(cwd, unit);
  const at = path.resolve(cwd, sent);
  const folder = path.posix.dirname(stateRelative(cwd, at) ?? '');
  if (![mailboxDir(unit, topic), INBOX_IDEAS].includes(folder) || !fs.existsSync(at)) {
    throw new Error(`render send-report: ${sent} is no message sent to ${topic} — --sent takes the path topic send answered`);
  }
  /** @type {import('./projections/mail.cjs').Landing} */
  let landing = 'inbox';
  if (folder !== INBOX_IDEAS) landing = computeTopicLifecycle(manifest, topic).lifecycle === 'postponed' ? 'postponed' : 'mailbox';
  return sendReport({ unit, topic, title: titleOf(fs.readFileSync(at, 'utf8')), landing });
}

module.exports = { SEND_USAGE, MAILBOX_USAGE, ANSWERED_USAGE, SEND_REPORT_USAGE, sendMessage, mailboxOf, answerMessage, waitingMessages, sendReportOf };
