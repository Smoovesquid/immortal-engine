set -e
echo "Running tests for A2_structure_generation..."
npm test
echo "Verify structures generated deterministically:"
echo "- roads"
echo "- buildings"
echo "- towers"
echo "- ruins"
read -p "Type PASS to accept gate: " confirm
if [ "$confirm" = "PASS" ]; then
  touch gates/A2_structure_generation.done
  echo "Gate A2 complete"
else
  echo "Gate A2 not accepted"
  exit 1
fi
