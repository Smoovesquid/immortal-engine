// Day / night — derived from the world's elapsed-hours counter (w.time.hours), which starts at 0 at
// the dawn opening and advances as you travel and rest. We offset it by DAWN_HOUR so hour 0 reads as
// morning (the game opens at first light), and the world then cycles day → dusk → night → dawn. Pure;
// shared by the lock rules (engine) and the map (which tints for time of day). No stored state.

export const DAWN_HOUR = 7;      // the adventure opens at ~7am
export const NIGHT_START = 22;   // 10pm — the valley locks up
export const NIGHT_END = 6;      // 6am — open again

/** hourOfDay(world) -> 0..23, the clock time of day. */
export function hourOfDay(world) {
  const elapsed = Number(world?.time?.hours) || 0;
  return (((elapsed + DAWN_HOUR) % 24) + 24) % 24;
}

/** isNight(world) -> true between NIGHT_START (10pm) and NIGHT_END (6am). */
export function isNight(world) {
  const h = hourOfDay(world);
  return h >= NIGHT_START || h < NIGHT_END;
}

/** dayPhase(world) -> 'night' | 'dawn' | 'day' | 'dusk' — coarse label for narration / the map. */
export function dayPhase(world) {
  const h = hourOfDay(world);
  if (h >= NIGHT_START || h < NIGHT_END) return 'night';
  if (h < 8) return 'dawn';
  if (h < 18) return 'day';
  return 'dusk';
}

/** darkness(world) -> 0 (bright day) .. 1 (deep night) — how dark to tint the map. */
export function darkness(world) {
  switch (dayPhase(world)) {
    case 'night': return 0.72;
    case 'dawn': case 'dusk': return 0.4;
    default: return 0.08;
  }
}

/** clockLabel(world) -> "7am" / "10pm" — a short wall-clock string for the map's time readout. */
export function clockLabel(world) {
  const h = hourOfDay(world);
  const am = h < 12;
  const h12 = (h % 12) || 12;
  return `${h12}${am ? 'am' : 'pm'}`;
}
