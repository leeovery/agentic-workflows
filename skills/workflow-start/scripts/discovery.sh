#!/bin/bash
#
# Workflow discovery for /workflow-start.
#
# Queries the manifest CLI to enumerate all active work units, grouped by work_type:
# - epic: phase-centric, multi-session, long-running
# - features: single-session, topic-centric
# - bugfixes: investigation-centric, single-session
#
# Outputs structured YAML that the skill can consume directly.
#

set -eo pipefail

MANIFEST_CLI="node .claude/skills/workflow-manifest/scripts/manifest.js"

# Fetch all active work units as JSON array
json=$($MANIFEST_CLI list --status active 2>/dev/null || echo '[]')

echo "# Workflow Discovery (Unified Entry Point)"
echo "# Generated: $(date -Iseconds)"
echo ""

# Single node invocation: group by work_type, compute phase state, emit YAML
node -e "
  const manifests = JSON.parse(process.argv[1]);
  const epics = manifests.filter(m => m.work_type === 'epic');
  const features = manifests.filter(m => m.work_type === 'feature');
  const bugfixes = manifests.filter(m => m.work_type === 'bugfix');

  const ps = (m, phase) => ((m.phases || {})[phase] || {}).status || null;

  function computePhaseState(m) {
    if (ps(m, 'review') === 'completed') return { next_phase: 'done', phase_label: 'pipeline complete' };
    if (ps(m, 'review') === 'in-progress') return { next_phase: 'review', phase_label: 'review (in-progress)' };
    if (ps(m, 'implementation') === 'completed') return { next_phase: 'review', phase_label: 'ready for review' };
    if (ps(m, 'implementation') === 'in-progress') return { next_phase: 'implementation', phase_label: 'implementation (in-progress)' };
    if (ps(m, 'planning') === 'concluded') return { next_phase: 'implementation', phase_label: 'ready for implementation' };
    if (ps(m, 'planning') === 'in-progress') return { next_phase: 'planning', phase_label: 'planning (in-progress)' };
    if (ps(m, 'specification') === 'concluded') return { next_phase: 'planning', phase_label: 'ready for planning' };
    if (ps(m, 'specification') === 'in-progress') return { next_phase: 'specification', phase_label: 'specification (in-progress)' };

    if (m.work_type === 'bugfix') {
      if (ps(m, 'investigation') === 'concluded') return { next_phase: 'specification', phase_label: 'ready for specification' };
      if (ps(m, 'investigation') === 'in-progress') return { next_phase: 'investigation', phase_label: 'investigation (in-progress)' };
      return { next_phase: 'investigation', phase_label: 'ready for investigation' };
    }

    if (ps(m, 'discussion') === 'concluded') return { next_phase: 'specification', phase_label: 'ready for specification' };
    if (ps(m, 'discussion') === 'in-progress') return { next_phase: 'discussion', phase_label: 'discussion (in-progress)' };

    if (m.work_type === 'epic') {
      if (ps(m, 'research') === 'concluded') return { next_phase: 'discussion', phase_label: 'ready for discussion' };
      if (ps(m, 'research') === 'in-progress') return { next_phase: 'research', phase_label: 'research (in-progress)' };
      return { next_phase: 'research', phase_label: 'ready for research' };
    }

    return { next_phase: 'discussion', phase_label: 'ready for discussion' };
  }

  function emitUnit(m, phaseKeys) {
    const state = computePhaseState(m);
    console.log('    - name: \"' + m.name + '\"');
    console.log('      next_phase: \"' + state.next_phase + '\"');
    console.log('      phase_label: \"' + state.phase_label + '\"');
    for (const k of phaseKeys) {
      console.log('      ' + k + ': \"' + (ps(m, k) || 'none') + '\"');
    }
  }

  function emitSection(label, key, units, phaseKeys) {
    console.log(label + ':');
    if (units.length === 0) {
      console.log('  ' + key + ': []');
    } else {
      console.log('  ' + key + ':');
      for (const m of units) emitUnit(m, phaseKeys);
    }
    console.log('  count: ' + units.length);
    console.log('');
  }

  emitSection('epic', 'work_units', epics,
    ['research', 'discussion', 'specification', 'planning', 'implementation', 'review']);
  emitSection('features', 'topics', features,
    ['discussion', 'specification', 'planning', 'implementation', 'review']);
  emitSection('bugfixes', 'topics', bugfixes,
    ['investigation', 'specification', 'planning', 'implementation', 'review']);

  console.log('state:');
  console.log('  has_any_work: ' + (manifests.length > 0));
  console.log('  epic_count: ' + epics.length);
  console.log('  feature_count: ' + features.length);
  console.log('  bugfix_count: ' + bugfixes.length);
" "$json"
