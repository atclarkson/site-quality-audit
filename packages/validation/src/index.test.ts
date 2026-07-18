import { describe, expect, it } from 'vitest';
import { portSchema } from './index';

describe('portSchema', () => {
  it('parses a valid port', () => {
    expect(portSchema.parse('3000')).toBe(3000);
  });

  it('rejects an invalid port', () => {
    expect(() => portSchema.parse('70000')).toThrow();
  });
});
