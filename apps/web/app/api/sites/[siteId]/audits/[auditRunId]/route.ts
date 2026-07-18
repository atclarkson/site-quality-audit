import { NextResponse } from 'next/server';
import { getAuthorizedAppContext } from '../../../../../../lib/authorized-app-context';
import { getAuditRunForWorkspace } from '../../../../../../lib/crawl-results';

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ auditRunId: string; siteId: string }>;
  },
) {
  const context = await getAuthorizedAppContext();

  if (!context) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { auditRunId, siteId } = await params;
  const auditRun = await getAuditRunForWorkspace(context, siteId, auditRunId);

  if (!auditRun) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...auditRun,
    completedAt: auditRun.completedAt?.toISOString() || null,
    createdAt: auditRun.createdAt.toISOString(),
    failedAt: auditRun.failedAt?.toISOString() || null,
    progressUpdatedAt: auditRun.progressUpdatedAt?.toISOString() || null,
    robotsTxtFetchedAt: auditRun.robotsTxtFetchedAt?.toISOString() || null,
    startedAt: auditRun.startedAt?.toISOString() || null,
    updatedAt: auditRun.updatedAt.toISOString(),
  });
}
