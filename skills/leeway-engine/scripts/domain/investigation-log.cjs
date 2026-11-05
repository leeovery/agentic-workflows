'use strict';

// ---------------------------------------------------------------------------
// Domain ring: an investigation's log — a bugfix's one topic log,
// `{unit}/topics/{unit}/log.md`, the log of finding the cause, dead ends
// included (19.4.3) — and the hunt it holds under fixed headings, written by
// `investigation-log` and read by the investigation's gates and the board.
// Claude writes the rest of the log as the conversation goes; these lists
// are only the verb's, an entry a line, written and read as every log's
// fixed lists are (log-lists.cjs), each line resting on a ledger entry
// pointing at it by its full id: the ledger holds the root cause, the
// findings and the fix, the log what led to them (P1).
//
//   ## Symptoms       `- {symptom}`, in the person's words
//   ## Hypotheses     `- H{n} · {title} · {state}` — suspected, confirmed,
//                     ruled out, or `intended [{decision}]`, made so by the
//                     person's ruling
//   ## Experiments    `- E{n} · {title} — {what it showed} [{finding}]`, the
//                     investigation's own checks, never the laboratory's
//   ## Root cause     `- {the decision's words} [{decision}]`
//   ## Validation     `- {root cause|fix} · {what it found} — {what Claude
//                     did with it}`
//   ## Fix direction  `- {the question's words} [{question}]`
//
// None is `## Investigation`, the heading the reshape's migration puts an
// old investigation under, whose lists stay its prose.
//
// - The verb (`investigation-log <kind> <bugfix> …`) puts its entry in the
//   log, and an optional body (`--body <file>`), its lines beneath the entry
//   for the board's pages (20.12.2). A hypothesis is numbered as it is
//   first logged; a later line for it, `hypothesis <bugfix> H{n} --state`,
//   says its state now, its title carried, and stands over the earlier. An
//   experiment is numbered as it is logged. Nothing is committed: every state
//   commit takes the log along (6.3.2).
// - It refuses, writing nothing: a kind it lacks, an argument out of its
//   shape; a place whose investigation cannot take work — as the entry
//   refuses one (topic-standing.cjs) — or has not started; a value missing,
//   empty or past one line, a title holding ` · ` or an experiment's
//   ` — `, a finding of a validation holding ` — `; a state it lacks, an
//   intended hypothesis with no `--by` and any other with one, a hypothesis
//   the log does not hold; an entry named that is not one of the unit's
//   current entries of its kind — a finding, a decision, the person's
//   decision for `--by`, a question; a fix direction while the root cause
//   points at no current entry (19.4.1–19.4.3); and a body that cannot be
//   read, holds nothing, or holds a blank line, which would end it.
// - The reader (`huntIn`) takes every entry under the fixed headings in
//   order: each hypothesis by its number at its latest line, the bodies of
//   all its lines in order; the last root cause and the last fix direction,
//   each one the latest; the rest as listed. An entry that does not read as
//   its heading's shape is passed over, said among the warnings.
//
// Known edge, not built: an investigation the reshape's migration moved in
// progress keeps its hunt as prose under `## Investigation`, so its lists
// read empty until it logs again.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { messageOf } = require('../kernel/call.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { resolveId } = require('./ledger-ids.cjs');
const { notCurrent, factsOf, standingOf } = require('./ledger-fold.cjs');
const { claudesCall } = require('./ledger-events.cjs');
const { withUnitEntries } = require('./unit-entries.cjs');
const { itemOf } = require('./derivations.cjs');
const { unitInProgress, assertEnterable } = require('./topic-standing.cjs');
const { topicLog } = require('./topic-log.cjs');
const { listedIn, withEntry } = require('./log-lists.cjs');

/** @typedef {import('./unit-entries.cjs').UnitView} UnitView */

const SAID = 'investigation-log';

/** The fixed headings, as the log writes them. */
const HUNT_HEADINGS = Object.freeze({
  symptoms: 'Symptoms', hypotheses: 'Hypotheses', experiments: 'Experiments', rootCause: 'Root cause', validation: 'Validation', fixDirection: 'Fix direction',
});

