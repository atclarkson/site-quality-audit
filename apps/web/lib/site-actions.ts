'use server';

import { redirect } from 'next/navigation';
import { getAuthorizedAppContext } from './authorized-app-context';
import { startAuditForSite } from './audit-management';
import {
  createSiteForWorkspace,
  deleteSiteForWorkspace,
  siteValuesFromFormData,
  toSiteFormErrorState,
  updateSiteForWorkspace,
  type SiteFormState,
} from './site-management';

const resolveAuthorizedContext = async () => {
  const context = await getAuthorizedAppContext();

  if (!context) {
    redirect('/');
  }

  return context;
};

export async function createSiteAction(
  _previousState: SiteFormState,
  formData: FormData,
): Promise<SiteFormState> {
  const context = await resolveAuthorizedContext();
  const values = siteValuesFromFormData(formData);
  let site;

  try {
    site = await createSiteForWorkspace(context, values);
  } catch (error) {
    return toSiteFormErrorState(error, values);
  }

  redirect(`/app/sites/${site.id}`);
}

export async function updateSiteAction(
  siteId: string,
  _previousState: SiteFormState,
  formData: FormData,
): Promise<SiteFormState> {
  const context = await resolveAuthorizedContext();
  const values = siteValuesFromFormData(formData);
  let site;

  try {
    site = await updateSiteForWorkspace(context, siteId, values);
  } catch (error) {
    return toSiteFormErrorState(error, values);
  }

  if (!site) {
    redirect('/app');
  }

  redirect(`/app/sites/${siteId}`);
}

export async function deleteSiteAction(siteId: string) {
  const context = await resolveAuthorizedContext();

  await deleteSiteForWorkspace(context, siteId);
  redirect('/app');
}

export async function startAuditAction(siteId: string) {
  const context = await resolveAuthorizedContext();
  const auditRun = await startAuditForSite(context, siteId);

  if (!auditRun) {
    redirect('/app');
  }

  redirect(`/app/sites/${siteId}/audits/${auditRun.id}`);
}
