export const toFahrenheit = (celsius: number) => (celsius * 9) / 5 + 32;

export const toCelsius = (fahrenheit: number) => ((fahrenheit - 32) * 5) / 9;

// The slider's range: -40 °C to 260 °C, which is -40 °F to 500 °F, so both ends are round in either
// scale. It covers weather, body temperature, boiling water, and ovens.
export const COLDEST_C = -40;
export const HOTTEST_C = 260;

/** At most two decimals and no trailing zeros: 22.2222 shows as 22.22, 98.60000000000001 as 98.6. */
export function formatTemperature(degrees: number): string {
  return String(Math.round(degrees * 100) / 100);
}
