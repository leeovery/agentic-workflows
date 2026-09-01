'use strict';

// The harvested epic with synonym-handling's research paused on evidence:
// the replacement question narrowed to two candidate sources, the open
// number named, and E1 spawned to measure it — the record conceived, its
// problem statement on disk, the research item holding the wait. The
// sandbox session log is the sample the run will score: forty zero-result
// searches, twelve recovering with a clicked reformulation in-session.

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
      '## Starting Point',
      '',
      'What we knew going in:',
      '- The list is hand-maintained, untrusted, and its upkeep never ends.',
      '- Search runs on Elasticsearch; two engineers own it part-time.',
      '',
      '---',
      '',
      '## Candidate Sources',
      '',
      '**Curated managed list.** A vendor-maintained expansion set swapped',
      'in for the hand-rolled one. Known shape, quick to adopt — and it',
      'recreates the upkeep problem one step removed: someone still owns',
      'the deltas between the vendor vocabulary and the catalogue.',
      '',
      '**Behaviour-driven expansion.** Derive expansions from what',
      'searchers do when a query fails: a zero-result query followed, in',
      'the same session, by a reformulation that returns results and gets',
      'a click is a synonym pair the users themselves supplied. No',
      'curation to own — but it only works if searchers actually recover',
      'this way often enough to feed it.',
      '',
      '## The Open Number',
      '',
      'The choice turns on the in-session recovery share: what fraction of',
      'zero-result searches recover because the searcher reformulates',
      'within the same session. High enough and behaviour-driven expansion',
      'has the signal it needs; low and only a curated source is viable.',
      'A day of sandbox search-session activity is exported at',
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
      'We need to learn what share of zero-result searches recover',
      'because the searcher reformulates within the same session. The',
      'replacement for the hand-maintained synonym list turns on it:',
      'behaviour-driven expansion feeds on exactly those recoveries, so a',
      'meaningful share makes it the leading candidate, and a negligible',
      'one sends the choice to a curated source. We hope the share is',
      'meaningful — the curated route recreates the upkeep problem the',
      'replacement exists to end. A day of sandbox search-session',
      'activity is exported at logs/search-sessions.log.',
      '',
      'Spawned from the "synonym-handling" research, at the replacement-',
      'source choice, on 2026-01-01.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '--topic', `research/${TOPIC}`, '-m',
      `research(${WU}/${TOPIC}): spawn E1 ${SLUG}`);
    h.engine('commit', WU, '--topic', `experiment/${TOPIC}`, '-m',
      `experiment(${WU}/${TOPIC}): E1 problem statement`);
  },
};
