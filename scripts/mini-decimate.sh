#!/usr/bin/env bash
# mini-decimate.sh — bring a raw GLB (e.g. a Meshy export, ~40–50 MB / 1M+ tris) down
# to a tabletop-mini asset (~1–3 MB / <70k tris) and drop it in the library.
#
# Usage:  scripts/mini-decimate.sh <input.glb> <out-name> [ratio] [texpx]
#   <input.glb>  raw GLB to decimate
#   <out-name>   basename (no ext) → public/map/assets/<out-name>.glb
#   [ratio]      simplify ratio (default 0.05 = keep 5% of triangles)
#   [texpx]      max texture size (default 1024)
#
# After it runs, register the mini in public/map/miniLibrary.js.
#
# Uses gltf-transform (fetched via npx --yes; not a repo dependency). NO draco/meshopt
# compression — the game's GLTFLoader has no decoders wired, so output must be plain.
set -euo pipefail

IN="${1:?usage: mini-decimate.sh <input.glb> <out-name> [ratio] [texpx]}"
NAME="${2:?missing <out-name>}"
RATIO="${3:-0.05}"
TEX="${4:-1024}"
CLI="@gltf-transform/cli@4.4.1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/map/assets/$NAME.glb"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

echo "→ $IN"
npx --yes "$CLI" weld     "$IN"          "$TMP/1.glb" >/dev/null
npx --yes "$CLI" simplify "$TMP/1.glb"   "$TMP/2.glb" --ratio "$RATIO" --error 0.01
npx --yes "$CLI" resize   "$TMP/2.glb"   "$TMP/3.glb" --width "$TEX" --height "$TEX" >/dev/null
npx --yes "$CLI" prune    "$TMP/3.glb"   "$OUT"       >/dev/null

echo "✓ $OUT"
du -h "$OUT"
echo "  now register it in public/map/miniLibrary.js"
