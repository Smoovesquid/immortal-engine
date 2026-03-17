set -e
echo "Running tests for A4_structure_entry..."
npm test
echo "Verify structure entry works:"
echo "- player can enter building"
echo "- interior seed generated"
echo "- determinism preserved"
read -p "Type PASS to accept gate: " confirm
if [ "$confirm" = "PASS" ]; then
  touch gates/A4_structure_entry.done
  echo "Gate A4 complete"
else
  echo "Gate A4 not accepted"
  exit 1
fi
