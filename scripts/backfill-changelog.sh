#!/usr/bin/env bash
#
# Regenerate CHANGELOG.md from existing annotated git tags.
#
# Releases are cut by the `release` script, which writes the AI-generated
# release notes into each annotated tag's message (subject `🔖 Release vX.Y.Z`
# followed by a bullet list). This script harvests those messages and emits a
# Keep a Changelog-style CHANGELOG.md — newest release first — entirely from
# tag metadata. No AI calls; deterministic and idempotent (re-running
# reproduces the same file).
#
# Some early tags were cut before reliable note generation and carry an empty
# message body. To give those a proper entry without rewriting published tags,
# drop a `changelog.d/<version>.md` file (bare bullet list, no heading); it
# takes precedence over the tag body for that version. Well-formed tags need
# no override.
#
# Usage: scripts/backfill-changelog.sh [output-file]
#   output-file defaults to CHANGELOG.md at the repo root.

set -euo pipefail

dir="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$dir"

OUT="${1:-CHANGELOG.md}"

# Strip the SSH-signature block (and any trailing blank lines) from a tag
# body, leaving just the release-notes bullets. %(contents:body) already
# omits the signature for signed tags; the sed is belt-and-braces.
clean_body() {
    sed '/-----BEGIN SSH SIGNATURE-----/,$d' | sed -e 's/[[:space:]]*$//' | sed -e :a -e '/^\n*$/{$d;N;};/\n$/ba'
}

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

{
    echo "# Changelog"
    echo
    echo "All notable changes to this project are documented in this file."
    echo
    echo "The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),"
    echo "and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)."
    echo
} > "$tmp"

count=0
# Newest version first.
for tag in $(git tag --sort=-v:refname); do
    version="${tag#v}"
    date="$(git tag -l --format='%(creatordate:short)' "$tag")"

    # A committed override wins over the tag body (for tags cut without notes).
    if [ -f "changelog.d/${version}.md" ]; then
        body="$(clean_body < "changelog.d/${version}.md")"
    else
        body="$(git tag -l --format='%(contents:body)' "$tag" | clean_body)"
    fi

    {
        echo "## [${version}] - ${date}"
        echo
        if [ -n "$body" ]; then
            echo "$body"
        else
            echo "- Maintenance release (no notes recorded)."
        fi
        echo
    } >> "$tmp"
    count=$((count + 1))
done

mv "$tmp" "$OUT"
trap - EXIT
echo "Wrote $OUT from $count tag(s)."
