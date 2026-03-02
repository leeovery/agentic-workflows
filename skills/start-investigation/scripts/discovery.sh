#!/bin/bash
#
# Discovery script for /start-investigation.
#
# Queries the manifest CLI to find bugfix work units and their
# investigation phase state.
#
# Outputs structured YAML that the skill can consume directly.
#

set -eo pipefail

CLI="node .claude/skills/workflow-manifest/scripts/manifest.js"

# Fetch all active work units as JSON array
json=$($CLI list --status active 2>/dev/null || echo '[]')

# Start YAML output
echo "# Start-Investigation Discovery"
echo "# Generated: $(date -Iseconds)"
echo ""

# Parse bugfix work units and emit investigation state
node -e "
  const manifests = JSON.parse(process.argv[1]);
  const bugfixes = manifests.filter(m => m.work_type === 'bugfix');

  const ps = (m, phase) => ((m.phases || {})[phase] || {}).status || null;

  // Filter to those with investigation phase activity or ready for investigation
  const withInvestigation = bugfixes.filter(m => {
    const invStatus = ps(m, 'investigation');
    return invStatus === 'in-progress' || invStatus === 'concluded' || invStatus === null;
  });

  console.log('investigations:');

  const inProgress = withInvestigation.filter(m => ps(m, 'investigation') === 'in-progress');
  const concluded = withInvestigation.filter(m => ps(m, 'investigation') === 'concluded');

  if (withInvestigation.length === 0) {
    console.log('  exists: false');
    console.log('  files: []');
  } else {
    const hasFiles = withInvestigation.filter(m => ps(m, 'investigation') !== null);
    console.log('  exists: ' + (hasFiles.length > 0));
    if (hasFiles.length === 0) {
      console.log('  files: []');
    } else {
      console.log('  files:');
      for (const m of hasFiles) {
        console.log('    - work_unit: \"' + m.name + '\"');
        console.log('      status: \"' + ps(m, 'investigation') + '\"');
        console.log('      work_type: \"bugfix\"');
      }
    }
  }

  console.log('  counts:');
  console.log('    total: ' + withInvestigation.filter(m => ps(m, 'investigation') !== null).length);
  console.log('    in_progress: ' + inProgress.length);
  console.log('    concluded: ' + concluded.length);
  console.log('');

  // State summary
  console.log('state:');
  const hasAny = withInvestigation.filter(m => ps(m, 'investigation') !== null).length > 0;
  if (!hasAny) {
    console.log('  scenario: \"fresh\"');
  } else {
    console.log('  scenario: \"has_investigations\"');
  }
" "$json"
