import { describe, expect, it } from 'vitest';
import { COLDEST_C, HOTTEST_C, formatTemperature, toCelsius, toFahrenheit } from './temperature';

describe('temperature', () => {
  it('converts the reference points both ways', () => {
    expect(toFahrenheit(0)).toBe(32);
    expect(toFahrenheit(100)).toBe(212);
    expect(toFahrenheit(-40)).toBe(-40);
    expect(toCelsius(32)).toBe(0);
    expect(toCelsius(212)).toBe(100);
    expect(toCelsius(-40)).toBe(-40);
  });

  it('keeps both ends of the slider round in either scale', () => {
    expect(toFahrenheit(COLDEST_C)).toBe(-40);
    expect(toFahrenheit(HOTTEST_C)).toBe(212);
  });

  it('shows at most two decimals', () => {
    expect(formatTemperature(toFahrenheit(20))).toBe('68');
    expect(formatTemperature(toFahrenheit(37))).toBe('98.6');
    expect(formatTemperature(toCelsius(72))).toBe('22.22');
    expect(formatTemperature(toCelsius(-459.67))).toBe('-273.15');
  });
});
