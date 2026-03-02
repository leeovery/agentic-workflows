#!/bin/bash
#
# Discovers the current state of plans for /start-review command.
#
# Uses the manifest CLI to read work unit state.
# Outputs structured YAML that the command can consume directly.
#

set -eo pipefail

MANIFEST="node .claude/skills/workflow-manifest/scripts/manifest.js"

# Start YAML output
echo "# Review Command State Discovery"
echo "# Generated: $(date -Iseconds)"
echo ""

#
# WORK UNITS (via manifest CLI)
#
echo "plans:"

plan_count=0
implemented_count=0
completed_count=0

# Get all active work units
units_json=$($MANIFEST list --status active 2>/dev/null || echo "[]")

if [ "$units_json" = "[]" ]; then
    echo "  exists: false"
    echo "  files: []"
    echo "  count: 0"
else
    echo "  exists: true"
    echo "  files:"

    # Parse each work unit from JSON array
    # Use node for reliable JSON parsing
    unit_names=$(node -e "
        const units = $units_json;
        units.forEach(u => console.log(u.name));
    " 2>/dev/null || true)

    for name in $unit_names; do
        # Check if planning phase exists
        planning_status=$($MANIFEST get "$name".phases.planning.status 2>/dev/null || echo "")
        [ -z "$planning_status" ] && continue

        # Read planning phase data
        work_type=$($MANIFEST get "$name".work_type 2>/dev/null || echo "unknown")
        format=$($MANIFEST get "$name".phases.planning.format 2>/dev/null || echo "MISSING")

        # Check if planning.md file exists
        plan_file=".workflows/${name}/planning/planning.md"
        if [ ! -f "$plan_file" ]; then
            continue
        fi

        # Check if specification exists
        spec_file=".workflows/${name}/specification/specification.md"
        spec_exists="false"
        if [ -f "$spec_file" ]; then
            spec_exists="true"
        fi

        # Check implementation status via manifest
        impl_status=$($MANIFEST get "$name".phases.implementation.status 2>/dev/null || echo "none")

        # Check review status via manifest
        review_status=$($MANIFEST get "$name".phases.review.status 2>/dev/null || echo "")

        # Count review versions by scanning review directories
        review_dir=".workflows/${name}/review"
        review_count=0
        latest_review_version=0
        latest_review_verdict=""
        if [ -d "$review_dir" ]; then
            for rdir in "$review_dir"/r*/; do
                [ -d "$rdir" ] || continue
                [ -f "${rdir}review.md" ] || continue
                rnum=${rdir##*r}
                rnum=${rnum%/}
                review_count=$((review_count + 1))
                if [ "$rnum" -gt "$latest_review_version" ] 2>/dev/null; then
                    latest_review_version=$rnum
                    latest_review_verdict=$(grep -m1 '\*\*QA Verdict\*\*:' "${rdir}review.md" 2>/dev/null | \
                        sed -E 's/.*\*\*QA Verdict\*\*:[[:space:]]*//' || true)
                fi
            done
        fi

        echo "    - name: \"$name\""
        echo "      work_type: \"$work_type\""
        echo "      planning_status: \"$planning_status\""
        echo "      format: \"$format\""
        echo "      specification_exists: $spec_exists"
        echo "      implementation_status: \"$impl_status\""
        echo "      review_count: $review_count"
        if [ "$review_count" -gt 0 ]; then
            echo "      latest_review_version: $latest_review_version"
            echo "      latest_review_verdict: \"$latest_review_verdict\""
        fi

        plan_count=$((plan_count + 1))
        if [ "$impl_status" != "none" ]; then
            implemented_count=$((implemented_count + 1))
        fi
        if [ "$impl_status" = "completed" ]; then
            completed_count=$((completed_count + 1))
        fi
    done

    echo "  count: $plan_count"
fi

echo ""

#
# REVIEWS
#
echo "reviews:"

reviewed_plan_count=0
# Track which work unit names have been reviewed (space-separated)
reviewed_plans=""

has_reviews="false"

if [ "$units_json" != "[]" ]; then
    for name in $unit_names; do
        review_dir=".workflows/${name}/review"
        [ -d "$review_dir" ] || continue

        # Count r*/ versions
        versions=0
        latest_version=0
        latest_path=""
        for rdir in "$review_dir"/r*/; do
            [ -d "$rdir" ] || continue
            [ -f "${rdir}review.md" ] || continue
            rnum=${rdir##*r}
            rnum=${rnum%/}
            versions=$((versions + 1))
            if [ "$rnum" -gt "$latest_version" ] 2>/dev/null; then
                latest_version=$rnum
                latest_path="$rdir"
            fi
        done

        [ "$versions" -eq 0 ] && continue
        has_reviews="true"

        # Extract verdict from latest review.md
        latest_verdict=""
        if [ -f "${latest_path}review.md" ]; then
            latest_verdict=$(grep -m1 '\*\*QA Verdict\*\*:' "${latest_path}review.md" 2>/dev/null | \
                sed -E 's/.*\*\*QA Verdict\*\*:[[:space:]]*//' || true)
        fi

        # Check for synthesis: look for review-tasks-c*.md in implementation dir
        has_synthesis="false"
        impl_dir=".workflows/${name}/implementation"
        if ls "$impl_dir"/review-tasks-c*.md >/dev/null 2>&1; then
            has_synthesis="true"
        fi

        # Track reviewed plans
        if ! echo " $reviewed_plans " | grep -q " $name "; then
            reviewed_plans="$reviewed_plans $name"
            reviewed_plan_count=$((reviewed_plan_count + 1))
        fi

        # Output on first review entry
        if [ "$versions" -gt 0 ] && ! echo "$printed_header" | grep -q "yes"; then
            printed_header="yes"
            echo "  exists: true"
            echo "  entries:"
        fi

        echo "    - name: \"$name\""
        echo "      versions: $versions"
        echo "      latest_version: $latest_version"
        echo "      latest_verdict: \"$latest_verdict\""
        echo "      latest_path: \"$latest_path\""
        echo "      has_synthesis: $has_synthesis"
    done
fi

if [ "$has_reviews" = "false" ]; then
    echo "  exists: false"
fi

echo ""

#
# WORKFLOW STATE SUMMARY
#
echo "state:"

echo "  has_plans: $([ "$plan_count" -gt 0 ] && echo "true" || echo "false")"
echo "  plan_count: $plan_count"
echo "  implemented_count: $implemented_count"
echo "  completed_count: $completed_count"
echo "  reviewed_plan_count: $reviewed_plan_count"

# Determine if all implemented plans have been reviewed
all_reviewed="false"
if [ "$implemented_count" -gt 0 ] && [ "$reviewed_plan_count" -ge "$implemented_count" ]; then
    all_reviewed="true"
fi
echo "  all_reviewed: $all_reviewed"

# Determine workflow state for routing
if [ "$plan_count" -eq 0 ]; then
    echo "  scenario: \"no_plans\""
elif [ "$plan_count" -eq 1 ]; then
    echo "  scenario: \"single_plan\""
else
    echo "  scenario: \"multiple_plans\""
fi
