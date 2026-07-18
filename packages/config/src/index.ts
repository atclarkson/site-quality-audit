import { portSchema } from '@site-quality-audit/validation';
import { ZodError, z } from 'zod';

const nodeEnvSchema = z
  .enum(['development', 'test', 'production'])
  .default('development');

const webEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: portSchema.optional().default(3000),
});

const workerEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
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

export const getWebEnv = () => parseWebEnv(process.env);
export const getWorkerEnv = () => parseWorkerEnv(process.env);
