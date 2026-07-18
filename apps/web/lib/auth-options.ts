import type { NextAuthConfig } from 'next-auth';
import type { DatabaseClient } from '@site-quality-audit/database';
import { ensurePrivateWorkspaceForUser } from '@site-quality-audit/database';
import { WEB_SERVICE_NAME } from '@site-quality-audit/domain';
import { toBrowserSession } from './session-shape';

type AuthLoggerSink = (record: string) => void;
type AuthLoggerSinks = Record<'debug' | 'error' | 'warn', AuthLoggerSink>;

const defaultAuthLogSink: AuthLoggerSinks = {
  debug: (record) => console.debug(record),
  error: (record) => console.error(record),
  warn: (record) => console.warn(record),
};

const redactedKeys = new Set([
  'access_token',
  'account',
  'authorization',
  'clientSecret',
  'id_token',
  'profile',
  'refresh_token',
  'secret',
  'session',
  'sessionToken',
  'token',
]);

const classifyAuthText = (value: string) => {
  const normalizedValue = value.toLowerCase();

  if (normalizedValue.includes('provision')) {
    return 'provisioning';
  }

  if (
    normalizedValue.includes('oauth') ||
    normalizedValue.includes('provider')
  ) {
    return 'oauth';
  }

  if (
    normalizedValue.includes('adapter') ||
    normalizedValue.includes('database') ||
    normalizedValue.includes('session')
  ) {
    return 'adapter';
  }

  return 'auth';
};

const sanitizeForLog = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sanitizeForLog);
  }

  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
    };
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        redactedKeys.has(key) ? '[redacted]' : sanitizeForLog(nestedValue),
      ]),
    );
  }

  return value;
};

const getSinkForLevel = (
  sinks: AuthLoggerSink | AuthLoggerSinks,
  level: 'debug' | 'warn' | 'error',
) => (typeof sinks === 'function' ? sinks : sinks[level]);

const createAuthLogWriter =
  (
    level: 'debug' | 'warn' | 'error',
    sinks: AuthLoggerSink | AuthLoggerSinks,
  ) =>
  (event: string, fields: Record<string, unknown>) => {
    const sanitizedFields = sanitizeForLog(fields) as Record<string, unknown>;

    getSinkForLevel(
      sinks,
      level,
    )(
      JSON.stringify({
        ...sanitizedFields,
        event,
        level,
        service: WEB_SERVICE_NAME,
        timestamp: new Date().toISOString(),
      }),
    );
  };

const logAuthError = (
  sinks: AuthLoggerSink | AuthLoggerSinks,
  category: 'oauth' | 'adapter' | 'provisioning' | 'auth',
  error: Error,
  fields: Record<string, unknown> = {},
) =>
  createAuthLogWriter('error', sinks)('auth.error', {
    category,
    error,
    ...fields,
  });

export const createAuthLogger = (
  sink: AuthLoggerSink | AuthLoggerSinks = defaultAuthLogSink,
): NonNullable<NextAuthConfig['logger']> => {
  const warn = createAuthLogWriter('warn', sink);
  const debug = createAuthLogWriter('debug', sink);

  return {
    error(error) {
      logAuthError(
        sink,
        classifyAuthText(`${error.name} ${error.message}`),
        error,
      );
    },
    warn(code, ...message) {
      warn('auth.warn', {
        category: classifyAuthText(code),
        code,
        details: message,
      });
    },
    debug(code, ...message) {
      debug('auth.debug', {
        category: classifyAuthText(code),
        code,
        details: message,
      });
    },
  };
};

const createProvisioningEventHandler =
  (
    prisma: DatabaseClient,
    sink: AuthLoggerSink | AuthLoggerSinks,
    trigger: 'createUser' | 'signIn',
  ) =>
  async ({ user }: { user: { id?: string; name?: string | null } }) => {
    if (!user.id) {
      const error = new Error(
        `Auth user missing persisted id during ${trigger} provisioning`,
      );
      logAuthError(sink, 'provisioning', error, { trigger });
      throw error;
    }

    try {
      await ensurePrivateWorkspaceForUser(prisma, user.id, user.name);
    } catch (error) {
      logAuthError(
        sink,
        'provisioning',
        error instanceof Error
          ? error
          : new Error('Workspace provisioning failed'),
        {
          trigger,
          userId: user.id,
        },
      );
      throw error;
    }
  };

export const createAuthOptions = (
  prisma: DatabaseClient,
): Pick<NextAuthConfig, 'callbacks' | 'events' | 'logger'> => {
  const logger = createAuthLogger(defaultAuthLogSink);

  return {
    callbacks: {
      session: async ({ session }) => toBrowserSession(session),
      signIn: async () => true,
    },
    events: {
      createUser: createProvisioningEventHandler(
        prisma,
        defaultAuthLogSink,
        'createUser',
      ),
      signIn: createProvisioningEventHandler(
        prisma,
        defaultAuthLogSink,
        'signIn',
      ),
    },
    logger,
  };
};
