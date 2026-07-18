import { describe, expect, it } from 'vitest';
import { parseDatabaseEnv, parseWebEnv, parseWorkerEnv } from './index';

describe('parseWebEnv', () => {
  it('parses a valid web environment', () => {
    expect(
      parseWebEnv({
        AUTH_GOOGLE_ID: 'google-client-id',
        AUTH_GOOGLE_SECRET: 'google-client-secret',
        AUTH_SECRET: 'test-auth-secret',
        AUTH_TRUST_HOST: 'true',
        NODE_ENV: 'production',
        PORT: '4000',
        DATABASE_URL:
          'postgresql://site_quality_audit:site_quality_audit@localhost:5432/site_quality_audit',
        REDIS_URL: 'redis://localhost:6379',
      }),
    ).toEqual({
      AUTH_GOOGLE_ID: 'google-client-id',
      AUTH_GOOGLE_SECRET: 'google-client-secret',
      AUTH_SECRET: 'test-auth-secret',
      AUTH_TRUST_HOST: true,
      DATABASE_URL:
        'postgresql://site_quality_audit:site_quality_audit@localhost:5432/site_quality_audit',
      NODE_ENV: 'production',
      PORT: 4000,
      REDIS_URL: 'redis://localhost:6379',
    });
  });

  it('rejects an invalid web environment', () => {
    expect(() =>
      parseWebEnv({
        AUTH_GOOGLE_ID: '',
        AUTH_GOOGLE_SECRET: '',
        AUTH_SECRET: '',
        AUTH_TRUST_HOST: 'maybe',
        NODE_ENV: 'preview',
        PORT: '4000',
        DATABASE_URL: 'not-a-database-url',
        REDIS_URL: 'not-a-redis-url',
      }),
    ).toThrow('web environment is invalid');
  });

  it('rejects missing auth values without echoing secret values', () => {
    expect(() =>
      parseWebEnv({
        AUTH_GOOGLE_ID: 'google-client-id',
        AUTH_GOOGLE_SECRET: '',
        AUTH_SECRET: 'super-secret-value',
        AUTH_TRUST_HOST: 'true',
        NODE_ENV: 'development',
        PORT: '3000',
        DATABASE_URL:
          'postgresql://site_quality_audit:site_quality_audit@localhost:5432/site_quality_audit',
        REDIS_URL: 'redis://localhost:6379',
      }),
    ).toThrow('AUTH_GOOGLE_SECRET');
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
        REDIS_URL: 'redis://localhost:6379',
      }),
    ).toEqual({
      DATABASE_URL:
        'postgresql://site_quality_audit:site_quality_audit@localhost:5432/site_quality_audit',
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug',
      REDIS_URL: 'redis://localhost:6379',
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
