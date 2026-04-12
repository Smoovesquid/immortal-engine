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
    speechSynthesis.speak(utter);
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
