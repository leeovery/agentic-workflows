#!/usr/bin/env bash
#
# migrate.sh
#
# Keeps workflow files in sync with the current system design.
# Runs all migration scripts in order, tracking progress to avoid redundant processing.
#
# Usage:
#   ./scripts/migrate.sh
#
# Tracking:
#   Migrations are tracked in .workflows/.state/migrations
#   Format: "migration_id" per line (e.g., "001", "002")
#   The orchestrator checks/records migration IDs — individual scripts don't track.
#   Delete the log file to force re-running all migrations.
#
# Adding new migrations:
#   1. Create scripts/migrations/NNN-description.sh (e.g., 002-spec-frontmatter.sh)
#   2. The script will be run automatically in numeric order
#   3. Each migration script receives helper functions via source: report_update, report_skip
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"

# === LEGACY TRACKING SUPPORT (remove after 2026-06) ===
#
# Handles tracking file discovery across historical locations and formats.
# Once all users have run migration 011, replace this section with:
#   TRACKING_FILE=".workflows/.state/migrations"
#   mkdir -p "$(dirname "$TRACKING_FILE")"

find_tracking_file() {
    for candidate in \
        ".workflows/.state/migrations" \
        "docs/workflow/.state/migrations" \
        "docs/workflow/.cache/migrations" \
        "docs/workflow/.cache/migrations.log"
    do
        [ -f "$candidate" ] && echo "$candidate" && return
    done
    echo ".workflows/.state/migrations"
}

normalize_tracking_format() {
    local file="$1"
    [ ! -f "$file" ] && return
    # Old: "docs/workflow/discussion/auth.md: 001" → New: "001"
    if grep -q ': [0-9]' "$file" 2>/dev/null; then
        grep -oE '[0-9]+$' "$file" | sort -u > "${file}.tmp"
        mv "${file}.tmp" "$file"
    fi
}

stabilize_tracking_location() {
    local file="$1"
    local stable="docs/workflow/.state/migrations"
    # If tracking is at a legacy .cache/ location, move to .state/ so it survives migration 010
    case "$file" in
        docs/workflow/.cache/*)
            mkdir -p "$(dirname "$stable")"
            mv "$file" "$stable"
            echo "$stable"
            ;;
        *)
            echo "$file"
            ;;
    esac
}

TRACKING_FILE=$(find_tracking_file)
normalize_tracking_format "$TRACKING_FILE"
TRACKING_FILE=$(stabilize_tracking_location "$TRACKING_FILE")
mkdir -p "$(dirname "$TRACKING_FILE")"
touch "$TRACKING_FILE"

# === END LEGACY TRACKING SUPPORT ===

# Track counts for final report
FILES_UPDATED=0
FILES_SKIPPED=0
MIGRATIONS_RUN=0

#
# Helper function: Report a file update (for migration scripts to call)
# Usage: report_update "filepath" "description"
#
report_update() {
    local filepath="$1"
    local description="$2"
    FILES_UPDATED=$((FILES_UPDATED + 1))
}

#
# Helper function: Report a file skip (for migration scripts to call)
# Usage: report_skip "filepath"
#
report_skip() {
    local filepath="$1"
    FILES_SKIPPED=$((FILES_SKIPPED + 1))
}

# Export functions and variables for migration scripts
export -f report_update report_skip
export TRACKING_FILE FILES_UPDATED FILES_SKIPPED

#
# Main: Run all migrations in order
#

# Check if migrations directory exists and has scripts
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "No migrations directory found at $MIGRATIONS_DIR"
    exit 0
fi

# Find all migration scripts, sorted by name (numeric order)
mapfile -t MIGRATION_SCRIPTS < <(find "$MIGRATIONS_DIR" -name "*.sh" -type f | sort)

if [ ${#MIGRATION_SCRIPTS[@]} -eq 0 ]; then
    echo "No migration scripts found."
    exit 0
fi

for script in "${MIGRATION_SCRIPTS[@]}"; do
    # Extract migration ID from filename (e.g., "001" from "001-discussion-frontmatter.sh")
    migration_id=$(basename "$script" .sh | grep -oE '^[0-9]+')

    if [ -z "$migration_id" ]; then
        echo "Warning: Skipping $script (no numeric prefix)"
        continue
    fi

    # Global check — skip entire migration if already recorded
    if grep -q "^${migration_id}$" "$TRACKING_FILE" 2>/dev/null; then
        continue
    fi

    # Source and run the migration script
    # The script has access to: report_update, report_skip
    # shellcheck source=/dev/null
    source "$script"

    # Re-find tracking file (migration 011 moves it)
    TRACKING_FILE=$(find_tracking_file)
    echo "$migration_id" >> "$TRACKING_FILE"
    MIGRATIONS_RUN=$((MIGRATIONS_RUN + 1))
done

# Report results
if [ "$FILES_UPDATED" -gt 0 ]; then
    echo ""
    echo "$MIGRATIONS_RUN migration(s) applied, $FILES_UPDATED file(s) updated."
    echo ""
    echo "---STOP_GATE: FILES_UPDATED---"
    echo "You MUST now follow the migration skill instructions to STOP and let the user review."
    echo "Follow the explicit instructions in the migration skill before proceeding."
else
    echo "[SKIP] No changes needed"
fi