const HEADINGS = Object.values(HUNT_HEADINGS);

/** A hypothesis's states, as a call names each and as its line says it. */
const STATES = Object.freeze({ suspected: 'suspected', confirmed: 'confirmed', 'ruled-out': 'ruled out', intended: 'intended' });

/** The state a hypothesis takes on the person's ruling, its line naming the decision. */
const INTENDED = 'intended';

/** The validations, as a call names each and as its line says it. */
const VALIDATIONS = Object.freeze({ 'root-cause': 'root cause', fix: 'fix' });

const DOT = ' · ';
const DASH = ' — ';
const ID = '([0-9A-Za-z]{21})';

const HYPOTHESIS_LINE = new RegExp(`^H([1-9][0-9]*) · (.+?) · (${Object.values(STATES).join('|')})(?: \\[${ID}\\])?$`);
const EXPERIMENT_LINE = new RegExp(`^E([1-9][0-9]*) · (.+?) — (.+) \\[${ID}\\]$`);
const POINTED_LINE = new RegExp(`^(.+) \\[${ID}\\]$`);
const VALIDATION_LINE = new RegExp(`^(${Object.values(VALIDATIONS).join('|')}) · (.+?) — (.+)$`);
const HYPOTHESIS_NAME = /^H([1-9][0-9]*)$/;

/** @typedef {{text: string, body: string[]}} Symptom */
/** @typedef {{name: string, title: string, state: string, by: string|null, body: string[]}} Hypothesis */
/** @typedef {{name: string, title: string, showed: string, entry: string, body: string[]}} Experiment */
/** @typedef {{text: string, entry: string, body: string[]}} Pointed */
/** @typedef {{which: string, found: string, did: string, body: string[]}} Validation */
/**
 * The hunt as the log holds it: the symptoms, each hypothesis by its number,
 * the experiments, the latest root cause and fix direction, null before one
 * is logged, and the validations.
 * @typedef {{symptoms: Symptom[], hypotheses: Hypothesis[], experiments: Experiment[], rootCause: Pointed|null, validations: Validation[], fixDirection: Pointed|null}} Hunt
 */

/** The state a call names, as its line says it. @param {string} state */
const stateWords = (state) => STATES[/** @type {keyof typeof STATES} */ (state)];

/** The state a line says, as a call names it. @param {string} words */
const stateNamed = (words) => /** @type {string} */ (Object.keys(STATES).find((state) => stateWords(state) === words));

/**
 * Each fixed heading's reading: an entry and its body taken into the hunt,
 * else why it is passed over.
 * @type {Readonly<Record<string, (hunt: Hunt, entry: string, body: string[]) => string|null>>}
 */
const READS = Object.freeze({
  [HUNT_HEADINGS.symptoms]: (hunt, text, body) => {
    hunt.symptoms.push({ text, body });
    return null;
  },
  [HUNT_HEADINGS.hypotheses]: (hunt, entry, body) => {
    const said = HYPOTHESIS_LINE.exec(entry);
    if (said === null || (said[3] === INTENDED) !== (said[4] !== undefined)) return 'does not read as a hypothesis';
    const name = `H${said[1]}`;
    const earlier = hunt.hypotheses.find((held) => held.name === name);
    const now = { name, title: said[2], state: stateNamed(said[3]), by: said[4] ?? null, body: [...(earlier?.body ?? []), ...body] };
    if (earlier === undefined) hunt.hypotheses.push(now);
    else Object.assign(earlier, now);
    return null;
  },
  [HUNT_HEADINGS.experiments]: (hunt, entry, body) => {
    const said = EXPERIMENT_LINE.exec(entry);
    if (said === null) return 'does not read as an experiment';
    hunt.experiments.push({ name: `E${said[1]}`, title: said[2], showed: said[3], entry: said[4], body });
    return null;
  },
  [HUNT_HEADINGS.rootCause]: (hunt, entry, body) => {
    const said = POINTED_LINE.exec(entry);
    if (said === null) return 'does not read as a root cause';
    hunt.rootCause = { text: said[1], entry: said[2], body };
    return null;
  },
  [HUNT_HEADINGS.validation]: (hunt, entry, body) => {
    const said = VALIDATION_LINE.exec(entry);
    if (said === null) return 'does not read as a validation';
    hunt.validations.push({ which: /** @type {string} */ (Object.keys(VALIDATIONS).find((which) => VALIDATIONS[/** @type {keyof typeof VALIDATIONS} */ (which)] === said[1])), found: said[2], did: said[3], body });
    return null;
  },
  [HUNT_HEADINGS.fixDirection]: (hunt, entry, body) => {
    const said = POINTED_LINE.exec(entry);
    if (said === null) return 'does not read as a fix direction';
    hunt.fixDirection = { text: said[1], entry: said[2], body };
    return null;
  },
});

