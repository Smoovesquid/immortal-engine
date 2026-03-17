set -e
echo "Running tests for A3_structure_rendering..."
npm test
echo "Verify structures render on map:"
echo "- roads drawn"
echo "- structure icons visible"
read -p "Type PASS to accept gate: " confirm
if [ "$confirm" = "PASS" ]; then
  touch gates/A3_structure_rendering.done
  echo "Gate A3 complete"
else
  echo "Gate A3 not accepted"
  exit 1
fi
