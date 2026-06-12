// TTS manager — Web Speech API narration layer (presentation only, no engine impact)

const STORAGE_KEY = 'ie_tts_enabled';

function stripHtml(str) {
  const tmp = document.createElement('div');
  tmp.innerHTML = str;
  return (tmp.textContent || tmp.innerText || '').trim();
}

const tts = {
  enabled: false,
  _voice: null,
  _voicesLoaded: false,

  // Converse mode hook — fires once the voice has actually gone quiet (the
  // utterance finished and nothing else is queued). v1's converse loop uses
  // it to reopen the mic, so the table rhythm is: DM speaks, then listens.
  onIdle: null,
  _fireIdleSoon() {
    if (typeof this.onIdle !== 'function') return;
    // Small grace tick: sequenced beats (speakAndWait loops) queue their next
    // line immediately after the previous resolves — don't open the mic in
    // the gap between two beats of the same narration.
    setTimeout(() => {
      if (!this.isSupported()) return;
      if (speechSynthesis.speaking || speechSynthesis.pending) return;
      if (typeof this.onIdle === 'function') this.onIdle();
    }, 300);
  },

  init() {
    try {
      this.enabled = localStorage.getItem(STORAGE_KEY) === '1';
    } catch { this.enabled = false; }

    if (!this.isSupported()) return;

    const pickVoice = () => {
      const voices = speechSynthesis.getVoices();
      if (!voices.length) return;
      this._voicesLoaded = true;
      // Prefer an English voice; bias toward names containing "Daniel", "Samantha", or "Google UK"
      const english = voices.filter(v => /^en[-_]/i.test(v.lang));
      const preferred = english.find(v => /Daniel|Samantha|Google UK/i.test(v.name));
      this._voice = preferred || english[0] || voices[0] || null;
    };

    pickVoice();
    if (!this._voicesLoaded) {
      speechSynthesis.addEventListener('voiceschanged', () => pickVoice());
    }
  },

  isSupported() {
    return typeof window !== 'undefined' && !!window.speechSynthesis;
  },

  speak(text) {
    if (!this.enabled || !this.isSupported()) return;
    const clean = stripHtml(String(text || ''));
    if (!clean) return;

    // Cancel any in-progress speech before starting new
    speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate = 0.95;
    utter.pitch = 1.0;
    if (this._voice) utter.voice = this._voice;
    utter.onend = () => this._fireIdleSoon();
    utter.onerror = () => this._fireIdleSoon();
    speechSynthesis.speak(utter);
  },

  // Speak a line and resolve when it finishes (or on error). Resolves
  // immediately when TTS is disabled/unsupported so callers can use it to pace a
  // sequence of lines: with voice on, the cadence follows the narration; with
  // voice off, the caller falls back to its own delay. Never rejects.
  speakAndWait(text) {
    return new Promise((resolve) => {
      if (!this.enabled || !this.isSupported()) return resolve(false);
      const clean = stripHtml(String(text || ''));
      if (!clean) return resolve(false);
      speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(clean);
      utter.rate = 0.95;
      utter.pitch = 1.0;
      if (this._voice) utter.voice = this._voice;
      let done = false;
      const finish = () => { if (done) return; done = true; this._fireIdleSoon(); resolve(true); };
      utter.onend = finish;
      utter.onerror = finish;
      // Safety net: some browsers drop onend for short utterances.
      setTimeout(finish, Math.min(12000, 1200 + clean.length * 70));
      speechSynthesis.speak(utter);
    });
  },

  stop() {
    if (!this.isSupported()) return;
    speechSynthesis.cancel();
  },

  toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem(STORAGE_KEY, this.enabled ? '1' : '0'); } catch {}
    if (!this.enabled) this.stop();
    return this.enabled;
  }
};

export default tts;