/**
 * The hunt a log's text holds, `rel` its path from the state root; what is
 * passed over said in `warnings`.
 * @param {string} text @param {string} rel @param {string[]} warnings @returns {Hunt}
 */
function huntIn(text, rel, warnings) {
  /** @type {Hunt} */
  const hunt = { symptoms: [], hypotheses: [], experiments: [], rootCause: null, validations: [], fixDirection: null };
  for (const { heading, entry, body } of listedIn(text, HEADINGS)) {
    const passed = READS[heading](hunt, entry, body);
    if (passed !== null) warnings.push(`${rel}: "${entry}" under ## ${heading} ${passed}, and is passed over`);
  }
  return hunt;
}

/** A bugfix's log, from the state root. @param {string} unit */
const huntLog = (unit) => topicLog(unit, unit);

/** The log's text, '' before anything is written to it. @param {string} cwd @param {string} unit */
function huntText(cwd, unit) {
  try {
    return fs.readFileSync(statePath(cwd, huntLog(unit)), 'utf8');
  } catch {
    return '';
  }
}

/** The hunt a bugfix's log holds. @param {string} cwd @param {string} unit @param {string[]} warnings @returns {Hunt} */
function huntOf(cwd, unit, warnings) {
  return huntIn(huntText(cwd, unit), huntLog(unit), warnings);
}

/**
 * The bugfix's manifest, refused, in the words of `said`, where its
 * investigation cannot take work — as the entry refuses it — or has not
 * started.
 * @param {string} cwd @param {string} unit @param {string} said @returns {Record<string, any>}
 */
function openInvestigation(cwd, unit, said) {
  try {
    const manifest = unitInProgress(cwd, unit);
    assertEnterable(cwd, 'investigation', manifest, unit);
    if (itemOf(manifest, 'investigation', unit)?.status !== 'in-progress') throw new Error(`${unit}'s investigation has not started — engine enter investigation ${unit} starts it`);
    return manifest;
  } catch (err) {
    throw new Error(`${said}: ${messageOf(err)}`);
  }
}

/** A value of the person's or Claude's words, refused missing, empty or past one line. @param {string|undefined} value @param {string} flag */
function oneLine(value, flag) {
  if (typeof value !== 'string' || value.trim() === '' || /[\r\n]/.test(value)) throw new Error(`${SAID}: --${flag} is one line of words, not empty`);
  return value.trim();
}

/** Refuses a value holding what would break its line's shape. @param {string} value @param {string} flag @param {string[]} breaks */
function unbroken(value, flag, breaks) {
  const held = breaks.find((mark) => value.includes(mark));
  if (held !== undefined) throw new Error(`${SAID}: --${flag} holds "${held.trim()}", which its line's shape keeps for itself`);
  return value;
}

/** The kinds of entry a flag may name, each as a refusal says it. */
const KIND_WORDS = Object.freeze({ finding: 'a finding', decision: 'a decision', question: 'a question' });

