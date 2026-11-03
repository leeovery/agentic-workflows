'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a unit's history as the state branch's commits tell it, for
// the board (20.7.1, 20.8.2, 20.15.1) — each read one bounded `git log` of
// the state, and never a write.
//
// - What happened (`unitHistory`): the latest of the unit's commits whose
//   subject says one of the moments the board shows (`MOMENTS`) — the unit
//   made, the map approved, a phase or a topic started, a topic postponed,
//   cancelled or back, a message sent to a topic or taken in by it, the
//   spec landed, a review round recorded, the unit completed — newest
//   first, each with when it was committed, its topic where it names one,
//   and what it names besides: the type, the horizon, the message, the
//   round, the phase started.
// - What each topic was sent (`sentMail`): every message a commit added to
//   one of the unit's mailboxes, newest first, each with the topic it went
//   to, its file, its title and the line under it naming who sent it and
//   when, read from the file as it was added, wherever it has gone since.
// ---------------------------------------------------------------------------

const { stateRoot } = require('../kernel/state-root.cjs');
const { isolatedGit } = require('../kernel/isolated-git.cjs');
const { VALID_PHASES } = require('../kernel/manifest-schema.cjs');
const { messageParts } = require('./mail.cjs');

/** How many of the unit's commits a read of what happened looks back over. */
const LOOK_BACK = 60;

/** @typedef {import('./board-model.cjs').Moment} Moment */
/** A message added to a mailbox: the topic it went to, its file, title and sender's line, and when. @typedef {{to: string, file: string, title: string, from: string, at: string}} SentMail */

/**
 * The moments the board shows, by the subject's scope — any phase's for a
 * start — and what follows the unit in it; a topic and a detail where the
 * subject names them.
 * @type {readonly {kind: string, scope: string|readonly string[], said: RegExp}[]}
 */
const MOMENTS = Object.freeze([
  { kind: 'created', scope: 'discovery', said: /^(?:create work unit|start this work) \((?<detail>[^)]+)\)$/ },
  { kind: 'map-approved', scope: 'discovery', said: /^approve the map$/ },
  { kind: 'postponed', scope: 'workflow', said: /^postpone (?<topic>\S+) → (?<detail>.+)$/ },
  { kind: 'cancelled', scope: 'workflow', said: /^cancel (?<topic>\S+) \(discovery\)$/ },
  { kind: 'reactivated', scope: 'workflow', said: /^reactivate (?<topic>\S+) \(discovery\)$/ },
  { kind: 'sent', scope: 'mail', said: /^send (?<detail>\S+) to (?<topic>\S+)$/ },
  { kind: 'answered', scope: 'mail', said: /^(?<topic>\S+) answered (?<detail>\S+)$/ },
  { kind: 'spec-landed', scope: 'spec', said: /^landed$/ },
  { kind: 'round', scope: 'review', said: /^round (?<detail>\d+)$/ },
  { kind: 'completed', scope: 'finish', said: /^completed$/ },
  { kind: 'started', scope: VALID_PHASES, said: /^start(?: (?<topic>\S+))?$/ },
]);

/** A commit's time as the board carries one. @param {string} at */
const isoOf = (at) => new Date(at).toISOString();

/**
 * The moment a commit's subject says of `unit`, null where it says none.
 * @param {string} unit @param {string} at @param {string} subject @returns {Moment|null}
 */
function momentOf(unit, at, subject) {
  const head = /^([a-z-]+)\((.+?)\): (.*)$/.exec(subject);
  if (head === null || head[2] !== unit) return null;
  const [, scope, , rest] = head;
  for (const { kind, scope: of, said } of MOMENTS) {
    const phase = typeof of !== 'string';
    const match = (phase ? of.includes(scope) : of === scope) ? said.exec(rest) : null;
    if (match !== null) return { kind, at: isoOf(at), topic: match.groups?.topic ?? null, detail: match.groups?.detail ?? (phase ? scope : null) };
  }
  return null;
}

/** The unit's moments, newest first (the header's). @param {string} cwd @param {string} unit @returns {Moment[]} */
function unitHistory(cwd, unit) {
  const out = isolatedGit(stateRoot(cwd)).tryRun(['log', '--no-show-signature', '-z', `-n${LOOK_BACK}`, '--format=%cI%x09%s', '--fixed-strings', `--grep=(${unit})`, 'HEAD', '--']);
  return (out ?? '').split('\0').filter(Boolean).flatMap((record) => {
    const [at, subject] = record.trim().split('\t');
    const moment = subject === undefined ? null : momentOf(unit, at, subject);
    return moment === null ? [] : [moment];
  });
}

/**
 * Each message a commit's patch adds, with the topic it went to.
 * @param {string} unit @param {string} at @param {string} patch @returns {SentMail[]}
 */
function addedMail(unit, at, patch) {
  const into = `+++ b/${unit}/topics/`;
  return patch.split(/^diff --git /m).flatMap((file) => {
    const lines = file.split('\n');
    const header = lines.findIndex((line) => line.startsWith(into));
    if (header === -1) return [];
    const [to, , name] = lines[header].slice(into.length).split('/');
    const text = lines.slice(header + 1).filter((line) => line.startsWith('+')).map((line) => line.slice(1)).join('\n');
    const { title, from } = messageParts(text);
    return [{ to, file: name, title, from, at: isoOf(at) }];
  });
}

/** Every message sent to one of the unit's topics, newest first (the header's). @param {string} cwd @param {string} unit @returns {SentMail[]} */
function sentMail(cwd, unit) {
  const out = isolatedGit(stateRoot(cwd)).tryRun([
    'log', '--no-show-signature', '--no-color', '--no-ext-diff', '--diff-filter=A', '-p', '--format=%x01%cI', 'HEAD', '--', `:(glob)${unit}/topics/*/mail/*.md`,
  ]);
  return (out ?? '').split('\x01').filter(Boolean).flatMap((commit) => {
    const [at, ...patch] = commit.split('\n');
    return addedMail(unit, at, patch.join('\n'));
  });
}

module.exports = { unitHistory, sentMail };
