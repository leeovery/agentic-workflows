#!/bin/bash
#
# Discovers the current state of plans for /start-implementation command.
#
# Uses the manifest CLI to read work unit state.
# Outputs structured YAML that the command can consume directly.
#

set -eo pipefail

MANIFEST_CLI="node .claude/skills/workflow-manifest/scripts/manifest.js"
ENVIRONMENT_FILE=".workflows/environment-setup.md"

# Start YAML output
echo "# Implementation Command State Discovery"
echo "# Generated: $(date -Iseconds)"
echo ""

#
# PLANS (work units with planning phase data)
#
echo "plans:"

plan_count=0
plans_concluded_count=0
plans_with_unresolved_deps=0

# Arrays to store plan data for cross-referencing
declare -a plan_names=()
declare -a plan_statuses=()

# Get all active work units
work_units_json=$($MANIFEST_CLI list --status active 2>/dev/null || echo "[]")

# Check if any work units have planning data
has_plans=false

if [ "$work_units_json" != "[]" ]; then
    # Parse work unit names from JSON array
    work_unit_names=$(echo "$work_units_json" | node -e "
        const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
        data.forEach(wu => console.log(wu.name));
    " 2>/dev/null || true)

    if [ -n "$work_unit_names" ]; then
        # First pass: check which work units have planning phase
        plans_yaml=""

        while IFS= read -r wu_name; do
            [ -z "$wu_name" ] && continue

            # Check if planning phase exists
            planning_status=$($MANIFEST_CLI get "$wu_name".phases.planning.status 2>/dev/null || echo "")
            [ -z "$planning_status" ] && continue

            # Has planning data — check if plan file exists
            plan_file=".workflows/${wu_name}/planning/planning.md"
            [ -f "$plan_file" ] || continue

            if ! $has_plans; then
                has_plans=true
                echo "  exists: true"
                echo "  files:"
            fi

            # Read fields from manifest
            work_type=$($MANIFEST_CLI get "$wu_name".work_type 2>/dev/null || echo "feature")
            format=$($MANIFEST_CLI get "$wu_name".phases.planning.format 2>/dev/null || echo "MISSING")
            plan_id=$($MANIFEST_CLI get "$wu_name".phases.planning.plan_id 2>/dev/null || echo "")

            # Read specification state
            spec_status=$($MANIFEST_CLI get "$wu_name".phases.specification.status 2>/dev/null || echo "")
            spec_file=".workflows/${wu_name}/specification/specification.md"
            spec_exists="false"
            [ -f "$spec_file" ] && spec_exists="true"

            # Track plan data
            plan_names+=("$wu_name")
            plan_statuses+=("$planning_status")

            if [ "$planning_status" = "concluded" ]; then
                plans_concluded_count=$((plans_concluded_count + 1))
            fi

            echo "    - name: \"$wu_name\""
            echo "      topic: \"$wu_name\""
            echo "      status: \"$planning_status\""
            echo "      work_type: \"$work_type\""
            echo "      format: \"$format\""
            echo "      specification: \"${wu_name}/specification/specification.md\""
            echo "      specification_exists: $spec_exists"
            if [ -n "$plan_id" ]; then
                echo "      plan_id: \"$plan_id\""
            fi

            #
            # External dependencies from manifest
            #
            deps_json=$($MANIFEST_CLI get "$wu_name".phases.planning.external_dependencies 2>/dev/null || echo "")
            has_unresolved="false"
            unresolved_count=0

            echo "      external_deps:"
            if [ -z "$deps_json" ] || [ "$deps_json" = "[]" ]; then
                echo "        []"
            else
                # Parse deps from JSON array
                echo "$deps_json" | node -e "
                    const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
                    if (!Array.isArray(data) || data.length === 0) {
                        console.log('        []');
                        process.exit(0);
                    }
                    data.forEach(dep => {
                        console.log('        - topic: \"' + (dep.topic || '') + '\"');
                        console.log('          state: \"' + (dep.state || '') + '\"');
                        if (dep.task_id) console.log('          task_id: \"' + dep.task_id + '\"');
                    });
                " 2>/dev/null || echo "        []"

                # Count unresolved
                unresolved_count=$(echo "$deps_json" | node -e "
                    const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
                    const count = Array.isArray(data) ? data.filter(d => d.state === 'unresolved').length : 0;
                    console.log(count);
                " 2>/dev/null || echo "0")

                if [ "$unresolved_count" -gt 0 ]; then
                    has_unresolved="true"
                fi
            fi
            echo "      has_unresolved_deps: $has_unresolved"
            echo "      unresolved_dep_count: $unresolved_count"

            if [ "$has_unresolved" = "true" ]; then
                plans_with_unresolved_deps=$((plans_with_unresolved_deps + 1))
            fi

            plan_count=$((plan_count + 1))
        done <<< "$work_unit_names"
    fi
fi

if ! $has_plans; then
    echo "  exists: false"
    echo "  files: []"
    echo "  count: 0"
else
    echo "  count: $plan_count"
fi

echo ""

#
# IMPLEMENTATION TRACKING
#
echo "implementation:"

impl_count=0
plans_in_progress_count=0
plans_completed_count=0
has_impl=false

if [ "$work_units_json" != "[]" ] && [ -n "$work_unit_names" ]; then
    while IFS= read -r wu_name; do
        [ -z "$wu_name" ] && continue

        # Check if implementation phase exists in manifest
        impl_status=$($MANIFEST_CLI get "$wu_name".phases.implementation.status 2>/dev/null || echo "")
        [ -z "$impl_status" ] && continue

        # Check if implementation file exists
        impl_file=".workflows/${wu_name}/implementation/implementation.md"
        [ -f "$impl_file" ] || continue

        if ! $has_impl; then
            has_impl=true
            echo "  exists: true"
            echo "  files:"
        fi

        current_phase=$($MANIFEST_CLI get "$wu_name".phases.implementation.current_phase 2>/dev/null || echo "")
        current_task=$($MANIFEST_CLI get "$wu_name".phases.implementation.current_task 2>/dev/null || echo "")

        echo "    - topic: \"$wu_name\""
        echo "      status: \"$impl_status\""

        if [ -n "$current_phase" ] && [ "$current_phase" != "~" ] && [ "$current_phase" != "null" ]; then
            echo "      current_phase: $current_phase"
        fi

        # Completed phases from manifest
        completed_phases_json=$($MANIFEST_CLI get "$wu_name".phases.implementation.completed_phases 2>/dev/null || echo "[]")
        if [ -n "$completed_phases_json" ] && [ "$completed_phases_json" != "[]" ]; then
            phases_inline=$(echo "$completed_phases_json" | node -e "
                const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
                console.log(Array.isArray(data) ? data.join(', ') : '');
            " 2>/dev/null || echo "")
            if [ -n "$phases_inline" ]; then
                echo "      completed_phases: [$phases_inline]"
            else
                echo "      completed_phases: []"
            fi
        else
            echo "      completed_phases: []"
        fi

        # Completed tasks from manifest
        completed_tasks_json=$($MANIFEST_CLI get "$wu_name".phases.implementation.completed_tasks 2>/dev/null || echo "[]")
        if [ -n "$completed_tasks_json" ] && [ "$completed_tasks_json" != "[]" ]; then
            echo "      completed_tasks:"
            echo "$completed_tasks_json" | node -e "
                const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
                if (Array.isArray(data)) data.forEach(t => console.log('        - \"' + t + '\"'));
            " 2>/dev/null || echo "      completed_tasks: []"
        else
            echo "      completed_tasks: []"
        fi

        # Track counts
        if [ "$impl_status" = "in-progress" ]; then
            plans_in_progress_count=$((plans_in_progress_count + 1))
        elif [ "$impl_status" = "completed" ]; then
            plans_completed_count=$((plans_completed_count + 1))
        fi

        impl_count=$((impl_count + 1))
    done <<< "$work_unit_names"
fi

if ! $has_impl; then
    echo "  exists: false"
    echo "  files: []"
fi

echo ""

#
# DEPENDENCY RESOLUTION (cross-reference resolved deps against implementation state)
#
# For each plan with resolved deps, check if the referenced tasks are actually completed
# by reading the dependency work unit's implementation state from the manifest
#
echo "dependency_resolution:"

if [ "$plan_count" -gt 0 ]; then
    has_resolution_data=false

    for i in "${!plan_names[@]}"; do
        wu_name="${plan_names[$i]}"

        deps_json=$($MANIFEST_CLI get "$wu_name".phases.planning.external_dependencies 2>/dev/null || echo "")
        [ -z "$deps_json" ] || [ "$deps_json" = "[]" ] && continue

        # Parse and check deps
        resolution=$(echo "$deps_json" | node -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
            if (!Array.isArray(data) || data.length === 0) process.exit(0);

            let allSatisfied = true;
            let hasResolvedDeps = false;
            const blocking = [];

            for (const dep of data) {
                if (dep.state === 'resolved' && dep.task_id) {
                    hasResolvedDeps = true;
                    // We'll mark as blocking — the shell will verify
                    blocking.push({ topic: dep.topic, task_id: dep.task_id, reason: 'check_needed' });
                } else if (dep.state === 'unresolved') {
                    hasResolvedDeps = true;
                    allSatisfied = false;
                    blocking.push({ topic: dep.topic, reason: 'dependency unresolved' });
                }
            }

            console.log(JSON.stringify({ hasResolvedDeps, blocking }));
        " 2>/dev/null || echo "")

        [ -z "$resolution" ] && continue

        has_resolved=$(echo "$resolution" | node -e "
            const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
            console.log(d.hasResolvedDeps ? 'true' : 'false');
        " 2>/dev/null || echo "false")

        [ "$has_resolved" = "false" ] && continue

        # For resolved deps with task_ids, check if tasks are completed
        all_satisfied=true
        blocking_entries=""

        blocking_json=$(echo "$resolution" | node -e "
            const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
            console.log(JSON.stringify(d.blocking));
        " 2>/dev/null || echo "[]")

        blocking_count=$(echo "$blocking_json" | node -e "
            const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
            console.log(d.length);
        " 2>/dev/null || echo "0")

        for j in $(seq 0 $((blocking_count - 1))); do
            dep_entry=$(echo "$blocking_json" | node -e "
                const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
                console.log(JSON.stringify(d[$j]));
            " 2>/dev/null || echo "{}")

            dep_topic=$(echo "$dep_entry" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.topic||'')" 2>/dev/null || echo "")
            dep_task_id=$(echo "$dep_entry" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.task_id||'')" 2>/dev/null || echo "")
            dep_reason=$(echo "$dep_entry" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.reason||'')" 2>/dev/null || echo "")

            if [ "$dep_reason" = "dependency unresolved" ]; then
                all_satisfied=false
                blocking_entries="${blocking_entries}      - topic: \"$dep_topic\"\n        reason: \"dependency unresolved\"\n"
            elif [ "$dep_reason" = "check_needed" ] && [ -n "$dep_task_id" ]; then
                # Check if task is completed in the dep's implementation phase
                completed_tasks_json=$($MANIFEST_CLI get "$dep_topic".phases.implementation.completed_tasks 2>/dev/null || echo "[]")
                task_completed=false

                if [ -n "$completed_tasks_json" ] && [ "$completed_tasks_json" != "[]" ]; then
                    task_completed=$(echo "$completed_tasks_json" | node -e "
                        const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
                        const taskId = '$dep_task_id';
                        console.log(Array.isArray(data) && data.includes(taskId) ? 'true' : 'false');
                    " 2>/dev/null || echo "false")
                fi

                if [ "$task_completed" = "false" ]; then
                    all_satisfied=false
                    blocking_entries="${blocking_entries}      - topic: \"$dep_topic\"\n        task_id: \"$dep_task_id\"\n        reason: \"task not yet completed\"\n"
                fi
            fi
        done

        if ! $has_resolution_data; then
            has_resolution_data=true
        fi
        echo "  - plan: \"$wu_name\""
        echo "    deps_satisfied: $all_satisfied"
        if [ -n "$blocking_entries" ]; then
            echo "    deps_blocking:"
            echo -e "$blocking_entries" | sed '/^$/d'
        fi
    done

    if ! $has_resolution_data; then
        echo "  []"
    fi
else
    echo "  []"
fi

echo ""

#
# ENVIRONMENT
#
echo "environment:"

if [ -f "$ENVIRONMENT_FILE" ]; then
    echo "  setup_file_exists: true"
    echo "  setup_file: \"$ENVIRONMENT_FILE\""

    # Check if it says "no special setup required" (case insensitive)
    if grep -qi "no special setup required" "$ENVIRONMENT_FILE" 2>/dev/null; then
        echo "  requires_setup: false"
    else
        echo "  requires_setup: true"
    fi
else
    echo "  setup_file_exists: false"
    echo "  setup_file: \"$ENVIRONMENT_FILE\""
    echo "  requires_setup: unknown"
fi

echo ""

#
# WORKFLOW STATE SUMMARY
#
echo "state:"

echo "  has_plans: $([ "$plan_count" -gt 0 ] && echo "true" || echo "false")"
echo "  plan_count: $plan_count"
echo "  plans_concluded_count: $plans_concluded_count"
echo "  plans_with_unresolved_deps: $plans_with_unresolved_deps"

# Plans ready = concluded + all deps satisfied (no unresolved, all resolved tasks completed)
plans_ready_count=0
if [ "$plan_count" -gt 0 ]; then
    for i in "${!plan_names[@]}"; do
        wu_name="${plan_names[$i]}"
        status="${plan_statuses[$i]}"

        if [ "$status" = "concluded" ]; then
            # Skip plans whose implementation is already started or completed
            impl_status=$($MANIFEST_CLI get "$wu_name".phases.implementation.status 2>/dev/null || echo "")
            if [ "$impl_status" = "completed" ] || [ "$impl_status" = "in-progress" ]; then
                continue
            fi

            deps_json=$($MANIFEST_CLI get "$wu_name".phases.planning.external_dependencies 2>/dev/null || echo "")
            is_ready=true

            if [ -n "$deps_json" ] && [ "$deps_json" != "[]" ]; then
                is_ready=$(echo "$deps_json" | node -e "
                    const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
                    if (!Array.isArray(data)) { console.log('true'); process.exit(0); }
                    const hasBlocking = data.some(d => d.state === 'unresolved');
                    console.log(hasBlocking ? 'false' : 'check');
                " 2>/dev/null || echo "true")

                if [ "$is_ready" = "check" ]; then
                    # Need to verify resolved deps have completed tasks
                    is_ready=$(echo "$deps_json" | node -e "
                        const fs = require('fs');
                        const { execSync } = require('child_process');
                        const data = JSON.parse(fs.readFileSync('/dev/stdin','utf8'));
                        let ready = true;
                        for (const dep of data) {
                            if (dep.state === 'resolved' && dep.task_id) {
                                try {
                                    const completedJson = execSync(
                                        'node .claude/skills/workflow-manifest/scripts/manifest.js get ' + dep.topic + '.phases.implementation.completed_tasks',
                                        { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }
                                    ).trim();
                                    const completed = JSON.parse(completedJson);
                                    if (!Array.isArray(completed) || !completed.includes(dep.task_id)) {
                                        ready = false;
                                        break;
                                    }
                                } catch {
                                    ready = false;
                                    break;
                                }
                            }
                        }
                        console.log(ready ? 'true' : 'false');
                    " 2>/dev/null || echo "false")
                fi
            fi

            if [ "$is_ready" = "true" ]; then
                plans_ready_count=$((plans_ready_count + 1))
            fi
        fi
    done
fi

echo "  plans_ready_count: $plans_ready_count"
echo "  plans_in_progress_count: $plans_in_progress_count"
echo "  plans_completed_count: $plans_completed_count"

# Determine workflow state for routing
if [ "$plan_count" -eq 0 ]; then
    echo "  scenario: \"no_plans\""
elif [ "$plan_count" -eq 1 ]; then
    echo "  scenario: \"single_plan\""
else
    echo "  scenario: \"multiple_plans\""
fi