/**
 * The entry `given` names, by its full id: one of the unit's current entries
 * of `kind`, and with `person`, a decision of the person's — refused, naming
 * the flag, where it is not.
 * @param {UnitView} view @param {string} unit @param {string} flag @param {string|undefined} given
 * @param {'finding'|'decision'|'question'} kind @param {{person?: boolean}} [opts]
 * @returns {string}
 */
function pointedAt({ folded, entries, short }, unit, flag, given, kind, { person = false } = {}) {
  if (typeof given !== 'string' || given === '') throw new Error(`${SAID}: --${flag} names ${KIND_WORDS[kind]} of ${unit}'s, by its id`);
  let id;
  try {
    id = resolveId(given, folded.facts.keys());
  } catch (err) {
    throw new Error(`${SAID}: --${flag}: ${messageOf(err)}`);
  }
  const named = `--${flag} names ${short(id)}`;
  if (factsOf(folded, id).kind !== kind) throw new Error(`${SAID}: ${named}, which is not ${KIND_WORDS[kind]}`);
  const not = notCurrent(folded, id);
  if (not !== null) throw new Error(`${SAID}: ${named}, which is no longer current${'replaced_by' in not ? ` — ${short(not.replaced_by)} replaced it` : ''}`);
  const entry = entries.get(id);
  if (entry === undefined || entry.stands.unit !== unit) throw new Error(`${SAID}: ${named}, which stands in ${standingOf(folded, id).unit}, not ${unit}`);
  if (person && claudesCall({ by: /** @type {string} */ (entry.line.by), given: /** @type {string} */ (entry.line.given) })) {
    throw new Error(`${SAID}: ${named}, a call of Claude's — a hypothesis is intended on the person's ruling`);
  }
  return id;
}

/** The words of the unit's current entry `id`, on one line. @param {UnitView} view @param {string} id */
const wordsOf = ({ entries }, id) => String(/** @type {import('./unit-entries.cjs').UnitEntry} */ (entries.get(id)).line.text).replace(/\s+/g, ' ').trim();

/**
 * Why the root cause points at no current entry, or null where it does.
 * @param {UnitView} view @param {Hunt} hunt @returns {string|null}
 */
function rootCauseFault({ entries }, hunt) {
  if (hunt.rootCause === null) return 'no root cause is logged';
  return entries.has(hunt.rootCause.entry) ? null : 'the root cause logged points at no current entry';
}

/**
 * What a call gives an entry: the unit, the positionals after it, its
 * flags, the hunt so far, and the unit's entries.
 * @typedef {{unit: string, positional: string[], opts: Record<string, string>, hunt: Hunt, view: () => UnitView}} Given
 */

/**
 * A form of an entry's call: its usage after `investigation-log`, the
 * positionals it takes after the unit, its flags and those it may be given,
 * and its line from what it is given, refused where one does not hold.
 * @typedef {{usage: string, takes: number, flags: string[], may: string[], line: (given: Given) => string}} Form
 */

/** The `--state` a hypothesis's call gives and its `--by`, refused where they do not hold together. @param {Given} given */
function stateOf({ unit, opts, view }) {
  const state = opts.state ?? 'suspected';
  if (!Object.hasOwn(STATES, state)) throw new Error(`${SAID}: --state is ${Object.keys(STATES).join(', ')}, not "${state}"`);
  if (state !== INTENDED && opts.by !== undefined) throw new Error(`${SAID}: --by names the person's ruling an intended hypothesis rests on — a ${stateWords(state)} one takes none`);
  if (state !== INTENDED) return stateWords(state);
  if (opts.by === undefined) throw new Error(`${SAID}: an intended hypothesis rests on the person's ruling — name it: --by <decision>`);
  return `${INTENDED} [${pointedAt(view(), unit, 'by', opts.by, 'decision', { person: true })}]`;
}

const BODY = 'body';

