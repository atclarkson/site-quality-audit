export const APP_NAME = 'Site Quality Audit';

export const WEB_SERVICE_NAME = 'web';
export const WORKER_SERVICE_NAME = 'worker';

export type ServiceName = typeof WEB_SERVICE_NAME | typeof WORKER_SERVICE_NAME;
export type HealthStatus = 'ok';
