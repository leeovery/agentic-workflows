'use strict';

// The harvested epic on the far side of the laboratory: E1 walked design
// → freeze → run → verdict by the engine's own sequence, the report on
// disk in full, the research's wait released and the item flagged
// `reconcile_needed: "experiment"` — the world the return leg re-enters.

const e = require('../../mainlines/epic.cjs');

const WU = e.WU;
const TOPIC = 'synonym-handling';
const SLUG = 'reformulation-recovery';

// 40 zero-result searches across sessions s-1..s-40; sessions s-1..s-12
// recover — a reformulated query in the same session returns results and
// is clicked. 30%, deterministic, countable with grep.
function sessionLog() {
  const lines = [];
  for (let i = 1; i <= 40; i++) {
    const mm = String(i).padStart(2, '0');
    lines.push(`2026-01-01T09:${mm}:10Z s-${i} query="worn brake shoes" results=0 clicked=no`);
    if (i <= 12) {
      lines.push(`2026-01-01T09:${mm}:40Z s-${i} query="brake pads" results=14 clicked=yes`);
    }
  }
  return lines.join('\n') + '\n';
}

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);

    h.write('logs/search-sessions.log', sessionLog());

    h.engine('topic', 'start', WU, 'research', TOPIC);
    h.write(`.workflows/${WU}/research/${TOPIC}.md`, [
      '# Research: Synonym Handling',
      '',
      'What replaces the hand-maintained synonym and misspelling list —',
      'replace-rather-than-clean was settled at shaping; this research',
      'explores what the replacement source could be.',
      '',
      '## Candidate Sources',
      '',
      '**Curated managed list.** Known shape, quick to adopt — and it',
      'recreates the upkeep problem one step removed.',
      '',
      '**Behaviour-driven expansion.** Derive expansions from what',
      'searchers do when a query fails — no curation to own, but it only',
      'works if searchers recover in-session often enough to feed it.',
      '',
      '## The Open Number',
      '',
      'The choice turns on the in-session recovery share of zero-result',
      'searches. A day of sandbox activity is exported at',
      'logs/search-sessions.log.',
      '',
      'Handed to the laboratory 2026-01-01 — awaiting E1; the source',
      'choice waits on its evidence.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '--topic', `research/${TOPIC}`, '-m',
      `research(${WU}/${TOPIC}): candidate sources and the open recovery number`);

    const created = JSON.parse(h.engine('experiment', 'create', WU, TOPIC, '--slug', SLUG, '--from', 'research'));
    h.write(`${created.dir}/problem.md`, [
      '# E1: Reformulation Recovery',
      '',
      'What share of zero-result searches recover because the searcher',
      'reformulates within the same session — the replacement-source',
      'choice turns on it.',
      '',
      'Spawned from the "synonym-handling" research, at the replacement-',
      'source choice, on 2026-01-01.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '--topic', `research/${TOPIC}`, '-m',
      `research(${WU}/${TOPIC}): spawn E1 ${SLUG}`);
    h.engine('commit', WU, '--topic', `experiment/${TOPIC}`, '--sweep', '-m',
      `experiment(${WU}/${TOPIC}): E1 problem statement`);

    h.write(`${created.dir}/design.md`, [
      '# E1: Reformulation Recovery',
      '',
      '## Question',
      '',
      'What share of zero-result searches recover via an in-session',
      'reformulation that returns results and is clicked? Feeds the',
      'replacement-source choice.',
      '',
      '## Prediction',
      '',
      'Meaningful recovery — around a fifth of zero-result searches.',
      '',
      '## Decision rule',
      '',
      'If the recovered share is >= 15%, behaviour-driven expansion is',
      'the leading candidate and the research carries it forward; if',
      '< 15%, the research goes to a curated source.',
      '',
      '## Setup',
      '',
      'One deterministic pass over logs/search-sessions.log (all 40',
      'zero-result sessions). Instruments: grep/awk over the committed',
      'log.',
      '',
    ].join('\n'));
    h.engine('experiment', 'advance', WU, TOPIC, 'E1');
    h.engine('commit', WU, '--topic', `experiment/${TOPIC}`, '-m',
      `experiment(${WU}/${TOPIC}): E1 designed`);
    h.engine('experiment', 'approve', WU, TOPIC, 'E1');
    h.engine('commit', WU, '--topic', `experiment/${TOPIC}`, '-m',
      `experiment(${WU}/${TOPIC}): E1 approved — design frozen`);
    h.engine('experiment', 'advance', WU, TOPIC, 'E1');
    h.write(`${created.dir}/report.md`, [
      '# E1: Reformulation Recovery — Report',
      '',
      '## Results',
      '',
      '12 of 40 zero-result searches recovered via an in-session',
      'reformulation with a click — 30%. Counted with one pass over',
      'logs/search-sessions.log (sessions s-1 through s-40; recoveries',
      's-1 through s-12).',
      '',
      '## Deviations',
      '',
      'None.',
      '',
      '## Reading',
      '',
      'Recovery is common enough to feed behaviour-driven expansion: a',
      'third of failed searches already carry the user-supplied synonym',
      'pair the expansion service would learn from.',
      '',
      '## Conclusion',
      '',
      'The registered rule fires on the >= 15% branch: behaviour-driven',
      'expansion is the leading candidate and the research carries it',
      'forward.',
      '',
      '## Reproduce',
      '',
      'grep the committed log: count sessions with a results=0 line and',
      'a later same-session line with results>0 and clicked=yes.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '--topic', `experiment/${TOPIC}`, '-m',
      `experiment(${WU}/${TOPIC}): E1 — run scored`);
    h.engine('experiment', 'conclude', WU, TOPIC, 'E1', '--verdict',
      '30% in-session recovery — behaviour-driven expansion leads');
    h.engine('commit', WU, '--topic', `experiment/${TOPIC}`, '-m',
      `experiment(${WU}/${TOPIC}): E1 concluded`);
  },
};