/** Each kind of entry: its heading and its forms. @type {Readonly<Record<string, {heading: string, forms: Form[]}>>} */
const ENTRIES = Object.freeze({
  symptom: {
    heading: HUNT_HEADINGS.symptoms,
    forms: [{ usage: 'symptom <bugfix> --text "<the person\'s words>"', takes: 0, flags: ['text'], may: [BODY], line: ({ opts }) => oneLine(opts.text, 'text') }],
  },
  hypothesis: {
    heading: HUNT_HEADINGS.hypotheses,
    forms: [
      {
        usage: `hypothesis <bugfix> --title "<title>" [--state ${Object.keys(STATES).join('|')}] [--by <decision>]`,
        takes: 0,
        flags: ['title'],
        may: ['state', 'by', BODY],
        line: (given) => {
          const title = unbroken(oneLine(given.opts.title, 'title'), 'title', [DOT]);
          const next = Math.max(0, ...given.hunt.hypotheses.map(({ name }) => Number(name.slice(1)))) + 1;
          return `H${next}${DOT}${title}${DOT}${stateOf(given)}`;
        },
      },
      {
        usage: `hypothesis <bugfix> H<n> --state ${Object.keys(STATES).join('|')} [--by <decision>]`,
        takes: 1,
        flags: ['state'],
        may: ['by', BODY],
        line: (given) => {
          const [name] = given.positional;
          const held = HYPOTHESIS_NAME.test(name) ? given.hunt.hypotheses.find((hypothesis) => hypothesis.name === name) : undefined;
          if (held === undefined) throw new Error(`${SAID}: the log holds no hypothesis "${name}" — a new one is logged with --title`);
          return `${name}${DOT}${held.title}${DOT}${stateOf(given)}`;
        },
      },
    ],
  },
  experiment: {
    heading: HUNT_HEADINGS.experiments,
    forms: [{
      usage: 'experiment <bugfix> --title "<title>" --showed "<what it showed>" --entry <finding>',
      takes: 0,
      flags: ['title', 'showed', 'entry'],
      may: [BODY],
      line: ({ unit, opts, hunt, view }) => {
        const title = unbroken(oneLine(opts.title, 'title'), 'title', [DOT, DASH]);
        const showed = oneLine(opts.showed, 'showed');
        return `E${hunt.experiments.length + 1}${DOT}${title}${DASH}${showed} [${pointedAt(view(), unit, 'entry', opts.entry, 'finding')}]`;
      },
    }],
  },
  'root-cause': {
    heading: HUNT_HEADINGS.rootCause,
    forms: [{
      usage: 'root-cause <bugfix> --entry <decision>',
      takes: 0,
      flags: ['entry'],
      may: [BODY],
      line: ({ unit, opts, view }) => {
        const id = pointedAt(view(), unit, 'entry', opts.entry, 'decision');
        return `${wordsOf(view(), id)} [${id}]`;
      },
    }],
  },
  validation: {
    heading: HUNT_HEADINGS.validation,
    forms: [{
      usage: `validation <bugfix> ${Object.keys(VALIDATIONS).join('|')} --found "<what it found>" --did "<what Claude did with it>"`,
      takes: 1,
      flags: ['found', 'did'],
      may: [BODY],
      line: ({ positional: [which], opts }) => {
        if (!Object.hasOwn(VALIDATIONS, which)) throw new Error(`${SAID}: a validation is the ${Object.keys(VALIDATIONS).join(' or the ')} one, not "${which}"`);
        const found = unbroken(oneLine(opts.found, 'found'), 'found', [DASH]);
        return `${VALIDATIONS[/** @type {keyof typeof VALIDATIONS} */ (which)]}${DOT}${found}${DASH}${oneLine(opts.did, 'did')}`;
      },
    }],
  },
  'fix-direction': {
    heading: HUNT_HEADINGS.fixDirection,
    forms: [{
      usage: 'fix-direction <bugfix> --question <question>',
      takes: 0,
      flags: ['question'],
      may: [BODY],
      line: ({ unit, opts, hunt, view }) => {
        const fault = rootCauseFault(view(), hunt);
        if (fault !== null) throw new Error(`${SAID}: the fix direction comes after the root cause, and ${fault} — log it first: engine investigation-log root-cause ${unit} --entry <decision>`);
        const id = pointedAt(view(), unit, 'question', opts.question, 'question');
        return `${wordsOf(view(), id)} [${id}]`;
      },
    }],
  },
});

