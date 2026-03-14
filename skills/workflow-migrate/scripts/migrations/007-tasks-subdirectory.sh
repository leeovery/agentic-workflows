#!/usr/bin/env bash
#
# 007-tasks-subdirectory.sh
#
# Moves local-markdown task files into a tasks/ subdirectory within each plan topic.
#
# Previous layout:
#   planning/{topic}/
#   ├── plan.md
#   ├── {topic}-1-1.md
#   ├── {topic}-1-2.md
#   └── review-traceability-tracking-c1.md
#
# New layout:
#   planning/{topic}/
#   ├── plan.md
#   ├── tasks/
#   │   ├── {topic}-1-1.md
#   │   └── {topic}-1-2.md
#   └── review-traceability-tracking-c1.md
#
# Only targets files matching {topic}-*.md — won't touch plan.md or review-*-tracking-*.md.
# Skips topics with no matching task files (may not be local-markdown format).
# Idempotent: skips if tasks/ already exists and contains .md files.
#
# This script is sourced by migrate.sh and has access to:
#   - report_update "filepath" "description"
#   - report_skip "filepath"
#

MIGRATION_ID="007"
PLAN_DIR="docs/workflow/planning"

# Skip if no planning directory
if [ ! -d "$PLAN_DIR" ]; then
    return 0
fi

for topic_dir in "$PLAN_DIR"/*/; do
    [ -d "$topic_dir" ] || continue

    topic=$(basename "$topic_dir")
    marker="${topic_dir}plan.md"

    # Skip if no plan.md exists (not a valid topic directory)
    if [ ! -f "$marker" ]; then
        continue
    fi

    # Check if task files exist in the topic directory
    task_files=("$topic_dir${topic}-"*.md)
    if [ ! -f "${task_files[0]}" ]; then
        # No task files — format may not be local-markdown, or tasks already moved
        report_skip "$marker"
        continue
    fi

    # Create tasks/ subdirectory
    mkdir -p "${topic_dir}tasks"

    # Move task files
    moved=0
    for task_file in "${task_files[@]}"; do
        [ -f "$task_file" ] || continue
        mv "$task_file" "${topic_dir}tasks/"
        moved=$((moved + 1))
    done

    report_update "$marker" "moved $moved task file(s) to tasks/ subdirectory"
done
