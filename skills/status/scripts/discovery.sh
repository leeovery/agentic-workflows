#!/bin/bash
#
# Discovers the full workflow state across all work units
# for the /status command.
#
# Uses manifest CLI to read work unit state.
# Outputs structured YAML that the command can consume directly.
#

set -eo pipefail

MANIFEST_CLI="node .claude/skills/workflow-manifest/scripts/manifest.js"
WORKFLOWS_DIR=".workflows"

# Start YAML output
echo "# Workflow Status Discovery"
echo "# Generated: $(date -Iseconds)"
echo ""

#
# GET ALL ACTIVE WORK UNITS
#
active_json=$($MANIFEST_CLI list --status active 2>/dev/null || echo "[]")
unit_count=$(echo "$active_json" | node -e "
const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
process.stdout.write(String(d.length));
")

if [ "$unit_count" -eq 0 ]; then
    echo "work_units: []"
    echo ""
    echo "state:"
    echo "  has_any_work: false"
    exit 0
fi

#
# OUTPUT PER-UNIT DETAILS
#
echo "work_units:"

echo "$active_json" | node -e "
const units = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const fs = require('fs');
const path = require('path');

for (const u of units) {
    const name = u.name;
    const workType = u.work_type || 'feature';
    const phases = u.phases || {};
    const baseDir = path.join('.workflows', name);

    console.log('  - name: \"' + name + '\"');
    console.log('    work_type: \"' + workType + '\"');
    console.log('    description: \"' + (u.description || '').replace(/\"/g, '\\\\\"') + '\"');

    // --- Research ---
    const research = phases.research || {};
    const researchStatus = research.status || null;
    console.log('    research:');
    if (researchStatus) {
        console.log('      status: \"' + researchStatus + '\"');
        // Count research files
        const researchDir = path.join(baseDir, 'research');
        let researchFiles = [];
        try {
            researchFiles = fs.readdirSync(researchDir).filter(f => f.endsWith('.md'));
        } catch (_) {}
        console.log('      file_count: ' + researchFiles.length);
    } else {
        console.log('      status: ~');
    }

    // --- Discussion ---
    const discussion = phases.discussion || {};
    const discStatus = discussion.status || null;
    console.log('    discussion:');
    if (discStatus) {
        console.log('      status: \"' + discStatus + '\"');
    } else {
        console.log('      status: ~');
    }

    // --- Investigation ---
    const investigation = phases.investigation || {};
    const invStatus = investigation.status || null;
    console.log('    investigation:');
    if (invStatus) {
        console.log('      status: \"' + invStatus + '\"');
    } else {
        console.log('      status: ~');
    }

    // --- Specification ---
    const spec = phases.specification || {};
    const specStatus = spec.status || null;
    const specType = spec.type || 'feature';
    const supersededBy = spec.superseded_by || null;
    console.log('    specification:');
    if (specStatus) {
        console.log('      status: \"' + specStatus + '\"');
        console.log('      type: \"' + specType + '\"');
        if (supersededBy) {
            console.log('      superseded_by: \"' + supersededBy + '\"');
        }
        // Read sources from manifest
        const sources = Array.isArray(spec.sources) ? spec.sources : [];
        if (sources.length > 0) {
            console.log('      sources:');
            for (const s of sources) {
                console.log('        - name: \"' + s.name + '\"');
                console.log('          status: \"' + s.status + '\"');
            }
        } else {
            console.log('      sources: []');
        }
    } else {
        console.log('      status: ~');
    }

    // --- Planning ---
    const planning = phases.planning || {};
    const planStatus = planning.status || null;
    const planFormat = planning.format || null;
    console.log('    planning:');
    if (planStatus) {
        console.log('      status: \"' + planStatus + '\"');
        if (planFormat) {
            console.log('      format: \"' + planFormat + '\"');
        }
        // Read external_dependencies from manifest
        const deps = Array.isArray(planning.external_dependencies) ? planning.external_dependencies : [];
        const hasUnresolved = deps.some(d => d.state === 'unresolved');
        if (deps.length > 0) {
            console.log('      external_deps:');
            for (const d of deps) {
                console.log('        - topic: \"' + d.topic + '\"');
                console.log('          state: \"' + d.state + '\"');
                if (d.task_id) console.log('          task_id: \"' + d.task_id + '\"');
            }
        } else {
            console.log('      external_deps: []');
        }
        console.log('      has_unresolved_deps: ' + hasUnresolved);
    } else {
        console.log('      status: ~');
    }

    // --- Implementation ---
    const impl = phases.implementation || {};
    const implStatus = impl.status || null;
    const currentPhase = impl.current_phase || null;
    console.log('    implementation:');
    if (implStatus) {
        console.log('      status: \"' + implStatus + '\"');
        if (currentPhase && currentPhase !== '~') {
            console.log('      current_phase: ' + currentPhase);
        }
        // Count completed tasks from implementation.md frontmatter
        const implFile = path.join(baseDir, 'implementation', 'implementation.md');
        let completedTasks = 0;
        try {
            const content = fs.readFileSync(implFile, 'utf8');
            const fmMatch = content.match(/^---\\n([\\s\\S]*?)\\n---/);
            if (fmMatch) {
                const fm = fmMatch[1];
                const ctMatch = fm.match(/^completed_tasks:\\s*\\n((?:\\s+- [\\s\\S]*?)(?=\\n[a-z_]+:|$))/m);
                if (ctMatch) {
                    completedTasks = (ctMatch[1].match(/^\\s+- /gm) || []).length;
                }
                // Handle inline array: completed_tasks: [t1, t2]
                const inlineMatch = fm.match(/^completed_tasks:\\s*\\[([^\\]]*)\\]/m);
                if (inlineMatch && inlineMatch[1].trim()) {
                    completedTasks = inlineMatch[1].split(',').length;
                }
            }
        } catch (_) {}
        // Count total tasks from plan task files (local-markdown format)
        let totalTasks = 0;
        const planFmt = (phases.planning || {}).format || (phases.implementation || {}).format;
        if (planFmt === 'local-markdown') {
            const tasksDir = path.join(baseDir, 'planning', 'tasks');
            try {
                totalTasks = fs.readdirSync(tasksDir).filter(f => f.endsWith('.md')).length;
            } catch (_) {}
        }
        console.log('      completed_tasks: ' + completedTasks);
        console.log('      total_tasks: ' + totalTasks);
    } else {
        console.log('      status: ~');
    }

    // --- Review ---
    const review = phases.review || {};
    const reviewStatus = review.status || null;
    console.log('    review:');
    if (reviewStatus) {
        console.log('      status: \"' + reviewStatus + '\"');
    } else {
        console.log('      status: ~');
    }

    console.log('');
}
"

#
# AGGREGATED COUNTS
#
echo "$active_json" | node -e "
const units = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));

