import { describe, expect, it } from 'vitest';
import { describeSubnet, formatIPv4, parseCidr, parseIPv4 } from './cidr';

const describe4 = (cidr: string) => {
  const { ip, bits } = parseCidr(cidr)!;
  return describeSubnet(ip, bits!);
};

describe('parseIPv4 and parseCidr', () => {
  it('round-trips dotted quads', () => {
    for (const ip of ['0.0.0.0', '10.0.0.1', '192.168.1.10', '255.255.255.255']) expect(formatIPv4(parseIPv4(ip)!)).toBe(ip);
  });

  it('rejects anything that is not an IPv4 address', () => {
    for (const text of ['', '10.0.0', '10.0.0.256', '10.0.0.1.2', '10.0.0.x', 'example.com']) expect(parseIPv4(text), text).toBeNull();
  });

  it('reads an optional prefix', () => {
    expect(parseCidr('10.0.0.1')).toEqual({ ip: parseIPv4('10.0.0.1'), bits: null });
    expect(parseCidr(' 10.0.0.1/8 ')).toEqual({ ip: parseIPv4('10.0.0.1'), bits: 8 });
    for (const text of ['10.0.0.1/33', '10.0.0.1/', '10.0.0.1/8/2', '10.0.0.1/x']) expect(parseCidr(text), text).toBeNull();
  });
});

describe('describeSubnet', () => {
  it('works out a /24 from any address in it', () => {
    expect(describe4('192.168.1.10/24')).toEqual({
      network: '192.168.1.0/24',
      netmask: '255.255.255.0',
      wildcard: '0.0.0.255',
      range: '192.168.1.0 – 192.168.1.255',
      usable: '192.168.1.1 – 192.168.1.254',
      count: '256 (254 usable)',
    });
  });

  it('handles prefixes that do not end on an octet', () => {
    expect(describe4('10.20.30.40/19')).toMatchObject({
      network: '10.20.0.0/19',
      netmask: '255.255.224.0',
      wildcard: '0.0.31.255',
      range: '10.20.0.0 – 10.20.31.255',
      count: '8,192 (8,190 usable)',
    });
  });

  it('uses every address of a /31 and /32', () => {
    expect(describe4('10.0.0.1/31')).toMatchObject({ range: '10.0.0.0 – 10.0.0.1', usable: '10.0.0.0 – 10.0.0.1', count: '2 (2 usable)' });
    expect(describe4('10.0.0.5/32')).toMatchObject({ range: '10.0.0.5', usable: '10.0.0.5', count: '1 (1 usable)' });
  });

  it('covers the whole address space at /0', () => {
    expect(describe4('203.0.113.9/0')).toMatchObject({
      network: '0.0.0.0/0',
      netmask: '0.0.0.0',
      wildcard: '255.255.255.255',
      count: '4,294,967,296 (4,294,967,294 usable)',
    });
  });
});
