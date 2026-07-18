import { describe, expect, it, vi } from 'vitest';
import { createLogger } from './index';

describe('createLogger', () => {
  it('writes structured records with required fields', () => {
    const sink = vi.fn();
    const logger = createLogger({ service: 'worker', sink });

    logger.info('worker.start', { ready: true });

    const [message] = sink.mock.calls[0];
    const record = JSON.parse(message) as Record<string, unknown>;

    expect(record).toMatchObject({
      event: 'worker.start',
      level: 'info',
      service: 'worker',
      ready: true,
    });
    expect(typeof record.timestamp).toBe('string');
  });
});
