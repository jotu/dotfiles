#!/usr/bin/env bash
# Test pinned model downloads without network access or changes to the real home.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT
mkdir -p "$tmp_dir/bin" "$tmp_dir/home"

data=$(jq -c --arg src "$repo_root" \
  '. + {chezmoi: {os: "darwin", arch: "arm64", sourceDir: $src}} | .work.enable = false' \
  "$repo_root/tests/fixtures/chezmoi-data.json")
chezmoi --config /dev/null --config-format toml execute-template --source "$repo_root" \
  --override-data "$data" \
  --file "$repo_root/dot_config/mise/conf.d/00-base.toml.tmpl" >"$tmp_dir/base.toml"
chezmoi --config /dev/null --config-format toml execute-template --with-stdin \
  '{{ .chezmoi.stdin | fromToml | toJson }}' <"$tmp_dir/base.toml" |
  jq -r '.tasks["omlx:model:install"].run' >"$tmp_dir/install.sh"
bash -n "$tmp_dir/install.sh"

# Stand in for the public Hugging Face CLI at the network boundary.
cat >"$tmp_dir/bin/hf" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[[ "$1" == download && "$3" == --revision && "$5" == --local-dir ]]
[[ -z "${HF_TOKEN+x}" && -z "${HUGGING_FACE_HUB_TOKEN+x}" && "${HF_HUB_DISABLE_IMPLICIT_TOKEN:-}" == 1 ]]
printf '%s %s\n' "$2" "$4" >>"$HF_TEST_CALLS"
printf '%s\n' "$6" >>"$HF_TEST_DIRS"
if [[ -n "${HF_TEST_HOLD:-}" ]]; then
  trap 'touch "$HF_TEST_HOLD/terminating"; sleep 1; exit 143' TERM
  printf '%s\n' "$$" >"$HF_TEST_HOLD/pid"
  touch "$HF_TEST_HOLD/ready"
  while :; do sleep 0.1; done
fi
mkdir -p "$6"
case "$2" in
  mlx-community/Qwen3-14B-4bit)
    files='model-00001-of-00002.safetensors model-00002-of-00002.safetensors model.safetensors.index.json vocab.json merges.txt' ;;
  mlx-community/Qwen3-4B-4bit)
    files='model.safetensors vocab.json merges.txt' ;;
  mlx-community/Qwen3.5-4B-4bit)
    files='model.safetensors model.safetensors.index.json chat_template.jinja vocab.json preprocessor_config.json processor_config.json video_preprocessor_config.json' ;;
  mlx-community/Qwen3.5-9B-4bit)
    files='model-00001-of-00002.safetensors model-00002-of-00002.safetensors model.safetensors.index.json chat_template.jinja vocab.json preprocessor_config.json processor_config.json video_preprocessor_config.json' ;;
  mlx-community/gpt-oss-20b-MXFP4-Q4)
    files='model-00001-of-00003.safetensors model-00002-of-00003.safetensors model-00003-of-00003.safetensors model.safetensors.index.json generation_config.json' ;;
  *) exit 1 ;;
esac
for file in config.json tokenizer.json tokenizer_config.json $files; do
  [[ "${HF_TEST_MISSING_FILE:-}" == "$file" ]] && continue
  touch "$6/$file"
done
EOF
chmod +x "$tmp_dir/bin/hf"
export HOME="$tmp_dir/home" PATH="$tmp_dir/bin:$PATH" HF_TEST_CALLS="$tmp_dir/calls" HF_TEST_DIRS="$tmp_dir/download-dirs"
export HF_TOKEN='test-only-placeholder' HUGGING_FACE_HUB_TOKEN='test-only-placeholder'

check_model() {
  local id="$1" repo="$2" rev="$3"
  usage_model="$id" bash "$tmp_dir/install.sh"
  [[ "$(tail -n 1 "$HF_TEST_CALLS")" == "$repo $rev" ]] || { echo "wrong download for $id" >&2; exit 1; }
  [[ "$(<"$HOME/.omlx/models/$id/.omlx-revision")" == "$rev" ]]
  local before after
  before=$(wc -l <"$HF_TEST_CALLS")
  usage_model="$id" bash "$tmp_dir/install.sh"
  after=$(wc -l <"$HF_TEST_CALLS")
  [[ "$before" == "$after" ]] || { echo "complete model downloaded again: $id" >&2; exit 1; }
  rm "$HOME/.omlx/models/$id/tokenizer.json"
  usage_model="$id" bash "$tmp_dir/install.sh"
  after=$(wc -l <"$HF_TEST_CALLS")
  [[ "$after" -eq $((before + 1)) ]] || { echo "incomplete model not repaired: $id" >&2; exit 1; }
}

check_model qwen3.5-4b-4bit mlx-community/Qwen3.5-4B-4bit 0e7ffd5c629ef7719d4cbc04069232580bfa9d9c
check_model qwen3.5-9b-4bit mlx-community/Qwen3.5-9B-4bit 8b2b98c00a6b4d291155e4890773ca8f769aee53
check_model gpt-oss-20b-mxfp4-q4 mlx-community/gpt-oss-20b-MXFP4-Q4 f356f2747216d7e98fee755df25987459fc19089

