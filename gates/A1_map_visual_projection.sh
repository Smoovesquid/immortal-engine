set -e
echo "Running tests for A1_map_visual_projection..."
npm test
echo "Verify map projection visually:"
echo "Open http://localhost:5179"
echo "Confirm:"
echo "- grid visible"
echo "- nodes visible"
echo "- player marker visible"
read -p "Type PASS to accept gate: " confirm
if [ "$confirm" = "PASS" ]; then
  touch gates/A1_map_visual_projection.done
  echo "Gate A1 complete"
else
  echo "Gate A1 not accepted"
  exit 1
fi
