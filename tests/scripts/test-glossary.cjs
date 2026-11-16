'use strict';

// The glossary (23.3): its entries read as a lint over their terms, with the
// lists here. No entry's term names a retired one, in any form; the words
// naming what the release retired appear in no definition; the phases and
// stages are the engine's own (23.S8). Every term 23.3.2 adds has an entry
// that says something, with the trust machinery's own; review is three
// terms, never one (23.S9); the inbox is the place and triage the act, and
// messages between topics are mail (23.S10); the legacy files are named by
// the row the menus draw for them. The answering rule's half of
// 23.S16: the rule loads the glossary from where it lives, at the question,
// answers in the screens' words, says where the glossary stops and points at
// the docs, invents nothing and puts the gate back; and no entry speaks in an
// engine verb, a path or a skill name.
//
// Layer: unit. World: the repository's own files, read.

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { PHASE_STAGES } = require('../../skills/leeway-engine/scripts/kernel/manifest-schema.cjs');

const REFERENCES = path.join(__dirname, '..', '..', 'skills', 'leeway-shared', 'references');
const GLOSSARY = path.join(REFERENCES, 'glossary.md');
const RULE = path.join(REFERENCES, 'answering-how-it-works.md');

/** Each entry: its term, its definition, and the aliases it says to avoid. @param {string} text */
function entriesOf(text) {
  /** @type {{term: string, definition: string, avoid: string}[]} */
  const entries = [];
  for (const block of text.split(/\n{2,}/)) {
    const [head, ...rest] = block.split('\n');
    const term = /^\*\*(.+)\*\*:$/.exec(head)?.[1];
    if (!term) continue;
    const avoid = rest.filter((line) => line.startsWith('_Avoid_:')).join(' ');
    entries.push({ term, definition: rest.filter((line) => !line.startsWith('_Avoid_:')).join(' ').trim(), avoid });
  }
  return entries;
}

/** A term's words, lowercased, each plural made singular, `the` dropped. @param {string} term */
const wordsOf = (term) => term.toLowerCase().split(/[^a-z-]+/).filter((word) => word && word !== 'the').map((word) => word.replace(/s$/, ''));

/** Whether `term` holds `retired`'s words, in order. @param {string} term @param {string} retired */
const holds = (term, retired) => ` ${wordsOf(term).join(' ')} `.includes(` ${wordsOf(retired).join(' ')} `);

