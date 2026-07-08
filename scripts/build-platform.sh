#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/opentdf/platform.git"
TMP_DIR="/tmp/opentdf-platform-build"
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/resources/bin"
BINARY="$OUT_DIR/opentdf-platform-darwin-arm64"

echo "==> Building OpenTDF platform for darwin/arm64"

# Check Go is installed
if ! command -v go &>/dev/null; then
  echo "ERROR: Go not found. Install from https://go.dev/dl/"
  exit 1
fi

GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
echo "==> Using Go $GO_VERSION"

mkdir -p "$OUT_DIR"

if [ -d "$TMP_DIR/.git" ]; then
  echo "==> Updating existing clone at $TMP_DIR"
  git -C "$TMP_DIR" pull --ff-only
else
  echo "==> Cloning $REPO_URL"
  rm -rf "$TMP_DIR"
  git clone --depth 1 "$REPO_URL" "$TMP_DIR"
fi

echo "==> Building service binary..."
cd "$TMP_DIR/service"

GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 \
  go build \
  -ldflags="-s -w" \
  -o "$BINARY" \
  .

chmod +x "$BINARY"

SIZE=$(du -sh "$BINARY" | cut -f1)
echo ""
echo "✓ Built: $BINARY ($SIZE)"
echo ""
echo "You can now run: npm run electron"
