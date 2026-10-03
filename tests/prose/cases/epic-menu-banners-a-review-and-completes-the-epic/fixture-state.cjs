'use strict';

// The epic's last review has just concluded: both discussed topics are
// specified, planned, implemented and reviewed, and the third topic was
// cancelled before it started. The handoff lands the work on the epic menu
// with the review's outcome — the banner says what concluded, and the
// scoped state reads all done, so the menu offers to complete the epic.

const e = require('../../mainlines/epic.cjs');
const WU = e.WU;
const DELIVERED = ['behavioural-ranking', 'synonym-handling'];

function deliver(h, topic) {
  h.engine('topic', 'start', WU, 'specification', topic);
  h.engine('manifest', 'set', `${WU}.specification.${topic}`, `sources.${topic}.status`, 'incorporated');
  h.write(`.workflows/${WU}/specification/${topic}/specification.md`,
    `# Specification: ${topic}\n\n## Overview\n\nWhat the ${topic} discussion decided.\n`);
  h.engine('commit', WU, '-m', `spec(${WU}): ${topic} specification`);
  h.engine('topic', 'complete', WU, 'specification', topic);
  h.engine('commit', WU, '-m', `spec(${WU}): complete ${topic} specification`);
}

function build(h, topic) {
  const task = `${topic}-1-1`;
  h.engine('topic', 'start', WU, 'planning', topic);
  h.write(`.workflows/${WU}/planning/${topic}/planning.md`, `# Plan: ${topic}\n\nOne phase, one task.\n`);
  h.engine('manifest', 'set', `${WU}.planning.${topic}`,
    'format=local-markdown', `task_map.${task}=${task}`, 'storage_paths=[]');
  h.engine('commit', WU, '-m', `plan(${WU}): ${topic} plan`);
  h.engine('topic', 'complete', WU, 'planning', topic);
  h.engine('commit', WU, '-m', `plan(${WU}): complete ${topic} plan`);

  h.engine('task', 'init', WU, topic);
  h.engine('task', 'start', WU, topic, task);
  h.engine('task', 'complete', WU, topic, task, '--phase', '1', '--next-task', '~');
  h.engine('manifest', 'push', `${WU}.implementation.${topic}`, 'consolidated_phases', '1');
  h.engine('task', 'complete', WU, topic, task, '--phase', '1', '--phase-complete');
  h.engine('topic', 'complete', WU, 'implementation', topic);
  h.engine('commit', WU, '-m', `impl(${WU}): complete ${topic} implementation`);

  h.engine('topic', 'start', WU, 'review', topic);
  h.write(`.workflows/${WU}/review/${topic}/report.md`, `# Review: ${topic}\n\nVerdict: pass.\n`);
  h.engine('topic', 'complete', WU, 'review', topic);
  h.engine('commit', WU, '-m', `review(${WU}): complete ${topic} review`);
}

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);
    h.engine('topic', 'cancel', WU, 'discovery', 'relevance-measurement');

    for (const topic of DELIVERED) deliver(h, topic);
    h.engine('build-order', 'sequence', WU, 'behavioural-ranking=1', 'synonym-handling=2');
    for (const topic of DELIVERED) build(h, topic);
  },
};
