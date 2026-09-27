/**
 * Length conversion. Every unit is an exact whole number of micrometers
 * (1 in = 25,400 µm by definition), so conversions avoid most float drift.
 */
export const UNITS = {
  mm: { name: 'Millimeters', um: 1_000 },
  cm: { name: 'Centimeters', um: 10_000 },
  m: { name: 'Meters', um: 1_000_000 },
  km: { name: 'Kilometers', um: 1_000_000_000 },
  in: { name: 'Inches', um: 25_400 },
  ft: { name: 'Feet', um: 304_800 },
  mi: { name: 'Miles', um: 1_609_344_000 },
} as const;

export type Unit = keyof typeof UNITS;

export const METRIC: Unit[] = ['mm', 'cm', 'm', 'km'];
export const IMPERIAL: Unit[] = ['in', 'ft', 'mi'];

export function toMicrometers(value: number, unit: Unit): number {
  return value * UNITS[unit].um;
}

export function fromMicrometers(um: number, unit: Unit): number {
  return um / UNITS[unit].um;
}

export function convert(value: number, from: Unit, to: Unit): number {
  return (value * UNITS[from].um) / UNITS[to].um;
}

/** Parses "1,234.5", "1_000", "1e3", ".5". Returns NaN for anything else. */
export function parseNumber(text: string): number {
  const cleaned = text.trim().replace(/[,_\s]/g, '');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(cleaned)) return NaN;
  return Number(cleaned);
}

/** Up to 8 significant digits, no trailing zeros, exponent only for extreme values. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e12 || abs < 1e-6) {
    return n.toExponential(4).replace(/\.?0+e/, 'e').replace('e+', 'e');
  }
  return String(Number(n.toPrecision(8)));
}

/** Rounds to a number of significant digits (used when a slider sets a value). */
export function roundSignificant(n: number, digits: number): number {
  if (n === 0 || !Number.isFinite(n)) return n;
  return Number(n.toPrecision(digits));
}

// The slider covers 1 mm to 1,000 km on a log scale.
export const SLIDER_MIN_LOG = -3; // 10^-3 m
export const SLIDER_MAX_LOG = 6; // 10^6 m
export const SLIDER_STEPS = (SLIDER_MAX_LOG - SLIDER_MIN_LOG) * 100;

export function sliderToMeters(position: number): number {
  return 10 ** (SLIDER_MIN_LOG + position / 100);
}

export function metersToSlider(meters: number): number {
  if (!(meters > 0)) return 0;
  const position = (Math.log10(meters) - SLIDER_MIN_LOG) * 100;
  return Math.min(SLIDER_STEPS, Math.max(0, Math.round(position)));
}
