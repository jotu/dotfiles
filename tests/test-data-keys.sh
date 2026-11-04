#!/usr/bin/env bash
# Fail when a template reads a Chezmoi data key that docs/data-keys.md does not document.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
doc=docs/data-keys.md

documented="$(grep -oE '`[A-Za-z]+(\.[A-Za-z]+)*`' "$doc" | tr -d '`' | sort -u)"

# Dotted references (.work.git.email), string lookups (hasKey .work.git "email"),
# and nested lookups (get (get .github "work") "gitProtocol").
used="$(
  git ls-files -z -- '*.tmpl' ':!:.chezmoitemplates' ':!:*/scripts/*' '.chezmoitemplates/*' |
    xargs -0 perl -ne '
      while (/(?:^|[^A-Za-z0-9_.])\.((?:work|personal|github)(?:\.[A-Za-z]+)*|name|editor)\b/g) { print "$1\n" }
      while (/(?:hasKey|get) \.((?:work|personal|github)(?:\.[A-Za-z]+)*) "([A-Za-z]+)"/g) { print "$1.$2\n" }
      while (/get \(get \.(github|work|personal) "([A-Za-z]+)"\) "([A-Za-z]+)"/g) { print "$1.$2.$3\n" }
      while (/hasKey \(get \.(github|work|personal) "([A-Za-z]+)"\) "([A-Za-z]+)"/g) { print "$1.$2.$3\n" }
    ' | sort -u
)"

failures=0
while IFS= read -r key; do
  [[ -n $key ]] || continue
  # A key is documented when listed exactly or as the parent of a listed key.
  if ! grep -qxE "$(printf '%s' "$key" | sed 's/\./\\./g')(\\..+)?" <<<"$documented"; then
    printf 'UNDOCUMENTED: %s (add it to %s)\n' "$key" "$doc" >&2
    failures=$((failures + 1))
  fi
done <<<"$used"

[[ $failures -eq 0 ]] || exit 1
echo "All template data keys are documented."
