/** Parses a dotted-quad IPv4 address into an unsigned 32-bit number, or null. */
export function parseIPv4(text: string): number | null {
  const parts = text.trim().split('.');
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) return null;
  return parts.reduce((n, part) => n * 256 + Number(part), 0);
}

export const formatIPv4 = (n: number) => [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join('.');

/** Reads "10.0.0.1" or "10.0.0.1/8"; bits is null when no prefix was typed. */
export function parseCidr(text: string): { ip: number; bits: number | null } | null {
  const [address, prefix, ...rest] = text.trim().split('/');
  const ip = parseIPv4(address);
  if (ip === null || rest.length) return null;
  if (prefix === undefined) return { ip, bits: null };
  if (!/^\d{1,2}$/.test(prefix) || Number(prefix) > 32) return null;
  return { ip, bits: Number(prefix) };
}

/** The netmask for a prefix length, as a number: 24 is 255.255.255.0. */
export const maskFromBits = (bits: number) => (bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0);

export function subnet(ip: number, bits: number) {
  const netmask = maskFromBits(bits);
  const network = (ip & netmask) >>> 0;
  const wildcard = ~netmask >>> 0;
  const broadcast = (network | wildcard) >>> 0;
  const addresses = 2 ** (32 - bits);
  // A /31 is a point-to-point link that uses both addresses and a /32 is a single host (RFC 3021);
  // anything larger reserves its network and broadcast addresses.
  const whole = bits >= 31;
  return {
    network,
    broadcast,
    netmask,
    wildcard,
    addresses,
    usable: whole ? addresses : addresses - 2,
    first: whole ? network : network + 1,
    last: whole ? broadcast : broadcast - 1,
  };
}

/** The calculator's rows, ready to display. */
export function describeSubnet(ip: number, bits: number) {
  const s = subnet(ip, bits);
  const span = (from: number, to: number) => (from === to ? formatIPv4(from) : `${formatIPv4(from)} – ${formatIPv4(to)}`);
  return {
    network: `${formatIPv4(s.network)}/${bits}`,
    netmask: formatIPv4(s.netmask),
    wildcard: formatIPv4(s.wildcard),
    range: span(s.network, s.broadcast),
    usable: span(s.first, s.last),
    count: `${s.addresses.toLocaleString('en-US')} (${s.usable.toLocaleString('en-US')} usable)`,
  };
}
