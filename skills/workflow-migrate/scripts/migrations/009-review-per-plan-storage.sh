#!/usr/bin/env bash
#
# 009-review-per-plan-storage.sh
#
# Restructures review directories to per-plan storage.
#
# Handles three patterns:
#
# 1. Product assessment files inside review versions — deleted (feature removed)
#
# 2. Multi-plan review with per-plan QA subdirectories:
#    review/{scope}/r{N}/{plan}/qa-task-*.md → review/{plan}/r{N}/qa-task-*.md
#
# 3. Orphaned per-plan directories at review root (no r{N}/ structure):
#    review/{topic}/qa-task-*.md → review/{topic}/r1/qa-task-*.md
#
# Idempotent: skips directories that already have proper r{N}/ structure.
#
# This script is sourced by migrate.sh and has access to:
#   - report_update "filepath" "description"
#   - report_skip "filepath"
#

MIGRATION_ID="009"
REVIEW_DIR="docs/workflow/review"

# Skip if no review directory
if [ ! -d "$REVIEW_DIR" ]; then
    return 0
fi

#
# Phase 1: Delete product-assessment.md files (feature removed)
#
for rdir in "$REVIEW_DIR"/*/r*/; do
    [ -d "$rdir" ] || continue
    pa_file="${rdir}product-assessment.md"
    [ -f "$pa_file" ] || continue
    rm "$pa_file"
    report_update "$pa_file" "removed product assessment (feature removed)"
done

#
# Phase 2: Move per-plan QA subdirectories from multi-plan reviews
#
# Detect multi-plan reviews: r{N}/ directories that contain subdirectories
# with qa-task-*.md files (not just qa-task files at the r{N} level)
#
for scope_dir in "$REVIEW_DIR"/*/; do
    [ -d "$scope_dir" ] || continue
    scope=$(basename "$scope_dir")

    for rdir in "$scope_dir"r*/; do
        [ -d "$rdir" ] || continue
        rnum=${rdir##*r}
        rnum=${rnum%/}

        # Look for per-plan subdirectories containing qa-task files
        for plan_subdir in "$rdir"*/; do
            [ -d "$plan_subdir" ] || continue
            plan_name=$(basename "$plan_subdir")

            # Only process directories that have qa-task files
            ls -1 "$plan_subdir"/qa-task-*.md >/dev/null 2>&1 || continue

            # Create destination: review/{plan}/r{N}/
            dest_dir="$REVIEW_DIR/$plan_name/r${rnum}"
            mkdir -p "$dest_dir"

            # Move QA files
            moved=0
            for qa_file in "$plan_subdir"/qa-task-*.md; do
                [ -f "$qa_file" ] || continue
                mv "$qa_file" "$dest_dir/"
                moved=$((moved + 1))
            done

            # Remove empty source directory
            rmdir "$plan_subdir" 2>/dev/null || true

            if [ "$moved" -gt 0 ]; then
                report_update "$dest_dir" "moved $moved QA files from multi-plan review $scope/r${rnum}"
            fi
        done
    done
done

#
# Phase 3: Fix orphaned per-plan directories (QA files at root, no r{N}/)
#
# Pattern: review/{topic}/qa-task-*.md (no r1/ directory)
#
for topic_dir in "$REVIEW_DIR"/*/; do
    [ -d "$topic_dir" ] || continue
    topic=$(basename "$topic_dir")

    # Skip if r1/ already exists with content
    if [ -d "${topic_dir}r1" ]; then
        continue
    fi

    # Check for QA files directly in the topic directory
    ls -1 "$topic_dir"/qa-task-*.md >/dev/null 2>&1 || continue

    # Create r1/ and move QA files
    mkdir -p "${topic_dir}r1"
    moved=0
    for qa_file in "${topic_dir}"qa-task-*.md; do
        [ -f "$qa_file" ] || continue
        mv "$qa_file" "${topic_dir}r1/"
        moved=$((moved + 1))
    done

    if [ "$moved" -gt 0 ]; then
        report_update "${topic_dir}r1" "moved $moved orphaned QA files into r1/"
    fi
done
