set -e
echo "Running tests for A5_interior_map_generation..."
npm test
echo "Verify interior generation:"
echo "- rooms generated"
echo "- adjacency valid"
echo "- deterministic layout"
read -p "Type PASS to accept gate: " confirm
if [ "$confirm" = "PASS" ]; then
  touch gates/A5_interior_map_generation.done
  echo "Gate A5 complete"
else
  echo "Gate A5 not accepted"
  exit 1
fi
