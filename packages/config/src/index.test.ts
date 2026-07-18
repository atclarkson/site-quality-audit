import { describe, expect, it } from 'vitest';
import { parseDatabaseEnv, parseWebEnv, parseWorkerEnv } from './index';

describe('parseWebEnv', () => {
  it('parses a valid web environment', () => {
    expect(
      parseWebEnv({
        NODE_ENV: 'production',
        PORT: '4000',
        DATABASE_URL:
          'postgresql://site_quality_audit:site_quality_audit@localhost:5432/site_quality_audit',
      }),
    ).toEqual({
      DATABASE_URL:
        'postgresql://site_quality_audit:site_quality_audit@localhost:5432/site_quality_audit',
      NODE_ENV: 'production',
      PORT: 4000,
    });
  });

  it('rejects an invalid web environment', () => {
    expect(() =>
      parseWebEnv({
        NODE_ENV: 'preview',
        PORT: '4000',
        DATABASE_URL: 'not-a-database-url',
      }),
    ).toThrow('web environment is invalid');
  });
});

describe('parseWorkerEnv', () => {
  it('parses a valid worker environment', () => {
    expect(
      parseWorkerEnv({
        NODE_ENV: 'test',
        LOG_LEVEL: 'debug',
        DATABASE_URL:
          'postgresql://site_quality_audit:site_quality_audit@localhost:5432/site_quality_audit',
      }),
    ).toEqual({
      DATABASE_URL:
        'postgresql://site_quality_audit:site_quality_audit@localhost:5432/site_quality_audit',
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug',
    });
  });

  it('rejects an invalid worker environment', () => {
    expect(() =>
      parseWorkerEnv({
        NODE_ENV: 'development',
        LOG_LEVEL: 'verbose',
        DATABASE_URL: 'postgresql://localhost',
      }),
    ).toThrow('worker environment is invalid');
  });
});

describe('parseDatabaseEnv', () => {
  it('parses a valid database environment', () => {
    expect(
      parseDatabaseEnv({
        DATABASE_URL:
          'postgresql://site_quality_audit:site_quality_audit@localhost:5432/site_quality_audit',
      }),
    ).toEqual({
      DATABASE_URL:
        'postgresql://site_quality_audit:site_quality_audit@localhost:5432/site_quality_audit',
    });
  });

  it('rejects an invalid database environment without echoing the URL', () => {
    expect(() =>
      parseDatabaseEnv({
        DATABASE_URL: 'postgresql://user:secret@localhost',
      }),
    ).toThrow('database environment is invalid');
  });
});