const HUNT_USAGE = Object.values(ENTRIES)
  .flatMap(({ forms }) => forms.map(({ usage }) => `${SAID} ${usage} [--${BODY} <file>]`)).join('\n');

/**
 * The form a call takes, picked by how many positionals it gives, refused
 * with the kind's usage where none fits it.
 * @param {{forms: Form[]}} entry @param {string[]} positional @param {Record<string, string>} opts @returns {Form}
 */
function formOf({ forms }, positional, opts) {
  const given = Object.keys(opts);
  const form = forms.find(({ takes }) => positional.length === takes + 1);
  if (form === undefined || !form.flags.every((flag) => given.includes(flag)) || !given.every((flag) => form.flags.includes(flag) || form.may.includes(flag))) {
    throw new Error(`Usage: engine ${forms.map(({ usage }) => `${SAID} ${usage} [--${BODY} <file>]`).join('\n')}`);
  }
  return form;
}

/**
 * The lines of the body `file` names, read from `cwd`: none where none is
 * named; refused where it cannot be read, holds nothing, or holds a blank
 * line, which would end it.
 * @param {string} cwd @param {string|undefined} file @returns {string[]}
 */
function bodyOf(cwd, file) {
  if (file === undefined) return [];
  let text;
  try {
    text = fs.readFileSync(path.resolve(cwd, file), 'utf8');
  } catch (err) {
    throw new Error(`${SAID}: --${BODY} ${file} cannot be read — ${messageOf(err)}`);
  }
  const lines = text.replace(/\s+$/, '').split(/\r\n?|\n/).map((line) => line.trimEnd());
  if (lines.every((line) => line === '')) throw new Error(`${SAID}: --${BODY} ${file} holds nothing`);
  if (lines.some((line) => line === '')) throw new Error(`${SAID}: --${BODY} ${file} holds a blank line, which would end the body beneath its entry — join its paragraphs`);
  return lines;
}

/**
 * `investigation-log <kind> <bugfix> …` (the header's): the entry's line,
 * and its body where one is given, put in the bugfix's log. Answers the
 * log, from the state root, the heading and the line, and what the
 * ledger's read said on the way.
 * @param {string} cwd @param {string|undefined} kind @param {string[]} positional @param {Record<string, string>} opts
 */
function logHunt(cwd, kind, positional, opts) {
  if (kind === undefined || !Object.hasOwn(ENTRIES, kind)) throw new Error(`Usage: engine ${SAID} <${Object.keys(ENTRIES).join('|')}> …\n${HUNT_USAGE}`);
  const entry = ENTRIES[kind];
  const form = formOf(entry, positional, opts);
  const [unit, ...rest] = positional;
  openInvestigation(cwd, unit, SAID);
  /** @type {string[]} */
  const warnings = [];
  const text = huntText(cwd, unit);
  const hunt = huntIn(text, huntLog(unit), []);
  /** @type {UnitView|null} */
  let read = null;
  const { [BODY]: file, ...flags } = opts;
  const view = () => {
    read ??= withUnitEntries(cwd, unit, warnings, (unitView) => unitView);
    return /** @type {UnitView} */ (read);
  };
  const line = form.line({ unit, positional: rest, opts: flags, hunt, view });
  const body = bodyOf(cwd, file);
  const log = statePath(cwd, huntLog(unit));
  fs.mkdirSync(path.dirname(log), { recursive: true });
  fs.writeFileSync(log, withEntry(text, HEADINGS, entry.heading, line, body));
  return { log: huntLog(unit), heading: entry.heading, line: `- ${line}`, ...(warnings.length > 0 ? { warnings } : {}) };
}

module.exports = { HUNT_USAGE, HUNT_HEADINGS, huntIn, huntOf, huntLog, openInvestigation, logHunt };
