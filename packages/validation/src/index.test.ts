import { describe, expect, it } from 'vitest';
import { normalizeSiteUrl, portSchema } from './index';

describe('portSchema', () => {
  it('parses a valid port', () => {
    expect(portSchema.parse('3000')).toBe(3000);
  });

  it('rejects an invalid port', () => {
    expect(() => portSchema.parse('70000')).toThrow();
  });
});

describe('normalizeSiteUrl', () => {
  it('normalizes equivalent root URLs to the same canonical value', () => {
    const variants = [
      'https://Example.com',
      'https://example.com/',
      'https://example.com/?utm_source=test',
      'https://example.com/#section',
    ];

    const normalized = variants.map((value) => normalizeSiteUrl(value));

    expect(normalized).toEqual(
      Array.from({ length: variants.length }, () => ({
        canonicalUrl: 'https://example.com',
        normalizedUrl: 'https://example.com',
      })),
    );
  });

  it('preserves meaningful non-root paths while normalizing the host and path', () => {
    expect(
      normalizeSiteUrl('HTTPS://Example.com:443/Travel//Guides///'),
    ).toEqual({
      canonicalUrl: 'https://example.com/Travel/Guides',
      normalizedUrl: 'https://example.com/Travel/Guides',
    });
  });

  it('removes default ports but preserves non-default ports', () => {
    expect(normalizeSiteUrl('http://example.com:80')).toEqual({
      canonicalUrl: 'http://example.com',
      normalizedUrl: 'http://example.com',
    });
    expect(normalizeSiteUrl('https://example.com:8443')).toEqual({
      canonicalUrl: 'https://example.com:8443',
      normalizedUrl: 'https://example.com:8443',
    });
  });

  it('rejects malformed, credential-bearing, localhost, and private-network URLs', () => {
    expect(() => normalizeSiteUrl('not a url')).toThrow('Enter a valid URL');
    expect(() => normalizeSiteUrl('https://user:pass@example.com')).toThrow(
      'embedded credentials',
    );
    expect(() => normalizeSiteUrl('https://localhost:3000')).toThrow(
      'Localhost URLs are not allowed',
    );
    expect(() => normalizeSiteUrl('http://127.0.0.1')).toThrow(
      'Private-network URLs are not allowed',
    );
    expect(() => normalizeSiteUrl('http://192.168.1.10')).toThrow(
      'Private-network URLs are not allowed',
    );
    expect(() => normalizeSiteUrl('http://[::1]')).toThrow(
      'Private-network URLs are not allowed',
    );
  });

  it('rejects non-http schemes', () => {
    expect(() => normalizeSiteUrl('ftp://example.com')).toThrow(
      'URL must start with http:// or https://',
    );
  });
});
