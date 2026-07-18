import type { ServiceName } from '@site-quality-audit/domain';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogFields = Record<string, unknown>;
type LogSink = (record: string) => void;

export type StructuredLogRecord = LogFields & {
  event: string;
  level: LogLevel;
  service: ServiceName;
  timestamp: string;
};

export const createLogRecord = (
  service: ServiceName,
  level: LogLevel,
  event: string,
  fields: LogFields = {},
): StructuredLogRecord => ({
  ...fields,
  event,
  level,
  service,
  timestamp: new Date().toISOString(),
});

export const createLogger = ({
  service,
  sink = console.log,
}: {
  service: ServiceName;
  sink?: LogSink;
}) => ({
  debug: (event: string, fields?: LogFields) =>
    sink(JSON.stringify(createLogRecord(service, 'debug', event, fields))),
  info: (event: string, fields?: LogFields) =>
    sink(JSON.stringify(createLogRecord(service, 'info', event, fields))),
  warn: (event: string, fields?: LogFields) =>
    sink(JSON.stringify(createLogRecord(service, 'warn', event, fields))),
  error: (event: string, fields?: LogFields) =>
    sink(JSON.stringify(createLogRecord(service, 'error', event, fields))),
});
