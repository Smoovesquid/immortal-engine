// Voice input — Web Speech API → existing intent pipe.
// No new engine plumbing: the recognised text is dropped into the play input
// and submitted exactly as if the player had typed it.
//
// Usage:
//   const btn = createVoiceButton(transcript => {
//     ui.play.input = transcript;
//     doSubmitMove();
//   });
//   inputBar.appendChild(btn);

const MIC_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
  <path d="M12 2a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
  <path d="M19 10h-1a6 6 0 0 1-12 0H5a7 7 0 0 0 6 6.93V20H9v2h6v-2h-2v-3.07A7 7 0 0 0 19 10z"/>
</svg>`;

const STOP_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
  <rect x="6" y="6" width="12" height="12" rx="2"/>
</svg>`;

const SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
  : null;

/**
 * createVoiceButton(onResult, opts?)
 * @param {(transcript: string) => void} onResult  called with final transcript
 * @param {{ onSilence?: () => void }} opts  onSilence fires when recognition
 *   ends without hearing anything (converse mode re-arms the mic from it)
 * @returns {HTMLButtonElement}  with .startListening() / .stopListening()
 *   exposed so converse mode can drive the mic programmatically
 */
export function createVoiceButton(onResult, opts = {}) {
  const btn = document.createElement('button');
  btn.className = 'btn voice-btn';
  btn.setAttribute('aria-label', 'Voice input');
  btn.title = SR ? 'Hold to speak' : 'Voice input not supported in this browser';
  btn.innerHTML = MIC_ICON;

  if (!SR) {
    btn.disabled = true;
    btn.classList.add('voice-btn--unsupported');
    return btn;
  }

  let recognition = null;
  let listening = false;
  // Interim transcript shown in the input while the user speaks
  let lastInterim = '';
  // Whether this listening session produced a transcript (for onSilence).
  let gotResult = false;

  function setListening(v) {
    listening = v;
    btn.classList.toggle('voice-btn--listening', v);
    btn.innerHTML = v ? STOP_ICON : MIC_ICON;
    btn.setAttribute('aria-pressed', String(v));
  }

  function start() {
    if (listening) { stop(); return; }

    gotResult = false;
    recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (e) => {
      let interim = '';
      let final = '';
      for (const result of e.results) {
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      // Show interim text while speaking
      if (interim) lastInterim = interim;
      if (final.trim()) {
        lastInterim = '';
        gotResult = true;
        onResult(final.trim());
      }
    };

    recognition.onerror = (e) => {
      // 'aborted' fires when we call stop() ourselves — not an error
      if (e.error !== 'aborted') {
        btn.classList.add('voice-btn--error');
        setTimeout(() => btn.classList.remove('voice-btn--error'), 1200);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      // If we got an interim but no final result (quick tap), submit the interim
      if (lastInterim.trim()) {
        gotResult = true;
        onResult(lastInterim.trim());
        lastInterim = '';
      } else if (!gotResult && typeof opts.onSilence === 'function') {
        // Heard nothing at all — let converse mode decide whether to re-arm.
        opts.onSilence();
      }
    };

    try {
      recognition.start();
    } catch {
      setListening(false);
    }
  }

  function stop() {
    if (recognition) {
      try { recognition.stop(); } catch {}
      recognition = null;
    }
    setListening(false);
  }

  btn.addEventListener('click', () => {
    start();
  });

  // Converse mode drives the mic without a click.
  btn.startListening = () => { if (!listening) start(); };
  btn.stopListening = stop;

  // Cleanup: stop if the button is removed from the DOM
  btn.addEventListener('disconnectedCallback', stop);

  return btn;
}
