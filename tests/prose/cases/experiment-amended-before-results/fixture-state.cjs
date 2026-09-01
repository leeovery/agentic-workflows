'use strict';

// The harvested epic with E1 running and NOTHING measured: the design
// froze at the briefing, measurement was recorded as begun, and no report
// exists. The world the amendment boundary's near side needs — the design
// can still change, but only as a dated amendment re-presented for the
// explicit go; a declined one is struck and the design holds as approved.

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
      'What replaces the hand-maintained synonym and misspelling list.',
      'The choice between a curated managed list and behaviour-driven',
      'expansion turns on the in-session recovery share of zero-result',
      'searches — handed to the laboratory 2026-01-01, awaiting E1.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '--topic', `research/${TOPIC}`, '-m',
      `research(${WU}/${TOPIC}): the open recovery number`);

    h.write(`.workflows/.cache/${WU}/research/${TOPIC}/problem.md`, [
      '# E1: Reformulation Recovery',
      '',
      'We need to learn what share of zero-result searches recover',
      'because the searcher reformulates within the same session — the',
      'replacement-source choice turns on it. A day of sandbox activity',
      'is exported at logs/search-sessions.log.',
      '',
      'Spawned from the "synonym-handling" research, at the replacement-',
      'source choice, on 2026-01-01.',
      '',
    ].join('\n'));
    const created = JSON.parse(h.engine('experiment', 'create', WU, TOPIC, '--slug', SLUG, '--from', 'research',
      '--problem', `.workflows/.cache/${WU}/research/${TOPIC}/problem.md`));
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
      'zero-result sessions): count sessions whose zero-result query is',
      'followed, in the same session, by a query with results and a',
      'click. Instruments: grep/awk over the committed log.',
      '',
    ].join('\n'));
    h.engine('experiment', 'advance', WU, TOPIC, 'E1');
    h.engine('commit', WU, '--topic', `experiment/${TOPIC}`, '-m',
      `experiment(${WU}/${TOPIC}): E1 designed`);
    h.engine('experiment', 'approve', WU, TOPIC, 'E1');
    h.engine('commit', WU, '--topic', `experiment/${TOPIC}`, '-m',
      `experiment(${WU}/${TOPIC}): E1 approved — design frozen`);
    h.engine('experiment', 'advance', WU, TOPIC, 'E1');
    h.engine('commit', WU, '--topic', `experiment/${TOPIC}`, '-m',
      `experiment(${WU}/${TOPIC}): E1 — measurement begins`);
  },
};