/** What a definition says in an engine verb, a path or a skill name. @param {string} definition @returns {string[]} */
const spokenIn = (definition) => [
  ...[...definition.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((code) => !/^(?:[a-z#]\/[a-z]+|\/leeway)$/.test(code)),
  ...(definition.match(/\bleeway-[a-z]|\bworkflow-[a-z]|\bengine [a-z]|\.leeway\/|\.claude\/|~\/|\brefs\/|\bengine\.cjs\b|[\w-]+\.(?:md|json|jsonl|cjs)\b/g) ?? []),
];

const text = fs.readFileSync(GLOSSARY, 'utf8');
const entries = entriesOf(text);
const terms = entries.map(({ term }) => term);
/** An entry by its term, one that says something. @param {string} term */
const entry = (term) => {
  const found = entries.find((e) => e.term === term);
  assert.ok(found?.definition, `the glossary defines "${term}"`);
  return found;
};

/** Retired terms no entry's term holds, in any form. */
const RETIRED = ['scoping', 'planning', 'plan', 'cross-cutting', 'build order', 'dead end', 'document', 'baseline', 'dashboard', 'working set', 'five kinds'];
/** Retired terms no entry's term is, whose words a live term still holds ("research owed", "review phase"). */
const RETIRED_ALONE = ['research', 'review'];
const RETIRED_WORDS = /\b(?:research and discussion|scoping|planning|cross-cutting|build orders?|dead ends?|baselines?|dashboards?|working sets?|small,? mechanical changes?)\b/i;
const ADDED = [
  'discussion', 'record', 'log', 'ledger', 'entry', 'map', 'product record', 'phase cut', 'builder', 'task loop',
  'reviewer pair', 'notes for later', 'stack', 'the ask rule', 'kind', 'verdict', 'blind question', 'auto and step',
  'proven and not proven', 'verify setup', 'feature map', 'driver', 'state branch',
  'convergence', 'care entry', 'the matrix', 'the verdict queue', 'the record of the person',
];

describe('the glossary (23.3)', () => {
  it('reads as entries, each term once, each saying something', () => {
    assert.ok(entries.length > ADDED.length);
    assert.deepStrictEqual(terms.filter((term, i) => terms.indexOf(term) !== i), []);
    assert.deepStrictEqual(entries.filter(({ definition }) => !definition).map(({ term }) => term), []);
  });

  it('23.S8: no entry\'s term names a retired one, and no definition names what the release retired', () => {
    assert.deepStrictEqual(terms.filter((term) => RETIRED.some((retired) => holds(term, retired))
      || RETIRED_ALONE.some((retired) => wordsOf(term).join(' ') === retired)), []);
    assert.deepStrictEqual(entries.filter(({ definition }) => RETIRED_WORDS.test(definition)).map(({ term }) => term), []);
  });

  it('23.S8: the phases and the stages are the engine\'s own', () => {
    const phases = /^[^:]+: ([a-z, ]+)\./.exec(entry('phase').definition)?.[1].split(', ');
    assert.deepStrictEqual(phases?.sort(), Object.keys(PHASE_STAGES).sort());
    const stages = [...entry('stage').definition.matchAll(/\b(Discovery|Definition|Delivery)\b[^(]*\(([^)]+)\)/g)]
      .flatMap(([, stage, listed]) => listed.split(', ').map((phase) => `${phase} ${stage}`));
    assert.deepStrictEqual(stages.sort(), Object.entries(PHASE_STAGES).map(([phase, stage]) => `${phase} ${stage}`).sort());
  });

  it('23.S8: has an entry for every term 23.3.2 adds, and the trust machinery\'s', () => {
    assert.deepStrictEqual(ADDED.filter((term) => !entries.some((e) => e.term === term && e.definition)), []);
  });

  it('23.S8: discussion is the one deciding phase, research one of its tools', () => {
    const { definition, avoid } = entry('discussion');
    assert.match(definition, /\bResearch\b[^.:]*\btools\b/);
    assert.match(avoid, /\bresearch \(as a phase\)/);
  });

  it('23.S9: the review phase, the phase review and the closing pass are each a term of their own', () => {
    for (const term of ['review phase', 'phase review', 'closing pass']) entry(term);
    assert.match(entry('review phase').avoid, /\breview \(alone\b/);
  });

  it('23.S10: the inbox is the place and triage the act on it', () => {
    assert.match(entry('inbox').definition, /^The place\b/);
    assert.match(entry('inbox').avoid, /\btriage \(that is the act\b/);
    assert.match(entry('triage').definition, /^The act of deciding on what waits in the inbox\b/);
    assert.match(entry('triage').avoid, /\bthe inbox \(that is the place\)/);
  });

  it('23.S10: messages between topics are mail, shown as mail waiting, never triage waiting', () => {
    const { definition, avoid } = entry('mail');
    assert.match(definition, /^The messages waiting for\b/);
    assert.match(definition, /\bmail waiting\b/);
    assert.match(avoid, /\btriage waiting\b/);
    assert.match(entry('message').definition, /\bsent to that topic's mail\b/);
    assert.deepStrictEqual(entries.filter(({ term, definition }) => term !== 'mail' && /triage waiting/i.test(definition)), []);
  });

  it('the legacy files are named by the row both menus draw for them', () => {
    const row = /\*([^*]+)\*/.exec(entry('legacy files').definition)?.[1];
    const projections = path.join(__dirname, '..', '..', 'skills', 'leeway-engine', 'scripts', 'domain', 'projections');
    for (const menu of ['start-menu.cjs', 'epic-menu.cjs']) assert.ok(fs.readFileSync(path.join(projections, menu), 'utf8').includes(`head: '${row}'`), `${menu} draws the row as ${row}`);
  });

  it('23.S16: finds an engine verb, a path or a skill name, quoted or not, and passes the keys and the command', () => {
    assert.deepStrictEqual(spokenIn('written by `ledger decide`, by engine ledger decide, through the workflow-start skill or leeway-discussion-process'),
      ['ledger decide', 'engine l', 'workflow-s', 'leeway-d']);
    assert.deepStrictEqual(spokenIn('kept in .leeway/ and ~/.config, under .claude/skills and refs/leeway, by engine.cjs in spec.md'),
      ['.leeway/', '~/', '.claude/', 'refs/', 'engine.cjs', 'spec.md']);
    assert.deepStrictEqual(spokenIn('the `/leeway` command, `n/next`, `h/help`, `#/pick` and the menu waits'), []);
  });

  it('23.S16: no entry speaks in an engine verb, a path or a skill name', () => {
    assert.deepStrictEqual(entries.flatMap(({ term, definition }) => spokenIn(definition).map((said) => `${term}: ${said}`)), []);
  });
});

describe('the answering rule (23.3.5)', () => {
  const rule = fs.readFileSync(RULE, 'utf8');

  it('23.S16: loads the glossary from where it lives, at the question and never ahead of one', () => {
    const link = /^1\. Load \*\*\[glossary\.md\]\(([^)]+)\)\*\*/m.exec(rule)?.[1];
    assert.strictEqual(link && path.join(REFERENCES, link), GLOSSARY);
    assert.match(rule, /^1\. .*\bLoad it at the question, never ahead of one\.$/m);
  });

  it('23.S16: answers in the screens\' words, never engine verbs, paths or skill names', () => {
    assert.match(rule, /\bthe words the person meets on screen — never engine verbs, file paths, or skill names\b/);
  });

  it('23.S16: says where the glossary stops, points at the docs and invents nothing', () => {
    assert.match(rule, /\bWhere the glossary does not cover it, say so plainly and point at the book: https:\/\/github\.com\/[\w-]+\/[\w-]+\/tree\/main\/docs\. Never invent an answer\./);
  });

  it('23.S16: puts back the gate the question set aside', () => {
    assert.match(rule, /\bWhere the person was at a gate, the question set it aside, and it comes back\b/);
  });
});