# A failed update must leave the previous complete model and marker intact.
model_dir="$HOME/.omlx/models/qwen3.5-4b-4bit"
printf 'previous-revision\n' >"$model_dir/.omlx-revision"
if HF_TEST_MISSING_FILE=tokenizer.json usage_model=qwen3.5-4b-4bit bash "$tmp_dir/install.sh" 2>/dev/null; then
  echo 'incomplete download must fail, even if an old file exists' >&2
  exit 1
fi
[[ "$(<"$model_dir/.omlx-revision")" == previous-revision && -f "$model_dir/tokenizer.json" ]] || {
  echo 'failed update modified the previous model' >&2; exit 1;
}
failed_stage=$(tail -n 1 "$HF_TEST_DIRS")
usage_model=qwen3.5-4b-4bit bash "$tmp_dir/install.sh"
[[ -d "$failed_stage" && "$(tail -n 1 "$HF_TEST_DIRS")" != "$failed_stage" ]] || {
  echo 'retry reused an interrupted download directory' >&2; exit 1;
}
[[ "$(<"$model_dir/.omlx-revision")" == 0e7ffd5c629ef7719d4cbc04069232580bfa9d9c ]]
found_backup=false
for backup in "$HOME"/.omlx/models/.qwen3.5-4b-4bit.backup.*/model; do
  if [[ -f "$backup/.omlx-revision" && "$(<"$backup/.omlx-revision")" == previous-revision ]]; then
    [[ -f "$backup/tokenizer.json" ]]
    found_backup=true
  fi
done
[[ "$found_backup" == true ]] || { echo 'previous model backup missing' >&2; exit 1; }
lock_dir="$HOME/.omlx/models/.qwen3.5-4b-4bit.install-lock"
mkdir "$lock_dir"
if usage_model=qwen3.5-4b-4bit bash "$tmp_dir/install.sh" 2>/dev/null; then
  echo 'concurrent installation must fail' >&2; exit 1
fi
rmdir "$lock_dir"

# Recover if interrupted after moving the old model but before promotion.
pending_dir="$HOME/.omlx/models/.qwen3.5-4b-4bit.pending-backup"
mv "$model_dir" "$pending_dir"
before=$(wc -l <"$HF_TEST_CALLS")
usage_model=qwen3.5-4b-4bit bash "$tmp_dir/install.sh"
[[ -f "$model_dir/.omlx-revision" && ! -e "$pending_dir" ]]
[[ "$(wc -l <"$HF_TEST_CALLS")" == "$before" ]] || { echo 'recovery redownloaded model' >&2; exit 1; }

# Termination must keep the install lock until the downloader has exited.
mkdir "$tmp_dir/hold"
printf 'previous-revision\n' >"$model_dir/.omlx-revision"
HF_TEST_HOLD="$tmp_dir/hold" usage_model=qwen3.5-4b-4bit sh "$tmp_dir/install.sh" &
installer_pid=$!
for _ in {1..100}; do [[ -e "$tmp_dir/hold/ready" ]] && break; sleep 0.05; done
[[ -e "$tmp_dir/hold/ready" ]] || { kill "$installer_pid" 2>/dev/null || true; echo 'fake downloader did not start' >&2; exit 1; }
kill -TERM "$installer_pid"
for _ in {1..100}; do [[ -e "$tmp_dir/hold/terminating" ]] && break; sleep 0.05; done
[[ -e "$tmp_dir/hold/terminating" ]] || { kill "$(<"$tmp_dir/hold/pid")" 2>/dev/null || true; echo 'installer did not stop downloader' >&2; exit 1; }
[[ -d "$lock_dir" ]] || { echo 'lock released before downloader exited' >&2; exit 1; }
wait "$installer_pid" && { echo 'terminated installer must fail' >&2; exit 1; }
[[ ! -e "$lock_dir" ]] || { echo 'lock not released after downloader exited' >&2; exit 1; }

# Preserve the legacy macOS work installer and its pins.
data=$(jq -c --arg src "$repo_root" \
  '. + {chezmoi: {os: "darwin", arch: "arm64", sourceDir: $src}} | .work.enable = true' \
  "$repo_root/tests/fixtures/chezmoi-data.json")
chezmoi --config /dev/null --config-format toml execute-template --source "$repo_root" \
  --override-data "$data" \
  --file "$repo_root/dot_config/mise/conf.d/00-base.toml.tmpl" >"$tmp_dir/work-base.toml"
chezmoi --config /dev/null --config-format toml execute-template --with-stdin \
  '{{ .chezmoi.stdin | fromToml | toJson }}' <"$tmp_dir/work-base.toml" |
  jq -r '.tasks["omlx:model:install"].run' >"$tmp_dir/install.sh"
check_model qwen3-14b-4bit mlx-community/Qwen3-14B-4bit a4d9b2df59d2c150bef02fcbe0d91046b7ca33a4
check_model qwen3-4b-4bit mlx-community/Qwen3-4B-4bit 4dcb3d101c2a062e5c1d4bb173588c54ea6c4d25

if usage_model=unknown bash "$tmp_dir/install.sh" 2>/dev/null; then
  echo 'unknown model must be rejected' >&2
  exit 1
fi
printf 'Pinned oMLX model installation checks passed.\n'
