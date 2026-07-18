import { portSchema } from '@site-quality-audit/validation';
import { ZodError, z } from 'zod';

const nodeEnvSchema = z
  .enum(['development', 'test', 'production'])
  .default('development');

const databaseUrlSchema = z
  .string()
  .min(1, 'Required')
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === 'postgres:' || url.protocol === 'postgresql:') &&
        url.hostname.length > 0 &&
        url.pathname.length > 1
      );
    } catch {
      return false;
    }
  }, 'Expected a valid postgresql:// connection string');

const webEnvSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
  NODE_ENV: nodeEnvSchema,
  PORT: portSchema.optional().default(3000),
});

const workerEnvSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const databaseEnvSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
});

const formatEnvError = (name: string, error: ZodError) => {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.join('.') || 'root';
      return `${path}: ${issue.message}`;
    })
    .join('; ');

  return new Error(`${name} environment is invalid: ${details}`);
};

export type WebEnv = z.infer<typeof webEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;

export const parseWebEnv = (input: NodeJS.ProcessEnv): WebEnv => {
  try {
    return webEnvSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw formatEnvError('web', error);
    }

    throw error;
  }
};

export const parseWorkerEnv = (input: NodeJS.ProcessEnv): WorkerEnv => {
  try {
    return workerEnvSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw formatEnvError('worker', error);
    }

    throw error;
  }
};

export const parseDatabaseEnv = (input: NodeJS.ProcessEnv): DatabaseEnv => {
  try {
    return databaseEnvSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw formatEnvError('database', error);
    }

    throw error;
  }
};

export const getWebEnv = () => parseWebEnv(process.env);
export const getWorkerEnv = () => parseWorkerEnv(process.env);
export const getDatabaseEnv = () => parseDatabaseEnv(process.env);
