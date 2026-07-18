import { WEB_SERVICE_NAME } from '@site-quality-audit/domain';

export function GET() {
  return Response.json({
    status: 'ok',
    service: WEB_SERVICE_NAME,
  });
}