// Group by work_type
const counts = { epic: 0, feature: 0, bugfix: 0 };
let researchCount = 0;
let discCount = 0, discConcluded = 0, discInProgress = 0;
let specActive = 0, specFeature = 0, specCrosscutting = 0;
let planCount = 0, planConcluded = 0, planInProgress = 0;
let implCount = 0, implCompleted = 0, implInProgress = 0;

for (const u of units) {
    const wt = u.work_type || 'feature';
    if (counts[wt] !== undefined) counts[wt]++;

    const phases = u.phases || {};

    if (phases.research && phases.research.status) researchCount++;

    if (phases.discussion && phases.discussion.status) {
        discCount++;
        if (phases.discussion.status === 'concluded') discConcluded++;
        if (phases.discussion.status === 'in-progress') discInProgress++;
    }

    if (phases.specification && phases.specification.status && phases.specification.status !== 'superseded') {
        specActive++;
        const st = (phases.specification || {}).type || 'feature';
        if (st === 'cross-cutting') specCrosscutting++;
        else specFeature++;
    }

    if (phases.planning && phases.planning.status) {
        planCount++;
        if (phases.planning.status === 'concluded') planConcluded++;
        if (phases.planning.status === 'in-progress') planInProgress++;
    }

    if (phases.implementation && phases.implementation.status) {
        implCount++;
        if (phases.implementation.status === 'completed') implCompleted++;
        if (phases.implementation.status === 'in-progress') implInProgress++;
    }
}

console.log('counts:');
console.log('  by_work_type:');
console.log('    epic: ' + counts.epic);
console.log('    feature: ' + counts.feature);
console.log('    bugfix: ' + counts.bugfix);
console.log('  research: ' + researchCount);
console.log('  discussion:');
console.log('    total: ' + discCount);
console.log('    concluded: ' + discConcluded);
console.log('    in_progress: ' + discInProgress);
console.log('  specification:');
console.log('    active: ' + specActive);
console.log('    feature: ' + specFeature);
console.log('    crosscutting: ' + specCrosscutting);
console.log('  planning:');
console.log('    total: ' + planCount);
console.log('    concluded: ' + planConcluded);
console.log('    in_progress: ' + planInProgress);
console.log('  implementation:');
console.log('    total: ' + implCount);
console.log('    completed: ' + implCompleted);
console.log('    in_progress: ' + implInProgress);
console.log('');
console.log('state:');
console.log('  has_any_work: true');
"
