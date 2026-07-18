import { NextResponse } from 'next/server';
import { getAuthorizedAppContext } from '../../../../../lib/authorized-app-context';
import {
  getAuditSnapshotForSite,
  toSerializableAuditSnapshot,
} from '../../../../../lib/audit-management';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const context = await getAuthorizedAppContext();

  if (!context) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { siteId } = await params;
  const snapshot = await getAuditSnapshotForSite(context, siteId);

  if (!snapshot) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(toSerializableAuditSnapshot(snapshot));
}
