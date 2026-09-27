import { describe, expect, it } from 'vitest';
import { convert, formatNumber, metersToSlider, parseNumber, roundSignificant, sliderToMeters } from './length';

describe('convert', () => {
  it('uses the exact definitions', () => {
    expect(convert(1, 'in', 'mm')).toBe(25.4);
    expect(convert(1, 'in', 'cm')).toBe(2.54);
    expect(convert(1, 'ft', 'in')).toBe(12);
    expect(convert(1, 'ft', 'm')).toBe(0.3048);
    expect(convert(1, 'mi', 'ft')).toBe(5280);
    expect(convert(1, 'mi', 'm')).toBe(1609.344);
    expect(convert(1, 'km', 'm')).toBe(1000);
    expect(convert(1, 'm', 'mm')).toBe(1000);
  });

  it('formats the awkward directions cleanly', () => {
    expect(formatNumber(convert(1, 'm', 'ft'))).toBe('3.2808399');
    expect(formatNumber(convert(1, 'km', 'mi'))).toBe('0.62137119');
    expect(formatNumber(convert(1, 'cm', 'in'))).toBe('0.39370079');
    expect(formatNumber(convert(6, 'ft', 'cm'))).toBe('182.88');
    expect(formatNumber(convert(1, 'mm', 'mi'))).toBe('6.2137e-7');
  });
});

describe('formatNumber', () => {
  it('trims noise and keeps whole numbers whole', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(1609344)).toBe('1609344');
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(-2.5)).toBe('-2.5');
    expect(formatNumber(2e12)).toBe('2e12');
    expect(formatNumber(Number.NaN)).toBe('');
  });
});

describe('parseNumber', () => {
  it('accepts common ways of typing numbers', () => {
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber(' 42 ')).toBe(42);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('1e3')).toBe(1000);
    expect(parseNumber('-3')).toBe(-3);
    expect(parseNumber('1_000')).toBe(1000);
  });

  it('rejects everything else', () => {
    for (const bad of ['', 'abc', '1.2.3', '5ft', '--1', 'e5']) {
      expect(parseNumber(bad), bad).toBeNaN();
    }
  });
});

describe('slider', () => {
  it('maps 1 mm to 1,000 km onto 0-900 on a log scale', () => {
    expect(metersToSlider(0.001)).toBe(0);
    expect(metersToSlider(1)).toBe(300);
    expect(metersToSlider(1_000_000)).toBe(900);
    expect(sliderToMeters(300)).toBe(1);
    expect(sliderToMeters(600)).toBe(1000);
  });

  it('clamps out-of-range values', () => {
    expect(metersToSlider(0)).toBe(0);
    expect(metersToSlider(-5)).toBe(0);
    expect(metersToSlider(1e12)).toBe(900);
  });

  it('rounds slider values to tidy numbers', () => {
    expect(roundSignificant(12.589254, 3)).toBe(12.6);
    expect(roundSignificant(0.00031622, 3)).toBe(0.000316);
  });
});
