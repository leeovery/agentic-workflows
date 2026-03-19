'use strict';

const fs = require('fs');
const path = require('path');
const { loadActiveManifests, loadAllManifests, phaseStatus, phaseItems, computeNextPhase } = require('../../workflow-shared/scripts/discovery-utils');

const EPIC_PHASES = ['research', 'discussion', 'specification', 'planning', 'implementation', 'review'];

const ALL_PHASES = ['research', 'discussion', 'investigation', 'specification', 'planning', 'implementation', 'review'];

function lastCompletedPhase(manifest) {
  let last = null;
  if (manifest.work_type === 'epic') {
    for (const phase of ALL_PHASES) {
      const items = phaseItems(manifest, phase);
      if (items.length > 0 && items.some(i => i.status === 'completed')) {
        last = phase;
      }
    }
  } else {
    for (const phase of ALL_PHASES) {
      const s = phaseStatus(manifest, phase);
      if (s === 'completed') last = phase;
    }
  }
  return last;
}

function readTitle(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function parseInboxFile(filename) {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})--(.+)\.md$/);
  if (!match) return null;
  return { date: match[1], slug: match[2] };
}

function discoverInbox(cwd) {
  const inboxDir = path.join(cwd, '.workflows', 'inbox');
  const ideas = [];
  const bugs = [];

  for (const type of ['ideas', 'bugs']) {
    const dir = path.join(inboxDir, type);
    let files;
    try {
      files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();
    } catch {
      files = [];
    }
    for (const f of files) {
      const parsed = parseInboxFile(f);
      if (!parsed) continue;
      const title = readTitle(path.join(dir, f)) || parsed.slug;
      const item = { slug: parsed.slug, date: parsed.date, title, file: f };
      if (type === 'ideas') ideas.push(item);
      else bugs.push(item);
    }
  }

  return {
    ideas,
    bugs,
    idea_count: ideas.length,
    bug_count: bugs.length,
    total_count: ideas.length + bugs.length,
  };
}

function discover(cwd) {
  const manifests = loadActiveManifests(cwd);
  const epics = [];
  const features = [];
  const bugfixes = [];

  for (const m of manifests) {
    const state = computeNextPhase(m);
    if (state.next_phase === 'done') continue;

    const unit = {
      name: m.name,
      next_phase: state.next_phase,
      phase_label: state.phase_label,
    };

    if (m.work_type === 'epic') {
      // For epics, include list of phases that have items or status
      const activePhases = [];
      for (const phase of EPIC_PHASES) {
        const items = phaseItems(m, phase);
        if (items.length > 0) {
          activePhases.push(phase);
        }
      }
      unit.active_phases = activePhases;
      epics.push(unit);
    } else if (m.work_type === 'bugfix') {
      bugfixes.push(unit);
    } else {
      features.push(unit);
    }
  }

  // Load completed/cancelled work units across all types
  const allManifests = loadAllManifests(cwd);
  const completed = [];
  const cancelled = [];

  for (const m of allManifests) {
    if (m.status === 'completed') {
      completed.push({ name: m.name, work_type: m.work_type, status: m.status, last_phase: lastCompletedPhase(m) });
    } else if (m.status === 'cancelled') {
      cancelled.push({ name: m.name, work_type: m.work_type, status: m.status, last_phase: lastCompletedPhase(m) });
    }
  }

  const inbox = discoverInbox(cwd);

  return {
    epics: { work_units: epics, count: epics.length },
    features: { work_units: features, count: features.length },
    bugfixes: { work_units: bugfixes, count: bugfixes.length },
    completed,
    cancelled,
    completed_count: completed.length,
    cancelled_count: cancelled.length,
    inbox,
    state: {
      has_any_work: (epics.length + features.length + bugfixes.length) > 0,
      epic_count: epics.length,
      feature_count: features.length,
      bugfix_count: bugfixes.length,
      has_inbox: inbox.total_count > 0,
      inbox_count: inbox.total_count,
    },
  };
}

function format(result) {
  const lines = [];

  function emitSection(label, items) {
    lines.push(`=== ${label.toUpperCase()} ===`);
    if (items.length === 0) {
      lines.push('  (none)');
    }
    for (const u of items) {
      if (u.active_phases) {
        lines.push(`  ${u.name} (${u.active_phases.join(', ')})`);
      } else {
        lines.push(`  ${u.name} (${u.phase_label})`);
      }
    }
    lines.push('');
  }

  emitSection('epics', result.epics.work_units);
  emitSection('features', result.features.work_units);
  emitSection('bugfixes', result.bugfixes.work_units);

  if (result.completed.length > 0) {
    lines.push('=== COMPLETED ===');
    for (const u of result.completed) {
      lines.push(`  ${u.name} (${u.work_type}, last phase: ${u.last_phase || 'none'})`);
    }
    lines.push('');
  }

  if (result.cancelled.length > 0) {
    lines.push('=== CANCELLED ===');
    for (const u of result.cancelled) {
      lines.push(`  ${u.name} (${u.work_type}, last phase: ${u.last_phase || 'none'})`);
    }
    lines.push('');
  }

  if (result.inbox.total_count > 0) {
    lines.push('=== INBOX ===');
    lines.push(`  ideas: ${result.inbox.idea_count}`);
    lines.push(`  bugs: ${result.inbox.bug_count}`);
    for (const item of result.inbox.ideas) {
      lines.push(`  ${item.slug} (idea, ${item.date})`);
    }
    for (const item of result.inbox.bugs) {
      lines.push(`  ${item.slug} (bug, ${item.date})`);
    }
    lines.push('');
  }

  lines.push('=== STATE ===');
  lines.push(`has_any_work: ${result.state.has_any_work}`);
  lines.push(`counts: ${result.state.epic_count} epic, ${result.state.feature_count} feature, ${result.state.bugfix_count} bugfix`);
  lines.push(`completed_count: ${result.completed_count}`);
  lines.push(`cancelled_count: ${result.cancelled_count}`);
  lines.push(`has_inbox: ${result.state.has_inbox}`);
  lines.push(`inbox_count: ${result.state.inbox_count}`);

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  process.stdout.write(format(discover(process.cwd())));
}

module.exports = { discover, format };
