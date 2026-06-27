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

find_asset_url() {
  grep -F '"browser_download_url":' "$2" \
    | grep -F "/$1\"" \
    | sed 's/.*"browser_download_url": "\(.*\)".*/\1/' \
    | head -n 1 \
    || true
}

case "$VERSION" in
  latest)
    releases_json="$TMP_DIR/releases.json"
    curl -fsSL "https://api.github.com/repos/$REPO/releases" -o "$releases_json"
    asset_file="$asset_archive"
    asset_url="$(find_asset_url "$asset_archive" "$releases_json")"
    sha_url="$(find_asset_url "$asset_sha" "$releases_json")"
    if [ -z "$asset_url" ]; then
      asset_file="$asset_name"
      asset_url="$(find_asset_url "$asset_name" "$releases_json")"
      sha_url="$(find_asset_url "$asset_name.sha256" "$releases_json")"
    fi
    if [ -z "$asset_url" ]; then
      echo "Could not find latest release asset: $asset_archive" >&2
      exit 1
    fi
    ;;
  *)
    asset_file="$asset_archive"
    asset_url="https://github.com/$REPO/releases/download/$VERSION/$asset_archive"
    sha_url="https://github.com/$REPO/releases/download/$VERSION/$asset_sha"
    ;;
esac

mkdir -p "$INSTALL_DIR"
install_path="$INSTALL_DIR/ai"

download_path="$TMP_DIR/$asset_file"
if ! curl -fsSL "$asset_url" -o "$download_path"; then
  case "$VERSION" in
    latest)
      exit 1
      ;;
    *)
      # Backward compatibility with older releases that uploaded raw binaries.
      asset_url="https://github.com/$REPO/releases/download/$VERSION/$asset_name"
      sha_url="https://github.com/$REPO/releases/download/$VERSION/$asset_name.sha256"
      asset_file="$asset_name"
      download_path="$TMP_DIR/$asset_file"
      curl -fsSL "$asset_url" -o "$download_path"
      ;;
  esac
fi

sha_path="$TMP_DIR/$(basename "$sha_url")"
if curl -fsSL "$sha_url" -o "$sha_path" 2>/dev/null; then
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$TMP_DIR" && sha256sum -c "$(basename "$sha_path")")
  elif command -v shasum >/dev/null 2>&1; then
    (cd "$TMP_DIR" && shasum -a 256 -c "$(basename "$sha_path")")
  else
    echo "No sha256 checker found; skipping digest verification" >&2
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
cp "$tmp_bin" "$install_path"
chmod 755 "$install_path"

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
