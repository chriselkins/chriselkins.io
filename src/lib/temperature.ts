export const toFahrenheit = (celsius: number) => (celsius * 9) / 5 + 32;

export const toCelsius = (fahrenheit: number) => ((fahrenheit - 32) * 5) / 9;

/** At most two decimals and no trailing zeros: 22.2222 shows as 22.22, 98.60000000000001 as 98.6. */
export function formatTemperature(degrees: number): string {
  return String(Math.round(degrees * 100) / 100);
}
