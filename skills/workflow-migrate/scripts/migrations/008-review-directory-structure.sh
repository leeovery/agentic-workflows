#!/usr/bin/env bash
#
# 008-review-directory-structure.sh
#
# Moves existing flat review files into a versioned r1/ directory structure.
#
# Previous layout:
#   review/
#   ├── tick-core.md                     # Summary at root
#   ├── tick-core/                       # QA files + product assessment
#   │   ├── qa-task-1.md
#   │   └── product-assessment.md
#   ├── doctor-installation-migration.md # Multi-plan summary
#   ├── installation/                    # Per-plan QA (ambiguous)
#   │   └── qa-task-1.md
#
# New layout:
#   review/
#   ├── tick-core/
#   │   └── r1/
#   │       ├── review.md
#   │       ├── qa-task-1.md
#   │       └── product-assessment.md
#   ├── doctor-installation-migration/
#   │   └── r1/
#   │       ├── review.md
#   │       ├── product-assessment.md
#   │       └── installation/
#   │           └── qa-task-1.md
#
# Idempotent: skips if r1/ already exists.
#
# This script is sourced by migrate.sh and has access to:
#   - report_update "filepath" "description"
#   - report_skip "filepath"
#

MIGRATION_ID="008"
REVIEW_DIR="docs/workflow/review"

# Skip if no review directory
if [ ! -d "$REVIEW_DIR" ]; then
    return 0
fi

for review_file in "$REVIEW_DIR"/*.md; do
    [ -f "$review_file" ] || continue

    scope=$(basename "$review_file" .md)
    scope_dir="$REVIEW_DIR/$scope"
    r1_dir="$scope_dir/r1"

    # Skip if r1/ already exists (idempotent)
    if [ -d "$r1_dir" ]; then
        report_skip "$review_file"
        continue
    fi

    # Create r1/ directory
    mkdir -p "$r1_dir"

    # Move the summary file to r1/review.md
    mv "$review_file" "$r1_dir/review.md"
    moved=1

    # If a matching directory exists, move its contents into r1/
    if [ -d "$scope_dir" ]; then
        # Move qa-task-*.md files
        for qa_file in "$scope_dir"/qa-task-*.md; do
            [ -f "$qa_file" ] || continue
            mv "$qa_file" "$r1_dir/"
            moved=$((moved + 1))
        done

        # Move product-assessment.md
        if [ -f "$scope_dir/product-assessment.md" ]; then
            mv "$scope_dir/product-assessment.md" "$r1_dir/"
            moved=$((moved + 1))
        fi

        # Move per-plan QA subdirectories (multi-plan reviews)
        for subdir in "$scope_dir"/*/; do
            [ -d "$subdir" ] || continue
            subdir_name=$(basename "$subdir")
            # Skip the r1 directory we just created
            [ "$subdir_name" = "r1" ] && continue
            # Only move directories that contain qa-task files
            if ls -1 "$subdir"/qa-task-*.md >/dev/null 2>&1; then
                mv "$subdir" "$r1_dir/"
                moved=$((moved + 1))
            fi
        done
    fi

    report_update "$r1_dir/review.md" "migrated to r1/ structure ($moved items)"
done
