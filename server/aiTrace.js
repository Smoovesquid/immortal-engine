import fs from 'node:fs';
import path from 'node:path';

export function getAiTracePath() {
  const p = String(process.env.AI_TRACE_PATH || '.artifacts/ai-trace.ndjson');
  return path.resolve(p);
}

export function appendAiTrace(record) {
  const file = getAiTracePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(record) + '\n', 'utf8');
}
