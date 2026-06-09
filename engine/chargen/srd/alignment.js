// SRD 5.1 — the nine-point alignment grid. `soul` is the seed it plants in the
// engine's morality state (v22+ seven-axis soul): starting virtue/corruption.

export const ALIGNMENTS = [
  { id: 'lg', name: 'Lawful Good', text: 'Honor and compassion, by the book.', soul: { virtue: 2, corruption: 0 } },
  { id: 'ng', name: 'Neutral Good', name2: 'Good', text: 'Do the most good the day allows.', soul: { virtue: 2, corruption: 0 } },
  { id: 'cg', name: 'Chaotic Good', text: 'Conscience first, rules later.', soul: { virtue: 1, corruption: 0 } },
  { id: 'ln', name: 'Lawful Neutral', text: 'Order above all; the law is the law.', soul: { virtue: 0, corruption: 0 } },
  { id: 'n', name: 'True Neutral', text: 'Balance. Take each thing as it comes.', soul: { virtue: 0, corruption: 0 } },
  { id: 'cn', name: 'Chaotic Neutral', text: 'Freedom is the only flag you fly.', soul: { virtue: 0, corruption: 0 } },
  { id: 'le', name: 'Lawful Evil', text: 'Take what you want — within the rules you keep.', soul: { virtue: 0, corruption: 2 } },
  { id: 'ne', name: 'Neutral Evil', text: 'Whatever works. Whoever pays.', soul: { virtue: 0, corruption: 2 } },
  { id: 'ce', name: 'Chaotic Evil', text: 'Appetite, cruelty, and a match.', soul: { virtue: 0, corruption: 3 } }
];

export function listAlignments() {
  return ALIGNMENTS;
}

export function getAlignment(id) {
  return ALIGNMENTS.find(a => a.id === String(id)) || null;
}
