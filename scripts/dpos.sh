set -euo pipefail
echo "===== DPoS: START ====="

echo "=== 0) timestamp + cwd ==="
date
pwd

echo "=== 1) repo hygiene (must be empty) ==="
STATUS="$(git status --porcelain)"
if [[ -n "$STATUS" ]]; then
  echo "$STATUS"
  echo "DPoS: FAIL (dirty working tree)"
  exit 1
fi
echo "(clean)"

echo "=== 2) last commit ==="
git log -1 --oneline

echo "=== 3) commit scope ==="
git show --name-only --stat HEAD

echo "=== 4) tests ==="
npm test

echo "===== DPoS: END ====="
