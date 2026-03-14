#!/usr/bin/env bash
#
# 006-directory-restructure.sh
#
# Restructures specification and planning files from flat files to topic directories:
#   - specification/{topic}.md → specification/{topic}/specification.md
#   - planning/{topic}.md → planning/{topic}/plan.md
#
# Also moves tracking files into topic directories and strips topic prefix:
#   - {topic}-review-*.md → {topic}/review-*.md
#
# Updates plan frontmatter `specification` field to use new directory paths.
#
# This script is sourced by migrate.sh and has access to:
#   - report_update "filepath" "description"
#   - report_skip "filepath"
#

MIGRATION_ID="006"
SPEC_DIR="docs/workflow/specification"
PLAN_DIR="docs/workflow/planning"

#
# Phase 1: Specification migration
#
if [ -d "$SPEC_DIR" ]; then
    for file in "$SPEC_DIR"/*.md; do
        [ -f "$file" ] || continue

        name=$(basename "$file" .md)

        # Skip if already a directory (already migrated)
        if [ -d "$SPEC_DIR/$name" ] && [ -f "$SPEC_DIR/$name/specification.md" ]; then
            report_skip "$SPEC_DIR/$name/specification.md"
            continue
        fi

        new_path="$SPEC_DIR/$name/specification.md"

        # Create topic directory
        mkdir -p "$SPEC_DIR/$name"

        # Move the spec file
        mv "$file" "$SPEC_DIR/$name/specification.md"

        # Move any tracking files, stripping topic prefix
        for tracking_file in "$SPEC_DIR/${name}-review-"*.md; do
            [ -f "$tracking_file" ] || continue
            tracking_basename=$(basename "$tracking_file")
            # Strip the topic prefix: {name}-review-foo.md → review-foo.md
            new_tracking_name="${tracking_basename#"${name}-"}"
            mv "$tracking_file" "$SPEC_DIR/$name/$new_tracking_name"
            report_update "$SPEC_DIR/$name/$new_tracking_name" "moved tracking file into topic directory"
        done

        report_update "$new_path" "restructured to topic directory"
    done
fi

#
# Phase 2: Planning migration
#
if [ -d "$PLAN_DIR" ]; then
    for file in "$PLAN_DIR"/*.md; do
        [ -f "$file" ] || continue

        name=$(basename "$file" .md)

        # Skip if already a directory with plan.md
        if [ -d "$PLAN_DIR/$name" ] && [ -f "$PLAN_DIR/$name/plan.md" ]; then
            report_skip "$PLAN_DIR/$name/plan.md"
            continue
        fi

        new_path="$PLAN_DIR/$name/plan.md"

        # Create topic directory (may already exist for local-markdown tasks)
        mkdir -p "$PLAN_DIR/$name"

        # Move the plan file
        mv "$file" "$PLAN_DIR/$name/plan.md"

        # Move any tracking files, stripping topic prefix
        for tracking_file in "$PLAN_DIR/${name}-review-"*.md; do
            [ -f "$tracking_file" ] || continue
            tracking_basename=$(basename "$tracking_file")
            new_tracking_name="${tracking_basename#"${name}-"}"
            mv "$tracking_file" "$PLAN_DIR/$name/$new_tracking_name"
            report_update "$PLAN_DIR/$name/$new_tracking_name" "moved tracking file into topic directory"
        done

        report_update "$new_path" "restructured to topic directory"
    done
fi

#
# Phase 3: Update plan frontmatter specification field
#
# For each plan file (now at planning/{name}/plan.md), update
# specification: {topic}.md → specification: {topic}/specification.md
#
if [ -d "$PLAN_DIR" ]; then
    for file in "$PLAN_DIR"/*/plan.md; do
        [ -f "$file" ] || continue

        # Extract current specification field using awk (safe frontmatter extraction)
        spec_value=$(awk 'BEGIN{c=0} /^---$/{c++; if(c==2) exit; next} c==1{print}' "$file" 2>/dev/null | \
            grep "^specification:" | sed 's/^specification:[[:space:]]*//' | xargs)

        # Skip if empty or already updated (contains /specification.md)
        [ -z "$spec_value" ] && continue
        case "$spec_value" in
            */specification.md) continue ;;
        esac

        # Only update if it matches the old {topic}.md pattern
        # Extract the topic name by stripping .md
        case "$spec_value" in
            *.md)
                topic_name="${spec_value%.md}"
                # Handle both relative paths: {topic}.md and ../specification/{topic}.md
                case "$spec_value" in
                    ../specification/*.md)
                        new_spec_value="../specification/${topic_name#../specification/}/specification.md"
                        ;;
                    *)
                        new_spec_value="${topic_name}/specification.md"
                        ;;
                esac

                # Use awk to replace the specification field in frontmatter only
                awk -v old="specification: $spec_value" -v new="specification: $new_spec_value" '
                    BEGIN { c=0; done=0 }
                    /^---$/ { c++; print; next }
                    c==1 && !done && index($0, "specification:") == 1 {
                        print new
                        done=1
                        next
                    }
                    { print }
                ' "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"

                report_update "$file" "updated specification field: $spec_value → $new_spec_value"
                ;;
        esac
    done
fi
