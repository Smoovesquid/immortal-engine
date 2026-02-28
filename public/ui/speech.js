// Browser speech (safe): speak narration ONLY.

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
}

export function filterSpeakText(text) {
  // Deterministic stripping: remove bracketed mechanics chunks and trim.
  // If the whole line is bracketed (e.g., dev logs), return empty.
  const s = String(text ?? '').trim();
  if (!s) return '';
  // Common dev log prefix: treat as non-narration.
  if (/^\[ui\]\s*/i.test(s)) return '';
  // Whole-line bracket chunk (mechanics-only).
  if (/^\[[^\]]*\]$/.test(s)) return '';

  // Remove [ ... ] blocks (non-greedy).
  const noBrackets = s.replace(/\[[^\]]*\]/g, '');
  return noBrackets.replace(/\s+/g, ' ').trim();
}

export function speakNarration(text) {
  if (!speechSupported()) return { ok: false, reason: 'Speech not available' };
  const clean = filterSpeakText(text);
  if (!clean) return { ok: false, reason: 'Nothing to speak' };

  try {
    const u = new SpeechSynthesisUtterance(clean);
    // Keep it simple + non-blocking.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
}
