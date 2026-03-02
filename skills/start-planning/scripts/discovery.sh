#!/bin/bash
#
# Discovers the current state of specifications and plans
# for the /start-planning command.
#
# Uses the manifest CLI to read work unit state.
# Outputs structured YAML that the command can consume directly.
#

set -eo pipefail

MANIFEST="node .claude/skills/workflow-manifest/scripts/manifest.js"

# Start YAML output
echo "# Planning Command State Discovery"
echo "# Generated: $(date -Iseconds)"
echo ""

#
# Gather all active work units via manifest CLI
#
manifests_json=$($MANIFEST list --status active 2>/dev/null || echo "[]")

# Count work units (portable: no jq dependency)
work_unit_count=$(echo "$manifests_json" | node -e "
  let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
    const arr=JSON.parse(d);
    console.log(arr.length);
  });
")

#
# SPECIFICATIONS
#
echo "specifications:"

feature_count=0
feature_ready_count=0
feature_with_plan_count=0
feature_actionable_with_plan_count=0
feature_implemented_count=0
crosscutting_count=0

if [ "$work_unit_count" -eq 0 ]; then
    echo "  exists: false"
    echo "  feature: []"
    echo "  crosscutting: []"
    echo "  counts:"
    echo "    feature: 0"
    echo "    feature_ready: 0"
    echo "    feature_with_plan: 0"
    echo "    feature_actionable_with_plan: 0"
    echo "    feature_implemented: 0"
    echo "    crosscutting: 0"
else
    # Parse each work unit's specification and planning state
    # Node script extracts the fields we need from the JSON array
    parsed=$(echo "$manifests_json" | node -e "
      let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
        const arr=JSON.parse(d);
        for (const m of arr) {
          const spec = (m.phases && m.phases.specification) || {};
          const plan = (m.phases && m.phases.planning) || {};
          const impl = (m.phases && m.phases.implementation) || {};
          const specStatus = spec.status || '';
          const specType = spec.type || 'feature';
          const planStatus = plan.status || '';
          const implStatus = impl.status || '';
          const planFormat = plan.format || '';
          const planId = plan.plan_id || '';
          const workType = m.work_type || 'feature';
          // Output pipe-delimited: name|work_type|spec_status|spec_type|plan_status|impl_status|plan_format|plan_id
          console.log([m.name, workType, specStatus, specType, planStatus, implStatus, planFormat, planId].join('|'));
        }
      });
    ")

    has_any_spec=false
    feature_lines=""
    crosscutting_lines=""
    plan_lines=""
    plan_format_seen=""
    plan_format_unanimous="true"

    while IFS='|' read -r name work_type spec_status spec_type plan_status impl_status plan_format plan_id; do
        [ -z "$name" ] && continue

        # Skip work units with no specification phase at all
        [ -z "$spec_status" ] && continue

        has_any_spec=true

        # Skip superseded specs
        [ "$spec_status" = "superseded" ] && continue

        if [ "$spec_type" = "cross-cutting" ]; then
            crosscutting_count=$((crosscutting_count + 1))
            crosscutting_lines="${crosscutting_lines}    - name: \"$name\"\n      status: \"$spec_status\"\n"
            continue
        fi

        # Feature spec
        feature_count=$((feature_count + 1))

        has_plan="false"
        if [ -n "$plan_status" ]; then
            has_plan="true"
        fi

        has_impl="false"
        if [ -n "$impl_status" ]; then
            has_impl="true"
        fi

        line="    - name: \"$name\"\n      status: \"$spec_status\"\n      work_type: \"$work_type\"\n      has_plan: $has_plan\n"
        if [ "$has_plan" = "true" ]; then
            line="${line}      plan_status: \"$plan_status\"\n"
        fi
        line="${line}      has_impl: $has_impl\n"
        if [ "$has_impl" = "true" ]; then
            line="${line}      impl_status: \"$impl_status\"\n"
        fi
        feature_lines="${feature_lines}${line}"

        # Count ready (concluded + no plan)
        if [ "$spec_status" = "concluded" ] && [ "$has_plan" = "false" ]; then
            feature_ready_count=$((feature_ready_count + 1))
        fi
        if [ "$has_plan" = "true" ]; then
            feature_with_plan_count=$((feature_with_plan_count + 1))
            if [ "$impl_status" != "completed" ]; then
                feature_actionable_with_plan_count=$((feature_actionable_with_plan_count + 1))
            fi
        fi
        if [ "$impl_status" = "completed" ]; then
            feature_implemented_count=$((feature_implemented_count + 1))
        fi

        # Track plan data for plans section
        if [ -n "$plan_status" ]; then
            plan_lines="${plan_lines}    - name: \"$name\"\n      format: \"${plan_format:-MISSING}\"\n      status: \"$plan_status\"\n      work_type: \"$work_type\"\n"
            if [ -n "$plan_id" ]; then
                plan_lines="${plan_lines}      plan_id: \"$plan_id\"\n"
            fi

            if [ -n "$plan_format" ] && [ "$plan_format" != "MISSING" ]; then
                if [ -z "$plan_format_seen" ]; then
                    plan_format_seen="$plan_format"
                elif [ "$plan_format_seen" != "$plan_format" ]; then
                    plan_format_unanimous="false"
                fi
            fi
        fi
    done <<< "$parsed"

    if [ "$has_any_spec" = "true" ]; then
        echo "  exists: true"
    else
        echo "  exists: false"
    fi

    echo "  feature:"
    if [ "$feature_count" -eq 0 ]; then
        echo "    []  # No feature specifications"
    else
        echo -e "$feature_lines" | sed '/^$/d'
    fi

    echo "  crosscutting:"
    if [ "$crosscutting_count" -eq 0 ]; then
        echo "    []  # No cross-cutting specifications"
    else
        echo -e "$crosscutting_lines" | sed '/^$/d'
    fi

    echo "  counts:"
    echo "    feature: $feature_count"
    echo "    feature_ready: $feature_ready_count"
    echo "    feature_with_plan: $feature_with_plan_count"
    echo "    feature_actionable_with_plan: $feature_actionable_with_plan_count"
    echo "    feature_implemented: $feature_implemented_count"
    echo "    crosscutting: $crosscutting_count"
fi

echo ""

#
# PLANS
#
echo "plans:"

# Reuse plan data already gathered above
if [ -n "$plan_lines" ]; then
    echo "  exists: true"
    echo "  files:"
    echo -e "$plan_lines" | sed '/^$/d'

    if [ "$plan_format_unanimous" = "true" ] && [ -n "$plan_format_seen" ]; then
        echo "  common_format: \"$plan_format_seen\""
    else
        echo "  common_format: \"\""
    fi
else
    echo "  exists: false"
    echo "  files: []"
    echo "  common_format: \"\""
fi

echo ""

#
# WORKFLOW STATE SUMMARY
#
echo "state:"

specs_exist="false"
plans_exist="false"

if [ "${has_any_spec:-false}" = "true" ]; then
    specs_exist="true"
fi
if [ -n "$plan_lines" ]; then
    plans_exist="true"
fi

echo "  has_specifications: $specs_exist"
echo "  has_plans: $plans_exist"

# Determine workflow state for routing
# Actionable = ready for new plan OR has plan that's not fully implemented
if [ "$specs_exist" = "false" ]; then
    echo "  scenario: \"no_specs\""
elif [ "$feature_ready_count" -eq 0 ] && [ "$feature_actionable_with_plan_count" -eq 0 ]; then
    echo "  scenario: \"nothing_actionable\""
else
    echo "  scenario: \"has_options\""
fi
