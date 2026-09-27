// Human-readable lookups for ids used by the UDP format.

export const TRACKS: Record<number, { name: string; short: string }> = {
  0: { name: 'Melbourne', short: 'AUS' },
  2: { name: 'Shanghai', short: 'CHN' },
  3: { name: 'Sakhir', short: 'BHR' },
  4: { name: 'Catalunya', short: 'ESP' },
  5: { name: 'Monaco', short: 'MON' },
  6: { name: 'Montréal', short: 'CAN' },
  7: { name: 'Silverstone', short: 'GBR' },
  9: { name: 'Hungaroring', short: 'HUN' },
  10: { name: 'Spa-Francorchamps', short: 'BEL' },
  11: { name: 'Monza', short: 'ITA' },
  12: { name: 'Marina Bay', short: 'SGP' },
  13: { name: 'Suzuka', short: 'JPN' },
  14: { name: 'Yas Marina', short: 'ABU' },
  15: { name: 'Austin', short: 'USA' },
  16: { name: 'Interlagos', short: 'BRA' },
  17: { name: 'Red Bull Ring', short: 'AUT' },
  19: { name: 'Mexico City', short: 'MEX' },
  20: { name: 'Baku', short: 'AZE' },
  26: { name: 'Zandvoort', short: 'NED' },
  27: { name: 'Imola', short: 'EMI' },
  29: { name: 'Jeddah', short: 'SAU' },
  30: { name: 'Miami', short: 'MIA' },
  31: { name: 'Las Vegas', short: 'LVG' },
  32: { name: 'Lusail', short: 'QAT' },
  39: { name: 'Silverstone (Reverse)', short: 'GBR' },
  40: { name: 'Red Bull Ring (Reverse)', short: 'AUT' },
  41: { name: 'Zandvoort (Reverse)', short: 'NED' },
  42: { name: 'Madrid', short: 'MAD' },
};

export const trackName = (id: number) => TRACKS[id]?.name ?? `Track ${id}`;

// Base team ids (0-9) and the 2026 Season Pack ids (476-486).
const TEAMS: Record<number, { name: string; colour: string }> = {
  0: { name: 'Mercedes', colour: '#27F4D2' },
  1: { name: 'Ferrari', colour: '#E8002D' },
  2: { name: 'Red Bull Racing', colour: '#3671C6' },
  3: { name: 'Williams', colour: '#64C4FF' },
  4: { name: 'Aston Martin', colour: '#229971' },
  5: { name: 'Alpine', colour: '#FF87BC' },
  6: { name: 'Racing Bulls', colour: '#6692FF' },
  7: { name: 'Haas', colour: '#B6BABD' },
  8: { name: 'McLaren', colour: '#FF8000' },
  9: { name: 'Sauber', colour: '#52E252' },
  476: { name: 'Mercedes', colour: '#27F4D2' },
  477: { name: 'Ferrari', colour: '#E8002D' },
  478: { name: 'Red Bull Racing', colour: '#3671C6' },
  479: { name: 'Williams', colour: '#64C4FF' },
  480: { name: 'Aston Martin', colour: '#229971' },
  481: { name: 'Alpine', colour: '#FF87BC' },
  482: { name: 'Racing Bulls', colour: '#6692FF' },
  483: { name: 'Haas', colour: '#B6BABD' },
  484: { name: 'McLaren', colour: '#FF8000' },
  485: { name: 'Audi', colour: '#F50537' },
  486: { name: 'Cadillac', colour: '#D4AF37' },
};

export const team = (id: number) => TEAMS[id] ?? { name: `Team ${id}`, colour: '#8A95BF' };

// Visual compounds (what the HUD shows).
export const COMPOUNDS: Record<number, { label: string; colour: string }> = {
  16: { label: 'S', colour: '#FF3B3B' },
  17: { label: 'M', colour: '#FFC906' },
  18: { label: 'H', colour: '#F2F4FA' },
  7: { label: 'I', colour: '#3DD66B' },
  8: { label: 'W', colour: '#2F8BFF' },
};
// Actual compound (C0–C6) → visual, for when only the actual compound is known.
export const ACTUAL_TO_LABEL: Record<number, string> = {
  22: 'C6', 16: 'C5', 17: 'C4', 18: 'C3', 19: 'C2', 20: 'C1', 21: 'C0', 7: 'INT', 8: 'WET',
};
export const compound = (visual: number) => COMPOUNDS[visual] ?? { label: '?', colour: '#8A95BF' };

export const SESSION_TYPES: Record<number, string> = {
  0: 'Unknown', 1: 'Practice 1', 2: 'Practice 2', 3: 'Practice 3', 4: 'Short Practice',
  5: 'Qualifying 1', 6: 'Qualifying 2', 7: 'Qualifying 3', 8: 'Short Qualifying',
  9: 'One-Shot Qualifying', 10: 'Sprint Shootout 1', 11: 'Sprint Shootout 2',
  12: 'Sprint Shootout 3', 13: 'Short Sprint Shootout', 14: 'One-Shot Sprint Shootout',
  15: 'Race', 16: 'Race 2', 17: 'Race 3', 18: 'Time Trial',
};
export const isRace = (t: number) => t >= 15 && t <= 17;

export const WEATHER = ['Clear', 'Light cloud', 'Overcast', 'Light rain', 'Heavy rain', 'Storm'];
export const SAFETY_CAR = ['', 'Safety Car', 'Virtual Safety Car', 'Formation Lap'];
export const ERS_MODES = ['None', 'Medium', 'Hotlap', 'Overtake'];
export const FUEL_MIX = ['Lean', 'Standard', 'Rich', 'Max'];
export const PIT_STATUS = ['', 'PIT', 'PIT'];
export const DRIVER_STATUS = ['Garage', 'Flying lap', 'In lap', 'Out lap', 'On track'];
export const FLAG_COLOURS: Record<number, string> = { 1: '#3DD66B', 2: '#2F8BFF', 3: '#FFC906' };

// Mini-sector colours, indexed by MiniColour (0 not counted, 1 slower, 2 PB, 3 overall best).
export const MINI_COLOURS = ['#58638f', '#ffc906', '#2fd27a', '#b44dff'];
export const MINI_LABELS = ['Not counted (out/in-lap, pits, invalid)', 'Slower than your best', 'Personal best', 'Fastest overall'];
export const MINI_PENDING = '#1e2a5a';

// Energy map categories (validated for colour-blind separation on the dark surface).
export const ENERGY = [
  { key: 'harvest', label: 'Harvesting', colour: '#4D8DFF' },
  { key: 'medium', label: 'Deploy · Medium', colour: '#2FD27A' },
  { key: 'hotlap', label: 'Deploy · Hotlap', colour: '#FF9F1A' },
  { key: 'overtake', label: 'Overtake', colour: '#FF3355' },
] as const;
export type EnergyKey = (typeof ENERGY)[number]['key'];
