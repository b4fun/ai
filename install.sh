#!/bin/sh
set -eu

REPO="b4fun/ai"
DEFAULT_INSTALL_DIR="${AI_INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${VERSION:-${1:-latest}}"
INSTALL_DIR="${INSTALL_DIR:-${2:-$DEFAULT_INSTALL_DIR}}"
WRAPPER_NAME="${AI_SHELL_NAME:-${3:-ai}}"
INSTALL_SHELL="${AI_INSTALL_SHELL:-1}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT INT TERM

uname_s="$(uname -s | tr '[:upper:]' '[:lower:]')"
uname_m="$(uname -m | tr '[:upper:]' '[:lower:]')"

case "$uname_s" in
  darwin) platform="darwin" ;;
  linux) platform="linux" ;;
  *)
    echo "Unsupported operating system: $uname_s" >&2
    exit 1
    ;;
esac

case "$uname_m" in
  x86_64|amd64) arch="x64" ;;
  aarch64|arm64) arch="arm64" ;;
  *)
    echo "Unsupported architecture: $uname_m" >&2
    exit 1
    ;;
esac

case "$platform/$arch" in
  darwin/arm64) asset_name="ai-darwin-arm64" ;;
  linux/x64) asset_name="ai-linux-x64" ;;
  linux/arm64) asset_name="ai-linux-arm64" ;;
  *)
    echo "No release asset for $platform/$arch" >&2
    exit 1
    ;;
esac

asset_archive="$asset_name.tar.gz"
asset_sha="$asset_archive.sha256"

case "$VERSION" in
  latest)
    release_base="https://github.com/$REPO/releases/latest/download"
    ;;
  *)
    release_base="https://github.com/$REPO/releases/download/$VERSION"
    ;;
esac

asset_file="$asset_archive"
asset_url="$release_base/$asset_archive"
sha_url="$release_base/$asset_sha"

mkdir -p "$INSTALL_DIR"
install_path="$INSTALL_DIR/ai"

download_path="$TMP_DIR/$asset_file"
if ! curl -fsSL "$asset_url" -o "$download_path"; then
  # Backward compatibility with older releases that uploaded raw binaries.
  asset_url="$release_base/$asset_name"
  sha_url="$release_base/$asset_name.sha256"
  asset_file="$asset_name"
  download_path="$TMP_DIR/$asset_file"
  curl -fsSL "$asset_url" -o "$download_path"
fi

sha_path="$TMP_DIR/$(basename "$sha_url")"
if curl -fsSL "$sha_url" -o "$sha_path" 2>/dev/null; then
  read -r expected_sha _ < "$sha_path"
  if command -v sha256sum >/dev/null 2>&1; then
    actual_sha="$(sha256sum "$download_path")"
    actual_sha="${actual_sha%% *}"
  elif command -v shasum >/dev/null 2>&1; then
    actual_sha="$(shasum -a 256 "$download_path")"
    actual_sha="${actual_sha%% *}"
  else
    actual_sha=""
    echo "No sha256 checker found; skipping digest verification" >&2
  fi

  if [ -n "$actual_sha" ] && [ "$actual_sha" != "$expected_sha" ]; then
    echo "SHA256 digest mismatch for $(basename "$download_path")" >&2
    exit 1
  fi
else
  echo "No sha256 digest found; skipping digest verification" >&2
fi

case "$download_path" in
  *.tar.gz)
    tar -xzf "$download_path" -C "$TMP_DIR"
    tmp_bin="$TMP_DIR/ai"
    ;;
  *)
    tmp_bin="$download_path"
    ;;
esac

chmod 755 "$tmp_bin"
# Replace the executable with a fresh inode instead of overwriting in place.
# On macOS, in-place replacement of an ad-hoc signed SEA binary can leave stale
# assessment/provenance state behind and cause the upgraded binary to be killed
# on launch. Installing via a temporary path and rename avoids that.
tmp_install_path="$INSTALL_DIR/.ai.tmp.$$"
rm -f "$tmp_install_path"
cp "$tmp_bin" "$tmp_install_path"
chmod 755 "$tmp_install_path"
rm -f "$install_path"
mv "$tmp_install_path" "$install_path"

echo "Installed ai to $install_path"

if [ "$INSTALL_SHELL" != "0" ]; then
  shell_name="${AI_SHELL:-}"
  if [ -z "$shell_name" ] && [ -n "${SHELL:-}" ]; then
    shell_name="$(basename "$SHELL")"
  fi

  case "$shell_name" in
    zsh|bash|fish)
      if "$install_path" shell install "$shell_name" --name "$WRAPPER_NAME" --command "$install_path" 2>/dev/null; then
        :
      else
        "$install_path" shell install "$shell_name" --name "$WRAPPER_NAME"
      fi
      echo "Installed shell wrapper '$WRAPPER_NAME' for $shell_name"
      ;;
    "")
      echo "Could not detect shell; skipping shell integration" >&2
      echo "Run: $install_path shell install <zsh|bash|fish> --name $WRAPPER_NAME --command $install_path" >&2
      ;;
    *)
      echo "Unsupported shell '$shell_name'; skipping shell integration" >&2
      echo "Run: $install_path shell install <zsh|bash|fish> --name $WRAPPER_NAME --command $install_path" >&2
      ;;
  esac
fi
