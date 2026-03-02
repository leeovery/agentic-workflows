#!/bin/bash
#
# Discovery script for /workflow-bridge.
#
# Takes a work unit name as argument and outputs its manifest state
# as structured YAML. The SKILL.md consumer uses known work_type
# and work_unit from calling context to route to the correct
# continuation reference.
#
# Usage: discovery.sh <work_unit>
#
# For epic work type, also outputs phase-centric detail.
# For feature/bugfix, outputs the per-phase state with computed next_phase.
#
# Outputs structured YAML that the skill can consume directly.
#

set -eo pipefail

CLI="node .claude/skills/workflow-manifest/scripts/manifest.js"

if [ -z "$1" ]; then
    echo "Error: work unit name required" >&2
    echo "Usage: discovery.sh <work_unit>" >&2
    exit 1
fi

WORK_UNIT="$1"

# Read full manifest as JSON
manifest=$($CLI get "$WORK_UNIT" 2>&1) || {
    echo "Error: could not read manifest for \"$WORK_UNIT\"" >&2
    exit 1
}

work_type=$(echo "$manifest" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(d.work_type||'')")
status=$(echo "$manifest" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(d.status||'')")
phases=$(echo "$manifest" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(JSON.stringify(d.phases||{}))")

# Start YAML output
echo "# Workflow Bridge Discovery"
echo "# Generated: $(date -Iseconds)"
echo ""

echo "work_unit: \"$WORK_UNIT\""
echo "work_type: \"$work_type\""
echo "status: \"$status\""
echo ""

# Helper: extract phase status from phases JSON
phase_status() {
    local phase="$1"
    echo "$phases" | node -e "
        const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
        const p=d['$phase'];
        process.stdout.write((p && p.status) || 'none');
    "
}

# Helper: check if phase artifact file exists on disk
phase_file_exists() {
    local phase="$1"
    local dir=".workflows/$WORK_UNIT/$phase"
    case "$phase" in
        research)        [ -f "$dir/research.md" ] ;;
        discussion)      [ -f "$dir/discussion.md" ] ;;
        investigation)   [ -f "$dir/investigation.md" ] ;;
        specification)   [ -f "$dir/specification.md" ] ;;
        planning)        [ -f "$dir/planning.md" ] ;;
        implementation)  [ -f "$dir/implementation.md" ] ;;
        review)          [ -d "$dir" ] && ls "$dir"/r*/review.md >/dev/null 2>&1 ;;
        *)               return 1 ;;
    esac
}

# Emit per-phase state
echo "phases:"
for phase in research discussion investigation specification planning implementation review; do
    ps=$(phase_status "$phase")
    exists="false"
    phase_file_exists "$phase" && exists="true"
    echo "  $phase:"
    echo "    exists: $exists"
    echo "    status: \"$ps\""
done

echo ""

# Compute next_phase based on work_type pipeline
compute_next_phase() {
    local research_s=$(phase_status "research")
    local disc_s=$(phase_status "discussion")
    local inv_s=$(phase_status "investigation")
    local spec_s=$(phase_status "specification")
    local plan_s=$(phase_status "planning")
    local impl_s=$(phase_status "implementation")
    local review_s=$(phase_status "review")

    case "$work_type" in
        feature)
            # (Research) → Discussion → Specification → Planning → Implementation → Review
            if [ "$review_s" = "completed" ]; then echo "done"
            elif [ "$impl_s" = "completed" ]; then echo "review"
            elif [ "$impl_s" = "in-progress" ]; then echo "implementation"
            elif [ "$plan_s" = "concluded" ]; then echo "implementation"
            elif [ "$plan_s" = "in-progress" ]; then echo "planning"
            elif [ "$spec_s" = "concluded" ]; then echo "planning"
            elif [ "$spec_s" = "in-progress" ]; then echo "specification"
            elif [ "$disc_s" = "concluded" ]; then echo "specification"
            elif [ "$disc_s" = "in-progress" ]; then echo "discussion"
            elif [ "$research_s" != "none" ]; then echo "discussion"
            else echo "discussion"
            fi
            ;;
        bugfix)
            # Investigation → Specification → Planning → Implementation → Review
            if [ "$review_s" = "completed" ]; then echo "done"
            elif [ "$impl_s" = "completed" ]; then echo "review"
            elif [ "$impl_s" = "in-progress" ]; then echo "implementation"
            elif [ "$plan_s" = "concluded" ]; then echo "implementation"
            elif [ "$plan_s" = "in-progress" ]; then echo "planning"
            elif [ "$spec_s" = "concluded" ]; then echo "planning"
            elif [ "$spec_s" = "in-progress" ]; then echo "specification"
            elif [ "$inv_s" = "concluded" ]; then echo "specification"
            elif [ "$inv_s" = "in-progress" ]; then echo "investigation"
            else echo "investigation"
            fi
            ;;
        epic)
            # Phase-centric — no single next_phase; output "interactive"
            echo "interactive"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

next_phase=$(compute_next_phase)
echo "next_phase: \"$next_phase\""

# For epic, emit item-level detail per phase
if [ "$work_type" = "epic" ]; then
    echo ""
    echo "epic_detail:"
    echo "$phases" | node -e "
        const phases = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
        const phaseOrder = ['research','discussion','specification','planning','implementation','review'];
        for (const p of phaseOrder) {
            const pd = phases[p];
            if (!pd) continue;
            console.log('  ' + p + ':');
            console.log('    status: \"' + (pd.status || 'none') + '\"');
            if (pd.items && Object.keys(pd.items).length > 0) {
                console.log('    items:');
                for (const [name, item] of Object.entries(pd.items)) {
                    console.log('      - name: \"' + name + '\"');
                    console.log('        status: \"' + (item.status || 'unknown') + '\"');
                }
            } else {
                console.log('    items: []');
            }
        }
    "
fi
