#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$REPO_ROOT/.agents/skills"
CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
DEST_DIR="$CODEX_HOME_DIR/skills"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Fant ikke skills-katalog: $SOURCE_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

echo "Installerer lokale skills fra $SOURCE_DIR til $DEST_DIR"

installed=0
while IFS= read -r -d '' skill_file; do
  skill_name="$(basename "$(dirname "$skill_file")")"
  skill_dest="$DEST_DIR/$skill_name"
  mkdir -p "$skill_dest"
  cp "$skill_file" "$skill_dest/SKILL.md"
  echo "  ✓ $skill_name"
  installed=$((installed + 1))
done < <(find "$SOURCE_DIR" -mindepth 2 -maxdepth 2 -type f -name 'SKILL.md' -print0)

if [[ "$installed" -eq 0 ]]; then
  echo "Ingen SKILL.md-filer funnet under $SOURCE_DIR" >&2
  exit 1
fi

echo "Ferdig. Restart Codex for å laste inn nye/oppdaterte skills."
