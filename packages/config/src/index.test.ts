import { describe, expect, it } from 'vitest';
import { parseWebEnv, parseWorkerEnv } from './index';

describe('parseWebEnv', () => {
  it('parses a valid web environment', () => {
    expect(parseWebEnv({ NODE_ENV: 'production', PORT: '4000' })).toEqual({
      NODE_ENV: 'production',
      PORT: 4000,
    });
  });

  it('rejects an invalid web environment', () => {
    expect(() => parseWebEnv({ NODE_ENV: 'preview', PORT: '4000' })).toThrow(
      'web environment is invalid',
    );
  });
});

describe('parseWorkerEnv', () => {
  it('parses a valid worker environment', () => {
    expect(parseWorkerEnv({ NODE_ENV: 'test', LOG_LEVEL: 'debug' })).toEqual({
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug',
    });
  });

  it('rejects an invalid worker environment', () => {
    expect(() =>
      parseWorkerEnv({ NODE_ENV: 'development', LOG_LEVEL: 'verbose' }),
    ).toThrow('worker environment is invalid');
  });
});
